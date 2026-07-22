<?php
// Public enquiry endpoint — the contact form and the join form both post here.
//
// Every "get in touch" route on the site used to dead-end: Partnerships and
// Events sent people to the contact page, which listed an address and nothing
// else, and the join form built a mailto: link that only worked if the visitor
// had a desktop mail client configured. On a phone, which is most of the
// traffic, that silently did nothing. This endpoint is the actual delivery.
//
// It is unauthenticated by necessity, so it is treated as hostile input:
// allowlisted fields, a honeypot, a per-IP rate limit, and a hard cap on what
// is written to disk.

declare(strict_types=1);

require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_mailer.php';

// ---------------------------------------------------------------- topics
// The reason someone is writing. Each one sets the subject line and the heading
// on the email, so a partnership proposal doesn't arrive looking identical to a
// membership application.
function enquiry_topics(): array
{
    return [
        'partnership' => [
            'label'   => 'Partnership',
            'heading' => 'New partnership enquiry',
        ],
        'booking' => [
            'label'   => 'Booking / outreach',
            'heading' => 'New booking enquiry',
        ],
        'membership' => [
            'label'   => 'Join the chorale',
            'heading' => 'New membership application',
        ],
        'media' => [
            'label'   => 'Media & press',
            'heading' => 'New media enquiry',
        ],
        'general' => [
            'label'   => 'General enquiry',
            'heading' => 'New website enquiry',
        ],
    ];
}

// Fields that may appear on an enquiry, with the label used in the email and
// the maximum length accepted. Anything not named here is discarded — that is
// what stops a crafted payload from stuffing arbitrary content into the mail
// the chorale receives.
function enquiry_fields(): array
{
    return [
        'name'         => ['label' => 'Name',                 'max' => 120],
        'email'        => ['label' => 'Email',                'max' => 160],
        'phone'        => ['label' => 'Phone',                'max' => 40],
        'organisation' => ['label' => 'Organisation / church', 'max' => 160],
        'role'         => ['label' => 'Role',                 'max' => 120],
        'eventDate'    => ['label' => 'Preferred date',       'max' => 80],
        'location'     => ['label' => 'Location / venue',     'max' => 160],
        'voicePart'    => ['label' => 'Voice part / area',    'max' => 80],
    ];
}

const ENQUIRY_MESSAGE_MAX = 4000;
const ENQUIRY_KEEP        = 400;   // most recent enquiries retained on disk

// ---------------------------------------------------------------- rate limit
// Per-IP, file-backed. A form nobody is abusing costs one small read; a bot
// gets a 429 before any mail is sent. Deliberately generous — a genuine person
// re-sending because they mistyped something must not be locked out.
//
// Checking and recording are separate on purpose. Only an enquiry that was
// actually accepted spends budget: a rejected one sends no mail and writes no
// record, so charging for it would mean three mistyped email addresses locked
// someone out for an hour — punishing exactly the person the form is for.
const ENQUIRY_RATE_MAX     = 6;
const ENQUIRY_RATE_WINDOW  = 3600; // seconds

// Hashed: the raw IP is personal data, and there is no reason to keep it in a
// filename that persists on disk.
function enquiry_rate_path(string $ip): ?string
{
    $dir = DATA_DIR . '/rate';
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        log_warn('Rate-limit directory not writable, enquiry allowed through', ['dir' => $dir]);
        return null;
    }
    return $dir . '/enq-' . hash('sha256', $ip) . '.json';
}

// Timestamps inside the current window, oldest first.
function enquiry_rate_hits(?string $path): array
{
    if ($path === null || !is_file($path)) return [];

    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) return [];

    $cutoff = time() - ENQUIRY_RATE_WINDOW;
    return array_values(array_filter($decoded, fn($t) => is_int($t) && $t > $cutoff));
}

function enquiry_rate_ok(string $ip): bool
{
    $path = enquiry_rate_path($ip);
    // Can't track it — allow, rather than block a legitimate enquiry over a
    // filesystem problem the visitor can do nothing about.
    if ($path === null) return true;

    return count(enquiry_rate_hits($path)) < ENQUIRY_RATE_MAX;
}

