<?php
/**
 * Contact form handler for sinergiindonesia.com — Rumahweb / cPanel.
 *
 * Rumahweb disables PHP's mail() function, so this speaks SMTP directly.
 * No Composer, no PHPMailer upload — one file, no dependencies.
 *
 * Credentials live in smtp-config.php (see smtp-config.sample.php), looked
 * for one level above the web root first so it is never web-readable.
 *
 * The site is served from Vercel at www.sinergiindonesia.com, so the browser
 * calls this cross-origin; only our own origins are allowed.
 */

declare(strict_types=1);

// ---------------------------------------------------------------- config --
$cfg = null;
foreach ([
    // Preferred: above the web root, so Apache can never serve it
    __DIR__ . '/../smtp-config.php',
    __DIR__ . '/../SMTP/smtp-config.php',
    __DIR__ . '/../private/smtp-config.php',
    // Accepted: inside the web root (PHP executes it, so nothing is emitted)
    __DIR__ . '/SMTP/smtp-config.php',
    __DIR__ . '/smtp-config.php',
] as $candidate) {
    if (is_readable($candidate)) { $cfg = require $candidate; break; }
}

const ALLOWED_ORIGINS = [
    'https://www.sinergiindonesia.com',
    'https://sinergiindonesia.com',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ALLOWED_ORIGINS, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 86400');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json; charset=utf-8');

$fallbackTo = $cfg['to'] ?? 'contact@sinergiindonesia.com';

if (!is_array($cfg) || ($cfg['pass'] ?? '') === '' || ($cfg['pass'] ?? '') === 'PUT-YOUR-PASSWORD-HERE') {
    error_log('contact.php: smtp-config.php missing or password not set');
    http_response_code(503);
    exit(json_encode(['error' => 'The contact form is not connected yet. Please email ' . $fallbackTo . ' directly.']));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST, OPTIONS');
    exit(json_encode(['error' => 'Method not allowed']));
}

// ------------------------------------------------------------- validate --
$body = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($body)) { $body = $_POST; }
if (!is_array($body) || !$body) {
    http_response_code(400);
    exit(json_encode(['error' => 'Missing body']));
}

$clean = static fn($v, int $max): string => is_string($v) ? mb_substr(trim($v), 0, $max) : '';

if ($clean($body['website'] ?? '', 100) !== '') {   // honeypot
    exit(json_encode(['ok' => true]));
}

$name    = $clean($body['name']    ?? '', 120);
$email   = $clean($body['email']   ?? '', 200);
$company = $clean($body['company'] ?? '', 160);
$phone   = $clean($body['phone']   ?? '', 40);
$subject = $clean($body['subject'] ?? '', 120) ?: 'General enquiry';
$message = $clean($body['message'] ?? '', 5000);

if ($name === '' || $email === '' || $message === '') {
    http_response_code(400);
    exit(json_encode(['error' => 'Name, email, and message are required.']));
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    exit(json_encode(['error' => 'That email address does not look valid.']));
}

// ---------------------------------------------------------------- build --
$hdrSafe = static fn(string $v): string => str_replace(["\r", "\n"], ' ', $v);
$esc     = static fn(string $v): string => htmlspecialchars($v, ENT_QUOTES, 'UTF-8');

$rows = '';
foreach ([
    'Name' => $name, 'Email' => $email, 'Company' => $company ?: '-',
    'Phone' => $phone ?: '-', 'Interested in' => $subject,
] as $k => $v) {
    $rows .= '<tr><td style="padding:6px 14px 6px 0;color:#6b7888;font:600 13px system-ui">'
           . $esc($k) . '</td><td style="padding:6px 0;color:#131a22;font:14px system-ui">'
           . $esc($v) . '</td></tr>';
}

