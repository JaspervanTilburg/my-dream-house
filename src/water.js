import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { reducedMotion } from './config.js';
import { canvasTexture, mat, rng, sharedGeometries } from './helpers.js';
import { applyWorldUV } from './materials.js';
import { ISLAND_BOTTOM } from './island.js';
import { dragZones } from './props.js';
import { world } from './world.js';
import { CELL, cellKey, centerOfCell, onWaterChange, waterCells } from './waterdata.js';

// ---------------------------------------------------------------------------
// Drawing the painted water (see waterdata.js): overlapping rounded tiles melt
// into soft shapes, with a sandy bank, pebbles and reeds along the edge, and a
// little waterfall wherever the water runs off the island.
// ---------------------------------------------------------------------------
const centerOf = centerOfCell;
// --- Looks ---

// Soft ripples, tinted by the water color; scrolled every frame so it flows.
const rippleTexture = canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  g.lineCap = 'round';
  const rand = rng(5);
  for (let i = 0; i < 14; i++) {
    const x = rand() * w, y = rand() * h, len = 20 + rand() * 40;
    g.strokeStyle = `rgba(40, 120, 170, ${0.1 + rand() * 0.12})`;
    g.lineWidth = 3 + rand() * 3;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len / 2, y - 8, x + len, y);
    g.stroke();
  }
});
rippleTexture.wrapS = rippleTexture.wrapT = THREE.RepeatWrapping;

