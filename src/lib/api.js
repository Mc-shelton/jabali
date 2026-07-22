// API client for the PHP backend.
//
// Public reads (events, jabali5) fall back to the bundled static data when the
// API can't be reached — so the site still renders in local dev (no PHP) and
// before the backend is deployed. Admin calls have no fallback: they require the
// server and throw on failure.
import { upcomingEvents, pastEvents, getEventBySlug } from '../data/events';
import { jabaliFive } from '../data/jabali5';
import { contentSeed } from '../data/content';

const BASE = '/api';
const CSRF_KEY = 'jc_csrf';

let csrf = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(CSRF_KEY) : null;

const setCsrf = (token) => {
  csrf = token || null;
  if (typeof sessionStorage === 'undefined') return;
  if (token) sessionStorage.setItem(CSRF_KEY, token);
  else sessionStorage.removeItem(CSRF_KEY);
};

// Core request. `mutating` calls attach the CSRF header.
async function request(path, { method = 'GET', body, headers = {}, isForm = false } = {}) {
  const opts = { method, credentials: 'include', headers: { ...headers } };

  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // FormData — let the browser set the boundary
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  if (method !== 'GET' && csrf) {
    opts.headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(`${BASE}/${path}`, opts);
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // The endpoint returned something that isn't JSON — usually PHP that isn't
    // executing (misconfigured host, or local dev with no PHP).
    const err = new Error('The server did not return a valid response. Is PHP running?');
    err.status = res.status;
    err.nonJson = true;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------- public reads
export async function fetchEvents() {
  try {
    return await request('events.php');
  } catch {
    return { upcoming: upcomingEvents, past: pastEvents };
  }
}

export async function fetchEvent(slug) {
  try {
    return await request(`events.php?slug=${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err.status === 404) return null;
    const fallback = getEventBySlug(slug);
    return fallback ?? null;
  }
}

// ---------------------------------------------------------------- ticket checkout
// Public M-Pesa flow. No fallback — these require the server.
export const initiateTicketPayment = (payload) =>
  request('tickets.php', { method: 'POST', body: payload });

// `force` is the customer pressing Refresh: it skips the server-side rate limit
// and asks Daraja right now.
export const getPaymentStatus = (orderId, { force = false } = {}) =>
  request(`tickets.php?orderId=${encodeURIComponent(orderId)}${force ? '&force=1' : ''}`);

// ---------------------------------------------------------------- enquiries
// The contact and join forms. No fallback: unlike a page read, there is nothing
// useful to substitute for a message that wasn't delivered, so a failure has to
// surface to the person who wrote it.
export const sendEnquiry = (payload) =>
  request('enquiries.php', { method: 'POST', body: payload });

export async function fetchJabali5() {
  try {
    return await request('jabali5.php');
  } catch {
    return jabaliFive;
  }
}

// A content section. Falls back to the bundled seed on any failure — including
// the 404 the server returns for a section nobody has saved yet, which is
// exactly the "nothing stored, keep the defaults" case.
export async function fetchContent(section) {
  try {
    return await request(`content.php?section=${encodeURIComponent(section)}`);
  } catch {
    return contentSeed(section);
  }
}

// ---------------------------------------------------------------- admin
export async function getSession() {
  const data = await request('auth.php');
  if (data.csrf) setCsrf(data.csrf);
  return data;
}

// `username` selects which credential is being offered. The admin form omits
// it, which the server reads as the admin credential.
export async function login(password, username) {
  const body = username ? { username, password } : { password };
  const data = await request('auth.php', { method: 'POST', body });
  if (data.csrf) setCsrf(data.csrf);
  return data;
}

// ---------------------------------------------------------------- merchandise
// Products live once in the catalogue; events reference them by id.
export const fetchMerch = () => request('merch.php');
export const fetchMerchProduct = (id) => request(`merch.php?id=${encodeURIComponent(id)}`);
export const createMerchProduct = (data) => request('merch.php', { method: 'POST', body: data });
export const updateMerchProduct = (id, data) =>
  request(`merch.php?id=${encodeURIComponent(id)}`, { method: 'PUT', body: data });
export const deleteMerchProduct = (id) =>
  request(`merch.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
export const saveMerchPromos = (promoCodes) =>
  request('merch.php?promos=1', { method: 'PUT', body: { promoCodes } });

// One-time: lifts products still defined inside events into the catalogue.
export const importMerchFromEvents = () =>
  request('merch.php?import=1', { method: 'POST' });

// ---------------------------------------------------------------- settings
export const adminFetchSettings = () => request('settings.php');
export const saveSettings = (data) => request('settings.php', { method: 'PUT', body: data });

export async function logout() {
  await request('auth.php?logout=1', { method: 'POST' });
  setCsrf(null);
}

export const adminFetchEvents = () => request('events.php');
export const createEvent = (data) => request('events.php', { method: 'POST', body: data });
export const updateEvent = (slug, data) =>
  request(`events.php?slug=${encodeURIComponent(slug)}`, { method: 'PUT', body: data });
export const deleteEvent = (slug) =>
  request(`events.php?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });

export const adminFetchJabali5 = () => request('jabali5.php?raw=1');
export const saveJabali5 = (data) => request('jabali5.php', { method: 'PUT', body: data });

export const adminFetchOrders = () => request('orders.php');

// Re-query every unsettled order against M-Pesa. Recovers orders that status
// polling wrongly marked failed while the customer was still paying.
export const reconcileOrders = () => request('orders.php?reconcile=1', { method: 'POST' });

// Re-delivers the confirmation for an order that is already paid. Resolves with
// { ok, error } — ok:false is a mail failure, not a request failure, so it does
// not reject and the caller shows the reason instead of a generic error.
export const resendConfirmation = (orderId) =>
  request(`orders.php?resend=${encodeURIComponent(orderId)}`, { method: 'POST' });

// ---------------------------------------------------------------- door
// Looking a code up is a read, and safe to call as often as the camera fires —
// it never consumes the ticket. Only admitTicket does that, and only once.
export const lookupTicket = (code) =>
  request(`admit.php?code=${encodeURIComponent(code)}`);

export const admitTicket = (code) =>
  request(`admit.php?code=${encodeURIComponent(code)}`, { method: 'POST' });

// ---------------------------------------------------------------- logs
export const adminFetchLogs = ({ day = '', level = '' } = {}) => {
  const params = new URLSearchParams();
  if (day) params.set('day', day);
  if (level) params.set('level', level);
  const qs = params.toString();
  return request(`logs.php${qs ? `?${qs}` : ''}`);
};

export const clearLogs = (day) =>
  request(`logs.php?day=${encodeURIComponent(day)}`, { method: 'DELETE' });

// The content schema drives the admin forms, so the UI never hardcodes a field
// list — add a field in _sections.php and it appears here.
export const adminFetchContentSchema = () => request('content.php?schema=1');
export const adminFetchContent = (section) =>
  request(`content.php?section=${encodeURIComponent(section)}`);
export const saveContent = (section, data) =>
  request(`content.php?section=${encodeURIComponent(section)}`, { method: 'PUT', body: data });

// `folder` files the image by subject (events / members / gallery / site). The
// server whitelists it and falls back to events, so an unknown value is safe.
export async function uploadImage(file, folder) {
  const form = new FormData();
  form.append('image', file);
  if (folder) form.append('folder', folder);
  const data = await request('upload.php', { method: 'POST', body: form, isForm: true });
  return data.url;
}

export async function uploadMedia(file, folder = 'music') {
  const form = new FormData();
  form.append('file', file);
  form.append('folder', folder);
  const data = await request('media-upload.php', { method: 'POST', body: form, isForm: true });
  return data.url;
}
