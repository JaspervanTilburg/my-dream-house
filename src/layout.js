// ---------------------------------------------------------------------------
// The house as a grid of room blocks. A block is "c,f": column c (any integer,
// so growing to the left never renames existing rooms) and floor f (0 = ground).
//
// Rules:
//  - every room stands on a room, except first-floor rooms, which may stand
//    on posts (a covered terrace below);
//  - all rooms are connected (sideways or up/down) and the ground floor has one;
//  - at most MAX_W columns wide and MAX_F floors high.
// ---------------------------------------------------------------------------
export const MAX_W = 5;
export const MAX_F = 3;

export const key = (c, f) => `${c},${f}`;
export const parse = k => k.split(',').map(Number);

export function rectangle(rooms, floors) {
  const cells = [];
  for (let f = 0; f < floors; f++) for (let c = 0; c < rooms; c++) cells.push(key(c, f));
  return cells;
}

// Facts about a layout that the builder and the handles need.
export function describe(cells) {
  const set = new Set(cells);
  const list = cells.map(parse);
  const cs = list.map(([c]) => c);
  const minC = Math.min(...cs), maxC = Math.max(...cs);
  const columns = {}; // c -> { bottom, top } (top is exclusive)
  for (const [c, f] of list) {
    const col = columns[c] ?? (columns[c] = { bottom: f, top: f + 1 });
    col.bottom = Math.min(col.bottom, f);
    col.top = Math.max(col.top, f + 1);
  }
  const height = Math.max(...Object.values(columns).map(col => col.top));
  // Unbroken stretches of rooms on one floor: [{ f, c0, c1 }] (c1 inclusive).
  const runs = [];
  for (let f = 0; f < height; f++) {
    let start = null;
    for (let c = minC; c <= maxC + 1; c++) {
      if (set.has(key(c, f))) { if (start === null) start = c; }
      else if (start !== null) { runs.push({ f, c0: start, c1: c - 1 }); start = null; }
    }
  }
  return { set, minC, maxC, width: maxC - minC + 1, height, columns, runs, has: (c, f) => set.has(key(c, f)) };
}

export function isValid(cells) {
  if (!cells.length) return false;
  const d = describe(cells);
  if (d.width > MAX_W || d.height > MAX_F) return false;
  if (![...d.set].some(k => parse(k)[1] === 0)) return false;
  for (const k of d.set) {
    const [c, f] = parse(k);
    if (f < 0) return false;
    if (f >= 2 && !d.has(c, f - 1)) return false; // only the first floor may stand on posts
  }
  // Connected: flood fill from any room.
  const seen = new Set([cells[0]]);
  const todo = [cells[0]];
  while (todo.length) {
    const [c, f] = parse(todo.pop());
    for (const [dc, df] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = key(c + dc, f + df);
      if (d.set.has(n) && !seen.has(n)) { seen.add(n); todo.push(n); }
    }
  }
  return seen.size === d.set.size;
}

const withCell = (cells, c, f) => (cells.includes(key(c, f)) ? cells : [...cells, key(c, f)]);
const withoutCell = (cells, c, f) => cells.filter(k => k !== key(c, f));

// Try to add or remove one room; returns the new layout, or null if that
// would break a rule.
export function tryAdd(cells, c, f) {
  const next = withCell(cells, c, f);
  return next !== cells && isValid(next) ? next : null;
}
export function tryRemove(cells, c, f) {
  const next = withoutCell(cells, c, f);
  return next.length !== cells.length && isValid(next) ? next : null;
}

// A room with nothing under it stands on posts: a covered terrace.
export const isTerrace = (d, c, f) => f === 1 && !d.has(c, 0);

// --- Whole-house shortcuts for the Rooms / Floors buttons ---

// Rooms +: a new column on the right, copying the rightmost column.
export function addColumn(cells) {
  const d = describe(cells);
  const col = d.columns[d.maxC];
  let next = cells;
  for (let f = col.bottom; f < col.top; f++) next = withCell(next, d.maxC + 1, f);
  return isValid(next) ? next : null;
}

// Rooms -: drop the rightmost column (or the leftmost if that is not allowed).
export function removeColumn(cells) {
  const d = describe(cells);
  if (d.width <= 1) return null;
  for (const c of [d.maxC, d.minC]) {
    const next = cells.filter(k => parse(k)[0] !== c);
    if (isValid(next)) return next;
  }
  return null;
}

// Floors +: every column grows one floor (up to the limit).
export function addFloor(cells) {
  const d = describe(cells);
  if (d.height >= MAX_F) return null;
  let next = cells;
  for (const [c, col] of Object.entries(d.columns)) {
    if (col.top < MAX_F) next = withCell(next, Number(c), col.top);
  }
  return isValid(next) ? next : null;
}

// Floors -: the tallest columns lose their top floor.
export function removeFloor(cells) {
  const d = describe(cells);
  if (d.height <= 1) return null;
  const next = cells.filter(k => parse(k)[1] !== d.height - 1);
  return isValid(next) ? next : null;
}

// A random but valid layout, for "Surprise me".
export function randomLayout(rand = Math.random) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const w = 1 + Math.floor(rand() * 4);
    let cells = [];
    for (let c = 0; c < w; c++) {
      const terrace = c > 0 && c === w - 1 && rand() < 0.25;
      const h = 1 + Math.floor(rand() * 3);
      for (let f = terrace ? 1 : 0; f < Math.max(h, terrace ? 2 : 1); f++) cells.push(key(c, f));
    }
    if (isValid(cells)) return cells;
  }
  return rectangle(2, 1);
}
