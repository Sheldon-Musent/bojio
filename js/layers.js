// layers.js — Defines and toggles map overlay layers (e.g. heatmaps, zones, routes)

// ─── Layer pill tooltips ──────────────────────────────────────────────────────

// One shared tooltip element repositioned to whichever pill was tapped.
// Created in JS so the DOM stays clean when JS is disabled.
const layerTooltip = document.createElement('div');
layerTooltip.id = 'layer-tooltip';
layerTooltip.textContent = 'Coming soon';
document.body.appendChild(layerTooltip);

let tooltipTimer = null;

/**
 * Briefly shows the "Coming soon" tooltip just below the given pill element.
 * Auto-hides after 1.5 s — no tap-to-dismiss needed.
 */
function showPillTooltip(pill) {
  const rect = pill.getBoundingClientRect();
  layerTooltip.style.left = rect.left + 'px';
  layerTooltip.style.top  = (rect.bottom + 6) + 'px';
  layerTooltip.classList.add('visible');

  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(function () {
    layerTooltip.classList.remove('visible');
  }, 1500);
}

// Attach tooltip to all disabled pills — active pill needs no handler
document.querySelectorAll('.layer-pill.disabled').forEach(function (pill) {
  pill.addEventListener('click', function () {
    showPillTooltip(pill);
  });
});
