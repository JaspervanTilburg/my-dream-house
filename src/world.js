import * as THREE from 'three';
import gsap from 'gsap';
import { P, STYLES, reducedMotion, state } from './config.js';
import { sfx } from './fx/audio.js';
import { buildBush, buildFlower, buildPine, buildRoundTree, centerGeo, leafGeo, petalGeo } from './greenery.js';
import { mat, rbox, rng, shade, sharedGeometries } from './helpers.js';
import { DEPTH, MODULE, capTint, houseMats, houseParts } from './house.js';
import { ISLAND_BOTTOM, ISLAND_MARGIN, ISLAND_MIN, buildIsland, grassColor, grassMat } from './island.js';
import { buildPlaque, freeRect, insideIsland, nearestSpot, prop, setDragZones } from './props.js';
import { CATALOG, buildItem, footprint } from './catalog.js';
import { describe } from './layout.js';
import { wetAt } from './waterdata.js';
import { fitCamera, scene, setFitBoxes } from './scene.js';
import { saveDesign } from './storage.js';

// ---------------------------------------------------------------------------
// Reconciler: compares the freshly built parts with the parts on screen.
//   new id      -> pop in (springy scale-up, staggered)
//   missing id  -> pop out, then dispose
//   same id     -> same shape: slide to the new spot; new shape: swap and morph
// This is why no combination of settings needs its own animation.
// ---------------------------------------------------------------------------
export const world = new THREE.Group();
scene.add(world);
export const live = new Map(); // id -> { id, obj, sig }
[petalGeo, centerGeo, leafGeo].forEach(geo => sharedGeometries.add(geo));

gsap.globalTimeline.timeScale(reducedMotion ? 20 : 1);

export function dispose(obj) {
  obj.traverse(o => {
    if (o.isMesh && !sharedGeometries.has(o.geometry)) o.geometry.dispose();
  });
}

export function killTweens(obj) {
  gsap.killTweensOf([obj.position, obj.scale]);
}

export function popIn(obj, delay) {
  const s = obj.scale.clone();
  const y = obj.position.y;
  obj.scale.setScalar(0.001);
  obj.position.y = y + 0.8;
  gsap.to(obj.scale, { x: s.x, y: s.y, z: s.z, duration: 0.65, delay, ease: 'back.out(2.2)' });
  gsap.to(obj.position, { y, duration: 0.55, delay, ease: 'bounce.out' });
}

export function popOut(obj) {
  killTweens(obj);
  gsap.to(obj.scale, {
    x: 0.001, y: 0.001, z: 0.001, duration: 0.3, ease: 'back.in(2)',
    onComplete: () => { world.remove(obj); dispose(obj); },
  });
}

// Move an existing part to its new place and size. Untouched values keep
// whatever tween is running (for example a pop-in that hasn't finished).
export function settle(obj, pos, scale, rot) {
  if (rot && Math.abs(obj.rotation.y - rot.y) > 1e-6) {
    gsap.killTweensOf(obj.rotation);
    gsap.to(obj.rotation, { y: rot.y, duration: 0.5, ease: 'back.out(1.8)' });
  }
  if (obj.position.distanceToSquared(pos) > 1e-8) {
    gsap.killTweensOf(obj.position);
    gsap.to(obj.position, { x: pos.x, y: pos.y, z: pos.z, duration: 0.6, ease: 'power3.out' });
  }
  if (obj.scale.distanceToSquared(scale) > 1e-8) {
    gsap.killTweensOf(obj.scale);
    gsap.to(obj.scale, { x: scale.x, y: scale.y, z: scale.z, duration: 0.6, ease: 'back.out(1.6)' });
  }
}

export const sizeOf = obj => new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());

