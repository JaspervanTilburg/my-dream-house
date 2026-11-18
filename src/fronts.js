import * as THREE from 'three';
import { P } from './config.js';
import { buildFlower } from './greenery.js';
import { mat, rbox, rng, shade } from './helpers.js';
import { DARK_FRAME, buildDoor, buildWindow, disc, glassMat, houseMats } from './house.js';

// ---------------------------------------------------------------------------
// What a room's front can be, and the extras a roof can get. Every builder
// works in the room's own space: origin at the bottom middle of its front
// wall, facing +z, `h` is the floor height.
// ---------------------------------------------------------------------------
export const FRONTS = {
  window: { label: 'Window' },
  double: { label: 'Two windows' },
  tall: { label: 'Tall window' },
  round: { label: 'Round window' },
  awning: { label: 'Awning' },
  flowerbox: { label: 'Flower box' },
  bay: { label: 'Bay window' },
  balcony: { label: 'Balcony', upper: true },
  door: { label: 'Front door', ground: true },
  garage: { label: 'Garage door', ground: true },
  patio: { label: 'Terrace door', side: true },
  none: { label: 'Plain wall', side: true },
};

// Which fronts a side or back wall may have (no doors there).
// A wall that opens onto a terrace can also have a terrace door.
export function sideFrontsFor(f, terrace = false) {
  return [...(terrace ? ['patio'] : []), 'window', 'double', 'tall', 'round', 'awning', 'flowerbox', 'bay',
    ...(f > 0 ? ['balcony'] : []), 'none'];
}

// Which fronts a room may have.
export function frontsFor(f) {
  return Object.entries(FRONTS).filter(([, o]) => !o.side && (f === 0 ? !o.upper : !o.ground)).map(([k]) => k);
}

export const ROOF_EXTRAS = {
  plain: { label: 'Plain' },
  dormer: { label: 'Dormer', pitched: true },
  chimney: { label: 'Chimney' },
  terrace: { label: 'Roof terrace' },
};

export function roofExtrasFor(roofKind) {
  const pitched = roofKind === 'gable' || roofKind === 'gambrel';
  return Object.entries(ROOF_EXTRAS).filter(([, o]) => pitched || !o.pitched).map(([k]) => k);
}

const winY = h => h * 0.54;

function windowAt(kind, h, sx = 1, sy = 1, x = 0, curtain = null) {
  const w = buildWindow(kind, curtain);
  w.scale.set(sx, sy, 1);
  w.position.set(x, winY(h), 0);
  return w;
}

function roundWindow(st, h) {
  const g = new THREE.Group();
  const frameColor = st.window === 'modern' ? DARK_FRAME : st.window === 'arched' ? '#cfc6b8' : P.frame;
  g.add(disc(0.55, 0.1, frameColor));
  const glass = disc(0.45, 0.14, glassMat());
  g.add(glass);
  for (const rot of [0, Math.PI / 2]) {
    const bar = rbox(0.9, 0.06, 0.18, frameColor, 0.02);
    bar.rotation.z = rot;
    g.add(bar);
  }
  g.position.y = winY(h) + 0.05;
  const wrap = new THREE.Group(); // the house positions the front itself, so keep the height inside
  wrap.add(g);
  return wrap;
}

