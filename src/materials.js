import * as THREE from 'three';
import { canvasTexture } from './helpers.js';

// ---------------------------------------------------------------------------
// Wall materials drawn in code: light grey patterns on white, so the wall
// color (which tints them) stays the color she picked. Each texture covers
// 1 x 1 world unit; meshes get world-based UVs (applyWorldUV), so the
// pattern runs on across neighbouring walls and never stretches.
// ---------------------------------------------------------------------------
function wallTexture(draw) {
  const tex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    draw(g, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const line = (g, x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };

export const WALL_TEXTURES = {
  // Horizontal wooden siding: a soft shadow under each board.
  siding: wallTexture((g, w, h) => {
    const boards = 4;
    for (let i = 0; i < boards; i++) {
      const y = (i / boards) * h;
      const grd = g.createLinearGradient(0, y, 0, y + h / boards);
      grd.addColorStop(0, 'rgba(70, 50, 40, 0.13)');
      grd.addColorStop(0.18, 'rgba(70, 50, 40, 0)');
      grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
      g.fillStyle = grd;
      g.fillRect(0, y, w, h / boards);
    }
  }),
  // Vertical boards with narrow battens, as on a barn.
  boards: wallTexture((g, w, h) => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * w;
      g.fillStyle = 'rgba(70, 40, 30, 0.12)';
      g.fillRect(x, 0, 7, h);
      g.fillStyle = 'rgba(255, 255, 255, 0.35)';
      g.fillRect(x + 7, 0, 3, h);
    }
  }),
  // Smooth render with faint panel joints.
  panels: wallTexture((g, w, h) => {
    g.strokeStyle = 'rgba(60, 60, 80, 0.09)';
    g.lineWidth = 3;
    line(g, 0, 1, w, 1);
    line(g, 1, 0, 1, h);
  }),
  // Staggered stone blocks with soft mortar lines.
  stone: wallTexture((g, w, h) => {
    const rows = 4, rh = h / rows;
    g.strokeStyle = 'rgba(70, 60, 50, 0.16)';
    g.lineWidth = 4;
    for (let r = 0; r < rows; r++) {
      line(g, 0, r * rh, w, r * rh);
      const off = r % 2 ? w / 4 : 0;
      for (let x = off; x <= w; x += w / 2) line(g, x, r * rh, x, (r + 1) * rh);
      // A few slightly darker stones.
      g.fillStyle = 'rgba(70, 60, 50, 0.05)';
      g.fillRect(off + 4 + ((r * 37) % 3) * 20, r * rh + 4, w / 2 - 8, rh - 8);
    }
  }),
};

// Wall bricks (canal houses): darker bricks with joints in the wall color.
WALL_TEXTURES.brick = wallTexture((g, w, h) => {
  const rows = 6, rh = h / rows, bw = w / 3;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let x = -off, i = 0; x < w; x += bw, i++) {
      g.fillStyle = `rgba(60, 25, 15, ${0.14 + ((r * 5 + i * 3) % 4) * 0.035})`;
      g.fillRect(x + 3, r * rh + 3, bw - 6, rh - 6);
    }
  }
});

// Wooden planks for decks and terraces (the planks run front to back).
export const plankTexture = wallTexture((g, w, h) => {
  const n = 5, pw = w / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(110, 70, 40, ${0.04 + (i % 3) * 0.03})`;
    g.fillRect(i * pw + 2, 0, pw - 4, h);
    g.fillStyle = 'rgba(110, 70, 40, 0.22)';
    g.fillRect(i * pw, 0, 3, h);
    // A plank end (butt joint) somewhere along each plank.
    g.fillRect(i * pw, ((i * 97) % 200) + 20, pw, 3);
  }
});

// Small bricks for the plinth (the strip the house stands on).
export const brickTexture = wallTexture((g, w, h) => {
  const rows = 8, rh = h / rows;
  g.strokeStyle = 'rgba(80, 40, 30, 0.2)';
  g.lineWidth = 3;
  for (let r = 0; r < rows; r++) {
    line(g, 0, r * rh, w, r * rh);
    const off = r % 2 ? w / 8 : 0;
    for (let x = off; x <= w; x += w / 4) line(g, x, r * rh, x, (r + 1) * rh);
  }
});

// World-based UVs: each face is mapped by the two axes it lies along, so a
// texture of 1 x 1 world unit tiles evenly. `matrix` places the mesh in house
// coordinates (so neighbouring walls line up).
const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
export function applyWorldUV(mesh, matrix) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  if (!pos || !nor) return;
  _nm.getNormalMatrix(matrix);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    _n.fromBufferAttribute(nor, i).applyMatrix3(_nm);
    const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
    let u, v;
    if (ax >= ay && ax >= az) { u = _p.z; v = _p.y; }
    else if (ay >= az) { u = _p.x; v = _p.z; }
    else { u = _p.x; v = _p.y; }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Every mesh in a house part whose material uses one of the textures above.
const worldTextures = new Set([...Object.values(WALL_TEXTURES), brickTexture, plankTexture]);
export function worldUVPart(obj) {
  obj.updateMatrixWorld(true);
  obj.traverse(o => {
    if (o.isMesh && worldTextures.has(o.material?.map)) applyWorldUV(o, o.matrixWorld);
  });
}
