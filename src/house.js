import * as THREE from 'three';
import { P, STYLES, state } from './config.js';
import { IVY_ROW, buildFlower, buildIvy } from './greenery.js';
import { describe, isTerrace, key as cellKey, parse } from './layout.js';
import { WALL_TEXTURES, brickTexture, plankTexture, worldUVPart } from './materials.js';
import { BAY_DEPTH, buildChimney, buildDormer, buildFront, frontDepth, frontsFor, roofExtrasFor, sideFrontsFor } from './fronts.js';
import { mat, rbox, roofTexture, shade, sphere } from './helpers.js';

// ---------------------------------------------------------------------------
// House parts
// ---------------------------------------------------------------------------
export const MODULE = 2;      // width of one room module
export const DEPTH = 3;       // house depth
export const FLOOR_H = 2.6;   // wall height per floor
export const PLINTH_H = 0.3;

export const WOOD = '#8a5a3c';
export const DARK_FRAME = '#3f4250';
export const glassMat = () => mat(P.glass, { roughness: 0.25, emissive: '#2d7f99', emissiveIntensity: 0.18 });

// A flat disc facing +z, used for arched tops.
export function disc(r, depth, material) {
  const m = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, 24),
    typeof material === 'string' ? mat(material) : material));
  m.rotation.x = Math.PI / 2;
  return m;
}

// Curtain colors; each window gets one from its `curtain` number (null = none).
const CURTAINS = ['#f7a8b8', '#c9b8ff', '#fff3df', '#a8e6c8', '#ffe08a'];

// Tied-back curtains just behind the window bars, with a little valance on top.
function addCurtains(g, w, h, curtain, kind) {
  const color = CURTAINS[Math.abs(curtain) % CURTAINS.length];
  if (kind === 'modern') {
    const blind = rbox(w - 0.06, h * 0.32, 0.03, color, 0.01); // a roller blind, half down
    blind.position.set(0, h / 2 - h * 0.16 - 0.03, 0.085);
    g.add(blind);
    return;
  }
  for (const s of [-1, 1]) {
    const top = rbox(0.2, h * 0.55, 0.03, color, 0.015);
    top.position.set(s * (w / 2 - 0.12), h * 0.2, 0.085);
    const low = rbox(0.11, h * 0.36, 0.03, color, 0.015);
    low.position.set(s * (w / 2 - 0.08), -h * 0.27, 0.085);
    const tie = rbox(0.14, 0.04, 0.04, '#ffffff', 0.015);
    tie.position.set(s * (w / 2 - 0.1), -h * 0.07, 0.09);
    g.add(top, low, tie);
  }
  const valance = rbox(w - 0.04, 0.1, 0.035, color, 0.015);
  valance.position.set(0, h / 2 - 0.07, 0.09);
  g.add(valance);
}

export function buildWindow(kind = 'cottage', curtain = null) {
  const g = new THREE.Group();
  if (kind === 'modern') {
    const w = 1.3, h = 1.2;
    g.add(rbox(w + 0.1, h + 0.1, 0.1, DARK_FRAME, 0.03));
    g.add(rbox(w, h, 0.14, glassMat(), 0.02));
    g.add(rbox(0.05, h, 0.18, DARK_FRAME, 0.02));
    const sill = rbox(w + 0.25, 0.07, 0.25, '#e7e3dc', 0.02);
    sill.position.set(0, -h / 2 - 0.08, 0.06);
    g.add(sill);
    if (curtain !== null) addCurtains(g, w, h, curtain, kind);
    return g;
  }
  if (kind === 'arched') {
    const w = 0.6, h = 0.8;
    const frame = rbox(w + 0.2, h + 0.1, 0.1, '#cfc6b8', 0.04);
    const frameTop = disc(w / 2 + 0.1, 0.1, '#cfc6b8');
    frameTop.position.y = h / 2;
    const glass = rbox(w, h, 0.14, glassMat(), 0.02);
    const glassTop = disc(w / 2, 0.14, glassMat());
    glassTop.position.y = h / 2;
    const bar = rbox(0.05, h + w / 2, 0.18, '#6c6258', 0.02);
    bar.position.y = w / 4;
    g.add(frame, frameTop, glass, glassTop, bar);
    if (curtain !== null) addCurtains(g, w, h, curtain, kind);
    return g;
  }
  if (kind === 'beach') {
    // White window with louvred shutters in sea green.
    const w = 0.8, h = 1.0;
    g.add(rbox(w + 0.18, h + 0.18, 0.1, '#ffffff', 0.04));
    g.add(rbox(w, h, 0.14, glassMat(), 0.03));
    g.add(rbox(0.06, h, 0.18, '#ffffff', 0.02), rbox(w, 0.06, 0.18, '#ffffff', 0.02));
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.add(rbox(0.3, h + 0.14, 0.06, '#6cc3bd', 0.03));
      for (let i = 0; i < 6; i++) {
        const slat = rbox(0.26, 0.035, 0.1, '#58ada7', 0.01);
        slat.position.y = -h / 2 + 0.1 + i * (h - 0.06) / 6;
        sh.add(slat);
      }
      sh.position.x = s * (w / 2 + 0.28);
      g.add(sh);
    }
    if (curtain !== null) addCurtains(g, w, h, curtain, kind);
    return g;
  }
  if (kind === 'canal') {
    // Tall white sash window with small panes and a brick arch above it.
    const w = 0.78, h = 1.3;
    g.add(rbox(w + 0.16, h + 0.16, 0.1, P.frame, 0.03));
    g.add(rbox(w, h, 0.14, glassMat(), 0.02));
    g.add(rbox(w, 0.07, 0.18, P.frame, 0.02)); // the sash
    for (const y of [-h / 4, h / 4]) {
      const bar = rbox(w, 0.035, 0.17, P.frame, 0.01);
      bar.position.y = y;
      g.add(bar);
    }
    g.add(rbox(0.035, h, 0.17, P.frame, 0.01));
    const arch = rbox(w + 0.36, 0.14, 0.12, mat('#8a3a2a'), 0.03);
    arch.position.y = h / 2 + 0.16;
    g.add(arch);
    if (curtain !== null) addCurtains(g, w, h, curtain, kind);
    return g;
  }
  // Cottage and barn: four panes; the cottage adds shutters.
  const barn = kind === 'barn';
  const w = barn ? 0.85 : 0.8, h = 0.95, border = barn ? 0.26 : 0.18;
  g.add(rbox(w + border, h + border, 0.1, P.frame, 0.04));
  g.add(rbox(w, h, 0.14, glassMat(), 0.03));
  g.add(rbox(0.06, h, 0.18, P.frame, 0.02), rbox(w, 0.06, 0.18, P.frame, 0.02));
  if (kind === 'cottage') {
    [-1, 1].forEach(s => {
      const sh = rbox(0.24, h + 0.12, 0.08, P.trim, 0.04);
      sh.position.x = s * (w / 2 + 0.25);
      g.add(sh);
    });
  }
  if (curtain !== null) addCurtains(g, w, h, curtain, kind);
  return g;
}

// White X brace, as on barn doors.
export function xBrace(w, h, depth) {
  const g = new THREE.Group();
  const len = Math.hypot(w, h), angle = Math.atan2(h, w);
  [angle, -angle].forEach(a => {
    const bar = rbox(len, 0.1, depth, P.frame, 0.02);
    bar.rotation.z = a;
    g.add(bar);
  });
  return g;
}

