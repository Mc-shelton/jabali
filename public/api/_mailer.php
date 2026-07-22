<?php
// Sends the buyer's confirmation email, optionally with a PDF ticket attached.
// Uses PHP mail() with a hand-built MIME message (no external mail library).

declare(strict_types=1);

function order_email_html(array $order): string
{
    $isTicket = ($order['itemType'] ?? 'ticket') !== 'merch';
    $name = htmlspecialchars($order['customer']['preferredName'] ?? 'there');
    $event = htmlspecialchars($order['eventTitle'] ?? '');
    // An open-amount order (a donation) has no meaningful quantity.
    $item = !empty($order['openAmount'])
        ? htmlspecialchars((string) ($order['itemName'] ?? ''))
        : htmlspecialchars(($order['quantity'] ?? 1) . ' × ' . ($order['itemName'] ?? ''));
    $amount = 'KES ' . number_format((int) ($order['amount'] ?? 0));

    // Chosen variant (Size: XL · Colour: Gold), so the buyer has a record of
    // exactly what they ordered.
    $optionBits = [];
    foreach ((array) ($order['options'] ?? []) as $opt) {
        $optionBits[] = ($opt['name'] ?? '') . ': ' . ($opt['choice'] ?? '');
    }
    $optionsRow = $optionBits
        ? "<tr><td style=\"padding:8px 0;color:#5a6875\">Options</td><td style=\"padding:8px 0;text-align:right;font-weight:600\">"
          . htmlspecialchars(implode(' · ', $optionBits)) . "</td></tr>"
        : '';
    $receipt = htmlspecialchars($order['receipt'] ?? '');
    $code = htmlspecialchars($order['ticketCode'] ?? '');

    $lead = $isTicket
        ? "Your tickets for <strong>$event</strong> are confirmed. Your e-ticket is attached as a PDF — present the code below at entry."
        : "Thanks for your order from <strong>$event</strong>. We'll be in touch about collection/delivery.";

    $codeBlock = $isTicket
        ? "<p style=\"margin:24px 0 4px;font:600 12px/1 Arial,sans-serif;letter-spacing:1px;color:#5a6875;text-transform:uppercase\">Ticket code</p>
           <p style=\"margin:0;font:700 26px/1 Arial,sans-serif;color:#cc7b00\">$code</p>"
        : '';

    return "<div style=\"max-width:520px;margin:0 auto;font-family:Arial,sans-serif;color:#2a3a4d\">
      <p style=\"font:700 20px/1 Arial;color:#17497a;margin:0 0 4px\">Jabali Chorale</p>
      <h1 style=\"font-size:22px;color:#0e1b2a;margin:8px 0 16px\">Payment received</h1>
      <p style=\"line-height:1.6\">Hi $name, $lead</p>
      <table style=\"width:100%;border-collapse:collapse;margin:20px 0;font-size:14px\">
        <tr><td style=\"padding:8px 0;color:#5a6875\">Event</td><td style=\"padding:8px 0;text-align:right;font-weight:600\">$event</td></tr>
        <tr><td style=\"padding:8px 0;color:#5a6875\">Order</td><td style=\"padding:8px 0;text-align:right;font-weight:600\">$item</td></tr>
        $optionsRow
        <tr><td style=\"padding:8px 0;color:#5a6875\">Amount paid</td><td style=\"padding:8px 0;text-align:right;font-weight:600\">$amount</td></tr>
        " . ($receipt ? "<tr><td style=\"padding:8px 0;color:#5a6875\">M-Pesa receipt</td><td style=\"padding:8px 0;text-align:right;font-weight:600\">$receipt</td></tr>" : '') . "
      </table>
      $codeBlock
      <p style=\"margin-top:28px;font-size:12px;color:#5a6875\">Jabali Chorale · Nairobi, Kenya</p>
    </div>";
}

// True when PHP can actually send mail here. Shared hosts often put mail() in
// disable_functions; in PHP 8 calling a disabled function throws an Error, which
// `@` does not suppress — so it has to be checked, not attempted.
function mailer_available(): bool
{
    if (!function_exists('mail')) return false;

    $disabled = array_map('trim', explode(',', (string) ini_get('disable_functions')));
    return !in_array('mail', $disabled, true);
}

