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

// Returns true if the message was accepted for delivery by the server.
function send_order_email(array $order, ?string $pdf = null): bool
{
    $to = $order['customer']['email'] ?? '';
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;

    $isTicket = ($order['itemType'] ?? 'ticket') !== 'merch';
    $subject = ($isTicket ? 'Your tickets — ' : 'Your order — ') . ($order['eventTitle'] ?? 'Jabali Chorale');
    $html = order_email_html($order);

    $boundary = 'jc_' . bin2hex(random_bytes(10));
    $from = MAIL['from_name'] . ' <' . MAIL['from_email'] . '>';

    $headers = [];
    $headers[] = 'From: ' . $from;
    $headers[] = 'Reply-To: ' . MAIL['from_email'];
    if (!empty(MAIL['bcc'])) $headers[] = 'Bcc: ' . MAIL['bcc'];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';

    $body  = "--$boundary\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $html . "\r\n";

    if ($pdf !== null) {
        $filename = 'jabali-ticket-' . ($order['ticketCode'] ?? 'ticket') . '.pdf';
        $body .= "--$boundary\r\n";
        $body .= "Content-Type: application/pdf; name=\"$filename\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n";
        $body .= "Content-Disposition: attachment; filename=\"$filename\"\r\n\r\n";
        $body .= chunk_split(base64_encode($pdf)) . "\r\n";
    }
    $body .= "--$boundary--";

    return @mail($to, $subject, $body, implode("\r\n", $headers));
}
