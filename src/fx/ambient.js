import * as THREE from 'three';
import gsap from 'gsap';
import { state } from '../config.js';
import { rng } from '../helpers.js';
import { UP, scene, view } from '../scene.js';
import { live } from '../world.js';

// ---------------------------------------------------------------------------
// Idle life: drifting clouds and chimney smoke
// ---------------------------------------------------------------------------
export const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
export const clouds = new THREE.Group();   // turns with the view so clouds stay behind the island
scene.add(clouds);
// [x, y, z, size, speed]: high clouds far behind, and a few small ones drifting
// low past the front of the island.
[
  [-6, 7.5, -14, 1.1, 0.3], [7, 9, -16, 0.9, 0.4], [-16, 8.5, -6, 1.0, 0.35], [2, 10, -20, 1.3, 0.22],
  [-12, 5.5, -18, 0.7, 0.5], [13, 6.5, -10, 0.6, 0.55], [-3, 11.5, -10, 1.6, 0.16],
  [-9, -3.2, 7, 0.55, 0.6], [10, -3.6, 5, 0.45, 0.7],
].forEach(([x, y, z, sc, speed], i) => {
  const c = new THREE.Group();
  const rand = rng(90 + i);
  const puffsN = 4 + Math.floor(rand() * 3);
  for (let j = 0; j < puffsN; j++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.7 + rand() * 0.5, 16, 12), cloudMat);
    puff.position.set((j - (puffsN - 1) / 2) * 0.75, rand() * 0.35, (rand() - 0.5) * 0.6);
    c.add(puff);
  }
  c.position.set(x, y, z);
  c.scale.setScalar(sc);
  c.userData.speed = speed;
  clouds.add(c);
});

export const puffGeo = new THREE.SphereGeometry(0.2, 12, 10);
export const puffs = Array.from({ length: 10 }, () => {
  const m = new THREE.Mesh(puffGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0 }));
  m.visible = false;
  scene.add(m);
  return m;
});
export let nextPuff = 0;
export const chimneyPos = new THREE.Vector3();
// Puffs take turns between the chimneys on the house.
let chimneyTurn = 0;
export function puffSmoke() {
  const tops = [];
  for (const { obj } of live.values()) {
    if (obj.userData.house) obj.traverse(o => { if (o.name === 'chimney-top') tops.push(o); });
  }
  if (!tops.length) return;
  const top = tops[chimneyTurn++ % tops.length];
  top.getWorldPosition(chimneyPos);
  const p = puffs[nextPuff++ % puffs.length];
  gsap.killTweensOf([p.position, p.scale, p.material]);
  p.visible = true;
  p.position.copy(chimneyPos).add(new THREE.Vector3(0, 0.15, 0));
  p.scale.setScalar(0.5 * state.size);
  p.material.opacity = 0.85;
  const drift = new THREE.Vector3(0.5, 0, -0.3).applyAxisAngle(UP, view.angle);
  gsap.to(p.position, { x: `+=${drift.x}`, y: '+=2.4', z: `+=${drift.z}`, duration: 3.2, ease: 'sine.out' });
  gsap.to(p.scale, { x: 1.8 * state.size, y: 1.8 * state.size, z: 1.8 * state.size, duration: 3.2, ease: 'sine.out' });
  gsap.to(p.material, { opacity: 0, duration: 3.2, ease: 'power1.in', onComplete: () => { p.visible = false; } });
}
