# Jabali Chorale — deployment

The site is a React single-page app with a small PHP backend on cPanel. Content,
events, orders and logs are JSON files on the server — there is no database.

**Pushing to `main` deploys automatically.** Building and zipping by hand is no
longer part of the process.

---

## 1. Read this first: what must never be overwritten

Four things live **only on the server**. They are not in git and the pipeline
never uploads them:

| Path | Holds | If overwritten |
|---|---|---|
| `api/config.php` | M-Pesa keys, admin password | Payments and login break |
| `api/data/` | Site content, events, **orders**, logs | Customer orders lost |
| `uploads/` | Member and gallery photos | Photos lost |
| `bucket/` | Music and other server-managed media | Music and media lost |

This is why the old "zip `dist/` and upload it" step was dangerous: `dist/`
contains seed copies of `api/data/`, so every manual upload overwrote live
content and order history with stale defaults.

The pipeline strips those directories out of the build before it connects, and
excludes them again during the sync — two independent safeguards.

Audio uploaded from Admin → Site content → Music is written to
`bucket/website/music/`. The PHP user must have write permission there, and the
host's `upload_max_filesize` and `post_max_size` must permit the desired file
size (the application itself caps media uploads at 50 MB).

---

## 2. One-time setup

### a. Server: create `config.php`

In cPanel → File Manager, go to `public_html/api/` and copy
`config.example.php` to `config.php`, then fill in:

- `ADMIN_PASSWORD_HASH` — generate in cPanel → Terminal:
  `php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"`
- The `MPESA` block — from the Daraja portal
- `MAIL` — a `from_email` on this domain

`config.php` is git-ignored. **Never commit a filled-in copy: this repository is
public.** If credentials ever reach a commit, rotate them in Daraja immediately —
scrapers watch public repos for exactly these keys.

To receive payments made directly from the M-Pesa Pay Bill menu, also set
`MPESA['c2b_callback_key']` to a long random value:

```
php -r "echo bin2hex(random_bytes(24)), PHP_EOL;"
```

Then register these two public HTTPS URLs for the live shortcode under Daraja's
C2B Confirmation and Validation URL settings (replace `SECRET` with that value):

```
Confirmation: https://jabalichorale.com/api/c2b-confirm.php?key=SECRET
Validation:   https://jabalichorale.com/api/c2b-validate.php
```

The neutral filenames are intentional: Daraja URL Management rejects URLs
containing reserved terms such as `mpesa`, `M-PESA`, `Safaricom`, `query`, and
`sql` even when the endpoint itself is valid.

This registration is separate from the Lipa na M-Pesa Online/STK callback.
After Safaricom confirms the URLs, a direct PayBill payment appears in
Admin → Orders as **Unclaimed**. Duplicate notifications are ignored, and a
receipt already attached to a paid online order is not counted twice.

New STK orders also send a unique 12-character `AccountReference` to M-Pesa and
store it as `paymentReference`. C2B reconciliation first checks the exact
receipt (`TransID`), then the exact account reference (`BillRefNumber`). This
second key prevents a known online order becoming Unclaimed when its STK result
was recovered by status query before the receipt-bearing callback arrived.

The confirmation receiver does not acknowledge a callback until its exact body
has been flushed to the append-only `api/data/mpesa_c2b_inbox.ndjson` ledger.
The normal payment store is then written by atomic replacement. If parsing or
that second write fails, Orders continues reading the durable ledger and retries
materialisation whenever an administrator opens the page. A red warning appears
when a captured callback still needs attention, with a matching reference in
Admin → Logs. Do not delete or overwrite the inbox ledger; include it in server
backups alongside `orders.json`.

### b. Server: seed the data directory (first deploy only)

Because `api/data/` is never deployed, upload it by hand **once**:

1. Build locally: `npm run build`
2. Upload `dist/api/data/*.json` to `public_html/api/data/`
3. Confirm `public_html/api/data/.htaccess` exists (it blocks web access)
4. Create `public_html/api/data/logs/` and upload its `.htaccess` too

After this, the dashboard owns that folder. Never upload over it again.

### c. GitHub: secrets and variables

Repo → Settings → Secrets and variables → Actions.

**Secrets** tab — credentials, masked in logs:

| Secret | Value | Where to find it |
|---|---|---|
| `FTP_HOST` | e.g. `jabalichorale.com` | cPanel → FTP Accounts → Configure FTP Client |
| `FTP_USER` | full username, e.g. `deployment_ftp@jabalichorale.com` | same page |
| `FTP_PASSWORD` | that account's password | set when creating the account |

**Variables** tab — deliberately *not* secrets:

| Variable | Value |
|---|---|
| `FTP_PATH` | `public_html` — **no leading slash**, see below |
| `SITE_URL` | `https://jabalichorale.com` |
| `VITE_GA_ID` | *(optional)* Google Analytics 4 Measurement ID, `G-XXXXXXXXXX` |
| `VITE_CLARITY_ID` | *(optional)* Microsoft Clarity project id |

The two `VITE_*` variables turn on analytics — see *§7. Analytics* below. Leave
them unset and the site tracks nobody and shows no cookie banner. They are not
credentials (they ship in the client bundle either way), so they belong in
Variables, not Secrets.

Neither `FTP_PATH` nor `SITE_URL` is a credential, and making them secrets actively hurts. lftp echoes its
target path, so a masked `FTP_PATH` turns the whole listing into `***/***` —
exactly the detail you need when a deploy lands in the wrong folder.

### d. The two FTP gotchas that will cost you an hour

**The account's directory is fixed at creation.** cPanel offers Change Password,
Change Quota, Delete — but no way to change the directory afterwards. If it is
wrong you must delete the account and recreate it. When creating it, the
Directory box has a fixed `/home2/<user>/` prefix; typing `public_html` there
gives `/home2/<user>/public_html`. Leaving it blank silently gives you the whole
home directory instead.

