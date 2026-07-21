<?php
// Events CRUD.
//   GET    events.php               → { upcoming: [...], past: [...] }   (public)
//   GET    events.php?slug=...      → one event                          (public)
//   POST   events.php               → create                            (admin)
//   PUT    events.php?slug=...      → update                            (admin)
//   DELETE events.php?slug=...      → delete                            (admin)
require __DIR__ . '/_bootstrap.php';

const STORE = 'events';

function enrich(array $event): array
{
    $event['ticketed'] = !empty($event['packages']);
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

    // merch: [{ name, price, description, image, openAmount, options }]
    //
    // options let a buyer pick a variant (Size: S/M/L). Each choice may carry a
    // price delta, applied server-side at checkout — the browser never gets to
    // say what something costs.
    //
    // openAmount is for things like a donation, where the buyer names the
    // figure. `min` is the floor; quantity doesn't apply to these.
    $merch = [];
    foreach ((array) ($in['merch'] ?? []) as $m) {
        if (!is_array($m)) continue;
        $name = clean_string($m['name'] ?? '', 80);
        $price = clean_string($m['price'] ?? '', 40);
        $openIn = is_array($m['openAmount'] ?? null) ? $m['openAmount'] : [];
        $openEnabled = !empty($openIn['enabled']);

        // An open-amount item legitimately has no fixed price, so it must not be
        // dropped by the empty check that applies to normal products.
        if ($name === '' && $price === '' && !$openEnabled) continue;

        $options = [];
        foreach ((array) ($m['options'] ?? []) as $opt) {
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
            if (!$choices) continue;              // a parameter with no choices is meaningless

            $options[] = [
                'name'     => $optName,
                'required' => !isset($opt['required']) || !empty($opt['required']),
                'choices'  => $choices,
            ];
        }

        $merch[] = [
            'name'        => $name,
            'price'       => $price,
            'description' => clean_string($m['description'] ?? '', 300),
            'image'       => clean_string($m['image'] ?? '', 500),
            'openAmount'  => [
                'enabled' => $openEnabled,
                'min'     => max(1, (int) ($openIn['min'] ?? 1)),
            ],
            'options'     => $options,
        ];
    }

    // promoCodes: [{ code, type: 'percent'|'flat', value }] — per event.
    $promoCodes = [];
    foreach ((array) ($in['promoCodes'] ?? []) as $pc) {
        if (!is_array($pc)) continue;
        $code = strtoupper(clean_string($pc['code'] ?? '', 40));
        $value = (int) ($pc['value'] ?? 0);
        if ($code === '' || $value <= 0) continue;
        $promoCodes[] = [
            'code'  => $code,
            'type'  => ($pc['type'] ?? 'percent') === 'flat' ? 'flat' : 'percent',
            'value' => $value,
        ];
    }

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
        'merch'     => $merch,
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
        require_auth();
        require_csrf();
        $events = load_events();
        $event = normalise_event(read_json_body(), $events);
        $events[] = $event;
        store_write(STORE, $events);
        json_out(enrich($event), 201);
    },

    'PUT' => function () {
        require_auth();
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
        require_auth();
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
