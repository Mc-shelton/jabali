<?php
// M-Pesa (Safaricom Daraja) helpers — STK Push, status query, phone formatting.
// Ported from the iPay/Daraja reference, trimmed to just what ticketing needs.
// Requires config.php (MPESA constant). Assumes _bootstrap.php was loaded first
// for error_out().

declare(strict_types=1);

function mpesa_base(): string
{
    return MPESA['env'] === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
}

function mpesa_configured(): bool
{
    return MPESA['consumer_key'] !== '' && MPESA['consumer_secret'] !== ''
        && MPESA['shortcode'] !== '' && MPESA['passkey'] !== '';
}

// Normalise a Kenyan number to 2547XXXXXXXX / 2541XXXXXXXX. Returns '' if it
// doesn't look like a valid mobile number.
function mpesa_format_phone(string $phone): string
{
    $digits = preg_replace('/\D+/', '', $phone);
    if ($digits === '') return '';

    if (strpos($digits, '254') === 0 && strlen($digits) === 12) return $digits;
    if ($digits[0] === '0' && strlen($digits) === 10) return '254' . substr($digits, 1);
    if (strlen($digits) === 9 && ($digits[0] === '7' || $digits[0] === '1')) return '254' . $digits;

    return '';
}

// Low-level HTTP with a short timeout. Returns [httpCode, decodedBody].
function mpesa_http(string $method, string $url, array $headers, ?string $body = null): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 15,
        // Some shared hosts prefer a broken/unrouted IPv6 result for Daraja,
        // then wait for the full connect timeout without trying its IPv4 A
        // record. Safaricom publishes an IPv4 endpoint, so use it directly.
        CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    $errno = curl_errno($ch);
    $primaryIp = (string) curl_getinfo($ch, CURLINFO_PRIMARY_IP);
    $lookupMs = (int) round((float) curl_getinfo($ch, CURLINFO_NAMELOOKUP_TIME) * 1000);
    $connectMs = (int) round((float) curl_getinfo($ch, CURLINFO_CONNECT_TIME) * 1000);
    $totalMs = (int) round((float) curl_getinfo($ch, CURLINFO_TOTAL_TIME) * 1000);
    // No curl_close(): deprecated since PHP 8.5 and a no-op since 8.0 — the
    // handle is freed when it goes out of scope. Calling it printed a
    // deprecation notice ahead of the JSON body, which made the M-Pesa status
    // check look like a network failure to the browser.
    unset($ch);

    if ($raw === false) {
        return [0, [
            'error'       => $err ?: 'Network error reaching M-Pesa.',
            'curl_errno'  => $errno,
            'primary_ip'  => $primaryIp,
            'lookup_ms'   => $lookupMs,
            'connect_ms'  => $connectMs,
            'total_ms'    => $totalMs,
        ]];
    }
    return [$code, json_decode($raw, true) ?? []];
}

// OAuth token. Fetched fresh for each request — deliberately NOT cached across
// requests, so a token from one environment (e.g. sandbox) can never be reused
// against another (production), which Safaricom rejects as "Invalid Access
// Token". Credentials are trimmed in case they were pasted with stray spaces.
function mpesa_token(?string &$failure = null): ?string
{
    $failure = null;
    $key = trim((string) MPESA['consumer_key']);
    $secret = trim((string) MPESA['consumer_secret']);

    $url = mpesa_base() . '/oauth/v1/generate?grant_type=client_credentials';
    $auth = 'Basic ' . base64_encode($key . ':' . $secret);
    [$code, $body] = mpesa_http('GET', $url, ["Authorization: $auth"]);

    if ($code !== 200 || empty($body['access_token'])) {
        $networkFailure = $code === 0;
        $failure = $networkFailure
            ? 'M-Pesa is temporarily unreachable. Please try again shortly.'
            : 'M-Pesa rejected the payment configuration. Please contact us.';

        // Never log the Basic auth header, consumer key, or consumer secret.
        // The network timings distinguish DNS, connection, and API failures
        // without putting live credentials in a log or admin screen.
        log_error('M-Pesa OAuth failed', [
            'http'      => $code,
            'errorCode' => $body['errorCode'] ?? null,
            'message'   => $body['errorMessage'] ?? $body['error'] ?? 'M-Pesa rejected the request.',
            'url'        => $url,
            'curl_errno' => $body['curl_errno'] ?? null,
            'primary_ip' => $body['primary_ip'] ?? null,
            'lookup_ms'  => $body['lookup_ms'] ?? null,
            'connect_ms' => $body['connect_ms'] ?? null,
            'total_ms'   => $body['total_ms'] ?? null,
        ]);
        return null;
    }
    return $body['access_token'];
}

function mpesa_timestamp(): string
{
    return date('YmdHis');
}

function mpesa_password(string $timestamp): string
{
    // Trim in case the shortcode/passkey were pasted with stray whitespace.
    return base64_encode(trim((string) MPESA['shortcode']) . trim((string) MPESA['passkey']) . $timestamp);
}

// Daraja allows a short account reference. New orders supply a unique 12-char
// value so the C2B feed can be reconciled even if the separate STK callback
// carrying the receipt is delayed or never arrives.
function mpesa_account_reference(string $reference): string
{
    $clean = strtoupper(preg_replace('/[^A-Z0-9]/i', '', trim($reference)));
    if ($clean === '') {
        $clean = strtoupper(preg_replace(
            '/[^A-Z0-9]/i',
            '',
            trim((string) (MPESA['account_reference'] ?? 'JabaliChorale'))
        ));
    }
    return mb_substr($clean !== '' ? $clean : 'JABALICHO', 0, 12);
}

