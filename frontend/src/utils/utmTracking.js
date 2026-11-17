/**
 * UTM / referral-source tracking for CoinQuest.
 *
 * Stores two copies in localStorage["cq_src"]:
 *   first_touch – written once (or if older than 30 days)
 *   last_touch  – overwritten every time a UTM-carrying URL loads
 *
 * All reads/writes are wrapped in try/catch — Instagram's in-app browser
 * can block localStorage, and the page must still work.
 */

const LS_KEY   = 'cq_src';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Call on every page load. Reads current URL params and updates cq_src. */
export function captureUtm() {
  try {
    const params = new URLSearchParams(window.location.search);
    const hasUtm = UTM_KEYS.some((k) => params.get(k));
    if (!hasUtm) return; // no UTM params — leave both copies untouched

    const data = {};
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) data[k] = v;
    });
    const entry = { ...data, ts: Date.now() };

    let existing = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      existing = raw ? JSON.parse(raw) : null;
    } catch {}

    const result = (existing && typeof existing === 'object') ? { ...existing } : {};

    // first_touch: only write if absent or older than 30 days
    const ftAge = result.first_touch ? Date.now() - (result.first_touch.ts || 0) : Infinity;
    if (!result.first_touch || ftAge > THIRTY_DAYS_MS) {
      result.first_touch = entry;
    }

    // last_touch: always overwrite when UTM params are present
    result.last_touch = entry;

    localStorage.setItem(LS_KEY, JSON.stringify(result));
  } catch {}
}

/** Returns the full cq_src object { first_touch, last_touch }, or null. */
export function getSrc() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Returns a human-readable label for the last_touch source.
 * e.g. "whatsapp / ctwa / ladder"
 */
export function getSrcLabel(srcObj) {
  try {
    const lt = srcObj?.last_touch || {};
    return [lt.utm_source, lt.utm_campaign, lt.utm_content]
      .filter(Boolean)
      .join(' / ') || null;
  } catch {
    return null;
  }
}
