import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P } from './config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...opts }));
  }
  return matCache.get(key);
}

// Geometries shared between many meshes; never disposed when a part is removed.
export const sharedGeometries = new Set();

export function shade(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Rounded box: the single most important shape for the soft toy look.
export function rbox(w, h, d, material, r = 0.08) {
  const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius),
    typeof material === 'string' ? mat(material) : material);
  return shade(m);
}

export function sphere(r, color, seg = 16) {
  return shade(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat(color)));
}

// Small seeded random generator so decorations stay put between rebuilds.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Roof: white base with soft tile seams, tinted by the material color.
export const roofTexture = canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(80, 40, 120, 0.16)';
  g.lineWidth = 4;
  for (let i = 1; i < 6; i++) {
    const y = (i / 6) * h;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
});

// Dirt sides of the island: staggered stone blocks like the first reference.
export const dirtTexture = canvasTexture(1024, 160, (g, w, h) => {
  g.fillStyle = P.dirt;
  g.fillRect(0, 0, w, h);
  const rows = 3, rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const bw = 110, offset = r % 2 ? bw / 2 : 0;
    for (let x = -offset; x < w; x += bw) {
      const shadeFactor = 0.9 + ((x * 7 + r * 13) % 10) / 50;
      g.fillStyle = `rgba(${Math.round(176 * shadeFactor)}, ${Math.round(122 * shadeFactor)}, ${Math.round(82 * shadeFactor)}, 1)`;
      g.fillRect(x + 4, r * rowH + 4, bw - 8, rowH - 8);
    }
  }
});
