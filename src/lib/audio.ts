"use client";

// Fully procedural ambient score — zero audio assets shipped, no licensed or
// sampled music. Deep space drone, a sustained open-fifth pad, minimal
// detuned strings, sparse slow piano motifs through a long reverb tail, and a
// filtered brown-noise texture bed. No percussion anywhere. A master gain
// implements mute, volume and — deliberately — hard silence: the Threshold
// cut and the beat before each closing line are true zero, not a duck.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let droneGain: GainNode | null = null;
let organGain: GainNode | null = null;
let organFilter: BiquadFilterNode | null = null;
let stringsGain: GainNode | null = null;
let rumbleGain: GainNode | null = null;
let swellGain: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let reverbReturn: GainNode | null = null;
let tensionGain: GainNode | null = null;
let tensionOsc: OscillatorNode | null = null;
let tensionOsc2: OscillatorNode | null = null;
let started = false;
let muted = false;
let volume = 0.7;
let cut = false;

// The soundtrack crossfades continuously across the phases — one bed, five
// moods. Nothing stops (except when silence is the point); voices lean
// forward and recede.
export type SceneName = "void" | "crossing" | "threshold" | "archive" | "return";
let scene: SceneName = "void";
let motifTimer: number | null = null;

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0; // silent until unmuted
  master.connect(ctx.destination);
  return ctx;
}

function makeBrownNoise(c: AudioContext): AudioBufferSourceNode {
  const len = c.sampleRate * 4;
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

// A long, dark hall: exponentially decaying noise, slightly different in each
// ear, rolled off toward the tail — the reverb every piano note falls into.
function makeImpulse(c: AudioContext, seconds = 3.6): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buffer = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const white = Math.random() * 2 - 1;
      lp = lp * 0.82 + white * 0.18; // darkening as it decays
      data[i] = (white * (1 - t) + lp * t) * Math.pow(1 - t, 2.4) * (0.6 + 0.4 * Math.exp(-t * 6));
    }
  }
  return buffer;
}

/** Start the ambient bed. Must be called from a user gesture. */
export function startAmbient() {
  if (started) return;
  const c = ensureContext();
  if (c.state === "suspended") void c.resume();
  started = true;

  // ── Reverb return (shared by piano, plucks, thread tones) ──
  reverb = c.createConvolver();
  reverb.buffer = makeImpulse(c);
  reverbReturn = c.createGain();
  reverbReturn.gain.value = 0.55;
  reverb.connect(reverbReturn).connect(master!);

  // ── Drone: three detuned sines around a very low A ──
  droneGain = c.createGain();
  droneGain.gain.value = 0.05;
  const droneFilter = c.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 220;
  droneGain.connect(droneFilter).connect(master!);

  [55, 55.35, 82.4, 110.2].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = i % 2 === 0 ? "sine" : "triangle";
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = i < 2 ? 0.5 : 0.18;
    osc.connect(g).connect(droneGain!);
    osc.start();
  });

  const lfo = c.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.018;
  lfo.connect(lfoDepth).connect(droneGain.gain);
  lfo.start();

  // ── Pad: a sustained open-fifth chord, additive sine partials ──
  organGain = c.createGain();
  organGain.gain.value = 0.006; // barely there in space; opens in the archive
  organFilter = c.createBiquadFilter();
  organFilter.type = "lowpass";
  organFilter.frequency.value = 900;
  organGain.connect(organFilter).connect(master!);

  // A2 · E3 · A3 · E4 — open fifths, neither major nor minor
  [110, 164.81, 220, 329.63].forEach((freq, n) => {
    [1, 2].forEach((partial, pi) => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * partial * (1 + (n % 2 === 0 ? 0.0006 : -0.0006));
      const g = c.createGain();
      g.gain.value = (pi === 0 ? 0.5 : 0.16) * (n < 2 ? 1 : 0.6);
      osc.connect(g).connect(organGain!);
      osc.start();
    });
  });

  const organLfo = c.createOscillator();
  organLfo.frequency.value = 0.031;
  const organLfoDepth = c.createGain();
  organLfoDepth.gain.value = 0.007;
  organLfo.connect(organLfoDepth).connect(organGain.gain);
  organLfo.start();

  // ── Minimal strings: three detuned saws, heavily filtered, breathing ──
  stringsGain = c.createGain();
  stringsGain.gain.value = 0;
  const stringsFilter = c.createBiquadFilter();
  stringsFilter.type = "lowpass";
  stringsFilter.frequency.value = 520;
  stringsFilter.Q.value = 0.6;
  stringsGain.connect(stringsFilter).connect(master!);
  stringsGain.connect(reverb);
  [164.81, 165.3, 246.94].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = i < 2 ? 0.16 : 0.09;
    osc.connect(g).connect(stringsGain!);
    osc.start();
  });
  const bowLfo = c.createOscillator();
  bowLfo.frequency.value = 0.07;
  const bowDepth = c.createGain();
  bowDepth.gain.value = 140;
  bowLfo.connect(bowDepth).connect(stringsFilter.frequency);
  bowLfo.start();

  // ── Low rumble: brown noise through a tight lowpass ──
  rumbleGain = c.createGain();
  rumbleGain.gain.value = 0.03;
  const rumbleFilter = c.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = 90;
  const noise = makeBrownNoise(c);
  noise.connect(rumbleFilter).connect(rumbleGain).connect(master!);
  noise.start();

  // ── Swell bus (driven during the fall) ──
  swellGain = c.createGain();
  swellGain.gain.value = 0;
  const swellFilter = c.createBiquadFilter();
  swellFilter.type = "lowpass";
  swellFilter.frequency.value = 400;
  const swellNoise = makeBrownNoise(c);
  swellNoise.connect(swellFilter).connect(swellGain).connect(master!);
  swellNoise.start();

  // ── Thread tension: a held tone that rises as a light-thread pulls taut ──
  tensionGain = c.createGain();
  tensionGain.gain.value = 0;
  const tensionFilter = c.createBiquadFilter();
  tensionFilter.type = "lowpass";
  tensionFilter.frequency.value = 1400;
  tensionGain.connect(tensionFilter).connect(master!);
  tensionGain.connect(reverb);
  tensionOsc = c.createOscillator();
  tensionOsc.type = "sine";
  tensionOsc.frequency.value = 440;
  tensionOsc2 = c.createOscillator();
  tensionOsc2.type = "triangle";
  tensionOsc2.frequency.value = 660;
  const t2 = c.createGain();
  t2.gain.value = 0.25;
  tensionOsc.connect(tensionGain);
  tensionOsc2.connect(t2).connect(tensionGain);
  tensionOsc.start();
  tensionOsc2.start();

  applyMaster(0.4);
  applyScene();
}

