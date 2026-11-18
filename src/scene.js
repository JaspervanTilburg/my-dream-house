import * as THREE from 'three';
import gsap from 'gsap';

// ---------------------------------------------------------------------------
// Renderer, scene, isometric camera
// ---------------------------------------------------------------------------
export const stage = document.getElementById('stage');
export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

export const scene = new THREE.Scene();

// True isometric direction, nudged slightly higher like the reference art.
export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
export const target = new THREE.Vector3(0, 0.6, 0);
export const VIEW_DIR = new THREE.Vector3(1, 1.08, 1).normalize();
export const UP = new THREE.Vector3(0, 1, 0);
export const view = { angle: 0 };   // rotation around the island, in radians
export let sunLight = null;         // set once the sun exists (it is created further down)

// Camera and sun turn together, so every side of the house gets the nice lighting.
export function placeCamera() {
  const dir = VIEW_DIR.clone().applyAxisAngle(UP, view.angle);
  camera.position.copy(target).addScaledVector(dir, 60);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  sunLight?.position.set(4, 12, 8).applyAxisAngle(UP, view.angle);
}
placeCamera();

camera.updateMatrixWorld();

// World-space boxes the camera must keep in view; filled in by update().
export let fitBoxes = [];
export function setFitBoxes(boxes) { fitBoxes = boxes; }

// Fit the boxes into the part of the screen not covered by the UI.
// The ortho frustum is made asymmetric so the scene centers in the free area.
// Frustum that fits the boxes into the `free` pixel rectangle of a w x h image.
export function computeFrustum(w, h, free) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const v = new THREE.Vector3();
  fitBoxes.forEach(b => {
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
      v.applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
  });

  const scale = Math.min((free.x1 - free.x0) / (maxX - minX), (free.y1 - free.y0) / (maxY - minY));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const px = (free.x0 + free.x1) / 2, py = (free.y0 + free.y1) / 2;
  const left = cx - px / scale, top = cy + py / scale;
  return { left, right: left + w / scale, top, bottom: top - h / scale };
}

// Fit the scene into the part of the screen not covered by the UI.
// 1 while the start screen shows (frame the scene between its title and
// button), 0 in the game (frame it beside the controls); in between while
// the start screen hands over.
let startFrame = document.body.classList.contains('starting') ? 1 : 0;
let startFree = null;
export function setStartFrame(v) { startFrame = v; }

// ---------------------------------------------------------------------------
// Zoom and pan on top of the fitted view. zoom 1 shows the whole garden; more
// shows less, around a point moved by `panX`/`panY` (in view units).
// ---------------------------------------------------------------------------
export const MAX_ZOOM = 4;
const userView = { zoom: 1, panX: 0, panY: 0 };
let lastBase = null; // the fitted view before zoom, from the last fitCamera()
export const getZoom = () => userView.zoom;

function zoomed(b) {
  const z = userView.zoom;
  const cx = (b.left + b.right) / 2 + userView.panX, cy = (b.top + b.bottom) / 2 + userView.panY;
  const hw = (b.right - b.left) / 2 / z, hh = (b.top - b.bottom) / 2 / z;
  return { left: cx - hw, right: cx + hw, top: cy + hh, bottom: cy - hh };
}

// Keep the zoomed view inside the fitted one, so the garden can't get lost.
function clampPan() {
  if (!lastBase) return;
  const z = userView.zoom;
  const mx = (lastBase.right - lastBase.left) / 2 * (1 - 1 / z);
  const my = (lastBase.top - lastBase.bottom) / 2 * (1 - 1 / z);
  userView.panX = Math.max(-mx, Math.min(mx, userView.panX));
  userView.panY = Math.max(-my, Math.min(my, userView.panY));
}

function applyView() {
  if (!lastBase) return;
  gsap.killTweensOf(camera);
  Object.assign(camera, zoomed(lastBase));
  camera.updateProjectionMatrix();
}

