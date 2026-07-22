<?php
// Public checkout — M-Pesa STK Push for ticket packages and event merchandise.
//   POST tickets.php                → initiate a payment, returns { orderId }
//   GET  tickets.php?orderId=...    → poll payment status
//
// Public (no admin auth): it's a customer checkout. Prices are always taken from
// the stored event, never from the client.
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_mpesa.php';
require __DIR__ . '/_fulfil.php';
require __DIR__ . '/_orders.php';

const STORE = 'orders';

function price_to_int($price): int
{
    return (int) preg_replace('/[^0-9]/', '', (string) $price);
}

// Match the buyer's choices against the item's declared options.
//
// Everything is resolved from the STORED item: the browser sends only which
// option and which label it picked, never a price. Returns
// [chosen[], deltaTotal, error] where chosen is [{name, choice, priceDelta}].
function resolve_options(array $item, $sent): array
{
    $declared = (array) ($item['options'] ?? []);
    if (!$declared) return [[], 0, null];

    // Index what the buyer sent, by option name.
    $picked = [];
    foreach ((array) $sent as $row) {
        if (!is_array($row)) continue;
        $picked[clean_string($row['name'] ?? '', 40)] = clean_string($row['choice'] ?? '', 60);
    }

    $chosen = [];
    $delta = 0;

    foreach ($declared as $opt) {
        $name = $opt['name'] ?? '';
        $choiceLabel = $picked[$name] ?? '';

        if ($choiceLabel === '') {
            if (!empty($opt['required'])) {
                return [[], 0, "Please choose a $name."];
            }
            continue;
        }

        $match = null;
        foreach ((array) ($opt['choices'] ?? []) as $c) {
            if (($c['label'] ?? '') === $choiceLabel) {
                $match = $c;
                break;
            }
        }
        if ($match === null) {
            return [[], 0, "\"$choiceLabel\" is not an available $name."];
        }

        $delta += (int) ($match['priceDelta'] ?? 0);
        $chosen[] = [
            'name'       => $name,
            'choice'     => $match['label'],
            'priceDelta' => (int) ($match['priceDelta'] ?? 0),
        ];
    }

    return [$chosen, $delta, null];
}

// Apply a promo code. Looks in the event's own codes first, then the optional
// site-wide PROMO_CODES in config as a fallback.
function apply_promo(int $amount, string $code, array $eventCodes): array
{
    $key = strtoupper(trim($code));
    if ($key === '') return [$amount, false];

    $rule = null;
    foreach ($eventCodes as $c) {
        if (strtoupper($c['code'] ?? '') === $key) {
            $rule = $c;
            break;
        }
    }
    if (!$rule && isset(PROMO_CODES[$key])) {
        $rule = PROMO_CODES[$key];
    }
    if (!$rule) return [$amount, false];

    $discounted = ($rule['type'] ?? 'percent') === 'percent'
        ? (int) round($amount * (1 - $rule['value'] / 100))
        : $amount - (int) $rule['value'];
    return [max(1, $discounted), true];
}

// Find the event and the purchased item (ticket package or merch product).
function find_event_and_item(string $slug, string $type, string $name): array
{
    foreach (store_read('events', []) as $e) {
        if (($e['slug'] ?? '') !== $slug) continue;

        // Tickets can't be sold for a past event; merch can (souvenirs).
        if ($type === 'ticket' && ($e['status'] ?? '') === 'past') {
            return [null, null, 'This event has already passed.'];
        }

        $list = $type === 'merch' ? ($e['merch'] ?? []) : ($e['packages'] ?? []);
        foreach ($list as $item) {
            if (($item['name'] ?? '') === $name) return [$e, $item, null];
        }
        return [null, null, 'That item is no longer available.'];
    }
    return [null, null, 'Event not found.'];
}

function public_order(array $order): array
{
    return [
        'orderId'    => $order['id'],
        'status'     => $order['status'],
        'amount'     => $order['amount'],
        'quantity'   => $order['quantity'],
        'itemType'   => $order['itemType'] ?? 'ticket',
        'itemName'   => $order['itemName'] ?? '',
        'eventTitle' => $order['eventTitle'] ?? '',
        'ticketCode' => $order['ticketCode'] ?? null,
        'receipt'    => $order['receipt'] ?? null,
        'message'    => $order['resultDesc'] ?? null,
        'options'    => $order['options'] ?? [],
        // How long this order has been waiting, so the checkout can word things
        // sensibly ("still waiting") instead of counting its own polls.
        'ageSeconds' => max(0, time() - strtotime($order['createdAt'] ?? 'now')),
    ];
}