// Called only once an enquiry has been accepted and stored.
function enquiry_rate_record(string $ip): void
{
    $path = enquiry_rate_path($ip);
    if ($path === null) return;

    $hits = enquiry_rate_hits($path);
    $hits[] = time();
    file_put_contents($path, json_encode($hits), LOCK_EX);
}

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

// ---------------------------------------------------------------- handler
function submit_enquiry(): void
{
    $body = read_json_body();

    // Honeypot: a field positioned off-screen and left empty by anyone actually
    // reading the page. Answer 200 so a bot filling it learns nothing.
    if (clean_string($body['website'] ?? '', 200) !== '') {
        log_warn('Enquiry rejected: honeypot filled', ['ip' => client_ip()]);
        json_out(['ok' => true]);
    }

    if (!enquiry_rate_ok(client_ip())) {
        error_out('Too many messages from this connection. Please try again a little later.', 429);
    }

    $topics = enquiry_topics();
    $topic  = clean_string($body['topic'] ?? '', 40);
    if (!isset($topics[$topic])) $topic = 'general';

    // Collect the allowlisted fields, keeping only the ones actually filled.
    $values = [];
    foreach (enquiry_fields() as $key => $spec) {
        $value = clean_string($body[$key] ?? '', $spec['max']);
        if ($value !== '') $values[$key] = $value;
    }

    $message = clean_string($body['message'] ?? '', ENQUIRY_MESSAGE_MAX);

    // Name and a reachable email are the minimum for a reply to be possible;
    // without a message there is nothing to reply about.
    $name  = $values['name']  ?? '';
    $email = $values['email'] ?? '';

    if ($name === '') {
        error_out('Please tell us your name.', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_out('Please enter a valid email address so we can reply.', 422);
    }
    if ($message === '') {
        error_out('Please include a short message.', 422);
    }

    $id = bin2hex(random_bytes(12));

    // Labelled in the order enquiry_fields() declares, so every email the
    // chorale receives reads the same way regardless of which form sent it.
    $labelled = ['Enquiry type' => $topics[$topic]['label']];
    foreach (enquiry_fields() as $key => $spec) {
        if (isset($values[$key])) $labelled[$spec['label']] = $values[$key];
    }

    $record = [
        'id'          => $id,
        'topic'       => $topic,
        'fields'      => $labelled,
        'name'        => $name,
        'email'       => $email,
        'message'     => $message,
        'heading'     => $topics[$topic]['heading'],
        'subject'     => $topics[$topic]['heading'] . ' — ' . $name,
        'submittedAt' => date('D j M Y, H:i'),
        'receivedAt'  => date('c'),
        'ip'          => client_ip(),
    ];

    // Written before the send, and kept whether or not the send succeeds. Mail
    // is the part most likely to break on a shared host, and an enquiry that
    // was submitted but not delivered must still be recoverable from the admin
    // rather than lost with only a log line to show for it.
    $all = store_read('enquiries', []);
    if (!is_array($all)) $all = [];
    array_unshift($all, $record);
    store_write('enquiries', array_slice($all, 0, ENQUIRY_KEEP));

    // Charged here, not at the top: the enquiry is real and has cost us a write
    // and a send. Rejected submissions cost neither and are not counted.
    enquiry_rate_record(client_ip());

    $sent = send_enquiry_email($record);

    if (!$sent) {
        log_error('Enquiry stored but not emailed', [
            'enquiryId' => $id,
            'topic'     => $topic,
            'to'        => enquiry_recipient(),
        ]);
    } else {
        log_info('Enquiry received', ['enquiryId' => $id, 'topic' => $topic]);
    }

    // The visitor's message is safely recorded either way, so this reports
    // success. Telling someone their message failed — when it is sitting in the
    // store waiting to be read — would only make them send it again.
    json_out(['ok' => true, 'id' => $id]);
}

route([
    'POST' => 'submit_enquiry',
]);
