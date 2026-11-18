import { state } from './config.js';
import { CATALOG, MAX_ITEMS, MAX_SCALE, MIN_SCALE, footprint, halfOf, nextItemId } from './catalog.js';
import { sfx } from './fx/audio.js';
import { dragZones, freeRect, insideIsland, nearestSpot } from './props.js';
import { update } from './world.js';
import { wetAt } from './waterdata.js';

// ---------------------------------------------------------------------------
// Garden items: where they may go, and the actions on them (add, turn, copy,
// delete). Positions are stored relative to the island (u, v in -1..1), so an
// item stays in the same part of the garden when the island grows.
// ---------------------------------------------------------------------------

// Does an item of `type` fit at (x, z)? `id` is the item itself, so it never
// bumps into its own old spot. Flat items (a rug) only avoid walls and paths,
// so furniture can stand on them.
// An item's size; while trying a new size, `trialScale` stands in for it.
let trialScale = null;
const scaleOf = id => trialScale ?? state.items.find(it => it.id === id)?.scale ?? 1;

export function dropFits(id, type, x, z, rot, roof = false) {
  const { base, sets, hx, hz, edge } = dragZones;
  const [rx, rz] = footprint(type, rot, scaleOf(id));
  if (roof) {
    // Up on a roof terrace: inside its railing, clear of other things up there.
    const t = (dragZones.terraces ?? []).find(tt => x - rx > tt.x0 && x + rx < tt.x1 && z - rz > tt.z0 && z + rz < tt.z1);
    if (!t) return false;
    if (CATALOG[type]?.flat) return true;
    const others = Object.entries(dragZones.roofSets ?? {}).filter(([k]) => Number(k) !== id).map(([, zone]) => zone);
    return freeRect(others, x, z, rx, rz);
  }
  if (!insideIsland(x, z, rx, rz, hx, hz, edge) || wetAt(x, z, rx, rz) || !freeRect(base, x, z, rx, rz)) return false;
  if (CATALOG[type]?.flat) return true;
  const others = Object.entries(sets).filter(([k]) => Number(k) !== id).map(([, zone]) => zone);
  return freeRect(others, x, z, rx, rz);
}

// Where an item would land: right here if it fits, otherwise the closest spot that does.
export function landingSpot(id, type, x, z, rot, roof = false) {
  if (dropFits(id, type, x, z, rot, roof)) return [x, z];
  return nearestSpot(x, z, (px, pz) => dropFits(id, type, px, pz, rot, roof));
}

// The roof terrace under (x, z), if any.
export const terraceAt = (x, z) => (dragZones.terraces ?? []).find(t => x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1);

// Near a house wall, wall-loving items turn their back to it. Returns the
// facing angle, or null when no wall is close.
export function wallFacing(x, z) {
  return nearestWall(x, z)?.face ?? null;
}

// The closest wall face within reach: { face, rect }.
function nearestWall(x, z) {
  const near = 1.3;
  let best = null;
  for (const h of dragZones.walls ?? []) {
    const alongX = x > h.x0 - 0.3 && x < h.x1 + 0.3, alongZ = z > h.z0 - 0.3 && z < h.z1 + 0.3;
    const sides = [];
    if (alongX) sides.push([Math.abs(z - h.z1), 0], [Math.abs(z - h.z0), Math.PI]);
    if (alongZ) sides.push([Math.abs(x - h.x1), Math.PI / 2], [Math.abs(x - h.x0), -Math.PI / 2]);
    for (const [dist, face] of sides) {
      if (dist < near && (!best || dist < best.dist)) best = { dist, face, rect: h };
    }
  }
  return best;
}

// Pull (x, z) flush against the wall it faces away from.
export function snapToWall(type, face, x, z, scale = 1) {
  const h = nearestWall(x, z)?.rect;
  if (!h) return [x, z];
  const d = halfOf(type)[1] * scale + 0.01;
  if (face === 0) return [x, h.z1 + d];
  if (face === Math.PI) return [x, h.z0 - d];
  return face > 0 ? [h.x1 + d, z] : [h.x0 - d, z];
}

// The same direction as `angle`, as few turns away from `ref` as possible (no wild spins).
export const closestTurn = (angle, ref) => angle + Math.PI * 2 * Math.round((ref - angle) / (Math.PI * 2));

// ---------------------------------------------------------------------------
// Selection: one item at a time. Listeners (the floating action bar) are told
// whenever it changes.
// ---------------------------------------------------------------------------
let selectedId = null;
const listeners = new Set();
export const getSelected = () => selectedId;
export function onSelect(fn) { listeners.add(fn); }
export function select(id) {
  if (id === selectedId) return;
  selectedId = id;
  listeners.forEach(fn => fn(id));
}

