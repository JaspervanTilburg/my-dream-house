import { state } from './config.js';
import { dragZones } from './props.js';

// ---------------------------------------------------------------------------
// Water she paints onto the garden: which cells of a small grid around the
// island's center are wet (`state.water`, "i,j"). Kept apart from the drawing
// (water.js) so the garden code can ask "is it wet here?" without a loop.
// ---------------------------------------------------------------------------
export const CELL = 0.5;
export const cellKey = (i, j) => `${i},${j}`;
const cellOf = v => Math.floor(v / CELL);
const centerOf = i => (i + 0.5) * CELL;

let cells = new Set(state.water ?? []);
const listeners = new Set();
export const onWaterChange = fn => listeners.add(fn);
const changed = () => {
  state.water = [...cells];
  listeners.forEach(fn => fn());
};
export const waterCells = () => cells;
export const centerOfCell = i => (i + 0.5) * CELL;

export function setWater(list) {
  cells = new Set(list);
  changed();
}

// Is any water under the box centered at (x, z) with half sizes (rx, rz)?
export function wetAt(x, z, rx = 0, rz = rx) {
  if (!cells.size) return false;
  for (let i = cellOf(x - rx); i <= cellOf(x + rx); i++) {
    for (let j = cellOf(z - rz); j <= cellOf(z + rz); j++) if (cells.has(cellKey(i, j))) return true;
  }
  return false;
}

// Can water go in cell (i, j)? Inside the island and not under the house.
function paintable(i, j) {
  const { hx, hz, walls = [] } = dragZones;
  const x = centerOf(i), z = centerOf(j);
  if (Math.abs(x) + CELL / 2 > hx - 0.15 || Math.abs(z) + CELL / 2 > hz - 0.15) return false;
  return !walls.some(w => x > w.x0 - 0.2 && x < w.x1 + 0.2 && z > w.z0 - 0.2 && z < w.z1 + 0.2);
}

// Paint (or erase) a round brush stroke from (x0, z0) to (x1, z1).
export function brush(x0, z0, x1, z1, erase, radius = 0.55) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (CELL / 2)));
  let any = false;
  for (let s = 0; s <= steps; s++) {
    const x = x0 + ((x1 - x0) * s) / steps, z = z0 + ((z1 - z0) * s) / steps;
    for (let i = cellOf(x - radius); i <= cellOf(x + radius); i++) {
      for (let j = cellOf(z - radius); j <= cellOf(z + radius); j++) {
        if (Math.hypot(centerOf(i) - x, centerOf(j) - z) > radius) continue;
        const k = cellKey(i, j);
        if (erase ? cells.delete(k) : !cells.has(k) && paintable(i, j) && cells.add(k)) any = true;
      }
    }
  }
  if (any) changed();
  return any;
}

export function clearWater() {
  if (!cells.size) return;
  cells.clear();
  changed();
}