export function buildDoor(kind = 'cottage') {
  const g = new THREE.Group();
  if (kind === 'beach') {
    // Turquoise door with a round porthole window.
    const frame = rbox(1.05, 1.95, 0.1, '#ffffff', 0.05);
    frame.position.y = 0.975;
    const panel = rbox(0.85, 1.82, 0.14, '#4cc3c3', 0.05);
    panel.position.y = 0.92;
    const port = disc(0.2, 0.17, '#ffffff');
    port.position.y = 1.35;
    const portGlass = disc(0.15, 0.19, glassMat());
    portGlass.position.y = 1.35;
    const knob = sphere(0.06, P.knob, 12);
    knob.position.set(0.3, 0.9, 0.1);
    g.add(frame, panel, port, portGlass, knob);
    return g;
  }
  if (kind === 'canal') {
    // Dark green front door with a window above it (a transom) and a white frame.
    const frame = rbox(1.1, 2.3, 0.1, P.frame, 0.04);
    frame.position.y = 1.15;
    const panel = rbox(0.86, 1.7, 0.14, '#2f5d4a', 0.04);
    panel.position.y = 0.88;
    const transom = rbox(0.86, 0.38, 0.14, glassMat(), 0.03);
    transom.position.y = 1.98;
    const bar = rbox(0.9, 0.06, 0.17, P.frame, 0.02);
    bar.position.y = 1.76;
    const knob = sphere(0.07, P.knob, 12);
    knob.position.set(0, 1.0, 0.1);
    g.add(frame, panel, transom, bar, knob);
    for (const y of [0.45, 1.25]) {
      const inset = rbox(0.6, 0.55, 0.16, '#3a6e58', 0.03);
      inset.position.y = y;
      g.add(inset);
    }
    return g;
  }
  if (kind === 'modern') {
    const panel = rbox(0.9, 1.95, 0.14, DARK_FRAME, 0.03);
    panel.position.y = 0.975;
    const strip = rbox(0.18, 1.6, 0.18, glassMat(), 0.02);
    strip.position.set(-0.25, 0.98, 0);
    const handle = rbox(0.05, 0.6, 0.22, '#c9ccd6', 0.02);
    handle.position.set(0.3, 1.0, 0);
    g.add(panel, strip, handle);
    return g;
  }
  if (kind === 'barn') {
    const frame = rbox(1.5, 1.85, 0.1, P.frame, 0.04);
    frame.position.y = 0.925;
    const panel = rbox(1.3, 1.7, 0.14, WOOD, 0.04);
    panel.position.y = 0.87;
    const brace = xBrace(1.2, 1.55, 0.18);
    brace.position.y = 0.87;
    g.add(frame, panel, brace);
    return g;
  }
  if (kind === 'arched') {
    const frame = rbox(1.15, 1.45, 0.1, '#cfc6b8', 0.04);
    frame.position.y = 0.725;
    const frameTop = disc(0.575, 0.1, '#cfc6b8');
    frameTop.position.y = 1.45;
    const panel = rbox(0.95, 1.4, 0.14, WOOD, 0.03);
    panel.position.y = 0.7;
    const panelTop = disc(0.475, 0.14, WOOD);
    panelTop.position.y = 1.4;
    g.add(frame, frameTop, panel, panelTop);
    [[-0.25, 0.5], [0.25, 0.5], [-0.25, 1.1], [0.25, 1.1]].forEach(([x, y]) => {
      const stud = sphere(0.045, '#4a4038', 8);
      stud.position.set(x, y, 0.08);
      g.add(stud);
    });
    const ring = sphere(0.07, P.knob, 10);
    ring.position.set(0.3, 0.85, 0.09);
    g.add(ring);
    return g;
  }
  const frame = rbox(1.02, 1.8, 0.1, P.frame, 0.05);
  frame.position.y = 0.9;
  const panel = rbox(0.82, 1.66, 0.14, P.door, 0.05);
  panel.position.y = 0.86;
  const pane = rbox(0.42, 0.42, 0.18, mat(P.glass, { roughness: 0.25 }), 0.04);
  pane.position.y = 1.3;
  const knob = sphere(0.06, P.knob, 12);
  knob.position.set(0.28, 0.82, 0.1);
  g.add(frame, panel, pane, knob);
  return g;
}

