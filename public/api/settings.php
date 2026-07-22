<?php
// Operational switches owned by the admin.
//   GET settings.php → { memberAccessOpen, memberCredentialsSet, memberUsername }
//   PUT settings.php → replace them
//
// Admin only, both ways. Deliberately not part of content.php: content sections
// are served to the public site, and whether a second door into the dashboard
// is open is not public information.
require __DIR__ . '/_bootstrap.php';

route([
    'GET' => function () {
        require_admin();

        json_out(settings_read() + [
            // Reported so the admin screen can say "no member password is set"
            // instead of letting them switch access on and wonder why nobody
            // can sign in. Whether a credential exists — never the credential.
            'memberCredentialsSet' => member_credentials_configured(),
            'memberUsername'       => member_username(),
        ]);
    },

    'PUT' => function () {
        require_admin();
        require_csrf();

        $body = read_json_body();
        $saved = settings_write($body);

        log_info('Settings saved', [
            'memberAccessOpen' => $saved['memberAccessOpen'],
            'role'             => current_role(),
        ]);

        json_out($saved + [
            'memberCredentialsSet' => member_credentials_configured(),
            'memberUsername'       => member_username(),
        ]);
    },
]);
