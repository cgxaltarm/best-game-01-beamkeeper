// BEAMKEEPER — WebAudio synth only, no audio files. Every sound is a few
// oscillators / filtered noise bursts. Safe no-op when AudioContext is
// unavailable (headless tests) or muted.
let ctx = null;
let muted = false;
let humNodes = null;

export function setMuted(m) { muted = m; if (m) stopHum(); }
export function isMuted() { return muted; }

function ac() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch { return null; }
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch { /* audio is cosmetic */ }
}

function noise(dur, vol = 0.1, freq = 1200, delay = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
  } catch { /* audio is cosmetic */ }
}

export function startHum() {
  if (muted || humNodes) return;
  const c = ac();
  if (!c) return;
  try {
    const o = c.createOscillator();
    o.type = 'sine'; o.frequency.value = 55;
    const g = c.createGain();
    g.gain.value = 0.018;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.4;
    const lg = c.createGain();
    lg.gain.value = 0.008;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(c.destination);
    o.start(); lfo.start();
    humNodes = { o, lfo, g };
  } catch { humNodes = null; }
}
export function stopHum() {
  if (!humNodes) return;
  try { humNodes.o.stop(); humNodes.lfo.stop(); } catch { /* already stopped */ }
  humNodes = null;
}

export const sfx = {
  click() { tone(660, 0.06, 'triangle', 0.08); },
  place() { tone(440, 0.09, 'triangle', 0.1); tone(660, 0.12, 'triangle', 0.08, null, 0.05); },
  sell() { tone(520, 0.08, 'triangle', 0.08, 300); },
  kill() { tone(880, 0.12, 'sine', 0.09, 1320); },
  burn() { noise(0.18, 0.05, 2400); },
  flare() { tone(180, 0.5, 'sawtooth', 0.14, 60); noise(0.5, 0.12, 500); },
  horn() { tone(196, 0.7, 'sawtooth', 0.1, 185); tone(294, 0.7, 'sawtooth', 0.07, 277, 0.05); },
  relic() { tone(523, 0.15, 'sine', 0.1); tone(784, 0.2, 'sine', 0.1, null, 0.1); tone(1046, 0.3, 'sine', 0.08, null, 0.2); },
  leak() { tone(220, 0.3, 'square', 0.09, 110); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'sine', 0.1, null, i * 0.14)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.09, null, i * 0.16)); },
};
