<?php
// Portal authentication, for both roles.
//   GET  auth.php                       → { authenticated, role?, csrf? }
//   POST auth.php {username?, password} → log in, returns { authenticated, role, csrf }
//   POST auth.php?logout=1              → log out
//
// `username` picks which credential is being offered. It is absent on the admin
// form, which has only ever asked for a password — omitting it means "admin",
// so an existing admin's sign-in is unchanged by member access existing.
require __DIR__ . '/_bootstrap.php';

route([
    'GET' => function () {
        if (is_authenticated()) {
            json_out([
                'authenticated' => true,
                'role'          => current_role(),
                'csrf'          => csrf_token(),
            ]);
        }
        // Told to the signed-out portal so the member sign-in page can say
        // "closed" rather than failing every attempt with "incorrect password".
        // It discloses only whether the chorale is currently accepting member
        // sign-ins — which the members themselves are meant to know.
        json_out([
            'authenticated'    => false,
            'memberAccessOpen' => member_access_open(),
        ]);
    },

    'POST' => function () {
        if (isset($_GET['logout'])) {
            $_SESSION = [];
            session_destroy();
            json_out(['authenticated' => false]);
        }

        $body = read_json_body();
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';
        $username = clean_string($body['username'] ?? '', 60);

        $accessOpen = member_access_open();

        // Reported separately from a wrong password so a closed door says so
        // plainly, rather than telling a member whose password is correct that
        // it is wrong and sending them to fix something that isn't broken.
        $wantsMember = $username !== '' && hash_equals(member_username(), $username);
        if ($wantsMember && !$accessOpen) {
            usleep(400000);
            log_warn('Member sign-in refused: access is closed', ['username' => $username]);
            error_out('Member access is currently closed. Please contact the chorale admin.', 403);
        }

        $role = resolve_login_role($username, $password, $accessOpen);

        if ($role === null) {
            usleep(400000); // 0.4s — takes the edge off brute forcing
            log_warn('Failed sign-in', ['username' => $username !== '' ? $username : '(admin form)']);
            error_out('Incorrect username or password.', 401);
        }

        session_regenerate_id(true);
        $_SESSION['admin'] = true;   // "is signed in"; the role decides what for
        $_SESSION['role']  = $role;

        log_info('Signed in', ['role' => $role]);

        json_out([
            'authenticated' => true,
            'role'          => $role,
            'csrf'          => csrf_token(),
        ]);
    },
]);