function applyScene() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const ramp = (g: GainNode | null, v: number, tc = 1.4) => g?.gain.setTargetAtTime(v, t, tc);
  switch (scene) {
    case "void": // deep space: drone and hush
      ramp(droneGain, 0.05); ramp(organGain, 0.006); ramp(stringsGain, 0.0, 2.0); ramp(rumbleGain, 0.03);
      break;
    case "crossing": // gravity rising — the swell bus does the roaring
      ramp(droneGain, 0.06, 0.8); ramp(organGain, 0.010, 0.8); ramp(stringsGain, 0.0, 0.8); ramp(rumbleGain, 0.05, 0.8);
      break;
    case "threshold": // whatever is left before the cut; silence is done by cutAmbient
      ramp(droneGain, 0.03, 0.6); ramp(organGain, 0.004, 0.6); ramp(stringsGain, 0.0, 0.6); ramp(rumbleGain, 0.02, 0.6);
      break;
    case "archive": // warm interior: the pad opens, strings breathe underneath
      ramp(droneGain, 0.03); ramp(organGain, 0.016); ramp(stringsGain, 0.05, 3.0); ramp(rumbleGain, 0.015);
      break;
    case "return": // everything recedes toward silence, then space again
      ramp(droneGain, 0.03, 2.5); ramp(organGain, 0.004, 2.5); ramp(stringsGain, 0.0, 2.5); ramp(rumbleGain, 0.02, 2.5);
      break;
  }

  // Slow piano motifs wander a low pentatonic — archive only, and sparse.
  if (scene === "archive" && motifTimer === null) {
    const NOTES = [220, 261.63, 293.66, 329.63, 392, 440];
    const PHRASES = [[0, 2], [3, 1, 0], [4, 3], [1, 2, 4], [5, 3, 2], [2]];
    let step = 0;
    const play = () => {
      const phrase = PHRASES[step % PHRASES.length];
      phrase.forEach((n, i) => window.setTimeout(() => pianoNote(NOTES[n], 0.32 - i * 0.05), i * 1300));
      step++;
      motifTimer = window.setTimeout(play, 9000 + (step % 3) * 2600);
    };
    motifTimer = window.setTimeout(play, 6000);
  } else if (scene !== "archive" && motifTimer !== null) {
    window.clearTimeout(motifTimer);
    motifTimer = null;
  }
}

/** Crossfade the soundtrack into the mood of a journey phase. */
export function setScene(next: SceneName) {
  if (scene === next) return;
  scene = next;
  if (started) applyScene();
}

function masterTarget() {
  return muted || cut ? 0 : 0.9 * volume;
}

function applyMaster(tc = 0.4) {
  if (!ctx || !master) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(masterTarget(), ctx.currentTime, tc);
}

/** Total silence, now — not a fade. Used at the Threshold cut. */
export function cutAmbient() {
  cut = true;
  if (!ctx || !master) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(0, ctx.currentTime);
  if (motifTimer !== null) { window.clearTimeout(motifTimer); motifTimer = null; }
}

