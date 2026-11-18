import { sfx } from '../fx/audio.js';
import { select, toast } from '../items.js';
import { update } from '../world.js';
import { clearWater } from '../waterdata.js';

// ---------------------------------------------------------------------------
// The water brush: Paint water / Remove water. While one is on, dragging over
// the garden paints (or wipes) water instead of moving things around.
// ---------------------------------------------------------------------------
const paintBtn = document.getElementById('water-paint');
const eraseBtn = document.getElementById('water-erase');
let tool = null; // null, 'paint' or 'erase'

export const getWaterTool = () => tool;

export function setWaterTool(next) {
  tool = next;
  paintBtn.setAttribute('aria-pressed', String(tool === 'paint'));
  eraseBtn.setAttribute('aria-pressed', String(tool === 'erase'));
  document.body.classList.toggle('brushing', !!tool);
  if (tool) select(null);
}

paintBtn.addEventListener('click', () => {
  setWaterTool(tool === 'paint' ? null : 'paint');
  if (tool) toast('Drag over the garden to paint water. Run it off an edge for a waterfall.');
});
eraseBtn.addEventListener('click', () => {
  setWaterTool(tool === 'erase' ? null : 'erase');
  if (tool) toast('Drag over water to remove it.');
});
document.getElementById('water-clear').addEventListener('click', () => {
  sfx.bloop();
  clearWater();
  update(false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && tool) setWaterTool(null); });
