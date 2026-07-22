<?php
// Schema-driven content validation.
//
// A content section declares its shape once, in _sections.php. This file turns
// that declaration into the stored record; the same declaration is served to the
// admin UI, which renders the form from it. Adding a field to a section means
// editing the schema — never this file, and never the React form.
//
// Field kinds:
//   text | textarea | url | image | file | email | select | number | bool → scalar
//   group  ['fields' => [name => spec, ...]]   → nested object
//   list   ['of' => spec, 'maxItems' => int]   → repeatable
//
// Every spec may carry 'label' (admin UI), 'help' (admin UI), 'maxLength', and
// 'nullable' (empty stores as null instead of '').

// Length caps by kind. These are the "editable, but can't break the layout"
// guard rails — a heading that wraps at a tuned breakpoint stays short.
function schema_default_max(string $kind): int
{
    return match ($kind) {
        'textarea' => 2000,
        'url', 'image', 'file' => 500,
        'email'  => 200,
        default  => 200,
    };
}

// Links may be internal routes, uploaded assets, absolute http(s), or mailto/tel.
// Anything else — javascript:, data:, vbscript: — is dropped rather than stored,
// so a pasted payload can never reach an href.
function clean_url($value, int $maxLen = 500): string
{
    $v = clean_string($value, $maxLen);
    if ($v === '') {
        return '';
    }
    if (str_starts_with($v, '/')) {
        return $v;                                  // internal route or /uploads asset
    }
    if (preg_match('#^(https?://|mailto:|tel:)#i', $v)) {
        return $v;
    }
    return '';
}

function clean_email($value): string
{
    $v = clean_string($value, 200);
    return filter_var($v, FILTER_VALIDATE_EMAIL) ? $v : '';
}

// True when a value carries no content, so blank rows a user tabbed through
// don't get persisted. Groups are empty when every leaf inside them is.
function schema_is_empty(array $spec, $value): bool
{
    $kind = $spec['kind'] ?? 'text';

    if ($kind === 'group') {
        foreach ($spec['fields'] ?? [] as $name => $child) {
            if (!schema_is_empty($child, $value[$name] ?? null)) {
                return false;
            }
        }
        return true;
    }
    if ($kind === 'list') {
        return empty($value);
    }
    if ($kind === 'bool' || $kind === 'number') {
        return false;                               // false / 0 are real values
    }
    return $value === null || $value === '';
}

function normalise_field(array $spec, $value)
{
    $kind = $spec['kind'] ?? 'text';

    if ($kind === 'group') {
        return normalise_fields($spec['fields'] ?? [], is_array($value) ? $value : []);
    }

    if ($kind === 'list') {
        $of  = $spec['of'] ?? ['kind' => 'text'];
        $cap = $spec['maxItems'] ?? 200;
        $out = [];
        foreach ((array) $value as $item) {
            if (count($out) >= $cap) {
                break;
            }
            $clean = normalise_field($of, $item);
            if (schema_is_empty($of, $clean)) {
                continue;
            }
            $out[] = $clean;
        }
        return $out;
    }

    $maxLen = $spec['maxLength'] ?? schema_default_max($kind);

    $clean = match ($kind) {
        'url', 'image', 'file' => clean_url($value, $maxLen),
        'email'  => clean_email($value),
        'number' => (int) $value,
        'bool'   => (bool) $value,
        'select' => in_array($value, $spec['options'] ?? [], true)
            ? $value
            : (string) ($spec['options'][0] ?? ''),
        default  => clean_string($value, $maxLen),
    };

    // Some fields distinguish "not set" from "empty" — a social link with no URL
    // is dropped from the UI rather than rendered dead (see social.js).
    if (($spec['nullable'] ?? false) && $clean === '') {
        return null;
    }
    return $clean;
}

function normalise_fields(array $fields, array $input): array
{
    $out = [];
    foreach ($fields as $name => $spec) {
        $out[$name] = normalise_field($spec, $input[$name] ?? null);
    }
    return $out;
}

// Fill a stored record out to the full schema shape. Used on read so a section
// added to the schema after its JSON was written still returns every key, and
// the admin form never binds an input to undefined.
function schema_hydrate(array $fields, $stored): array
{
    return normalise_fields($fields, is_array($stored) ? $stored : []);
}