/** The bed returns from silence, softly. */
export function restoreAmbient() {
  cut = false;
  applyMaster(1.2);
}

/** A beat of true silence, then the bed comes back. */
export function silenceBeat(ms: number) {
  cutAmbient();
  window.setTimeout(restoreAmbient, ms);
}

/** Silence breaks into the first note of the Archive's bed. */
export function archiveEntrance() {
  cut = false;
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(0, now);
  master.gain.setTargetAtTime(masterTarget(), now + 0.05, 1.6);
  window.setTimeout(() => pianoNote(220, 0.42, 5.0), 120);
}

export function setMuted(v: boolean) {
  muted = v;
  if (!started && !v) startAmbient();
  applyMaster();
}

/** Master volume, 0..1. Applies smoothly and persists across mute toggles. */
export function setVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  applyMaster();
}

/** Rising roar for the fall into the black hole. intensity 0..1 */
export function setSwell(intensity: number) {
  if (!ctx || !swellGain) return;
  swellGain.gain.setTargetAtTime(intensity * 0.35, ctx.currentTime, 0.15);
}

/** Fade the swell out after the crossing. */
export function releaseSwell() {
  if (!ctx || !swellGain) return;
  swellGain.gain.setTargetAtTime(0, ctx.currentTime, 1.2);
}

/**
 * Spatial intensity, 0..1 — how near the traveller is to a room's light.
 * The pad swells and its voice opens as you approach a moment in time.
 */
export function setProximity(p: number) {
  if (!ctx || !organGain || !organFilter) return;
  const v = Math.min(1, Math.max(0, p));
  organGain.gain.setTargetAtTime(0.016 + v * 0.03, ctx.currentTime, 0.6);
  organFilter.frequency.setTargetAtTime(900 + v * 1400, ctx.currentTime, 0.6);
}

/**
 * A light-thread pulling taut: a held tone rises with the tension (0..1)
 * and falls away when the thread is released. Called every frame; cheap.
 */
export function setThreadTension(v: number, pitch = 440) {
  if (!ctx || !tensionGain || !tensionOsc || !tensionOsc2) return;
  const t = Math.min(1, Math.max(0, v));
  const now = ctx.currentTime;
  tensionGain.gain.setTargetAtTime(t * t * 0.035, now, 0.12);
  tensionOsc.frequency.setTargetAtTime(pitch * (1 + t * 0.06), now, 0.2);
  tensionOsc2.frequency.setTargetAtTime(pitch * 1.5 * (1 + t * 0.06), now, 0.2);
}

/**
 * One slow piano note: additive partials, a soft hammer, a long decay into
 * the hall. freq in Hz, vel 0..1.
 */
export function pianoNote(freq: number, vel = 0.4, dur = 3.4) {
  if (!ctx || !master || !reverb || muted || cut) return;
  const c = ctx;
  const now = c.currentTime;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  const dry = c.createGain();
  dry.gain.value = 0.7;
  const wet = c.createGain();
  wet.gain.value = 0.9;
  lp.connect(dry).connect(master);
  lp.connect(wet).connect(reverb);

  const partials = [
    { r: 1, a: 1.0 }, { r: 2.0, a: 0.42 }, { r: 3.0, a: 0.18 }, { r: 4.0, a: 0.07 },
  ];
  partials.forEach(({ r, a }, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * r * (1 + (i % 2 ? 0.0008 : -0.0006));
    const g = c.createGain();
    const peak = Math.max(0.05 * vel * a, 0.0002);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.012 + i * 0.003);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, now + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur * (1 - i * 0.12));
    osc.connect(g).connect(lp);
    osc.start(now);
    osc.stop(now + dur + 0.1);
  });
}

/** A memory has fully assembled along its thread. */
export function revealChime(index = 0) {
  const NOTES = [329.63, 392, 440, 493.88, 523.25];
  pianoNote(NOTES[index % NOTES.length], 0.3, 4.0);
}

/**
 * A released thread: low bass hum with a soft attack and a long decay,
 * plus a barely-audible sub-octave. freq in Hz, strength 0..1.
 */
export function pluckHum(freq: number, strength: number) {
  if (!ctx || !master || !reverb || muted || cut) return;
  const c = ctx;
  const now = c.currentTime;
  const peak = 0.05 * strength;

  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  lp.connect(master);
  lp.connect(reverb);

  [
    { f: freq, level: 1, type: "triangle" as OscillatorType },
    { f: freq / 2, level: 0.55, type: "sine" as OscillatorType },
  ].forEach(({ f, level, type }) => {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(peak * level, 0.0002), now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    osc.connect(g).connect(lp);
    osc.start(now);
    osc.stop(now + 2.8);
  });
}

/** Tiny elegant UI blip (developer HUD only). */
export function uiBlip(freq = 880) {
  if (!ctx || !master || muted || cut) return;
  const c = ctx;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
  osc.connect(g).connect(master);
  osc.start();
  osc.stop(c.currentTime + 0.3);
}
