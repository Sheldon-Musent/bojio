// map.js — Initialises and controls the Mapbox GL JS map instance

// ─── Config ───────────────────────────────────────────────────────────────────

// Token from js/config.js (gitignored) — see js/config.example.js to set up.
mapboxgl.accessToken = CONFIG.mapboxToken;

// Sungai Long — where most BOJIO pins are. Shown immediately while geolocation
// resolves (or as fallback). Mapbox GL JS uses [lng, lat] order.
const DEFAULT_LNG  = 101.7924;
const DEFAULT_LAT  = 3.0415;
const DEFAULT_ZOOM = 18;

// ─── Map initialisation ───────────────────────────────────────────────────────

function initMap() {
  return new mapboxgl.Map({
    container: 'map',
    style:     'mapbox://styles/musent/cmpj5ad6a001p01sf3g672g4j',
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
  ' fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
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
    document.getElementById('layer-pills').scrollLeft = 0;
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

// Null until first GPS fix — keeps Mapbox's .mapboxgl-marker wrapper out of
// the DOM entirely until we have real coordinates to place it at.
let userMarker = null;

// One-shot GPS request: flies to user position with current pitch, moves the
// blue dot, and re-sorts the nearby list.
function locateUser(map, getPitch) {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    function onSuccess(position) {
      const { latitude, longitude } = position.coords;

      if (!userMarker) {
        const dotEl = document.createElement('div');
        dotEl.id    = 'user-dot';
        userMarker  = new mapboxgl.Marker(dotEl);
      }

      userMarker.setLngLat([longitude, latitude]).addTo(map);
      userMarker.getElement().style.display = 'block';

      map.easeTo({
        center:   [longitude, latitude],
        zoom:     DEFAULT_ZOOM,
        pitch:    getPitch(),
        bearing:  0,
        duration: 1500,
        padding:  { bottom: 80 },
      });
      window.updateNearbyList(latitude, longitude);
    },
    function onError() {},
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Lucide 'navigation' icon — inlined, no CDN.
const ICON_NAVIGATION =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"' +
  ' fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<polygon points="3 11 22 2 13 21 11 13 3 11"/>' +
  '</svg>';

// Circle button — shows icon at rest, expands to "Location" label on tap for 2 s.
// Does NOT append to DOM — boot() controls insertion order.
function createLocateButton(map, getPitch) {
  let expandTimer = null;

  const btn = document.createElement('button');
  btn.id        = 'locate-btn';
  btn.innerHTML =
    '<span class="locate-icon">' + ICON_NAVIGATION + '</span>' +
    '<span class="locate-label">Location</span>';

  btn.addEventListener('click', function () {
    btn.classList.add('btn-expanded');
    document.getElementById('layer-pills').scrollLeft = 0;
    clearTimeout(expandTimer);
    expandTimer = setTimeout(function () {
      btn.classList.remove('btn-expanded');
    }, 2000);
    locateUser(map, getPitch);
  });

  return { btn };
}

// ─── Nearby pill ──────────────────────────────────────────────────────────────

// Creates the floating pill element and appends it to <body>.
// Entire lifecycle — creation, updates, show/hide — is driven by map events.
function createNearbyPill() {
  const pill = document.createElement('div');
  pill.id = 'nearby-pill';
  document.body.appendChild(pill);

  let touchStartX = 0;
  pill.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  pill.addEventListener('touchend', function(e) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const pins = window._pillPins || [];
    if (!pins.length) return;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) {
      window._pillIndex = Math.min((window._pillIndex || 0) + 1, pins.length - 1);
    } else {
      window._pillIndex = Math.max((window._pillIndex || 0) - 1, 0);
    }
    renderPillSlide(pill, window._pillIndex);
  });

  return pill;
}

function updatePillContent(pill) {
  const items = document.querySelectorAll('#nearby-list .nearby-item');
  if (!items.length) {
    pill.innerHTML = '<span class="pill-name">Nearby food</span>';
    return;
  }
  window._pillPins = Array.from(items).map(function(item) {
    const dotEl = item.querySelector('.nearby-dot');
    const color = dotEl ? dotEl.style.background : '#FF6B35';
    const name = item.querySelector('.nearby-name') ? item.querySelector('.nearby-name').textContent : '';
    const distance = item.querySelector('.nearby-distance') ? item.querySelector('.nearby-distance').textContent : '';
    const area = item.dataset.area || '';
    const group = item.dataset.group || 'nearby';
    const imageUrl = item.dataset.imageUrl || '';
    const isVerified = color.toUpperCase().includes('FFD700');
    return { color, name, distance, area, group, imageUrl, isVerified };
  });
  window._pillIndex = 0;
  renderPillSlide(pill, 0);
}

function renderPillSlide(pill, index) {
  const pins = window._pillPins || [];
  if (!pins.length) return;
  const pin = pins[index];
  const total = pins.length;
  const socialLine = pin.isVerified ? 'Community verified' : 'A friend recommends this';

  const dots = Array.from({ length: total }, function(_, i) {
    return '<span class="pill-nav-dot' + (i === index ? ' active' : '') + '"></span>';
  }).join('');

  const distParts = pin.distance.replace('km', '').replace('m', '').trim().split(' ');
  const distNum = distParts[0];
  const distUnit = pin.distance.includes('km') ? 'km' : 'm';

  const bgStyle = pin.imageUrl
    ? 'background-image: url("' + pin.imageUrl + '"); background-size: cover; background-position: center;'
    : '';

  pill.innerHTML =
    '<div class="pill-bg-overlay" style="' + bgStyle + '">' +
      '<div class="pill-bg-dim"></div>' +
    '</div>' +
    '<div class="pill-left">' +
      '<span class="pill-social">' + socialLine + '</span>' +
      '<span class="pill-name">' + pin.name + '</span>' +
      '<span class="pill-action">Res details →</span>' +
    '</div>' +
    '<div class="pill-dist-card">' +
      '<span class="pill-dist-num">' + distNum + '</span>' +
      '<span class="pill-dist-unit">' + distUnit + '</span>' +
    '</div>' +
    '<div class="pill-swipe-hint">' +
      '<span class="swipe-arrow left">‹</span>' +
      '<span class="swipe-arrow right">›</span>' +
    '</div>' +
    '<div class="pill-nav">' + dots + '</div>';
}

// Collapses the full nearby panel and shows the floating pill.
// Panel slides down via CSS; pill fades in via body.panel-collapsed.
function collapseToPill(pill) {
  updatePillContent(pill);
  document.getElementById('nearby-panel').classList.remove('visible');
  document.body.classList.add('panel-collapsed');
  const pillsEl = document.getElementById('layer-pills');
  if (pillsEl) pillsEl.scrollLeft = 0;
}

// Expands the floating pill back to the full nearby panel.
function expandFromPill() {
  document.getElementById('nearby-panel').classList.add('visible');
  document.body.classList.remove('panel-collapsed');
  const pillsEl = document.getElementById('layer-pills');
  if (pillsEl) pillsEl.scrollLeft = 0;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

// Entry point. Creates map, controls, and nearby pill, then on style load
// fetches pins and fires the initial one-shot geolocation request.
// GPS and 3D buttons are appended to #control-bar in left-to-right order.
// loadPins must run inside 'load' so addSource/addLayer run on a ready style.
// No auto-restore timers — panel stays collapsed until the user taps the pill.
(function boot() {
  const map  = initMap();
  map.setPadding({ bottom: 80 });
  const pill = createNearbyPill();

  window.bojoMap = map;

  const { btn: toggle3dBtn, getPitch } = createToggle3D(map);
  const { btn: locateBtn } = createLocateButton(map, getPitch);

  // Insert GPS, direction, then 3D so the row reads: [layer pills] [GPS] [DIR] [3D]
  const dirBtn = document.createElement('button');
  dirBtn.id = 'direction-btn';
  dirBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>';
  const bar = document.getElementById('control-bar');
  bar.appendChild(locateBtn);
  bar.appendChild(dirBtn);
  bar.appendChild(toggle3dBtn);

  map.on('load', function () {
    window.loadPins(map, DEFAULT_LAT, DEFAULT_LNG);
    map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
    map.setConfigProperty('basemap', 'showTransitLabels', false);
    map.setConfigProperty('basemap', 'lightPreset', 'night');
    locateUser(map, getPitch);
  });

  map.on('dragstart', function () { collapseToPill(pill); });
  pill.addEventListener('click', expandFromPill);
})();
