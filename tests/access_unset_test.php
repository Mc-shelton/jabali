<?php
// The property under test: a server that never configured member access must
// not have member access.
//
// This is its own file because PHP constants cannot be redefined — the setup
// IS the test case, and it is the one worth isolating. The specific trap:
// hash_equals('', '') returns true, so a naive comparison against an unset
// MEMBER_PASSWORD accepts an empty password from anyone who asks. Every server
// that upgrades to this release starts in exactly this state.
declare(strict_types=1);

const ADMIN_PASSWORD       = 'admin-secret';
const ADMIN_PASSWORD_HASH  = '';
// MEMBER_PASSWORD / MEMBER_PASSWORD_HASH deliberately undefined, as on a
// config.php written before the member portal existed.

require __DIR__ . '/../public/api/_access.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . var_export($got, true) . "\n       want: " . var_export($want, true) . "\n";
}

echo "\n-- no member credential is configured --\n";
check('credentials report as unset', member_credentials_configured(), false);

// The empty-password trap, stated three ways.
check('empty password rejected',     member_password_is_valid(''),        false);
check('any password rejected',       member_password_is_valid('guess'),   false);
check('whitespace rejected',         member_password_is_valid(' '),       false);

echo "\n-- and no member can sign in, even with the switch on --\n";
// Access "open" in settings plus no credential must still be no entry. The
// stored switch alone must never be sufficient.
check('empty password, access open', resolve_login_role('jabali-member', '', true),      null);
check('guessed password, open',      resolve_login_role('jabali-member', 'guess', true), null);

echo "\n-- the admin is unaffected --\n";
// An operator upgrading must not be locked out by a feature they haven't set up.
check('admin still signs in', resolve_login_role('', 'admin-secret', true), 'admin');
check('missing config defaults username', member_username(), 'jabali-member');

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
