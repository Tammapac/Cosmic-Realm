// Tiny WebAudio synth — zero assets, all procedural.
// Volume settings live in localStorage so they persist.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;
let preloaded = false;
let volume = 0.5;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
      const stored = localStorage.getItem("sf-audio");
      if (stored) {
        try {
          const cfg = JSON.parse(stored) as { volume?: number; muted?: boolean };
          if (typeof cfg.volume === "number") volume = cfg.volume;
          if (typeof cfg.muted === "boolean") muted = cfg.muted;
          masterGain.gain.value = muted ? 0 : volume;
        } catch { /* ignore */ }
      }
    } catch {
      return null;
    }
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
  if (ctx && !preloaded) { preloaded = true; preloadAll(); }
  return ctx;
}

export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  ensureCtx();
  if (masterGain) masterGain.gain.value = muted ? 0 : volume;
  try { localStorage.setItem("sf-audio", JSON.stringify({ volume, muted })); } catch { /* ignore */ }
}
export function setMuted(m: boolean): void {
  muted = m;
  ensureCtx();
  if (masterGain) masterGain.gain.value = muted ? 0 : volume;
  try { localStorage.setItem("sf-audio", JSON.stringify({ volume, muted })); } catch { /* ignore */ }
}
export function getVolume(): number { ensureCtx(); return volume; }
export function getMuted(): boolean { ensureCtx(); return muted; }

// Throttle of identical sounds so spam fire doesn't blast eardrums
const lastPlayed: Record<string, number> = {};
function throttled(key: string, gap: number): boolean {
  const now = performance.now();
  if ((lastPlayed[key] ?? 0) + gap > now) return false;
  lastPlayed[key] = now;
  return true;
}

function blip(opts: {
  freq: number; freqEnd?: number; dur: number; type?: OscillatorType;
  gain?: number; attack?: number; release?: number; noise?: boolean;
}): void {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const t = c.currentTime;
  const dur = opts.dur;
  const peak = (opts.gain ?? 0.3);
  const attack = opts.attack ?? 0.005;
  const release = opts.release ?? Math.max(0.02, dur * 0.6);

  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
  g.connect(masterGain);

  if (opts.noise) {
    // Noise burst via short buffer
    const sampleRate = c.sampleRate;
    const len = Math.floor(sampleRate * (dur + release));
    const buf = c.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd !== undefined) filt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), t + dur);
    src.connect(filt); filt.connect(g);
    src.start(t);
    src.stop(t + dur + release + 0.05);
  } else {
    const o = c.createOscillator();
    o.type = opts.type ?? "square";
    o.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd !== undefined) {
      o.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), t + dur);
    }
    o.connect(g);
    o.start(t);
    o.stop(t + dur + release + 0.05);
  }
}

// ── AUDIO POOL (file-based sounds with pre-decoded buffers) ─────────────
const audioBuffers: Record<string, AudioBuffer> = {};
const loadingBuffers: Set<string> = new Set();

function loadAudioFile(url: string): void {
  if (audioBuffers[url] || loadingBuffers.has(url)) return;
  const c = ensureCtx();
  if (!c) return;
  loadingBuffers.add(url);
  fetch(url)
    .then((r) => r.arrayBuffer())
    .then((buf) => c.decodeAudioData(buf))
    .then((decoded) => { audioBuffers[url] = decoded; })
    .catch(() => {})
    .finally(() => loadingBuffers.delete(url));
}

function playPooled(url: string, vol = 0.5, rate = 1): void {
  const c = ensureCtx();
  if (!c || !masterGain || muted) return;
  const buf = audioBuffers[url];
  if (!buf) { loadAudioFile(url); return; }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g);
  g.connect(masterGain);
  src.start();
}

let miningSource: AudioBufferSourceNode | null = null;
let miningGain: GainNode | null = null;