export function gableGeometry(depth, rise, length) {
  const s = new THREE.Shape();
  s.moveTo(-depth / 2, 0);
  s.lineTo(depth / 2, 0);
  s.lineTo(0, rise);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  geo.translate(0, 0, -length / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

// Roof group with its base at y = 0, so it can slide up and down with the floors.
// Materials shared by all house parts. Color changes tween these instead of
// rebuilding parts, so a new paint color blends in smoothly.
export const capTint = hex => new THREE.Color(hex).multiplyScalar(0.86);
export const houseMats = {
  wall: new THREE.MeshStandardMaterial({ color: state.wallColor, roughness: 0.78 }),
  roof: new THREE.MeshStandardMaterial({ color: state.roofColor, map: roofTexture, roughness: 0.7 }),
  cap: new THREE.MeshStandardMaterial({ color: capTint(state.roofColor), roughness: 0.7 }),
};

// `main`: only the main roof (the tallest part of the house) gets the chimney.
export function buildGableRoof(width, depth, { main = true } = {}) {
  const g = new THREE.Group();
  const half = depth / 2;
  const rise = half * 0.95;
  const overhang = 0.4;
  const thick = 0.22;
  const slope = Math.hypot(half, rise);
  const theta = Math.atan2(rise, half);
  const slabW = slope + overhang;

  // Triangular wall pieces under the roof.
  g.add(shade(new THREE.Mesh(gableGeometry(depth, rise, width), houseMats.wall)));

  const roofMat = houseMats.roof;
  const ridge = new THREE.Vector3(0, rise, 0);
  [1, -1].forEach(side => {
    const slab = rbox(width + 0.7, thick, slabW, roofMat, 0.08);
    const dir = new THREE.Vector3(0, -Math.sin(theta), side * Math.cos(theta));
    const normal = new THREE.Vector3(0, Math.cos(theta), side * Math.sin(theta));
    slab.position.copy(ridge).addScaledVector(dir, slabW / 2 - 0.05).addScaledVector(normal, thick / 2);
    slab.rotation.x = side * theta;
    g.add(slab);
  });

  const cap = rbox(width + 0.8, 0.24, 0.36, houseMats.cap, 0.1);
  cap.position.set(0, rise + 0.22, 0);
  g.add(cap);

  if (!main) return g;
  // Chimney on the back slope.
  const chimney = rbox(0.55, 1.5, 0.55, P.chimney, 0.06);
  chimney.position.set(width * 0.28, rise * 0.5 + 0.55, -half * 0.5);
  const chimneyCap = rbox(0.72, 0.16, 0.72, P.frame, 0.05);
  chimneyCap.position.set(chimney.position.x, chimney.position.y + 0.8, chimney.position.z);
  chimneyCap.name = 'chimney-top'; // smoke puffs start here
  g.add(chimney, chimneyCap);

  return g;
}

// Extrude a (z, y) outline along x: used for the wall pieces under shaped roofs.
export function profileGeometry(points, length) {
  const s = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  geo.translate(0, 0, -length / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

// One roof plane from point a to point b (both [z, y]), extended past b.
export function roofSlab(a, b, width, extend, material) {
  const thick = 0.22;
  const dz = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dz, dy);
  const d = new THREE.Vector3(0, dy / len, dz / len);
  const n = new THREE.Vector3(0, d.z, -d.y);
  if (n.y < 0) n.negate();
  const slab = rbox(width, thick, len + extend, material, 0.08);
  slab.position.set(0, a[1], a[0]).addScaledVector(d, (len + extend) / 2).addScaledVector(n, thick / 2);
  slab.rotation.x = Math.atan2(-d.y, d.z);
  return slab;
}

// Barn: two-pitch gambrel roof, hayloft door and a cupola on the ridge.
export function buildGambrelRoof(width, depth, { main = true, loft = true } = {}) {
  const g = new THREE.Group();
  const h = depth / 2;
  const knee = [h * 0.62, 1.15], ridge = [0, 1.8];
  g.add(shade(new THREE.Mesh(profileGeometry(
    [[-h, 0], [h, 0], knee, ridge, [-knee[0], knee[1]]], width), houseMats.wall)));
  [1, -1].forEach(side => {
    const kneeS = [side * knee[0], knee[1]];
    g.add(roofSlab(ridge, kneeS, width + 0.7, 0.12, houseMats.roof));
    g.add(roofSlab(kneeS, [side * h, 0], width + 0.7, 0.4, houseMats.roof));
  });
  const cap = rbox(width + 0.8, 0.2, 0.32, houseMats.cap, 0.08);
  cap.position.y = ridge[1] + 0.2;
  g.add(cap);

  const loftDoor = new THREE.Group();
  const frame = rbox(0.1, 0.95, 0.85, P.frame, 0.03);
  const panel = rbox(0.14, 0.8, 0.7, WOOD, 0.03);
  const brace = xBrace(0.62, 0.72, 0.18);
  brace.rotation.y = Math.PI / 2;
  loftDoor.add(frame, panel, brace);
  loftDoor.position.set(width / 2 + 0.02, 0.75, 0);
  if (loft) g.add(loftDoor);
  if (!main) return g;

  const cupola = new THREE.Group();
  const box = rbox(0.6, 0.55, 0.6, houseMats.wall, 0.05);
  box.position.y = 0.27;
  const vent = rbox(0.62, 0.25, 0.62, P.frame, 0.04);
  vent.position.y = 0.32;
  const top = shade(new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 4), houseMats.roof));
  top.position.y = 0.8;
  top.rotation.y = Math.PI / 4;
  cupola.add(box, vent, top);
  cupola.position.y = ridge[1] + 0.22;
  g.add(cupola);
  return g;
}

// Modern: flat slab with a thin fascia and solar panels.
export function buildFlatRoof(width, depth, { main = true } = {}) {
  const g = new THREE.Group();
  const fascia = rbox(width + 0.6, 0.12, depth + 0.6, DARK_FRAME, 0.04);
  fascia.position.y = 0.06;
  const slab = rbox(width + 0.5, 0.26, depth + 0.5, houseMats.roof, 0.06);
  slab.position.y = 0.25;
  g.add(fascia, slab);
  if (!main) return g;
  const panels = Math.max(1, Math.floor(width / 1.6));
  for (let i = 0; i < panels; i++) {
    const p = rbox(1.2, 0.08, 1.6, mat('#2f4f86', { roughness: 0.3, metalness: 0.2 }), 0.03);
    p.position.set(-width / 2 + (width / panels) * (i + 0.5), 0.55, -0.2);
    p.rotation.x = -0.35;
    const leg = rbox(0.1, 0.25, 0.1, '#c9ccd6', 0.02);
    leg.position.set(p.position.x, 0.45, 0.3);
    g.add(p, leg);
  }
  return g;
}

// Castle: a flat top with battlements (merlons) around the edge.
export function buildBattlements(width, depth) {
  const g = new THREE.Group();
  const top = rbox(width + 0.3, 0.25, depth + 0.3, houseMats.wall, 0.06);
  top.position.y = 0.12;
  g.add(top);
  const merlon = (x, z) => {
    const m = rbox(0.34, 0.42, 0.34, houseMats.wall, 0.05);
    m.position.set(x, 0.45, z);
    g.add(m);
  };
  const nx = Math.max(2, Math.round(width / 0.65)), nz = Math.max(2, Math.round(depth / 0.65));
  for (let i = 0; i <= nx; i++) {
    const x = -width / 2 + (width * i) / nx;
    merlon(x, depth / 2); merlon(x, -depth / 2);
  }
  for (let i = 1; i < nz; i++) {
    const z = -depth / 2 + (depth * i) / nz;
    merlon(width / 2, z); merlon(-width / 2, z);
  }
  return g;
}

// Castle corner tower with a pointy roof; the right one flies a flag.
export function buildTower(height, flag) {
  const g = new THREE.Group();
  const r = 0.62;
  const body = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.04, height, 24), houseMats.wall));
  body.position.y = height / 2;
  const ring = shade(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.2, 24), mat('#cfc6b8')));
  ring.position.y = height;
  const cone = shade(new THREE.Mesh(new THREE.ConeGeometry(r + 0.18, 1.6, 24), houseMats.roof));
  cone.position.y = height + 0.9;
  g.add(body, ring, cone);
  const slit = buildWindow('arched');
  slit.scale.setScalar(0.6);
  slit.position.set(0, height * 0.62, r);
  g.add(slit);
  if (flag) {
    const pole = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), mat('#6c6258')));
    pole.position.y = height + 2.0;
    const cloth = shade(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 3), mat('#ff7fb0')));
    cloth.rotation.z = -Math.PI / 2;
    cloth.position.set(0.25, height + 2.25, 0);
    g.add(pole, cloth);
  }
  return g;
}

// Roof builders by style; `top` is how far the roof reaches above the walls.
// Canal house: every column gets its own steep roof running front to back,
// with a stepped gable wall on the front and back that rises above it.
const STEPS = [[1, 0], [1, 0.62], [0.68, 0.62], [0.68, 1.22], [0.36, 1.22], [0.36, 1.8], [0.2, 1.8], [0.2, 2.1]];
export function buildSteppedRoof(width, depth, { main = true } = {}) {
  const g = new THREE.Group();
  const n = Math.max(1, Math.round(width / MODULE));
  const half = MODULE / 2, rise = 1.55;
  const angle = Math.atan2(rise, half);
  const gableShape = new THREE.Shape();
  const pts = [...STEPS.map(([x, y]) => [-x, y]), ...STEPS.slice().reverse().map(([x, y]) => [x, y])];
  pts.forEach(([x, y], i) => (i ? gableShape.lineTo(x * half, y) : gableShape.moveTo(x * half, y)));
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.22, bevelEnabled: false });
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + MODULE * (i + 0.5);
    for (const side of [-1, 1]) {
      const slab = rbox(Math.hypot(half, rise) + 0.08, 0.16, depth - 0.2, houseMats.roof, 0.04);
      slab.rotation.z = -side * angle;
      slab.position.set(x + side * half / 2, rise / 2 + 0.05, 0);
      g.add(slab);
    }
    for (const face of [1, -1]) {
      const gable = shade(new THREE.Mesh(gableGeo.clone(), houseMats.wall));
      gable.position.set(x, 0, face * depth / 2 - (face > 0 ? 0.16 : 0.06));
      g.add(gable);
      // White stone caps on every step.
      for (let s = 1; s < STEPS.length - 1; s += 2) {
        const [sx, sy] = STEPS[s];
        for (const dir of [-1, 1]) {
          const capW = (sx - STEPS[s + 1][0]) * half + 0.12;
          const cap = rbox(capW, 0.08, 0.3, P.frame, 0.02);
          cap.position.set(x + dir * (sx * half - capW / 2 + 0.06), sy + 0.04, face * (depth / 2 - 0.05));
          g.add(cap);
        }
      }
      const top = rbox(0.5, 0.1, 0.3, P.frame, 0.02);
      top.position.set(x, 2.15, face * (depth / 2 - 0.05));
      g.add(top);
    }
    // Round attic window and the hoisting beam that canal houses have at the top.
    const attic = disc(0.22, 0.08, P.frame);
    attic.position.set(x, 1.1, depth / 2 + 0.07);
    const atticGlass = disc(0.16, 0.1, glassMat());
    atticGlass.position.set(x, 1.1, depth / 2 + 0.08);
    const beam = rbox(0.12, 0.12, 0.55, '#3f3a36', 0.02);
    beam.position.set(x, 1.7, depth / 2 + 0.2);
    const hook = rbox(0.03, 0.18, 0.03, '#3f3a36', 0.01);
    hook.position.set(x, 1.58, depth / 2 + 0.42);
    g.add(attic, atticGlass, beam, hook);
  }
  return g;
}

export const ROOFS = {
  gable: { build: buildGableRoof, top: DEPTH / 2 + 1.3 },
  gambrel: { build: buildGambrelRoof, top: 2.9 },
  flat: { build: buildFlatRoof, top: 0.9 },
  battlements: { build: buildBattlements, top: 3.4 },
  stepped: { build: buildSteppedRoof, top: 2.3 },
};

