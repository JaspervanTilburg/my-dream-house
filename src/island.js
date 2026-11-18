import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { state } from './config.js';
import { canvasTexture, dirtTexture, rbox, shade } from './helpers.js';

// ---------------------------------------------------------------------------
// Island (ground tile)
// ---------------------------------------------------------------------------
export const ISLAND_MIN = 10;       // smallest island side
export const ISLAND_MARGIN = 5.5;   // lawn left around the house on the sides
export const ISLAND_BOTTOM = -1.95;

export const dirtMat = new THREE.MeshStandardMaterial({ map: dirtTexture, roughness: 0.9 });

// Soft drop shadow far below, so the island looks like it floats.
export const blobMat = new THREE.MeshBasicMaterial({
  transparent: true,
  depthWrite: false,
  map: canvasTexture(256, 256, (c, w, h) => {
    const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(60, 70, 60, 0.28)');
    grd.addColorStop(1, 'rgba(60, 70, 60, 0)');
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
  }),
});

// Grass shifts from dry to lush with the greenery slider.
export const GRASS_DRY = new THREE.Color('#c4d978');
export const GRASS_LUSH = new THREE.Color('#74c94c');
const SAND = new THREE.Color('#f3dfb2');
export const grassColor = (g, sand = false) => (sand
  ? SAND.clone().lerp(GRASS_LUSH, g * 0.18) // beach: sand with a hint of beach grass
  : GRASS_DRY.clone().lerp(GRASS_LUSH, Math.pow(g, 0.6))); // green already at mid-slider
export const grassMat = new THREE.MeshStandardMaterial({ color: grassColor(state.greenery), roughness: 0.78 });

export function buildIsland(sizeX, sizeZ) {
  const g = new THREE.Group();

  const grass = rbox(sizeX, 0.5, sizeZ, grassMat, 0.2);
  grass.position.y = -0.25;
  g.add(grass);

  const dirt = shade(new THREE.Mesh(
    new RoundedBoxGeometry(sizeX - 0.25, 1.5, sizeZ - 0.25, 3, 0.12), dirtMat));
  dirt.position.y = -1.2;
  g.add(dirt);

  const blob = new THREE.Mesh(new THREE.PlaneGeometry(sizeX * 1.7, sizeZ * 1.7), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -3.6;
  g.add(blob);

  return g;
}
