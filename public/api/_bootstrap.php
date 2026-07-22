<?php
// Shared bootstrap for every API endpoint: session, JSON helpers, the flat-file
// store, auth, CSRF, and input sanitising. Each endpoint does `require`
// '_bootstrap.php' and then routes on the HTTP method.

declare(strict_types=1);

// config.php is deliberately NOT in git and NOT deployed — it holds the M-Pesa
// keys and the admin password, and the repository is public. It is created once
// on the server from config.example.php. Say so plainly rather than dying with
// an undefined-constant error somewhere further in.
if (!is_file(__DIR__ . '/config.php')) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'Server not configured: api/config.php is missing. '
                 . 'Copy api/config.example.php to api/config.php and fill it in.',
    ]);
    exit;
}
require __DIR__ . '/config.php';

// Diagnostics go to a log file, never into the response. A notice printed ahead
// of the JSON body makes a perfectly successful request look like a network
// failure to the client — which is exactly how a deprecated curl_close() broke
// the M-Pesa status check. Load this before anything can emit output.
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
error_reporting(E_ALL);
require __DIR__ . '/_log.php';
log_rotate();

// ---------------------------------------------------------------- session
// Same-origin app, so a Lax, HttpOnly cookie is enough. Secure flag is set when
// the request arrived over HTTPS.
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_name(SESSION_NAME);
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'httponly' => true,
    'secure' => $https,
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// ---------------------------------------------------------------- responses
function json_out($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function error_out(string $message, int $status = 400): void
{
    json_out(['error' => $message], $status);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        error_out('Invalid JSON body.', 422);
    }
    return $data;
}

// ---------------------------------------------------------------- store
// A tiny flat-file store. Reads are cheap; writes take an exclusive lock so two
// concurrent saves can't corrupt the file.
function store_path(string $name): string
{
    return DATA_DIR . '/' . $name . '.json';
}

function store_read(string $name, $default = [])
{
    $path = store_path($name);
    if (!is_file($path)) {
        return $default;
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw ?: 'null', true);
    return $data ?? $default;
}

function store_write(string $name, $data): void
{
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0775, true) && !is_dir(DATA_DIR)) {
        error_out('Data directory is not writable.', 500);
    }
    $path = store_path($name);
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    $fp = fopen($path, 'c+');
    if ($fp === false) {
        error_out('Could not open data file for writing.', 500);
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        error_out('Could not lock data file.', 500);
    }
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, $json);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

// ---------------------------------------------------------------- auth + csrf
function is_authenticated(): bool
{
    return !empty($_SESSION['admin']);
}

function require_auth(): void
{
    if (!is_authenticated()) {
        error_out('Not authenticated.', 401);
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

// Mutations must carry the CSRF token issued at login, in the X-CSRF-Token
// header. Combined with the Lax session cookie this blocks cross-site writes.
function require_csrf(): void
{
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        error_out('Invalid CSRF token.', 403);
    }
}

function password_is_valid(string $password): bool
{
    if (defined('ADMIN_PASSWORD_HASH') && ADMIN_PASSWORD_HASH !== '') {
        return password_verify($password, ADMIN_PASSWORD_HASH);
    }
    // Constant-time compare against the plaintext fallback.
    return hash_equals(ADMIN_PASSWORD, $password);
}

// ---------------------------------------------------------------- sanitising
function clean_string($value, int $maxLen = 500): string
{
    if (!is_string($value)) {
        return '';
    }
    $value = trim($value);
    // Strip control characters; keep normal unicode.
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    return mb_substr($value, 0, $maxLen);
}

function slugify(string $value): string
{
    $value = mb_strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value);
    $value = trim($value, '-');
    return $value !== '' ? $value : 'item-' . substr(bin2hex(random_bytes(4)), 0, 6);
}

// Only allow methods we actually handle; answer preflight cheaply.
function route(array $handlers): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if (!isset($handlers[$method])) {
        error_out('Method not allowed.', 405);
    }
    $handlers[$method]();
}
