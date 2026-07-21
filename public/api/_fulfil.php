<?php
// Runs once when an order settles as paid: generate the e-ticket (tickets only)
// and email the buyer their confirmation. Idempotent via the `emailed` flag.

declare(strict_types=1);

require_once __DIR__ . '/_ticket.php';
require_once __DIR__ . '/_mailer.php';

function fulfil_order(array &$order): void
{
    if (!empty($order['emailed'])) return;                 // already done
    if (($order['status'] ?? '') !== 'success') return;    // only paid orders

    $pdf = (($order['itemType'] ?? 'ticket') === 'merch') ? null : pdf_ticket($order);

    // Mark as emailed regardless of the mail server's mood — one attempt, so a
    // flaky mailer can't trigger repeated sends on every status poll.
    $order['emailed'] = true;
    $order['emailedAt'] = date('c');
    $order['emailOk'] = send_order_email($order, $pdf);
}
