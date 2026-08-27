<?php
// Orders / sales — admin only.
//   GET  orders.php              → all orders, newest first
//   POST orders.php?reconcile=1  → re-query every unsettled order against Daraja
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_orders.php';
require __DIR__ . '/_c2b.php';

route([
    'GET' => function () {
        require_admin();

        $orders = store_read('orders', []);
        // Newest first.
        usort($orders, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));

        $paid = array_filter($orders, fn($o) => ($o['status'] ?? '') === 'success');
        $revenue = array_sum(array_map(fn($o) => (int) ($o['amount'] ?? 0), $paid));
        // Replay is idempotent and repairs any callback that reached the durable
        // inbox while the materialised payment store was temporarily broken.
        $replay = c2b_replay_inbox();
        if ($replay['added'] > 0) {
            log_warn('C2B inbox replay recovered deferred payments', $replay);
        }
        if (!empty($replay['errors'])) {
            log_error('C2B inbox replay still has persistence errors', $replay);
        }
        if (!empty($replay['conflicts'])) {
            log_error('C2B inbox replay found conflicting receipt data', $replay);
        }
        $directPayments = c2b_direct_payments(c2b_read_payments_resilient(), $orders);
        $directRecords = array_map('c2b_admin_record', $directPayments);
        $records = array_merge($orders, $directRecords);
        usort($records, fn($a, $b) =>
            (strtotime((string) ($b['createdAt'] ?? '')) ?: 0)
            <=> (strtotime((string) ($a['createdAt'] ?? '')) ?: 0)
        );
        $directAmount = (float) array_sum(array_map(
            fn($payment) => (float) ($payment['amount'] ?? 0),
            $directPayments
        ));

        json_out([
            // Direct PayBill payments are order-like records for the admin
            // table, while stats.total remains the number of actual orders.
            'orders' => array_values($records),
            'stats'  => [
                'total'           => count($orders),
                'paid'            => count($paid),
                'revenue'         => $revenue,
                'direct'          => count($directPayments),
                'directAmount'    => $directAmount,
                'c2bNeedsReview'  => $replay['invalid']
                    + count($replay['errors'])
                    + count($replay['conflicts']),
            ],
        ]);
    },

    // Re-query every unsettled order against Daraja. This is the recovery path
    // for orders that status polling wrongly marked failed while the customer
    // was still paying — those had their money taken but never got an e-ticket.
    'POST' => function () {
        require_admin();
        require_csrf();

        // Re-send one buyer's confirmation. Separate from reconcile: that asks
        // Daraja whether money arrived, this only re-delivers a message for an
        // order already known to be paid.
        if (!empty($_GET['resend'])) {
            $id = (string) $_GET['resend'];
            $orders = store_read('orders', []);

            $idx = null;
            foreach ($orders as $i => $o) {
                if (($o['id'] ?? '') === $id) { $idx = $i; break; }
            }
            if ($idx === null) {
                error_out('Order not found.', 404);
            }
            if (($orders[$idx]['status'] ?? '') !== 'success') {
                error_out('Only a paid order can be confirmed.', 400);
            }

            $ok = resend_confirmation($orders[$idx]);

            // Persist either way: the attempt, its count and any error belong in
            // the record even when delivery failed, otherwise the admin screen
            // keeps showing a stale result.
            store_write('orders', $orders);

            log_info('Confirmation re-sent by admin', [
                'orderId' => $id,
                'to'      => $orders[$idx]['customer']['email'] ?? null,
                'ok'      => $ok,
                'attempt' => $orders[$idx]['resendCount'] ?? 1,
            ]);

            // 200 with ok:false rather than an error status — the request was
            // handled correctly, the mail server is what refused. The admin
            // screen needs the reason to display, not an exception.
            json_out([
                'ok'      => $ok,
                'emailOk' => $orders[$idx]['emailOk'] ?? false,
                'error'   => $orders[$idx]['emailError'] ?? null,
            ]);
        }

        if (empty($_GET['reconcile'])) {
            error_out('Nothing to do.', 400);
        }

        $orders = store_read('orders', []);
        $checked = 0;
        $recovered = 0;
        $settled = 0;
        $failedChecks = 0;

        foreach ($orders as $i => $order) {
            if (($order['status'] ?? '') === 'success') continue;
            if (empty($order['checkoutRequestId'])) continue;

            $was = $order['status'] ?? 'pending';
            $checked++;

            // Contain each order: one that blows up (an unreachable Daraja, a
            // mailer fault) must not abandon the whole run and throw away the
            // orders already confirmed paid in this loop.
            try {
                $orders[$i] = refresh_order_status($order, true);
            } catch (Throwable $e) {
                $failedChecks++;
                log_error('Reconcile failed for one order: ' . $e->getMessage(), [
                    'orderId' => $order['id'] ?? null,
                    'file'    => basename($e->getFile()),
                    'line'    => $e->getLine(),
                ]);
                continue;
            }

            $now = $orders[$i]['status'] ?? 'pending';
            if ($now !== $was) {
                $settled++;
                if ($was === 'failed' && $now === 'success') $recovered++;
            }
        }

        // Always persist whatever was resolved, even if some orders errored.
        store_write('orders', $orders);

        log_info('Reconcile run', [
            'checked'   => $checked,
            'settled'   => $settled,
            'recovered' => $recovered,
            'errored'   => $failedChecks,
        ]);

        json_out([
            'checked'   => $checked,
            'settled'   => $settled,
            'recovered' => $recovered,
            'errored'   => $failedChecks,
        ]);
    },
]);
