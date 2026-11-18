import * as THREE from 'three';
import { state } from '../config.js';
import { sfx } from '../fx/audio.js';
import { sharedGeometries } from '../helpers.js';
import { toast } from '../items.js';
import { describe, tryAdd, tryRemove } from '../layout.js';
import { camera, renderer } from '../scene.js';
import { getHouse, update, world } from '../world.js';
import { syncControls } from './controls.js';

// ---------------------------------------------------------------------------
// Drag handles for the house shape. Tap the house to show them:
//  - one at each end of every stretch of rooms on a floor: drag sideways to
//    add or remove rooms on that floor;
//  - one on top of every column: drag up or down to add or remove floors.
// While dragging, see-through blocks show what will change, one room per step.
// ---------------------------------------------------------------------------
const layer = document.getElementById('handles');
let visible = false;
let hinted = false;
let drag = null; // { handle, pointerId, startX, startY, preview }

export function showHandles(on) {
  if (on === visible) return;
  visible = on;
  layer.hidden = !on;
  if (on) {
    rebuild(); // clear any buttons from last time before adding new ones
    requestAnimationFrame(follow);
    if (!hinted) { hinted = true; toast('Drag the round handles to add or remove rooms.'); }
  }
}

// Handle definitions from the current layout.
function handleList() {
  const d = describe(state.cells);
  const list = [];
  for (const r of d.runs) {
    list.push({ kind: 'side', dir: -1, f: r.f, c: r.c0 });
    list.push({ kind: 'side', dir: 1, f: r.f, c: r.c1 });
  }
  for (const [c, col] of Object.entries(d.columns)) list.push({ kind: 'top', c: Number(c), top: col.top });
  return list;
}

let handles = [];
function build() {
  shownFor = state.cells.join(';');
  handles = handleList().map(h => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `handle handle-${h.kind}`;
    b.setAttribute('aria-label', h.kind === 'top'
      ? 'Drag up or down to add or remove a floor'
      : 'Drag sideways to add or remove a room');
    b.innerHTML = h.kind === 'top'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-5 5h10zM12 20l5-5H7z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l5-5v10zM20 12l-5 5V7z"/></svg>';
    b.addEventListener('pointerdown', e => startDrag(e, h, b));
    // Keyboard: arrow keys do one step.
    b.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 1, ArrowDown: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      apply(h, h.kind === 'top' ? step : step * h.dir);
    });
    layer.appendChild(b);
    return { h, el: b };
  });
  place(); // in place right away, not one frame later
}
function rebuild() {
  layer.replaceChildren();
  build();
}

// World anchor of a handle (front face, so it is always in view).
function anchor(h, house) {
  const g = house.geom;
  const z = g.z + g.depth / 2 + 0.05;
  if (h.kind === 'top') return new THREE.Vector3(g.colX(h.c), g.roofTop(h.c) + 0.3, z);
  return new THREE.Vector3(g.colX(h.c) + h.dir * (g.module / 2 + 0.25), g.floorY(h.f) + g.floorH / 2, z);
}

const toScreen = v => {
  const p = v.clone().add(world.position).project(camera);
  const r = renderer.domElement.getBoundingClientRect();
  return [(p.x + 1) / 2 * r.width + r.left, (1 - p.y) / 2 * r.height + r.top];
};

let shownFor = '';
function follow() {
  if (!visible) return;
  // The shape changed elsewhere (buttons, Surprise me): new handles.
  const sig = state.cells.join(';');
  if (sig !== shownFor && !drag) rebuild();
  place();
  requestAnimationFrame(follow);
}

function place() {
  const house = getHouse();
  if (!house) return;
  // Top handles first; a side handle that would cover another one moves down a bit.
  const taken = [];
  const order = handles.slice().sort((a, b) => (a.h.kind === 'top' ? 0 : 1) - (b.h.kind === 'top' ? 0 : 1));
  for (const { h, el } of order) {
    if (drag?.handle === h) continue;
    let [x, y] = toScreen(anchor(h, house));
    for (let tries = 0; tries < 3 && taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 40); tries++) y += 30;
    taken.push([x, y]);
    el.style.transform = `translate(${x - 22}px, ${y - 22}px)`;
  }
}

