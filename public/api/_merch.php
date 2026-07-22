<?php
// The merchandise catalogue.
//
// Products used to be defined inside each event, which meant the same T-shirt
// was re-typed — name, price, sizes, colours, price deltas — for every event it
// was sold at, and correcting a price meant finding every copy. They now live
// once here, and an event holds a list of product ids.
//
// The shape a product resolves to is byte-identical to the old inline one. That
// is deliberate and load-bearing: tickets.php prices an order from the stored
// item it finds on the event, so as long as events still *present* a `merch`
// array of the same shape, the entire checkout and payment path is untouched by
// this change.

declare(strict_types=1);

const MERCH_STORE = 'merch';

// The store holds { products, promoCodes }. A bare array is also accepted and
// read as products: it costs three lines here and means a hand-edited or
// half-written merch.json can never present as an empty catalogue.
function merch_store(): array
{
    $raw = store_read(MERCH_STORE, []);
    if (!is_array($raw)) return ['products' => [], 'promoCodes' => []];

    if (array_is_list($raw)) {
        return ['products' => $raw, 'promoCodes' => []];
    }

    return [
        'products'   => is_array($raw['products'] ?? null) ? array_values($raw['products']) : [],
        'promoCodes' => is_array($raw['promoCodes'] ?? null) ? array_values($raw['promoCodes']) : [],
    ];
}

function merch_load(): array
{
    return merch_store()['products'];
}

// Codes that apply to merchandise orders. Kept separate from an event's codes:
// a discount created for a concert's tickets should not silently come off a
// hoodie, and vice versa. tickets.php picks the list by what is being bought,
// and config's site-wide PROMO_CODES still applies to both as a fallback.
// Cleaned on read, not just on write. The write path already normalises, so
// this is about the cases that bypass it — a hand-edited merch.json, a file
// written by an older build, a partial write — where a malformed entry would
// otherwise reach the pricing code.
function merch_promo_codes(): array
{
    return merch_clean_promos(merch_store()['promoCodes']);
}

// Shared with events.php, which stores promo codes in the same shape.
function merch_clean_promos($raw): array
{
    $codes = [];
    foreach ((array) $raw as $pc) {
        if (!is_array($pc)) continue;
        $code = strtoupper(clean_string($pc['code'] ?? '', 40));
        $value = (int) ($pc['value'] ?? 0);
        if ($code === '' || $value <= 0) continue;
        $codes[] = [
            'code'  => $code,
            'type'  => ($pc['type'] ?? 'percent') === 'flat' ? 'flat' : 'percent',
            'value' => $value,
        ];
    }
    return $codes;
}

// A product id is a slug of its name, kept unique. Ids are generated once and
// preserved across saves, so renaming a product does NOT break the events
// pointing at it — which is the whole reason events reference ids rather than
// names.
function merch_unique_id(string $base, array $items, ?string $ignoreId = null): string
{
    $id = slugify($base);
    $taken = [];
    foreach ($items as $item) {
        $existing = $item['id'] ?? '';
        if ($existing !== '' && $existing !== $ignoreId) {
            $taken[$existing] = true;
        }
    }

    if (!isset($taken[$id])) return $id;

    $n = 2;
    while (isset($taken[$id . '-' . $n])) $n++;
    return $id . '-' . $n;
}

// Variant pickers: Size → S/M/L, each optionally carrying a price delta.
function merch_clean_options($raw): array
{
    $options = [];
    foreach ((array) $raw as $opt) {
        if (!is_array($opt)) continue;
        $optName = clean_string($opt['name'] ?? '', 40);
        if ($optName === '') continue;

        $choices = [];
        foreach ((array) ($opt['choices'] ?? []) as $choice) {
            if (!is_array($choice)) continue;
            $label = clean_string($choice['label'] ?? '', 60);
            if ($label === '') continue;
            $choices[] = [
                'label'      => $label,
                'priceDelta' => (int) ($choice['priceDelta'] ?? 0),
            ];
        }
        if (!$choices) continue;   // a picker with no choices is meaningless

        $options[] = [
            'name'     => $optName,
            'required' => !isset($opt['required']) || !empty($opt['required']),
            'choices'  => $choices,
        ];
    }
    return $options;
}

// Prices are stored as the admin typed them ("KES 1,200"), so every
// calculation starts by pulling the number back out.
function merch_price_int($price): int
{
    return (int) preg_replace('/[^0-9]/', '', (string) $price);
}

// A price reduction shown on the product itself, distinct from a promo code:
// this one needs no code and is advertised on the site.
function merch_clean_discount($raw): array
{
    $in = is_array($raw) ? $raw : [];
    $value = max(0, (int) ($in['value'] ?? 0));
    $type = ($in['type'] ?? 'percent') === 'flat' ? 'flat' : 'percent';

    // A percentage over 100 would price the item below zero.
    if ($type === 'percent') $value = min(100, $value);

    return [
        // Zero value is the same as no discount, and storing it as "enabled"
        // would put a "0% off" badge on the site — the exact thing we don't
        // want shown.
        'enabled' => !empty($in['enabled']) && $value > 0,
        'type'    => $type,
        'value'   => $value,
    ];
}

