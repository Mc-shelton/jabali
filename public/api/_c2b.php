<?php
// Shape and reconcile direct Customer-to-Business (PayBill) confirmations.
// These are separate from STK callbacks: they cover a customer opening M-Pesa
// themselves, choosing Pay Bill and sending money without creating an order on
// this site first.

declare(strict_types=1);

const C2B_MAX_CALLBACK_BYTES = 1024 * 1024;

function c2b_inbox_path(): string
{
    return DATA_DIR . '/mpesa_c2b_inbox.ndjson';
}

function c2b_store_path(): string
{
    return DATA_DIR . '/mpesa_c2b.json';
}

function c2b_store_lock_path(): string
{
    return DATA_DIR . '/mpesa_c2b.lock';
}

function c2b_ensure_data_dir(?string &$error = null): bool
{
    $error = null;
    if (is_dir(DATA_DIR)) return true;
    if (@mkdir(DATA_DIR, 0775, true) || is_dir(DATA_DIR)) return true;
    $error = 'data directory could not be created';
    return false;
}

function c2b_callback_key_valid(string $provided): bool
{
    $configured = trim((string) (MPESA['c2b_callback_key'] ?? ''));
    return $configured !== '' && $provided !== '' && hash_equals($configured, $provided);
}

function c2b_value($value, int $maxLength = 160): string
{
    if (!is_scalar($value)) return '';
    $clean = trim((string) $value);
    $clean = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $clean);
    return mb_substr($clean, 0, $maxLength);
}

function c2b_normalise_reference($value): string
{
    return strtoupper(preg_replace('/[^A-Z0-9]/i', '', c2b_value($value, 120)));
}

// Daraja may redact MSISDN as a 64-character hexadecimal digest. Treating the
// digits inside that digest as a phone number creates convincing-looking but
// false data, so only accept the normal Kenyan mobile forms.
function c2b_normalise_phone($value): string
{
    $raw = c2b_value($value, 80);
    if ($raw === '' || preg_match('/^[A-F0-9]{64}$/i', $raw)) return '';
    if (!preg_match('/^\+?[0-9\s().-]{9,24}$/', $raw)) return '';

    $digits = preg_replace('/\D+/', '', $raw);
    return preg_match('/^(?:254[17]\d{8}|0[17]\d{8}|[17]\d{8})$/', $digits)
        ? $digits
        : '';
}

// Returns null when the payload cannot be a real confirmation for our
// shortcode. The callback endpoint still acknowledges it so Safaricom does not
// retry bad input indefinitely, but it is not allowed into the sales figures.
function c2b_normalise_confirmation(array $payload): ?array
{
    $receipt = strtoupper(preg_replace('/[^A-Z0-9]/i', '', c2b_value($payload['TransID'] ?? '', 40)));
    $amount = filter_var($payload['TransAmount'] ?? null, FILTER_VALIDATE_FLOAT);
    $shortcode = preg_replace('/\D+/', '', c2b_value($payload['BusinessShortCode'] ?? '', 20));
    $ours = preg_replace('/\D+/', '', trim((string) (MPESA['shortcode'] ?? '')));

    if ($receipt === '' || $amount === false || $amount <= 0) return null;
    if ($ours !== '' && $shortcode !== $ours) return null;

    $transTime = preg_replace('/\D+/', '', c2b_value($payload['TransTime'] ?? '', 20));
    $paidAt = null;
    if (strlen($transTime) === 14) {
        $parsed = DateTimeImmutable::createFromFormat(
            '!YmdHis',
            $transTime,
            new DateTimeZone('Africa/Nairobi')
        );
        if ($parsed !== false) $paidAt = $parsed->format(DATE_ATOM);
    }

    $names = array_filter([
        c2b_value($payload['FirstName'] ?? '', 80),
        c2b_value($payload['MiddleName'] ?? '', 80),
        c2b_value($payload['LastName'] ?? '', 80),
    ]);

    return [
        'receipt'          => $receipt,
        'amount'           => (float) $amount,
        'paidAt'           => $paidAt,
        'receivedAt'       => date(DATE_ATOM),
        'shortcode'        => $shortcode,
        'accountReference' => c2b_normalise_reference($payload['BillRefNumber'] ?? ''),
        'phone'            => c2b_normalise_phone($payload['MSISDN'] ?? ''),
        'payerName'        => implode(' ', $names),
        'transactionType'  => c2b_value($payload['TransactionType'] ?? '', 80),
    ];
}

