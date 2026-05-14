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
 * On success, also refreshes the nearby list sorted by real distance.
 * On denial or error we do nothing; the KL default is already acceptable.
 */
function locateUser(map) {
  if (!navigator.geolocation) {
    return; // Geolocation not available — stay on default centre
  }

  navigator.geolocation.getCurrentPosition(
    function onSuccess(position) {
      const { latitude, longitude } = position.coords;
      map.setView([latitude, longitude], DEFAULT_ZOOM);
      window.updateNearbyList(latitude, longitude);
    },
    function onError() {
      // Permission denied or position unavailable — KL default stays
    }
  );
}

// ─── Nearby pill ──────────────────────────────────────────────────────────────

/**
 * Creates the floating pill element and appends it to <body>.
 * Defined here rather than in index.html because its entire lifecycle —
 * creation, content updates, show/hide — is driven by map events in this file.
 */
function createNearbyPill() {
  const pill = document.createElement('div');
  pill.id = 'nearby-pill';
  document.body.appendChild(pill);
  return pill;
}

/**
 * Reads the nearest pin from the already-rendered #nearby-list DOM and writes
 * it into the pill. Using the DOM avoids a direct dependency on pins.js internals.
 *
 * Trust badge is inferred from dot colour:
 *   #FFD700 → "Verified"
 *   anything else (#FF6B35) → "Friend Rec"
 *
 * Falls back to a generic label if pins haven't loaded yet.
 */
function updatePillContent(pill) {
  const firstItem = document.querySelector('#nearby-list .nearby-item');
  if (!firstItem) {
    pill.innerHTML = '<span class="pill-name">Nearby food</span>';
    return;
  }

  const dotEl     = firstItem.querySelector('.nearby-dot');
  const color     = dotEl ? dotEl.style.background : '#FF6B35';
  const name      = firstItem.querySelector('.nearby-name')     ? firstItem.querySelector('.nearby-name').textContent     : '';
  const distance  = firstItem.querySelector('.nearby-distance') ? firstItem.querySelector('.nearby-distance').textContent : '';

  // Infer trust level from dot colour — #FFD700 is verified, everything else is friend
  const isVerified  = color.toUpperCase().includes('FFD700');
  const badgeLabel  = isVerified ? 'Verified'   : 'Friend Rec';
  const badgeClass  = isVerified ? 'verified'   : 'friend';

  pill.innerHTML =
    '<span class="pill-dot" style="background:' + color + '"></span>' +
    '<span class="pill-name">'                   + name        + '</span>' +
    '<span class="pill-distance">'               + distance    + '</span>' +
    '<span class="pill-badge ' + badgeClass + '">' + badgeLabel + '</span>';
}

/**
 * Collapses the full nearby panel and shows the floating pill.
 * Panel slides down via CSS (removing .visible triggers translateY(100%)).
 * Pill fades in via body.panel-collapsed CSS class.
 */
function collapseToPill(pill) {
  updatePillContent(pill);
  document.getElementById('nearby-panel').classList.remove('visible');
  document.body.classList.add('panel-collapsed');
}

/**
 * Expands the floating pill back to the full nearby panel.
 * Removing panel-collapsed hides the pill; adding .visible slides the panel up.
 */
function expandFromPill() {
  document.getElementById('nearby-panel').classList.add('visible');
  document.body.classList.remove('panel-collapsed');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

/**
 * Entry point. Boots the map, loads pins, locates the user, and wires up
 * the drag-to-collapse / tap-to-expand behaviour.
 *
 * No auto-restore timers — the panel stays collapsed until the user taps the pill.
 * Leaflet dragstart fires for both mouse and touch natively.
 */
(function boot() {
  const map  = initMap(DEFAULT_CENTER);
  const pill = createNearbyPill();

  window.loadPins(map, DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
  locateUser(map);

  map.on('dragstart', function () { collapseToPill(pill); });
  pill.addEventListener('click', expandFromPill);
})();
