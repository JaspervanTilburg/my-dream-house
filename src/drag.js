import * as THREE from 'three';
import gsap from 'gsap';
import { footprint } from './catalog.js';
import { sfx } from './fx/audio.js';
import { sharedGeometries } from './helpers.js';
import { dragZones } from './props.js';
import { landingSpot, placeItem, select } from './items.js';
import { camera, getZoom, panBy, renderer, zoomAt } from './scene.js';
import { showHandles } from './ui/handles.js';
import { pickHousePart } from './ui/houseedit.js';
import { getWaterTool } from './ui/waterbrush.js';
import { brush } from './waterdata.js';
import { live, update, world } from './world.js';

// ---------------------------------------------------------------------------
// Drag and drop: press an item, slide it over the lawn, let go. A ring under
// it shows where it will land (green), or red when there is no room at all.
// A tap without moving selects the item; a tap on empty lawn clears that.
// ---------------------------------------------------------------------------
const canvasEl = renderer.domElement;
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dropRing = new THREE.Mesh(
  new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#6cd47a', transparent: true, opacity: 0.75, depthWrite: false }));
dropRing.visible = false;
dropRing.renderOrder = 2;
world.add(dropRing);
sharedGeometries.add(dropRing.geometry);

let drag = null; // { id, type, obj, startX, startY, offset, moved, spot, baseRot, rot, pointerId }

function setPointer(e) {
  world.updateMatrixWorld(); // hit tests use where things are now, not at the last frame
  const r = canvasEl.getBoundingClientRect();
  pointerNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
}

// The garden item under the pointer, if any.
function pickItem(e) {
  setPointer(e);
  const items = [...live.values()].filter(p => p.obj.userData.drag != null).map(p => p.obj);
  const hit = raycaster.intersectObjects(items, true)[0];
  let o = hit?.object;
  while (o && o.userData.drag == null) o = o.parent;
  return o || null;
}

// Where the pointer touches the house (island coordinates), or null.
function hitsHouse(e) {
  setPointer(e);
  const parts = [...live.values()].filter(p => p.obj.userData.house).map(p => p.obj);
  const hit = raycaster.intersectObjects(parts, true)[0];
  if (!hit) return null;
  const point = hit.point.clone().sub(world.position);
  point.normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null;
  return point;
}

// Pointer position on the lawn (or at height h), in island coordinates.
function groundPoint(e, h = 0) {
  setPointer(e);
  groundPlane.constant = -(world.position.y + h);
  const p = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  return p ? p.sub(world.position) : null;
}

// The roof terrace the pointer is over, with the point on its deck: { t, p }.
function roofPoint(e) {
  const ts = (dragZones.terraces ?? []).slice().sort((a, b) => b.y - a.y);
  for (const t of ts) {
    const p = groundPoint(e, t.y);
    if (p && p.x > t.x0 - 0.1 && p.x < t.x1 + 0.1 && p.z > t.z0 - 0.1 && p.z < t.z1 + 0.1) return { t, p };
  }
  return null;
}

function showRing(type, x, z, rot, ok, scale = 1, y = 0) {
  const [rx, rz] = footprint(type, rot, scale);
  dropRing.visible = true;
  dropRing.position.set(x, y + 0.06, z);
  dropRing.scale.setScalar(Math.max(rx, rz) + 0.1);
  dropRing.material.color.set(ok ? '#6cd47a' : '#ef7a7a');
}

// ---------------------------------------------------------------------------
// Zoom: the mouse wheel, two-finger pinch, and dragging empty space to pan
// (when zoomed in). A press on the house or lawn only counts as a tap if the
// pointer didn't move, so panning never opens the house chooser.
// ---------------------------------------------------------------------------
const pointers = new Map(); // pointerId -> { x, y }
let pinch = null;           // { dist, midX, midY }
let pan = null;             // { pointerId, startX, startY, lastX, lastY, moved }
let stroke = null;          // a water brush stroke: { pointerId, x, z, erase }

canvasEl.addEventListener('wheel', e => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

function startPinch() {
  const [a, b] = [...pointers.values()];
  pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
  pan = null;
  if (drag) { const id = drag.pointerId; endDrag({ pointerId: id }, true); }
}

canvasEl.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { stroke = null; startPinch(); return; }
  if (pointers.size > 2) return;
  if (drag || e.button > 0) return;
  if (getWaterTool()) {
    // Water brush: paint (or wipe) along the drag.
    const p = groundPoint(e);
    if (!p) return;
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    showHandles(false);
    pickHousePart(null);
    stroke = { pointerId: e.pointerId, x: p.x, z: p.z, erase: getWaterTool() === 'erase' };
    if (brush(p.x, p.z, p.x, p.z, stroke.erase)) sfx.click();
    return;
  }
  const obj = pickItem(e);
  const p = obj && groundPoint(e, obj.userData.roofY ?? 0);
  if (!p) {
    // Not on a garden item: a pan if it moves, a tap on the house or lawn if not.
    try { canvasEl.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    pan = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY,
            moved: false, hit: hitsHouse(e) };
    return;
  }
  showHandles(false);
  pickHousePart(null);
  e.preventDefault();
  try { canvasEl.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  drag = { id: obj.userData.drag, type: obj.userData.dragType, obj, pointerId: e.pointerId,
           startX: e.clientX, startY: e.clientY, moved: false, spot: null,
           offset: new THREE.Vector3(obj.position.x - p.x, 0, obj.position.z - p.z),
           baseRot: obj.rotation.y, rot: obj.rotation.y };
});

canvasEl.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y), midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    panBy(midX - pinch.midX, midY - pinch.midY);
    zoomAt(midX, midY, dist / pinch.dist);
    Object.assign(pinch, { dist, midX, midY });
    return;
  }
  if (stroke && e.pointerId === stroke.pointerId) {
    const p = groundPoint(e);
    if (!p) return;
    brush(stroke.x, stroke.z, p.x, p.z, stroke.erase);
    stroke.x = p.x; stroke.z = p.z;
    return;
  }
  if (pan && e.pointerId === pan.pointerId) {
    if (!pan.moved && Math.hypot(e.clientX - pan.startX, e.clientY - pan.startY) < 6) return;
    pan.moved = true;
    if (getZoom() > 1.001) {
      panBy(e.clientX - pan.lastX, e.clientY - pan.lastY);
      canvasEl.style.cursor = 'grabbing';
    }
    pan.lastX = e.clientX; pan.lastY = e.clientY;
    return;
  }
  if (!drag) {
    if (e.pointerType === 'mouse') canvasEl.style.cursor = pickItem(e) ? 'grab' : '';
    return;
  }
  if (e.pointerId !== drag.pointerId) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
  const p = groundPoint(e);
  if (!p) return;
  if (!drag.moved) {
    drag.moved = true;
    select(null);
    canvasEl.style.cursor = 'grabbing';
    gsap.killTweensOf(drag.obj.position);
    sfx.click();
  }
  // Over a roof terrace the item goes up there; anywhere else, the garden.
  const up = roofPoint(e);
  const level = up ? up.t.y : 0;
  const at = up ? up.p : p;
  let x = at.x + drag.offset.x, z = at.z + drag.offset.z;
  drag.roof = !!up;
  drag.obj.position.y = level + 0.35;
  drag.obj.position.x = x;
  drag.obj.position.z = z;
  drag.spot = landingSpot(drag.id, drag.type, x, z, drag.rot, drag.roof);
  const sc = drag.obj.userData.scale ?? 1;
  if (drag.spot) showRing(drag.type, drag.spot[0], drag.spot[1], drag.rot, true, sc, level);
  else showRing(drag.type, x, z, drag.rot, false, sc, level);
});