// Zoom by `factor` keeping the point under screen position (sx, sy) in place.
export function zoomAt(sx, sy, factor) {
  if (!lastBase) return;
  const r = renderer.domElement.getBoundingClientRect();
  const u = (sx - r.left) / r.width, v = (sy - r.top) / r.height;
  const before = zoomed(lastBase);
  const px = before.left + u * (before.right - before.left);
  const py = before.top - v * (before.top - before.bottom);
  userView.zoom = Math.max(1, Math.min(MAX_ZOOM, userView.zoom * factor));
  const hw = (lastBase.right - lastBase.left) / 2 / userView.zoom, hh = (lastBase.top - lastBase.bottom) / 2 / userView.zoom;
  userView.panX = px - (u - 0.5) * 2 * hw - (lastBase.left + lastBase.right) / 2;
  userView.panY = py + (v - 0.5) * 2 * hh - (lastBase.top + lastBase.bottom) / 2;
  clampPan();
  applyView();
}

// Move the view by a pointer drag of (dx, dy) pixels.
export function panBy(dx, dy) {
  const r = renderer.domElement.getBoundingClientRect();
  userView.panX -= dx * (camera.right - camera.left) / r.width;
  userView.panY += dy * (camera.top - camera.bottom) / r.height;
  clampPan();
  applyView();
}

// Back to the whole garden, smoothly.
export function resetZoom() {
  Object.assign(userView, { zoom: 1, panX: 0, panY: 0 });
  fitCamera(true);
}

export function fitCamera(animate = false) {
  const w = window.innerWidth, h = window.innerHeight;
  const pad = 20;
  const free = { x0: pad, x1: w - pad, y0: pad, y1: h - pad };
  if (startFrame > 0) {
    // Measure the title and button while they are on screen; once the start
    // screen fades out, keep using the last measurement.
    const title = document.getElementById('start-title').getBoundingClientRect();
    const button = document.getElementById('start-go').getBoundingClientRect();
    if (title.height > 0 && startFrame === 1) {
      startFree = { x0: pad, x1: w - pad, y0: title.bottom + pad, y1: button.top - pad };
    }
    const s = startFree ?? { x0: pad, x1: w - pad, y0: pad, y1: h - pad };
    const g = gameFree(w, h, pad);
    for (const k of Object.keys(free)) free[k] = s[k] * startFrame + g[k] * (1 - startFrame);
  } else {
    Object.assign(free, gameFree(w, h, pad));
  }
  const base = computeFrustum(w, h, free);
  lastBase = base;
  const frustum = startFrame > 0 ? base : zoomed(base);
  gsap.killTweensOf(camera);
  if (animate) {
    gsap.to(camera, { ...frustum, duration: 0.8, ease: 'power2.inOut',
      onUpdate: () => camera.updateProjectionMatrix() });
  } else {
    Object.assign(camera, frustum);
    camera.updateProjectionMatrix();
  }
}

// The part of the screen not covered by the game's controls.
function gameFree(w, h, pad) {
  const free = { x0: pad, x1: w - pad, y0: pad, y1: h - pad };
  const panel = document.getElementById('panel').getBoundingClientRect();
  const toolbarEl = document.getElementById('toolbar');
  const toolbar = toolbarEl.getBoundingClientRect();
  const toolsOpen = !toolbarEl.classList.contains('collapsed'); // collapsed, it is a small pill in a corner
  const zoom = document.getElementById('zoom').getBoundingClientRect();
  if (window.matchMedia('(max-width: 640px)').matches) {
    // Controls at the bottom, toolbar down the right side.
    free.y1 = panel.top - pad;
    if (toolsOpen) free.x1 = toolbar.left - pad / 2;
  } else {
    // Controls on the left, zoom buttons on the right, toolbar at the bottom.
    free.x0 = panel.right + pad;
    free.x1 = zoom.left - pad;
    free.y1 = toolsOpen ? toolbar.top - 8 : h - 70;
  }
  return free;
}
renderer.setSize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitCamera(false);
});

// ---------------------------------------------------------------------------
// Lights: soft sky fill + warm sun with soft shadows
// ---------------------------------------------------------------------------
export const skyLight = new THREE.HemisphereLight('#fff6ff', '#a9d98a', 1.9);
scene.add(skyLight);
export const sun = new THREE.DirectionalLight('#fff1dc', 2.3);
sunLight = sun;
placeCamera();
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
