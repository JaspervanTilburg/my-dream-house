import { MAX_ZOOM, getZoom, renderer, resetZoom, zoomAt } from '../scene.js';

// ---------------------------------------------------------------------------
// Zoom buttons: + and - zoom around the middle of the scene, the third
// button shows the whole garden again.
// ---------------------------------------------------------------------------
const zoomIn = document.getElementById('zoom-in');
const zoomOut = document.getElementById('zoom-out');
const zoomFit = document.getElementById('zoom-fit');

function center() {
  const r = renderer.domElement.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}

function sync() {
  zoomIn.disabled = getZoom() >= MAX_ZOOM - 0.001;
  zoomOut.disabled = zoomFit.disabled = getZoom() <= 1.001;
  requestAnimationFrame(sync);
}

zoomIn.addEventListener('click', () => zoomAt(...center(), 1.5));
zoomOut.addEventListener('click', () => zoomAt(...center(), 1 / 1.5));
zoomFit.addEventListener('click', resetZoom);
sync();

