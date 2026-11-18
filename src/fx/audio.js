

// ---------------------------------------------------------------------------
// Sound: tiny synthesized effects, no audio files. Browsers only allow audio
// after the first click or key press, so nothing plays before that.
// ---------------------------------------------------------------------------
export let audioCtx = null, soundOn = true, userActed = false;
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { userActed = true; }, { once: true, capture: true }));

export function audio() {
  if (!soundOn || !userActed) return null;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

export function tone({ from = 600, to = from, dur = 0.12, type = 'sine', gain = 0.12, delay = 0 }) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator(), amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const sfx = {
  pop: i => { const f = 480 + Math.random() * 260; tone({ from: f, to: f * 1.9, dur: 0.09, delay: i * 0.06 }); },
  bloop: () => tone({ from: 520, to: 150, dur: 0.16, gain: 0.1 }),
  click: () => tone({ from: 900, to: 650, dur: 0.04, type: 'triangle', gain: 0.05 }),
  whoosh: () => tone({ from: 180, to: 520, dur: 0.35, type: 'triangle', gain: 0.05 }),
  shutter: () => { tone({ from: 1400, to: 300, dur: 0.05, type: 'square', gain: 0.04 }); tone({ from: 900, to: 200, dur: 0.06, type: 'square', gain: 0.03, delay: 0.07 }); },
  chime: () => [523, 659, 784, 1047].forEach((f, i) => tone({ from: f, dur: 0.4, type: 'triangle', gain: 0.07, delay: i * 0.09 })),
};

// A soft click for every control in the panel.
document.getElementById('panel').addEventListener('click', e => { if (e.target.closest('button')) sfx.click(); });

export const soundBtn = document.getElementById('act-sound');
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  sfx.click();
});
