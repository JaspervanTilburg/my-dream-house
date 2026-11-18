import { STYLES, SWATCHES, state } from './config.js';
import { MAX_F, MAX_W, describe, isValid, rectangle, tryAdd } from './layout.js';
import { FRONTS, ROOF_EXTRAS } from './fronts.js';
import { CATALOG, MAX_ITEMS, MAX_SCALE, MIN_SCALE } from './catalog.js';

// ---------------------------------------------------------------------------
// Remember the design in this browser, so it is still there next time.
// Storage can be unavailable (private windows); the page works without it.
export const SAVED_KEYS = ['style', 'cells', 'doorCol', 'fronts', 'sides', 'roofs', 'size', 'height', 'greenery', 'wallColor', 'roofColor', 'extras', 'items', 'night', 'water'];
export function saveDesign() {
  try {
    localStorage.setItem('dream-house', JSON.stringify(Object.fromEntries(SAVED_KEYS.map(k => [k, state[k]]))));
  } catch { /* not saved; nothing else to do */ }
}
// Returns true when a design from an earlier visit was found and loaded.
export function loadDesign() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('dream-house')); } catch { return false; }
  if (!saved || !STYLES[saved.style]) return false;
  const inRange = (v, min, max) => typeof v === 'number' && v >= min && v <= max;
  const isColor = (v, key) => SWATCHES[key].some(([c]) => c === v) || Object.values(STYLES).some(st =>
    (key === 'wallColor' ? st.wall : st.roofColor) === v);
  if (Array.isArray(saved.cells) && saved.cells.every(c => typeof c === 'string' && /^-?\d+,\d+$/.test(c))
      && isValid(saved.cells)) {
    state.cells = saved.cells;
    if (Number.isInteger(saved.doorCol)) state.doorCol = saved.doorCol;
  } else if (inRange(saved.rooms, 1, MAX_W) && inRange(saved.floors, 1, MAX_F)) {
    state.cells = rectangle(Math.round(saved.rooms), Math.round(saved.floors)); // saved before room blocks
  }
  if (inRange(saved.size, 0.8, 1.3)) state.size = saved.size;
  if (inRange(saved.height, 0.8, 1.4)) state.height = saved.height;
  if (inRange(saved.greenery, 0, 1)) state.greenery = saved.greenery;
  // Fronts and roof extras: keep only known kinds (houseParts also checks
  // that a front fits its floor).
  if (saved.fronts && typeof saved.fronts === 'object') {
    state.fronts = Object.fromEntries(Object.entries(saved.fronts)
      .filter(([k, t]) => /^-?\d+,\d+$/.test(k) && FRONTS[t] && t !== 'door'));
  }
  if (saved.sides && typeof saved.sides === 'object') {
    state.sides = Object.fromEntries(Object.entries(saved.sides)
      .filter(([k, t]) => /^-?\d+,\d+,(left|right|back)$/.test(k) && FRONTS[t] && !['door', 'garage'].includes(t)));
  }
  if (saved.roofs && typeof saved.roofs === 'object') {
    state.roofs = Object.fromEntries(Object.entries(saved.roofs)
      .filter(([c, t]) => /^-?\d+$/.test(c) && ROOF_EXTRAS[t]));
  } else {
    // Saved before roof extras: the chimney sat on the right of the main roof.
    const d = describe(state.cells);
    const tallest = Object.entries(d.columns).filter(([, col]) => col.top === d.height).map(([c]) => Number(c));
    state.roofs = { [Math.max(...tallest)]: 'chimney' };
  }
  // Saved with the old separate garage: it becomes a garage room on the left.
  if (saved.garage === true && !Object.values(state.fronts).includes('garage')) {
    const d = describe(state.cells);
    const grown = tryAdd(state.cells, d.minC - 1, 0);
    if (grown) state.cells = grown;
    state.fronts = { ...state.fronts, [`${d.minC - (grown ? 1 : 0)},0`]: 'garage' };
  }
  if (typeof saved.night === 'boolean') state.night = saved.night;
  if (Array.isArray(saved.water)) state.water = saved.water.filter(k => typeof k === 'string' && /^-?\d+,-?\d+$/.test(k)).slice(0, 2000);
  if (saved.extras && typeof saved.extras.fence === 'boolean') state.extras = { fence: saved.extras.fence };
  if (Array.isArray(saved.items)) {
    const ids = new Set();
    state.items = saved.items.filter(it => it && CATALOG[it.type] && Number.isInteger(it.id) && !ids.has(it.id)
      && Number.isFinite(it.rot) && ((it.u === null && it.v === null) || [it.u, it.v].every(Number.isFinite))
      && ids.add(it.id)).slice(0, MAX_ITEMS).map(({ id, type, u, v, rot, scale, onRoof }) => ({
        id, type, u, v, rot, onRoof: onRoof === true,
        scale: Number.isFinite(scale) ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)) : 1,
      }));
  } else {
    // Designs saved before the garden menu: switches for three sets, plus
    // where she had dragged them.
    const old = saved.placements && typeof saved.placements === 'object' ? saved.placements : {};
    const types = ['mailbox', ...['picnic', 'bench', 'veggies'].filter(t => saved.extras?.[t] ?? t !== 'veggies')];
    state.items = types.map((type, i) => {
      const pl = old[type];
      const ok = pl && [pl.u, pl.v, pl.rot].every(Number.isFinite);
      return { id: i + 1, type, u: ok ? pl.u : null, v: ok ? pl.v : null, rot: ok ? pl.rot : 0 };
    });
  }
  state.style = saved.style;
  if (isColor(saved.wallColor, 'wallColor')) state.wallColor = saved.wallColor;
  if (isColor(saved.roofColor, 'roofColor')) state.roofColor = saved.roofColor;
  return true;
}
