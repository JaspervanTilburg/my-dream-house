import * as THREE from 'three';
import { CATALOG, CATEGORIES, buildItem, footprint } from '../catalog.js';
import { sfx } from '../fx/audio.js';
import { sharedGeometries } from '../helpers.js';
import { addItem, copyItem, deleteItem, getSelected, onSelect, resizeItem, select, turnItem } from '../items.js';
import { propsReady } from '../props.js';
import { camera, renderer } from '../scene.js';
import { dispose, live, world } from '../world.js';

// ---------------------------------------------------------------------------
// "Shop items" menu: category tabs and a grid of picture tiles. Tapping a
// tile drops that item on free lawn and selects it, ready to drag.
// ---------------------------------------------------------------------------
const shop = document.getElementById('shop');
const tabsEl = document.getElementById('shop-tabs');
const gridEl = document.getElementById('shop-grid');
let activeCat = CATEGORIES[0][0];

CATEGORIES.forEach(([key, label]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.role = 'tab';
  b.id = `shop-tab-${key}`;
  b.textContent = label;
  b.setAttribute('aria-selected', String(key === activeCat));
  b.addEventListener('click', () => { activeCat = key; renderGrid(); sfx.click(); });
  tabsEl.appendChild(b);
});

function renderGrid() {
  tabsEl.querySelectorAll('[role="tab"]').forEach(t =>
    t.setAttribute('aria-selected', String(t.id === `shop-tab-${activeCat}`)));
  gridEl.replaceChildren(...Object.entries(CATALOG).filter(([, spec]) => spec.cat === activeCat).map(([type, spec]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.id = `shop-item-${type}`;
    const img = document.createElement('img');
    img.alt = '';
    img.width = img.height = 96;
    if (thumbs[type]) img.src = thumbs[type];
    const span = document.createElement('span');
    span.textContent = spec.label;
    b.append(img, span);
    b.addEventListener('click', () => {
      shop.close();
      sfx.pop(0);
      addItem(type);
    });
    return b;
  }));
}

// Picture tiles are rendered once from the real models, in the scene's
// colors and camera angle, with a small renderer of their own.
const thumbs = {};
let thumbsMade = false;
async function makeThumbs() {
  if (thumbsMade) return;
  thumbsMade = true;
  await propsReady;
  const size = 192;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size, false);
  r.setClearColor(0x000000, 0);
  const sceneT = new THREE.Scene();
  sceneT.add(new THREE.HemisphereLight('#fff6ff', '#a9d98a', 2.1));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.2);
  sun.position.set(4, 12, 8);
  sceneT.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const dir = new THREE.Vector3(1, 1.08, 1).normalize();
  let n = 0;
  // The open tab first, so the tiles she is looking at fill in right away.
  const order = Object.keys(CATALOG).sort((a, b) => (CATALOG[b].cat === activeCat) - (CATALOG[a].cat === activeCat));
  for (const type of order) {
    const item = buildItem(type);
    if (!item) continue;
    sceneT.add(item);
    const box = new THREE.Box3().setFromObject(item);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    cam.position.copy(center).addScaledVector(dir, 30);
    cam.lookAt(center);
    Object.assign(cam, { left: -radius, right: radius, top: radius, bottom: -radius });
    cam.updateProjectionMatrix();
    r.render(sceneT, cam);
    thumbs[type] = r.domElement.toDataURL('image/png');
    sceneT.remove(item);
    dispose(item);
    const img = document.querySelector(`#shop-item-${type} img`);
    if (img) img.src = thumbs[type];
    if (++n % 6 === 0) await new Promise(requestAnimationFrame); // keep the page responsive
  }
  r.dispose();
  r.forceContextLoss();
}

document.getElementById('act-add').addEventListener('click', () => {
  select(null);
  renderGrid();
  shop.showModal();
  makeThumbs();
});
document.getElementById('shop-close').addEventListener('click', () => shop.close());
// Tapping the dimmed backdrop closes the menu too.
shop.addEventListener('click', e => { if (e.target === shop) shop.close(); });

// ---------------------------------------------------------------------------
// Selection: a ring under the selected item and a small bar above it with
// turn, copy and delete. It follows the item every frame.
// ---------------------------------------------------------------------------
const bar = document.getElementById('item-bar');
const barLabel = document.getElementById('item-bar-label');
const selRing = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: '#b98af0', transparent: true, opacity: 0.9, depthWrite: false }));
selRing.visible = false;
selRing.renderOrder = 2;
world.add(selRing);
sharedGeometries.add(selRing.geometry);

const selectedObj = () => live.get(`item-${getSelected()}`)?.obj ?? null;

onSelect(id => {
  const obj = selectedObj();
  bar.hidden = !obj;
  selRing.visible = !!obj;
  if (obj) barLabel.textContent = CATALOG[obj.userData.dragType]?.label ?? '';
  if (obj) requestAnimationFrame(follow);
});

const tmp = new THREE.Vector3();
function follow() {
  const obj = selectedObj();
  if (!obj || getSelected() == null) { bar.hidden = true; selRing.visible = false; return; }
  const [rx, rz] = footprint(obj.userData.dragType, obj.rotation.y, obj.userData.scale ?? 1);
  selRing.position.set(obj.position.x, (obj.userData.roofY ?? 0) + 0.05, obj.position.z);
  selRing.scale.setScalar(Math.max(rx, rz) + 0.15);
  // Bar sits just above the top of the item on screen.
  const box = new THREE.Box3().setFromObject(obj);
  tmp.set((box.min.x + box.max.x) / 2, box.max.y + 0.2, (box.min.z + box.max.z) / 2).project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  const x = (tmp.x + 1) / 2 * rect.width + rect.left, y = (1 - tmp.y) / 2 * rect.height + rect.top;
  const w = bar.offsetWidth, h = bar.offsetHeight;
  bar.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2))}px`;
  bar.style.top = `${Math.max(8, y - h - 6)}px`;
  requestAnimationFrame(follow);
}

document.getElementById('item-turn').addEventListener('click', () => turnItem(getSelected()));
document.getElementById('item-smaller').addEventListener('click', () => resizeItem(getSelected(), 1 / 1.2));
document.getElementById('item-bigger').addEventListener('click', () => resizeItem(getSelected(), 1.2));
document.getElementById('item-copy').addEventListener('click', () => { sfx.pop(0); copyItem(getSelected()); });
document.getElementById('item-delete').addEventListener('click', () => { sfx.bloop(); deleteItem(getSelected()); });
document.addEventListener('keydown', e => {
  if (getSelected() == null || shop.open) return;
  if (e.key === 'Escape') select(null);
  if (e.key === 'Delete' || e.key === 'Backspace') { sfx.bloop(); deleteItem(getSelected()); }
  if (e.key === 'r' || e.key === 'R') turnItem(getSelected());
  if (e.key === '+' || e.key === '=') resizeItem(getSelected(), 1.2);
  if (e.key === '-' || e.key === '_') resizeItem(getSelected(), 1 / 1.2);
});
