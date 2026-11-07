# Vanguard Quantitative Solutions — Sitio web

Sitio en **HTML + CSS + JavaScript** con el contenido en **JSON** y una **API REST** local en Node.js (sin dependencias).

## Verlo en tu máquina

Requisito: [Node.js 18 o superior](https://nodejs.org).

```bash
cd vqs-website
node server.js
```

Abre **http://localhost:3000**. Para detenerlo: `Ctrl + C`.

> Abrir `public/index.html` con doble clic no funciona bien porque el navegador bloquea `fetch()` en `file://`. Usa el servidor.

## Estructura

```
vqs-website/
├── server.js                 Servidor local + API JSON (Node.js) — solo para tu máquina
├── package.json
└── public/                   ← ESTO es lo que se sube al hosting (public_html)
    ├── index.html
    ├── .htaccess             HTTPS, rutas /api, caché (Apache / cPanel)
    ├── robots.txt
    ├── css/styles.css
    ├── js/api.js             Cliente de la API
    ├── js/app.js             Router y vistas
    ├── assets/logo.svg
    ├── data/content.json     ★ TODO el contenido del sitio
    └── api/
        ├── index.php         API JSON en PHP (misma API que server.js)
        ├── _docs/            Documentos para intercambio (index.json + archivos)
        └── _storage/         Respaldo privado para mensajes (bloqueado por .htaccess)
```

## Editar contenido

Todo el texto (servicios, misión, valores, contacto, equipo…) está en `public/data/content.json`. Edítalo y recarga el navegador; no hay que tocar el HTML.

Para agregar un servicio, añade un objeto a `services` con `id`, `category`, `title`, `icon`, `summary`, `description` e `items`. Iconos disponibles: `chart, compass, people, scale, rocket, megaphone, chip, book`.

## API

La misma API existe en dos versiones: `server.js` (Node, para tu máquina) y `public/api/index.php` (PHP, para el hosting).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api` | Estado |
| GET | `/api/content` | Contenido completo |
| GET | `/api/services?category=tecnologia` | Servicios (filtro opcional) |
| GET | `/api/services/:id` | Un servicio |
| POST | `/api/contact` | Guarda la solicitud y (en PHP) envía un correo a info@vq-solutions.com e info@awaiallc.com |
| GET | `/api/contact?token=…` | Lista solicitudes (requiere la clave de administrador) |
| GET | `/api/documents` | Catálogo de documentos |
| GET | `/api/documents/:file` | Descarga un documento |

## Publicar con GitHub Pages (recomendado)

El repositorio incluye `.github/workflows/pages.yml`: cada cambio subido a la rama `main` publica automáticamente la carpeta `public/` (sin la API PHP).

1. Crea un repositorio **público** en GitHub y sube **el contenido** de esta carpeta (que `package.json`, `public/` y `.github/` queden en la raíz).
2. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
3. *Actions*: espera a que “Publicar sitio en GitHub Pages” termine en verde.
4. *Settings → Pages → Custom domain:* `vq-solutions.com` → *Save*. Cuando el certificado esté listo, marca **Enforce HTTPS**.
5. DNS en GoDaddy (*Dominios → vq-solutions.com → DNS*):
   - Borra los registros **A** de `@` existentes y crea cuatro registros **A** `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - **CNAME** `www` → `TU-USUARIO.github.io`
   - No toques los registros **MX** ni **TXT** del correo.

En GitHub Pages no hay servidor: el sitio funciona en “Modo estático” y el formulario abre el correo del visitante dirigido a ambos correos de contacto.
No guardes claves en el repositorio: al ser público, cualquiera puede leerlo.

## Publicar en GoDaddy (hosting con cPanel)

1. **Configura la API**: abre `public/api/index.php` y cambia `ADMIN_TOKEN` por una clave tuya.
2. **Comprime** el *contenido* de `public/` (no la carpeta en sí) en un .zip. Incluye `.htaccess`.
3. En GoDaddy → **Mis productos → Web Hosting → Administrar → cPanel Admin**.
4. **Administrador de archivos** → entra en `public_html` → borra la página por defecto si existe → **Cargar** el .zip → clic derecho → **Extraer**. Deben quedar `index.html`, `.htaccess`, `css/`, `js/`… directamente dentro de `public_html`.
   (Activa *Configuración → Mostrar archivos ocultos* para ver `.htaccess`.)
5. **SSL**: cPanel → *SSL/TLS Status* → *Run AutoSSL* (o activa el certificado gratuito desde el panel de GoDaddy).
6. **Correo del formulario** (si el correo está en Microsoft 365 / Correo profesional de GoDaddy): cPanel → *Email Routing* → `vq-solutions.com` → **Remote Mail Exchanger**. Sin esto, los correos del formulario se quedan en el servidor y no llegan a tu buzón.
7. Abre **https://vq-solutions.com** y comprueba que en el pie diga **“API conectada”**. Envía una prueba desde Contacto.

Ver mensajes guardados: `https://vq-solutions.com/api/contact?token=TU-CLAVE`.
Los mensajes se guardan en `vqs-data/messages.json`, fuera de `public_html`.

### Si el dominio y el hosting no están conectados
Si el dominio no muestra tu sitio, en GoDaddy → *Dominios → vq-solutions.com → DNS*:
- el registro **A** `@` debe apuntar a la IP del hosting (aparece en cPanel, columna derecha “Dirección IP compartida”);
- **CNAME** `www` → `@`.
No toques los registros **MX** ni los relacionados con el correo. Los cambios de DNS tardan de minutos a pocas horas.

### Actualizar el sitio después
Solo vuelve a subir los archivos que cambiaron (normalmente `data/content.json`) en el Administrador de archivos y recarga.

## Publicar en GoDaddy Node.js Hosting

Sube **vq-solutions-nodejs.zip** (tiene `package.json` en la raíz). La plataforma ejecuta `npm install` → `npm run build` → `npm start`, y `server.js` escucha en `process.env.PORT`.

- Clave de administrador: en la app → *Gestionar secretos* → `ADMIN_TOKEN=tu-clave`. Mensajes: `/api/contact?token=tu-clave`.
- Los mensajes del formulario se guardan en `storage/messages.json`, que **se borra al volver a implementar**. Descárgalos antes de subir una versión nueva.
- No subas `vq-solutions-public_html.zip` aquí: no tiene `package.json` y la plataforma muestra su plantilla por defecto.

### Otras opciones
- **Node.js Hosting de GoDaddy / Render / VPS**: sube toda la carpeta `vqs-website` y ejecuta `npm start` (usa `server.js`).
- **Hosting solo estático** (sin PHP ni Node): sube `public/`; el sitio pasa a “Modo estático” y el formulario abre el correo del visitante hacia info@vq-solutions.com e info@awaiallc.com.
