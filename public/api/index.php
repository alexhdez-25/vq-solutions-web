<?php
/* =========================================================
   Vanguard Quantitative Solutions — API JSON (versión PHP)
   Para hosting compartido con cPanel (GoDaddy, etc.).
   Mismos endpoints que server.js:
     GET  /api                     estado
     GET  /api/content             contenido completo
     GET  /api/services[?category] servicios
     GET  /api/services/{id}       un servicio
     POST /api/contact             guarda la solicitud y envía correo
     GET  /api/contact?token=...   lista solicitudes (admin)
     GET  /api/documents           catálogo de documentos
     GET  /api/documents/{file}    descarga un documento
   ========================================================= */

/* ---------- CONFIGURACIÓN (edita aquí) ---------- */
const MAIL_TO     = 'info@vq-solutions.com, info@awaiallc.com';
const MAIL_FROM   = 'no-reply@vq-solutions.com';
const ADMIN_TOKEN = 'CAMBIA-ESTA-CLAVE';   // para ver mensajes: /api/contact?token=...
/* ------------------------------------------------ */

$PUBLIC_DIR   = dirname(__DIR__);                        // public_html
$CONTENT_FILE = $PUBLIC_DIR . '/data/content.json';
$DOCS_DIR     = __DIR__ . '/_docs';
// Los mensajes se guardan FUERA de public_html si es posible (no accesibles por web)
$STORAGE_DIR  = dirname($PUBLIC_DIR) . '/vqs-data';
if (!is_dir($STORAGE_DIR) && !@mkdir($STORAGE_DIR, 0750, true)) {
    $STORAGE_DIR = __DIR__ . '/_storage';                // respaldo, protegido por .htaccess
}
$MESSAGES_FILE = $STORAGE_DIR . '/messages.json';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

function json_out($status, $data) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}
function read_json($file, $fallback) {
    if (!is_file($file)) return $fallback;
    $d = json_decode(file_get_contents($file), true);
    return $d === null ? $fallback : $d;
}
function clean($v, $max) {
    $v = preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)($v ?? ''));
    return mb_substr(trim($v), 0, $max);
}

$method = $_SERVER['REQUEST_METHOD'];
$route  = trim($_GET['route'] ?? '', '/');
$parts  = $route === '' ? [] : explode('/', $route);
$resource = $parts[0] ?? '';
$id       = $parts[1] ?? null;

if ($method === 'OPTIONS') { http_response_code(204); exit; }

if ($resource === '' || $resource === 'health') {
    json_out(200, ['ok' => true, 'name' => 'VQS API', 'version' => '1.0.0', 'runtime' => 'php', 'time' => gmdate('c')]);
}

$content = read_json($CONTENT_FILE, null);
if (!$content) json_out(500, ['error' => 'No se pudo leer content.json']);

/* GET /api/content */
if ($resource === 'content' && $method === 'GET') json_out(200, $content);

/* GET /api/services[/id] */
if ($resource === 'services' && $method === 'GET') {
    if ($id) {
        foreach ($content['services'] as $s) if ($s['id'] === $id) json_out(200, $s);
        json_out(404, ['error' => 'Servicio no encontrado']);
    }
    $cat = $_GET['category'] ?? '';
    $list = $cat ? array_values(array_filter($content['services'], fn($s) => $s['category'] === $cat)) : $content['services'];
    json_out(200, $list);
}

