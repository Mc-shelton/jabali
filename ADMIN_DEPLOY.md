# Jabali Chorale — Admin & Backend Deployment (cPanel)

The site is a React single-page app with a small PHP backend. The admin lets you
create/edit **events** and edit the **Jabali @5** journey. Data is stored as JSON
files on the server (no database needed).

## What's where

```
public/
  api/                 PHP backend  → deploys to public_html/api
    auth.php           login / logout / session
    events.php         events CRUD
    jabali5.php        Jabali @5 config
    upload.php         image upload
    config.php         ← EDIT THIS (password + paths)
    _bootstrap.php     shared engine (not web-accessible)
    data/              events.json, jabali5.json (blocked from the web)
  uploads/events/      uploaded images → public_html/uploads/events
```

## Deploy steps

1. **Build the site**
   ```
   npm install
   npm run build
   ```
   This produces `dist/`, which already contains `api/`, `uploads/`, and the
   `.htaccess` files.

2. **Upload** the **contents of `dist/`** into `public_html` on cPanel (so you get
   `public_html/index.html`, `public_html/api/…`, `public_html/uploads/…`).

3. **Set the admin password.** Open `public_html/api/config.php` in cPanel's File
   Manager and change:
   ```php
   const ADMIN_PASSWORD = 'jabali-admin';   // ← change this
   ```
   (Optional, stronger: generate a hash in cPanel Terminal with
   `php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"`,
   paste it into `ADMIN_PASSWORD_HASH`, and blank out `ADMIN_PASSWORD`.)

4. **Check folder permissions.** These must be writable by PHP (usually `755`,
   or `775` if your host runs PHP as a separate user):
   - `public_html/api/data`
   - `public_html/uploads/events`

5. **Confirm PHP version** is 7.4+ (8.x recommended) in cPanel → *MultiPHP Manager*.

6. Visit **`https://yourdomain.com/admin`** and sign in.

## ⚠️ Redeploying / updating the site later

`api/data/` (your events + Jabali @5 content) and `uploads/` (your images) hold
**live data that the admin created**. The `dist/` build ships *seed* copies of
these. When you re-upload a new build, **do not overwrite these two folders** or
you'll reset everything to the seed:

- Re-upload everything in `dist/` **except** `api/data/` and `uploads/`, **or**
- Download `api/data/*.json` and the `uploads/` images first, then restore them
  after uploading.

Only the very first deploy needs the seed data.

## Notes

- **Nothing to configure in the app** — the frontend calls `/api/…` on the same
  domain. If the API is ever unreachable, the public pages fall back to the last
  data bundled at build time, so the site never shows an empty page.
- **The domain must be the site root.** If you deploy into a subfolder, the
  `/api` and `/admin` paths need adjusting — tell your developer.
- **Backups:** download `api/data/events.json` and `api/data/jabali5.json`.
- **Security built in:** hashed/const-time password check, HttpOnly Lax session
  cookie, CSRF token on every write, upload type/size validation by real MIME
  (JPEG/PNG/WebP, ≤6 MB), the data folder blocked from the web, and script
  execution disabled in `uploads/`.

## M-Pesa ticket payments (STK Push)

Buying a ticket opens a checkout (buyer details → M-Pesa number → STK prompt →
success/failure). It uses Safaricom Daraja. To turn it on, edit the `MPESA`
block in `public_html/api/config.php`:

- `env` → `'sandbox'` for testing, `'production'` when live.
- `consumer_key` / `consumer_secret` → from your Daraja app.
- `shortcode` → your Paybill or Till (Business Short Code).
- `passkey` → the Lipa na M-Pesa Online passkey.
- `transaction_type` → `CustomerPayBillOnline` (Paybill) or `CustomerBuyGoodsOnline` (Till).
- `callback_url` → must be the **public HTTPS** URL to the callback on this
  domain: `https://jabalichorale.com/api/mpesa-callback.php`. Register/allow this
  URL in your Daraja app. Safaricom must be able to reach it (no auth, no IP block).

Notes:
- Prices come from the event's ticket packages — the amount is computed on the
  server, never sent by the browser.
- Optional `PROMO_CODES` in `config.php` apply a percent or flat discount.
- Orders are recorded in `api/data/orders.json` (blocked from the web; contains
  buyer name/email/phone + M-Pesa receipt). Until M-Pesa is configured, the
  checkout shows a friendly "not set up yet" message instead of failing.
- Requires PHP `curl` (standard on cPanel).

## Local development

`npm run dev` runs the React app only (no PHP), so the admin login screen appears
but sign-in won't work locally — that needs the PHP server. The public pages work
in dev using the bundled fallback data.
