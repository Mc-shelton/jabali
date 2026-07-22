<?php
// The property under test: exactly one credential grants admin, the member
// credential grants only the member role, and neither works by accident.
//
// This guards a second way into the dashboard. The failure that matters here is
// not "a member can't sign in" — it is "someone who should not be in, is", so
// most of these are checks that a login is REFUSED.
declare(strict_types=1);

const ADMIN_PASSWORD        = 'admin-secret';
const ADMIN_PASSWORD_HASH   = '';
const MEMBER_USERNAME       = 'jabali-member';
const MEMBER_PASSWORD       = 'choir-secret';
const MEMBER_PASSWORD_HASH  = '';

require __DIR__ . '/../public/api/_access.php';

$pass = 0; $fail = 0;
function check(string $name, $got, $want) {
    global $pass, $fail;
    if ($got === $want) { $pass++; echo "  ok   $name\n"; return; }
    $fail++;
    echo "  FAIL $name\n       got:  " . var_export($got, true) . "\n       want: " . var_export($want, true) . "\n";
}

// Shorthand: sign in with member access open unless stated otherwise.
$as = fn(string $u, string $p, bool $open = true) => resolve_login_role($u, $p, $open);

echo "\n-- the admin credential --\n";
check('admin password, no username',   $as('', 'admin-secret'),        'admin');
check('admin password, any username',  $as('whoever', 'admin-secret'), 'admin');
check('wrong admin password',          $as('', 'nope'),                null);
check('empty password',                $as('', ''),                    null);

echo "\n-- the member credential --\n";
check('member user + member password', $as('jabali-member', 'choir-secret'), 'member');
check('member user + wrong password',  $as('jabali-member', 'nope'),         null);
check('member user + empty password',  $as('jabali-member', ''),             null);

echo "\n-- the member credential cannot become admin --\n";
// The whole point of the split. If the member password ever resolved to
// 'admin', every require_admin() in the API would wave it through.
check('member password, no username',   $as('', 'choir-secret'),             null);
check('member password, admin username',$as('admin', 'choir-secret'),        null);
check('admin password on member form',  $as('jabali-member', 'admin-secret'), null);

echo "\n-- the access switch --\n";
// Closed means closed even with the correct password.
check('member refused when closed',     $as('jabali-member', 'choir-secret', false), null);
// ...but closing member access must never lock the admin out.
check('admin unaffected when closed',   $as('', 'admin-secret', false),              'admin');

echo "\n-- roles read off the session --\n";
$_SESSION = [];
check('signed out has no role', current_role(), '');
check('signed out is not admin', is_admin(), false);

$_SESSION = ['admin' => true, 'role' => 'member'];
check('member role reads back', current_role(), 'member');
check('member is not admin',    is_admin(),     false);

$_SESSION = ['admin' => true, 'role' => 'admin'];
check('admin is admin', is_admin(), true);

// A session created before roles existed. Those could only have been admin
// logins, so demoting them would sign the operator out mid-deploy.
$_SESSION = ['admin' => true];
check('legacy session stays admin', is_admin(), true);

$_SESSION = [];

echo "\n-- usernames default without config --\n";
check('member username from config', member_username(), 'jabali-member');
check('admin username defaulted',    admin_username(),  'admin');

echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
