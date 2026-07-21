<?php
// Logging + error handling for the whole API.
//
// This exists because of a specific class of failure: PHP printing a notice or
// deprecation *into the response body*, ahead of the JSON. The client then can't
// parse the reply and reports a network error, while the server thinks it
// answered fine. A deprecated curl_close() did exactly that to the M-Pesa status
// check, and nothing was written down anywhere to explain it.
//
// So: diagnostics never go to the browser, they go to a file. Anything fatal
// still answers with valid JSON, carrying a short reference the admin can look
// up in the log.
//
// Logs live under DATA_DIR, which api/data/.htaccess blocks from the web.

declare(strict_types=1);

const LOG_KEEP_DAYS = 14;

function log_dir(): string
{
    return DATA_DIR . '/logs';
}

function log_path(?string $day = null): string
{
    return log_dir() . '/api-' . ($day ?? date('Y-m-d')) . '.log';
}

// A short id tying a user-visible error to its log line.
function log_ref(): string
{
    static $ref = null;
    if ($ref === null) {
        $ref = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
    }
    return $ref;
}

// One JSON object per line — greppable by hand, parseable by the admin viewer.
function jc_log(string $level, string $message, array $context = []): void
{
    $dir = log_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return;                       // never let logging itself break a request
    }

    $entry = [
        'time'    => date('c'),
        'level'   => $level,
        'ref'     => log_ref(),
        'message' => $message,
        'method'  => $_SERVER['REQUEST_METHOD'] ?? 'CLI',
        'path'    => strtok($_SERVER['REQUEST_URI'] ?? '', '?') ?: '',
        'context' => $context,
    ];

    @file_put_contents(
        log_path(),
        json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n",
        FILE_APPEND | LOCK_EX
    );
}

function log_info(string $m, array $c = []): void { jc_log('info', $m, $c); }
function log_warn(string $m, array $c = []): void { jc_log('warning', $m, $c); }
function log_error(string $m, array $c = []): void { jc_log('error', $m, $c); }

// Drop log files older than LOG_KEEP_DAYS. Runs rarely (1 request in ~200) so
// it costs nothing on a normal request.
function log_rotate(): void
{
    if (random_int(1, 200) !== 1) return;
    $cutoff = time() - (LOG_KEEP_DAYS * 86400);
    foreach (glob(log_dir() . '/api-*.log') ?: [] as $file) {
        if (@filemtime($file) < $cutoff) @unlink($file);
    }
}

// ---------------------------------------------------------------- handlers

// Notices, warnings and deprecations: record them, and — critically — return
// true so PHP's own handler never echoes them into the response.
set_error_handler(function (int $no, string $str, string $file = '', int $line = 0): bool {
    static $levels = [
        E_WARNING           => 'warning',
        E_NOTICE            => 'notice',
        E_USER_WARNING      => 'warning',
        E_USER_NOTICE       => 'notice',
        E_DEPRECATED        => 'deprecated',
        E_USER_DEPRECATED   => 'deprecated',
        E_RECOVERABLE_ERROR => 'error',
    ];
    jc_log($levels[$no] ?? 'error', $str, [
        'file' => basename($file),
        'line' => $line,
    ]);
    return true;
});

set_exception_handler(function (Throwable $e): void {
    log_error(get_class($e) . ': ' . $e->getMessage(), [
        'file'  => basename($e->getFile()),
        'line'  => $e->getLine(),
        'trace' => array_slice(explode("\n", $e->getTraceAsString()), 0, 8),
    ]);

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode([
        'error' => 'Something went wrong on the server. Reference: ' . log_ref(),
        'ref'   => log_ref(),
    ]);
});

// Fatals bypass both handlers above, so catch them on the way out.
register_shutdown_function(function (): void {
    $err = error_get_last();
    if (!$err || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    log_error('Fatal: ' . $err['message'], [
        'file' => basename($err['file']),
        'line' => $err['line'],
    ]);
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => 'Something went wrong on the server. Reference: ' . log_ref(),
            'ref'   => log_ref(),
        ]);
    }
});