// SMTP credentials, when the operator has configured them. config.php files
// written before SMTP existed have no 'smtp' key, so every read goes through
// here — touching MAIL['smtp'] directly would be a fatal undefined-key error on
// exactly the servers this feature exists to rescue.
function smtp_config(): array
{
    $cfg = (defined('MAIL') && isset(MAIL['smtp'])) ? (array) MAIL['smtp'] : [];

    return $cfg + [
        'host'   => '',
        'port'   => 587,
        'user'   => '',
        'pass'   => '',
        'secure' => 'tls',   // 'tls' = STARTTLS on 587, 'ssl' = implicit on 465
    ];
}

function smtp_configured(): bool
{
    $c = smtp_config();
    return $c['host'] !== '' && $c['user'] !== '';
}

// RFC 2047. An event title with a curly apostrophe or an accent is not valid in
// a raw header, and lands as mojibake in the buyer's inbox.
function mime_header_encode(string $s): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $s)) return $s;

    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

// Reads one complete SMTP reply. Replies can span several lines ("250-SIZE",
// "250-AUTH", "250 HELP"); only the line with a space in the 4th position ends
// it, so stopping at the first newline would desynchronise the conversation.
function smtp_read($fh): string
{
    $out = '';
    while (($line = fgets($fh, 1024)) !== false) {
        $out .= $line;
        if (strlen($line) < 4 || $line[3] !== '-') break;
    }
    return $out;
}

// Sends a command (or just reads, when $cmd is null) and requires a reply code.
// Throws so smtp_send() can report which stage failed and what the server said —
// "authentication failed" is actionable, "email not sent" is not.
function smtp_cmd($fh, ?string $cmd, string $expect, string $stage): string
{
    if ($cmd !== null) {
        fwrite($fh, $cmd . "\r\n");
    }

    $reply = smtp_read($fh);
    if (strncmp($reply, $expect, strlen($expect)) !== 0) {
        throw new RuntimeException($stage . ': expected ' . $expect . ', got ' . trim($reply));
    }
    return $reply;
}

// Builds the message once so both transports send byte-identical mail.
// Returns ['subject' => ..., 'headers' => [...], 'body' => ...]. To and Bcc are
// deliberately absent: mail() takes the recipient as an argument, and over SMTP
// a Bcc must travel as an envelope recipient only — putting it in the headers
// shows every blind copy to the buyer.
function order_mime(array $order, ?string $pdf = null): array
{
    $isTicket = ($order['itemType'] ?? 'ticket') !== 'merch';
    $subject = ($isTicket ? 'Your tickets — ' : 'Your order — ') . ($order['eventTitle'] ?? 'Jabali Chorale');

    $boundary = 'jc_' . bin2hex(random_bytes(10));

    $headers = [
        'From: ' . mime_header_encode(MAIL['from_name']) . ' <' . MAIL['from_email'] . '>',
        'Reply-To: ' . MAIL['from_email'],
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
    ];

    // The HTML part is base64 rather than 8bit. SMTP refuses lines longer than
    // 1000 octets, and one inline-styled paragraph here is already past that —
    // base64 with chunk_split guarantees 76-character lines.
    $body  = "--$boundary\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode(order_email_html($order))) . "\r\n";

    if ($pdf !== null) {
        $filename = 'jabali-ticket-' . ($order['ticketCode'] ?? 'ticket') . '.pdf';
        $body .= "--$boundary\r\n";
        $body .= "Content-Type: application/pdf; name=\"$filename\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n";
        $body .= "Content-Disposition: attachment; filename=\"$filename\"\r\n\r\n";
        $body .= chunk_split(base64_encode($pdf)) . "\r\n";
    }
    $body .= "--$boundary--";

    return ['subject' => $subject, 'headers' => $headers, 'body' => $body];
}

