// map.js — Initialises and controls the Mapbox GL JS map instance

// ─── Config ───────────────────────────────────────────────────────────────────

// Token from js/config.js (gitignored) — see js/config.example.js to set up.
mapboxgl.accessToken = CONFIG.mapboxToken;

// Sungai Long — where most BOJIO pins are. Shown immediately while geolocation
// resolves (or as fallback). Mapbox GL JS uses [lng, lat] order.
const DEFAULT_LNG  = 101.7924;
const DEFAULT_LAT  = 3.0415;
const DEFAULT_ZOOM = 17;

// ─── Map initialisation ───────────────────────────────────────────────────────

function initMap() {
  const map = new mapboxgl.Map({
    container: 'map',
    style:     'mapbox://styles/mapbox/standard',
    center:    [DEFAULT_LNG, DEFAULT_LAT],
    zoom:      DEFAULT_ZOOM,
    pitch:     45,
    bearing:   0,
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');
  return map;
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
// fetches pins and triggers geolocation. loadPins must run inside 'load' so
// addSource / addLayer are called only after the style is ready.
// GeolocateControl replaces the manual navigator.geolocation call — it handles
// flyTo, shows the user dot, and fires 'geolocate' for updateNearbyList.
// No auto-restore timers — panel stays collapsed until the user taps the pill.
(function boot() {
  const map  = initMap();
  const pill = createNearbyPill();

  window.bojoMap = map;

  const geolocate = new mapboxgl.GeolocateControl({
    positionOptions:  { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading:   true,
  });
  map.addControl(geolocate, 'top-left');

  // Re-sort nearby list whenever a position fix arrives.
  geolocate.on('geolocate', function (e) {
    window.updateNearbyList(e.coords.latitude, e.coords.longitude);
  });

  map.on('load', function () {
    window.loadPins(map, DEFAULT_LAT, DEFAULT_LNG);
    geolocate.trigger();
  });

  map.on('dragstart', function () { collapseToPill(pill); });
  pill.addEventListener('click', expandFromPill);
})();