function startMiningLoop(): void {
  const c = ensureCtx();
  if (!c || !masterGain || muted || miningSource) return;
  const buf = audioBuffers[MINING_SOUND];
  if (!buf) { loadAudioFile(MINING_SOUND); return; }
  miningSource = c.createBufferSource();
  miningSource.buffer = buf;
  miningSource.loop = true;
  miningGain = c.createGain();
  miningGain.gain.value = 0.12;
  miningSource.connect(miningGain);
  miningGain.connect(masterGain);
  miningSource.start();
  miningSource.onended = () => { miningSource = null; miningGain = null; };
}

function stopMiningLoop(): void {
  if (miningSource) {
    try { miningSource.stop(); } catch {}
    miningSource = null;
    miningGain = null;
  }
}

let thrusterSource: AudioBufferSourceNode | null = null;
let thrusterGain: GainNode | null = null;
const THRUSTER_MAX_VOL = 0.06;

function startThrusterLoop(): void {
  const c = ensureCtx();
  if (!c || !masterGain || muted || thrusterSource) return;
  const buf = audioBuffers[THRUSTER_SOUND];
  if (!buf) { loadAudioFile(THRUSTER_SOUND); return; }
  thrusterSource = c.createBufferSource();
  thrusterSource.buffer = buf;
  thrusterSource.loop = true;
  thrusterGain = c.createGain();
  thrusterGain.gain.value = 0;
  thrusterSource.connect(thrusterGain);
  thrusterGain.connect(masterGain);
  thrusterSource.start();
  thrusterSource.onended = () => { thrusterSource = null; thrusterGain = null; };
}

function updateThrusterVolume(speedPct: number): void {
  if (!thrusterGain) return;
  const target = Math.min(THRUSTER_MAX_VOL, speedPct * THRUSTER_MAX_VOL);
  thrusterGain.gain.value += (target - thrusterGain.gain.value) * 0.1;
}

function stopThrusterLoop(): void {
  if (thrusterSource) {
    try { thrusterSource.stop(); } catch {}
    thrusterSource = null;
    thrusterGain = null;
  }
}

const LASER_SOUNDS = ["/audio/LaserSchuss1.ogg", "/audio/LaserSchuss2.ogg", "/audio/LaserSchuss3.ogg"];
const ROCKET_SOUND = "/audio/rocket_shot.mp3";
const ENEMY_HIT_SOUNDS = ["/audio/enemy_hit1.mp3", "/audio/enemy_hit2.mp3"];
const ENEMY_HIT_PITCHES = [0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.4];
const THRUSTER_SOUND = "/audio/thruster_hum.mp3";
const MINING_SOUND = "/audio/mininglaser.mp3";

function preloadAll(): void {
  for (const url of LASER_SOUNDS) loadAudioFile(url);
  loadAudioFile(ROCKET_SOUND);
  for (const url of ENEMY_HIT_SOUNDS) loadAudioFile(url);
  loadAudioFile(THRUSTER_SOUND);
  loadAudioFile(MINING_SOUND);
}