// Minimal SMTP client, used when the host disables mail(). Sockets are not in
// disable_functions, so this speaks to the mail server directly rather than
// pulling in a library that would have to be vendored and FTP'd alongside.
// Never throws: fulfilment must not unwind because a confirmation bounced.
function smtp_send(string $to, string $subject, array $headers, string $body, array $context = []): bool
{
    $c = smtp_config();
    $fh = null;

    try {
        $transport = ($c['secure'] === 'ssl' ? 'ssl://' : 'tcp://') . $c['host'] . ':' . (int) $c['port'];

        $fh = @stream_socket_client($transport, $errno, $errstr, 20);
        if (!$fh) {
            throw new RuntimeException('connect: ' . ($errstr ?: 'no route') . ' (' . $errno . ')');
        }
        stream_set_timeout($fh, 20);

        // The EHLO name should be a domain we own; the sender's is the one the
        // receiving server can actually verify against SPF.
        $ehlo = substr(strrchr(MAIL['from_email'], '@') ?: '@localhost', 1);

        smtp_cmd($fh, null, '220', 'greeting');
        smtp_cmd($fh, 'EHLO ' . $ehlo, '250', 'ehlo');

        if ($c['secure'] === 'tls') {
            smtp_cmd($fh, 'STARTTLS', '220', 'starttls');
            if (!@stream_socket_enable_crypto($fh, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('starttls: handshake failed');
            }
            // Capabilities are renegotiated after the upgrade, so EHLO repeats.
            smtp_cmd($fh, 'EHLO ' . $ehlo, '250', 'ehlo-tls');
        }

        smtp_cmd($fh, 'AUTH LOGIN', '334', 'auth');
        smtp_cmd($fh, base64_encode((string) $c['user']), '334', 'auth-user');
        smtp_cmd($fh, base64_encode((string) $c['pass']), '235', 'auth-pass');

        smtp_cmd($fh, 'MAIL FROM:<' . MAIL['from_email'] . '>', '250', 'mail-from');

        $rcpts = [$to];
        if (!empty(MAIL['bcc'])) $rcpts[] = MAIL['bcc'];
        foreach ($rcpts as $rcpt) {
            smtp_cmd($fh, 'RCPT TO:<' . $rcpt . '>', '250', 'rcpt');
        }

        smtp_cmd($fh, 'DATA', '354', 'data');

        $message = implode("\r\n", array_merge($headers, [
            'To: ' . $to,
            'Subject: ' . mime_header_encode($subject),
            'Date: ' . date('r'),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $ehlo . '>',
        ])) . "\r\n\r\n" . $body;

        // Normalise to CRLF, then dot-stuff: a line consisting of a single dot
        // ends DATA, so any line starting with one must be doubled or the
        // message is truncated at that point.
        $message = preg_replace('/\r\n|\r|\n/', "\r\n", $message);
        $message = preg_replace('/^\./m', '..', $message);

        fwrite($fh, $message . "\r\n.\r\n");
        smtp_cmd($fh, null, '250', 'send');

        @fwrite($fh, "QUIT\r\n");
        fclose($fh);
        return true;

    } catch (Throwable $e) {
        if (is_resource($fh)) @fclose($fh);

        log_error('SMTP delivery failed — confirmation not sent', $context + [
            'to'     => $to,
            'reason' => $e->getMessage(),
            'host'   => $c['host'] . ':' . $c['port'] . ' (' . $c['secure'] . ')',
        ]);
        return false;
    }
}

// Returns true if the message was accepted for delivery by the server.
function send_order_email(array $order, ?string $pdf = null): bool
{
    $to = $order['customer']['email'] ?? '';
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        log_warn('No valid email on the order, nothing sent', [
            'orderId' => $order['id'] ?? null,
        ]);
        return false;
    }

    $mime = order_mime($order, $pdf);
    $context = ['orderId' => $order['id'] ?? null];

    // SMTP wins when configured, even where mail() works: it authenticates, so
    // the message is far likelier to survive SPF/DKIM checks than one handed to
    // a shared host's local sendmail.
    if (smtp_configured()) {
        return smtp_send($to, $mime['subject'], $mime['headers'], $mime['body'], $context);
    }

    if (!mailer_available()) {
        log_error('No mail transport available — set MAIL[\'smtp\'] in config.php', $context + [
            'to'       => $to,
            'disabled' => ini_get('disable_functions'),
        ]);
        return false;
    }

    $headers = $mime['headers'];
    if (!empty(MAIL['bcc'])) $headers[] = 'Bcc: ' . MAIL['bcc'];

    // The 5th parameter is deliberately omitted: passing -f requires the sender
    // to be a trusted user on many hosts and errors out otherwise.
    $sent = @mail($to, $mime['subject'], $mime['body'], implode("\r\n", $headers));

    if (!$sent) {
        // mail() gives no reason of its own; the last PHP error is the best
        // clue available, and without it a silent non-delivery is untraceable.
        $last = error_get_last();
        log_error('mail() refused the message', $context + [
            'to'     => $to,
            'reason' => $last['message'] ?? 'no reason reported',
            'from'   => MAIL['from_email'] ?? null,
        ]);
    }

    return $sent;
}
