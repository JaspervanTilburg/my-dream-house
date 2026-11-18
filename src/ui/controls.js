import { STYLES, SWATCHES, state } from '../config.js';
import { MAX_F, MAX_W, addColumn, addFloor, describe, removeColumn, removeFloor } from '../layout.js';
import { fitCamera } from '../scene.js';
import { update } from '../world.js';

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
export function syncControls() {
  // Rooms shows how wide the house is, Floors how tall its tallest part is.
  const d = describe(state.cells);
  const shown = { rooms: [d.width, MAX_W, removeColumn, addColumn], floors: [d.height, MAX_F, removeFloor, addFloor] };
  for (const [key, [value, max, minus, plus]] of Object.entries(shown)) {
    document.getElementById(`${key}-value`).textContent = value;
    document.getElementById(`${key}-minus`).disabled = !minus(state.cells);
    document.getElementById(`${key}-plus`).disabled = value >= max || !plus(state.cells);
  }
  Object.keys(SWATCHES).forEach(key => {
    document.querySelectorAll(`#${key}-swatches .swatch`).forEach(b =>
      b.setAttribute('aria-checked', String(b.dataset.color === state[key])));
  });
  document.querySelectorAll('#style-chips .chip').forEach(b =>
    b.setAttribute('aria-checked', String(b.dataset.style === state.style)));
  ['size', 'height', 'greenery'].forEach(key => { document.getElementById(key).value = state[key]; });
  document.getElementById('fence').setAttribute('aria-checked', String(!!state.extras.fence));
}

// Phone tabs: one group of controls at a time; the camera refits to the new panel height.
export const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    document.getElementById(t.getAttribute('aria-controls')).classList.toggle('active', on);
  });
  requestAnimationFrame(() => fitCamera(true));
}));

document.getElementById('fence').addEventListener('click', () => {
  state.extras = { ...state.extras, fence: !state.extras.fence };
  syncControls();
  update();
});

// Style chips: picking a style also applies its suggested colors.
export const chipGroup = document.getElementById('style-chips');
Object.entries(STYLES).forEach(([key, st]) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.id = `style-${key}`;
  b.dataset.style = key;
  b.setAttribute('role', 'radio');
  b.textContent = st.label;
  b.addEventListener('click', () => {
    if (state.style === key) return;
    Object.assign(state, { style: key, wallColor: st.wall, roofColor: st.roofColor });
    syncControls();
    update();
  });
  chipGroup.appendChild(b);
});

// Sliders fire many events while dragging; update at most every 120 ms.
export let lastUpdate = 0, queued = null;
export function requestUpdate() {
  const wait = 120 - (performance.now() - lastUpdate);
  if (wait <= 0) {
    lastUpdate = performance.now();
    update();
  } else if (!queued) {
    queued = setTimeout(() => { queued = null; lastUpdate = performance.now(); update(); }, wait);
  }
}

document.querySelectorAll('input[type="range"]').forEach(input => {
  input.addEventListener('input', () => {
    state[input.dataset.key] = Number(input.value);
    requestUpdate();
  });
});

Object.entries(SWATCHES).forEach(([key, list]) => {
  const group = document.getElementById(`${key}-swatches`);
  list.forEach(([color, name]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.id = `${key}-${name.toLowerCase().replace(/\s+/g, '-')}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', name);
    b.dataset.color = color;
    b.style.background = color;
    b.addEventListener('click', () => {
      state[key] = color;
      syncControls();
      update();
    });
    group.appendChild(b);
  });
});


document.querySelectorAll('.stepper button').forEach(btn => {
  btn.addEventListener('click', () => {
    // Whole-house shortcuts: a room on every floor, or a floor on every column.
    const { key, step } = btn.dataset;
    const op = { rooms: [removeColumn, addColumn], floors: [removeFloor, addFloor] }[key][step > 0 ? 1 : 0];
    const next = op(state.cells);
    if (!next) return;
    state.cells = next;
    syncControls();
    update();
  });
});
