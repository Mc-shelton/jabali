<?php
// Per-page link previews for /events/:slug and /merch/:id.
//
// Link crawlers — WhatsApp, Facebook, X, Slack, iMessage — fetch the HTML and
// read it. None of them run JavaScript, so meta tags written by React are never
// seen: by the time the app boots, the crawler has already taken what it found
// and left. The only way a shared event link can preview with that event's own
// poster is for the HTML to arrive carrying it.
//
// So .htaccess routes just those two URL shapes here. Everything else is still
// served as the static index.html with the site-wide defaults in it.
//
// The single rule this file follows: it must never be the reason a page fails
// to load. It is a decoration on a document that is already complete, so every
// failure path falls through to the untouched index.html.

declare(strict_types=1);

$indexPath = __DIR__ . '/index.html';
$html = @file_get_contents($indexPath);

if ($html === false) {
    // Nothing sensible left to do — but say so as HTML, not as a blank 200.
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><title>Jabali Chorale</title><p>Site is being updated. Please try again shortly.</p>';
    exit;
}

header('Content-Type: text/html; charset=utf-8');

// A crawler may re-request within seconds of a share; a browser landing here
// should not hold a stale poster after the admin changes it.
header('Cache-Control: public, max-age=300');

/**
 * Everything below is best-effort. render() is the single exit point, and any
 * failure on the way there simply reaches it with $meta empty.
 */
// $html by reference: the width/height tags are stripped after this closure is
// defined, and a by-value copy would render the pre-strip markup.
$render = static function (array $meta) use (&$html): void {
    if ($meta) {
        // Replace only the content of the tags we own. Anchoring on the exact
        // property/name attribute means a tag we don't set is left alone.
        foreach ($meta as $key => $value) {
            $attr = str_starts_with($key, 'twitter:') ? 'name' : 'property';
            $escaped = htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

            $pattern = '~(<meta\s+' . $attr . '="' . preg_quote($key, '~') . '"\s+content=")[^"]*(")~i';
            $replaced = preg_replace($pattern, '${1}' . str_replace('$', '\$', $escaped) . '${2}', $html, 1);

            // preg_replace returns null on failure; keep the original if so.
            if ($replaced !== null) {
                $html = $replaced;
            }
        }
    }
    echo $html;
    exit;
};

