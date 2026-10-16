<?php
// Public checkout — M-Pesa STK Push for ticket packages and event merchandise.
//   POST tickets.php?quote=1        → verify pricing/promo without paying
//   POST tickets.php                → initiate a payment, returns { orderId }
//   GET  tickets.php?orderId=...    → poll payment status
//
// Public (no admin auth): it's a customer checkout. Prices are always taken from
// the stored event, never from the client.
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_mpesa.php';
require __DIR__ . '/_fulfil.php';
require __DIR__ . '/_orders.php';
require __DIR__ . '/_merch.php';
require __DIR__ . '/_payment_bypass.php';
require __DIR__ . '/_ticket_packages.php';
require __DIR__ . '/_ticket_groups.php';

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

// Merchandise added to a ticket order at checkout, so one M-Pesa prompt covers
// the whole basket.
//
// Priced exactly like the main item and under the same rule: the browser sends
// only which product, how many, and which variant — never a price, never a
// discount. Everything that decides the figure is read from the store here.
//
// Returns [lines, total, error]. Anything the buyer asked for that no longer
// exists is dropped rather than failing the order: they are mid-payment for
// tickets, and losing that to a t-shirt that went out of stock would be the
// worse outcome. The confirmation lists what was actually bought.
function resolve_addons(array $event, $sent): array
{
    if (!is_array($sent) || !$sent) return [[], 0, null];

    $available = merch_resolve_for_event($event);
    $byName = [];
    foreach ($available as $product) {
        $byName[(string) ($product['name'] ?? '')] = $product;
    }

    $lines = [];
    $total = 0;

    foreach ($sent as $row) {
        if (!is_array($row)) continue;

        $name = clean_string($row['name'] ?? '', 80);
        $product = $byName[$name] ?? null;
        if (!$product) continue;

        // An open-amount product is a donation with a buyer-named figure; it
        // has no place as a bolt-on line with a quantity.
        if (!empty($product['openAmount']['enabled'])) continue;

        $qty = max(1, min(20, (int) ($row['quantity'] ?? 1)));

        [$chosen, $delta, $err] = resolve_options($product, $row['options'] ?? []);
        if ($err) return [[], 0, $err];

        $unit = merch_unit_price($product) + $delta;
        if ($unit < 1) continue;

        $lineTotal = $unit * $qty;
        $total += $lineTotal;

        $lines[] = [
            'name'      => $product['name'],
            'quantity'  => $qty,
            'unitPrice' => $unit,
            'amount'    => $lineTotal,
            'options'   => $chosen,
        ];
    }

    return [$lines, $total, null];
}

// Find the event and the purchased item (ticket package or merch product).
//
// Merchandise is also sold on its own pages at /merch, with no event involved.
// That case is resolved straight from the catalogue and given a stand-in
// "event" so the order record, the confirmation email and the admin list all
// keep the single shape they already have. Crucially the ITEM still comes from
// the store, so pricing is derived exactly as it is for an event sale — a
// request cannot name its own price here either.
function find_event_and_item(string $slug, string $type, string $name): array
{
    if ($type === 'merch' && $slug === '') {
        foreach (merch_load() as $product) {
            if (($product['name'] ?? '') === $name) {
                return [[
                    'slug'   => '',
                    'title'  => 'Jabali Chorale Merchandise',
                    'date'   => '',
                    'venue'  => '',
                    'status' => 'upcoming',
                ], $product, null];
            }
        }
        return [null, null, 'That item is no longer available.'];
    }

    foreach (store_read('events', []) as $e) {
        if (($e['slug'] ?? '') !== $slug) continue;

        // Tickets can't be sold for a past event; merch can (souvenirs).
        if ($type === 'ticket' && ($e['status'] ?? '') === 'past') {
            return [null, null, 'This event has already passed.'];
        }

        // Resolved, not read raw: an event stores merchandise as catalogue ids,
        // so $e['merch'] holds only the legacy inline items. Reading it
        // directly would price catalogue products as "no longer available" and
        // fail every merch purchase.
        $list = $type === 'merch'
            ? merch_resolve_for_event($e)
            : ($e['packages'] ?? []);
        foreach ($list as $item) {
            if (($item['name'] ?? '') === $name) return [$e, $item, null];
        }
        return [null, null, 'That item is no longer available.'];
    }
    return [null, null, 'Event not found.'];
}