// ── PUBLIC SFX ──────────────────────────────────────────────────────────
export const sfx = {
  shoot(tier = 1): void {
    if (!throttled("shoot", 60)) return;
    const base = 720 + tier * 60;
    blip({ freq: base, freqEnd: base * 0.4, dur: 0.06, type: "square", gain: 0.10, release: 0.05 });
  },
  laserShoot(): void {
    if (!throttled("laserShoot", 80)) return;
    const pick = LASER_SOUNDS[Math.floor(Math.random() * LASER_SOUNDS.length)];
    playPooled(pick, 0.4);
  },
  rocketShoot(): void {
    if (!throttled("rocketShoot", 150)) return;
    playPooled(ROCKET_SOUND, 0.4);
  },
  thrusterStart(): void {
    startThrusterLoop();
  },
  thrusterUpdate(speedPct: number): void {
    updateThrusterVolume(speedPct);
  },
  thrusterStop(): void {
    stopThrusterLoop();
  },
  miningLaserStart(): void {
    startMiningLoop();
  },
  miningLaserStop(): void {
    stopMiningLoop();
  },
  hit(): void {
    if (!throttled("hit", 30)) return;
    const pick = ENEMY_HIT_SOUNDS[Math.floor(Math.random() * ENEMY_HIT_SOUNDS.length)];
    const pitch = ENEMY_HIT_PITCHES[Math.floor(Math.random() * ENEMY_HIT_PITCHES.length)];
    playPooled(pick, 0.3, pitch);
  },
  enemyHit(): void {
    if (!throttled("enemyHit", 30)) return;
    const pick = ENEMY_HIT_SOUNDS[Math.floor(Math.random() * ENEMY_HIT_SOUNDS.length)];
    const pitch = ENEMY_HIT_PITCHES[Math.floor(Math.random() * ENEMY_HIT_PITCHES.length)];
    playPooled(pick, 0.3, pitch);
  },
  crit(): void {
    if (!throttled("crit", 50)) return;
    blip({ freq: 1600, freqEnd: 600, dur: 0.10, type: "triangle", gain: 0.22, release: 0.10 });
    blip({ freq: 880, freqEnd: 440, dur: 0.10, type: "square", gain: 0.10, release: 0.10 });
  },
  explosion(big = false): void {
    if (!throttled(big ? "ex-big" : "ex", big ? 200 : 100)) return;
    blip({ freq: big ? 600 : 400, freqEnd: 60, dur: big ? 0.35 : 0.18, gain: 0.35, noise: true, release: 0.15 });
    blip({ freq: big ? 110 : 180, freqEnd: 40, dur: big ? 0.25 : 0.12, type: "sawtooth", gain: 0.20 });
  },
  shieldHit(): void {
    if (!throttled("shield", 60)) return;
    blip({ freq: 880, freqEnd: 1320, dur: 0.08, type: "triangle", gain: 0.15, release: 0.06 });
  },
  pickup(): void {
    if (!throttled("pickup", 40)) return;
    blip({ freq: 660, freqEnd: 990, dur: 0.05, type: "square", gain: 0.12, release: 0.05 });
  },
  levelUp(): void {
    blip({ freq: 523, dur: 0.08, type: "square", gain: 0.22 });
    setTimeout(() => blip({ freq: 659, dur: 0.08, type: "square", gain: 0.22 }), 90);
    setTimeout(() => blip({ freq: 784, dur: 0.10, type: "square", gain: 0.22 }), 180);
    setTimeout(() => blip({ freq: 1046, dur: 0.20, type: "triangle", gain: 0.24, release: 0.18 }), 280);
  },
  notify(kind: "good" | "bad" | "info" = "info"): void {
    if (kind === "good") blip({ freq: 880, freqEnd: 1320, dur: 0.08, type: "triangle", gain: 0.18 });
    else if (kind === "bad") blip({ freq: 320, freqEnd: 180, dur: 0.10, type: "sawtooth", gain: 0.20 });
    else blip({ freq: 660, dur: 0.05, type: "square", gain: 0.14 });
  },
  warp(): void {
    blip({ freq: 220, freqEnd: 1760, dur: 0.50, type: "sawtooth", gain: 0.18, release: 0.20 });
    blip({ freq: 1760, freqEnd: 220, dur: 0.40, type: "square", gain: 0.10, release: 0.20 });
  },
  dock(): void {
    blip({ freq: 440, dur: 0.10, type: "square", gain: 0.18 });
    setTimeout(() => blip({ freq: 660, dur: 0.16, type: "triangle", gain: 0.20, release: 0.14 }), 120);
  },
  click(): void {
    if (!throttled("click", 30)) return;
    blip({ freq: 1320, dur: 0.02, type: "square", gain: 0.08 });
  },
  bossWarn(): void {
    blip({ freq: 110, freqEnd: 220, dur: 0.30, type: "sawtooth", gain: 0.30 });
    setTimeout(() => blip({ freq: 110, freqEnd: 220, dur: 0.30, type: "sawtooth", gain: 0.30 }), 380);
    setTimeout(() => blip({ freq: 110, freqEnd: 220, dur: 0.30, type: "sawtooth", gain: 0.30 }), 760);
  },
  bossKill(): void {
    sfx.explosion(true);
    setTimeout(() => sfx.explosion(true), 200);
    setTimeout(() => sfx.levelUp(), 400);
  },
};
