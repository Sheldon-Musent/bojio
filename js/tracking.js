// tracking.js — Logs page opens to Supabase with session and return-visit data

// ─── Supabase client ──────────────────────────────────────────────────────────

// Named trackingClient to avoid redeclaring supabaseClient from pins.js —
// both files load as plain scripts in the same page scope.
const trackingClient = window.supabase.createClient(
  CONFIG.supabaseUrl,
  CONFIG.supabaseAnonKey
);

// ─── Session ID ───────────────────────────────────────────────────────────────

/**
 * Returns the persistent session ID for this browser.
 * Generated once on first visit and stored in localStorage so every
 * subsequent open reuses the same ID — lets us tell "one person, 5 opens"
 * apart from "5 people, 1 open each".
 */
function getSessionId() {
  const KEY = 'bojio_session_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    // crypto.randomUUID() is available in all modern browsers (Chrome 92+, Safari 15.4+, Firefox 95+)
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ─── Return visit ─────────────────────────────────────────────────────────────

/**
 * Returns true if this browser has visited before, false on first visit.
 * Sets the flag on first call so the next open correctly reports as a return.
 * Check and set happen together so there's no window where two tabs could
 * both see is_return = false for the same browser.
 */
function isReturnVisit() {
  const KEY = 'bojio_visited_before';
  const returning = !!localStorage.getItem(KEY);
  if (!returning) {
    localStorage.setItem(KEY, '1');
  }
  return returning;
}

// ─── Open tracking ────────────────────────────────────────────────────────────

/**
 * Logs one row to bojio_opens for this page load.
 * Fires once on script load — does not track subsequent interactions.
 * Errors are caught and warned rather than thrown so a tracking failure
 * never breaks the map for the user.
 */
async function trackOpen() {
  const { error } = await trackingClient
    .from('bojio_opens')
    .insert({
      user_agent: navigator.userAgent,
      session_id: getSessionId(),
      is_return:  isReturnVisit(),
    });

  if (error) {
    console.warn('trackOpen failed:', error.message);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

trackOpen();
