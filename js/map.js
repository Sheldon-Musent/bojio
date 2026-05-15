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

// Lucide 'box' (3D cube) and 'square' (2D plane) — inlined, no CDN.
const ICON_BOX =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"' +
  ' fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
  '<polyline points="3.29 7 12 12 20.71 7"/>' +
  '<line x1="12" y1="22" x2="12" y2="12"/>' +
  '</svg>';

const ICON_SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"' +
  ' fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect width="18" height="18" x="3" y="3" rx="2"/>' +
  '</svg>';

// Circle button — shows icon at rest, expands to label on tap for 2 s.
// Does NOT append to DOM — boot() controls insertion order within #control-bar.
// Returns { btn, getPitch } so locateUser can read the current pitch intent.
function createToggle3D(map) {
  let is3D        = true;
  let expandTimer = null;

  const btn = document.createElement('button');
  btn.id        = 'toggle-3d';
  btn.innerHTML = ICON_BOX;

  btn.addEventListener('click', function () {
    is3D = !is3D;
    btn.classList.toggle('mode-2d', !is3D);

    btn.innerHTML = '<span class="toggle-label">' + (is3D ? '3D' : '2D') + '</span>';
    btn.classList.add('btn-expanded');
    clearTimeout(expandTimer);
    expandTimer = setTimeout(function () {
      btn.classList.remove('btn-expanded');
      btn.innerHTML = is3D ? ICON_BOX : ICON_SQUARE;
    }, 2000);

    map.easeTo({ pitch: is3D ? 45 : 0, bearing: 0, duration: 500 });
  });

  return {
    btn,
    getPitch: function () { return is3D ? 45 : 0; },
  };
}

// ─── User location ────────────────────────────────────────────────────────────

// One-shot GPS request: flies to user position with current pitch, moves the
// blue dot, and re-sorts the nearby list.
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

// Creates the GPS button element and the blue user-dot marker.
// Does NOT append to DOM — boot() controls insertion order.
// Each button tap fires a fresh one-shot location request.
function createLocateButton(map, getPitch) {
  const dotEl = document.createElement('div');
  dotEl.id    = 'user-dot';
  const marker = new mapboxgl.Marker(dotEl);

  const btn = document.createElement('button');
  btn.id          = 'locate-btn';
  btn.textContent = 'GPS';

  btn.addEventListener('click', function () {
    locateUser(map, marker, getPitch);
  });

  return { btn, marker };
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

// Entry point. Creates map, controls, and nearby pill, then on style load
// fetches pins and fires the initial one-shot geolocation request.
// GPS and 3D buttons are appended to #control-bar in left-to-right order.
// loadPins must run inside 'load' so addSource/addLayer run on a ready style.
// No auto-restore timers — panel stays collapsed until the user taps the pill.
(function boot() {
  const map  = initMap();
  const pill = createNearbyPill();

  window.bojoMap = map;

  const { btn: toggle3dBtn, getPitch } = createToggle3D(map);
  const { btn: locateBtn,   marker   } = createLocateButton(map, getPitch);

  // Insert GPS then 3D so the row reads: [layer pills] [GPS] [3D]
  const bar = document.getElementById('control-bar');
  bar.appendChild(locateBtn);
  bar.appendChild(toggle3dBtn);

  map.on('load', function () {
    window.loadPins(map, DEFAULT_LAT, DEFAULT_LNG);
    locateUser(map, marker, getPitch);
  });

  map.on('dragstart', function () { collapseToPill(pill); });
  pill.addEventListener('click', expandFromPill);
})();
