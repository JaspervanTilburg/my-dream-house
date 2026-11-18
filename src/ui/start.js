import gsap from 'gsap';
import { reducedMotion } from '../config.js';
import { clouds } from '../fx/ambient.js';
import { sfx } from '../fx/audio.js';
import { fitCamera, placeCamera, setStartFrame, view } from '../scene.js';

// ---------------------------------------------------------------------------
// Start screen: the title over the real scene, which slowly turns in the
// background. Start swings the view back to the front and brings in the controls.
// ---------------------------------------------------------------------------
const screen = document.getElementById('start');
const go = document.getElementById('start-go');
let starting = document.body.classList.contains('starting');

export const isStarting = () => starting;

function setAngle(a) {
  view.angle = a;
  placeCamera();
  clouds.rotation.y = a;
}

// Called every frame by the render loop while the start screen shows.
export function startTick(dt) {
  if (!starting || reducedMotion) return;
  setAngle(view.angle + dt * 0.18);
  fitCamera(false);
}

function finish(animate) {
  starting = false;
  document.body.classList.remove('starting');
  if (!animate) {
    screen.hidden = true;
    setStartFrame(0);
    setAngle(0);
    fitCamera(false);
    return;
  }
  screen.classList.add('leaving');
  setTimeout(() => { screen.hidden = true; }, 600);
  // Swing forward to the next full turn, so it ends on the usual front view.
  const turn = Math.PI * 2;
  const blend = { frame: 1, angle: view.angle };
  gsap.to(blend, {
    frame: 0, angle: reducedMotion ? view.angle : Math.ceil(view.angle / turn) * turn,
    duration: 1.2, ease: 'power3.inOut',
    onUpdate: () => { setStartFrame(blend.frame); setAngle(blend.angle); fitCamera(false); },
    onComplete: () => setAngle(0),
  });
}

go.addEventListener('click', () => {
  if (!starting) return;
  sfx.chime();
  finish(true);
});

// Tests (and anyone who adds ?skipstart to the address) go straight to the game.
const params = new URLSearchParams(location.search);
if (starting && (params.has('debug') || params.has('skipstart'))) finish(false);
else if (starting) {
  setAngle(-0.7);
  go.focus({ preventScroll: true });
}