// Trigger the STK prompt. Returns [ok, data] where data has CheckoutRequestID /
// MerchantRequestID on success, or an error message.
function mpesa_stk_push(int $amount, string $phone, string $reference, string $description): array
{
    $authFailure = null;
    $token = mpesa_token($authFailure);
    if (!$token) {
        return [false, ['error' => $authFailure ?? 'Could not authenticate with M-Pesa.']];
    }

    $timestamp = mpesa_timestamp();
    $payload = [
        'BusinessShortCode' => (int) MPESA['shortcode'],
        'Password'          => mpesa_password($timestamp),
        'Timestamp'         => $timestamp,
        'TransactionType'   => MPESA['transaction_type'],
        'Amount'            => $amount,
        'PartyA'            => $phone,
        'PartyB'            => (int) MPESA['shortcode'],
        'PhoneNumber'       => $phone,
        'CallBackURL'       => MPESA['callback_url'],
        'AccountReference'  => mpesa_account_reference($reference),
        'TransactionDesc'   => mb_substr($description, 0, 20) ?: 'Tickets',
    ];

    [$code, $body] = mpesa_http(
        'POST',
        mpesa_base() . '/mpesa/stkpush/v1/processrequest',
        ["Authorization: Bearer $token", 'Content-Type: application/json'],
        json_encode($payload)
    );

    if ($code === 200 && ($body['ResponseCode'] ?? null) === '0') {
        log_info('M-Pesa STK push sent', [
            'phone'    => substr($phone, 0, 6) . '***',   // never log a full number
            'amount'   => $amount,
            'checkout' => $body['CheckoutRequestID'] ?? null,
            'reference' => mpesa_account_reference($reference),
        ]);
        return [true, $body];
    }
    // Surface Daraja's own message + code so failures are diagnosable.
    $msg = $body['errorMessage'] ?? $body['ResponseDescription'] ?? 'M-Pesa rejected the request.';
    if (!empty($body['errorCode'])) {
        $msg .= ' (' . $body['errorCode'] . ')';
    }
    log_error('M-Pesa STK push rejected', [
        'http'      => $code,
        'errorCode' => $body['errorCode'] ?? null,
        'message'   => $msg,
        'amount'    => $amount,
    ]);
    return [false, ['error' => $msg]];
}

// Daraja result codes that genuinely end a transaction. Anything NOT in this
// list is treated as still-pending rather than failed: a slow customer must
// never be reported as a failure, because the money can still arrive afterwards
// and the callback would then be correcting a state we already told them about.
const MPESA_TERMINAL_FAILURES = [
    '1'    => 'Insufficient M-Pesa balance.',
    '17'   => 'M-Pesa could not process the request.',
    '1032' => 'The payment prompt was cancelled.',
    '1037' => 'The prompt timed out before it was answered.',
    '2001' => 'The M-Pesa PIN entered was wrong.',
];

// Ask Daraja for the final status of a push (fallback if the callback is slow).
// Returns ['status' => 'success'|'failed'|'pending', 'code' => ?string,
//          'desc' => ?string].
function mpesa_stk_query(string $checkoutRequestId): array
{
    $pending = ['status' => 'pending', 'code' => null, 'desc' => null];

    $authFailure = null;
    $token = mpesa_token($authFailure);
    if (!$token) {
        log_error('M-Pesa auth failed during status query', [
            'checkout' => $checkoutRequestId,
            'message'  => $authFailure,
        ]);
        return $pending;
    }

    $timestamp = mpesa_timestamp();
    $payload = [
        'BusinessShortCode' => (int) MPESA['shortcode'],
        'Password'          => mpesa_password($timestamp),
        'Timestamp'         => $timestamp,
        'CheckoutRequestID' => $checkoutRequestId,
    ];

    [$code, $body] = mpesa_http(
        'POST',
        mpesa_base() . '/mpesa/stkpushquery/v1/query',
        ["Authorization: Bearer $token", 'Content-Type: application/json'],
        json_encode($payload)
    );

    // Every query outcome is logged: when a payment goes wrong, this line is the
    // record of what Safaricom actually said, and when.
    log_info('M-Pesa status query', [
        'checkout'   => $checkoutRequestId,
        'http'       => $code,
        'ResultCode' => $body['ResultCode'] ?? null,
        'errorCode'  => $body['errorCode'] ?? null,
        'desc'       => $body['ResultDesc'] ?? $body['errorMessage'] ?? null,
    ]);

    // Non-200 is usually errorCode 500.001.1001 "transaction is being
    // processed" — i.e. the customer simply hasn't finished yet.
    if ($code !== 200) return $pending;

    $result = isset($body['ResultCode']) ? (string) $body['ResultCode'] : null;
    if ($result === null) return $pending;

    if ($result === '0') {
        return ['status' => 'success', 'code' => '0', 'desc' => $body['ResultDesc'] ?? null];
    }
    if (isset(MPESA_TERMINAL_FAILURES[$result])) {
        return [
            'status' => 'failed',
            'code'   => $result,
            'desc'   => $body['ResultDesc'] ?? MPESA_TERMINAL_FAILURES[$result],
        ];
    }

    // An unrecognised code: stay pending rather than guess. The callback (or a
    // later query, once the code becomes one we know) settles it.
    return ['status' => 'pending', 'code' => $result, 'desc' => $body['ResultDesc'] ?? null];
}
