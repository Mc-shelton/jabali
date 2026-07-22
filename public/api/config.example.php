<?php
// ---------------------------------------------------------------------------
// Jabali Chorale admin API — configuration TEMPLATE.
//
// Copy this to config.php ON THE SERVER and fill in the real values:
//     cp api/config.example.php api/config.php
//
// config.php is git-ignored and is NEVER deployed by the pipeline, so the live
// secrets exist in exactly one place: the server. Do not commit a filled-in
// copy — this repository is public.
// ---------------------------------------------------------------------------

// --------------------------------------------------------------- admin login
// Prefer the hash. Generate it in cPanel → Terminal:
//     php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
// If ADMIN_PASSWORD_HASH is non-empty it takes precedence and ADMIN_PASSWORD
// is ignored.
const ADMIN_PASSWORD = '';
const ADMIN_PASSWORD_HASH = '';

// Optional. The admin sign-in form asks only for a password, so this is not
// used there; it exists so the name can't collide with the member one.
const ADMIN_USERNAME = 'admin';

// --------------------------------------------------------------- member portal
// A SHARED credential for the choir, used at /members. It opens a portal that
// can do exactly one thing: search the roster and edit or add a member's name,
// voice part, church, and photo. It cannot reach events, orders, tickets,
// logs, or any other part of the site.
//
// Shared, not per-person: anyone with this password can edit ANY member's
// entry, not only their own. Hand it out on that understanding, and rotate it
// when someone leaves the chorale.
//
// Two independent switches have to be on before a member can sign in:
//   1. a password is set here, and
//   2. Member access is switched on in Admin → Member access.
// Either one off means no member sign-in. Leave the password blank and member
// access can never be opened, whatever the dashboard says.
//
// Generate the hash the same way as the admin one:
//     php -r "echo password_hash('their-password', PASSWORD_DEFAULT), PHP_EOL;"
const MEMBER_USERNAME = 'jabali-member';
const MEMBER_PASSWORD = '';
const MEMBER_PASSWORD_HASH = '';

// Data lives beside this file but is blocked from the web by api/data/.htaccess.
define('DATA_DIR', __DIR__ . '/data');

// The site's canonical origin, no trailing slash.
//
// Used by preview.php to build absolute og:image URLs for shared links — a
// crawler has no page context to resolve a relative path against, so a
// relative one previews with no image at all.
//
// Configured rather than taken from the request: the Host header comes from
// the client, and a spoofed one would put someone else's domain into the
// preview image URL of a link you shared. Left blank, it falls back to the
// request host so a staging copy still works.
const SITE_URL = 'https://jabalichorale.com';

// --------------------------------------------------------------- uploads
// Uploaded images must be web-reachable, so they go in the public web root.
// The folder comes from the admin UI but is only ever accepted from this
// whitelist — a client-supplied path must never reach the filesystem.
define('UPLOAD_BASE_DIR', dirname(__DIR__) . '/uploads');
const UPLOAD_BASE_URL = '/uploads';
const UPLOAD_FOLDERS = ['events', 'members', 'gallery', 'site'];
const UPLOAD_FOLDER_DEFAULT = 'events';

// Back-compat aliases for the original events-only upload path.
define('UPLOAD_DIR', UPLOAD_BASE_DIR . '/' . UPLOAD_FOLDER_DEFAULT);
const UPLOAD_URL = UPLOAD_BASE_URL . '/' . UPLOAD_FOLDER_DEFAULT;

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];

const SESSION_NAME = 'jc_admin';

// --------------------------------------------------------------- M-Pesa
// From your Daraja app + Lipa na M-Pesa (Paybill/Till) details.
//   env               'sandbox' while testing, 'production' when live.
//   shortcode         your Paybill or Till (Business Short Code).
//   transaction_type  'CustomerPayBillOnline' (Paybill) or
//                     'CustomerBuyGoodsOnline' (Till).
//   callback_url      MUST be a public HTTPS URL to mpesa-callback.php on this
//                     domain. M-Pesa cannot reach localhost.
//
// If these ever appear in a commit, treat them as compromised and rotate them
// in the Daraja portal — scrapers watch public repositories for exactly this.
const MPESA = [
    'env'               => 'sandbox',
    'consumer_key'      => '',
    'consumer_secret'   => '',
    'shortcode'         => '',
    'passkey'           => '',
    'transaction_type'  => 'CustomerPayBillOnline',
    'callback_url'      => 'https://example.com/api/mpesa-callback.php',
    'account_reference' => 'Jabali Chorale',
];

// Site-wide promo codes, checked after an event's own codes.
//   'JC10' => ['type' => 'percent', 'value' => 10]
//   'VIP'  => ['type' => 'flat',    'value' => 200]
const PROMO_CODES = [];

// --------------------------------------------------------------- email
//   from_email  should be an address ON this domain for deliverability
//               (set up SPF/DKIM in cPanel → Email Deliverability).
//   bcc         optional address copied on every confirmation. '' to skip.
// Where contact / partnership / booking / membership form submissions are sent.
// The forms post to api/enquiries.php, which stores every submission under
// DATA_DIR as well — so a message is never lost if mail delivery fails.
// Falls back to jabalichorale@gmail.com if left blank.
const ENQUIRY_TO = 'jabalichorale@gmail.com';

const MAIL = [
    'from_email' => 'tickets@example.com',
    'from_name'  => 'Jabali Chorale',
    'bcc'        => '',

    // REQUIRED on hosts that disable mail() — most shared cPanel plans do.
    // Check with:  php -r "echo ini_get('disable_functions');"
    // If 'mail' appears in that list, fill this in or no confirmation is sent.
    //
    // Create the mailbox in cPanel → Email Accounts, then use its full address
    // as the username. Connection Details on that page gives host and ports.
    //
    // 'port' and 'secure' MUST agree — this is the easiest thing here to get
    // wrong, and the two are not interchangeable:
    //
    //   'port' => 465,  'secure' => 'ssl'   implicit TLS: encrypted from the
    //                                       first byte, no plaintext greeting
    //   'port' => 587,  'secure' => 'tls'   STARTTLS: connect in the clear,
    //                                       then upgrade
    //
    // Mismatch them and the connection hangs rather than failing — the server
    // waits for a handshake while we wait for a greeting. The mailer rejects
    // the combination up front rather than letting a request block on it.
    //
    // Leave 'host' empty to fall back to mail().
    'smtp' => [
        'host'   => '',                        // e.g. mail.jabalichorale.com
        'port'   => 587,
        'user'   => '',                        // full address, e.g. tickets@jabalichorale.com
        'pass'   => '',
        'secure' => 'tls',
    ],
];
