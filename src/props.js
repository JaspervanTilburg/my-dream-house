import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HOME } from './config.js';
import { canvasTexture, mat, rbox, shade, sharedGeometries, sphere } from './helpers.js';
import { houseMats } from './house.js';

// ---------------------------------------------------------------------------
// Garden props: free CC0 models from Kenney (Nature Kit, Furniture Kit) in
// assets/props. Each is scaled to a target size, set on the ground, and
// repainted with our palette so it matches the hand-made parts.
// ---------------------------------------------------------------------------
export const PROP_SPECS = {
  bench: { file: 'benchCushion', height: 1.0 }, // backrest height; seat is at about 0.45
  table: { file: 'tableRound', height: 0.8 },
  chair: { file: 'chairRounded', height: 0.95 },
  lamp: { file: 'lampRoundFloor', height: 1.9 },
  teddy: { file: 'bear', height: 0.36 },
  doormat: { file: 'rugDoormat', width: 0.95 },
  pot: { file: 'pottedPlant', height: 0.8 },
  fence: { file: 'fence_simple', width: 1.7, keepY: true },
  gate: { file: 'fence_gate', width: 1.7, keepY: true },
  dirt: { file: 'crops_dirtDoubleRow', width: 1.1 },
  pumpkin: { file: 'crop_pumpkin', height: 0.42 },
  carrot: { file: 'crop_carrot', height: 0.5 },
  turnip: { file: 'crop_turnip', height: 0.5 },
  greens: { file: 'crops_leafsStageB', height: 0.5 },
  stump: { file: 'stump_roundDetailed', height: 0.32 },
  logs: { file: 'log_stack', height: 0.5 },
  mushrooms: { file: 'mushroom_redGroup', height: 0.32 },
  // Extra models for the garden menu.
  benchPlain: { file: 'bench', height: 1.0 },
  lounger: { file: 'loungeChairRelax', height: 0.95 },
  armchair: { file: 'loungeChair', height: 0.8 },
  tableLong: { file: 'table', height: 0.8 },
  sideTable: { file: 'sideTable', height: 0.55 },
  lampSquare: { file: 'lampSquareFloor', height: 1.9 },
  rug: { file: 'rugRound', width: 1.7 },
  plantSmallA: { file: 'plantSmall1', height: 0.5 },
  plantSmallB: { file: 'plantSmall2', height: 0.5 },
  plantSmallC: { file: 'plantSmall3', height: 0.5 },
  planterBox: { file: 'pot_large', width: 1.0 },
  treeRound: { file: 'tree_default', height: 2.6 },
  treeOak: { file: 'tree_oak', height: 2.3 },
  treeFat: { file: 'tree_fat', height: 1.9 },
  treeCone: { file: 'tree_cone', height: 2.5 },
  treePine: { file: 'tree_pineRoundB', height: 2.4 },
  treeSmall: { file: 'tree_small', height: 1.8 },
  bushBig: { file: 'plant_bushDetailed', height: 0.65 },
  bushSmall: { file: 'plant_bush', height: 0.45 },
  flowerRed: { file: 'flower_redA', height: 0.42 },
  flowerPurple: { file: 'flower_purpleA', height: 0.38 },
  flowerYellow: { file: 'flower_yellowA', height: 0.34 },
  tallGrass: { file: 'grass_large', height: 0.4 },
  rockBig: { file: 'rock_largeA', width: 1.3 },
  rockSmall: { file: 'rock_smallC', width: 0.6 },
  fireRing: { file: 'campfire_stones', width: 0.95 },
  tent: { file: 'tent_detailedOpen', width: 1.9 },
  column: { file: 'statue_column', height: 1.4 },
  statueHead: { file: 'statue_head', height: 1.3 },
  statueRing: { file: 'statue_ring', height: 1.2 },
  palmTall: { file: 'tree_palmTall', height: 3.0 },
  palmBend: { file: 'tree_palmBend', height: 2.6 },
  palmShort: { file: 'tree_palmDetailedShort', height: 2.0 },
};

