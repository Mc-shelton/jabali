<?php
// Generic content sections — one endpoint for every dashboard-editable part of
// the site. The shape of each section lives in _sections.php; this file only
// moves data in and out of the store.
//
//   GET content.php                → { section: {...}, ... }  every stored section  (public)
//   GET content.php?section=NAME   → one section                                    (public)
//   GET content.php?schema=1       → the schema, for the admin form renderer        (admin)
//   PUT content.php?section=NAME   → replace that section                           (admin)
//
// A section with nothing stored yet is omitted (or 404s). That's deliberate: the
// client then keeps its bundled static seed instead of painting empty strings
// over a working page.
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_schema.php';
require __DIR__ . '/_sections.php';

const STORE_PREFIX = 'content_';

function section_store(string $name): string
{
    return STORE_PREFIX . $name;
}

function section_is_stored(string $name): bool
{
    return is_file(store_path(section_store($name)));
}

// Some sections derive fields from other sections on read — the rehearsal time
// shown on the Join page is the one stored under Contact, so it's only ever
// edited in one place. A section opts in by defining content_enrich_<name>() in
// _sections.php. Derived keys aren't in the schema, so the admin form never
// offers them for editing and normalise_fields() strips them on save.
function enrich_section(string $name, array $data): array
{
    $fn = 'content_enrich_' . $name;
    return function_exists($fn) ? $fn($data) : $data;
}

function read_section(string $name, array $schema): array
{
    $stored = schema_hydrate($schema['fields'], store_read(section_store($name), []));
    return enrich_section($name, $stored);
}

// Uploaded music must still exist when the editor saves. This catches a failed
// or manually removed bucket upload before a broken player is published. Older
// external URLs remain readable only so existing content can be replaced from
// the new upload-only admin control without making unrelated edits impossible.
function validate_section_media(string $name, array $data): void
{
    if ($name !== 'music') {
        return;
    }

    $groups = [
        $data['catalog'] ?? [],
        $data['featuredReleases'] ?? [],
    ];
    foreach ($groups as $items) {
        foreach ($items as $item) {
            $url = (string) ($item['audioSrc'] ?? '');
            if ($url === '' || !str_starts_with($url, '/bucket/')) {
                continue;
            }
            if (!str_starts_with($url, '/bucket/website/music/')) {
                error_out('Audio file points outside the music bucket.', 422);
            }

            $namePart = rawurldecode(substr($url, strlen('/bucket/website/music/')));
            if ($namePart === '' || basename($namePart) !== $namePart) {
                error_out('Audio file path is invalid.', 422);
            }
            $path = dirname(__DIR__) . '/bucket/website/music/' . $namePart;
            if (!is_file($path)) {
                $title = clean_string($item['title'] ?? 'Track', 120);
                error_out('The uploaded audio for “' . $title . '” is missing. Upload it again, then save.', 422);
            }
        }
    }
}

route([
    'GET' => function () {
        $sections = content_sections();

        if (!empty($_GET['schema'])) {
            require_auth();
            json_out($sections);
        }

        if (isset($_GET['section'])) {
            $name = (string) $_GET['section'];
            $schema = content_section($name);
            if ($schema === null) {
                error_out('Unknown content section.', 404);
            }
            if (!section_is_stored($name)) {
                error_out('This section has no saved content yet.', 404);
            }
            json_out(read_section($name, $schema));
        }

        $out = [];
        foreach ($sections as $name => $schema) {
            if (section_is_stored($name)) {
                $out[$name] = read_section($name, $schema);
            }
        }
        json_out($out);
    },

    'PUT' => function () {
        require_auth();
        require_csrf();

        $name = (string) ($_GET['section'] ?? '');
        $schema = content_section($name);
        if ($schema === null) {
            error_out('Unknown content section.', 404);
        }

        $clean = normalise_fields($schema['fields'], read_json_body());
        validate_section_media($name, $clean);
        store_write(section_store($name), $clean);
        json_out($clean);
    },
]);