// The house built from its room blocks (see layout.js), as a list of keyed
// parts. A part keeps its id between updates, so the reconciler can slide it,
// pop it in or pop it out; ids use absolute column numbers, so growing the
// house to the left does not rename the rooms that were already there.
// `sig` describes a part's shape: when it changes, the part is swapped and morphed.
// Parts are built at size 1 around the house center and then scaled by `size`.
export function houseParts(s, origin) {
  const parts = [];
  const k = s.size;
  const st = STYLES[s.style];
  // The wall material carries the style's pattern (siding, boards, stone...).
  const wallTex = WALL_TEXTURES[st.texture] ?? null;
  if (houseMats.wall.map !== wallTex) {
    houseMats.wall.map = wallTex;
    houseMats.wall.needsUpdate = true;
  }
  const plinthMat = st.brick ? mat(st.plinth, { map: brickTexture }) : mat(st.plinth);
  const add = (id, obj, sig = '') => {
    worldUVPart(obj); // patterns line up across walls (positions are still house-local here)
    obj.position.multiplyScalar(k).add(origin);
    obj.scale.multiplyScalar(k);
    parts.push({ id, obj, sig });
  };
  const d = describe(s.cells);
  const floorH = FLOOR_H * s.height;
  const midC = (d.minC + d.maxC) / 2;
  const cx = c => (c - midC) * MODULE;           // column center, local x
  const runX = r => (cx(r.c0) + cx(r.c1)) / 2;
  const runW = r => (r.c1 - r.c0 + 1) * MODULE;
  // Beach houses stand on stilts: everything starts `lift` higher.
  const lift = st.stilts ?? 0;
  const BASE = PLINTH_H + lift;
  const floorY = f => BASE + f * floorH;
  const DECK_FRONT = DEPTH / 2 + 0.95; // stilt houses: front edge of the deck
  const windowY = f => floorY(f) + floorH * 0.54;
  const frontZ = DEPTH / 2 + 0.02;
  const cols = Object.keys(d.columns).map(Number).sort((a, b) => a - b);
  const groundCols = cols.filter(c => d.has(c, 0));
  const groundRuns = d.runs.filter(r => r.f === 0);

  // Front door: where she put it, or the ground room nearest the middle.
  const doorCol = groundCols.includes(s.doorCol) ? s.doorCol
    : groundCols.slice().sort((a, b) => Math.abs(a - midC) - Math.abs(b - midC) || a - b)[0];
  const doorX = cx(doorCol);

  // On stilts, garage doors sit down at garden level, under their room.
  const garageCols = lift ? groundCols.filter(c => frontType(s, c, 0, doorCol) === 'garage') : [];

  // Plinth under each stretch of ground rooms.
  for (const r of groundRuns) {
    if (lift) {
      const deck = buildStiltDeck(runW(r), lift, st, r.c0 <= doorCol && doorCol <= r.c1 ? cx(doorCol) - runX(r) : null,
        { left: !isTerrace(d, r.c0 - 1, 1) || !d.has(r.c0 - 1, 1), right: !isTerrace(d, r.c1 + 1, 1) || !d.has(r.c1 + 1, 1) },
        garageCols.filter(c => c >= r.c0 && c <= r.c1).map(c => cx(c) - runX(r)));
      deck.position.set(runX(r), 0, 0);
      add(`plinth-c${r.c0}`, deck, `w${runW(r)}|${s.style}|${lift}|${doorCol}|${garageCols.join(',')}`);
      continue;
    }
    const plinth = rbox(runW(r) + 0.3, PLINTH_H, DEPTH + 0.3, plinthMat, 0.08);
    plinth.position.set(runX(r), PLINTH_H / 2, 0);
    add(`plinth-c${r.c0}`, plinth, `w${runW(r)}|${s.style}`);
  }

  // Walls: one block per stretch of rooms on a floor, with a trim band under
  // upper floors (which also hides the seam between floors).
  for (const r of d.runs) {
    const wall = rbox(runW(r), floorH, DEPTH, houseMats.wall, 0.1);
    wall.position.set(runX(r), floorY(r.f) + floorH / 2, 0);
    add(`wall-f${r.f}-c${r.c0}`, wall, `w${runW(r)}|h${floorH}`);
    if (r.f > 0) {
      const band = rbox(runW(r) + 0.14, 0.16, DEPTH + 0.14, st.trim, 0.06);
      band.position.set(runX(r), floorY(r.f), 0);
      add(`band-f${r.f}-c${r.c0}`, band, `w${runW(r)}|${s.style}`);
    }
  }

  // Covered terraces: a first-floor room with nothing under it stands on posts.
  const posts = [], covered = [], fenceSolids = [];
  for (const c of cols) {
    if (!isTerrace(d, c, 1)) continue;
    const t = new THREE.Group();
    // On stilts the terrace is as high as the ground floor's deck, with stilts
    // and stairs; otherwise a plank deck just above the lawn with two steps.
    const deckTop = lift ? BASE : COVERED_DECK;
    if (lift) {
      // Meets the house deck on each side (which reaches 0.45 past the walls),
      // and sticks out as far as that deck does front and back.
      const l = d.has(c - 1, 0) ? 0.45 : -0.45, r = d.has(c + 1, 0) ? 0.45 : -0.45;
      const x0 = -MODULE / 2 + l, x1 = MODULE / 2 - r, z0 = -DEPTH / 2 - 0.45, z1 = DECK_FRONT;
      const slab = rbox(x1 - x0, 0.2, z1 - z0, plankMat(), 0.05);
      slab.position.set((x0 + x1) / 2, deckTop - 0.1, (z0 + z1) / 2);
      t.add(slab);
      for (const x of [x0 + 0.15, x1 - 0.15]) {
        for (const z of [z0 + 0.15, z1 - 0.15]) {
          const stilt = rbox(0.2, deckTop - 0.2, 0.2, '#b9946a', 0.04);
          stilt.position.set(x, (deckTop - 0.2) / 2, z);
          t.add(stilt);
        }
      }
      const stairs = buildStairs(deckTop, st);
      stairs.position.z = z1;
      t.add(stairs);
      fenceSolids.push([cx(c), z1, z1 + stairsLength(deckTop), 0.65]);
    } else {
      const deck = rbox(MODULE - 0.04, COVERED_DECK, DEPTH, plankMat(), 0.04);
      deck.position.y = COVERED_DECK / 2;
      t.add(deck);
    }
    for (let i = 0; i < (lift ? 0 : 2); i++) {
      const stepH = COVERED_DECK * (2 - i) / 3;
      const step = rbox(0.95 - i * 0.15, stepH, 0.3, plankMat(), 0.03);
      step.position.set(0, stepH / 2, DEPTH / 2 + 0.15 + i * 0.28);
      t.add(step);
    }
    // A low picket fence along the back, and along any side not against a room.
    const fence = (len, x, z, rotY) => {
      const f = new THREE.Group();
      const rail = rbox(len, 0.06, 0.05, st.trim, 0.02);
      rail.position.y = 0.42;
      f.add(rail);
      const n = Math.max(3, Math.round(len / 0.2));
      for (let i = 0; i <= n; i++) {
        const picket = rbox(0.06, 0.5, 0.035, st.trim, 0.015);
        picket.position.set(-len / 2 + (len * i) / n, 0.25, 0);
        f.add(picket);
      }
      f.position.set(x, deckTop, z);
      f.rotation.y = rotY;
      t.add(f);
    };
    fence(MODULE - 0.3, 0, -DEPTH / 2 + 0.1, 0);
    for (const sx of [-1, 1]) {
      if (!d.has(c + sx, 0)) {
        fence(DEPTH - 0.6, sx * (MODULE / 2 - 0.1), -0.15, Math.PI / 2);
        fenceSolids.push([cx(c) + sx * (MODULE / 2 - 0.1), -DEPTH / 2, DEPTH / 2 - 0.4]);
      }
    }
    // A pot of flowers in the back corner.
    const pot = new THREE.Group();
    const tub = rbox(0.32, 0.26, 0.32, '#d98e6a', 0.06);
    tub.position.y = 0.13;
    pot.add(tub);
    for (let i = 0; i < 4; i++) {
      const fl = buildFlower(P.petals[i % P.petals.length], 1.1);
      fl.position.set(((i % 2) - 0.5) * 0.14, 0.3, (Math.floor(i / 2) - 0.5) * 0.14);
      pot.add(fl);
    }
    const potSide = d.has(c - 1, 0) ? 1 : -1;
    pot.position.set(potSide * (MODULE / 2 - 0.32), deckTop, -DEPTH / 2 + 0.35);
    t.add(pot);
    covered.push({ x0: cx(c) - MODULE / 2, x1: cx(c) + MODULE / 2, z0: -DEPTH / 2, z1: lift ? DECK_FRONT : DEPTH / 2, y: deckTop });
    const postH = floorY(1) - deckTop;
    const px = MODULE / 2 - 0.12, pz = DEPTH / 2 - 0.12;
    for (const sx of [-1, 1]) {
      if (d.has(c + sx, 0)) continue; // that side leans on the next room
      for (const sz of [-1, 1]) {
        const post = rbox(0.16, postH, 0.16, st.trim, 0.04);
        post.position.set(sx * px, deckTop + postH / 2, sz * pz);
        t.add(post);
        posts.push({ x: cx(c) + sx * px, z: sz * pz });
      }
    }
    const lamp = sphere(0.12, '#fff1b8', 12);
    lamp.material = mat('#fff1b8', { emissive: '#ffd36e', emissiveIntensity: 0.7 });
    lamp.position.y = floorY(1) - 0.2;
    t.add(lamp);
    t.position.set(cx(c), 0, 0);
    add(`terrace-c${c}`, t, `h${floorH}|${s.style}|${lift}|${d.has(c - 1, 0)}${d.has(c + 1, 0)}`);
  }


  // Each room's front is what she picked for it (a window unless she chose otherwise).
  // Does the roof of neighbouring column `nc` reach up in front of floor f's
  // side window? (Its ridge runs right past the middle of that wall.)
  const ridge = { gable: 1.75, gambrel: 2.15, flat: 0.6, battlements: 0.95, stepped: 0.5 }[st.roof];
  const roofTerraceCol = c => s.roofs?.[c] === 'terrace';
  const roofCovers = (nc, f) => {
    const col = d.columns[nc];
    if (!col || roofTerraceCol(nc)) return false; // a roof terrace only has a low railing
    return col.top <= f && floorY(col.top) + ridge > windowY(f) - 0.6;
  };
  // A side wall that opens onto a terrace: the covered one next to a ground
  // room, or a roof terrace right outside a room of the same floor.
  const facesTerrace = (nc, f) => (f === 0 && d.has(nc, 1) && isTerrace(d, nc, 1))
    || (roofTerraceCol(nc) && d.columns[nc]?.top === f);
  const fronts = {}, sides = {}, sideSolids = [], patioWalls = [];
  for (const k2 of d.set) {
    const [c, f] = parse(k2);
    const type = frontType(s, c, f, doorCol);
    fronts[k2] = type;
    const cur = s.seed + c * 3 + f * 5; // each room its own curtains, the same on all its windows
    const front = buildFront(type, st, floorH, cur, { upper: f > 0 });
    const low = f === 0 && garageCols.includes(c);
    front.position.set(cx(c), low ? 0 : floorY(f), frontZ);
    if (low) {
      // The room's walls carry on down to the ground around the garage.
      const base = rbox(MODULE, BASE + 0.05, DEPTH, houseMats.wall, 0.06);
      base.position.set(cx(c), (BASE + 0.05) / 2, 0);
      add(`garage-base-${c}`, base, `${BASE}`);
    }
    if (type === 'door') add('door', front, s.style);
    else add(`front-${c}-${f}`, front, `${type}|${s.style}|${floorH}`);
    // Side and back walls that face outside get what she picked for them (a
    // window unless she chose otherwise; the outer right ground wall starts
    // with a flower box).
    const open = {
      back: true,
      left: !d.has(c - 1, f) && !roofCovers(c - 1, f),
      right: !d.has(c + 1, f) && !roofCovers(c + 1, f),
    };
    for (const face of SIDE_FACES) {
      if (!open[face]) continue;
      const terraceSide = face !== 'back' && facesTerrace(c + SIDE_AT[face].dx, f);
      if (terraceSide) patioWalls.push(`${c},${f},${face}`);
      const fallback = terraceSide ? 'patio'
        : face === 'right' && f === 0 && c === groundCols[groundCols.length - 1] ? 'flowerbox' : 'window';
      const t = sideType(s, c, f, face, fallback, terraceSide);
      sides[`${c},${f},${face}`] = t;
      const obj = buildFront(t, st, floorH, cur, { upper: f > 0 });
      const at = SIDE_AT[face];
      obj.rotation.y = at.rot;
      obj.position.set(cx(c) + at.dx * (MODULE / 2 + 0.02), floorY(f), at.dz * frontZ);
      add(`${face}-${c}-${f}`, obj, `${t}|${s.style}|${floorH}`);
      // Ground-floor flower boxes and bays stick out into the garden.
      if (f === 0 && t === 'flowerbox' && face !== 'back') {
        const x = cx(c) + at.dx * (MODULE / 2 + 0.17);
        sideSolids.push([x - 0.2, x + 0.2, -0.6, 0.6]);
      }
      if (f === 0 && t === 'bay') {
        const out = BAY_DEPTH + 0.1;
        if (face === 'back') sideSolids.push([cx(c) - 0.82, cx(c) + 0.82, -DEPTH / 2 - out, -DEPTH / 2]);
        else {
          const wall = cx(c) + at.dx * MODULE / 2;
          sideSolids.push([Math.min(wall, wall + at.dx * out), Math.max(wall, wall + at.dx * out), -0.82, 0.82]);
        }
      }
    }
  }

  // Porch and step in front of the door (on stilts: stairs down from the deck).
  const porch = new THREE.Group();
  if (lift) {
    porch.add(buildStairs(BASE, st));
    porch.position.set(doorX, 0, DECK_FRONT);
    add('porch', porch, `${s.style}|${lift}`);
    // A lifebuoy hanging on the deck railing beside the stairs.
    const buoy = buildLifebuoy();
    buoy.position.set(doorX + 1.35, BASE + 0.55, DECK_FRONT + 0.06);
    add('lifebuoy', buoy, s.style);
  }
  if (!lift) {
  const deck = rbox(1.8, PLINTH_H, 1.1, plinthMat, 0.08);
  deck.position.set(0, PLINTH_H / 2, 0);
  const step = rbox(1.3, 0.15, 0.45, plinthMat, 0.05);
  step.position.set(0, 0.075, 0.75);
  porch.add(deck, step);
  porch.position.set(doorX, 0, DEPTH / 2 + 0.55);
  add('porch', porch, s.style);
  }

  // A little roof over the door (not on the castle: its arched door has a stone frame).
  if (st.porchRoof !== false && st.roof !== 'battlements') {
    const canopy = buildPorchRoof(st, floorH);
    canopy.position.set(doorX, BASE, DEPTH / 2);
    add('porch-roof', canopy, `${s.style}|${floorH}`);
  }

  // A lantern beside the door, on the other side from the house number.
  const lamp = buildWallLamp(st);
  lamp.position.set(doorX - (st.door === 'barn' ? 1.0 : 0.78), BASE + 1.45, DEPTH / 2 + 0.05);
  add('door-lamp', lamp, s.style);

  // Ivy climbs the outer corners (of columns that reach the ground) once the
  // garden gets lush. Its sig is the row count, so taller ivy stretches up.
  const growth = s.greenery > 0.55 ? (s.greenery - 0.55) / 0.45 : 0;
  const colH = c => d.columns[c].top * floorH;
  const front = DEPTH / 2 + 0.07;
  const L = d.minC, R = d.maxC, side = cx(R) + MODULE / 2 + 0.07;
  [
    { id: 'ivy-front-left', col: L, x: cx(L) - MODULE / 2 + 0.25, z: front, rot: 0, h: 1.0, front: true },
    { id: 'ivy-front-right', col: R, x: cx(R) + MODULE / 2 - 0.2, z: front, rot: 0, h: 0.8, front: true },
    { id: 'ivy-side-front', col: R, x: side, z: DEPTH / 2 - 0.2, rot: Math.PI / 2, h: 0.9 },
    { id: 'ivy-side-back', col: R, x: side, z: -DEPTH / 2 + 0.3, rot: Math.PI / 2, h: 0.6 },
  ].forEach((v, i) => {
    if (d.columns[v.col].bottom !== 0 || (st.towers && v.front)) return; // towers cover the front corners
    const rows = Math.round((growth * colH(v.col) * 0.92 * v.h) / IVY_ROW);
    if (rows < 2) return;
    const ivy = buildIvy(rows, s.seed + 20 + i);
    ivy.position.set(v.x, BASE, v.z);
    ivy.rotation.y = v.rot;
    add(v.id, ivy, `r${rows}`);
  });

  // Roofs: one per stretch of neighbouring columns of the same height. The
  // tallest (then widest) stretch is the main roof, with the chimney or cupola.
  const roofType = ROOFS[st.roof];
  const isRoofTerrace = c => s.roofs?.[c] === 'terrace';
  const roofRuns = [];
  for (const c of cols) {
    if (isRoofTerrace(c)) continue; // a roof terrace replaces this column's roof
    const last = roofRuns[roofRuns.length - 1];
    if (last && last.c1 === c - 1 && last.top === d.columns[c].top) last.c1 = c;
    else roofRuns.push({ c0: c, c1: c, top: d.columns[c].top });
  }
  const main = roofRuns.slice().sort((a, b) => b.top - a.top || (b.c1 - b.c0) - (a.c1 - a.c0) || a.c0 - b.c0)[0];
  for (const r of roofRuns) {
    const isMain = r === main;
    const rightOpen = !d.columns[r.c1 + 1] || d.columns[r.c1 + 1].top < r.top;
    const roof = roofType.build(runW(r), DEPTH, { main: isMain && st.roof !== 'gable', loft: isMain && rightOpen });
    roof.position.set(runX(r), floorY(r.top), 0);
    add(isMain ? 'roof-main' : `roof-c${r.c0}`, roof, `w${runW(r)}|${s.style}|${isMain && rightOpen}`);
  }
  // Roof terraces: a wooden deck with a railing wherever it is not against a
  // taller part of the house (or another terrace at the same height).
  const terraces = [];
  for (const c of cols.filter(isRoofTerrace)) {
    const top = d.columns[c].top;
    const open = side => {
      const n = d.columns[c + side];
      return !n || n.top < top || (n.top === top && !isRoofTerrace(c + side));
    };
    const t = buildRoofTerrace(st, open(-1), open(1));
    t.position.set(cx(c), floorY(top), 0);
    add(`roof-terrace-c${c}`, t, `${s.style}|${top}|${floorH}|${open(-1)}${open(1)}`);
    terraces.push({ c, x0: cx(c) - MODULE / 2 + 0.18, x1: cx(c) + MODULE / 2 - 0.18,
                    z0: -DEPTH / 2 + 0.18, z1: DEPTH / 2 - 0.18, y: floorY(top) + TERRACE_DECK });
  }
  const topY = Math.max(...roofRuns.map(r => floorY(r.top) + roofType.top), ...terraces.map(t => t.y + 1));

  // Gutters under the front eave of sloped roofs, and a downpipe at the outer
  // corner of each roof that comes down to the ground.
  const eave = { gable: { y: -0.32, z: 0.42 }, gambrel: { y: -0.36, z: 0.4 } }[st.roof];
  const pipeColor = st.roof === 'flat' ? DARK_FRAME : '#e9e4ee';
  if (st.roof !== 'battlements') {
    for (const r of roofRuns) {
      const wallTop = floorY(r.top);
      if (eave) {
        const gutter = rbox(runW(r) + 0.6, 0.12, 0.16, pipeColor, 0.05);
        gutter.position.set(runX(r), wallTop + eave.y, DEPTH / 2 + eave.z);
        add(`gutter-c${r.c0}`, gutter, `${runW(r)}|${s.style}|${r.top}|${floorH}`);
      }
      // Downpipe on whichever outer side of this roof reaches the ground.
      // Never on the right of the door room: the house number hangs there.
      const side = [[r.c1, 1], [r.c0, -1]].find(([c, dir]) => d.columns[c].bottom === 0
        && (!d.columns[c + dir] || d.columns[c + dir].top < r.top) && !(c === doorCol && dir === 1));
      if (!side) continue;
      const [pc, dir] = side;
      const pipeH = wallTop + (eave ? eave.y : 0.1) - 0.1;
      const pipe = new THREE.Group();
      const tube = rbox(0.1, pipeH, 0.1, pipeColor, 0.04);
      tube.position.y = pipeH / 2 + 0.1;
      const shoe = rbox(0.12, 0.1, 0.22, pipeColor, 0.04);
      shoe.position.set(0, 0.1, 0.06);
      pipe.add(tube, shoe);
      if (eave) {
        const elbow = rbox(0.1, 0.1, eave.z - 0.02, pipeColor, 0.04);
        elbow.position.set(0, pipeH + 0.1, -(eave.z - 0.02) / 2 + eave.z - 0.1);
        pipe.add(elbow);
      }
      pipe.position.set(cx(pc) + dir * (MODULE / 2 - 0.1), 0, DEPTH / 2 + 0.1);
      add(`pipe-c${r.c0}`, pipe, `${s.style}|${r.top}|${floorH}|${dir}`);
    }
  }

  // Castle towers stand at the front corners, as tall as their column.
  const towerX = { left: cx(L) - MODULE / 2 - 0.15, right: cx(R) + MODULE / 2 + 0.15 };
  if (st.towers) {
    [['left', L], ['right', R]].forEach(([sideName, c]) => {
      const tower = buildTower(floorY(d.columns[c].top) + 0.9, sideName === 'right');
      tower.position.set(towerX[sideName], 0, DEPTH / 2 + 0.15);
      add(`tower-${sideName}`, tower, `h${d.columns[c].top * floorH}`);
    });
  }

  const leftEdge = cx(L) - MODULE / 2;
  // Roof extras per column: a dormer on the front slope or a chimney.
  for (const c of cols) {
    const extra = s.roofs?.[c];
    if (!extra || extra === 'plain' || extra === 'terrace' || !roofExtrasFor(st.roof).includes(extra)) continue;
    const obj = extra === 'dormer' ? buildDormer(st.roof, st) : buildChimney(st.roof);
    obj.position.set(cx(c), floorY(d.columns[c].top), 0);
    add(`roofx-${c}`, obj, `${extra}|${s.style}|${d.columns[c].top}|${floorH}`);
  }

  // Everything below is in world coordinates, for the garden and the handles.
  const wx = x => origin.x + x * k, wz = z => origin.z + z * k;
  const pad = 0.17; // plinth and trim stick out a little past the walls
  const rect = (x0, x1, z0, z1) => ({ x0: wx(x0), x1: wx(x1), z0: wz(z0), z1: wz(z1) });
  const deckPad = lift ? 0.45 : pad;
  const walls = groundRuns.map(r => rect(cx(r.c0) - MODULE / 2 - deckPad, cx(r.c1) + MODULE / 2 + deckPad,
    -DEPTH / 2 - deckPad, lift ? DECK_FRONT : DEPTH / 2 + pad));
  const solids = [...walls, ...posts.map(p => rect(p.x - 0.14, p.x + 0.14, p.z - 0.14, p.z + 0.14))];
  for (const [x0, x1, z0, z1] of sideSolids) solids.push(rect(x0, x1, z0, z1));
  for (const [x, z0, z1, half = 0.08] of fenceSolids) solids.push(rect(x - half, x + half, z0, z1));
  if (st.towers) {
    for (const x of Object.values(towerX)) solids.push(rect(x - 0.75, x + 0.75, DEPTH / 2 - 0.6, DEPTH / 2 + 0.9));
  }
  const left = leftEdge - (st.towers ? 0.8 : 0);
  // Ground fronts that need room in front: bay windows (solid) and garage
  // doors (a driveway); hedges skip both, and the door.
  const garages = [], frontBlocked = [];
  for (const c of groundCols) {
    const type = fronts[cellKey(c, 0)];
    const x0 = cx(c) - MODULE / 2, x1 = cx(c) + MODULE / 2;
    if (type === 'garage') garages.push({ x: wx(cx(c)), w: 1.8 * k, front: wz(DEPTH / 2 + 0.05) });
    if (type === 'bay') solids.push(rect(cx(c) - 0.82, cx(c) + 0.82, DEPTH / 2, DEPTH / 2 + frontDepth('bay') + 0.1));
    if (type !== 'window') frontBlocked.push({ x0: wx(x0), x1: wx(x1) });
  }
  return {
    parts,
    cells: d,
    doorCol,
    doorX: wx(doorX),
    frontZ: wz(lift ? DECK_FRONT + stairsLength(BASE) + 0.15 : DEPTH / 2 + 1.5),
    base: BASE * k, // where the ground floor starts (higher on stilts)
    // Roof terraces in world coordinates: where garden items can stand up there.
    terraces: terraces.map(t => ({ c: t.c, ...rect(t.x0, t.x1, t.z0, t.z1), y: t.y * k })),
    // Covered terraces: things placed there stand on the deck.
    coveredDecks: covered.map(t => ({ ...rect(t.x0, t.x1, t.z0, t.z1), y: t.y * k })),
    patioWalls: new Set(patioWalls), // side walls that open onto a terrace
    height: topY * k, // up to the highest roof detail
    x0: wx(left),
    x1: wx(cx(R) + MODULE / 2 + (st.towers ? 0.8 : 0)),
    houseX0: wx(leftEdge),
    houseX1: wx(cx(R) + MODULE / 2),
    z0: wz(-DEPTH / 2),
    z1: wz(lift ? DECK_FRONT : DEPTH / 2),
    walls,
    solids,
    groundRuns: groundRuns.map(r => ({ x0: wx(cx(r.c0) - MODULE / 2), x1: wx(cx(r.c1) + MODULE / 2) })),
    garages,
    frontBlocked,
    fronts,
    sides, // "c,f,face" -> what that side or back wall shows, for walls facing outside
    // For the drag handles: where a column or floor is in the world.
    geom: {
      colX: c => wx(cx(c)),
      floorY: f => floorY(f) * k,
      floorH: floorH * k,
      module: MODULE * k,
      roofTop: c => (floorY(d.columns[c].top) + roofType.top * 0.6) * k,
      // Which room (or roof) a world point on the house belongs to.
      // `face` comes from the direction the tapped surface points (world normal).
      cellAt: (x, y, normal) => {
        let face = 'front';
        if (normal && Math.abs(normal.x) > 0.6) face = normal.x > 0 ? 'right' : 'left';
        else if (normal && normal.z < -0.6) face = 'back';
        if (face === 'left' || face === 'right') x -= Math.sign(normal.x) * 0.3 * k; // step inside that room
        const c = Math.round((x - origin.x) / k / MODULE + midC);
        const col = d.columns[c];
        if (!col) return null;
        if (y / k >= floorY(col.top) - 0.05) return { c, roof: true };
        let f = Math.max(0, Math.min(col.top - 1, Math.floor((y / k - BASE) / floorH)));
        if (!d.has(c, f)) f = col.bottom; // the deck under a terrace picks the room above it
        if (face !== 'front' && !sides[`${c},${f},${face}`]) face = 'front'; // a wall against a room or roof
        return { c, f, face };
      },
      z: wz(0),
      depth: DEPTH * k,
    },
  };
}

