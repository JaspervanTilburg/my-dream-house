import * as THREE from 'three';
import { P } from './config.js';
import { mat, rng, shade, sphere } from './helpers.js';

// ---------------------------------------------------------------------------
// Greenery
// ---------------------------------------------------------------------------
export function buildPine(scale = 1) {
  const g = new THREE.Group();
  const trunk = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.7, 8), mat(P.trunk)));
  trunk.position.y = 0.35;
  g.add(trunk);
  const tiers = [[1.1, 1.3, 0.6], [0.85, 1.1, 1.35], [0.6, 0.95, 2.0]];
  tiers.forEach(([r, h, y], i) => {
    const cone = shade(new THREE.Mesh(new THREE.ConeGeometry(r, h, 7),
      mat(i % 2 ? P.pineLight : P.pine, { flatShading: true })));
    cone.position.y = y + h / 2;
    cone.rotation.y = i * 0.4;
    g.add(cone);
  });
  g.scale.setScalar(scale);
  return g;
}

export function buildRoundTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 1.0, 8), mat(P.trunk)));
  trunk.position.y = 0.5;
  const crown = sphere(0.85, P.bushLight, 20);
  crown.position.y = 1.55;
  crown.scale.set(1, 1.1, 1);
  g.add(trunk, crown);
  g.scale.setScalar(scale);
  return g;
}

export function buildBush(seed, size = 1) {
  const g = new THREE.Group();
  const rand = rng(seed);
  const blobs = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < blobs; i++) {
    const r = (0.35 + rand() * 0.25) * size;
    const b = sphere(r, rand() > 0.5 ? P.bush : P.bushLight, 16);
    const a = (i / blobs) * Math.PI * 2;
    b.position.set(Math.cos(a) * 0.35 * size, r * 0.8, Math.sin(a) * 0.35 * size);
    g.add(b);
  }
  // A few flowers peeking out of the bush.
  for (let i = 0; i < 3; i++) {
    const fl = buildFlower(P.petals[Math.floor(rand() * P.petals.length)], 0.8);
    const a = rand() * Math.PI * 2;
    fl.position.set(Math.cos(a) * 0.5 * size, 0.55 * size + rand() * 0.2, Math.sin(a) * 0.5 * size);
    g.add(fl);
  }
  return g;
}

// Ivy: a column of flattened leaf blobs climbing a wall, narrowing toward the top.
export const leafGeo = new THREE.SphereGeometry(0.12, 8, 6);
export const IVY_ROW = 0.14;
export function buildIvy(rows, seed, span = 0.5) {
  const g = new THREE.Group();
  const rand = rng(seed);
  for (let r = 0; r < rows; r++) {
    const n = 3 + (rand() < 0.5 ? 1 : 0);
    const w = span * (1 - 0.45 * (r / rows));
    for (let i = 0; i < n; i++) {
      const leaf = new THREE.Mesh(leafGeo, mat(rand() < 0.5 ? P.pine : P.bush));
      leaf.position.set((rand() - 0.5) * w, 0.08 + r * IVY_ROW + rand() * 0.06, 0);
      leaf.scale.set(1.15, 0.9, 0.4);
      leaf.rotation.z = rand() * Math.PI;
      leaf.receiveShadow = true;
      g.add(leaf);
    }
  }
  return g;
}

export const petalGeo = new THREE.SphereGeometry(0.055, 10, 8);
export const centerGeo = new THREE.SphereGeometry(0.05, 10, 8);
export function buildFlower(color, scale = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(petalGeo, mat(color));
    const a = (i / 5) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075);
    p.scale.set(1, 0.6, 1);
    g.add(p);
  }
  const c = new THREE.Mesh(centerGeo, mat(P.petalCenter));
  c.position.y = 0.02;
  g.add(c);
  g.scale.setScalar(scale);
  return g;
}