// Canopy over the window, in the roof color with a scalloped white edge.
function awning(st, h, seed) {
  const g = new THREE.Group();
  g.add(windowAt(st.window, h, 1, 1, 0, seed));
  const canopy = rbox(1.5, 0.08, 0.75, houseMats.roof, 0.03);
  canopy.rotation.x = 0.45;
  canopy.position.set(0, winY(h) + 0.82, 0.3);
  g.add(canopy);
  // Scalloped white edge.
  for (let i = 0; i < 6; i++) {
    const s = shade(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#ffffff')));
    s.position.set(-0.63 + i * 0.25, winY(h) + 0.65, 0.64);
    g.add(s);
  }
  return g;
}

function flowerboxFront(st, h, seed) {
  const g = new THREE.Group();
  g.add(windowAt(st.window, h, 1, 1, 0, seed));
  const box = rbox(1.1, 0.22, 0.28, P.trim, 0.05);
  box.position.set(0, winY(h) - 0.62, 0.16);
  g.add(box);
  const rand = rng(seed);
  for (let i = 0; i < 5; i++) {
    const fl = buildFlower(P.petals[i % P.petals.length], 0.75);
    fl.position.set(-0.42 + i * 0.21, winY(h) - 0.48, 0.18);
    fl.rotation.y = rand() * Math.PI;
    g.add(fl);
  }
  return g;
}

// A bay window: a little box sticking out with windows on three sides. On the
// ground it stands on a low base; higher up it hangs from the wall on a
// sloped support (an oriel window).
export const BAY_DEPTH = 0.6;
function bay(st, plinthColor, upper) {
  const g = new THREE.Group();
  const w = 1.5, hh = 1.6, base = 0.25;
  let foot;
  if (upper) {
    const s = new THREE.Shape();
    s.moveTo(0, base); s.lineTo(BAY_DEPTH + 0.03, base); s.lineTo(0, base - 0.55); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    geo.rotateY(Math.PI / 2); // profile drawn in (z, y), extruded along x
    foot = shade(new THREE.Mesh(geo, mat(st.trim)));
  } else {
    foot = rbox(w + 0.12, base, BAY_DEPTH + 0.06, plinthColor, 0.05);
    foot.position.set(0, base / 2, BAY_DEPTH / 2);
  }
  const body = rbox(w, hh, BAY_DEPTH, houseMats.wall, 0.06);
  body.position.set(0, base + hh / 2, BAY_DEPTH / 2);
  const cap = rbox(w + 0.2, 0.16, BAY_DEPTH + 0.22, houseMats.roof, 0.05);
  cap.position.set(0, base + hh + 0.08, BAY_DEPTH / 2 + 0.04);
  g.add(foot, body, cap);
  const front = buildWindow(st.window);
  front.scale.set(1.15, 1.05, 1);
  front.position.set(0, base + hh / 2, BAY_DEPTH + 0.02);
  g.add(front);
  for (const side of [-1, 1]) {
    const sw = buildWindow(st.window === 'cottage' ? 'barn' : st.window); // no shutters on the narrow sides
    sw.scale.set(0.45, 0.95, 1);
    sw.rotation.y = side * Math.PI / 2;
    sw.position.set(side * (w / 2 + 0.02), base + hh / 2, BAY_DEPTH / 2);
    g.add(sw);
  }
  return g;
}

// A balcony: a glass door with a little platform and railing in front of it.
export const BALCONY_DEPTH = 0.75;
function balcony(st, h) {
  const g = new THREE.Group();
  const frameColor = st.window === 'modern' ? DARK_FRAME : P.frame;
  const frame = rbox(0.95, 1.85, 0.1, frameColor, 0.04);
  frame.position.y = 0.95;
  const glass = rbox(0.78, 1.7, 0.14, glassMat(), 0.03);
  glass.position.y = 0.92;
  const bar = rbox(0.05, 1.7, 0.18, frameColor, 0.02);
  bar.position.y = 0.92;
  g.add(frame, glass, bar);
  const slab = rbox(1.8, 0.12, BALCONY_DEPTH, st.trim, 0.04);
  slab.position.set(0, 0.06, BALCONY_DEPTH / 2);
  g.add(slab);
  const railColor = st.window === 'modern' ? DARK_FRAME : st.trim;
  const top = rbox(1.8, 0.07, 0.07, railColor, 0.02);
  top.position.set(0, 0.85, BALCONY_DEPTH - 0.04);
  g.add(top);
  for (const side of [-1, 1]) {
    const s = rbox(0.07, 0.07, BALCONY_DEPTH, railColor, 0.02);
    s.position.set(side * 0.865, 0.85, BALCONY_DEPTH / 2);
    g.add(s);
  }
  for (let i = 0; i <= 8; i++) {
    const p = rbox(0.045, 0.8, 0.045, railColor, 0.01);
    p.position.set(-0.86 + i * 0.215, 0.45, BALCONY_DEPTH - 0.04);
    g.add(p);
  }
  return g;
}

// Glass double door onto a terrace, with a little lamp beside it.
function patioDoor(st) {
  const g = new THREE.Group();
  const frameColor = st.window === 'modern' ? DARK_FRAME : P.frame;
  const frame = rbox(1.25, 1.95, 0.1, frameColor, 0.04);
  frame.position.y = 0.98;
  const glass = rbox(1.08, 1.8, 0.14, glassMat(), 0.03);
  glass.position.y = 0.95;
  const mid = rbox(0.06, 1.8, 0.18, frameColor, 0.02);
  mid.position.y = 0.95;
  g.add(frame, glass, mid);
  for (const x of [-0.27, 0.27]) {
    const bar = rbox(0.5, 0.04, 0.17, frameColor, 0.01);
    bar.position.set(x, 1.25, 0);
    const knob = rbox(0.04, 0.16, 0.2, P.knob, 0.01);
    knob.position.set(x > 0 ? 0.08 : -0.08, 0.95, 0);
    g.add(bar, knob);
  }
  const lamp = rbox(0.13, 0.17, 0.13, mat('#fff1b8', { emissive: '#ffd36e', emissiveIntensity: 0.8 }), 0.03);
  lamp.position.set(0.82, 1.55, 0.12);
  g.add(lamp);
  return g;
}

// Roll-up garage door with grooves and a little lamp above it.
function garageDoor() {
  const g = new THREE.Group();
  const frame = rbox(1.8, 1.9, 0.1, P.frame, 0.05);
  frame.position.y = 0.95;
  const door = rbox(1.62, 1.75, 0.14, '#f4efe8', 0.05);
  door.position.y = 0.88;
  g.add(frame, door);
  for (let i = 0; i < 4; i++) {
    const groove = rbox(1.5, 0.04, 0.17, '#d9cfc3', 0.015);
    groove.position.y = 0.3 + i * 0.38;
    g.add(groove);
  }
  const lamp = shade(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), mat(P.knob, { emissive: '#ffd36e', emissiveIntensity: 0.5 })));
  lamp.position.set(0, 2.08, 0.06);
  g.add(lamp);
  return g;
}