// What a room's front shows: the door room always has the door; ground-only
// and upper-only fronts fall back to a window where they don't fit.
export function frontType(s, c, f, doorCol) {
  if (f === 0 && c === doorCol) return 'door';
  const t = s.fronts?.[cellKey(c, f)];
  return t && t !== 'door' && frontsFor(f).includes(t) ? t : 'window';
}

// Little roof over the front door on two slim posts (a flat slab for modern).
function buildPorchRoof(st, floorH) {
  const g = new THREE.Group();
  const h = Math.min(2.3, floorH - 0.55), depth = 1.15; // stays under the floor above on squat houses
  const postColor = st.window === 'modern' ? DARK_FRAME : P.frame;
  for (const x of [-0.85, 0.85]) {
    const post = rbox(0.1, h, 0.1, postColor, 0.03);
    post.position.set(x, h / 2, depth - 0.1);
    g.add(post);
  }
  if (st.roof === 'flat') {
    const slab = rbox(2.1, 0.14, depth + 0.2, houseMats.roof, 0.04);
    slab.position.set(0, h + 0.07, depth / 2);
    g.add(slab);
    return g;
  }
  // Two small slopes meeting in a ridge that runs out from the wall.
  const rise = 0.42, half = 1.05;
  const angle = Math.atan2(rise, half);
  for (const side of [-1, 1]) {
    const slab = rbox(Math.hypot(half, rise) + 0.12, 0.1, depth + 0.25, houseMats.roof, 0.03);
    slab.rotation.z = -side * angle;
    slab.position.set(side * half / 2, h + rise / 2 + 0.06, depth / 2);
    g.add(slab);
  }
  // Triangle of wall under the slopes, at the front.
  const tri = new THREE.Shape();
  tri.moveTo(-half + 0.1, 0); tri.lineTo(half - 0.1, 0); tri.lineTo(0, rise - 0.04); tri.closePath();
  const front = shade(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.06, bevelEnabled: false }), mat(P.frame)));
  front.position.set(0, h + 0.04, depth - 0.02);
  const beam = rbox(1.9, 0.1, 0.12, postColor, 0.03);
  beam.position.set(0, h, depth - 0.1);
  g.add(front, beam);
  return g;
}

