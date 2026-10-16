<?php
// Events CRUD.
//   GET    events.php               → { upcoming: [...], past: [...] }   (public)
//   GET    events.php?slug=...      → one event                          (public)
//   POST   events.php               → create                            (admin)
//   PUT    events.php?slug=...      → update                            (admin)
//   DELETE events.php?slug=...      → delete                            (admin)
require __DIR__ . '/_bootstrap.php';

require __DIR__ . '/_merch.php';
require __DIR__ . '/_ticket_packages.php';

const STORE = 'events';

function enrich(array $event): array
{
    $event['ticketed'] = !empty($event['packages']);

    // A family package has a variable total, so its card shows the cheapest
    // valid composition instead of pretending the base adult rate is the
    // whole-package price.
    $event['packages'] = array_map(function ($package) {
        if (($package['type'] ?? 'standard') !== 'family') return $package;
        $minimum = family_package_minimum_amount($package);
        $package['price'] = $minimum > 0
            ? 'From KES ' . number_format($minimum)
            : 'Choose family members';
        return $package;
    }, (array) ($event['packages'] ?? []));

    // Products live in the catalogue now, and the event holds their ids. They
    // are resolved back into a full `merch` array here so everything
    // downstream — the event page, the checkout, and the pricing in
    // tickets.php — sees exactly the shape it saw when merch was inline.
    // `merchIds` is kept alongside it for the admin form to bind to.
    $event['merch'] = merch_resolve_for_event($event);

    // Promo codes are secret — only admins get them (see present()).
    if (!is_authenticated()) {
        unset($event['promoCodes']);
    }
    return $event;
}

function load_events(): array
{
    $events = store_read(STORE, []);
    return is_array($events) ? array_values($events) : [];
}

function unique_slug(string $base, array $events, ?string $ignoreId = null): string
{
    $slug = slugify($base);
    $taken = [];
    foreach ($events as $e) {
        if (($e['id'] ?? null) !== $ignoreId) {
            $taken[$e['slug']] = true;
        }
    }
    if (!isset($taken[$slug])) {
        return $slug;
    }
    $n = 2;
    while (isset($taken["$slug-$n"])) {
        $n++;
    }
    return "$slug-$n";
}