// Kenney material name -> our palette.
export const PROP_COLORS = {
  wood: '#e8b98f', woodDark: '#b98563', woodBark: '#b07a52', woodInner: '#f3dcc2',
  woodBarkDark: '#9a6a45', woodBirch: '#fff3df', grass: '#6cbf47', plant: '#74c94c',
  leafsFall: '#f5a25d', dirt: '#c98d63', dirtDark: '#a8714d', carpet: '#f7a8b8',
  fur: '#c99a6e', metal: '#d9dde3', metalDark: '#5d6470', colorRed: '#ef7a7a',
  _defaultMat: '#fff8f0', stone: '#d4ccc2', stoneDark: '#b8ada0', carpetDarker: '#e58ca0',
  leafsGreen: '#74c94c', leafsDark: '#4f9e5e', colorPurple: '#c9b8ff', colorYellow: '#ffd36e',
};

export const props = {};          // name -> normalized template group
export const propsReady = (async () => {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(PROP_SPECS).map(async ([name, spec]) => {
    try {
      // Retry a couple of times: a busy or flaky connection can drop a request.
      let gltf;
      for (let attempt = 1; !gltf; attempt++) {
        try {
          gltf = await loader.loadAsync(`assets/props/${spec.file}.glb`);
        } catch (err) {
          if (attempt >= 3) throw err;
          await new Promise(r => setTimeout(r, 400 * attempt));
        }
      }
      const model = gltf.scene;
      model.traverse(o => {
        if (!o.isMesh) return;
        const src = o.material;
        const color = PROP_COLORS[src.name] ?? '#' + src.color.getHexString();
        o.material = src.name === 'lamp'
          ? mat('#fff1b8', { emissive: '#ffd36e', emissiveIntensity: 0.6 })
          : mat(color);
        o.castShadow = o.receiveShadow = true;
        sharedGeometries.add(o.geometry); // clones share it; never dispose
      });
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const scale = spec.width ? spec.width / size.x : spec.height / size.y;
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, spec.keepY ? 0.05 : -box.min.y, -center.z);
      const template = new THREE.Group();
      template.add(model);
      template.scale.setScalar(scale);
      // Ground footprint as half sizes (x, z), for collisions in the garden.
      const scaled = size.multiplyScalar(scale);
      template.userData.half = [Math.max(0.15, scaled.x / 2), Math.max(0.15, scaled.z / 2)];
      props[name] = template;
    } catch (err) {
      console.warn(`Garden prop "${name}" did not load`, err);
    }
  }));
})();

// A fresh copy of a prop (geometry and materials are shared), or null while loading.
export function prop(name, rotY = 0) {
  const t = props[name];
  if (!t) return null;
  const outer = new THREE.Group();
  const inner = t.clone(true);
  inner.rotation.y = rotY;
  outer.add(inner);
  return outer;
}

// Striped parasol, made here because the packs have none.
export const stripeTexture = canvasTexture(256, 8, (g, w, h) => {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : '#c9b8ff';
    g.fillRect((i * w) / 8, 0, w / 8, h);
  }
});
// Text painted on a canvas. Redrawn once the web fonts have loaded, because
// the first scene can be built before they arrive.
export function textTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const paint = () => { draw(c.getContext('2d'), w, h); tex.needsUpdate = true; };
  paint();
  document.fonts?.ready.then(paint);
  return tex;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

export const mailboxTexture = textTexture(200, 110, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#fff8f0';
  roundRect(g, 0, 0, w, h, 26);
  g.textAlign = 'center';
  g.fillStyle = '#3d2f4f';
  g.font = '800 72px "Baloo 2", "Trebuchet MS", sans-serif';
  g.fillText(HOME.initials, w / 2, 82);
});

export const plaqueTexture = textTexture(160, 120, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#fff8f0';
  roundRect(g, 0, 0, w, h, 22);
  g.textAlign = 'center';
  g.fillStyle = '#3d2f4f';
  g.font = '800 84px "Baloo 2", "Trebuchet MS", sans-serif';
  g.fillText(HOME.number, w / 2, 92);
});

