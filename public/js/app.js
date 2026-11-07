/* =========================================================
   Vanguard Quantitative Solutions — SPA
   Router por hash + vistas renderizadas desde JSON
   ========================================================= */
(function () {
  "use strict";

  const API = window.VQS_API;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const main = $("#main");
  let C = null; // contenido

  /* ---------- Utilidades ---------- */
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const svcById = (id) => C.services.find((s) => s.id === id);
  const catTitle = (id) => (C.categories.find((c) => c.id === id) || {}).title || id;

  /* ---------- Iconos (SVG inline, trazo 1.6) ---------- */
  const I = {
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14c2.5 0 4.5 2 4.5 4.5"/>',
    scale: '<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 006 0zM18 7l-3 7a3 3 0 006 0z"/>',
    rocket: '<path d="M14 4c3-1 6 0 6 0s1 3 0 6l-7 7-6-6zM7 11l-3 1 2 2M13 17l-1 3-2-2M15 9h.01"/>',
    megaphone: '<path d="M3 10v4h4l8 5V5L7 10zM18 9a4 4 0 010 6"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0114 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || I.chart}</svg>`;
  const arrow = icon("arrow");

  /* ---------- Bloques reutilizables ---------- */
  const serviceCard = (s, i) => `
    <a class="card card--white reveal" href="#/servicios/${esc(s.id)}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="card__icon">${icon(s.icon)}</div>
        <span class="card__num">${pad(i + 1)}</span>
      </div>
      <span class="tag">${esc(catTitle(s.category))}</span>
      <h3 class="h-3">${esc(s.title)}</h3>
      <p class="muted">${esc(s.summary)}</p>
      <div class="card__foot"><span class="link-arrow">Ver servicio ${arrow}</span></div>
    </a>`;

  const stepsBlock = () => `
    <div class="steps">
      ${C.approach.map((s) => `
        <div class="step reveal">
          <span class="step__n">${esc(s.step)}</span>
          <h3 class="h-3">${esc(s.title)}</h3>
          <p class="muted">${esc(s.text)}</p>
        </div>`).join("")}
    </div>`;

  const benefitsBlock = () => `
    <div class="grid grid--3">
      ${C.benefits.map((b) => `
        <div class="card reveal">
          <div class="card__icon">${icon("check")}</div>
          <h3 class="h-3">${esc(b.title)}</h3>
          <p class="muted">${esc(b.text)}</p>
        </div>`).join("")}
    </div>`;

  const ctaBlock = (title = "Convirtamos tus desafíos en ventajas competitivas.") => `
    <section class="section--tight">
      <div class="container">
        <div class="cta reveal">
          <span class="eyebrow" style="color:var(--accent-2)">Hablemos</span>
          <h2 class="h-1" style="max-width:760px">${esc(title)}</h2>
          <p class="lead">Cuéntanos qué está frenando el crecimiento de tu empresa y te proponemos un diagnóstico inicial.</p>
          <div class="hero__actions">
            <a class="btn btn--primary" href="#/contacto">Agenda una reunión ${arrow}</a>
            ${C.contact.emails.map((e) => `<a class="btn btn--ghost" href="mailto:${esc(e)}">${esc(e)}</a>`).join("")}
          </div>
        </div>
      </div>
    </section>`;

  // Visual "tech": gráfico de datos animado
  const dataVisual = () => {
    const pts = [[40, 300], [110, 270], [180, 285], [250, 220], [320, 235], [390, 170], [460, 150], [530, 95]];
    const line = pts.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ");
    const area = line + " L530 380 L40 380 Z";
    const grid = Array.from({ length: 7 }, (_, i) => `<line x1="40" x2="560" y1="${80 + i * 50}" y2="${80 + i * 50}" stroke="rgba(255,255,255,.08)"/>`).join("");
    const bars = pts.map((p, i) => `<rect x="${p[0] - 10}" y="${380 - (40 + i * 14)}" width="20" height="${40 + i * 14}" rx="4" fill="rgba(255,255,255,.07)"/>`).join("");
    const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 7 : 4}" fill="${i === pts.length - 1 ? "#00C2FF" : "#fff"}"/>`).join("");
    return `
      <div class="visual reveal" role="img" aria-label="Gráfico ilustrativo de crecimiento basado en datos">
        <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="va" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00C2FF" stop-opacity=".35"/><stop offset="1" stop-color="#00C2FF" stop-opacity="0"/></linearGradient>
          </defs>
          ${grid}${bars}
          <path d="${area}" fill="url(#va)"/>
          <path d="${line}" fill="none" stroke="#00C2FF" stroke-width="3" stroke-linejoin="round" stroke-dasharray="900" stroke-dashoffset="900">
            <animate attributeName="stroke-dashoffset" from="900" to="0" dur="2.2s" fill="freeze" begin="0.3s"/>
          </path>
          ${dots}
          <g font-family="JetBrains Mono, monospace" font-size="13" fill="rgba(255,255,255,.75)">
            <rect x="380" y="40" width="170" height="34" rx="17" fill="rgba(255,255,255,.1)"/>
            <text x="398" y="62">margen ▲ optimizado</text>
          </g>
        </svg>
        <div class="visual__label">f(x) = estrategia · datos · ejecución</div>
      </div>`;
  };

  /* ---------- Vistas ---------- */
  const views = {
    home() {
      return `
      <section class="hero">
        <div class="hero__grid"></div><div class="hero__glow"></div>
        <div class="container">
          <div class="hero__content">
            <span class="eyebrow">${esc(C.company.tagline)}</span>
            <h1 class="h-display">Transformamos desafíos en <span class="grad">ventajas competitivas.</span></h1>
            <p class="lead">${esc(C.company.pitch)}</p>
            <div class="hero__actions">
              <a class="btn btn--primary" href="#/contacto">Agenda una reunión ${arrow}</a>
              <a class="btn btn--ghost" href="#/servicios">Explora los servicios</a>
            </div>
          </div>
          <div class="hero__ticker">
            ${C.pillars.map((p) => `
              <div class="ticker__item">
                <div class="ticker__num">${esc(p.metric)} /</div>
                <div class="ticker__label">${esc(p.title)}</div>
              </div>`).join("")}
          </div>
        </div>
      </section>

      <section class="section section--surface">
        <div class="container">
          <div class="head">
            <span class="eyebrow">Consultoría integral 360°</span>
            <h2 class="h-1">Todas las áreas de tu empresa, un solo equipo.</h2>
            <p class="lead">Los problemas empresariales rara vez afectan un solo departamento. Por eso atendemos la organización completa, con especialistas que trabajan coordinados.</p>
          </div>
          <div class="grid grid--4">${C.services.map(serviceCard).join("")}</div>
        </div>
      </section>

      <section class="section">
        <div class="container split">
          <div class="stack">
            <span class="eyebrow">Enfoque cuantitativo</span>
            <h2 class="h-1">Estrategia respaldada por datos.</h2>
            <p class="lead">Unimos inteligencia de negocios, analítica, calidad de datos y transformación organizacional para alinear la tecnología con los objetivos de tu empresa.</p>
            <div class="grid grid--2" style="margin-top:32px">
              ${C.pillars.map((p) => `
                <div class="reveal">
                  <div class="card__num">${esc(p.metric)}</div>
                  <h3 class="h-3" style="margin:10px 0 6px">${esc(p.title)}</h3>
                  <p class="muted" style="font-size:16px">${esc(p.text)}</p>
                </div>`).join("")}
            </div>
          </div>
          ${dataVisual()}
        </div>
      </section>

      <section class="section section--surface">
        <div class="container">
          <div class="head">
            <span class="eyebrow">Cómo trabajamos</span>
            <h2 class="h-1">Del diagnóstico a resultados medibles.</h2>
          </div>
          ${stepsBlock()}
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="head">
            <span class="eyebrow">Beneficios</span>
            <h2 class="h-1">Lo que gana tu empresa.</h2>
          </div>
          ${benefitsBlock()}
        </div>
      </section>
      ${ctaBlock()}`;
    },

    nosotros() {
      const a = C.about;
      return `
      <section class="page-head">
        <div class="hero__grid"></div>
        <div class="container stack">
          <div class="crumbs"><a href="#/">Inicio</a><span>/</span><span>Nosotros</span></div>
          <h1 class="h-display">Somos <span class="grad">Vanguard.</span></h1>
          <p class="lead">${esc(a.intro)}</p>
        </div>
      </section>

      <section class="section--tight">
        <div class="container split" style="align-items:start">
          <div class="stack">${a.body.map((p) => `<p class="lead" style="max-width:none">${esc(p)}</p>`).join("")}</div>
          <div class="grid">
            <div class="card reveal"><span class="eyebrow">Misión</span><p class="h-3" style="font-weight:500;line-height:1.4">${esc(a.mission)}</p></div>
            <div class="card reveal"><span class="eyebrow">Visión</span><p class="h-3" style="font-weight:500;line-height:1.4">${esc(a.vision)}</p></div>
          </div>
        </div>
      </section>

      <section class="section section--surface">
        <div class="container">
          <div class="head"><span class="eyebrow">Nuestros valores</span><h2 class="h-1">Lo que guía cada proyecto.</h2></div>
          <div class="grid grid--3">
            ${a.values.map((v, i) => `
              <div class="card card--white reveal">
                <span class="card__num">${pad(i + 1)}</span>
                <h3 class="h-3">${esc(v.title)}</h3>
                <p class="muted">${esc(v.text)}</p>
              </div>`).join("")}
          </div>
        </div>
      </section>

      ${(a.team || []).length ? `
      <section class="section">
        <div class="container">
          <div class="head"><span class="eyebrow">Liderazgo</span><h2 class="h-1">Nuestro equipo.</h2></div>
          <div class="grid">
            ${a.team.map((p) => `
              <div class="card reveal person">
                <div class="avatar" aria-hidden="true">${esc(p.initials)}</div>
                <div class="stack">
                  <div><h3 class="h-2">${esc(p.name)}</h3><p class="muted">${esc(p.role)}</p></div>
                  <p class="muted">${esc(p.bio)}</p>
                </div>
              </div>`).join("")}
          </div>
        </div>
      </section>` : ""}

      <section class="section section--surface">
        <div class="container">
          <div class="head"><span class="eyebrow">Industrias</span><h2 class="h-1">Experiencia en múltiples sectores.</h2>
          <p class="lead">Nuestro enfoque integral nos permite acompañar a empresas de diferentes industrias.</p></div>
          <div class="pills">${a.industries.map((x) => `<span class="pill">${esc(x)}</span>`).join("")}</div>
        </div>
      </section>
      ${ctaBlock()}`;
    },

    servicios() {
      return `
      <section class="page-head">
        <div class="hero__grid"></div>
        <div class="container stack">
          <div class="crumbs"><a href="#/">Inicio</a><span>/</span><span>Servicios</span></div>
          <h1 class="h-display">Servicios de <span class="grad">consultoría.</span></h1>
          <p class="lead">Áreas de práctica que cubren la empresa completa: administración, jurídica, comercial, tecnología y educación.</p>
        </div>
      </section>
      ${C.categories.map((cat) => {
        const list = C.services.filter((s) => s.category === cat.id);
        if (!list.length) return "";
        return `
        <section class="section--tight">
          <div class="container">
            <h2 class="h-2" style="margin-bottom:24px;display:flex;gap:14px;align-items:baseline"><span class="tag">${esc(cat.id.slice(0, 3))}</span>${esc(cat.title)}</h2>
            <div class="grid grid--3">${list.map((s) => serviceCard(s, C.services.indexOf(s))).join("")}</div>
          </div>
        </section>`;
      }).join("")}
      <div style="height:48px"></div>
      ${ctaBlock()}`;
    },

    servicio(id) {
      const s = svcById(id);
      if (!s) return views.notfound();
      const others = C.services.filter((x) => x.id !== s.id && x.category === s.category);
      const rest = others.length ? others : C.services.filter((x) => x.id !== s.id).slice(0, 3);
      return `
      <section class="page-head">
        <div class="hero__grid"></div>
        <div class="container stack">
          <div class="crumbs"><a href="#/">Inicio</a><span>/</span><a href="#/servicios">Servicios</a><span>/</span><span>${esc(s.title)}</span></div>
          <div class="card__icon" style="width:56px;height:56px">${icon(s.icon)}</div>
          <span class="tag">${esc(catTitle(s.category))}</span>
          <h1 class="h-display">${esc(s.title)}</h1>
          <p class="lead">${esc(s.description)}</p>
        </div>
      </section>
      <section class="section--tight" style="padding-bottom:96px">
        <div class="container detail">
          <div>
            <h2 class="h-2" style="margin-bottom:24px">Qué incluye</h2>
            <div class="svc-list">
              ${s.items.map((it, i) => `
                <div class="svc-row reveal">
                  <span class="card__num">${pad(i + 1)}</span>
                  <h3 class="h-3">${esc(it.title)}</h3>
                  <p class="muted">${esc(it.text)}</p>
                </div>`).join("")}
            </div>
          </div>
          <aside class="aside grid">
            <div class="card">
              <h3 class="h-3">¿Te interesa este servicio?</h3>
              <p class="muted">Agenda una conversación sin costo para evaluar tu caso.</p>
              <a class="btn btn--primary" href="#/contacto?servicio=${esc(s.id)}">Contáctanos ${arrow}</a>
            </div>
            <div class="card card--white">
              <span class="tag">Otros servicios</span>
              ${rest.map((o) => `<a class="link-arrow" href="#/servicios/${esc(o.id)}">${esc(o.title)} ${arrow}</a>`).join("")}
            </div>
          </aside>
        </div>
      </section>`;
    },

    enfoque() {
      return `
      <section class="page-head">
        <div class="hero__grid"></div>
        <div class="container stack">
          <div class="crumbs"><a href="#/">Inicio</a><span>/</span><span>Enfoque</span></div>
          <h1 class="h-display">Cuatro pilares, <span class="grad">un solo modelo.</span></h1>
          <p class="lead">Integramos tecnología, logística avanzada, estrategia financiera y optimización económica en un método cuantitativo y medible.</p>
        </div>
      </section>
      <section class="section--tight">
        <div class="container grid grid--2">
          ${C.pillars.map((p) => `
            <div class="card reveal" style="min-height:240px">
              <span class="card__num">${esc(p.metric)} / 04</span>
              <h2 class="h-2" style="margin-top:auto">${esc(p.title)}</h2>
              <p class="muted">${esc(p.text)}</p>
            </div>`).join("")}
        </div>
      </section>
      <section class="section">
        <div class="container split">
          ${dataVisual()}
          <div class="stack">
            <span class="eyebrow">Metodología</span>
            <h2 class="h-1">Medimos antes de recomendar.</h2>
            <p class="lead">Cada proyecto parte de un diagnóstico integral: cómo la tecnología y los procesos apoyan hoy tus objetivos y cuál es el nivel de madurez de tu organización. Con esa línea base diseñamos soluciones a la medida y medimos su impacto.</p>
          </div>
        </div>
      </section>
      <section class="section section--surface"><div class="container">${stepsBlock()}</div></section>
      <section class="section"><div class="container">
        <div class="head"><span class="eyebrow">Beneficios</span><h2 class="h-1">Resultados que se notan.</h2></div>
        ${benefitsBlock()}
      </div></section>
      ${ctaBlock()}`;
    },

    contacto(params) {
      const k = C.contact;
      const pre = params.get("servicio") || "";
      return `
      <section class="page-head">
        <div class="hero__grid"></div>
        <div class="container stack">
          <div class="crumbs"><a href="#/">Inicio</a><span>/</span><span>Contacto</span></div>
          <h1 class="h-display">Hablemos de <span class="grad">tu empresa.</span></h1>
          <p class="lead">Compártenos tu necesidad y te contactaremos a la brevedad.</p>
        </div>
      </section>
      <section class="section--tight" style="padding-bottom:112px">
        <div class="container split" style="align-items:start">
          <div class="contact-list">
            ${(k.people || []).length ? `<div class="contact-item"><div class="card__icon">${icon("people")}</div><div><small>Contacto</small>${k.people.map(esc).join("<br>")}</div></div>` : ""}
            <div class="contact-item"><div class="card__icon">${icon("mail")}</div><div><small>Correo</small>${k.emails.map((e) => `<a href="mailto:${esc(e)}">${esc(e)}</a>`).join("<br>")}</div></div>
            <div class="contact-item"><div class="card__icon">${icon("pin")}</div><div><small>Ubicación</small>${esc(k.city)}</div></div>
            <div class="contact-item"><div class="card__icon">${icon("clock")}</div><div><small>Horario</small>${esc(k.hours)}</div></div>
          </div>

          <form class="card card--white form" id="contactForm" novalidate>
            <h2 class="h-2">Agenda una cita</h2>
            <div class="form__row">
              <div class="field"><label for="f-name">Nombre</label><input class="input" id="f-name" name="name" autocomplete="name" required maxlength="120"></div>
              <div class="field"><label for="f-company">Empresa <span>(opcional)</span></label><input class="input" id="f-company" name="company" autocomplete="organization" maxlength="120"></div>
            </div>
            <div class="form__row">
              <div class="field"><label for="f-email">Correo</label><input class="input" id="f-email" name="email" type="email" autocomplete="email" required maxlength="160"></div>
              <div class="field"><label for="f-phone">Teléfono <span>(opcional)</span></label><input class="input" id="f-phone" name="phone" type="tel" autocomplete="tel" maxlength="40"></div>
            </div>
            <div class="field"><label for="f-service">Servicio de interés</label>
              <select class="input" id="f-service" name="service">
                <option value="">General / no estoy seguro</option>
                ${C.services.map((s) => `<option value="${esc(s.id)}"${s.id === pre ? " selected" : ""}>${esc(s.title)}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label for="f-msg">Mensaje</label><textarea class="input" id="f-msg" name="message" required maxlength="3000" placeholder="¿Qué desafío quieres resolver?"></textarea></div>
            <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
            <label class="check"><input type="checkbox" name="consent" required> Acepto que mis datos se usen únicamente para responder a esta solicitud.</label>
            <div id="formNotice" aria-live="polite"></div>
            <button class="btn btn--primary" type="submit" style="justify-self:start">Enviar solicitud ${arrow}</button>
          </form>
        </div>
      </section>`;
    },

    notfound() {
      return `
      <section class="page-head" style="min-height:60vh">
        <div class="hero__grid"></div>
        <div class="container stack">
          <span class="eyebrow">Error 404</span>
          <h1 class="h-display">Página no encontrada.</h1>
          <a class="btn btn--primary" href="#/" style="justify-self:start;width:max-content">Volver al inicio</a>
        </div>
      </section>`;
    },
  };

  /* ---------- Formulario ---------- */
  function bindContactForm() {
    const form = $("#contactForm");
    if (!form) return;
    const notice = $("#formNotice");
    const show = (type, html) => (notice.innerHTML = `<div class="notice notice--${type}">${html}</div>`);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.consent = fd.get("consent") === "on";

      // Validación en el cliente
      let bad = false;
      ["name", "email", "message"].forEach((n) => {
        const el = form.elements[n];
        const invalid = !el.value.trim() || (n === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value));
        el.setAttribute("aria-invalid", invalid ? "true" : "false");
        bad = bad || invalid;
      });
      if (bad) return show("err", "Revisa los campos marcados.");
      if (!data.consent) return show("err", "Debes aceptar el uso de tus datos para continuar.");

      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        const res = await API.sendContact(data);
        form.reset();
        show("ok", `¡Gracias! Recibimos tu solicitud (ref. <code>${esc(res.id)}</code>). Te contactaremos pronto.`);
      } catch (err) {
        if (err.code === "NO_API") {
          // Hosting estático: abrir correo prellenado
          const subject = encodeURIComponent("Solicitud de consultoría – " + (data.company || data.name));
          const body = encodeURIComponent(`Nombre: ${data.name}\nEmpresa: ${data.company}\nCorreo: ${data.email}\nTeléfono: ${data.phone}\nServicio: ${data.service}\n\n${data.message}`);
          window.location.href = `mailto:${C.contact.emails.join(",")}?subject=${subject}&body=${body}`;
          show("ok", "Abrimos tu cliente de correo con el mensaje listo para enviar.");
        } else {
          show("err", esc(err.message || "No pudimos enviar la solicitud. Intenta de nuevo o escríbenos por correo."));
        }
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------- Layout: mega menú y footer ---------- */
  function renderChrome() {
    $("#mega").innerHTML = C.categories.map((cat) => `
      <div class="mega__col">
        <h4>${esc(cat.title)}</h4>
        ${C.services.filter((s) => s.category === cat.id).map((s) => `<a href="#/servicios/${esc(s.id)}" role="menuitem">${esc(s.title)}<small>${esc(s.summary)}</small></a>`).join("")}
      </div>`).join("");

    const k = C.contact;
    $("#footer").innerHTML = `
      <div class="container">
        <div class="footer__grid">
          <div class="stack">
            <a href="#/" class="brand"><img src="assets/logo.svg" alt="" width="32" height="32"><span class="brand__name">Vanguard <b>Quantitative</b> Solutions</span></a>
            <p class="muted" style="max-width:340px">${esc(C.company.tagline)}. ${esc(C.company.location)}.</p>
          </div>
          <div><h4>Empresa</h4><ul>
            <li><a href="#/nosotros">Nosotros</a></li><li><a href="#/enfoque">Enfoque</a></li>
            <li><a href="#/servicios">Servicios</a></li><li><a href="#/contacto">Contacto</a></li></ul></div>
          <div><h4>Servicios</h4><ul>${C.services.slice(0, 6).map((s) => `<li><a href="#/servicios/${esc(s.id)}">${esc(s.title)}</a></li>`).join("")}</ul></div>
          <div><h4>Contacto</h4><ul>
            ${(k.people || []).map((n) => `<li>${esc(n)}</li>`).join("")}
            ${k.emails.map((e) => `<li><a href="mailto:${esc(e)}">${esc(e)}</a></li>`).join("")}
            <li>${esc(k.city)}</li></ul></div>
        </div>
        <div class="footer__bottom">
          <span>© ${new Date().getFullYear()} ${esc(C.company.name)}. Todos los derechos reservados.</span>
          <span class="api-status ${API.online ? "is-on" : ""}"><i></i>${API.online ? "API conectada" : "Modo estático"}</span>
        </div>
      </div>`;
  }

  /* ---------- Navegación / interacción ---------- */
  function bindNav() {
    const drop = $(".nav__drop");
    const dropBtn = $(".nav__dropbtn");
    const links = $("#navLinks");
    const burger = $("#burger");

    dropBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = drop.classList.toggle("is-open");
      dropBtn.setAttribute("aria-expanded", open);
    });
    document.addEventListener("click", (e) => { if (!drop.contains(e.target)) { drop.classList.remove("is-open"); dropBtn.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { drop.classList.remove("is-open"); closeMobile(); } });

    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open);
    });
    function closeMobile() { links.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); }
    window.addEventListener("hashchange", () => { closeMobile(); drop.classList.remove("is-open"); });

    const nav = $("#nav");
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  let io;
  function observeReveal() {
    if (io) io.disconnect();
    if (!("IntersectionObserver" in window)) { $$(".reveal").forEach((el) => el.classList.add("is-in")); return; }
    io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach((el) => io.observe(el));
  }

  /* ---------- Router ---------- */
  const titles = { home: "", nosotros: "Nosotros", servicios: "Servicios", enfoque: "Enfoque", contacto: "Contacto" };

  function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, qs] = raw.split("?");
    const params = new URLSearchParams(qs || "");
    const parts = path.split("/").filter(Boolean);
    let html, title, key = parts[0] || "home";

    if (key === "servicios" && parts[1]) {
      html = views.servicio(parts[1]);
      title = (svcById(parts[1]) || {}).title || "Servicio";
    } else if (views[key] && key !== "servicio" && key !== "notfound") {
      html = views[key](params);
      title = titles[key];
    } else {
      html = views.notfound(); title = "No encontrado";
    }

    main.innerHTML = `<div class="view-enter">${html}</div>`;
    document.title = (title ? title + " · " : "") + C.company.name;
    $$("#navLinks > a").forEach((a) => a.classList.toggle("is-active", a.dataset.route === key));
    window.scrollTo(0, 0);
    bindContactForm();
    observeReveal();
  }

  /* ---------- Arranque ---------- */
  (async function init() {
    try {
      C = await API.getContent();
    } catch (e) {
      main.innerHTML = `<div class="loading">No se pudo cargar el contenido. Ejecuta <code>node server.js</code> y abre http://localhost:3000</div>`;
      return;
    }
    renderChrome();
    bindNav();
    window.addEventListener("hashchange", route);
    route();
  })();
})();
