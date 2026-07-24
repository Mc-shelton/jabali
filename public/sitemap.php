<?php
// Dynamic sitemap, served at /sitemap.xml (see .htaccess).
//
// Events and products change through the admin between deploys, so a file baked
// at build time would list yesterday's catalogue. This reads the same live
// data the site serves and rebuilds the list on every request — a new event is
// discoverable the moment it's saved, with no redeploy.
//
// Same rule preview.php follows: never be the reason a request fails. Any
// missing file or bad JSON simply drops that section; the fixed routes always
// render.

declare(strict_types=1);

header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600');

// Origin: prefer the configured SITE_URL, fall back to the request host so a
// staging copy still produces working links.
$origin = 'https://jabalichorale.com';
if (is_file(__DIR__ . '/api/config.php')) {
    require_once __DIR__ . '/api/config.php';
    if (defined('SITE_URL') && SITE_URL !== '') {
        $origin = rtrim((string) SITE_URL, '/');
    }
}
$origin = rtrim($origin, '/');

$read = static function (string $name) {
    if (!defined('DATA_DIR')) return null;
    $path = DATA_DIR . '/' . $name . '.json';
    if (!is_file($path)) return null;
    $decoded = json_decode((string) @file_get_contents($path), true);
    return is_array($decoded) ? $decoded : null;
};

// Fixed marketing routes, mirroring src/data/seo.js.
$routes = [
    '/' => '1.0',
    '/about' => '0.8',
    '/music' => '0.9',
    '/events' => '0.9',
    '/merch' => '0.7',
    '/jabali-at-5' => '0.7',
    '/join' => '0.8',
    '/partnerships' => '0.7',
    '/community' => '0.7',
    '/gallery' => '0.7',
    '/contact' => '0.8',
];

$urls = [];
foreach ($routes as $path => $priority) {
    $urls[] = ['loc' => $origin . $path, 'priority' => $priority];
}

// Live events.
foreach ((array) ($read('events') ?? []) as $event) {
    if (!is_array($event)) continue;
    $slug = (string) ($event['slug'] ?? '');
    if ($slug === '') continue;
    $urls[] = [
        'loc' => $origin . '/events/' . rawurlencode($slug),
        'priority' => '0.8',
        // A dated event's page is effectively fixed once the day passes; use the
        // event date as a reasonable lastmod signal when it's a valid date.
        'lastmod' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($event['date'] ?? '')) ? $event['date'] : null,
    ];
}

// Live merch — the store is either a bare list or { products: [...] }.
$store = $read('merch') ?? [];
$products = array_is_list($store) ? $store : (array) ($store['products'] ?? []);
foreach ($products as $product) {
    if (!is_array($product)) continue;
    $id = (string) ($product['id'] ?? '');
    if ($id === '') continue;
    $urls[] = ['loc' => $origin . '/merch/' . rawurlencode($id), 'priority' => '0.7'];
}

$esc = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $u) {
    echo '  <url><loc>' . $esc($u['loc']) . '</loc>';
    if (!empty($u['lastmod'])) {
        echo '<lastmod>' . $esc((string) $u['lastmod']) . '</lastmod>';
    }
    if (!empty($u['priority'])) {
        echo '<priority>' . $esc((string) $u['priority']) . '</priority>';
    }
    echo '</url>' . "\n";
}
echo '</urlset>' . "\n";
