// pins.js — Manages pin/marker placement, rendering, and interaction on the map

// ─── Supabase client ──────────────────────────────────────────────────────────

// Supabase is loaded from CDN in index.html before this script runs.
// CONFIG is loaded from js/config.js (gitignored) — see config.example.js.
const supabase = window.supabase.createClient(
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
  const { data, error } = await supabase
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

// ─── Rendering ────────────────────────────────────────────────────────────────

/**
 * Places a Leaflet marker for each pin and binds a popup with its name
 * and description. Accepts the Leaflet map instance from map.js.
 */
function renderPins(map, pins) {
  pins.forEach(function (pin) {
    L.marker([pin.lat, pin.lng])
      .bindPopup(
        `<strong>${pin.name}</strong>` +
        (pin.description ? `<br>${pin.description}` : '') +
        (pin.area        ? `<br><small>${pin.area}</small>` : '')
      )
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
