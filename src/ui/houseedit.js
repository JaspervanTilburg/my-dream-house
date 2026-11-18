import * as THREE from 'three';
import { STYLES, state } from '../config.js';
import { FRONTS, ROOF_EXTRAS, frontsFor, roofExtrasFor, sideFrontsFor } from '../fronts.js';
import { sfx } from '../fx/audio.js';
import { sharedGeometries } from '../helpers.js';
import { frontType } from '../house.js';
import { toast } from '../items.js';
import { describe, key } from '../layout.js';
import { camera, renderer } from '../scene.js';
import { getHouse, update, world } from '../world.js';

// ---------------------------------------------------------------------------
// Tap a room to choose its front (window, bay, balcony, door, garage door...),
// or a roof to give it a dormer or chimney. A purple glow marks the choice and
// a small chooser floats next to it.
// ---------------------------------------------------------------------------
const bar = document.getElementById('room-bar');
const title = document.getElementById('room-bar-title');
const options = document.getElementById('room-bar-options');
let picked = null; // { c, f } for a room, { c, roof: true } for a roof

const glowMat = new THREE.MeshBasicMaterial({ color: '#b98af0', transparent: true, opacity: 0.35, depthWrite: false });
const glowGeo = new THREE.PlaneGeometry(1, 1);
sharedGeometries.add(glowGeo);
const glow = new THREE.Mesh(glowGeo, glowMat);
glow.renderOrder = 3;
glow.visible = false;
world.add(glow);

export function pickHousePart(point) {
  const house = getHouse();
  const part = point && house ? house.geom.cellAt(point.x, point.y, point.normal) : null;
  const same = part && picked && part.c === picked.c && part.f === picked.f && !!part.roof === !!picked.roof
    && part.face === picked.face;
  picked = part;
  if (!part) { bar.hidden = true; glow.visible = false; return; }
  if (!same) sfx.click();
  render();
  bar.hidden = false;
  requestAnimationFrame(follow);
}

const FACE_NAMES = { left: 'left side', right: 'right side', back: 'back' };
const sideKey = () => `${picked.c},${picked.f},${picked.face}`;
const floorName = f => (f === 0 ? 'Ground floor' : f === 1 ? 'First floor' : 'Second floor');

function render() {
  const d = describe(state.cells);
  if (picked.roof ? !d.columns[picked.c] : !d.has(picked.c, picked.f)) { pickHousePart(null); return; }
  const st = STYLES[state.style];
  let list, current, labels;
  if (picked.roof) {
    title.textContent = 'Roof';
    list = roofExtrasFor(st.roof);
    current = list.includes(state.roofs[picked.c]) ? state.roofs[picked.c] : 'plain';
    labels = ROOF_EXTRAS;
  } else {
    const terrace = picked.f === 1 && !d.has(picked.c, 0);
    const room = terrace ? 'Room over the terrace' : `${floorName(picked.f)} room`;
    labels = FRONTS;
    if (picked.face === 'front') {
      title.textContent = room;
      list = frontsFor(picked.f);
      current = frontType(state, picked.c, picked.f, getHouse().doorCol);
    } else {
      title.textContent = `${room}, ${FACE_NAMES[picked.face]}`;
      list = sideFrontsFor(picked.f, getHouse().patioWalls.has(sideKey()));
      current = getHouse().sides[sideKey()] ?? 'window';
    }
  }
  options.replaceChildren(...list.map(type => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'room-opt';
    b.id = `room-opt-${type}`;
    b.textContent = labels[type].label;
    b.setAttribute('aria-pressed', String(type === current));
    b.addEventListener('click', () => choose(type));
    return b;
  }));
}

const without = (obj, k) => Object.fromEntries(Object.entries(obj).filter(([n]) => n !== k));

function choose(type) {
  const { c, f, roof } = picked;
  if (roof) {
    state.roofs = { ...state.roofs, [c]: type };
  } else if (picked.face !== 'front') {
    state.sides = { ...state.sides, [sideKey()]: type };
  } else {
    const house = getHouse();
    const k = key(c, f);
    if (type === 'door') {
      state.doorCol = c;
      state.fronts = without(state.fronts, k); // the door replaces whatever was there
    } else {
      if (f === 0 && c === house.doorCol) {
        // The door moves to another ground room; a house always has one.
        const others = Object.keys(house.cells.columns).map(Number).filter(n => n !== c && house.cells.has(n, 0));
        if (!others.length) { sfx.bloop(); toast('The house needs a front door. Add a room first.'); return; }
        others.sort((a, b) => Math.abs(a - c) - Math.abs(b - c));
        const target = others.find(n => !['garage', 'bay'].includes(state.fronts[key(n, 0)])) ?? others[0];
        state.doorCol = target;
        state.fronts = without(state.fronts, key(target, 0));
      }
      state.fronts = { ...state.fronts, [k]: type };
    }
  }
  sfx.pop(0);
  update(false);
  render();
}

// Keep the glow on the picked part and the chooser just above it.
const tmp = new THREE.Vector3();
function follow() {
  const house = getHouse();
  if (!picked || bar.hidden || !house) return;
  const g = house.geom;
  const d = house.cells;
  if (picked.roof ? !d.columns[picked.c] : !d.has(picked.c, picked.f)) { pickHousePart(null); return; }
  const x = g.colX(picked.c), frontZ = g.z + g.depth / 2 + 0.03;
  let topY;
  if (picked.roof) {
    // A flat glow over the roof of the column.
    const roofY = g.floorY(d.columns[picked.c].top);
    glow.rotation.set(-Math.PI / 2, 0, 0);
    glow.scale.set(g.module, g.depth, 1);
    glow.position.set(x, (g.roofTop(picked.c) + roofY) / 2, g.z);
    topY = g.roofTop(picked.c) + 0.4;
  } else {
    // The glow covers the tapped wall: the front, a side or the back.
    const y = g.floorY(picked.f) + g.floorH / 2;
    const face = picked.face;
    if (face === 'front' || face === 'back') {
      glow.rotation.set(0, face === 'back' ? Math.PI : 0, 0);
      glow.scale.set(g.module * 0.96, g.floorH * 0.96, 1);
      glow.position.set(x, y, face === 'back' ? g.z - g.depth / 2 - 0.03 : frontZ);
    } else {
      const dir = face === 'right' ? 1 : -1;
      glow.rotation.set(0, dir * Math.PI / 2, 0);
      glow.scale.set(g.depth * 0.96, g.floorH * 0.96, 1);
      glow.position.set(x + dir * (g.module / 2 + 0.03), y, g.z);
    }
    topY = g.floorY(picked.f) + g.floorH;
  }
  glow.visible = true;
  tmp.set(glow.position.x, topY, picked.roof ? frontZ : glow.position.z).add(world.position).project(camera);
  const r = renderer.domElement.getBoundingClientRect();
  const sx = (tmp.x + 1) / 2 * r.width + r.left, sy = (1 - tmp.y) / 2 * r.height + r.top;
  const w = bar.offsetWidth, h = bar.offsetHeight;
  bar.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, sx - w / 2))}px`;
  bar.style.top = `${Math.min(window.innerHeight - h - 8, Math.max(8, sy - h - 10))}px`;
  requestAnimationFrame(follow);
}

document.getElementById('room-bar-close').addEventListener('click', () => pickHousePart(null));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && picked) pickHousePart(null); });