function endDrag(e, cancelled = false) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const { id, moved, spot, rot, roof } = drag;
  drag = null;
  dropRing.visible = false;
  canvasEl.style.cursor = '';
  if (cancelled) { update(false); return; }
  if (!moved) {
    sfx.click();
    select(id);
  } else if (spot) {
    sfx.pop(0);
    placeItem(id, spot, rot, !!roof);
    return;
  } else {
    sfx.bloop(); // no room anywhere: springs back to where it was
  }
  update(false);
}
function endPointer(e, cancelled) {
  pointers.delete(e.pointerId);
  if (stroke && e.pointerId === stroke.pointerId) {
    stroke = null;
    sfx.pop(0);
    update(false); // flowers, bushes and garden items move out of the new water
    return;
  }
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (pan && e.pointerId === pan.pointerId) {
    const { moved, hit } = pan;
    pan = null;
    canvasEl.style.cursor = '';
    if (!moved && !cancelled) {
      select(null);
      showHandles(!!hit); // tap the house for its handles and room chooser, the lawn to hide them
      pickHousePart(hit);
    }
    return;
  }
  endDrag(e, cancelled);
}
canvasEl.addEventListener('pointerup', e => endPointer(e, false));
canvasEl.addEventListener('pointercancel', e => endPointer(e, true));
