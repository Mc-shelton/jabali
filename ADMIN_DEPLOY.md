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

This is why the old "zip `dist/` and upload it" step was dangerous: `dist/`
contains seed copies of `api/data/`, so every manual upload overwrote live
content and order history with stale defaults.

The pipeline strips those directories out of the build before it connects, and
excludes them again during the sync — two independent safeguards.

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

### b. Server: seed the data directory (first deploy only)

Because `api/data/` is never deployed, upload it by hand **once**:

1. Build locally: `npm run build`
2. Upload `dist/api/data/*.json` to `public_html/api/data/`
3. Confirm `public_html/api/data/.htaccess` exists (it blocks web access)
4. Create `public_html/api/data/logs/` and upload its `.htaccess` too

After this, the dashboard owns that folder. Never upload over it again.

### c. GitHub: add the secrets

Repo → Settings → Secrets and variables → Actions → *New repository secret*:

| Secret | Value | Where to find it |
|---|---|---|
| `FTP_HOST` | e.g. `jabalichorale.com` | cPanel → FTP Accounts → Configure FTP Client |
| `FTP_USER` | the FTP account username | same page |
| `FTP_PASSWORD` | that account's password | set when creating the account |
| `FTP_PATH` | `/public_html` | the web root for the domain |
| `SITE_URL` | `https://jabalichorale.com` | used by the post-deploy smoke test |

Use a dedicated FTP account scoped to `public_html`, not your main cPanel login.

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
