// Sound, synthesized live with WebAudio — no audio files. Engine hum follows
// the car's speed, sirens wail in two tones, gunshots are noise bursts, and
// pickups and missions get little jingles. Everything starts on the first
// user gesture, as browsers require.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    muted: false,
    noiseBuf: null,
  };
}

function ensure(audio) {
  if (audio.ctx) return true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    // One shared noise buffer for gunshots, skids and explosions.
    const len = audio.ctx.sampleRate * 0.5;
    audio.noiseBuf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = audio.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    // Engine: a sawtooth through a lowpass, gain by speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 60;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    // Siren: a triangle that alternates two notes.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 700;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
    return true;
  } catch {
    return false;
  }
}

export function unlockAudio(audio) {
  if (ensure(audio) && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
}

export function setEngine(audio, speed01, on) {
  if (!audio.ctx) return;
  audio.engineOsc.frequency.value = 55 + speed01 * 130;
  audio.engineGain.gain.value = on && !audio.muted ? 0.05 + speed01 * 0.06 : 0;
}

export function setSiren(audio, on, time) {
  if (!audio.ctx) return;
  audio.sirenGain.gain.value = on && !audio.muted ? 0.035 : 0;
  if (on) audio.sirenOsc.frequency.value = Math.floor(time * 2.4) % 2 === 0 ? 720 : 960;
}

function blip(audio, freq, dur, type, vol, when) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime + (when || 0);
  const osc = audio.ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(audio, dur, freq, vol) {
  if (!audio.ctx || audio.muted) return;
  const src = audio.ctx.createBufferSource();
  src.buffer = audio.noiseBuf;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const gain = audio.ctx.createGain();
  gain.gain.setValueAtTime(vol, audio.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start();
  src.stop(audio.ctx.currentTime + dur);
}

export function playGunshot(audio) {
  noiseBurst(audio, 0.14, 1800, 0.35);
  blip(audio, 140, 0.1, 'square', 0.12);
}

export function playPunch(audio) {
  noiseBurst(audio, 0.08, 500, 0.25);
}

export function playPickup(audio) {
  blip(audio, 660, 0.09, 'sine', 0.15);
  blip(audio, 990, 0.12, 'sine', 0.15, 0.08);
}

export function playCrash(audio, hard) {
  noiseBurst(audio, hard ? 0.3 : 0.12, 700, hard ? 0.4 : 0.2);
}

export function playExplosion(audio) {
  noiseBurst(audio, 0.7, 300, 0.5);
  blip(audio, 60, 0.5, 'sine', 0.3);
}

export function playMissionComplete(audio) {
  blip(audio, 523, 0.12, 'sine', 0.18);
  blip(audio, 659, 0.12, 'sine', 0.18, 0.11);
  blip(audio, 784, 0.2, 'sine', 0.2, 0.22);
}

export function playClick(audio) {
  blip(audio, 440, 0.06, 'sine', 0.1);
}

export function playBusted(audio) {
  blip(audio, 330, 0.25, 'square', 0.12);
  blip(audio, 220, 0.4, 'square', 0.12, 0.22);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
}
