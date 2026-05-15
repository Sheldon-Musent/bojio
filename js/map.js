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
  return new mapboxgl.Map({
    container: 'map',
    style:     'mapbox://styles/mapbox/standard',
    center:    [DEFAULT_LNG, DEFAULT_LAT],
    zoom:      DEFAULT_ZOOM,
    pitch:     45,
    bearing:   0,
  });
}

// ─── 2D / 3D toggle ───────────────────────────────────────────────────────────

// Pill button bottom-left. Orange = 3D active, frosted-glass = 2D flat.
// Returns getPitch() so locateUser can honour the current toggle state.
function createToggle3D(map) {
  let is3D = true;

  const btn = document.createElement('button');
  btn.id          = 'toggle-3d';
  btn.textContent = '3D';
  document.body.appendChild(btn);

  btn.addEventListener('click', function () {
    is3D = !is3D;
    btn.textContent = is3D ? '3D' : '2D';
    btn.classList.toggle('flat', !is3D);
    map.easeTo({ pitch: is3D ? 45 : 0, bearing: 0, duration: 500 });
  });

  return function getPitch() { return is3D ? 45 : 0; };
}

// ─── User location ────────────────────────────────────────────────────────────

// One-shot GPS request: flies to user position, moves the blue dot, re-sorts
// the nearby list. Called automatically on load and on each GPS button tap.
// Pitch is read from getPitch() so 2D/3D toggle is always respected.
function locateUser(map, marker, getPitch) {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    function onSuccess(position) {
      const { latitude, longitude } = position.coords;
      marker.setLngLat([longitude, latitude]).addTo(map);
      map.easeTo({
        center:   [longitude, latitude],
        zoom:     DEFAULT_ZOOM,
        pitch:    getPitch(),
        bearing:  0,
        duration: 1500,
      });
      window.updateNearbyList(latitude, longitude);
    },
    function onError() {}
  );
}

// Creates the GPS button and the blue user-dot marker.
// Each button tap fires a fresh one-shot location request — no continuous tracking.
function createLocateButton(map, getPitch) {
  const dotEl = document.createElement('div');
  dotEl.id    = 'user-dot';
  const marker = new mapboxgl.Marker(dotEl);

  const btn = document.createElement('button');
  btn.id          = 'locate-btn';
  btn.textContent = 'GPS';
  document.body.appendChild(btn);

  btn.addEventListener('click', function () {
    locateUser(map, marker, getPitch);
  });

  return marker;
}

// ─── Nearby pill ──────────────────────────────────────────────────────────────

// Creates the floating pill element and appends it to <body>.
// Entire lifecycle — creation, updates, show/hide — is driven by map events.
function createNearbyPill() {
  const pill = document.createElement('div');
  pill.id = 'nearby-pill';
  document.body.appendChild(pill);
  return pill;
}

// Reads the nearest pin from the already-rendered #nearby-list DOM and writes
// it into the pill. Trust badge inferred from dot colour: #FFD700 → Verified.
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

// Entry point. Creates map and all controls, then on style load fetches pins
// and fires the initial one-shot geolocation request.
// loadPins must run inside 'load' so addSource/addLayer run on a ready style.
// No auto-restore timers — panel stays collapsed until the user taps the pill.
(function boot() {
  const map      = initMap();
  const pill     = createNearbyPill();
  const getPitch = createToggle3D(map);
  const marker   = createLocateButton(map, getPitch);

  window.bojoMap = map;

  map.on('load', function () {
    window.loadPins(map, DEFAULT_LAT, DEFAULT_LNG);
    locateUser(map, marker, getPitch);
  });

  map.on('dragstart', function () { collapseToPill(pill); });
  pill.addEventListener('click', expandFromPill);
})();