// Wall lantern with a warm glow.
function buildWallLamp(st) {
  const g = new THREE.Group();
  const metal = st.window === 'modern' ? DARK_FRAME : '#5d6470';
  const arm = rbox(0.05, 0.05, 0.16, metal, 0.02);
  arm.position.set(0, 0.12, 0.08);
  const cap = rbox(0.2, 0.06, 0.2, metal, 0.02);
  cap.position.set(0, 0.16, 0.18);
  const glass = rbox(0.15, 0.2, 0.15, mat('#fff1b8', { emissive: '#ffd36e', emissiveIntensity: 0.8 }), 0.03);
  glass.position.set(0, 0.03, 0.18);
  const base = rbox(0.17, 0.04, 0.17, metal, 0.02);
  base.position.set(0, -0.09, 0.18);
  g.add(arm, cap, glass, base);
  return g;
}

export const SIDE_FACES = ['left', 'right', 'back'];
// Where each side or back wall is, relative to the room's center.
const SIDE_AT = {
  left: { dx: -1, dz: 0, rot: -Math.PI / 2 },
  right: { dx: 1, dz: 0, rot: Math.PI / 2 },
  back: { dx: 0, dz: -1, rot: Math.PI },
};

export function sideType(s, c, f, face, fallback = 'window', terrace = false) {
  const t = s.sides?.[`${c},${f},${face}`];
  return t && sideFrontsFor(f, terrace).includes(t) ? t : fallback;
}