// Write-ahead capture. The exact body is stored before the callback is
// acknowledged, so a later parser bug, malformed field, disk race or material
// store failure cannot make the only copy of Safaricom's notification vanish.
// The body is base64 encoded so even invalid JSON/UTF-8 remains byte-exact.
function c2b_capture_callback(string $raw, ?string &$error = null, ?string $requestRef = null): ?array
{
    $error = null;
    $bytes = strlen($raw);
    if ($bytes === 0) {
        $error = 'callback body was empty';
        return null;
    }
    if ($bytes > C2B_MAX_CALLBACK_BYTES) {
        $error = 'callback exceeded ' . C2B_MAX_CALLBACK_BYTES . ' bytes';
        return null;
    }
    if (!c2b_ensure_data_dir($error)) return null;

    try {
        $captureId = bin2hex(random_bytes(12));
    } catch (Throwable $e) {
        $error = 'capture id generation failed: ' . $e->getMessage();
        return null;
    }

    $capture = [
        'captureId'  => $captureId,
        'receivedAt' => date(DATE_ATOM),
        'sha256'     => hash('sha256', $raw),
        'bytes'      => $bytes,
        'rawBase64'  => base64_encode($raw),
    ];
    if ($requestRef !== null && $requestRef !== '') $capture['requestRef'] = $requestRef;
    $json = json_encode($capture, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        $error = 'write-ahead record could not be encoded';
        return null;
    }

    $fp = @fopen(c2b_inbox_path(), 'ab');
    if ($fp === false) {
        $error = 'write-ahead inbox could not be opened';
        return null;
    }
    if (!@flock($fp, LOCK_EX)) {
        @fclose($fp);
        $error = 'write-ahead inbox could not be locked';
        return null;
    }

    @fseek($fp, 0, SEEK_END);
    $start = @ftell($fp);
    if ($start === false) $start = 0;

    $line = $json . "\n";
    $offset = 0;
    $length = strlen($line);
    while ($offset < $length) {
        $written = @fwrite($fp, substr($line, $offset));
        if ($written === false || $written === 0) {
            // Remove any partial line before allowing a retry to append.
            @ftruncate($fp, $start);
            @fflush($fp);
            @flock($fp, LOCK_UN);
            @fclose($fp);
            $error = 'write-ahead inbox write was incomplete';
            return null;
        }
        $offset += $written;
    }

    $flushed = @fflush($fp);
    $synced = !function_exists('fsync') || @fsync($fp);
    @flock($fp, LOCK_UN);
    @fclose($fp);
    if (!$flushed || !$synced) {
        $error = 'write-ahead inbox could not be flushed to disk';
        return null;
    }

    return $capture;
}

