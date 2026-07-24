// Cookie-consent state, shared by the banner and the analytics loader.
//
// A single localStorage key records the visitor's choice so we don't ask again
// on every visit. Kenya's Data Protection Act (2019) treats analytics cookies
// as requiring consent, so nothing that sets a cookie runs before this says so.
//
// Values: 'granted' | 'denied' | null (undecided — show the banner).

const KEY = 'jc_consent';

const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // private mode / storage disabled — treat as undecided
  }
}

export function consentDecision() {
  return read(); // 'granted' | 'denied' | null
}

export function hasConsent() {
  return read() === 'granted';
}

// Persist the choice and notify the analytics loader. Declining is remembered
// too, so we honour it rather than re-prompting every visit.
export function setConsent(granted) {
  try {
    localStorage.setItem(KEY, granted ? 'granted' : 'denied');
  } catch {
    /* storage disabled — the in-memory notify below still works this session */
  }
  listeners.forEach((fn) => fn(granted));
}

// Subscribe to consent changes. Returns an unsubscribe function.
export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