// THE price calculation for a product. One function, used by the checkout to
// charge and by the API to tell the site what to display — if these were ever
// two implementations they would drift, and the number on the page would stop
// matching the number taken from the buyer's phone.
//
// Returns [original, final, hasDiscount].
function merch_price_parts(array $product): array
{
    $original = merch_price_int($product['price'] ?? '');
    $discount = merch_clean_discount($product['discount'] ?? []);

    if (!$discount['enabled'] || $original < 1) {
        return [$original, $original, false];
    }

    $final = $discount['type'] === 'percent'
        ? (int) round($original * (1 - $discount['value'] / 100))
        : $original - $discount['value'];

    // Never free and never negative: a flat discount larger than the price
    // would otherwise invert the charge.
    $final = max(1, $final);

    return [$original, $final, $final < $original];
}

// What a buyer pays for one unit, before options and quantity.
function merch_unit_price(array $product): int
{
    return merch_price_parts($product)[1];
}

// The product fields as the public site and the checkout see them. Kept apart
// from the record so the same shape can be produced for a legacy inline item
// that has no id or timestamps.
function merch_public_fields(array $in): array
{
    $openIn = is_array($in['openAmount'] ?? null) ? $in['openAmount'] : [];

    return [
        'name'        => clean_string($in['name'] ?? '', 80),
        'price'       => clean_string($in['price'] ?? '', 40),
        'description' => clean_string($in['description'] ?? '', 300),
        'image'       => clean_string($in['image'] ?? '', 500),
        'openAmount'  => [
            'enabled' => !empty($openIn['enabled']),
            'min'     => max(1, (int) ($openIn['min'] ?? 1)),
        ],
        'discount'    => merch_clean_discount($in['discount'] ?? []),
        'options'     => merch_clean_options($in['options'] ?? []),
    ];
}

// Adds the computed price fields a client needs.
//
// Derived on read, never stored. Writing them to disk would mean a product
// saved before a pricing rule changed keeps answering with the old figure —
// and the shop would quote a price the checkout no longer charges. The stored
// record holds only what the admin typed; the arithmetic happens here, once,
// on the way out.
function merch_present(array $product): array
{
    [$original, $final, $hasDiscount] = merch_price_parts($product);

    $product['priceOriginal'] = $original;
    $product['priceFinal']    = $final;
    $product['hasDiscount']   = $hasDiscount;
    // Older records predate the field entirely.
    $product['discount']      = merch_clean_discount($product['discount'] ?? []);

    return $product;
}

function merch_present_all(array $products): array
{
    return array_map('merch_present', $products);
}

// True when there is nothing worth storing. An open-amount product legitimately
// has no fixed price (it's a donation), so price alone can't decide this.
function merch_is_empty(array $fields): bool
{
    return $fields['name'] === ''
        && $fields['price'] === ''
        && empty($fields['openAmount']['enabled']);
}

function merch_normalise(array $in, array $items, ?array $existing = null): array
{
    $fields = merch_public_fields($in);
    $now = date('c');

    return $fields + [
        'id' => $existing['id']
            ?? merch_unique_id($fields['name'] !== '' ? $fields['name'] : 'item', $items),
        'createdAt' => $existing['createdAt'] ?? $now,
        'updatedAt' => $now,
    ];
}

// Turns an event's `merchIds` into the full products the site renders.
//
// Two things it must tolerate, both of which happen in real data:
//   • an id pointing at a product that has since been deleted — skipped, rather
//     than rendering a nameless card or fataling;
//   • an event saved before the catalogue existed, whose products are still
//     inline. Those are passed through so the live site keeps selling them
//     until an admin imports them.
function merch_resolve_for_event(array $event, ?array $catalogue = null): array
{
    $catalogue ??= merch_load();

    $byId = [];
    foreach ($catalogue as $product) {
        if (!empty($product['id'])) $byId[$product['id']] = $product;
    }

    $out = [];
    $seen = [];

    foreach ((array) ($event['merchIds'] ?? []) as $id) {
        $id = (string) $id;
        if (!isset($byId[$id]) || isset($seen[$id])) continue;
        $seen[$id] = true;
        $out[] = merch_present($byId[$id]);
    }

    // Legacy inline products. Matched by name against what the ids already
    // resolved, so an event that has been half-migrated doesn't show the same
    // shirt twice.
    $names = [];
    foreach ($out as $product) {
        $names[mb_strtolower($product['name'])] = true;
    }

    foreach ((array) ($event['merch'] ?? []) as $item) {
        if (!is_array($item)) continue;
        $fields = merch_public_fields($item);
        if (merch_is_empty($fields)) continue;
        if (isset($names[mb_strtolower($fields['name'])])) continue;

        // Given an id so the admin can tell it apart, but it is not in the
        // catalogue — 'legacy:' marks it as belonging to this event alone.
        $out[] = merch_present($fields + ['id' => 'legacy:' . slugify($fields['name'])]);
    }

    return $out;
}