// --- Beach house pieces ---

const DECK_WOOD = '#d9b98f';
const plankMat = () => mat('#e2c29a', { map: plankTexture });

// The deck a stilt house stands on: wider at the front, with stilts under it
// and a white railing (open where the stairs come up at `stairX`).
// `sides`: railing on the left/right ends (not toward a covered terrace at deck height).
function buildStiltDeck(width, lift, st, stairX, sides = { left: true, right: true }, garageXs = []) {
  const g = new THREE.Group();
  const w = width + 0.9, front = DEPTH / 2 + 0.95, back = -DEPTH / 2 - 0.45;
  const d = front - back, zc = (front + back) / 2, top = PLINTH_H + lift;
  // Open stretches along the front: the deck strip there leaves room for
  // garage doors down at garden level.
  const gaps = garageXs.map(x => [x - MODULE / 2, x + MODULE / 2]).sort((a, b) => a[0] - b[0]);
  const openRuns = (x0, x1) => {
    const runs = [];
    let from = x0;
    for (const [a, b] of gaps) { if (a > from) runs.push([from, Math.min(a, x1)]); from = Math.max(from, b); }
    if (from < x1) runs.push([from, x1]);
    return runs.filter(([a, b]) => b - a > 0.05);
  };
  const back2 = DEPTH / 2; // the part under and behind the house
  const main = rbox(w, 0.2, back2 - back, plankMat(), 0.05);
  main.position.set(0, top - 0.1, (back + back2) / 2);
  g.add(main);
  for (const [a, b] of openRuns(-w / 2, w / 2)) {
    const strip = rbox(b - a, 0.2, front - back2 + 0.02, plankMat(), 0.05);
    strip.position.set((a + b) / 2, top - 0.1, (back2 + front) / 2);
    g.add(strip);
  }
  const inGap = x => gaps.some(([a, b]) => x > a - 0.1 && x < b + 0.1);
  // Stilts at the corners and along the edges, about one per room.
  const nx = Math.max(1, Math.round(width / MODULE));
  for (let i = 0; i <= nx; i++) {
    const x = -w / 2 + 0.15 + ((w - 0.3) * i) / nx;
    for (const z of [back + 0.15, front - 0.15]) {
      if (z > 0 && inGap(x)) continue;
      const post = rbox(0.2, top - 0.2, 0.2, '#b9946a', 0.04);
      post.position.set(x, (top - 0.2) / 2, z);
      g.add(post);
    }
  }
  // Railing along the front and both sides.
  const railH = 0.8, rail = (len, x, z, rotY) => {
    const r = new THREE.Group();
    const bar = rbox(len, 0.07, 0.07, st.trim, 0.02);
    bar.position.y = railH;
    r.add(bar);
    const n = Math.max(2, Math.round(len / 0.22));
    for (let i = 0; i <= n; i++) {
      const p = rbox(0.045, railH, 0.045, st.trim, 0.01);
      p.position.set(-len / 2 + (len * i) / n, railH / 2, 0);
      r.add(p);
    }
    r.position.set(x, top, z);
    r.rotation.y = rotY;
    g.add(r);
  };
  const fz = front - 0.05;
  // Front railing, open at the stairs and over the garages.
  if (stairX !== null) gaps.push([stairX - 0.7, stairX + 0.7]);
  gaps.sort((a, b) => a[0] - b[0]);
  for (const [a, b] of openRuns(-w / 2 + 0.05, w / 2 - 0.05)) if (b - a > 0.3) rail(b - a, (a + b) / 2, fz, 0);
  // Short railings along the edges of each garage cut-out.
  for (const x of garageXs) {
    for (const side of [-1, 1]) {
      const ex = x + side * (MODULE / 2 - 0.04);
      if (ex > -w / 2 + 0.1 && ex < w / 2 - 0.1) rail(front - back2 - 0.05, ex, (back2 + front) / 2, Math.PI / 2);
    }
  }
  if (sides.left) rail(d - 0.1, -w / 2 + 0.05, zc, Math.PI / 2);
  if (sides.right) rail(d - 0.1, w / 2 - 0.05, zc, Math.PI / 2);
  return g;
}