function public_order(array $order): array
{
    $public = [
        'orderId'    => $order['id'],
        'status'     => $order['status'],
        'amount'     => $order['amount'],
        'quantity'   => $order['quantity'],
        'packageQuantity'   => $order['packageQuantity'] ?? $order['quantity'],
        'ticketsPerPackage' => $order['ticketsPerPackage'] ?? 1,
        'packageType'       => $order['packageType'] ?? 'standard',
        'familyComposition' => $order['familyComposition'] ?? [],
        'itemType'   => $order['itemType'] ?? 'ticket',
        'itemName'   => $order['itemName'] ?? '',
        'eventTitle' => $order['eventTitle'] ?? '',
        'ticketCode' => $order['ticketCode'] ?? null,
        'receipt'    => $order['receipt'] ?? null,
        'message'    => $order['resultDesc'] ?? null,
        'options'    => $order['options'] ?? [],
        'addOns'     => $order['addOns'] ?? [],
        // How long this order has been waiting, so the checkout can word things
        // sensibly ("still waiting") instead of counting its own polls.
        'ageSeconds' => max(0, time() - strtotime($order['createdAt'] ?? 'now')),
    ];
    if (($order['packageType'] ?? '') === 'group' && !empty($order['groupToken'])) {
        $group = ticket_group_find((string) $order['groupToken']);
        if ($group) $public['group'] = ticket_group_public($group);
    }
    return $public;
}


