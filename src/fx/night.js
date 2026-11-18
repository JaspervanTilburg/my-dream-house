import * as THREE from 'three';
import gsap from 'gsap';
import { reducedMotion, state } from '../config.js';
import { matCache, sharedGeometries } from '../helpers.js';
import { glassMat } from '../house.js';
import { dragZones } from '../props.js';
import { skyLight, sun } from '../scene.js';
import { world } from '../world.js';
import { cloudMat } from './ambient.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------------------
// Evening mode. One number, `mix.t`, goes from 0 (day) to 1 (night); every
// frame the lights, the window glass, the lamps and the sky follow it.
// ---------------------------------------------------------------------------
const mix = { t: 0 };
const C = hex => new THREE.Color(hex);
const DAY = {
  sky: C('#fff6ff'), ground: C('#a9d98a'), skyI: 1.9, sun: C('#fff1dc'), sunI: 2.3,
  glass: C('#7fd8f2'), glow: C('#2d7f99'), glowI: 0.18,
};
const NIGHT = {
  sky: C('#b4bcf0'), ground: C('#3a4866'), skyI: 1.0, sun: C('#c9d2ff'), sunI: 0.75,
  glass: C('#ffe39a'), glow: C('#ffb347'), glowI: 1.15,
};
// Lamps, lanterns and fires use these warm glow colors (see mat() calls).
const WARM = new Set(['ffd36e', 'ff9f43']);
const nightSky = document.getElementById('night-sky');
const btn = document.getElementById('act-night');

const lerp = (a, b, t) => a + (b - a) * t;
let shown = -1;
function apply(t) {
  skyLight.color.copy(DAY.sky).lerp(NIGHT.sky, t);
  skyLight.groundColor.copy(DAY.ground).lerp(NIGHT.ground, t);
  skyLight.intensity = lerp(DAY.skyI, NIGHT.skyI, t);
  sun.color.copy(DAY.sun).lerp(NIGHT.sun, t);
  sun.intensity = lerp(DAY.sunI, NIGHT.sunI, t);
  const g = glassMat(); // shared by every window, so this lights them all
  g.color.copy(DAY.glass).lerp(NIGHT.glass, t);
  g.emissive.copy(DAY.glow).lerp(NIGHT.glow, t);
  g.emissiveIntensity = lerp(DAY.glowI, NIGHT.glowI, t);
  for (const m of matCache.values()) {
    if (!m.emissive || !WARM.has(m.emissive.getHexString())) continue;
    m.userData.baseGlow ??= m.emissiveIntensity;
    m.emissiveIntensity = m.userData.baseGlow * (1 + 1.8 * t);
  }
  cloudMat.emissiveIntensity = lerp(0.25, 0.02, t);
  nightSky.style.opacity = String(t);
  document.documentElement.style.setProperty('--night', t.toFixed(3));
  shown = t;
}

export function setNight(on, animate = true) {
  state.night = on;
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Switch to day' : 'Switch to evening');
  gsap.killTweensOf(mix);
  if (animate && !reducedMotion) gsap.to(mix, { t: on ? 1 : 0, duration: 1.4, ease: 'power2.inOut' });
  else mix.t = on ? 1 : 0;
}

btn.addEventListener('click', () => {
  sfx.whoosh();
  setNight(!state.night);
});

// Fireflies: tiny glowing dots that drift over the lawn after dark.
const flyGeo = new THREE.SphereGeometry(0.05, 8, 6);
sharedGeometries.add(flyGeo);
const flies = Array.from({ length: 16 }, (_, i) => {
  const m = new THREE.Mesh(flyGeo, new THREE.MeshBasicMaterial({ color: '#fff4a3', transparent: true, opacity: 0 }));
  m.userData = { u: Math.sin(i * 12.9) * 0.85, v: Math.cos(i * 7.3) * 0.85, phase: i * 1.7, h: 0.4 + (i % 5) * 0.25 };
  m.visible = false;
  world.add(m);
  return m;
});

// Called by the render loop.
export function nightTick(time) {
  // New lamps keep appearing (garden items), so re-apply while it is dark.
  if (mix.t !== shown || mix.t > 0) apply(mix.t);
  const { hx, hz } = dragZones;
  for (const f of flies) {
    const d = f.userData;
    f.visible = mix.t > 0.05;
    if (!f.visible) continue;
    const drift = reducedMotion ? 0 : time;
    f.position.set(d.u * hx + Math.sin(drift * 0.4 + d.phase) * 0.6, d.h + Math.sin(drift * 1.3 + d.phase) * 0.15,
      d.v * hz + Math.cos(drift * 0.3 + d.phase) * 0.6);
    f.material.opacity = mix.t * (0.45 + 0.55 * Math.max(0, Math.sin(drift * 2.2 + d.phase * 3)));
  }
}

export const nightAmount = () => mix.t;
