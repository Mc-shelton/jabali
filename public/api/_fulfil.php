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

    // Mark as attempted BEFORE trying — one attempt only, so a flaky mailer
    // can't trigger repeated sends on every status poll.
    $order['emailed'] = true;
    $order['emailedAt'] = date('c');

    // Fulfilment is a side effect of a payment that has already happened. It
    // must never be able to undo one: an exception escaping this function
    // unwinds the caller before it saves, so a paid order would be written back
    // as unpaid — the mail server deciding whether the money counts.
    //
    // So everything here is contained, recorded, and reported as a flag.
    try {
        $pdf = (($order['itemType'] ?? 'ticket') === 'merch') ? null : pdf_ticket($order);
        $order['emailOk'] = send_order_email($order, $pdf);

        if (!$order['emailOk']) {
            log_warn('Confirmation email not sent', [
                'orderId' => $order['id'] ?? null,
                'to'      => $order['customer']['email'] ?? null,
            ]);
        }
    } catch (Throwable $e) {
        $order['emailOk'] = false;
        $order['emailError'] = $e->getMessage();
        log_error('Fulfilment failed but the payment stands: ' . $e->getMessage(), [
            'orderId' => $order['id'] ?? null,
            'file'    => basename($e->getFile()),
            'line'    => $e->getLine(),
        ]);
    }
}
