// My Dream House: entry point. Importing a module runs its setup; the ones
// below without names only register their buttons and listeners.
import './styles.css';
import './fx/audio.js';
import './fx/actions.js';
import './drag.js';
import './ui/shop.js';
import './ui/zoom.js';
import './ui/panel.js';
import './fx/flyers.js';
import { redrawWater, waterTick } from './water.js';
import { setWater } from './waterdata.js';
import { setupStart, startTick } from './ui/start.js';
import { resetState } from './fx/actions.js';
import { nightTick, setNight } from './fx/night.js';
import { DEFAULT_ITEMS } from './catalog.js';
import { select } from './items.js';
import { loadDesign } from './storage.js';
import * as THREE from 'three';
import gsap from 'gsap';
import { STYLES, reducedMotion, state } from './config.js';
import { MAX_F, MAX_W, describe, isValid, rectangle } from './layout.js';
import { clouds, puffSmoke } from './fx/ambient.js';
import { propsReady } from './props.js';
import { camera, fitCamera, renderer, scene } from './scene.js';
import { syncControls } from './ui/controls.js';
import { getHouse, live, update, world } from './world.js';

// Test hook: with ?debug in the address, automated tests can find things on screen.
// ?test does the same but keeps the start screen.
if (['debug', 'test'].some(k => new URLSearchParams(location.search).has(k))) window.__dreamHouse = { live, camera, world, state, gsap, house: getHouse, fitCamera };

// "Clear all items" removes every shop item (the mailbox too; it is in the Sets tab).
document.getElementById('reset-garden').addEventListener('click', () => {
  select(null);
  state.items = [];
  update();
});

// Start from the default garden, then whatever she saved last time.
// The design from the last visit, or the basic house on a first visit (the
// app saves every change by itself, so there is no save button).
state.items = DEFAULT_ITEMS.map(it => ({ ...it }));
const returning = loadDesign();
if (!returning) resetState();
setupStart(returning);

// Optional start values from the address, e.g. index.html?rooms=4&floors=3
const params = new URLSearchParams(location.search);
// ?rooms=4&floors=3 starts with a plain rectangle; ?cells=0,0;1,0;1,1 with any shape.
if (params.has('rooms') || params.has('floors')) {
  const d = describe(state.cells);
  const clamp = (v, max, fallback) => Math.min(max, Math.max(1, Math.round(Number(v)) || fallback));
  state.cells = rectangle(clamp(params.get('rooms'), MAX_W, d.width), clamp(params.get('floors'), MAX_F, d.height));
}
if (params.has('cells')) {
  const cells = params.get('cells').split(';');
  if (isValid(cells)) state.cells = cells;
}
['size', 'height', 'greenery'].forEach(key => {
  const raw = params.get(key);
  if (raw !== null && raw !== '' && !Number.isNaN(Number(raw))) state[key] = Number(raw);
  document.getElementById(key).value = state[key];
});
// ?extras=picnic,bench,veggies,fence: start with those sets (and the fence).
if (params.has('extras')) {
  const on = params.get('extras').split(',');
  state.extras = { fence: on.includes('fence') };
  const sets = ['picnic', 'bench', 'veggies'].filter(t => on.includes(t));
  state.items = ['mailbox', ...sets].map((type, i) => ({ id: i + 1, type, u: null, v: null, rot: 0 }));
}
const styleParam = params.get('style');
if (STYLES[styleParam]) {
  Object.assign(state, { style: styleParam, wallColor: STYLES[styleParam].wall, roofColor: STYLES[styleParam].roofColor });
}
// ?fronts=0,0:garage;1,1:balcony, ?sides=1,0,right:awning and ?roofs=0:dormer;1:chimney
for (const [name, field] of [['fronts', 'fronts'], ['sides', 'sides'], ['roofs', 'roofs']]) {
  if (!params.has(name)) continue;
  state[field] = Object.fromEntries(params.get(name).split(';').map(p => p.split(':')).filter(p => p.length === 2));
}

syncControls();
update(false);
document.fonts?.ready.then(() => fitCamera(false));
if (params.get('night') === '1') state.night = true;
setNight(state.night, false);
setWater(state.water ?? []);
redrawWater();
propsReady.then(() => update(false)); // garden props pop in once their files have loaded

const clock = new THREE.Clock();
let smokeTimer = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  startTick(dt);
  nightTick(t);
  waterTick(t, dt);
  if (!reducedMotion) {
    clouds.children.forEach(c => {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 22) c.position.x = -22;
    });
    smokeTimer += dt;
    if (smokeTimer > 0.55) { smokeTimer = 0; puffSmoke(); }
    world.position.y = Math.sin(t * 0.8) * 0.06;
    for (const { obj } of live.values()) {
      const phase = obj.userData.sway;
      if (phase == null) continue;
      obj.rotation.z = Math.sin(t * 1.3 + phase) * 0.025;
      obj.rotation.x = Math.cos(t * 1.1 + phase) * 0.015;
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