route([
    // ----------------------------------------------------------- initiate
    'POST' => function () {
        if (!mpesa_configured()) {
            error_out('Online payment is not set up yet. Please contact us to book.', 503);
        }

        $in = read_json_body();

        $slug = clean_string($in['eventSlug'] ?? '', 120);
        $itemType = ($in['itemType'] ?? 'ticket') === 'merch' ? 'merch' : 'ticket';
        $itemName = clean_string($in['itemName'] ?? ($in['packageName'] ?? ''), 80);
        $quantity = max(1, min(50, (int) ($in['quantity'] ?? 1)));

        $c = is_array($in['customer'] ?? null) ? $in['customer'] : [];
        $preferredName = clean_string($c['preferredName'] ?? '', 80);
        $otherNames = clean_string($c['otherNames'] ?? '', 120);
        $email = clean_string($c['email'] ?? '', 160);
        $contactPhone = clean_string($c['phone'] ?? '', 20);
        $promo = clean_string($in['promoCode'] ?? '', 40);
        $payPhone = mpesa_format_phone(clean_string($in['mpesaPhone'] ?? '', 20));

        if ($preferredName === '') error_out('Please enter your preferred name.', 422);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) error_out('Please enter a valid email.', 422);
        if ($payPhone === '') error_out('Please enter a valid M-Pesa phone number (e.g. 07XX XXX XXX).', 422);

        [$event, $item, $err] = find_event_and_item($slug, $itemType, $itemName);
        if ($err) error_out($err, 404);

        [$chosenOptions, $optionDelta, $optErr] = resolve_options($item, $in['options'] ?? []);
        if ($optErr) error_out($optErr, 422);

        $open = (array) ($item['openAmount'] ?? []);
        $isOpenAmount = !empty($open['enabled']);

        if ($isOpenAmount) {
            // The buyer names the figure (a donation). Quantity is meaningless
            // here, so it's pinned to 1 and the amount is used as-is.
            $min = max(1, (int) ($open['min'] ?? 1));
            $unit = (int) ($in['amount'] ?? 0);
            if ($unit < $min) {
                error_out('Please enter an amount of at least KES ' . number_format($min) . '.', 422);
            }
            $quantity = 1;
            $subtotal = $unit;
        } else {
            $unit = price_to_int($item['price'] ?? '') + $optionDelta;
            if ($unit < 1) error_out('This item has no price set. Please contact us.', 422);
            $subtotal = $unit * $quantity;
        }

        [$amount] = apply_promo($subtotal, $promo, $event['promoCodes'] ?? []);

        $reference = mb_substr(preg_replace('/[^A-Za-z0-9]/', '', $event['title']) ?: 'JabaliChorale', 0, 12);
        [$ok, $res] = mpesa_stk_push($amount, $payPhone, $reference, ($itemType === 'merch' ? 'Merch ' : 'Tickets ') . $itemName);

        if (!$ok) {
            error_out($res['error'] ?? 'Could not start the payment. Please try again.', 502);
        }

        // Read before minting: the code must be checked against every code
        // already issued, and this same array is what gets written back below.
        $orders = store_read(STORE, []);

        $order = [
            'id'                => bin2hex(random_bytes(12)),
            'ticketCode'        => mint_ticket_code($orders),
            'createdAt'         => date('c'),
            'status'            => 'pending',
            'eventSlug'         => $slug,
            'eventTitle'        => $event['title'],
            'eventDate'         => $event['date'] ?? '',
            'eventVenue'        => $event['venue'] ?? '',
            'itemType'          => $itemType,
            'itemName'          => $itemName,
            'unitPrice'         => $unit,
            'options'           => $chosenOptions,   // shown in admin + on the e-ticket
            'openAmount'        => $isOpenAmount,
            'quantity'          => $quantity,
            'amount'            => $amount,
            'promoCode'         => $promo,
            'customer'          => [
                'preferredName' => $preferredName,
                'otherNames'    => $otherNames,
                'email'         => $email,
                'phone'         => $contactPhone,
            ],
            'mpesaPhone'        => $payPhone,
            'checkoutRequestId' => $res['CheckoutRequestID'] ?? '',
            'merchantRequestId' => $res['MerchantRequestID'] ?? '',
            'receipt'           => null,
            'resultDesc'        => null,
            'emailed'           => false,
            'lastQueryAt'       => 0,
        ];

        $orders[] = $order;
        store_write(STORE, $orders);

        json_out(['orderId' => $order['id'], 'status' => 'pending', 'amount' => $amount], 201);
    },

    // ----------------------------------------------------------- status
    // GET tickets.php?orderId=...        → poll (rate limited)
    // GET tickets.php?orderId=...&force=1 → the customer pressed Refresh
    //
    // A `failed` order is deliberately still re-queried: polling can mark an
    // order failed while the customer is simply slow, and a later query or
    // callback must be able to put that right.
    'GET' => function () {
        $id = $_GET['orderId'] ?? '';
        $force = !empty($_GET['force']);
        $orders = store_read(STORE, []);

        foreach ($orders as $i => $order) {
            if ($order['id'] !== $id) continue;

            $before = $order;
            $orders[$i] = refresh_order_status($order, $force);
            if ($orders[$i] !== $before) {
                store_write(STORE, $orders);
            }

            json_out(public_order($orders[$i]));
        }

        error_out('Order not found.', 404);
    },
]);
