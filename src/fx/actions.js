import gsap from 'gsap';
import { HOME, STYLES, SWATCHES, reducedMotion, state } from '../config.js';
import { describe, randomLayout } from '../layout.js';
import { frontsFor, roofExtrasFor } from '../fronts.js';
import { clouds } from '../fx/ambient.js';
import { sfx } from '../fx/audio.js';
import { camera, computeFrustum, fitCamera, placeCamera, renderer, scene, view } from '../scene.js';
import { syncControls } from '../ui/controls.js';
import { hop, update } from '../world.js';
import { select } from '../items.js';
import { setWater } from '../waterdata.js';
import { setNight } from './night.js';
import { resetZoom } from '../scene.js';

// Reset: back to a plain starting scene. A one-room cottage, tall walls, no
// greenery, no water and an empty garden.
document.getElementById('act-reset').addEventListener('click', () => {
  sfx.whoosh();
  select(null);
  const st = STYLES.cottage;
  Object.assign(state, {
    style: 'cottage', cells: ['0,0'], doorCol: null,
    fronts: {}, sides: { '0,0,right': 'window' }, roofs: {},
    size: 1.05, height: 1.4, greenery: 0,
    wallColor: st.wall, roofColor: st.roofColor,
    extras: { fence: false }, items: [],
  });
  setWater([]);
  setNight(false);
  syncControls();
  update();
  resetZoom();
});

// ---------------------------------------------------------------------------
// Actions: surprise me, rotate, celebrate, postcard
// ---------------------------------------------------------------------------
export const pick = list => list[Math.floor(Math.random() * list.length)];
export const between05 = (min, max) => Math.round((min + Math.random() * (max - min)) * 20) / 20;

document.getElementById('act-random').addEventListener('click', () => {
  const style = pick(Object.keys(STYLES));
  const st = STYLES[style];
  Object.assign(state, {
    style,
    cells: randomLayout(),
    doorCol: null,
    fronts: {},
    sides: {},
    roofs: {},
    size: between05(0.85, 1.2),
    height: between05(0.85, 1.25),
    greenery: between05(0.2, 1),
    extras: { fence: Math.random() < 0.5 }, // her garden items stay where she put them
    wallColor: Math.random() < 0.5 ? st.wall : pick(SWATCHES.wallColor)[0],
    roofColor: Math.random() < 0.5 ? st.roofColor : pick(SWATCHES.roofColor)[0],
  });
  // A few random fronts and roof extras, so every surprise looks different.
  const d = describe(state.cells);
  const fronts = {}, roofs = {};
  for (const k of d.set) {
    const f = Number(k.split(',')[1]);
    if (Math.random() < 0.4) fronts[k] = pick(frontsFor(f).filter(t => t !== 'door'));
  }
  for (const c of Object.keys(d.columns)) {
    if (Math.random() < 0.35) roofs[c] = pick(roofExtrasFor(STYLES[style].roof).filter(t => t !== 'plain'));
  }
  Object.assign(state, { fronts, roofs });
  syncControls();
  update();
});

document.getElementById('act-rotate').addEventListener('click', () => {
  sfx.whoosh();
  const to = Math.round(view.angle / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 2;
  gsap.to(view, {
    angle: to, duration: 0.9, ease: 'power2.inOut',
    onUpdate: () => { placeCamera(); clouds.rotation.y = view.angle; fitCamera(false); },
  });
});

// Confetti on a 2D canvas over the scene.
export const confettiCanvas = document.getElementById('confetti');
export const cctx = confettiCanvas.getContext('2d');
export let confetti = [];
export function burstConfetti() {
  if (reducedMotion) return;
  const dpr = Math.min(window.devicePixelRatio, 2);
  confettiCanvas.width = window.innerWidth * dpr;
  confettiCanvas.height = window.innerHeight * dpr;
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#b98af0', '#ffd36e', '#f9b8c4', '#a8e6c8', '#a9d4f5', '#e06a9a', '#ffffff'];
  const start = !confetti.length;
  for (let i = 0; i < 160; i++) {
    const fromLeft = i % 2 === 0;
    confetti.push({
      x: fromLeft ? -10 : window.innerWidth + 10, y: window.innerHeight * 0.75,
      vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 8), vy: -(9 + Math.random() * 9),
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      color: pick(colors), life: 0,
    });
  }
  if (start) requestAnimationFrame(drawConfetti);
}
export function drawConfetti() {
  cctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  confetti = confetti.filter(c => c.y < window.innerHeight + 40 && c.life < 260);
  confetti.forEach(c => {
    c.life++;
    c.vy += 0.32;
    c.vx *= 0.99;
    c.x += c.vx; c.y += c.vy; c.rot += c.vr;
    cctx.save();
    cctx.translate(c.x, c.y);
    cctx.rotate(c.rot);
    cctx.fillStyle = c.color;
    cctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * Math.abs(Math.cos(c.life * 0.15)));
    cctx.restore();
  });
  if (confetti.length) requestAnimationFrame(drawConfetti);
  else cctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

document.getElementById('act-done').addEventListener('click', () => {
  sfx.chime();
  burstConfetti();
  hop();
});

// Postcard: render the scene once at a fixed size, then frame it with a title.
export const postcard = document.getElementById('postcard');
document.getElementById('postcard-close').addEventListener('click', () => postcard.close());

document.getElementById('act-postcard').addEventListener('click', async () => {
  await document.fonts?.ready;
  sfx.shutter();
  const W = 1200, H = 800, IMG_TOP = 120;
  const savedFrustum = { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom };
  gsap.killTweensOf(camera);
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  Object.assign(camera, computeFrustum(W, H, { x0: 60, x1: W - 60, y0: IMG_TOP + 30, y1: H - 50 }));
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H);
  if (state.night) {
    sky.addColorStop(0, '#1d2350'); sky.addColorStop(0.6, '#3b3f7a'); sky.addColorStop(1, '#6b5a8e');
  } else {
    sky.addColorStop(0, '#cdeee3'); sky.addColorStop(0.55, '#e7f7ef'); sky.addColorStop(1, '#fbf3dc');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.drawImage(renderer.domElement, 0, 0, W, H);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  Object.assign(camera, savedFrustum);
  camera.updateProjectionMatrix();

  g.fillStyle = state.night ? '#fff8f0' : '#3d2f4f';
  g.font = '800 64px "Baloo 2", "Trebuchet MS", sans-serif';
  g.fillText(HOME.names, 60, 100);
  g.fillStyle = state.night ? '#d9d2f2' : '#7a6a8c';
  g.font = '700 26px Nunito, system-ui, sans-serif';
  const rooms = state.cells.length, floors = describe(state.cells).height;
  const details = `${STYLES[state.style].label} · ${rooms} room${rooms > 1 ? 's' : ''} · ${floors} floor${floors > 1 ? 's' : ''}${Object.values(state.fronts).includes('garage') ? ' · garage' : ''}`;
  g.fillText(details, 64, 142);
  g.textAlign = 'right';
  g.font = '700 20px Nunito, system-ui, sans-serif';
  g.fillText(new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), W - 40, H - 30);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 24;
  g.strokeRect(0, 0, W, H);

  const url = out.toDataURL('image/png');
  document.getElementById('postcard-img').src = url;
  postcard.showModal();
});