// Mailbox on a post, painted like the roof, with the initials on its side.
// Its slot faces the street (+z); the side with the label faces +x.
export function buildMailbox() {
  const g = new THREE.Group();
  const post = rbox(0.12, 1.0, 0.12, '#b98563', 0.03);
  post.position.y = 0.5;
  const w = 0.42, len = 0.7, bodyH = 0.24;
  const body = rbox(w, bodyH, len, houseMats.cap, 0.04);
  body.position.y = 1.0 + bodyH / 2;
  // Half cylinder: lay its axis along z, then turn the open half downward.
  const domeGeo = new THREE.CylinderGeometry(w / 2, w / 2, len, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  const dome = shade(new THREE.Mesh(domeGeo, houseMats.cap));
  dome.position.y = 1.0 + bodyH;
  const door = rbox(w - 0.06, bodyH + 0.12, 0.04, '#fff8f0', 0.03);
  door.position.set(0, 1.0 + bodyH / 2 + 0.04, len / 2 + 0.01);
  const flagPole = rbox(0.04, 0.34, 0.04, '#5d6470', 0.01);
  flagPole.position.set(-w / 2 - 0.03, 1.32, -0.12);
  const flag = rbox(0.03, 0.12, 0.18, '#ef7a7a', 0.02);
  flag.position.set(-w / 2 - 0.03, 1.43, -0.04);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.23), mat('#ffffff', { map: mailboxTexture, transparent: true }));
  label.rotation.y = Math.PI / 2;
  label.position.set(w / 2 + 0.006, 1.0 + bodyH * 0.62, 0);
  g.add(post, body, dome, door, flagPole, flag, label);
  return g;
}

// House number plaque, hung beside the front door.
export function buildPlaque() {
  const g = new THREE.Group();
  g.add(rbox(0.42, 0.33, 0.05, '#b98563', 0.03));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.29), mat('#ffffff', { map: plaqueTexture, transparent: true }));
  face.position.z = 0.03;
  g.add(face);
  return g;
}

export function buildParasol() {
  const g = new THREE.Group();
  const pole = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8), mat('#fff8f0')));
  pole.position.y = 1.0;
  const canopy = shade(new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.42, 16, 1, true),
    mat('#ffffff', { map: stripeTexture, side: THREE.DoubleSide })));
  canopy.position.y = 2.0;
  const knob = sphere(0.07, '#fff8f0', 10);
  knob.position.y = 2.24;
  g.add(pole, canopy, knob);
  return g;
}

// The whole set as one group, or null while one of its models is still loading.
export function buildSet(key) {
  const g = new THREE.Group();
  const put = (obj, x, y, z) => { if (!obj) return false; obj.position.set(x, y, z); g.add(obj); return true; };
  if (key === 'mailbox') {
    put(buildMailbox(), 0, 0, 0);
    return g;
  }
  if (key === 'picnic') {
    const ok = put(prop('table'), 0, 0, 0)
      && put(prop('chair', Math.PI / 2), -0.85, 0, 0)
      && put(prop('chair', -Math.PI / 2), 0.85, 0, 0);
    if (!ok) return null;
    put(buildParasol(), 0, 0, 0);
    return g;
  }
  if (key === 'bench') {
    // Laid out facing +z; the default turn makes it face out over the side lawn.
    const ok = put(prop('bench'), 0, 0, 0)
      && put(prop('teddy'), -0.2, 0.46, 0.05)
      && put(prop('lamp'), 0.85, 0, -0.1)
      && put(prop('pot'), -0.8, 0, -0.05);
    return ok ? g : null;
  }
  if (key === 'veggies') {
    const crops = ['pumpkin', 'carrot', 'greens', 'turnip', 'pumpkin', 'greens'];
    let ok = true;
    [-0.56, 0.56].forEach((dx, b) => {
      ok = put(prop('dirt'), dx, 0, 0) && ok;
      [-0.24, 0.24].forEach((dz, row) => [-0.3, 0.05, 0.38].forEach((cx, i) => {
        const n = b * 6 + row * 3 + i;
        ok = put(prop(crops[n % crops.length], n * 1.7), dx + cx * 0.9, 0.04, dz) && ok;
      }));
    });
    return ok ? g : null;
  }
  return null;
}

export const freeRect = (rects, x, z, rx, rz) =>
  !rects.some(q => x + rx > q.x0 && x - rx < q.x1 && z + rz > q.z0 && z - rz < q.z1);
export const insideIsland = (x, z, rx, rz, hx, hz, edge = 0.15) =>
  Math.abs(x) + rx < hx - edge && Math.abs(z) + rz < hz - edge;

// Search outward in rings for the closest spot where `fits` says yes.
export function nearestSpot(x, z, fits) {
  for (let r = 0.15; r <= 18; r += 0.15) { // fine near the start, far enough to cross the widest island
    const steps = Math.max(8, Math.round(r * 10));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (fits(px, pz)) return [px, pz];
    }
  }
  return null;
}

// Where things are, for checking drops while dragging. Filled in by update().
export let dragZones = { base: [], sets: {}, hx: 5, hz: 5, edge: 0.15 };
export function setDragZones(zones) { dragZones = zones; }