// Swap an old part for a new one, starting at the old part's size and place.
export function morph(oldObj, newObj) {
  killTweens(oldObj);
  const from = sizeOf(oldObj), to = sizeOf(newObj);
  const ratio = (a, b) => (b > 0.001 ? a / b : 1);
  const target = newObj.position.clone();
  const targetScale = newObj.scale.clone();
  newObj.position.copy(oldObj.position);
  newObj.scale.multiply(new THREE.Vector3(ratio(from.x, to.x), ratio(from.y, to.y), ratio(from.z, to.z)));
  world.remove(oldObj);
  dispose(oldObj);
  world.add(newObj);
  gsap.to(newObj.scale, { x: targetScale.x, y: targetScale.y, z: targetScale.z, duration: 0.7, ease: 'elastic.out(1, 0.55)' });
  gsap.to(newObj.position, { x: target.x, y: target.y, z: target.z, duration: 0.6, ease: 'power3.out' });
}

export function reconcile(parts) {
  const ids = new Set(parts.map(p => p.id));
  let removed = 0;
  for (const [id, cur] of live) {
    if (!ids.has(id)) { popOut(cur.obj); live.delete(id); removed++; }
  }
  if (removed) sfx.bloop();

  let added = 0;
  for (const part of parts) {
    const cur = live.get(part.id);
    if (!cur) {
      world.add(part.obj);
      popIn(part.obj, Math.min(1.4, added++ * 0.035));
      live.set(part.id, part);
    } else if (cur.sig === part.sig) {
      settle(cur.obj, part.obj.position, part.obj.scale, part.obj.rotation);
      // The old object stays on screen; take over the new one's info (like which roof it is on).
      cur.obj.userData = { ...part.obj.userData };
      dispose(part.obj);
    } else {
      morph(cur.obj, part.obj);
      live.set(part.id, part);
    }
  }
  for (let i = 0; i < Math.min(added, 6); i++) sfx.pop(i);
}

// Lawn flower candidates: fixed spots in island-relative coordinates, so a flower
// keeps its id and stretches along when the island grows.
export const flowerSpots = (() => {
  const rand = rng(state.seed);
  return Array.from({ length: 60 }, () => ({
    u: rand() - 0.5, v: rand() - 0.5,
    color: P.petals[Math.floor(rand() * P.petals.length)],
    scale: 0.9 + rand() * 0.4,
  }));
})();

// Colors: tween the shared house materials, then give the house a happy hop.
export const shownColors = { wallColor: state.wallColor, roofColor: state.roofColor };
export let houseIds = [];
// The latest house layout info (positions of columns and floors), for the handles.
let lastHouse = null;
export const getHouse = () => lastHouse;

export function tweenColor(color, target) {
  const c = new THREE.Color(target);
  gsap.to(color, { r: c.r, g: c.g, b: c.b, duration: 0.5, ease: 'power2.out' });
}

export function applyColors() {
  let changed = false;
  if (shownColors.wallColor !== state.wallColor) {
    tweenColor(houseMats.wall.color, state.wallColor);
    changed = true;
  }
  if (shownColors.roofColor !== state.roofColor) {
    tweenColor(houseMats.roof.color, state.roofColor);
    tweenColor(houseMats.cap.color, capTint(state.roofColor));
    changed = true;
  }
  Object.assign(shownColors, { wallColor: state.wallColor, roofColor: state.roofColor });
  if (changed) hop();
}

// A small bottom-to-top wave through the house parts.
export function hop() {
  houseIds.forEach((id, i) => {
    const obj = live.get(id)?.obj;
    // Skip parts that are about to slide: a hop would land them back at the old spot.
    if (!obj || gsap.getTweensOf(obj.position).length) return;
    const y = obj.position.y;
    gsap.timeline({ delay: i * 0.012 })
      .to(obj.position, { y: y + 0.22, duration: 0.14, ease: 'power2.out' })
      .to(obj.position, { y, duration: 0.45, ease: 'bounce.out' });
  });
}

