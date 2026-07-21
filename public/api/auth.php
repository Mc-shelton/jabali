<?php
// Admin authentication.
//   GET  auth.php            → { authenticated, csrf? }
//   POST auth.php {password} → log in, returns { authenticated, csrf }
//   POST auth.php?logout=1   → log out
require __DIR__ . '/_bootstrap.php';

route([
    'GET' => function () {
        if (is_authenticated()) {
            json_out(['authenticated' => true, 'csrf' => csrf_token()]);
        }
        json_out(['authenticated' => false]);
    },

    'POST' => function () {
        if (isset($_GET['logout'])) {
            $_SESSION = [];
            session_destroy();
            json_out(['authenticated' => false]);
        }

        // Throttle brute force a little: a short forced delay per attempt.
        $body = read_json_body();
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';

        if ($password === '' || !password_is_valid($password)) {
            usleep(400000); // 0.4s
            error_out('Incorrect password.', 401);
        }

        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        json_out(['authenticated' => true, 'csrf' => csrf_token()]);
    },
]);
