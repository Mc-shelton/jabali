<?php
// Receives completed C2B payments: customers who used Pay Bill directly rather
// than the site's STK prompt. Register this exact HTTPS URL (including `key`)
// as the shortcode's C2B Confirmation URL in Daraja.

declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_c2b.php';

function c2b_acknowledge(): void
{
    json_out(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
}

function c2b_retry_response(string $message, int $status): void
{
    json_out(['ResultCode' => 1, 'ResultDesc' => $message, 'ref' => log_ref()], $status);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'POST';
if (in_array($method, ['GET', 'HEAD'], true)) {
    if (!c2b_callback_key_valid((string) ($_GET['key'] ?? ''))) {
        log_error('C2B readiness check failed: invalid callback key');
        c2b_retry_response('Callback authentication failed', 403);
    }
    // Daraja URL Management may probe a newly registered endpoint before it
    // sends real POST callbacks. A successful authenticated readiness response
    // proves the route is deployed without creating a payment record.
    log_info('C2B confirmation endpoint readiness check passed');
    c2b_acknowledge();
}

if ($method !== 'POST') {
    log_warn('C2B confirmation used an unexpected HTTP method');
    c2b_retry_response('POST required', 405);
}

if (!c2b_callback_key_valid((string) ($_GET['key'] ?? ''))) {
    log_error('C2B confirmation not captured: invalid callback key');
    c2b_retry_response('Callback authentication failed', 403);
}

$raw = file_get_contents('php://input');
$raw = $raw === false ? '' : $raw;
$captureError = null;
$capture = c2b_capture_callback($raw, $captureError, log_ref());
if ($capture === null) {
    log_error('C2B confirmation not captured: durable inbox unavailable', [
        'reason' => $captureError,
        'bytes'  => strlen($raw),
        'sha256' => hash('sha256', $raw),
    ]);
    // Never tell Safaricom "Accepted" until the notification is on disk.
    c2b_retry_response('Temporary storage failure', 503);
}

$payload = json_decode($raw ?: 'null', true);
$payment = is_array($payload) ? c2b_normalise_confirmation($payload) : null;

if ($payment === null) {
    log_error('C2B confirmation captured but needs manual recovery: invalid payload', [
        'captureId'  => $capture['captureId'],
        'bytes'      => $capture['bytes'],
        'sha256'     => $capture['sha256'],
        'receipt'    => is_array($payload) ? ($payload['TransID'] ?? null) : null,
        'shortcode'  => is_array($payload) ? ($payload['BusinessShortCode'] ?? null) : null,
        'payloadKeys' => is_array($payload) ? array_keys($payload) : [],
    ]);
    // It is safe to acknowledge: the byte-exact body is already durable.
    c2b_acknowledge();
}

// Trace every materialised payment back to the byte-exact inbox record and the
// structured API log lines for this request.
$payment['captureId'] = $capture['captureId'];
$payment['requestRef'] = $capture['requestRef'] ?? log_ref();
$payment['payloadSha256'] = $capture['sha256'];

$persistError = null;
$status = c2b_persist_payment($payment, $persistError);
$context = [
    'captureId'        => $capture['captureId'],
    'sha256'           => $capture['sha256'],
    'receipt'          => $payment['receipt'],
    'amount'           => $payment['amount'],
    'paidAt'           => $payment['paidAt'],
    'shortcode'        => $payment['shortcode'],
    'accountReference' => $payment['accountReference'],
    'transactionType'  => $payment['transactionType'],
    'phoneSuffix'      => $payment['phone'] === '' ? null : substr($payment['phone'], -4),
];

if ($status === 'error') {
    log_error('Direct PayBill payment captured; materialisation deferred', $context + [
        'reason' => $persistError,
    ]);
} elseif ($status === 'duplicate') {
    log_info('Duplicate direct PayBill callback safely ignored', $context);
} elseif ($status === 'conflict') {
    log_error('Direct PayBill receipt conflict captured for manual review', $context);
} else {
    log_info('Direct PayBill payment durably received', $context);
}

c2b_acknowledge();