$html = '<div style="font:14px/1.6 system-ui,sans-serif;color:#131a22">'
      . '<h2 style="margin:0 0 4px;font-size:17px">New enquiry from sinergiindonesia.com</h2>'
      . '<p style="margin:0 0 18px;color:#6b7888;font-size:13px">Submitted via the website contact form.</p>'
      . '<table style="border-collapse:collapse;margin-bottom:18px">' . $rows . '</table>'
      . '<div style="border-top:1px solid #e6eaee;padding-top:14px">'
      . '<div style="color:#6b7888;font:600 13px system-ui;margin-bottom:6px">Message</div>'
      . '<div style="white-space:pre-wrap">' . nl2br($esc($message)) . '</div></div></div>';

$encSubject = '=?UTF-8?B?' . base64_encode('[Website] ' . $subject . ' — ' . $name) . '?=';
$fromName   = '=?UTF-8?B?' . base64_encode((string)($cfg['from_name'] ?? 'Website')) . '?=';

$headers = [
    'Date: ' . date(DATE_RFC2822),
    'Message-ID: <' . bin2hex(random_bytes(12)) . '@sinergiindonesia.com>',
    'From: ' . $fromName . ' <' . $cfg['from'] . '>',
    'To: ' . $cfg['to'],
    'Reply-To: ' . $hdrSafe($name) . ' <' . $hdrSafe($email) . '>',
    'Subject: ' . $encSubject,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
];

$data = implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($html), 76, "\r\n");

// ----------------------------------------------------------- SMTP client --
/** Reads a full reply, following multi-line "250-" continuations. */
function smtp_read($fp): string {
    $out = '';
    while (($line = fgets($fp, 1024)) !== false) {
        $out .= $line;
        if (strlen($line) < 4 || $line[3] !== '-') break;   // "250 " ends it
    }
    return $out;
}
function smtp_cmd($fp, string $cmd, string $expect, string $label): void {
    if ($cmd !== '') { fwrite($fp, $cmd . "\r\n"); }
    $reply = smtp_read($fp);
    if (strncmp($reply, $expect, strlen($expect)) !== 0) {
        throw new RuntimeException($label . ' — expected ' . $expect . ', got: ' . trim($reply));
    }
}

$port   = (int)($cfg['port'] ?? 465);
$scheme = $port === 465 ? 'ssl://' : 'tcp://';

try {
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $fp  = @stream_socket_client($scheme . $cfg['host'] . ':' . $port, $errno, $errstr, 15,
                                 STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) { throw new RuntimeException("connect failed: $errstr ($errno)"); }
    stream_set_timeout($fp, 15);

    smtp_cmd($fp, '', '220', 'greeting');
    smtp_cmd($fp, 'EHLO sinergiindonesia.com', '250', 'EHLO');

    if ($port !== 465) {                       // 587: upgrade in place
        smtp_cmd($fp, 'STARTTLS', '220', 'STARTTLS');
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new RuntimeException('TLS negotiation failed');
        }
        smtp_cmd($fp, 'EHLO sinergiindonesia.com', '250', 'EHLO after STARTTLS');
    }

    smtp_cmd($fp, 'AUTH LOGIN', '334', 'AUTH LOGIN');
    smtp_cmd($fp, base64_encode((string)$cfg['user']), '334', 'username');
    smtp_cmd($fp, base64_encode((string)$cfg['pass']), '235', 'password');

    smtp_cmd($fp, 'MAIL FROM:<' . $cfg['from'] . '>', '250', 'MAIL FROM');
    smtp_cmd($fp, 'RCPT TO:<' . $cfg['to'] . '>', '250', 'RCPT TO');
    smtp_cmd($fp, 'DATA', '354', 'DATA');

    // Dot-stuffing: a line that is just "." would otherwise end the message
    fwrite($fp, preg_replace('/^\./m', '..', $data) . "\r\n.\r\n");
    smtp_cmd($fp, '', '250', 'message body');

    fwrite($fp, "QUIT\r\n");
    fclose($fp);
} catch (Throwable $e) {
    error_log('contact.php SMTP: ' . $e->getMessage());
    if (isset($fp) && is_resource($fp)) { fclose($fp); }
    http_response_code(502);
    exit(json_encode(['error' => 'We could not send your message. Please email ' . $cfg['to'] . '.']));
}

echo json_encode(['ok' => true]);
