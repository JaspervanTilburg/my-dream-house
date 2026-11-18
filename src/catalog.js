import * as THREE from 'three';
import { mat, rbox, rng, shade, sphere } from './helpers.js';
import { buildParasol, buildSet, prop, props } from './props.js';

// ---------------------------------------------------------------------------
// Everything she can put in the garden. An item is either a single model from
// the Kenney packs (`prop`), a ready-made set, or something built here in code.
// `half` is the ground footprint as half sizes (x, z) when not turned; for
// models it comes from the model itself. `wall: true` items turn their back to
// a house wall and snap against it while dragged.
// ---------------------------------------------------------------------------
export const CATEGORIES = [
  ['sets', 'Sets'],
  ['furniture', 'Furniture'],
  ['plants', 'Plants'],
  ['garden', 'Garden'],
];

export const MAX_ITEMS = 40;

// Small pieces built in code, for things the packs don't have.
function buildSwing() {
  const g = new THREE.Group();
  const wood = '#b98563';
  [-0.75, 0.75].forEach(x => [-0.35, 0.35].forEach(z => {
    const leg = rbox(0.09, 1.9, 0.09, wood, 0.03);
    leg.position.set(x, 0.92, z * 0.55);
    leg.rotation.x = z > 0 ? -0.33 : 0.33;
    g.add(leg);
  }));
  const beam = rbox(1.75, 0.11, 0.11, wood, 0.03);
  beam.position.y = 1.82;
  g.add(beam);
  [-0.25, 0.25].forEach(x => {
    const rope = rbox(0.025, 1.25, 0.025, '#fff3df', 0.01);
    rope.position.set(x, 1.15, 0);
    g.add(rope);
  });
  const seat = rbox(0.62, 0.06, 0.26, '#f7a8b8', 0.03);
  seat.position.y = 0.52;
  g.add(seat);
  return g;
}

function buildBirdbath() {
  const g = new THREE.Group();
  const stone = '#d8d0c3';
  const foot = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 20), mat(stone)));
  foot.position.y = 0.06;
  const stem = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.62, 16), mat(stone)));
  stem.position.y = 0.43;
  const bowl = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.16, 24), mat(stone)));
  bowl.position.y = 0.8;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.02, 24),
    mat('#9fdcf0', { roughness: 0.15, emissive: '#2d7f99', emissiveIntensity: 0.15 }));
  water.position.y = 0.875;
  const bird = sphere(0.08, '#ffd36e', 12);
  bird.position.set(0.3, 0.95, 0.05);
  const beak = shade(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 6), mat('#f5a25d')));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.39, 0.96, 0.05);
  g.add(foot, stem, bowl, water, bird, beak);
  return g;
}

function buildBarbecue() {
  const g = new THREE.Group();
  [-1, 1].forEach(s => [-1, 1].forEach(t => {
    const leg = rbox(0.05, 0.75, 0.05, '#5d6470', 0.02);
    leg.position.set(s * 0.25, 0.37, t * 0.18);
    g.add(leg);
  }));
  const bowl = shade(new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#ef7a7a')));
  bowl.scale.set(1, 0.6, 0.8);
  bowl.position.y = 0.92;
  const lid = shade(new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ef7a7a')));
  lid.scale.set(1, 0.55, 0.8);
  lid.rotation.x = -0.9;
  lid.position.set(0, 0.95, -0.28);
  const grill = rbox(0.74, 0.03, 0.58, '#5d6470', 0.01);
  grill.position.y = 0.93;
  const knob = sphere(0.05, '#3d2f4f', 8);
  knob.position.set(0, 0.92, 0.33);
  g.add(bowl, lid, grill, knob);
  return g;
}

// Stone ring from the pack with a little glowing fire on top.
function buildCampfire() {
  const ring = prop('fireRing');
  if (!ring) return null;
  const g = new THREE.Group();
  g.add(ring);
  [0, 1, 2].forEach(i => {
    const log = rbox(0.5, 0.09, 0.09, '#9a6a45', 0.04);
    log.position.y = 0.1;
    log.rotation.y = (i * Math.PI) / 3;
    g.add(log);
  });
  [[0.16, 0.42, '#ff9f43'], [0.1, 0.3, '#ffd36e']].forEach(([r, h, c]) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), mat(c, { emissive: c, emissiveIntensity: 0.8 }));
    flame.position.y = 0.14 + h / 2;
    g.add(flame);
  });
  return g;
}

// A little patch of mixed flowers from the pack.
function buildFlowerPatch() {
  const kinds = ['flowerRed', 'flowerPurple', 'flowerYellow'];
  if (kinds.some(k => !props[k])) return null;
  const g = new THREE.Group();
  const rand = rng(31);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4, r = i ? 0.18 + rand() * 0.22 : 0;
    const f = prop(kinds[i % 3], rand() * Math.PI * 2);
    f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(f);
  }
  return g;
}

// Wooden planter box with flowers growing in it.
function buildPlanter() {
  const box = prop('planterBox');
  if (!box || !props.flowerRed) return null;
  const g = new THREE.Group();
  g.add(box);
  ['flowerRed', 'flowerYellow', 'flowerPurple', 'flowerRed'].forEach((k, i) => {
    const f = prop(k, i);
    if (!f) return;
    f.position.set(-0.33 + i * 0.22, 0.2, (i % 2 ? 0.08 : -0.08));
    g.add(f);
  });
  return g;
}


