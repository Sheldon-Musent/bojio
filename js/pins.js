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

// Colours used for circle layers and nearby-list dot colours.
const MARKER_STYLES = {
  friend:   { color: '#FF6B35' }, // orange — tip from a mate
  verified: { color: '#FFD700' }, // yellow — independently confirmed
};

// ─── Rendering ────────────────────────────────────────────────────────────────

// Adds all pins as a GeoJSON source and renders them as a circle layer.
// Colour encodes trust_level via a Mapbox expression: yellow = verified, orange = friend.
// Clicking a circle opens a mapboxgl.Popup with name and description.
function renderPins(map, pins) {
  const geojson = {
    type: 'FeatureCollection',
    features: pins.map(function (pin) {
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
        properties: {
          name:        pin.name,
          description: pin.description || '',
          trust_level: pin.trust_level,
          area:        pin.area || '',
        },
      };
    }),
  };

  map.addSource('bojio-pins', { type: 'geojson', data: geojson });

  map.addLayer({
    id:     'bojio-pins-layer',
    type:   'circle',
    source: 'bojio-pins',
    paint: {
      'circle-radius':       10,
      'circle-color': [
        'match', ['get', 'trust_level'],
        'verified', '#FFD700',
        '#FF6B35', // default — friend
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity':      1,
    },
  });

  map.on('click', 'bojio-pins-layer', function (e) {
    const props  = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    new mapboxgl.Popup()
      .setLngLat(coords)
      .setHTML('<strong>' + props.name + '</strong>' +
        (props.description ? '<br>' + props.description : ''))
      .addTo(map);
  });

  map.on('mouseenter', 'bojio-pins-layer', function () {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'bojio-pins-layer', function () {
    map.getCanvas().style.cursor = '';
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
 * @param {mapboxgl.Map} map   - Mapbox GL JS map instance
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