/* /api/contact */
if ($resource === 'contact') {
    if ($method === 'GET') {
        if (ADMIN_TOKEN === 'CAMBIA-ESTA-CLAVE' || !hash_equals(ADMIN_TOKEN, (string)($_GET['token'] ?? ''))) {
            json_out(401, ['error' => 'No autorizado']);
        }
        json_out(200, read_json($MESSAGES_FILE, []));
    }
    if ($method === 'POST') {
        $raw = file_get_contents('php://input', false, null, 0, 65536);
        $body = json_decode($raw, true);
        if (!is_array($body)) json_out(400, ['error' => 'JSON inválido']);
        if (!empty($body['website'])) json_out(200, ['ok' => true, 'id' => 'ok']); // honeypot

        // Límite simple: 5 envíos por IP cada 10 minutos
        if (!is_dir($STORAGE_DIR)) @mkdir($STORAGE_DIR, 0750, true);
        $rlFile = $STORAGE_DIR . '/ratelimit.json';
        $ip  = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $now = time();
        $rl  = read_json($rlFile, []);
        $rl[$ip] = array_values(array_filter($rl[$ip] ?? [], fn($t) => $now - $t < 600));
        $rl[$ip][] = $now;
        @file_put_contents($rlFile, json_encode($rl), LOCK_EX);
        if (count($rl[$ip]) > 5) json_out(429, ['error' => 'Demasiadas solicitudes. Intenta más tarde.']);

        $msg = [
            'id'        => 'VQS-' . strtoupper(base_convert((string)round(microtime(true) * 1000), 10, 36)) . '-' . strtoupper(bin2hex(random_bytes(2))),
            'createdAt' => gmdate('c'),
            'name'      => clean($body['name'] ?? '', 120),
            'company'   => clean($body['company'] ?? '', 120),
            'email'     => clean($body['email'] ?? '', 160),
            'phone'     => clean($body['phone'] ?? '', 40),
            'service'   => clean($body['service'] ?? '', 80),
            'message'   => mb_substr(trim((string)($body['message'] ?? '')), 0, 3000),
            'consent'   => ($body['consent'] ?? false) === true,
        ];
        $details = [];
        if ($msg['name'] === '') $details['name'] = 'Requerido';
        if (!filter_var($msg['email'], FILTER_VALIDATE_EMAIL)) $details['email'] = 'Correo inválido';
        if ($msg['message'] === '') $details['message'] = 'Requerido';
        if (!$msg['consent']) $details['consent'] = 'Debe aceptar';
        $serviceTitle = 'General';
        if ($msg['service'] !== '') {
            $found = false;
            foreach ($content['services'] as $s) if ($s['id'] === $msg['service']) { $found = true; $serviceTitle = $s['title']; }
            if (!$found) $details['service'] = 'Servicio desconocido';
        }
        if ($details) json_out(422, ['error' => 'Datos inválidos', 'details' => $details]);

        // Guardar
        $list = read_json($MESSAGES_FILE, []);
        $list[] = $msg;
        @file_put_contents($MESSAGES_FILE, json_encode($list, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

        // Notificar por correo
        $subject = '=?UTF-8?B?' . base64_encode("Nueva solicitud web ({$msg['id']}) – {$serviceTitle}") . '?=';
        $text = "Nueva solicitud desde vq-solutions.com\n\n"
              . "Referencia: {$msg['id']}\nFecha: {$msg['createdAt']}\n\n"
              . "Nombre:   {$msg['name']}\nEmpresa:  {$msg['company']}\nCorreo:   {$msg['email']}\n"
              . "Teléfono: {$msg['phone']}\nServicio: {$serviceTitle}\n\nMensaje:\n{$msg['message']}\n";
        $headers = "From: Vanguard Quantitative Solutions <" . MAIL_FROM . ">\r\n"
                 . "Reply-To: {$msg['email']}\r\n"
                 . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n";
        $mailed = @mail(MAIL_TO, $subject, $text, $headers, '-f' . MAIL_FROM);

        json_out(201, ['ok' => true, 'id' => $msg['id'], 'mailed' => (bool)$mailed]);
    }
}

/* /api/documents[/file] */
if ($resource === 'documents' && $method === 'GET') {
    $index = read_json($DOCS_DIR . '/index.json', []);
    if (!$id) json_out(200, $index);
    foreach ($index as $d) {
        if ($d['file'] === $id) {
            $path = $DOCS_DIR . '/' . basename($d['file']);
            if (!is_file($path)) json_out(404, ['error' => 'Archivo no disponible']);
            $types = ['pdf' => 'application/pdf', 'txt' => 'text/plain; charset=utf-8', 'json' => 'application/json',
                      'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
            header('Content-Disposition: attachment; filename="' . basename($path) . '"');
            header('Content-Length: ' . filesize($path));
            readfile($path);
            exit;
        }
    }
    json_out(404, ['error' => 'Documento no encontrado']);
}

json_out(404, ['error' => 'Endpoint no encontrado']);