// Build the whole design as keyed parts, then hand it to the reconciler.
export function update(animateCamera = true) {
  const parts = [];
  const k = state.size;
  const width = describe(state.cells).width * MODULE * k;
  const depth = DEPTH * k;
  const sizeX = Math.max(ISLAND_MIN, width + ISLAND_MARGIN);
  const sizeZ = Math.max(ISLAND_MIN, depth + 7);
  const hx = sizeX / 2, hz = sizeZ / 2;
  parts.push({ id: 'island', obj: buildIsland(sizeX, sizeZ), sig: `${sizeX.toFixed(2)}x${sizeZ.toFixed(2)}` });

  // House sits toward the back so the front garden and path show.
  const origin = new THREE.Vector3(0, 0, -hz + 1.7 + depth / 2);
  const house = houseParts(state, origin);
  parts.push(...house.parts);
  houseIds = house.parts.map(p => p.id);
  house.parts.forEach(p => { p.obj.userData.house = true; }); // for tapping the house
  lastHouse = house;

  // Stepping-stone path from the porch to the edge of the island.
  const pathX = house.doorX;
  const pathStart = house.frontZ + 0.3;
  for (let z = pathStart, i = 0; z < hz - 0.4; z += 0.9, i++) {
    const tile = rbox(1.05, 0.1, 0.72, P.path, 0.05);
    tile.position.set(pathX + (i % 2 ? 0.06 : -0.06), 0.03, z);
    parts.push({ id: `path-${i}`, obj: tile });
  }

  // Driveway from the garage door to the edge.
  const rects = [
    { x0: house.x0 - 0.4, x1: house.x1 + 0.5, z0: house.z0 - 0.4, z1: house.frontZ + 0.2 },
    { x0: pathX - 0.75, x1: pathX + 0.75, z0: pathStart - 0.6, z1: hz + 1 },
  ];
  house.garages.forEach((g, i) => {
    const len = hz - 0.25 - g.front;
    const drive = rbox(g.w * 0.9, 0.08, len, '#ece0d0', 0.04);
    drive.position.set(g.x, 0.03, g.front + len / 2);
    parts.push({ id: `driveway-${i}`, obj: drive, sig: `${len.toFixed(2)}|${g.w.toFixed(2)}` });
    rects.push({ x0: g.x - g.w / 2, x1: g.x + g.w / 2, z0: g.front - 0.2, z1: hz + 1 });
  });

  // Decorations stay out of the house, garage, path, driveway and garden extras.
  const isFree = (x, z, r) => !wetAt(x, z, r) && !rects.some(q => x > q.x0 - r && x < q.x1 + r && z > q.z0 - r && z < q.z1 + r);
  const addProp = (id, obj, x, y, z, sig = '') => {
    if (!obj) return;
    obj.position.set(x, y, z);
    parts.push({ id, obj, sig });
  };

  // House number beside the door (further out for the wide barn door).
  const plaque = buildPlaque();
  plaque.scale.setScalar(k);
  addProp('plaque', plaque, pathX + (state.style === 'barn' ? 1.0 : 0.82) * k,
    house.base + 1.45 * k, origin.z + (DEPTH / 2 + 0.05) * k, `${state.style}|${house.base}`);

  // Doormat on the porch, always.
  addProp('doormat', prop('doormat'), pathX, house.base + 0.01, origin.z + (DEPTH / 2 + 0.4) * k);

  // Garden items: each is one group she can drag, turn, copy or delete. An item goes
  // where she put it, or its default spot; if the house has grown over that
  // spot, it hops to the nearest free one.
  // Sets only bump into solid things: walls (with plinth), porch, stepping
  // stones, driveway and the side flower box. The roomier `rects` above are
  // for trees and flowers.
  const ex = state.extras;
  // Walls of the ground rooms, terrace posts, towers and the flower box come
  // from the house itself, so the space under a terrace stays free for furniture.
  const solids = [
    ...house.solids,
    { x0: pathX - 0.95 * k, x1: pathX + 0.95 * k, z0: house.z1, z1: house.frontZ },
    { x0: pathX - 0.6, x1: pathX + 0.6, z0: house.frontZ, z1: hz + 1 },
  ];
  for (const g of house.garages) solids.push({ x0: g.x - g.w * 0.45, x1: g.x + g.w * 0.45, z0: g.front, z1: hz + 1 });
  const edge = ex.fence ? 0.45 : 0.15; // stay inside the fence when there is one
  const setZones = {}, roofZones = {}, spots = {};
  const terraceAt = (x, z) => house.terraces.find(t => x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1);
  const defaults = {
    mailbox: { x: pathX + 1.25, z: hz - 0.95, rot: 0 },
    picnic: { x: hx - 1.9, z: hz - 1.8, rot: 0 },
    bench: { x: house.x1 + 1.2, z: origin.z + 0.2, rot: Math.PI / 2 },
    veggies: { x: -hx + 1.55, z: hz - 1.8, rot: 0 },
  };
  for (const item of state.items) {
    const group = buildItem(item.type);
    if (!group) continue; // its model is still loading
    const atDefault = item.u == null;
    const def = defaults[item.type] ?? { x: 0, z: hz * 0.5, rot: 0 };
    const rot = atDefault ? def.rot : item.rot;
    let x = atDefault ? def.x : item.u * hx;
    let z = atDefault ? def.z : item.v * hz;
    const scale = item.scale ?? 1;
    const [rx, rz] = footprint(item.type, rot, scale);
    const flat = CATALOG[item.type].flat;
    // On a roof terrace: stay on that deck (or the nearest terrace) if it fits.
    let onRoof = null;
    if (item.onRoof && house.terraces.length) {
      const inside = (t, px, pz) => px - rx > t.x0 && px + rx < t.x1 && pz - rz > t.z0 && pz + rz < t.z1;
      const roofFits = (px, pz) => {
        const t = house.terraces.find(tt => inside(tt, px, pz));
        return !!t && (flat || freeRect(Object.values(roofZones), px, pz, rx, rz));
      };
      const spot = roofFits(x, z) ? [x, z] : nearestSpot(x, z, roofFits);
      if (spot) {
        [x, z] = spot;
        onRoof = terraceAt(x, z);
      }
    }
    if (onRoof) {
      group.rotation.y = rot;
      group.scale.multiplyScalar(scale);
      Object.assign(group.userData, { scale, drag: item.id, dragType: item.type, roofY: onRoof.y });
      addProp(`item-${item.id}`, group, x, onRoof.y + (flat ? 0.01 : 0), z, item.type);
      spots[item.id] = { x, z, rot, roof: true };
      if (!flat) roofZones[item.id] = { x0: x - rx, x1: x + rx, z0: z - rz, z1: z + rz };
      continue;
    }
    const placed = flat ? [] : Object.values(setZones);
    const fits = (px, pz) => insideIsland(px, pz, rx, rz, hx, hz, edge) && !wetAt(px, pz, rx, rz) && freeRect(solids, px, pz, rx, rz)
      && freeRect(placed, px, pz, rx, rz);
    if (!fits(x, z)) {
      const spot = nearestSpot(x, z, fits);
      if (!spot) continue;
      [x, z] = spot;
    }
    group.rotation.y = rot;
    group.scale.multiplyScalar(scale);
    group.userData.scale = scale;
    group.userData.drag = item.id;
    group.userData.dragType = item.type;
    // Under a covered terrace it stands on the deck.
    const deck = house.coveredDecks.find(t => x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1);
    addProp(`item-${item.id}`, group, x, (deck ? deck.y : 0) + (flat ? 0.01 : 0), z, item.type);
    const zone = { x0: x - rx, x1: x + rx, z0: z - rz, z1: z + rz };
    rects.push(zone);
    spots[item.id] = { x, z, rot };
    if (!flat) setZones[item.id] = zone;
  }
  setDragZones({ base: solids, walls: house.walls, sets: setZones, roofSets: roofZones, terraces: house.terraces, spots, hx, hz, edge });

  if (ex.fence) {
    // A line of fence pieces stretched to fill [a, b] exactly.
    const SEG = 1.7, inset = 0.3;
    const line = (id, a, b, fixed, alongX) => {
      const len = b - a;
      if (len < 0.6) return;
      const n = Math.max(1, Math.round(len / SEG));
      for (let i = 0; i < n; i++) {
        const piece = prop('fence', alongX ? 0 : Math.PI / 2);
        if (!piece) return;
        const c = a + (len * (i + 0.5)) / n;
        if (alongX) piece.scale.x = len / n / SEG; else piece.scale.z = len / n / SEG;
        addProp(`fence-${id}-${i}`, piece, alongX ? c : fixed, 0, alongX ? fixed : c, `${n}|${len.toFixed(2)}`);
      }
    };
    const x0 = -hx + inset, x1 = hx - inset, z0 = -hz + inset, z1 = hz - inset;
    // Front: openings for the path (with a gate) and the driveway.
    const gaps = [[pathX - SEG / 2, pathX + SEG / 2]];
    for (const g of house.garages) gaps.push([g.x - g.w / 2 - 0.1, g.x + g.w / 2 + 0.1]);
    gaps.sort((p, q) => p[0] - q[0]);
    let from = x0;
    gaps.forEach(([g0, g1], i) => { line(`front${i}`, from, g0, z1, true); from = g1; });
    line('front-end', from, x1, z1, true);
    addProp('gate', prop('gate'), pathX, 0, z1);
    line('back', x0, x1, z0, true);
    line('left', z0, z1, x0, false);
    line('right', z0, z1, x1, false);
  }
  // `need` is the greenery level at which a decoration appears.
  const place = (id, make, x, z, r, sway = false, need = 0) => {
    if (state.greenery < need || !isFree(x, z, r)) return;
    const obj = make();
    if (!obj) return;
    obj.position.set(x, 0, z);
    obj.userData.sway = sway ? (x * 13.7 + z * 7.1) % (Math.PI * 2) : null;
    // Beach and other styles grow different plants (palms or pines), so a
    // change between them swaps the plant instead of keeping the old one.
    parts.push({ id, obj, sig: STYLES[state.style].sand ? 'sand' : '' });
  };

  // Spots are relative to the island edges, so they move as the island grows.
  // Beach houses get palm trees instead of pines.
  const tree = (scale, palm) => () => {
    if (!STYLES[state.style].sand) return buildPine(scale);
    const p = prop(palm, scale * 2); // second argument turns it, so each palm faces its own way
    p?.scale.setScalar(scale);
    return p;
  };
  place('pine-a', tree(1.25, 'palmTall'), -hx + 1.4, -hz + 1.3, 0.6, true, 0.05);
  place('tree-a', () => buildRoundTree(0.9), -hx + 1.1, -hz + 4.0, 0.5, true, 0.15);
  place('bush-a', () => buildBush(11, 1.0), -hx + 1.4, hz - 1.3, 0.7, false, 0.1);
  place('bush-d', () => buildBush(14, 0.7), pathX - 1.6, house.frontZ - 0.4, 0.1, false, 0.2);
  place('pine-b', tree(0.95, 'palmBend'), hx - 2.1, -hz + 1.2, 0.5, true, 0.25);
  place('bush-b', () => buildBush(12, 0.85), hx - 1.4, hz - 1.4, 0.6, false, 0.3);
  place('bush-c', () => buildBush(13, 0.9), hx - 1.3, 0.8, 0.6, false, 0.4);
  place('pine-c', tree(0.7, 'palmShort'), hx - 0.9, -hz + 3.2, 0.4, true, 0.45);
  place('tree-b', () => buildRoundTree(0.7), hx - 1.0, hz - 3.2, 0.4, true, 0.6);
  place('bush-e', () => buildBush(15, 0.8), -hx + 1.0, 0.4, 0.5, false, 0.65);
  place('bush-f', () => buildBush(16, 0.75), hx - 4.2, hz - 1.0, 0.5, false, 0.75);
  place('pine-d', tree(0.8, 'palmTall'), -hx + 2.9, -hz + 0.9, 0.4, true, 0.8);
  place('stump', () => prop('stump', 0.6), hx - 2.6, 0.2, 0.3, false, 0.35);
  place('logs', () => prop('logs', 0.4), hx - 0.8, -hz + 2.0, 0.4, false, 0.5);
  place('mushrooms-a', () => prop('mushrooms'), -hx + 2.2, hz - 0.8, 0.2, false, 0.6);
  place('mushrooms-b', () => prop('mushrooms', 2), hx - 1.7, 1.7, 0.2, false, 0.7);

  // Hedges hugging the house: along the front from 0.5, along the side from 0.7.
  // Front hedges follow each stretch of ground rooms (not the terraces), and
  // leave room for the door, castle towers and anything she placed there.
  const k2 = state.size;
  const towerPad = STYLES[state.style].towers ? 0.8 * k2 : 0;
  const houseRight = house.groundRuns[house.groundRuns.length - 1].x1;
  if (state.greenery >= 0.5) {
    let i = 0;
    for (const run of house.groundRuns) {
      for (let x = run.x0 + 0.35; x < run.x1 - 0.2; x += 0.55) {
        const nearTower = towerPad && (x < house.houseX0 + towerPad || x > house.houseX1 - towerPad);
        const blocked = house.frontBlocked.some(b => x > b.x0 - 0.2 && x < b.x1 + 0.2);
        if (nearTower || blocked || wetAt(x, house.z1 + 0.32, 0.2) || Math.abs(x - pathX) < 1.15 * k2 || !freeRect(Object.values(setZones), x, house.z1 + 0.32, 0.2, 0.2)) { i++; continue; }
        const blob = buildBush(40 + i, 0.42);
        blob.position.set(x, 0, house.z1 + 0.32);
        parts.push({ id: `hedge-front-${i++}`, obj: blob });
      }
    }
  }
  if (state.greenery >= 0.7) {
    let i = 0;
    for (let z = house.z0 + 0.4; z < house.z1 - 0.2; z += 0.55) {
      if (houseRight < house.houseX1 - 0.01 || wetAt(houseRight + 0.34, z, 0.2) || !freeRect(Object.values(setZones), houseRight + 0.34, z, 0.2, 0.2)) { i++; continue; }
      const blob = buildBush(60 + i, 0.42);
      blob.position.set(houseRight + 0.34, 0, z);
      parts.push({ id: `hedge-side-${i++}`, obj: blob });
    }
  }

  [[hx - 2.8, hz - 0.7, 0.28], [-hx + 0.7, hz - 2.0, 0.2], [-hx + 3.6, -hz + 0.6, 0.24]].forEach(([x, z, r], i) => {
    place(`rock-${i}`, () => {
      const rock = shade(new THREE.Mesh(new THREE.DodecahedronGeometry(r), mat(P.stone, { flatShading: true })));
      rock.scale.y = 0.7;
      rock.position.y = r * 0.5;
      const g = new THREE.Group();
      g.add(rock);
      return g;
    }, x, z, r);
  });

  const flowerCount = Math.round(state.greenery * flowerSpots.length);
  flowerSpots.forEach((f, i) => {
    const x = f.u * (sizeX - 1.2), z = f.v * (sizeZ - 1.2);
    if (i >= flowerCount || !isFree(x, z, 0.2)) return;
    const fl = buildFlower(f.color, f.scale);
    fl.position.set(x, 0.06, z);
    parts.push({ id: `flower-${i}`, obj: fl });
  });

  reconcile(parts);
  applyColors();
  saveDesign();
  const grass = grassColor(state.greenery, STYLES[state.style].sand);
  if (!grass.equals(grassMat.color)) {
    gsap.to(grassMat.color, { r: grass.r, g: grass.g, b: grass.b, duration: 0.6, ease: 'power2.out' });
  }

  // Camera keeps the island (with tree height) and the house in view.
  setFitBoxes([
    new THREE.Box3(new THREE.Vector3(-hx, ISLAND_BOTTOM, -hz), new THREE.Vector3(hx, 3.2, hz)),
    new THREE.Box3(new THREE.Vector3(house.x0, 0, house.z0), new THREE.Vector3(house.x1, house.height, house.z1)),
  ]);
  fitCamera(animateCamera);
}