// Reads past a torn final line rather than abandoning every earlier callback.
// Each capture has a body hash so corruption is detectable and never silently
// turned into a payment.
function c2b_read_captures(): array
{
    if (!is_file(c2b_inbox_path())) return [];
    $lines = @file(c2b_inbox_path(), FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $captures = [];

    foreach ($lines as $lineNumber => $line) {
        $entry = json_decode($line, true);
        if (!is_array($entry)) {
            $captures[] = ['error' => 'invalid inbox JSON', 'line' => $lineNumber + 1];
            continue;
        }
        $raw = base64_decode((string) ($entry['rawBase64'] ?? ''), true);
        if ($raw === false || !hash_equals((string) ($entry['sha256'] ?? ''), hash('sha256', $raw))) {
            $captures[] = $entry + ['error' => 'inbox body failed its integrity check'];
            continue;
        }
        $payload = json_decode($raw, true);
        $payment = is_array($payload) ? c2b_normalise_confirmation($payload) : null;
        if ($payment !== null) {
            $payment['captureId'] = $entry['captureId'] ?? null;
            $payment['requestRef'] = $entry['requestRef'] ?? null;
            $payment['payloadSha256'] = $entry['sha256'] ?? null;
        }
        $captures[] = $entry + [
            'payload' => $payload,
            'payment' => $payment,
            'error'   => $payment === null ? 'callback payload could not be normalised' : null,
        ];
    }

    return $captures;
}

// Materialise normalised payments in one locked batch. The dedicated lock
// protects concurrent callbacks; the atomic rename means a process crash can
// leave either the old complete JSON or the new complete JSON, never a
// half-truncated payment store.
function c2b_persist_payments(array $incoming, ?string &$error = null): ?array
{
    $error = null;
    if (!c2b_ensure_data_dir($error)) return null;

    $lock = @fopen(c2b_store_lock_path(), 'c');
    if ($lock === false) {
        $error = 'payment-store lock could not be opened';
        return null;
    }
    if (!@flock($lock, LOCK_EX)) {
        @fclose($lock);
        $error = 'payment-store lock could not be acquired';
        return null;
    }

    $path = c2b_store_path();
    $raw = is_file($path) ? @file_get_contents($path) : false;
    $payments = $raw === false || trim($raw) === '' ? [] : json_decode($raw, true);
    if (!is_array($payments)) {
        @flock($lock, LOCK_UN);
        @fclose($lock);
        $error = 'existing payment store contains invalid JSON; preserved for recovery';
        return null;
    }

    $known = [];
    foreach ($payments as $existing) {
        $receipt = strtoupper(trim((string) ($existing['receipt'] ?? '')));
        if ($receipt !== '') $known[$receipt] = $existing;
    }

    $added = 0;
    $duplicates = 0;
    $conflicts = [];
    foreach ($incoming as $payment) {
        $receipt = strtoupper(trim((string) ($payment['receipt'] ?? '')));
        if ($receipt === '') continue;
        if (isset($known[$receipt])) {
            $existing = $known[$receipt];
            $same = abs((float) ($existing['amount'] ?? 0) - (float) ($payment['amount'] ?? 0)) < 0.001
                && (string) ($existing['shortcode'] ?? '') === (string) ($payment['shortcode'] ?? '')
                && c2b_normalise_reference($existing['accountReference'] ?? '')
                    === c2b_normalise_reference($payment['accountReference'] ?? '');
            if ($same) $duplicates++;
            else $conflicts[] = $receipt;
            continue;
        }
        $payments[] = $payment;
        $known[$receipt] = $payment;
        $added++;
    }

    if ($added === 0) {
        @flock($lock, LOCK_UN);
        @fclose($lock);
        return ['added' => 0, 'duplicates' => $duplicates, 'conflicts' => $conflicts];
    }

    $json = json_encode($payments, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        @flock($lock, LOCK_UN);
        @fclose($lock);
        $error = 'payment store could not be encoded';
        return null;
    }

    $temp = @tempnam(DATA_DIR, '.mpesa-c2b-');
    if ($temp === false || @file_put_contents($temp, $json, LOCK_EX) !== strlen($json)) {
        if (is_string($temp) && is_file($temp)) @unlink($temp);
        @flock($lock, LOCK_UN);
        @fclose($lock);
        $error = 'temporary payment store could not be written';
        return null;
    }

    $tempFp = @fopen($temp, 'rb');
    if ($tempFp !== false) {
        if (function_exists('fsync')) @fsync($tempFp);
        @fclose($tempFp);
    }
    if (!@rename($temp, $path)) {
        @unlink($temp);
        @flock($lock, LOCK_UN);
        @fclose($lock);
        $error = 'payment store could not be installed atomically';
        return null;
    }

    @flock($lock, LOCK_UN);
    @fclose($lock);
    return ['added' => $added, 'duplicates' => $duplicates, 'conflicts' => $conflicts];
}

function c2b_persist_payment(array $payment, ?string &$error = null): string
{
    $result = c2b_persist_payments([$payment], $error);
    if ($result === null) return 'error';
    if (!empty($result['conflicts'])) return 'conflict';
    return $result['added'] === 1 ? 'added' : 'duplicate';
}

// Replays every valid write-ahead record. This is safe to run repeatedly:
// receipt deduplication makes it idempotent. Invalid captures stay in the inbox
// for inspection and future parser fixes instead of being discarded.
function c2b_replay_inbox(): array
{
    $result = [
        'captured' => 0,
        'added' => 0,
        'duplicates' => 0,
        'conflicts' => [],
        'invalid' => 0,
        'errors' => [],
    ];
    $valid = [];
    foreach (c2b_read_captures() as $capture) {
        $result['captured']++;
        if (!empty($capture['error']) || !is_array($capture['payment'] ?? null)) {
            $result['invalid']++;
            continue;
        }
        $valid[] = $capture['payment'];
    }

    if ($valid) {
        $error = null;
        $persisted = c2b_persist_payments($valid, $error);
        if ($persisted === null) {
            $result['errors'][] = ['error' => $error ?? 'unknown persistence error'];
        } else {
            $result['added'] = $persisted['added'];
            $result['duplicates'] = $persisted['duplicates'];
            $result['conflicts'] = $persisted['conflicts'];
        }
    }
    return $result;
}

// The write-ahead inbox is authoritative. Merge any valid capture that has not
// yet reached the materialised JSON store so the dashboard remains correct even
// while that store is being repaired.
function c2b_read_payments_resilient(): array
{
    $stored = [];
    $raw = is_file(c2b_store_path()) ? @file_get_contents(c2b_store_path()) : false;
    $decoded = $raw === false || trim($raw) === '' ? [] : json_decode($raw, true);
    if (is_array($decoded)) $stored = $decoded;

    $byReceipt = [];
    foreach ($stored as $payment) {
        $receipt = strtoupper(trim((string) ($payment['receipt'] ?? '')));
        if ($receipt !== '') $byReceipt[$receipt] = $payment;
    }
    foreach (c2b_read_captures() as $capture) {
        $payment = $capture['payment'] ?? null;
        if (!is_array($payment)) continue;
        $receipt = strtoupper(trim((string) ($payment['receipt'] ?? '')));
        if ($receipt !== '' && !isset($byReceipt[$receipt])) $byReceipt[$receipt] = $payment;
    }

    return array_values($byReceipt);
}

// A C2B feed can include a payment that the STK flow also knows about. Receipt
// and account-reference matching keep it from becoming both an order and an
// "unclaimed" payment, regardless of which callback reaches us first.
function c2b_unclaimed_payments(array $payments, array $orders): array
{
    $claimedReceipts = [];
    $claimedReferences = [];
    foreach ($orders as $order) {
        $receipt = strtoupper(trim((string) ($order['receipt'] ?? '')));
        if ($receipt !== '') $claimedReceipts[$receipt] = true;
        $reference = c2b_normalise_reference($order['paymentReference'] ?? '');
        if ($reference !== '') $claimedReferences[$reference] = true;
    }

    $unclaimed = [];
    foreach ($payments as $payment) {
        $receipt = strtoupper(trim((string) ($payment['receipt'] ?? '')));
        $reference = c2b_normalise_reference($payment['accountReference'] ?? '');
        if ($receipt === '') continue;
        if (isset($claimedReceipts[$receipt])) continue;
        if ($reference !== '' && isset($claimedReferences[$reference])) continue;
        $unclaimed[] = $payment;
    }

    usort($unclaimed, fn($a, $b) => strcmp(
        (string) ($b['paidAt'] ?? $b['receivedAt'] ?? ''),
        (string) ($a['paidAt'] ?? $a['receivedAt'] ?? '')
    ));
    return $unclaimed;
}

function c2b_unclaimed_stats(array $payments, array $orders): array
{
    $unclaimed = c2b_unclaimed_payments($payments, $orders);
    return [
        'count' => count($unclaimed),
        'amount' => (float) array_sum(array_map(
            fn($payment) => (float) ($payment['amount'] ?? 0),
            $unclaimed
        )),
    ];
}

// Project only the fields the admin orders screen needs. Internal capture
// hashes and raw payloads remain in the durable inbox and logs, not in the UI.
function c2b_admin_record(array $payment): array
{
    $receipt = strtoupper(trim((string) ($payment['receipt'] ?? '')));
    $paidAt = (string) ($payment['paidAt'] ?? '');
    $receivedAt = (string) ($payment['receivedAt'] ?? '');
    $payerName = trim((string) ($payment['payerName'] ?? ''));
    $phone = c2b_normalise_phone($payment['phone'] ?? '');
    $accountReference = c2b_normalise_reference($payment['accountReference'] ?? '');

    return [
        'id'               => 'c2b-' . strtolower($receipt),
        'recordType'       => 'unclaimed',
        'createdAt'        => $paidAt !== '' ? $paidAt : $receivedAt,
        'paidAt'           => $paidAt !== '' ? $paidAt : null,
        'receivedAt'       => $receivedAt !== '' ? $receivedAt : null,
        'amount'           => (float) ($payment['amount'] ?? 0),
        'status'           => 'unclaimed',
        'eventTitle'       => 'Direct PayBill',
        'itemName'         => 'PayBill payment',
        'itemType'         => 'payment',
        'quantity'         => 0,
        'customer'         => [
            'preferredName' => $payerName !== '' ? $payerName : 'Unknown payer',
            'otherNames'    => '',
            'phone'         => $phone,
        ],
        'mpesaPhone'       => $phone,
        'receipt'          => $receipt,
        'paymentReference' => $accountReference,
        'accountReference' => $accountReference,
        'shortcode'        => (string) ($payment['shortcode'] ?? ''),
        'transactionType'  => (string) ($payment['transactionType'] ?? ''),
        'requestRef'       => (string) ($payment['requestRef'] ?? ''),
    ];
}
