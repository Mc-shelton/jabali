<?php
// The merchandise catalogue.
//   GET    merch.php              → { products, promoCodes? }   (promoCodes admin-only)
//   POST   merch.php              → create a product            (admin)
//   PUT    merch.php?id=ID        → replace a product           (admin)
//   PUT    merch.php?promos=1     → replace the promo codes     (admin)
//   DELETE merch.php?id=ID        → remove a product            (admin)
//   POST   merch.php?import=1     → lift inline event merch into the catalogue (admin)
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_merch.php';

function merch_save(array $products, array $promoCodes): void
{
    store_write(MERCH_STORE, [
        'products'   => array_values($products),
        'promoCodes' => array_values($promoCodes),
    ]);
}

function merch_find(array $products, string $id): int
{
    foreach ($products as $i => $p) {
        if (($p['id'] ?? '') === $id) return $i;
    }
    return -1;
}

// One-time migration, run from the Merchandise screen.
//
// The live server owns its own api/data — it is excluded from the deploy — so
// existing events arrive here still carrying their products inline. This lifts
// them into the catalogue and rewrites those events to reference them.
//
// Idempotent, and matches on name: running it twice adds nothing the second
// time, and an event whose shirt is already in the catalogue links to that one
// rather than creating a duplicate.
function merch_import_from_events(): array
{
    $store = merch_store();
    $products = $store['products'];

    $byName = [];
    foreach ($products as $p) {
        $byName[mb_strtolower($p['name'] ?? '')] = $p['id'] ?? '';
    }

    $events = store_read('events', []);
    if (!is_array($events)) $events = [];

    $added = [];
    $linked = 0;

    foreach ($events as $i => $event) {
        if (!is_array($event)) continue;

        $ids = array_values(array_filter(
            (array) ($event['merchIds'] ?? []),
            static fn($id) => is_string($id) && $id !== '',
        ));
        $changed = false;

        foreach ((array) ($event['merch'] ?? []) as $item) {
            if (!is_array($item)) continue;
            $fields = merch_public_fields($item);
            if (merch_is_empty($fields)) continue;

            $key = mb_strtolower($fields['name']);
            if (!isset($byName[$key])) {
                $product = merch_normalise($item, $products);
                $products[] = $product;
                $byName[$key] = $product['id'];
                $added[] = $product['name'];
            }

            $id = $byName[$key];
            if (!in_array($id, $ids, true)) {
                $ids[] = $id;
                $changed = true;
            }
        }

        if ($changed) {
            // `merch` is cleared only once every item is safely referenced —
            // the event keeps presenting exactly the same products either way,
            // so a half-finished import can never make one disappear from sale.
            $events[$i]['merchIds'] = $ids;
            $events[$i]['merch'] = [];
            $linked++;
        }
    }

    merch_save($products, $store['promoCodes']);
    if ($linked > 0) {
        store_write('events', $events);
    }

    log_info('Imported event merchandise into the catalogue', [
        'productsAdded' => count($added),
        'eventsLinked'  => $linked,
        'names'         => $added,
    ]);

    return ['added' => $added, 'eventsLinked' => $linked, 'products' => $products];
}

route([
    'GET' => function () {
        $store = merch_store();

        // One product, for its own page at /merch/:id.
        if (isset($_GET['id'])) {
            $id = clean_string($_GET['id'], 120);
            $at = merch_find($store['products'], $id);
            if ($at < 0) {
                error_out('Product not found.', 404);
            }
            json_out($store['products'][$at]);
        }

        // Promo codes are secret — the same rule events.php applies to its own.
        // A visitor must not be able to read a discount code out of the API.
        if (!is_authenticated()) {
            json_out(['products' => $store['products']]);
        }
        json_out($store);
    },

    'POST' => function () {
        require_admin();
        require_csrf();

        if (isset($_GET['import'])) {
            $result = merch_import_from_events();
            json_out($result);
        }

        $store = merch_store();
        $product = merch_normalise(read_json_body(), $store['products']);

        if (merch_is_empty($product)) {
            error_out('A product needs a name, or a price, or an open amount.', 422);
        }

        $products = $store['products'];
        $products[] = $product;
        merch_save($products, $store['promoCodes']);

        log_info('Merchandise created', ['id' => $product['id'], 'name' => $product['name']]);
        json_out($product, 201);
    },

    'PUT' => function () {
        require_admin();
        require_csrf();

        $store = merch_store();

        if (isset($_GET['promos'])) {
            $body = read_json_body();
            $codes = merch_clean_promos($body['promoCodes'] ?? []);
            merch_save($store['products'], $codes);
            log_info('Merchandise promo codes saved', ['count' => count($codes)]);
            json_out(['promoCodes' => $codes]);
        }

        $id = clean_string($_GET['id'] ?? '', 120);
        $products = $store['products'];
        $at = merch_find($products, $id);
        if ($at < 0) {
            error_out('Product not found.', 404);
        }

        $product = merch_normalise(read_json_body(), $products, $products[$at]);
        if (merch_is_empty($product)) {
            error_out('A product needs a name, or a price, or an open amount.', 422);
        }

        $products[$at] = $product;
        merch_save($products, $store['promoCodes']);

        log_info('Merchandise updated', ['id' => $product['id'], 'name' => $product['name']]);
        json_out($product);
    },

    'DELETE' => function () {
        require_admin();
        require_csrf();

        $id = clean_string($_GET['id'] ?? '', 120);
        $store = merch_store();
        $products = $store['products'];
        $at = merch_find($products, $id);
        if ($at < 0) {
            error_out('Product not found.', 404);
        }

        $removed = $products[$at];
        array_splice($products, $at, 1);
        merch_save($products, $store['promoCodes']);

        // Events keep the dangling id. merch_resolve_for_event() skips ids it
        // can't find, so the product simply stops being offered — and if the
        // deletion was a mistake, re-creating it under the same name restores
        // every link at once.
        log_info('Merchandise deleted', ['id' => $id, 'name' => $removed['name'] ?? '']);
        json_out(['ok' => true]);
    },
]);
