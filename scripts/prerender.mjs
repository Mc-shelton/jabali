// Build-time prerenderer for the fixed marketing routes.
//
// Vite outputs a single dist/index.html whose <head> carries the site-wide
// defaults. Every route serves that same file, so until JavaScript runs, a
// crawler sees the homepage's title and description on /about, /music, etc.
// Google eventually renders the JS and picks up the per-route tags our Seo
// component sets — but slower and less reliably than metadata already in the
// HTML, and non-JS crawlers never see them at all.
//
// So after `vite build`, this writes one dist/<route>/index.html per fixed
// route with the correct <title>, description, canonical, robots and social
// tags baked straight into the markup. The .htaccess serves a real directory
// before falling back to the SPA, so these are picked up automatically with no
// rewrite changes. The app still boots on top of them exactly as before.
//
// Event and product detail pages are deliberately NOT prerendered: they change
// through the admin at runtime, so public/preview.php produces their metadata
// live instead — a file frozen at deploy would go stale.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeSeo, organizationSchema, SITE_URL, DEFAULT_IMAGE } from '../src/data/seo.js';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');

// str.replace with a function avoids `$&`/`$1` in the value being interpreted
// as replacement patterns — descriptions contain apostrophes and punctuation,
// not deliberate backreferences.
const lit = (value) => () => value;

// Replace the content="" of an existing <meta> by its name/property, or, if the
// tag isn't in the template, insert a fresh one before </head>.
function setMeta(html, attr, key, value) {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, 'i');
  if (re.test(html)) {
    return html.replace(re, (_m, a, b) => a + escapeAttr(value) + b);
  }
  return injectHead(html, `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`);
}

function setTitle(html, value) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, lit(`<title>${escapeHtml(value)}</title>`));
}

function injectHead(html, snippet) {
  return html.replace(/<\/head>/i, lit(`    ${snippet}\n  </head>`));
}

// The template already carries a canonical (pointing at /), so replace its href
// rather than adding a second tag; inject only if none exists.
function setCanonical(html, url) {
  const re = /(<link\s+rel="canonical"\s+href=")[^"]*(")/i;
  if (re.test(html)) return html.replace(re, (_m, a, b) => a + escapeAttr(url) + b);
  return injectHead(html, `<link rel="canonical" href="${escapeAttr(url)}" />`);
}

const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderRoute(path, [title, description]) {
  const pageTitle = title.includes('Jabali Chorale') ? title : `${title} | Jabali Chorale`;
  const canonical = `${SITE_URL}${path}`;
  let html = template;

  html = setTitle(html, pageTitle);
  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  html = setMeta(html, 'property', 'og:title', pageTitle);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'property', 'og:url', canonical);
  html = setMeta(html, 'property', 'og:image', DEFAULT_IMAGE);
  html = setMeta(html, 'name', 'twitter:title', pageTitle);
  html = setMeta(html, 'name', 'twitter:description', description);

  html = setCanonical(html, canonical);

  // The homepage carries the organisation schema, mirroring the app.
  if (path === '/') {
    const json = JSON.stringify(organizationSchema).replace(/</g, '\\u003c');
    html = injectHead(html, `<script type="application/ld+json">${json}</script>`);
  }

  return html;
}

let count = 0;
for (const [path, meta] of Object.entries(routeSeo)) {
  const html = renderRoute(path, meta);
  // '/' overwrites dist/index.html in place; others get their own directory.
  const outDir = path === '/' ? dist : join(dist, path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  count += 1;
}

console.log(`prerender: wrote ${count} static route${count === 1 ? '' : 's'} into dist/`);