**`FTP_PATH` is relative, with no leading slash.** These accounts are not
chrooted, so `/public_html` means the *filesystem* root and fails with:

```
550 Can't change directory to /public_html: No such file or directory
```

`public_html` — relative to wherever login lands — is what works. If in doubt,
the **Show remote layout** step prints where the account lands and what it can
reach, before anything is written.

---

## 3. Deploying

### Normal

```
git push origin main
```

That runs: PHP lint → deprecated-call sweep → secret-tracking check → test
suites → `npm run build` → FTPS sync → smoke test. **Any failure stops the
deploy**; nothing reaches the live site.

Watch it in the repo's **Actions** tab. Typical run: ~90 seconds.

### The first run — do a dry run

Before the first real deploy, Actions → *Build and deploy* → **Run workflow**,
tick **dry run**. It reports exactly what it would upload without writing
anything. Check the list contains no `api/data` or `uploads` paths, then run it
again for real.

One caveat worth knowing: **`lftp --dry-run` never connects to check the
target directory.** A green dry run proves the file list is correct — it does
not prove `FTP_PATH` exists. A wrong path still fails on the real run with the
550 above.

### Cleaning up stale files

The sync adds and updates, but does **not** delete by default. Vite fingerprints
its filenames, so old bundles simply accumulate harmlessly. Deleting is the only
operation that can destroy data if a path exclusion is wrong, so it is opt-in:

Run workflow → tick **dry run** *and* **prune** → read the deletion list
carefully → if it only lists old `assets/*` files, run again with **prune** only.

---

## 4. What the pipeline checks before deploying

`php tests/run.php` — also runnable locally:

- **PHP lint** on every API file
- **Deprecated-call sweep** for `curl_close`, `finfo_close`, `strftime`, … These
  print a notice ahead of the JSON body, which makes a successful request look
  like a network failure to the browser. It has broken the M-Pesa status check
  once already, so it is now a build error.
- **Secret-tracking check** — fails if `config.php` or `dist.zip` is tracked
- **88 tests** — content schema, merch pricing, log handler, fulfilment isolation

---

## 5. Routine admin

- **Content, events, Jabali @5** — `/admin` on the live site
- **Orders** — `/admin/orders`. Filter and sort; **Re-check with M-Pesa**
  re-queries unsettled payments and recovers any wrongly marked failed
- **Logs** — `/admin/logs`. Server errors and M-Pesa activity, 14-day retention.
  An error shown to a user carries a reference (e.g. `DDA379`) you can find here

### An order says paid but shows "no email sent"

The payment is fine; the confirmation didn't go out. Check `/admin/logs` for the
reason. If it says `mail() is unavailable`, the host has disabled PHP `mail()`
and the mailer needs switching to authenticated SMTP.

---

## 6. Troubleshooting

**"Server not configured: api/config.php is missing"** — step 2a wasn't done, or
the file is outside `public_html/api/`.

**Admin login fails after a deploy** — `config.php` was overwritten or removed.
It should never be touched by the pipeline; check the workflow run for a
`Refuse to deploy a bundled config.php` failure.

**Site loads but content is the old defaults** — `api/data/` is missing on the
server, so every section 404s and the app falls back to its bundled seeds. The
site stays up by design. Re-do step 2b.

**M-Pesa callbacks never arrive** — `callback_url` in `config.php` must be a
public HTTPS URL ending `/api/mpesa-callback.php`. Safaricom cannot reach
localhost, and will not accept a plain-HTTP callback.

**Direct PayBill payments do not appear as Unclaimed** — the shortcode's C2B
Confirmation and Validation URLs are registered separately from the STK
callback. Check the two URLs and `c2b_callback_key` from step 2a, then look in
Admin → Logs for `C2B confirmation not captured`, `captured; materialisation
deferred`, or `Direct PayBill payment durably received`. If Orders reports that
a callback needs review, preserve both `mpesa_c2b_inbox.ndjson` and
`mpesa_c2b.json` before repairing anything—the inbox is the recovery source.

---

## 7. Analytics

Traffic and behaviour tracking is off until you supply IDs, and it asks each
visitor's consent before setting any cookie.

**Two tools, each optional and independent:**

- **Google Analytics 4** (`VITE_GA_ID`) — page views, the buy funnel
  (`view_item → begin_checkout → purchase`), enquiry leads (`generate_lead`),
  and a `ui_click` event on every button/link so you can see what people press.
- **Microsoft Clarity** (`VITE_CLARITY_ID`) — heatmaps and session replay. This
  is the tool that actually *draws* heatmaps; GA counts the clicks, Clarity
  shows you where they land.

**To turn it on:**

1. Create a GA4 property (and/or a Clarity project) and copy the ID.
2. Add `VITE_GA_ID` / `VITE_CLARITY_ID` under repo → Settings → Secrets and
   variables → Actions → **Variables** (see §2c).
3. Push to `main`. The next build inlines the IDs; nothing else to do server-side.

For local testing, copy `.env.example` to `.env`, fill in the IDs, and run
`npm run build` / `npm run dev`.

**Privacy.** GA runs under Consent Mode v2 — until a visitor accepts the cookie
banner it sends only cookieless, modelled pings; Clarity doesn't load at all.
Declining is remembered. Admin and the member portal are never tracked. IP
anonymisation is on. This is the shape Kenya's Data Protection Act expects; if
you change what's tracked, revisit the banner wording in
`src/components/ConsentBanner.jsx`.

**Where to look.** Reports live in the GA and Clarity dashboards, not in
`/admin` — those are Google/Microsoft products, outside this app.