export function buildFront(type, st, h, seed, { upper = false } = {}) {
  switch (type) {
    case 'double': {
      const g = new THREE.Group();
      g.add(windowAt(st.window, h, 0.62, 1, -0.42, seed), windowAt(st.window, h, 0.62, 1, 0.42, seed));
      return g;
    }
    case 'tall': {
      const g = new THREE.Group();
      const w = windowAt(st.window, h, 0.85, 1.55, 0, seed);
      w.position.y = winY(h) - 0.12;
      g.add(w);
      return g;
    }
    case 'round': return roundWindow(st, h);
    case 'awning': return awning(st, h, seed);
    case 'flowerbox': return flowerboxFront(st, h, seed);
    case 'bay': return bay(st, st.plinth, upper);
    case 'balcony': return balcony(st, h);
    case 'garage': return garageDoor();
    case 'door': return buildDoor(st.door);
    case 'none': return new THREE.Group();
    case 'patio': return patioDoor(st);
    default: {
      const g = new THREE.Group();
      g.add(windowAt(st.window, h, 1, 1, 0, seed));
      return g;
    }
  }
}

// How far a front sticks out in front of the wall (for the garden).
export const frontDepth = type => (type === 'bay' ? BAY_DEPTH : 0);

// --- Roof extras: built in roof space (origin at the top of the walls, in
// the middle of the column; the front of the house is +z). ---

// Where a roof's front slope is, for each roof kind: the dormer sits there.
const DORMER_AT = {
  gable: { y: 0.42, z: 0.95, h: 0.95 },
  gambrel: { y: 0.5, z: 0.95, h: 0.95 },
};

export function buildDormer(roofKind, st) {
  const at = DORMER_AT[roofKind];
  const g = new THREE.Group();
  const w = 1.0, d = 1.3;
  const body = rbox(w, at.h, d, houseMats.wall, 0.06);
  body.position.set(0, at.y + at.h / 2, at.z - d / 2 + 0.25);
  g.add(body);
  const win = buildWindow(st.window === 'cottage' ? 'barn' : st.window);
  win.scale.set(0.65, 0.6, 1);
  win.position.set(0, at.y + at.h * 0.5, at.z + 0.27);
  g.add(win);
  // Little gable roof on top.
  const rise = 0.42;
  const slope = Math.hypot(w / 2 + 0.12, rise), angle = Math.atan2(rise, w / 2 + 0.12);
  for (const side of [-1, 1]) {
    const slab = rbox(slope + 0.06, 0.1, d + 0.2, houseMats.roof, 0.03);
    slab.rotation.z = -side * angle;
    slab.position.set(side * (w / 4 + 0.06), at.y + at.h + rise / 2 + 0.04, at.z - d / 2 + 0.3);
    g.add(slab);
  }
  return g;
}

// Chimney on the back half of the roof, tall enough to clear every roof kind.
const CHIMNEY_AT = {
  gable: { y: 0.55, z: -0.75, h: 1.6 },
  gambrel: { y: 0.8, z: -0.75, h: 1.55 },
  flat: { y: 0.35, z: -0.7, h: 1.2 },
  battlements: { y: 0.25, z: -0.6, h: 1.3 },
  stepped: { y: 0.45, z: -0.75, h: 1.75 },
};

export function buildChimney(roofKind, x = 0.45) {
  const at = CHIMNEY_AT[roofKind];
  const g = new THREE.Group();
  const stack = rbox(0.55, at.h, 0.55, P.chimney, 0.06);
  stack.position.set(x, at.y + at.h / 2, at.z);
  const cap = rbox(0.72, 0.16, 0.72, P.frame, 0.05);
  cap.position.set(x, at.y + at.h + 0.05, at.z);
  cap.name = 'chimney-top'; // smoke puffs start here
  g.add(stack, cap);
  return g;
}
