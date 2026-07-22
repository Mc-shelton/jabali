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

// The only section a member may read the schema for or write to. A single
// constant so the read path and the write path cannot drift apart and quietly
// grant more than intended.
const MEMBER_SECTIONS = ['members'];

function member_may_edit(string $name): bool
{
    return is_admin() || in_array($name, MEMBER_SECTIONS, true);
}

// A one-line summary of what a save changed, for the log. The full before and
// after would be several kilobytes of JSON per edit and unreadable in the log
// viewer; the roster's shape — who is on it — is the part worth being able to
// reconstruct after the fact.
function content_change_summary(string $name, array $before, array $after): array
{
    if ($name !== 'members') {
        return [];
    }

    $names = static fn(array $d) => array_values(array_filter(array_map(
        static fn($m) => is_array($m) ? (string) ($m['name'] ?? '') : '',
        (array) ($d['members'] ?? []),
    )));

    $was = $names($before);
    $now = $names($after);

    return [
        'added'   => array_values(array_diff($now, $was)),
        'removed' => array_values(array_diff($was, $now)),
        'count'   => count($now),
    ];
}

route([
    'GET' => function () {
        $sections = content_sections();

        if (!empty($_GET['schema'])) {
            require_auth();
            // A member is served only the schema they can act on. They have no
            // use for the rest, and the schema is a map of everything the
            // dashboard can change.
            if (!is_admin()) {
                $sections = array_intersect_key($sections, array_flip(MEMBER_SECTIONS));
            }
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

        // The real boundary for member access. The portal only ever offers them
        // the roster, but the portal is JavaScript on their machine — this is
        // the check that holds when the request doesn't come from it.
        if (!member_may_edit($name)) {
            log_warn('Blocked a member write outside their scope', ['section' => $name]);
            error_out('This section is for administrators only.', 403);
        }

        $before = store_read(section_store($name), []);

        $clean = normalise_fields($schema['fields'], read_json_body());
        validate_section_media($name, $clean);
        store_write(section_store($name), $clean);

        // Logged for every role, not just members: "who changed the roster and
        // when" is the question this answers, and an admin edit is just as
        // likely to be the one being reconstructed.
        log_info('Content saved', [
            'section' => $name,
            'role'    => current_role(),
        ] + content_change_summary($name, is_array($before) ? $before : [], $clean));

        json_out($clean);
    },
]);