// ---------------------------------------------------------------------------
// Dragging a handle
// ---------------------------------------------------------------------------
// The cells a drag of `steps` would add (+) or remove (-), applied one at a
// time and stopping at the first one the rules don't allow.
function plan(h, steps) {
  let cells = state.cells;
  const changes = [];
  const d = describe(cells);
  for (let i = 0; i < Math.abs(steps); i++) {
    let c, f, adding = steps > 0;
    if (h.kind === 'top') {
      const top = d.columns[h.c].top;
      f = adding ? top + i : top - 1 - i;
      c = h.c;
    } else {
      f = h.f;
      c = adding ? h.c + h.dir * (i + 1) : h.c - h.dir * i;
    }
    const next = adding ? tryAdd(cells, c, f) : tryRemove(cells, c, f);
    if (!next) break;
    cells = next;
    changes.push({ c, f, adding });
  }
  return { cells, changes };
}

function apply(h, steps) {
  const { cells, changes } = plan(h, steps);
  if (!changes.length) { sfx.bloop(); return; }
  state.cells = cells;
  syncControls();
  update(true);
  rebuild();
}

// See-through blocks: green for rooms that will appear, red for ones that go.
const ghostGeo = new THREE.BoxGeometry(1, 1, 1);
sharedGeometries.add(ghostGeo);
const ghostMats = {
  add: new THREE.MeshBasicMaterial({ color: '#6cd47a', transparent: true, opacity: 0.45, depthWrite: false }),
  remove: new THREE.MeshBasicMaterial({ color: '#ef7a7a', transparent: true, opacity: 0.5, depthWrite: false }),
};
const ghosts = new THREE.Group();
world.add(ghosts);

function showGhosts(changes) {
  ghosts.clear();
  const g = getHouse().geom;
  for (const { c, f, adding } of changes) {
    const m = new THREE.Mesh(ghostGeo, adding ? ghostMats.add : ghostMats.remove);
    m.scale.set(g.module * 1.02, g.floorH * 1.02, g.depth * 1.04);
    m.position.set(g.colX(c), g.floorY(f) + g.floorH / 2, g.z);
    m.renderOrder = 3;
    ghosts.add(m);
  }
}

function startDrag(e, h, el) {
  if (drag || e.button > 0) return;
  e.preventDefault();
  e.stopPropagation();
  try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  const house = getHouse();
  const a = anchor(h, house), g = house.geom;
  // One step on screen: a room's width sideways, or a floor's height upward.
  const stepVec = h.kind === 'top' ? new THREE.Vector3(0, g.floorH, 0) : new THREE.Vector3(h.dir * g.module, 0, 0);
  const [ax, ay] = toScreen(a), [bx, by] = toScreen(a.clone().add(stepVec));
  drag = { handle: h, el, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
           baseX: ax, baseY: ay, step: [bx - ax, by - ay], steps: 0 };
  el.classList.add('dragging');
}

layer.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
  const [sx, sy] = drag.step;
  // How many steps along the handle's direction the pointer has moved.
  const along = (dx * sx + dy * sy) / (sx * sx + sy * sy);
  const steps = Math.max(-3, Math.min(3, Math.round(along)));
  drag.el.style.transform = `translate(${drag.baseX + dx - 22}px, ${drag.baseY + dy - 22}px)`;
  if (steps === drag.steps) return;
  drag.steps = steps;
  const { changes } = plan(drag.handle, steps);
  showGhosts(changes);
  sfx.click();
});

function endDrag(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const { handle, steps, el } = drag;
  drag = null;
  el.classList.remove('dragging');
  ghosts.clear();
  if (steps) apply(handle, steps);
}
layer.addEventListener('pointerup', endDrag);
layer.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pointerId) { drag.steps = 0; endDrag(e); } });