// Build a clean event record from client input. Throws (via error_out) on
// missing required fields.
function normalise_event(array $in, array $events, ?array $existing = null): array
{
    $title = clean_string($in['title'] ?? '', 160);
    $date  = clean_string($in['date'] ?? '', 10);   // YYYY-MM-DD
    $type  = clean_string($in['type'] ?? '', 40);

    if ($title === '') error_out('Title is required.', 422);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) error_out('A valid date (YYYY-MM-DD) is required.', 422);
    if ($type === '') error_out('Type is required.', 422);

    $status = ($in['status'] ?? 'upcoming') === 'past' ? 'past' : 'upcoming';

    // about: array of paragraph strings
    $about = [];
    foreach ((array) ($in['about'] ?? []) as $p) {
        $p = clean_string($p, 2000);
        if ($p !== '') $about[] = $p;
    }

    // media: array of image URLs
    $media = [];
    foreach ((array) ($in['media'] ?? []) as $m) {
        $m = clean_string($m, 500);
        if ($m !== '') $media[] = $m;
    }

    // Standard packages keep the original fixed-price shape. Family packages
    // add a base member price and configurable member groups. Shared groups
    // split one advertised package total evenly between their members.
    $packages = [];
    foreach ((array) ($in['packages'] ?? []) as $p) {
        if (!is_array($p)) continue;
        $name = clean_string($p['name'] ?? '', 80);
        $price = clean_string($p['price'] ?? '', 40);
        $sentType = $p['type'] ?? 'standard';
        $packageType = in_array($sentType, ['family', 'group'], true) ? $sentType : 'standard';
        if ($name === '' && $price === '' && $packageType !== 'family') continue;
        if ($name === '') error_out('Every ticket package needs a name.', 422);
        $url = clean_string($p['url'] ?? '', 500);
        $package = [
            'type'        => $packageType,
            'name'        => $name,
            'price'       => $price,
            // Existing packages predate this switch and remain promo-enabled.
            'allowPromo'  => ($p['allowPromo'] ?? true) !== false,
            // One keeps every package saved before bundles existed working
            // exactly as before.
            'ticketCount' => normalise_ticket_count($p['ticketCount'] ?? 1),
            'note'        => clean_string($p['note'] ?? '', 160),
            'url'         => $url !== '' ? $url : null,
        ];

        if ($packageType === 'family') {
            $sentFamily = (array) ($p['family'] ?? []);
            $basePrice = ticket_price_to_int($sentFamily['basePrice'] ?? 0);
            $minMembers = max(1, min(MAX_TICKETS_PER_PACKAGE, (int) ($sentFamily['minMembers'] ?? 2)));
            $maxMembers = max($minMembers, min(MAX_TICKETS_PER_PACKAGE, (int) ($sentFamily['maxMembers'] ?? 8)));
            if ($basePrice < 1) error_out("$name needs a valid base member price.", 422);

            $groups = [];
            $ids = [];
            foreach ((array) ($sentFamily['groups'] ?? []) as $index => $group) {
                if (!is_array($group)) continue;
                $label = clean_string($group['label'] ?? '', 60);
                if ($label === '') continue;

                $rawId = clean_string($group['id'] ?? '', 60);
                $id = slugify($rawId !== '' ? $rawId : $label);
                if ($id === '') $id = 'member-' . ($index + 1);
                $baseId = $id;
                $suffix = 2;
                while (isset($ids[$id])) $id = $baseId . '-' . $suffix++;
                $ids[$id] = true;

                $min = max(0, min(MAX_TICKETS_PER_PACKAGE, (int) ($group['min'] ?? 0)));
                $max = max($min, min(MAX_TICKETS_PER_PACKAGE, (int) ($group['max'] ?? $min)));
                $default = max($min, min($max, (int) ($group['default'] ?? $min)));
                $sentPricing = (array) ($group['pricing'] ?? []);
                $pricingType = in_array($sentPricing['type'] ?? '', ['percent', 'fixed'], true)
                    ? $sentPricing['type']
                    : 'full';
                $pricingValue = max(0, (int) ($sentPricing['value'] ?? 0));
                if ($pricingType === 'percent') $pricingValue = min(100, $pricingValue);

                $groups[] = [
                    'id'       => $id,
                    'label'    => $label,
                    'ageLabel' => clean_string($group['ageLabel'] ?? '', 40),
                    'min'      => $min,
                    'max'      => $max,
                    'default'  => $default,
                    'pricing'  => ['type' => $pricingType, 'value' => $pricingValue],
                ];
            }

            if (!$groups) error_out("$name needs at least one member category.", 422);
            $minimumSlots = array_sum(array_column($groups, 'min'));
            $maximumSlots = array_sum(array_column($groups, 'max'));
            if ($minimumSlots > $maxMembers || $maximumSlots < $minMembers) {
                error_out("$name member-category limits cannot satisfy the package size.", 422);
            }

            $package['price'] = '';
            $package['ticketCount'] = $minMembers;
            $package['family'] = [
                'basePrice'  => $basePrice,
                'minMembers' => $minMembers,
                'maxMembers' => $maxMembers,
                'groups'     => $groups,
            ];
        } elseif ($packageType === 'group') {
            $capacity = normalise_ticket_count($p['ticketCount'] ?? 1);
            $total = ticket_price_to_int($price);
            if ($capacity < 2) error_out("$name needs at least two group members.", 422);
            if ($total < 1) error_out("$name needs a valid total group price.", 422);
            if ($total % $capacity !== 0) {
                error_out("$name's total price must divide evenly between its $capacity members.", 422);
            }
        }

        $packages[] = $package;
    }

    // Products come from the catalogue now; the event stores only their ids.
    // Unknown ids are kept rather than filtered: a product deleted by mistake
    // and re-created under the same name gets its id back, and every event
    // still pointing at it starts working again on its own.
    $merchIds = [];
    foreach ((array) ($in['merchIds'] ?? []) as $id) {
        $id = clean_string($id, 120);
        if ($id !== '' && !in_array($id, $merchIds, true)) {
            $merchIds[] = $id;
        }
    }

    // Any inline products an older event still carries are preserved untouched
    // until the admin runs the import on the Merchandise screen. Dropping them
    // here would pull them from sale the first time the event was edited for an
    // unrelated reason.
    $legacyMerch = [];
    foreach ((array) ($in['merch'] ?? []) as $m) {
        if (!is_array($m)) continue;
        $fields = merch_public_fields($m);
        if (merch_is_empty($fields)) continue;
        $legacyMerch[] = $fields;
    }

    // promoCodes: [{ code, type: 'percent'|'flat', value }] — per event.
    // Merchandise has its own set, on the Merchandise screen.
    $promoCodes = merch_clean_promos($in['promoCodes'] ?? []);

    $now = date('c');

    return [
        'id'        => $existing['id'] ?? bin2hex(random_bytes(8)),
        'slug'      => $existing['slug'] ?? unique_slug($title, $events),
        'status'    => $status,
        'date'      => $date,
        'time'      => clean_string($in['time'] ?? '', 20),
        'type'      => $type,
        'title'     => $title,
        'venue'     => clean_string($in['venue'] ?? '', 200),
        'summary'   => clean_string($in['summary'] ?? '', 400),
        'about'     => $about,
        'poster'    => clean_string($in['poster'] ?? '', 500),
        'packages'  => $packages,
        'merchIds'  => $merchIds,
        'merch'     => $legacyMerch,
        'promoCodes' => $promoCodes,
        'media'     => $media,
        'createdAt' => $existing['createdAt'] ?? $now,
        'updatedAt' => $now,
    ];
}

