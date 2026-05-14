// auth.js — Supabase authentication and admin panel logic for admin.html

// ─── Supabase client ──────────────────────────────────────────────────────────

// CONFIG is loaded from js/config.js (gitignored) — see config.example.js.
// admin.html has its own client instance; it does not share pins.js's client.
const supabaseClient = window.supabase.createClient(
  CONFIG.supabaseUrl,
  CONFIG.supabaseAnonKey
);

// ─── UI helpers ───────────────────────────────────────────────────────────────

/**
 * Hides all top-level panels then reveals the one with the given id.
 * Centralising panel switching here prevents any panel from being
 * accidentally left visible during a state transition.
 */
function showPanel(panelId) {
  document.getElementById('login-panel').classList.add('hidden');
  document.getElementById('admin-panel').classList.add('hidden');
  document.getElementById(panelId).classList.remove('hidden');
}

/**
 * Sets the text and visibility of a feedback message element.
 * Passing visible=false clears it without needing a separate clearMessage call.
 */
function setMessage(elementId, text, visible = true) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.classList.toggle('hidden', !visible);
}

function clearMessage(elementId) {
  setMessage(elementId, '', false);
}

// ─── Auth state ───────────────────────────────────────────────────────────────

// onAuthStateChange fires immediately on page load with the current session,
// so this handles both the initial boot check and live sign-in / sign-out events
// without a separate getSession() call.
supabaseClient.auth.onAuthStateChange(function (event, session) {
  if (session) {
    showPanel('admin-panel');
  } else {
    showPanel('login-panel');
  }
});

// ─── Sign in ─────────────────────────────────────────────────────────────────

/**
 * Authenticates with email and password.
 * On success, Supabase persists the session to localStorage and fires
 * onAuthStateChange — the panel switch happens there, not here.
 * On failure, the error message is shown below the login form.
 */
async function signIn(email, password) {
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    setMessage('login-error', error.message);
  }
}

// ─── Sign out ────────────────────────────────────────────────────────────────

/**
 * Ends the session. onAuthStateChange fires with session=null and
 * returns the user to the login panel automatically.
 */
async function signOut() {
  await supabaseClient.auth.signOut();
}

// ─── Pin insertion ────────────────────────────────────────────────────────────

/**
 * Inserts a new pin into the pins table.
 * type is always 'food' for v1 — the schema supports others for future use.
 * Returns true on success so the caller can reset the form.
 */
async function insertPin(pinData) {
  const { error } = await supabaseClient
    .from('pins')
    .insert({ ...pinData, type: 'food' });

  if (error) {
    setMessage('pin-error',   error.message);
    clearMessage('pin-success');
    return false;
  }

  setMessage('pin-success', `"${pinData.name}" added successfully.`);
  clearMessage('pin-error');
  return true;
}

// ─── Event listeners ─────────────────────────────────────────────────────────

document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  clearMessage('login-error');

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  // Disable the button while the request is in flight to prevent double-submit
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  await signIn(email, password);
  btn.disabled = false;
});

document.getElementById('logout-btn').addEventListener('click', function () {
  signOut();
});

document.getElementById('pin-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  clearMessage('pin-success');
  clearMessage('pin-error');

  const pinData = {
    name:        document.getElementById('pin-name').value.trim(),
    description: document.getElementById('pin-description').value.trim() || null,
    lat:         parseFloat(document.getElementById('pin-lat').value),
    lng:         parseFloat(document.getElementById('pin-lng').value),
    area:        document.getElementById('pin-area').value        || null,
    trust_level: document.getElementById('pin-trust').value,
  };

  const btn = document.getElementById('pin-submit-btn');
  btn.disabled = true;
  const ok = await insertPin(pinData);
  btn.disabled = false;

  if (ok) {
    e.target.reset();
  }
});
