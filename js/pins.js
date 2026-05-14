// pins.js — Manages pin/marker placement, rendering, and interaction on the map

// ─── Supabase client ──────────────────────────────────────────────────────────

// Supabase is loaded from CDN in index.html before this script runs.
// CONFIG is loaded from js/config.js (gitignored) — see config.example.js.
// 'supabaseClient' avoids colliding with the 'supabase' global the CDN exposes
const supabaseClient = window.supabase.createClient(
  CONFIG.supabaseUrl,
  CONFIG.supabaseAnonKey
);

// ─── Data fetching ────────────────────────────────────────────────────────────

/**
 * Loads all food pins from Supabase and returns them as an array.
 * v1 only surfaces food — other types exist in the schema for future use.
 * Returns an empty array on error so the map still renders without pins.
 */
async function fetchFoodPins() {
  const { data, error } = await supabaseClient
    .from('pins')
    .select('id, name, description, lat, lng, area, trust_level')
    .eq('type', 'food')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchFoodPins failed:', error.message);
    return [];
  }

  return data;
}

// ─── Marker styles ────────────────────────────────────────────────────────────

const MARKER_STYLES = {
  friend:   { color: '#FF6B35' }, // orange — tip from a mate
  verified: { color: '#FFD700' }, // yellow — independently confirmed
};

// Base circle options shared across all trust levels
const MARKER_BASE = {
  radius:      10,
  fillOpacity: 0.9,
  weight:      2,
  color:       '#ffffff', // white border
};

/**
 * Returns the circleMarker style for a given trust_level.
 * Falls back to the 'friend' style for any unrecognised value.
 */
function markerStyle(trustLevel) {
  const style = MARKER_STYLES[trustLevel] || MARKER_STYLES.friend;
  return Object.assign({}, MARKER_BASE, { fillColor: style.color });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

/**
 * Drops a coloured circleMarker for each pin.
 * Colour encodes trust_level (orange = friend, yellow = verified).
 * Popup shows name in bold with the description below.
 */
function renderPins(map, pins) {
  pins.forEach(function (pin) {
    const popup =
      `<strong>${pin.name}</strong>` +
      (pin.description ? `<br>${pin.description}` : '');

    L.circleMarker([pin.lat, pin.lng], markerStyle(pin.trust_level))
      .bindPopup(popup)
      .addTo(map);
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Called by map.js once the map is ready.
 * Fetches food pins and drops them onto the map.
 */
async function loadPins(map) {
  const pins = await fetchFoodPins();
  renderPins(map, pins);
}

// Expose to window so map.js (loaded before pins.js) can call it after boot
window.loadPins = loadPins;