route([
    // ----------------------------------------------------------- initiate
    'POST' => function () {
        $quoteOnly = ($_GET['quote'] ?? '') === '1';
        $in = read_json_body();

        $slug = clean_string($in['eventSlug'] ?? '', 120);
        $itemType = ($in['itemType'] ?? 'ticket') === 'merch' ? 'merch' : 'ticket';
        $itemName = clean_string($in['itemName'] ?? ($in['packageName'] ?? ''), 80);
        // For tickets this is the number of PACKAGE units selected. The final
        // admission quantity is derived from the stored package below, never
        // from a ticket count supplied by the browser.
        $purchaseQuantity = max(1, min(50, (int) ($in['quantity'] ?? 1)));

        $c = is_array($in['customer'] ?? null) ? $in['customer'] : [];
        $preferredName = clean_string($c['preferredName'] ?? '', 80);
        $otherNames = clean_string($c['otherNames'] ?? '', 120);
        $email = clean_string($c['email'] ?? '', 160);
        $contactPhone = clean_string($c['phone'] ?? '', 20);
        $promo = clean_string($in['promoCode'] ?? '', 40);
        $payPhone = mpesa_format_phone(clean_string($in['mpesaPhone'] ?? '', 20));

        // A quote needs only the pricing choices. Personal and M-Pesa details
        // are required only when the buyer actually starts a payment.
        if (!$quoteOnly) {
            if ($preferredName === '') error_out('Please enter your preferred name.', 422);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) error_out('Please enter a valid email.', 422);
            if ($payPhone === '') error_out('Please enter a valid M-Pesa phone number (e.g. 07XX XXX XXX).', 422);
        }

        [$event, $item, $err] = find_event_and_item($slug, $itemType, $itemName);
        if ($err) error_out($err, 404);

        $promoAllowed = $itemType === 'merch' || ticket_package_allows_promo($item);
        if (!$promoAllowed) $promo = '';

        $isFamily = $itemType === 'ticket' && ($item['type'] ?? 'standard') === 'family';
        $isGroup = $itemType === 'ticket' && ($item['type'] ?? 'standard') === 'group';
        if ($isFamily || $isGroup) $purchaseQuantity = 1;

        $groupToken = $isGroup ? strtolower(clean_string($in['groupToken'] ?? '', 32)) : '';
        $groupName = $isGroup ? clean_string($in['groupName'] ?? '', 80) : '';
        $groupCapacity = $isGroup ? normalise_ticket_count($item['ticketCount'] ?? 1) : 0;
        $groupMemberPrice = $isGroup ? shared_group_member_price($item) : 0;
        if ($isGroup && $groupMemberPrice < 1) {
            error_out('This shared group package is not configured correctly.', 422);
        }

        // An invite is bound to one immutable event/package/price combination.
        // Check it during the preview for a friendly early answer; the atomic
        // reservation immediately before M-Pesa remains the final authority.
        if ($isGroup && $groupToken !== '') {
            $joiningGroup = ticket_group_find($groupToken);
            if (!$joiningGroup) error_out('This group link is invalid or no longer available.', 404);
            if (
                ($joiningGroup['eventSlug'] ?? '') !== $slug
                || ($joiningGroup['packageName'] ?? '') !== $itemName
            ) {
                error_out('This group link belongs to a different ticket package.', 409);
            }
            if (
                (int) ($joiningGroup['capacity'] ?? 0) !== $groupCapacity
                || (int) ($joiningGroup['memberPrice'] ?? 0) !== $groupMemberPrice
            ) {
                error_out('This group package has changed. Please create a new group.', 409);
            }
            $joiningPublic = ticket_group_public($joiningGroup);
            if ($joiningPublic['closed']) error_out('This group has been closed by the administrator.', 409);
            if ($joiningPublic['full']) error_out('This group is full. Please create a new group.', 409);
        }

        // The checkout normally learns this as soon as it opens. Repeat the
        // check while quoting so a delayed/failed availability request still
        // cannot take a sixth creator as far as the payment screen. The locked
        // check in ticket_group_reserve() remains the final race-safe authority.
        if (
            $isGroup
            && $groupToken === ''
            && $quoteOnly
            && ticket_group_limit_reached($slug, $itemName)
        ) {
            error_out('There are already 5 open groups for this ticket. Please join one of them instead.', 409);
        }

        $ticketsPerPackage = $itemType === 'ticket' && !$isGroup
            ? normalise_ticket_count($item['ticketCount'] ?? 1)
            : 1;
        if (
            $itemType === 'ticket'
            && $purchaseQuantity > max_ticket_package_purchase_quantity($ticketsPerPackage)
        ) {
            error_out('Bundled ticket packages can only be purchased one at a time.', 422);
        }

        [$chosenOptions, $optionDelta, $optErr] = resolve_options($item, $in['options'] ?? []);
        if ($optErr) error_out($optErr, 422);

        $open = (array) ($item['openAmount'] ?? []);
        $isOpenAmount = !empty($open['enabled']);
        $familyComposition = [];
        $familyTicketMeta = [];

        if ($isFamily) {
            [$familyComposition, $familyTicketMeta, $subtotal, $familyErr] =
                resolve_family_composition($item, $in['family'] ?? []);
            if ($familyErr) error_out($familyErr, 422);

            $purchaseQuantity = 1;
            $ticketsPerPackage = count($familyTicketMeta);
            $unit = $subtotal;
        } elseif ($isGroup) {
            // Every checkout buys exactly the paying member's own admission.
            // The advertised package total and capacity stay on the group.
            $purchaseQuantity = 1;
            $ticketsPerPackage = 1;
            $unit = $groupMemberPrice;
            $subtotal = $unit;
        } elseif ($isOpenAmount) {
            // The buyer names the figure (a donation). Quantity is meaningless
            // here, so it's pinned to 1 and the amount is used as-is.
            $min = max(1, (int) ($open['min'] ?? 1));
            $unit = (int) ($in['amount'] ?? 0);
            if ($unit < $min) {
                error_out('Please enter an amount of at least KES ' . number_format($min) . '.', 422);
            }
            $purchaseQuantity = 1;
            $subtotal = $unit;
        } else {
            // A product's own discount is applied here, from the STORED
            // product — the same function the API uses to tell the site what
            // to show. If the two were computed separately, a buyer could see
            // one price on the page and have a different one taken from their
            // phone. Ticket packages have no such discount; theirs are promo
            // codes, applied to the subtotal below.
            $base = $itemType === 'merch'
                ? merch_unit_price($item)
                : price_to_int($item['price'] ?? '');

            $unit = $base + $optionDelta;
            if ($unit < 1) error_out('This item has no price set. Please contact us.', 422);
            $subtotal = $unit * $purchaseQuantity;
        }

        $quantity = $isFamily
            ? count($familyTicketMeta)
            : ($isGroup ? 1
            : ($itemType === 'ticket'
            ? ticket_admission_quantity($purchaseQuantity, $ticketsPerPackage)
            : $purchaseQuantity));
        if ($itemType === 'ticket' && $quantity > MAX_TICKETS_PER_ORDER) {
            error_out(
                'One order can contain at most ' . MAX_TICKETS_PER_ORDER
                . ' tickets. Please reduce the number of packages.',
                422
            );
        }

        // Merchandise the buyer added on the way to payment, so one prompt
        // covers the lot.
        [$addOns, $addOnTotal, $addOnErr] = resolve_addons($event, $in['addOns'] ?? []);
        if ($addOnErr) error_out($addOnErr, 422);

        // Merchandise has its own codes; an event's belong to its tickets.
        // Keeping them apart means a concert discount can't come off a hoodie,
        // and a merch discount can't be spent on a ticket. Config's site-wide
        // PROMO_CODES still backs both (see apply_promo).
        $codeList = $itemType === 'merch'
            ? merch_promo_codes()
            : ($event['promoCodes'] ?? []);

        // The code discounts the item it belongs to, not the whole basket: a
        // ticket promo shouldn't quietly take money off the shirts added
        // alongside it. Add-ons already carry their own product discounts.
        [$discounted, $promoApplied] = apply_promo($subtotal, $promo, $codeList);
        $amount = $discounted + $addOnTotal;

        // Return a server-authoritative preview before M-Pesa is contacted.
        // This lets the confirmation screen state the actual discounted amount
        // and lets an unrecognised code fail visibly instead of being ignored.
        if ($quoteOnly) {
            json_out([
                'subtotal'      => $subtotal,
                'itemAmount'    => $discounted,
                'discountAmount'=> max(0, $subtotal - $discounted),
                'addOnAmount'   => $addOnTotal,
                'amount'        => $amount,
                'promoApplied'  => $promoApplied,
                'promoCode'     => $promo,
                'quantity'      => $quantity,
                'familyComposition' => $familyComposition,
                'group'          => $isGroup && $groupToken !== '' ? $joiningPublic : null,
            ]);
        }

        // Do not fall back to the full price if a code expired or was removed
        // between the preview and the Pay click.
        if ($promo !== '' && !$promoApplied) {
            error_out('That promo code was not recognised. Please check it and try again.', 422);
        }

        // A rule or catalogue price can also change between those two clicks.
        // The client-provided figure never sets the price; it is only an
        // optimistic lock that makes us stop instead of prompting for a total
        // different from the one the buyer just reviewed.
        if (isset($in['expectedAmount']) && (int) $in['expectedAmount'] !== $amount) {
            error_out('The price changed before payment. Please go back and review the updated total.', 409);
        }

        $bypassPayment = payment_bypass_authorized();
        if (!$bypassPayment && !mpesa_configured()) {
            error_out('Online payment is not set up yet. Please contact us to book.', 503);
        }

        $reservedGroup = null;
        $reservedSlot = null;
        if ($isGroup) {
            [$reservedGroup, $reservedSlot] = ticket_group_reserve(
                $groupToken,
                $groupName,
                $slug,
                $itemName,
                $groupCapacity,
                $groupMemberPrice,
                trim($preferredName . ' ' . $otherNames)
            );
            $groupToken = (string) $reservedGroup['token'];
            $groupName = (string) $reservedGroup['name'];
        }

        // A unique PayBill account reference is the second reconciliation key.
        // The M-Pesa receipt remains primary; this links a C2B confirmation to
        // its order when the separate STK callback containing that receipt is
        // delayed or lost. JC + five random bytes is exactly Daraja's 12 chars.
        $paymentReference = 'JC' . strtoupper(bin2hex(random_bytes(5)));
        $orderId = bin2hex(random_bytes(12));
        if ($bypassPayment) {
            $ok = true;
            $res = [
                'CheckoutRequestID' => 'DEV-' . strtoupper(bin2hex(random_bytes(6))),
                'MerchantRequestID' => 'DEV-BYPASS',
            ];
        } else {
            [$ok, $res] = mpesa_stk_push(
                $amount,
                $payPhone,
                $paymentReference,
                ($itemType === 'merch' ? 'Merch ' : 'Tickets ') . $itemName
            );
        }

        if (!$ok) {
            if ($reservedGroup && $reservedSlot) {
                ticket_group_release($groupToken, (string) $reservedSlot['id']);
            }
            error_out($res['error'] ?? 'Could not start the payment. Please try again.', 502);
        }

        // Read before minting: the code must be checked against every code
        // already issued, and this same array is what gets written back below.
        $orders = store_read(STORE, []);
        $ticketCodes = $itemType === 'ticket'
            ? mint_ticket_codes($orders, $quantity)
            : [mint_ticket_code($orders)];
        $ticketRows = [];
        if ($itemType === 'ticket') {
            foreach ($ticketCodes as $index => $code) {
                $ticketRows[] = array_merge(
                    ['code' => $code, 'admittedAt' => null],
                    $familyTicketMeta[$index] ?? []
                );
            }
        }

        $order = [
            'id'                => $orderId,
            // ticketCode remains as the primary reference for older admin
            // screens and integrations. `tickets` is the source of truth for
            // independent entry verification on newly issued orders.
            'ticketCode'        => $ticketCodes[0],
            'tickets'           => $itemType === 'ticket'
                ? $ticketRows
                : [],
            'createdAt'         => date('c'),
            'status'            => $bypassPayment ? 'success' : 'pending',
            'eventSlug'         => $slug,
            'eventTitle'        => $event['title'],
            'eventDate'         => $event['date'] ?? '',
            'eventVenue'        => $event['venue'] ?? '',
            'itemType'          => $itemType,
            'itemName'          => $itemName,
            'packageType'       => $isFamily ? 'family' : ($isGroup ? 'group' : 'standard'),
            'unitPrice'         => $unit,
            'options'           => $chosenOptions,   // shown in admin + on the e-ticket
            'openAmount'        => $isOpenAmount,
            // `quantity` is the total number of independently issued ticket
            // admissions. These fields retain how that number was calculated
            // and keep pricing auditable for bundled packages.
            'packageQuantity'   => $purchaseQuantity,
            'ticketsPerPackage' => $ticketsPerPackage,
            'quantity'          => $quantity,
            'familyComposition' => $familyComposition,
            'groupToken'        => $isGroup ? $groupToken : null,
            'groupName'         => $isGroup ? $groupName : null,
            'groupCapacity'     => $isGroup ? $groupCapacity : null,
            // The main item's share, so the add-on lines and the total can
            // always be reconciled against each other after the fact.
            'itemAmount'        => $discounted,
            'addOns'            => $addOns,
            'addOnAmount'       => $addOnTotal,
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
            'paymentReference'  => $paymentReference,
            'receipt'           => $bypassPayment ? 'DEV-BYPASS-' . strtoupper(bin2hex(random_bytes(4))) : null,
            'resultDesc'        => $bypassPayment ? 'Payment bypassed for local development.' : null,
            // Synthetic purchases must not send messages to real addresses.
            'emailed'           => $bypassPayment,
            'emailOk'           => $bypassPayment ? true : null,
            'paidAt'            => $bypassPayment ? date('c') : null,
            'settledBy'         => $bypassPayment ? 'dev-bypass' : null,
            'paymentBypassed'   => $bypassPayment,
            'lastQueryAt'       => 0,
        ];

        store_append(STORE, $order);
        if ($reservedSlot) {
            ticket_group_attach_order($groupToken, (string) $reservedSlot['id'], $orderId);
        }

        json_out(public_order($order), 201);
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
