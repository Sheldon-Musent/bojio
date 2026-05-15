// map.js — Initialises and controls the Mapbox GL JS map instance

// ─── Config ───────────────────────────────────────────────────────────────────

// Token from js/config.js (gitignored) — see js/config.example.js to set up.
mapboxgl.accessToken = CONFIG.mapboxToken;

// Kuala Lumpur — shown immediately while geolocation resolves (or as fallback).
// Mapbox GL JS uses [lng, lat] order, opposite of Leaflet.
const DEFAULT_LNG  = 101.6869;
const DEFAULT_LAT  = 3.1390;
const DEFAULT_ZOOM = 16;

// ─── Map initialisation ───────────────────────────────────────────────────────

function initMap() {
  const map = new mapboxgl.Map({
    container: 'map',
    style:     'mapbox://styles/mapbox/standard',
    center:    [DEFAULT_LNG, DEFAULT_LAT],
    zoom:      DEFAULT_ZOOM,
  });

  map.addControl(new mapboxgl.NavigationControl(), 'top-left');
  return map;
}

// ─── Geolocation ──────────────────────────────────────────────────────────────

// Asks the browser for the user's position and flies to it on success.
// Boots on DEFAULT_CENTER first so the map is never blank — this silently
// corrects the position once the browser responds.
// On success, also refreshes the nearby list sorted by real distance.
// On denial or error the KL default stays.
function locateUser(map) {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    function onSuccess(position) {
      const { latitude, longitude } = position.coords;
      map.flyTo({ center: [longitude, latitude], zoom: DEFAULT_ZOOM });
      window.updateNearbyList(latitude, longitude);
    },
    function onError() {}
  );
}

// ─── Nearby pill ──────────────────────────────────────────────────────────────

// Creates the floating pill element and appends it to <body>.
// Defined here because its entire lifecycle — creation, updates, show/hide —
// is driven by map events in this file.
function createNearbyPill() {
  const pill = document.createElement('div');
  pill.id = 'nearby-pill';
  document.body.appendChild(pill);
  return pill;
}

// Reads the nearest pin from the already-rendered #nearby-list DOM and writes
// it into the pill. Using the DOM avoids a direct dependency on pins.js internals.
// Trust badge inferred from dot colour: #FFD700 → Verified, else Friend.
function updatePillContent(pill) {
  const firstItem = document.querySelector('#nearby-list .nearby-item');
  if (!firstItem) {
    pill.innerHTML = '<span class="pill-name">Nearby food</span>';
    return;
  }

  const dotEl    = firstItem.querySelector('.nearby-dot');
  const color    = dotEl ? dotEl.style.background : '#FF6B35';
  const name     = firstItem.querySelector('.nearby-name')
    ? firstItem.querySelector('.nearby-name').textContent     : '';
  const distance = firstItem.querySelector('.nearby-distance')
    ? firstItem.querySelector('.nearby-distance').textContent : '';

  const isVerified = color.toUpperCase().includes('FFD700');
  const badgeLabel = isVerified ? 'Verified' : 'Friend';
  const badgeClass = isVerified ? 'verified' : 'friend';

  pill.innerHTML =
    '<span class="pill-dot" style="background:' + color + '"></span>' +
    '<span class="pill-name">'                  + name     + '</span>' +
    '<span class="pill-distance">'              + distance + '</span>' +
    '<span class="pill-badge ' + badgeClass + '">' + badgeLabel + '</span>';
}

// Collapses the full nearby panel and shows the floating pill.
// Panel slides down via CSS; pill fades in via body.panel-collapsed.
function collapseToPill(pill) {
  updatePillContent(pill);
  document.getElementById('nearby-panel').classList.remove('visible');
  document.body.classList.add('panel-collapsed');
}

// Expands the floating pill back to the full nearby panel.
function expandFromPill() {
  document.getElementById('nearby-panel').classList.add('visible');
  document.body.classList.remove('panel-collapsed');
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

// Entry point. Boots the map, wires collapse behaviour, then on style load
// fetches pins and starts geolocation. loadPins must run inside 'load' so that
// addSource / addLayer are called only after the style is ready.
// No auto-restore timers — panel stays collapsed until the user taps the pill.
(function boot() {
  const map  = initMap();
  const pill = createNearbyPill();

  // Expose globally so pins.js can reference the map instance if needed.
  window.bojoMap = map;

  map.on('load', function () {
    window.loadPins(map, DEFAULT_LAT, DEFAULT_LNG);
    locateUser(map);
  });

  map.on('dragstart', function () { collapseToPill(pill); });
  pill.addEventListener('click', expandFromPill);
})();
