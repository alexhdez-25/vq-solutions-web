/* =========================================================
   Vanguard Quantitative Solutions — servidor local + API JSON
   Sin dependencias: solo Node.js >= 18
   Uso:  node server.js      →  http://localhost:3000
   ========================================================= */
"use strict";

const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ""; // para leer mensajes: GET /api/contact?token=...
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const CONTENT_FILE = path.join(PUBLIC_DIR, "data", "content.json");
const STORAGE_DIR = path.join(ROOT, "storage");
const MESSAGES_FILE = path.join(STORAGE_DIR, "messages.json");
const DOCS_DIR = path.join(PUBLIC_DIR, "api", "_docs");
const DOCS_INDEX = path.join(DOCS_DIR, "index.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/* ---------- Helpers ---------- */
function send(res, status, body, headers = {}) {
  res.writeHead(status, Object.assign({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  }, headers));
  res.end(body);
}
function json(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
}
async function readJSON(file, fallback) {
  try { return JSON.parse(await fsp.readFile(file, "utf8")); } catch { return fallback; }
}
function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error("Payload demasiado grande"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

// Rate limit simple en memoria para el formulario
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = 5;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now); hits.set(ip, list);
  return list.length > max;
}

/* ---------- API ---------- */
async function handleApi(req, res, url) {
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [resource, id] = parts;

  if (req.method === "OPTIONS") {
    return send(res, 204, "", {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
  }

  // GET /api  ·  GET /api/health
  if (!resource || resource === "health") {
    return json(res, 200, {
      ok: true, name: "VQS API", version: "1.0.0", time: new Date().toISOString(),
      endpoints: [
        "GET  /api/content",
        "GET  /api/services[?category=]",
        "GET  /api/services/:id",
        "POST /api/contact",
        "GET  /api/contact?token=ADMIN_TOKEN",
        "GET  /api/documents",
        "GET  /api/documents/:file",
      ],
    });
  }

  const content = await readJSON(CONTENT_FILE, null);
  if (!content) return json(res, 500, { error: "No se pudo leer content.json" });

  // GET /api/content
  if (resource === "content" && req.method === "GET") return json(res, 200, content);

  // GET /api/services[/:id]
  if (resource === "services" && req.method === "GET") {
    if (id) {
      const s = content.services.find((x) => x.id === id);
      return s ? json(res, 200, s) : json(res, 404, { error: "Servicio no encontrado" });
    }
    const cat = url.searchParams.get("category");
    return json(res, 200, cat ? content.services.filter((s) => s.category === cat) : content.services);
  }

  // POST /api/contact  ·  GET /api/contact?token=
  if (resource === "contact") {
    if (req.method === "GET") {
      if (!ADMIN_TOKEN || url.searchParams.get("token") !== ADMIN_TOKEN) return json(res, 401, { error: "No autorizado" });
      return json(res, 200, await readJSON(MESSAGES_FILE, []));
    }
    if (req.method === "POST") {
      const ip = req.socket.remoteAddress || "local";
      if (rateLimited(ip)) return json(res, 429, { error: "Demasiadas solicitudes. Intenta más tarde." });

      let body;
      try { body = JSON.parse(await readBody(req)); } catch (e) { return json(res, e.status || 400, { error: e.status ? e.message : "JSON inválido" }); }
      if (body.website) return json(res, 200, { ok: true, id: "ok" }); // honeypot anti-spam

      const msg = {
        id: "VQS-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(2).toString("hex").toUpperCase(),
        createdAt: new Date().toISOString(),
        name: clean(body.name, 120),
        company: clean(body.company, 120),
        email: clean(body.email, 160),
        phone: clean(body.phone, 40),
        service: clean(body.service, 80),
        message: clean(body.message, 3000),
        consent: body.consent === true,
      };
      const details = {};
      if (!msg.name) details.name = "Requerido";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.email)) details.email = "Correo inválido";
      if (!msg.message) details.message = "Requerido";
      if (!msg.consent) details.consent = "Debe aceptar";
      if (msg.service && !content.services.some((s) => s.id === msg.service)) details.service = "Servicio desconocido";
      if (Object.keys(details).length) return json(res, 422, { error: "Datos inválidos", details });

      await fsp.mkdir(STORAGE_DIR, { recursive: true });
      const list = await readJSON(MESSAGES_FILE, []);
      list.push(msg);
      await fsp.writeFile(MESSAGES_FILE, JSON.stringify(list, null, 2));
      console.log(`[contacto] ${msg.id} · ${msg.name} <${msg.email}> · ${msg.service || "general"}`);
      return json(res, 201, { ok: true, id: msg.id });
    }
  }

  // GET /api/documents[/:file]  — intercambio de documentación (futuro)
  if (resource === "documents" && req.method === "GET") {
    const index = await readJSON(DOCS_INDEX, []);
    if (!id) return json(res, 200, index);
    const entry = index.find((d) => d.file === id);
    if (!entry) return json(res, 404, { error: "Documento no encontrado" });
    const filePath = path.join(DOCS_DIR, path.basename(entry.file));
    try {
      const data = await fsp.readFile(filePath);
      return send(res, 200, data, {
        "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`,
      });
    } catch { return json(res, 404, { error: "Archivo no disponible" }); }
  }

  return json(res, 404, { error: "Endpoint no encontrado" });
}

/* ---------- Archivos estáticos ---------- */
async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  if (rel.split("/").some((seg) => seg.startsWith("."))) return send(res, 404, "No encontrado");
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, "Prohibido");
  try {
    const stat = await fsp.stat(file);
    if (stat.isDirectory()) return serveStatic(req, res, new URL(url.pathname + "/", url));
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  } catch {
    // SPA: cualquier ruta desconocida sin extensión devuelve index.html
    if (!path.extname(rel)) return serveStatic(req, res, new URL("/", url));
    send(res, 404, "No encontrado", { "Content-Type": "text/plain; charset=utf-8" });
  }
}

/* ---------- Servidor ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Método no permitido");
    return await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: "Error interno" });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Vanguard Quantitative Solutions`);
  console.log(`  ▸ Sitio:  http://localhost:${PORT}`);
  console.log(`  ▸ API:    http://localhost:${PORT}/api\n`);
});