export const CATALOG = {
  // Ready-made sets (these used to be the Picnic / Bench / Veggies switches).
  picnic: { label: 'Picnic set', cat: 'sets', half: [0.95, 0.9], build: () => buildSet('picnic') },
  bench: { label: 'Bench & teddy', cat: 'sets', half: [1.0, 0.26], wall: true, build: () => buildSet('bench') },
  veggies: { label: 'Veggie beds', cat: 'sets', half: [1.15, 0.58], build: () => buildSet('veggies') },
  mailbox: { label: 'Mailbox', cat: 'sets', half: [0.25, 0.4], unique: true, build: () => buildSet('mailbox') },

  benchPlain: { label: 'Bench', cat: 'furniture', prop: 'benchPlain', wall: true },
  cushionBench: { label: 'Cushion bench', cat: 'furniture', prop: 'bench', wall: true },
  lounger: { label: 'Sun lounger', cat: 'furniture', prop: 'lounger' },
  armchair: { label: 'Armchair', cat: 'furniture', prop: 'armchair', wall: true },
  chair: { label: 'Chair', cat: 'furniture', prop: 'chair' },
  roundTable: { label: 'Round table', cat: 'furniture', prop: 'table' },
  longTable: { label: 'Long table', cat: 'furniture', prop: 'tableLong' },
  sideTable: { label: 'Side table', cat: 'furniture', prop: 'sideTable', wall: true },
  parasol: { label: 'Parasol', cat: 'furniture', half: [0.35, 0.35], build: buildParasol },
  barbecue: { label: 'Barbecue', cat: 'furniture', half: [0.42, 0.36], build: buildBarbecue },
  swing: { label: 'Swing', cat: 'furniture', half: [0.92, 0.45], build: buildSwing },
  rug: { label: 'Outdoor rug', cat: 'furniture', prop: 'rug', flat: true },
  lampRound: { label: 'Round lamp', cat: 'furniture', prop: 'lamp' },
  lampSquare: { label: 'Square lamp', cat: 'furniture', prop: 'lampSquare' },

  treeRound: { label: 'Round tree', cat: 'plants', prop: 'treeRound' },
  treeOak: { label: 'Oak', cat: 'plants', prop: 'treeOak' },
  treeFat: { label: 'Chubby tree', cat: 'plants', prop: 'treeFat' },
  treeCone: { label: 'Cone tree', cat: 'plants', prop: 'treeCone' },
  treePine: { label: 'Pine', cat: 'plants', prop: 'treePine' },
  treeSmall: { label: 'Young tree', cat: 'plants', prop: 'treeSmall' },
  palmTall: { label: 'Palm tree', cat: 'plants', prop: 'palmTall' },
  palmBend: { label: 'Bendy palm', cat: 'plants', prop: 'palmBend' },
  bushBig: { label: 'Big bush', cat: 'plants', prop: 'bushBig' },
  bushSmall: { label: 'Small bush', cat: 'plants', prop: 'bushSmall' },
  flowers: { label: 'Flower patch', cat: 'plants', half: [0.42, 0.42], build: buildFlowerPatch },
  planter: { label: 'Planter', cat: 'plants', half: [0.5, 0.45], build: buildPlanter },
  pottedPlant: { label: 'Potted plant', cat: 'plants', prop: 'pot' },
  plantSmallA: { label: 'Little plant', cat: 'plants', prop: 'plantSmallA' },
  plantSmallB: { label: 'Leafy plant', cat: 'plants', prop: 'plantSmallB' },
  plantSmallC: { label: 'Sprout plant', cat: 'plants', prop: 'plantSmallC' },
  tallGrass: { label: 'Tall grass', cat: 'plants', prop: 'tallGrass' },
  mushrooms: { label: 'Mushrooms', cat: 'plants', prop: 'mushrooms' },

  birdbath: { label: 'Birdbath', cat: 'garden', half: [0.42, 0.42], build: buildBirdbath },
  campfire: { label: 'Campfire', cat: 'garden', half: [0.5, 0.5], build: buildCampfire },
  tent: { label: 'Tent', cat: 'garden', prop: 'tent' },
  rockBig: { label: 'Big rock', cat: 'garden', prop: 'rockBig' },
  rockSmall: { label: 'Small rock', cat: 'garden', prop: 'rockSmall' },
  stump: { label: 'Tree stump', cat: 'garden', prop: 'stump' },
  logs: { label: 'Log pile', cat: 'garden', prop: 'logs' },
  column: { label: 'Column', cat: 'garden', prop: 'column' },
  statueHead: { label: 'Stone head', cat: 'garden', prop: 'statueHead' },
  statueRing: { label: 'Stone ring', cat: 'garden', prop: 'statueRing' },
  teddy: { label: 'Teddy bear', cat: 'garden', prop: 'teddy' },
};

// A fresh 3D object for an item type, or null while its model is still loading.
export function buildItem(type) {
  const spec = CATALOG[type];
  if (!spec) return null;
  return spec.prop ? prop(spec.prop) : spec.build();
}

export function halfOf(type) {
  const spec = CATALOG[type];
  return spec?.half ?? props[spec?.prop]?.userData.half ?? [0.4, 0.4];
}

// Footprint half sizes for an item turned by `rot` and sized by `scale`.
export const MIN_SCALE = 0.5, MAX_SCALE = 2;
export function footprint(type, rot, scale = 1) {
  const [hxs, hzs] = halfOf(type).map(v => v * scale);
  const quarterTurns = Math.round(rot / (Math.PI / 2));
  return quarterTurns % 2 ? [hzs, hxs] : [hxs, hzs];
}

// What a new garden starts with. `u: null` means "use its default spot".
export const DEFAULT_ITEMS = [
  { id: 1, type: 'mailbox', u: null, v: null, rot: 0 },
  { id: 2, type: 'picnic', u: null, v: null, rot: 0 },
  { id: 3, type: 'bench', u: null, v: null, rot: 0 },
];

export const nextItemId = items => items.reduce((m, it) => Math.max(m, it.id), 0) + 1;
