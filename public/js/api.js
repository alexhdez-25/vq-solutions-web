/* =========================================================
   Cliente API — VQS
   - Con el servidor local (node server.js) usa los endpoints /api/*
   - En un hosting estático sin backend, cae automáticamente al
     archivo JSON estático (data/content.json).
   ========================================================= */
(function (global) {
  const API_BASE = "/api";
  const STATIC_CONTENT = "data/content.json";
  let apiOnline = null;

  async function getJSON(url, opts) {
    const res = await fetch(url, Object.assign({ headers: { Accept: "application/json" } }, opts));
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  const API = {
    get online() { return apiOnline === true; },

    /** Contenido completo del sitio */
    async getContent() {
      try {
        const data = await getJSON(API_BASE + "/content");
        apiOnline = true;
        return data;
      } catch (e) {
        apiOnline = false;
        return getJSON(STATIC_CONTENT);
      }
    },

    /** Lista de servicios (opcionalmente por categoría) */
    async getServices(category) {
      const q = category ? "?category=" + encodeURIComponent(category) : "";
      return getJSON(API_BASE + "/services" + q);
    },

    /** Un servicio por id */
    async getService(id) {
      return getJSON(API_BASE + "/services/" + encodeURIComponent(id));
    },

    /** Envía el formulario de contacto. Devuelve { ok, id } */
    async sendContact(payload) {
      if (apiOnline === false) throw Object.assign(new Error("offline"), { code: "NO_API" });
      const res = await fetch(API_BASE + "/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || "Error"), { details: data.details });
      return data;
    },

    /** Catálogo de documentos para intercambio (uso futuro) */
    async getDocuments() {
      return getJSON(API_BASE + "/documents");
    },
  };

  global.VQS_API = API;
})(window);