route([
    'GET' => function () {
        $events = array_map('enrich', load_events());

        if (isset($_GET['slug'])) {
            foreach ($events as $e) {
                if ($e['slug'] === $_GET['slug']) json_out($e);
            }
            error_out('Event not found.', 404);
        }

        $upcoming = array_values(array_filter($events, fn($e) => ($e['status'] ?? '') !== 'past'));
        $past = array_values(array_filter($events, fn($e) => ($e['status'] ?? '') === 'past'));

        usort($upcoming, fn($a, $b) => strcmp($a['date'], $b['date']));       // soonest first
        usort($past, fn($a, $b) => strcmp($b['date'], $a['date']));           // most recent first

        json_out(['upcoming' => $upcoming, 'past' => $past]);
    },

    'POST' => function () {
        require_admin();
        require_csrf();
        $events = load_events();
        $event = normalise_event(read_json_body(), $events);
        $events[] = $event;
        store_write(STORE, $events);
        json_out(enrich($event), 201);
    },

    'PUT' => function () {
        require_admin();
        require_csrf();
        $slug = $_GET['slug'] ?? '';
        $events = load_events();

        foreach ($events as $i => $e) {
            if ($e['slug'] === $slug) {
                $events[$i] = normalise_event(read_json_body(), $events, $e);
                store_write(STORE, $events);
                json_out(enrich($events[$i]));
            }
        }
        error_out('Event not found.', 404);
    },

    'DELETE' => function () {
        require_admin();
        require_csrf();
        $slug = $_GET['slug'] ?? '';
        $events = load_events();
        $next = array_values(array_filter($events, fn($e) => $e['slug'] !== $slug));

        if (count($next) === count($events)) {
            error_out('Event not found.', 404);
        }
        store_write(STORE, $next);
        json_out(['deleted' => $slug]);
    },
]);
