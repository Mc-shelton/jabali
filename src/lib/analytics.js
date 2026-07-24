// First-party analytics: Google Analytics 4 (traffic + funnel events + clicks)
// and Microsoft Clarity (heatmaps + session replay).
//
// Nothing loads and nothing is sent until BOTH of two things are true:
//   1. a measurement ID is configured  (VITE_GA_ID / VITE_CLARITY_ID), and
//   2. the visitor has accepted cookies (see ConsentBanner + consent.js).
//
// This mirrors how the backend treats config.php: the feature is inert until
// the operator opts in, so local dev and un-configured deploys track nobody.
// The IDs are build-time env vars — Vite inlines import.meta.env at build, so
// they must be present in the environment that runs `npm run build`.
//
// GA4 runs under Consent Mode v2, defaulting every storage bucket to "denied".
// Until the banner grants analytics_storage, GA sends only cookieless, modelled
// pings; Clarity does not load at all until consent, as it has no equivalent
// cookieless mode.

import { hasConsent, onConsentChange } from './consent';

const GA_ID = import.meta.env.VITE_GA_ID || '';
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID || '';

// Guard against double-injection (StrictMode mounts effects twice in dev).
let gaScriptLoaded = false;
let clarityLoaded = false;
let clickListenerBound = false;

// gtag pushes onto the dataLayer; defining it up front means events queued
// before the script arrives are replayed once it does.
function gtag() {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

export const analyticsEnabled = Boolean(GA_ID || CLARITY_ID);

// The whole app is one Vite entry, so /admin and the member portal share this
// document. They are staff areas — keep their traffic out of the public numbers.
function isInternalPath(path = window.location.pathname) {
  return path.startsWith('/admin') || path.startsWith('/members');
}

// ---------------------------------------------------------------- GA4 loader
function loadGA() {
  if (gaScriptLoaded || !GA_ID) return;
  gaScriptLoaded = true;

  window.dataLayer = window.dataLayer || [];

  // Consent Mode v2: deny everything by default. This runs before the config
  // call, so GA respects it from the very first hit.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);

  gtag('js', new Date());
  // send_page_view:false — this is a single-page app, so we send one page_view
  // per route change ourselves (see pageview) rather than letting GA guess.
  gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true });
}

// ---------------------------------------------------------------- Clarity loader
function loadClarity() {
  if (clarityLoaded || !CLARITY_ID) return;
  clarityLoaded = true;

  // Official Clarity snippet, inlined so the ID comes from env.
  (function (c, l, a, r, i, t, y) {
    c[a] =
      c[a] ||
      function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
    t = l.createElement(r);
    t.async = 1;
    t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', CLARITY_ID);
}

// ---------------------------------------------------------------- click tracking
// Approximates a heatmap in GA4: every click on a link, button, or element
// explicitly marked data-track is reported with a human-readable label. Clarity
// records the true visual heatmap; this makes the same signal queryable in GA.
function bindClickTracking() {
  if (clickListenerBound) return;
  clickListenerBound = true;

  document.addEventListener(
    'click',
    (e) => {
      if (isInternalPath()) return;
      const el = e.target?.closest?.('a, button, [data-track]');
      if (!el) return;

      // Prefer an explicit label, then aria-label, then trimmed text.
      const label =
        el.getAttribute('data-track') ||
        el.getAttribute('aria-label') ||
        (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) ||
        el.tagName.toLowerCase();

      const params = {
        link_text: label,
        element: el.tagName.toLowerCase(),
        page_path: window.location.pathname,
      };

      const href = el.getAttribute?.('href');
      if (href) params.link_url = href;

      trackEvent('ui_click', params);
    },
    { capture: true, passive: true },
  );
}

// ---------------------------------------------------------------- lifecycle
// Called once at app start. Wires up the consent listener; if consent was
// already granted in a previous visit, everything comes up immediately.
export function initAnalytics() {
  if (!analyticsEnabled) return;

  const activate = () => {
    loadGA();
    loadClarity();
    bindClickTracking();
    if (GA_ID) {
      gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
      // The very first page_view after activation — subsequent ones come from
      // the route-change hook.
      pageview(window.location.pathname + window.location.search);
    }
  };

  if (hasConsent()) activate();
  onConsentChange((granted) => {
    if (granted) activate();
  });
}

// ---------------------------------------------------------------- public API
// The last path we sent, so an initial view fired at activation and the one
// App.jsx fires on mount (same path, two code paths) don't double-count.
let lastPath = null;

export function pageview(path) {
  if (!GA_ID || !hasConsent() || path === lastPath || isInternalPath(path)) return;
  lastPath = path;
  gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    page_title: document.title,
  });
}

export function trackEvent(name, params = {}) {
  if (!GA_ID || !hasConsent() || isInternalPath()) return;
  gtag('event', name, params);
}

// ---- ecommerce funnel helpers (GA4 recommended event names) ---------------
const money = (v) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0;

// One item shaped for GA4's `items` array.
function toItem(product, extra = {}) {
  return {
    item_id: String(product.id ?? product.slug ?? product.name ?? ''),
    item_name: product.name ?? '',
    price: money(product.priceFinal ?? product.price),
    ...extra,
  };
}

export function viewItem(product, category = 'merch') {
  if (!product) return;
  trackEvent('view_item', {
    currency: 'KES',
    value: money(product.priceFinal ?? product.price),
    items: [toItem(product, { item_category: category })],
  });
}

export function beginCheckout({ item, quantity = 1, value, kind = 'ticket' }) {
  if (!item) return;
  trackEvent('begin_checkout', {
    currency: 'KES',
    value: money(value),
    items: [toItem(item, { item_category: kind, quantity })],
  });
}

export function purchase({ orderId, value, item, quantity = 1, kind = 'ticket', receipt }) {
  trackEvent('purchase', {
    transaction_id: String(orderId ?? receipt ?? ''),
    currency: 'KES',
    value: money(value),
    items: item ? [toItem(item, { item_category: kind, quantity })] : [],
  });
}

export function generateLead(topic) {
  trackEvent('generate_lead', { form_topic: topic || 'enquiry' });
}