const findItem = id => state.items.find(it => it.id === id);
const toUV = ([x, z]) => ({ u: x / dragZones.hx, v: z / dragZones.hz });

// Update one item and rebuild the scene.
export function moveItem(id, changes, animateCamera = false) {
  state.items = state.items.map(it => (it.id === id ? { ...it, ...changes } : it));
  update(animateCamera);
}

// Where an item actually stands now (it may sit at its default spot, or have
// hopped aside when the house grew), and how it is turned.
function itemXZ(it) {
  const spot = dragZones.spots?.[it.id];
  return spot ? [spot.x, spot.z] : [(it.u ?? 0) * dragZones.hx, (it.v ?? 0) * dragZones.hz];
}
const itemRot = it => dragZones.spots?.[it.id]?.rot ?? it.rot;
const itemRoof = it => dragZones.spots?.[it.id]?.roof ?? false;

let toastTimer = null;
export function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// Add a new item on free lawn near the front of the garden, and select it.
export function addItem(type) {
  const spec = CATALOG[type];
  if (!spec) return;
  if (spec.unique) {
    const existing = state.items.find(it => it.type === type);
    if (existing) { select(existing.id); toast(`${spec.label} is already in the garden.`); return; }
  }
  if (state.items.length >= MAX_ITEMS) {
    sfx.bloop();
    toast(`The garden is full (${MAX_ITEMS} things). Delete something to make room.`);
    return;
  }
  const id = nextItemId(state.items);
  const { hx, hz } = dragZones;
  const spot = landingSpot(id, type, -hx * 0.3, hz * 0.55, 0);
  if (!spot) { sfx.bloop(); toast('There is no free spot left on the lawn.'); return; }
  state.items = [...state.items, { id, type, ...toUV(spot), rot: 0 }];
  update(false);
  select(id);
}

export function turnItem(id) {
  const it = findItem(id);
  if (!it) return;
  const rot = itemRot(it) + Math.PI / 2, roof = itemRoof(it);
  const spot = landingSpot(id, it.type, ...itemXZ(it), rot, roof);
  if (!spot) { sfx.bloop(); return; }
  sfx.whoosh();
  moveItem(id, { ...toUV(spot), rot, onRoof: roof });
}

export function copyItem(id) {
  const it = findItem(id);
  if (!it) return;
  if (CATALOG[it.type].unique) { toast('There can only be one mailbox.'); return; }
  if (state.items.length >= MAX_ITEMS) { sfx.bloop(); toast(`The garden is full (${MAX_ITEMS} things).`); return; }
  const newId = nextItemId(state.items);
  const [x, z] = itemXZ(it);
  const rot = itemRot(it), roof = itemRoof(it);
  trialScale = it.scale ?? 1;
  let spot = landingSpot(newId, it.type, x + 0.5, z + 0.5, rot, roof);
  const onRoof = !!spot && roof;
  if (!spot) spot = landingSpot(newId, it.type, x + 0.8, z + 0.8, rot); // no room up there: the garden
  trialScale = null;
  if (!spot) { sfx.bloop(); toast('There is no free spot left on the lawn.'); return; }
  state.items = [...state.items, { id: newId, type: it.type, ...toUV(spot), rot, scale: it.scale ?? 1, onRoof }];
  update(false);
  select(newId);
}

// Make an item bigger or smaller (factor > 1 or < 1). If it no longer fits
// where it stands, it moves to the nearest spot where it does.
export function resizeItem(id, factor) {
  const it = findItem(id);
  if (!it) return;
  const old = it.scale ?? 1;
  const scale = Math.round(Math.max(MIN_SCALE, Math.min(MAX_SCALE, old * factor)) * 100) / 100;
  if (scale === old) { sfx.bloop(); return; }
  trialScale = scale;
  const roof = itemRoof(it);
  const spot = landingSpot(id, it.type, ...itemXZ(it), itemRot(it), roof);
  trialScale = null;
  if (!spot) { sfx.bloop(); toast('There is no room for it that big here.'); return; }
  sfx.pop(0);
  moveItem(id, { ...toUV(spot), rot: itemRot(it), scale, onRoof: roof });
}

export function deleteItem(id) {
  state.items = state.items.filter(it => it.id !== id);
  select(null);
  update(false);
}

// Save a dragged item's new spot (and turn).
export function placeItem(id, spot, rot, roof = false) {
  moveItem(id, { ...toUV(spot), rot, onRoof: roof });
}
