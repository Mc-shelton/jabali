<?php
// Events CRUD.
//   GET    events.php               → { upcoming: [...], past: [...] }   (public)
//   GET    events.php?slug=...      → one event                          (public)
//   POST   events.php               → create                            (admin)
//   PUT    events.php?slug=...      → update                            (admin)
//   DELETE events.php?slug=...      → delete                            (admin)
require __DIR__ . '/_bootstrap.php';

require __DIR__ . '/_merch.php';

const STORE = 'events';

function enrich(array $event): array
{
    $event['ticketed'] = !empty($event['packages']);

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

    // packages: [{ name, price, note, url }]
    $packages = [];
    foreach ((array) ($in['packages'] ?? []) as $p) {
        if (!is_array($p)) continue;
        $name = clean_string($p['name'] ?? '', 80);
        $price = clean_string($p['price'] ?? '', 40);
        if ($name === '' && $price === '') continue;
        $url = clean_string($p['url'] ?? '', 500);
        $packages[] = [
            'name'  => $name,
            'price' => $price,
            'note'  => clean_string($p['note'] ?? '', 160),
            'url'   => $url !== '' ? $url : null,
        ];
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
