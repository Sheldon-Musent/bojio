// pins.js — Manages pin/marker placement, rendering, and interaction on the map

// ─── Supabase client ──────────────────────────────────────────────────────────

// Supabase is loaded from CDN in index.html before this script runs.
// CONFIG is loaded from js/config.js (gitignored) — see config.example.js.
// 'supabaseClient' avoids colliding with the 'supabase' global the CDN exposes
const supabaseClient = window.supabase.createClient(
  CONFIG.supabaseUrl,
  CONFIG.supabaseAnonKey
);

// ─── State ───────────────────────────────────────────────────────────────────

// Pins are cached after the first fetch so updateNearbyList() can re-sort
// without hitting Supabase again when the user's GPS position resolves.
let cachedPins = [];

// User location cached so loadPins() can use the real coords if GPS resolves
// before the Supabase fetch completes (race condition guard).
let cachedUserLat = null;
let cachedUserLng = null;

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
      '<strong>' + pin.name + '</strong>' +
      (pin.description ? '<br>' + pin.description : '');

    L.circleMarker([pin.lat, pin.lng], markerStyle(pin.trust_level))
      .bindPopup(popup)
      .addTo(map);
  });
}

// ─── Distance ─────────────────────────────────────────────────────────────────

/**
 * Haversine formula — great-circle distance between two lat/lng points in km.
 * Used to sort the nearby list without a server round-trip.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Formats a distance in km as a human-readable string.
 * Shows metres when under 1 km so small distances don't read as "0.1 km".
 */
function formatDistance(km) {
  return km < 1
    ? Math.round(km * 1000) + ' m'
    : km.toFixed(1) + ' km';
}

// ─── Nearby list ──────────────────────────────────────────────────────────────

/**
 * Re-sorts cachedPins by distance from (userLat, userLng), takes the 3
 * nearest, and renders them in #nearby-list.
 * Called once with default coords after pins load, then again when GPS
 * resolves — so the list silently updates to reflect real position.
 */
function updateNearbyList(userLat, userLng) {
  // Cache the latest known user location so loadPins() can use it if GPS
  // resolves before the Supabase fetch completes.
  cachedUserLat = userLat;
  cachedUserLng = userLng;

  if (!cachedPins.length) return; // pins not yet loaded — loadPins() will call us

  const nearest = cachedPins
    .map(function (pin) {
      return Object.assign({}, pin, {
        distance: haversineKm(userLat, userLng, pin.lat, pin.lng),
      });
    })
    .sort(function (a, b) { return a.distance - b.distance; })
    .slice(0, 3);

  const listEl = document.getElementById('nearby-list');
  listEl.innerHTML = nearest.map(function (pin) {
    const color = (MARKER_STYLES[pin.trust_level] || MARKER_STYLES.friend).color;
    return (
      '<div class="nearby-item">' +
        '<span class="nearby-dot" style="background:' + color + '"></span>' +
        '<div class="nearby-info">' +
          '<div class="nearby-name">' + pin.name + '</div>' +
          (pin.description
            ? '<div class="nearby-desc">' + pin.description + '</div>'
            : '') +
        '</div>' +
        '<div class="nearby-distance">' + formatDistance(pin.distance) + '</div>' +
      '</div>'
    );
  }).join('');
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Called by map.js once the map is ready.
 * Shows the nearby panel immediately (with "Loading..."), fetches pins,
 * renders markers, then populates the nearby list.
 * Uses real GPS coords if they arrived before the fetch completed.
 *
 * @param {L.Map} map         - Leaflet map instance
 * @param {number} initialLat - Fallback latitude if GPS hasn't resolved yet
 * @param {number} initialLng - Fallback longitude if GPS hasn't resolved yet
 */
async function loadPins(map, initialLat, initialLng) {
  // Slide the panel up immediately so users see "Loading..." rather than nothing
  document.getElementById('nearby-panel').classList.add('visible');

  const pins = await fetchFoodPins();
  cachedPins = pins;
  renderPins(map, pins);

  // Prefer real GPS coords if locateUser() already resolved during the fetch
  const lat = cachedUserLat !== null ? cachedUserLat : initialLat;
  const lng = cachedUserLng !== null ? cachedUserLng : initialLng;
  updateNearbyList(lat, lng);
}

// Expose both functions so map.js can call across the script boundary
window.loadPins         = loadPins;
window.updateNearbyList = updateNearbyList;