// Falling streaks for the waterfalls.
const fallTexture = canvasTexture(64, 256, (g, w, h) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  const rand = rng(9);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(40, 120, 170, ${0.1 + rand() * 0.15})`;
    g.fillRect(rand() * w, rand() * h, 2 + rand() * 3, 30 + rand() * 60);
  }
});
fallTexture.wrapS = fallTexture.wrapT = THREE.RepeatWrapping;

const waterMat = new THREE.MeshStandardMaterial({
  color: '#7cc9ea', map: rippleTexture, roughness: 0.15, metalness: 0,
  emissive: '#2d7f99', emissiveIntensity: 0.12, // opaque: overlapping discs must not show seams
});
const fallMat = new THREE.MeshStandardMaterial({
  color: '#9ad7ef', map: fallTexture, roughness: 0.2, transparent: true, opacity: 0.85,
  emissive: '#2d7f99', emissiveIntensity: 0.1, side: THREE.DoubleSide,
});
const bankMat = mat('#d9c3a0');
const reedMat = mat('#6cbf47');
const reedDark = mat('#4f9e5e');
const pebbleMat = mat('#c9c2b8', { flatShading: true });
const pebbleGeo = new THREE.DodecahedronGeometry(0.07);
const reedGeo = new THREE.ConeGeometry(0.035, 0.42, 5);
const cattailGeo = new THREE.CapsuleGeometry(0.035, 0.08, 3, 6);
[pebbleGeo, reedGeo, cattailGeo].forEach(g => sharedGeometries.add(g));
const cattailMat = mat('#9a6a45');

const group = new THREE.Group();
world.add(group);

// One disc per cell, all merged into a single mesh.
function tiles(size, h, y, list) {
  // Round discs: overlapping neighbours melt into soft, curvy shorelines.
  const base = new THREE.CylinderGeometry(size / 2, size / 2, h, 20);
  const parts = list.map(k => {
    const [i, j] = k.split(',').map(Number);
    return base.clone().translate(centerOf(i), y, centerOf(j));
  });
  base.dispose();
  const geo = mergeGeometries(parts);
  parts.forEach(p => p.dispose());
  return geo;
}

function rebuild() {
  const cells = waterCells();
  group.traverse(o => { if (o.isMesh && !sharedGeometries.has(o.geometry)) o.geometry.dispose(); });
  group.clear();
  if (!cells.size) return;
  const list = [...cells];
  const bank = new THREE.Mesh(tiles(CELL * 2.0, 0.05, 0.0, list), bankMat);
  bank.receiveShadow = true;
  const water = new THREE.Mesh(tiles(CELL * 1.6, 0.06, 0.02, list), waterMat);
  water.receiveShadow = true;
  water.updateMatrixWorld(true);
  applyWorldUV(water, new THREE.Matrix4()); // ripples run on across the whole pond
  group.add(bank, water);

  const { hx, hz } = dragZones;
  const has = (i, j) => cells.has(cellKey(i, j));
  const rand = rng(17);
  const falls = [];
  for (const k of list) {
    const [i, j] = k.split(',').map(Number);
    const x = centerOf(i), z = centerOf(j);
    // Waterfall where the water reaches the edge of the island.
    const edges = [
      [x + CELL / 2 > hx - 0.6, hx + 0.03, z, Math.PI / 2],
      [x - CELL / 2 < -hx + 0.6, -hx - 0.03, z, -Math.PI / 2],
      [z + CELL / 2 > hz - 0.6, x, hz + 0.03, 0],
      [z - CELL / 2 < -hz + 0.6, x, -hz - 0.03, Math.PI],
    ];
    for (const [at, fx, fz, rot] of edges) {
      if (!at) continue;
      const len = 1.4 - ISLAND_BOTTOM;
      const g = new THREE.PlaneGeometry(CELL * 1.1, len);
      g.translate(0, -len / 2 + 0.05, 0);
      g.rotateY(rot);
      g.translate(fx, 0, fz);
      falls.push(g);
    }
    // Pebbles and reeds on the bank, where water meets lawn.
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => !has(i + di, j + dj));
    if (!open.length) continue;
    const r = rand();
    const [di, dj] = open[Math.floor(rand() * open.length)];
    const bx = x + di * CELL * 0.62 + (rand() - 0.5) * 0.2, bz = z + dj * CELL * 0.62 + (rand() - 0.5) * 0.2;
    if (Math.abs(bx) > hx - 0.25 || Math.abs(bz) > hz - 0.25) continue;
    if (r < 0.35) {
      for (let n = 0; n < 2 + Math.floor(rand() * 2); n++) {
        const p = new THREE.Mesh(pebbleGeo, pebbleMat);
        p.position.set(bx + (rand() - 0.5) * 0.18, 0.04, bz + (rand() - 0.5) * 0.18);
        p.scale.set(1 + rand(), 0.6, 1 + rand() * 0.6);
        p.rotation.y = rand() * 3;
        p.castShadow = true;
        group.add(p);
      }
    } else if (r < 0.7) {
      const tuft = new THREE.Group();
      for (let n = 0; n < 4; n++) {
        const reed = new THREE.Mesh(reedGeo, n % 2 ? reedMat : reedDark);
        const s = 0.7 + rand() * 0.6;
        reed.scale.set(1, s, 1);
        reed.position.set((rand() - 0.5) * 0.14, 0.21 * s, (rand() - 0.5) * 0.14);
        reed.rotation.set((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3);
        reed.castShadow = true;
        tuft.add(reed);
      }
      if (rand() < 0.5) {
        const cat = new THREE.Mesh(cattailGeo, cattailMat);
        cat.position.set(0.03, 0.42, 0);
        tuft.add(cat);
      }
      tuft.position.set(bx, 0.02, bz);
      tuft.userData.sway = rand() * 6;
      group.add(tuft);
    }
  }
  if (falls.length) {
    const fall = new THREE.Mesh(mergeGeometries(falls), fallMat);
    falls.forEach(f => f.dispose());
    group.add(fall);
  }
}

// Called by the render loop: the water flows and the reeds sway.
let drawnFor = '';
export function waterTick(time, dt) {
  // The island changed size (waterfalls sit on its edges): draw again.
  const size = `${dragZones.hx},${dragZones.hz}`;
  if (size !== drawnFor) { drawnFor = size; rebuild(); }
  if (reducedMotion) return;
  rippleTexture.offset.x += dt * 0.05;
  rippleTexture.offset.y += dt * 0.03;
  fallTexture.offset.y += dt * 0.6;
  for (const o of group.children) {
    if (o.userData.sway != null) o.rotation.z = Math.sin(time * 1.6 + o.userData.sway) * 0.06;
  }
}

onWaterChange(rebuild);
// The island size is only known after the first build; draw what was saved then.
export const redrawWater = () => rebuild();
