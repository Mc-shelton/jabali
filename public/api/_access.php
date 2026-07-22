<?php
// Roles and credentials.
//
// Split out of _bootstrap.php so it can be loaded on its own: _bootstrap starts
// a session, sends headers, and requires config.php, none of which a test can
// do. These are the rules that decide who gets in and as what, so they are the
// rules most worth being able to test directly.
//
// Two roles share this portal:
//
//   admin   — everything.
//   member  — the choir roster and nothing else. A shared credential the
//             chorale hands out so members can keep their own details and
//             photos current without an admin doing data entry.
//
// The distinction is enforced here and in each endpoint, never in the React
// app. Hiding a nav link stops nobody: a member who knows the URL of
// events.php can still POST to it, so every admin-only route calls
// require_admin() and every member-reachable one narrows what it accepts.

declare(strict_types=1);

function is_authenticated(): bool
{
    return !empty($_SESSION['admin']);
}

function current_role(): string
{
    // Sessions created before roles existed carry no 'role' key. Those were
    // necessarily admin logins — member access did not exist to grant — so
    // treating them as admin keeps the operator signed in across the deploy
    // rather than silently demoting them.
    return is_authenticated() ? (string) ($_SESSION['role'] ?? 'admin') : '';
}

function is_admin(): bool
{
    return current_role() === 'admin';
}

// ---------------------------------------------------------------- credentials
function password_is_valid(string $password): bool
{
    if (defined('ADMIN_PASSWORD_HASH') && ADMIN_PASSWORD_HASH !== '') {
        return password_verify($password, ADMIN_PASSWORD_HASH);
    }
    // Constant-time compare against the plaintext fallback.
    return hash_equals(ADMIN_PASSWORD, $password);
}

// The member credential. Same hash-first rule as the admin one, but with an
// extra condition: an unset password never matches. hash_equals('', '') is
// TRUE, so without this guard a server that never configured member access
// would accept an empty password from anyone who asked.
function member_password_is_valid(string $password): bool
{
    $hash = defined('MEMBER_PASSWORD_HASH') ? (string) MEMBER_PASSWORD_HASH : '';
    if ($hash !== '') {
        return password_verify($password, $hash);
    }

    $plain = defined('MEMBER_PASSWORD') ? (string) MEMBER_PASSWORD : '';
    if ($plain === '' || $password === '') {
        return false;
    }
    return hash_equals($plain, $password);
}

function member_credentials_configured(): bool
{
    return (defined('MEMBER_PASSWORD_HASH') && MEMBER_PASSWORD_HASH !== '')
        || (defined('MEMBER_PASSWORD') && MEMBER_PASSWORD !== '');
}

// Which credential a sign-in is offering. Defaulted in code, not required in
// config.php: a server whose config predates member access must keep working,
// and an undefined ADMIN_USERNAME must never mean "no admin can sign in".
function admin_username(): string
{
    $u = defined('ADMIN_USERNAME') ? trim((string) ADMIN_USERNAME) : '';
    return $u !== '' ? $u : 'admin';
}

function member_username(): string
{
    $u = defined('MEMBER_USERNAME') ? trim((string) MEMBER_USERNAME) : '';
    return $u !== '' ? $u : 'jabali-member';
}

// Resolves a sign-in attempt to a role, or null if it fails.
//
// $memberAccessOpen is passed in rather than read here so this stays a pure
// function of its inputs — the caller owns the stored setting.
//
// Returns 'admin' | 'member' | null. A member attempt made while access is
// closed returns null even with the correct password: the caller distinguishes
// the two so it can say "closed" rather than "wrong password".
function resolve_login_role(string $username, string $password, bool $memberAccessOpen): ?string
{
    if ($username !== '' && hash_equals(member_username(), $username)) {
        if (!$memberAccessOpen) {
            return null;
        }
        return ($password !== '' && member_password_is_valid($password)) ? 'member' : null;
    }

    // A blank username is the admin form, which has no such field. Only the
    // admin credential can ever produce the admin role, whatever username was
    // typed alongside it.
    return ($password !== '' && password_is_valid($password)) ? 'admin' : null;
}