try {
    if (!is_file(__DIR__ . '/api/config.php')) {
        $render([]);
    }
    require_once __DIR__ . '/api/config.php';

    if (!defined('DATA_DIR')) {
        $render([]);
    }

    // ------------------------------------------------------------- helpers
    $read = static function (string $name) {
        $path = DATA_DIR . '/' . $name . '.json';
        if (!is_file($path)) return null;
        $decoded = json_decode((string) file_get_contents($path), true);
        return is_array($decoded) ? $decoded : null;
    };

    // The canonical origin. Configured where possible: HTTP_HOST is supplied by
    // the client, and a spoofed one would put someone else's domain into our
    // og:image. Falls back to the request host so a staging copy still previews.
    $origin = defined('SITE_URL') && SITE_URL !== ''
        ? rtrim((string) SITE_URL, '/')
        : (((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://')
            . preg_replace('/[^A-Za-z0-9.\-:]/', '', (string) ($_SERVER['HTTP_HOST'] ?? 'jabalichorale.com')));

    // og:image must be absolute — a crawler has no page context to resolve a
    // relative path against, and silently shows nothing at all.
    $absolute = static function (string $url) use ($origin): string {
        $url = trim($url);
        if ($url === '') return '';
        if (preg_match('~^https?://~i', $url)) return $url;
        // Spaces are legal in these filenames (they came from phone uploads) and
        // must be encoded or the crawler's fetch 404s.
        return $origin . '/' . implode('/', array_map('rawurlencode', explode('/', ltrim($url, '/'))));
    };

    $trim = static function (string $text, int $max = 200): string {
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
        return mb_strlen($text) > $max ? mb_substr($text, 0, $max - 1) . '…' : $text;
    };

    // ---------------------------------------------------------------- route
    $path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    $path = rtrim($path, '/');

    $meta = [];

    if (preg_match('~^/events/([^/]+)$~', $path, $m)) {
        $slug = rawurldecode($m[1]);
        foreach ((array) ($read('events') ?? []) as $event) {
            if (!is_array($event) || ($event['slug'] ?? '') !== $slug) continue;

            $title = (string) ($event['title'] ?? '');

            // "Sat 15 Aug 2026", not "2026-08-15". This string is read by a
            // person glancing at a chat, not parsed by anything.
            $iso = (string) ($event['date'] ?? '');
            $day = '';
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $iso)) {
                $ts = strtotime($iso);
                if ($ts !== false) $day = date('D j M Y', $ts);
            }
            $when = trim(($day !== '' ? $day : $iso) . ' ' . (string) ($event['time'] ?? ''));
            $where = (string) ($event['venue'] ?? '');
            $desc  = (string) ($event['summary'] ?? '');

            // Date and venue lead: in a chat preview those are the two things
            // that decide whether someone taps.
            $line = implode(' · ', array_filter([$when, $where]));
            $full = $trim(trim($line . ($line && $desc ? ' — ' : '') . $desc));

            $image = $absolute((string) ($event['poster'] ?? ''));

            $meta = array_filter([
                'og:type'            => 'article',
                'og:title'           => $title !== '' ? $title . ' — Jabali Chorale' : '',
                'og:description'     => $full,
                'og:url'             => $origin . '/events/' . rawurlencode($slug),
                'og:image'           => $image,
                'og:image:secure_url' => $image,
                'og:image:alt'       => $title,
                'twitter:title'      => $title,
                'twitter:description' => $full,
                'twitter:image'      => $image,
                'twitter:image:alt'  => $title,
            ], static fn($v) => $v !== '');
            break;
        }
    } elseif (preg_match('~^/merch/([^/]+)$~', $path, $m)) {
        $id = rawurldecode($m[1]);
        $store = $read('merch') ?? [];
        $products = array_is_list($store) ? $store : (array) ($store['products'] ?? []);

        foreach ($products as $product) {
            if (!is_array($product) || ($product['id'] ?? '') !== $id) continue;

            $name = (string) ($product['name'] ?? '');
            $price = !empty($product['openAmount']['enabled'])
                ? 'You choose the amount'
                : (string) ($product['price'] ?? '');
            $desc = $trim(trim($price . (($price && !empty($product['description'])) ? ' — ' : '')
                . (string) ($product['description'] ?? '')));

            $image = $absolute((string) ($product['image'] ?? ''));

            $meta = array_filter([
                'og:type'            => 'product',
                'og:title'           => $name !== '' ? $name . ' — Jabali Chorale' : '',
                'og:description'     => $desc,
                'og:url'             => $origin . '/merch/' . rawurlencode($id),
                'og:image'           => $image,
                'og:image:secure_url' => $image,
                'og:image:alt'       => $name,
                'twitter:title'      => $name,
                'twitter:description' => $desc,
                'twitter:image'      => $image,
                'twitter:image:alt'  => $name,
            ], static fn($v) => $v !== '');
            break;
        }
    }

    // An image narrower than the declared width is letterboxed by Facebook.
    // The defaults in index.html describe the splash; drop them when the image
    // is no longer that one and let the crawler measure it.
    if (!empty($meta['og:image'])) {
        $html = preg_replace(
            '~\s*<meta\s+property="og:image:(width|height)"\s+content="[^"]*"\s*/?>~i',
            '',
            $html,
        ) ?? $html;
    }

    $render($meta);

} catch (Throwable $e) {
    // A broken preview must never take a page down with it.
    error_log('preview.php: ' . $e->getMessage());
    $render([]);
}
