// map.js — Initialises and controls the map instance (zoom, bounds, base tiles)

// ─── Config ───────────────────────────────────────────────────────────────────

// Token loaded from js/config.js (gitignored) — see js/config.example.js to set up.
const MAPBOX_TOKEN = CONFIG.mapboxToken;

// Mapbox serves 512px tiles; the URL path omits the size so we declare it in
// Leaflet options via tileSize + zoomOffset to keep the zoom levels aligned.
const TILE_URL = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`;

// Kuala Lumpur — shown immediately while geolocation resolves (or as a fallback)
const DEFAULT_CENTER = [3.1390, 101.6869];
const DEFAULT_ZOOM   = 14;

// ─── Map initialisation ───────────────────────────────────────────────────────

/**
 * Creates the Leaflet map instance and attaches it to #map.
 * We pass `center` separately so locateUser() can reposition without recreating
 * the whole map — avoids tearing down tile connections on permission grant.
 */
function initMap(center) {
  const map = L.map('map', {
    center: center,
    zoom: DEFAULT_ZOOM,
    zoomControl: true,
  });

  attachTiles(map);
  return map;
}

// ─── Tile layer ───────────────────────────────────────────────────────────────

/**
 * Adds Mapbox raster tiles as the base layer.
 * tileSize 512 + zoomOffset -1 corrects the mismatch between Mapbox's 512px
 * tile grid and Leaflet's assumed 256px grid — without this, tiles load one
 * zoom level too blurry.
 */
function attachTiles(map) {
  L.tileLayer(TILE_URL, {
    tileSize:    512,
    zoomOffset:  -1,
    maxZoom:     22,
    attribution: '© <a href="https://www.mapbox.com/" target="_blank">Mapbox</a> © <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap</a>',
  }).addTo(map);
}

// ─── Geolocation ──────────────────────────────────────────────────────────────

/**
 * Asks the browser for the user's position and re-centres the map on success.
 * We boot on DEFAULT_CENTER first so the map is never blank — this call then
 * silently corrects the position once the browser responds.
 * On denial or error we do nothing; the KL default is already acceptable.
 */
function locateUser(map) {
  if (!navigator.geolocation) {
    // Geolocation not available in this browser — stay on default centre
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function onSuccess(position) {
      const { latitude, longitude } = position.coords;
      map.setView([latitude, longitude], DEFAULT_ZOOM);
    },
    function onError() {
      // Permission denied or position unavailable — KL default stays
    }
  );
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

/**
 * Entry point. Boots the map immediately on DEFAULT_CENTER so the page isn't
 * blank while geolocation is pending, then adjusts once position resolves.
 */
(function boot() {
  const map = initMap(DEFAULT_CENTER);
  locateUser(map);
})();
