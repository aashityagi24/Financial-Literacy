import confetti from 'canvas-confetti';

const MUTE_KEY = 'coinquest_mute';
const MUTE_EVENT = 'coinquest-mute-change';

export const isMuted = () => {
  try { return localStorage.getItem(MUTE_KEY) === 'true'; } catch { return false; }
};

export const setMuted = (val) => {
  try { localStorage.setItem(MUTE_KEY, val ? 'true' : 'false'); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(MUTE_EVENT, { detail: { muted: !!val } }));
};

export const MUTE_CHANGE_EVENT = MUTE_EVENT;

let audioCtx = null;
const playChime = () => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    // Cheerful ascending "ta-da" arpeggio: C5 E5 G5 C6
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + i * 0.11;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  } catch { /* audio not supported */ }
};

const COLORS = ['#FFD23F', '#EE6C4D', '#06D6A0', '#3D5A80', '#9B5DE5', '#EC4899'];

const fireConfetti = () => {
  try {
    confetti({ particleCount: 130, spread: 75, startVelocity: 45, origin: { y: 0.6 }, colors: COLORS });
    setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS }), 150);
    setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS }), 300);
  } catch { /* confetti not supported */ }
};

// Fire a big-win celebration: confetti always, sound unless muted.
export const playCelebration = () => {
  fireConfetti();
  if (!isMuted()) playChime();
};
