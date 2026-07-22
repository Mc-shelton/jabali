<?php
// Jabali @5 campaign config.
//   GET jabali5.php         → { tag, eyebrow, title, intro, endCard, chapters:[enriched] }  (public)
//   GET jabali5.php?raw=1   → the unenriched stored config                                  (admin)
//   PUT jabali5.php         → update meta + endCard + chapters                               (admin)
//
// Stored chapters carry narrative, an optional eventSlug, and optional overrides.
// On read they're joined with live event data (poster / date / title / status)
// so the journey stays a single source of truth — but any override the admin
// sets wins over the inherited event value.
require __DIR__ . '/_bootstrap.php';

const STORE = 'jabali5';

function format_event_date(string $iso): array
{
    $ts = strtotime($iso);
    if ($ts === false) {
        return ['weekday' => '', 'day' => '', 'month' => '', 'year' => '', 'long' => ''];
    }
    return [
        'weekday' => date('D', $ts),
        'day'     => date('d', $ts),
        'month'   => date('M', $ts),
        'year'    => date('Y', $ts),
        'long'    => date('l, j F Y', $ts),
    ];
}

function events_by_slug(): array
{
    $events = store_read('events', []);
    $map = [];
    foreach ((array) $events as $e) {
        if (isset($e['slug'])) $map[$e['slug']] = $e;
    }
    return $map;
}

function default_end_card(): array
{
    return [
        'kicker'   => 'The story continues',
        'line'     => 'Be part of chapter five.',
        'ctaLabel' => 'Join the chorale',
        'ctaHref'  => '/join',
    ];
}

function default_config(): array
{
    return [
        'tag' => 'Jabali @5',
        'eyebrow' => 'The Journey · Est. 2022',
        'title' => 'Five years. One story.',
        'intro' => 'Jabali Chorale turns five. This is the road so far and the road ahead.',
        'endCard' => default_end_card(),
        'chapters' => [],
    ];
}

// Prefer a non-empty override; otherwise fall back to the event value.
function pick(string $override, ?string $fallback): string
{
    return $override !== '' ? $override : (string) ($fallback ?? '');
}

function enrich_chapters(array $config): array
{
    $eventMap = events_by_slug();
    $out = [];

    foreach (($config['chapters'] ?? []) as $i => $chapter) {
        $slug  = $chapter['eventSlug'] ?? '';
        $event = $slug !== '' ? ($eventMap[$slug] ?? null) : null;

        // A card needs a picture: keep it only if it links a real event or the
        // admin supplied a poster of its own. Otherwise drop it silently.
        $poster = pick($chapter['poster'] ?? '', $event['poster'] ?? null);
        if (!$event && $poster === '') {
            continue;
        }

        $dateLabel = $chapter['dateLabel'] ?? '';
        if ($dateLabel === '' && $event) {
            $d = format_event_date($event['date'] ?? '');
            $dateLabel = trim($d['month'] . ' ' . $d['year']);
        }

        $status = $chapter['status'] ?? '';
        if ($status === 'past') {
            $done = true;
        } elseif ($status === 'upcoming') {
            $done = false;
        } else {
            $done = $event ? (($event['status'] ?? '') === 'past') : false;
        }

        $href = $chapter['href'] ?? '';
        if ($href === '' && $event && $slug !== '') {
            $href = '/events/' . $slug;
        }

        $out[] = [
            'number'     => str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT),
            'heading'    => $chapter['heading'] ?? '',
            'tale'       => $chapter['tale'] ?? '',
            'eventSlug'  => $slug,
            'eventTitle' => pick($chapter['eventTitle'] ?? '', $event['title'] ?? null),
            'type'       => pick($chapter['type'] ?? '', $event['type'] ?? null),
            'poster'     => $poster,
            'dateLabel'  => $dateLabel,
            'done'       => $done,
            'href'       => $href,
        ];
    }

    return $out;
}

function enrich_config(array $config): array
{
    $endCard = is_array($config['endCard'] ?? null) ? $config['endCard'] : [];
    $defaults = default_end_card();

    return [
        'tag'      => $config['tag'] ?? 'Jabali @5',
        'eyebrow'  => $config['eyebrow'] ?? '',
        'title'    => $config['title'] ?? '',
        'intro'    => $config['intro'] ?? '',
        'endCard'  => [
            'kicker'   => $endCard['kicker']   ?? $defaults['kicker'],
            'line'     => $endCard['line']     ?? $defaults['line'],
            'ctaLabel' => $endCard['ctaLabel'] ?? $defaults['ctaLabel'],
            'ctaHref'  => $endCard['ctaHref']  ?? $defaults['ctaHref'],
        ],
        'chapters' => enrich_chapters($config),
    ];
}

route([
    'GET' => function () {
        // Admin editor needs the raw stored overrides, not the enriched values,
        // so re-saving doesn't bake inherited event data into hard overrides.
        if (isset($_GET['raw'])) {
            require_admin();
            json_out(store_read(STORE, default_config()));
            return;
        }
        $config = store_read(STORE, default_config());
        json_out(enrich_config($config));
    },

    'PUT' => function () {
        require_admin();
        require_csrf();
        $in = read_json_body();

        $chapters = [];
        foreach ((array) ($in['chapters'] ?? []) as $c) {
            if (!is_array($c)) continue;
            $slug   = clean_string($c['eventSlug'] ?? '', 120);
            $poster = clean_string($c['poster'] ?? '', 400);
            // Keep a chapter if it links an event or carries its own poster.
            if ($slug === '' && $poster === '') continue;

            $status = clean_string($c['status'] ?? '', 20);
            if (!in_array($status, ['past', 'upcoming'], true)) $status = '';

            $chapters[] = [
                'heading'    => clean_string($c['heading'] ?? '', 160),
                'tale'       => clean_string($c['tale'] ?? '', 600),
                'eventSlug'  => $slug,
                'poster'     => $poster,
                'dateLabel'  => clean_string($c['dateLabel'] ?? '', 60),
                'eventTitle' => clean_string($c['eventTitle'] ?? '', 160),
                'type'       => clean_string($c['type'] ?? '', 60),
                'status'     => $status,
                'href'       => clean_string($c['href'] ?? '', 400),
            ];
        }

        $endCardIn = is_array($in['endCard'] ?? null) ? $in['endCard'] : [];
        $endCard = [
            'kicker'   => clean_string($endCardIn['kicker'] ?? '', 120),
            'line'     => clean_string($endCardIn['line'] ?? '', 200),
            'ctaLabel' => clean_string($endCardIn['ctaLabel'] ?? '', 60),
            'ctaHref'  => clean_string($endCardIn['ctaHref'] ?? '', 400),
        ];

        $config = [
            'tag'      => clean_string($in['tag'] ?? 'Jabali @5', 40),
            'eyebrow'  => clean_string($in['eyebrow'] ?? '', 120),
            'title'    => clean_string($in['title'] ?? '', 160),
            'intro'    => clean_string($in['intro'] ?? '', 600),
            'endCard'  => $endCard,
            'chapters' => $chapters,
        ];

        store_write(STORE, $config);
        json_out(enrich_config($config));
    },
]);
