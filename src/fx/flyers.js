import { reducedMotion } from '../config.js';

// ---------------------------------------------------------------------------
// Now and then a pair of birds or a hot-air balloon drifts slowly across the
// sky, far behind the island. Plain SVG in the background layer.
// ---------------------------------------------------------------------------
const layer = document.getElementById('flyers');

const BIRDS = `<svg class="bird" viewBox="0 0 34 14"><path d="M2 8 Q8 2 12 8"/><path d="M12 8 Q16 2 22 8"/></svg>`;
const BALLOON = `<svg class="balloon" viewBox="0 0 46 70">
  <path d="M23 2 C 8 2 2 14 2 24 C 2 36 14 44 19 50 H27 C 32 44 44 36 44 24 C 44 14 38 2 23 2Z" fill="#f7a8b8"/>
  <path d="M23 2 C 16 6 14 16 14 24 C 14 36 18 44 20 50 H26 C 28 44 32 36 32 24 C 32 16 30 6 23 2Z" fill="#fff3df"/>
  <path d="M23 2 C 21 10 20 18 20 26 C 20 38 21 44 22 50 H24 C 25 44 26 38 26 26 C 26 18 25 10 23 2Z" fill="#c9b8ff"/>
  <path d="M19 50 L19 58 M27 50 L27 58" stroke="#b39a84" stroke-width="1"/>
  <rect x="17" y="58" width="12" height="9" rx="2" fill="#c99a6e"/>
</svg>`;

// A small propeller plane, drawn flying to the right; the propeller spins.
const PLANE = `<svg class="plane" viewBox="0 0 80 40">
  <path d="M6 18 L2 6 H10 L18 17 Z" fill="#ef7a7a"/>
  <path d="M8 18 C 20 13 50 13 64 16 C 70 17 72 21 66 23 C 52 26 20 25 8 21 Z" fill="#fff8f0"/>
  <path d="M30 19 L22 33 H30 L42 20 Z" fill="#ef7a7a"/>
  <path d="M30 18 L26 9 H32 L40 17 Z" fill="#f7a8b8"/>
  <path d="M10 19 C 30 21 50 21 66 20" stroke="#ef7a7a" stroke-width="2" fill="none"/>
  <circle cx="50" cy="17.5" r="1.6" fill="#7fd8f2"/><circle cx="56" cy="17.5" r="1.6" fill="#7fd8f2"/>
  <path d="M60 15 C 58 13 54 13 52 15 Z" fill="#7fd8f2"/>
  <rect class="prop" x="70" y="8" width="2.2" height="24" rx="1" fill="#5d6470"/>
</svg>`;

// What flies by: mostly birds, sometimes a balloon or a plane.
function pickFlyer() {
  const r = Math.random();
  if (r < 0.25) return { html: BALLOON, kind: 'balloon', secs: [70, 100], bob: 14, height: 30 };
  if (r < 0.45) return { html: PLANE, kind: 'plane', secs: [26, 36], bob: 10, height: 28 };
  return { html: BIRDS, kind: 'birds', secs: [22, 34], bob: 22, height: 38 };
}

function launch(force) {
  const f = force ?? pickFlyer();
  const balloon = f.kind === 'balloon';
  const el = document.createElement('div');
  el.className = 'flyer';
  el.innerHTML = f.html;
  const top = 6 + Math.random() * f.height; // percent of the screen height
  el.style.top = `${top}%`;
  const ltr = Math.random() < 0.6;
  const w = window.innerWidth;
  const from = ltr ? -80 : w + 80, to = ltr ? w + 80 : -80;
  const seconds = f.secs[0] + Math.random() * (f.secs[1] - f.secs[0]);
  if (!ltr && !balloon) el.style.scale = '-1 1'; // birds and planes face where they go
  layer.appendChild(el);
  const bob = f.bob;
  const anim = el.animate([
    { transform: `translate(${from}px, 0)` },
    { transform: `translate(${(from + to) / 2}px, ${-bob}px)`, offset: 0.5 },
    { transform: `translate(${to}px, 0)` },
  ], { duration: seconds * 1000, easing: 'linear' });
  anim.onfinish = () => el.remove();
}

function schedule(delay) {
  setTimeout(() => {
    if (!document.hidden && layer.childElementCount < 2) launch();
    schedule(25000 + Math.random() * 35000);
  }, delay);
}

if (!reducedMotion) schedule(4000 + Math.random() * 6000);

// ?flyers in the address sends a bird pair and a balloon right away (for testing).
if (new URLSearchParams(location.search).has('flyers')) {
  launch({ html: PLANE, kind: 'plane', secs: [26, 26], bob: 10, height: 20 });
  setTimeout(() => launch({ html: BALLOON, kind: 'balloon', secs: [70, 70], bob: 14, height: 30 }), 300);
}