const STEP_RISE = 0.21, STEP_RUN = 0.3;
export const stairsLength = height => Math.ceil(height / STEP_RISE) * STEP_RUN;

// Wooden stairs from the deck (at `height`) down to the garden, going +z.
function buildStairs(height, st) {
  const g = new THREE.Group();
  const n = Math.ceil(height / STEP_RISE), rise = height / n;
  for (let i = 0; i < n; i++) {
    const y = height - rise * (i + 1);
    const step = rbox(1.2, 0.08, STEP_RUN + 0.04, DECK_WOOD, 0.02);
    step.position.set(0, y + rise - 0.04, STEP_RUN * (i + 0.5));
    g.add(step);
  }
  const len = n * STEP_RUN, slope = Math.atan2(height, len), rail = Math.hypot(height, len);
  for (const side of [-1, 1]) {
    const stringer = rbox(0.08, 0.2, rail, '#b9946a', 0.02);
    stringer.rotation.x = slope;
    stringer.position.set(side * 0.62, height / 2, len / 2);
    const hand = rbox(0.07, 0.07, rail, st.trim, 0.02);
    hand.rotation.x = slope;
    hand.position.set(side * 0.62, height / 2 + 0.8, len / 2);
    const post = rbox(0.07, 0.8, 0.07, st.trim, 0.02);
    post.position.set(side * 0.62, 0.4, len - 0.05);
    g.add(stringer, hand, post);
  }
  return g;
}

// Red and white lifebuoy, facing +z.
function buildLifebuoy() {
  const g = new THREE.Group();
  const geo = new THREE.TorusGeometry(0.26, 0.085, 10, 24);
  const ring = shade(new THREE.Mesh(geo, mat('#ffffff')));
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const band = shade(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.09, 10, 5, Math.PI / 4), mat('#ef5f5f')));
    band.rotation.z = i * Math.PI / 2 + Math.PI / 8;
    g.add(band);
  }
  return g;
}

// --- Roof terrace ---
export const TERRACE_DECK = 0.16;
export const COVERED_DECK = 0.24;

// A wooden deck on top of a column, with a railing on the open sides: white
// posts, or glass panels for the modern style.
function buildRoofTerrace(st, openLeft, openRight) {
  const g = new THREE.Group();
  const w = MODULE, d = DEPTH;
  const rim = rbox(w + 0.12, 0.12, d + 0.12, st.trim, 0.04);
  rim.position.y = 0.06;
  const deck = rbox(w - 0.04, TERRACE_DECK, d - 0.04, plankMat(), 0.03);
  deck.position.y = TERRACE_DECK / 2 + 0.02;
  g.add(rim, deck);
  const modern = st.window === 'modern';
  const railColor = modern ? DARK_FRAME : st.trim;
  const railH = 0.85, y0 = TERRACE_DECK;
  const edge = (len, x, z, rotY) => {
    const r = new THREE.Group();
    const bar = rbox(len, 0.07, 0.07, railColor, 0.02);
    bar.position.y = railH;
    r.add(bar);
    if (modern) {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(len - 0.06, railH - 0.08, 0.03),
        mat('#bfe8f5', { transparent: true, opacity: 0.45, roughness: 0.1 }));
      glass.position.y = railH / 2;
      r.add(glass);
    } else {
      const n = Math.max(2, Math.round(len / 0.24));
      for (let i = 0; i <= n; i++) {
        const p = rbox(0.045, railH, 0.045, railColor, 0.01);
        p.position.set(-len / 2 + (len * i) / n, railH / 2, 0);
        r.add(p);
      }
    }
    r.position.set(x, y0, z);
    r.rotation.y = rotY;
    g.add(r);
  };
  edge(w, 0, d / 2 - 0.04, 0);
  edge(w, 0, -d / 2 + 0.04, 0);
  if (openLeft) edge(d - 0.08, -w / 2 + 0.04, 0, Math.PI / 2);
  if (openRight) edge(d - 0.08, w / 2 - 0.04, 0, Math.PI / 2);
  return g;
}
