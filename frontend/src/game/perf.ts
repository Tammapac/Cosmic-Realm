/**
 * perf.ts — lightweight performance instrumentation + debug overlay.
 *
 * Zero-cost when disabled: every hook guards on `enabled` (a plain boolean).
 * Toggle with F9 in game or `window.__PERF = true/false` in the console.
 *
 * What it measures (per rendered frame):
 *  - FPS (1s window), frame time avg / max / 1%-low (rolling 240 frames)
 *  - named sections: sim (tickWorld), render (pixiRender) — via perfBegin/End
 *  - entity counts from the store (enemies, projectiles, others, effects)
 *  - Three.js draw calls + triangles per renderer (ships / enemies / station,
 *    self-registered via perfRegisterThree)
 *  - JS heap (Chrome performance.memory)
 *  - net messages/s (perfCount("net"))
 *
 * Benchmark helper: window.__BENCH(n) — spawns n *client-local* dummy enemies
 * (id prefix "bench-") for pure render-cost measurement without the server.
 * They are excluded from server snapshot reconciliation via the same prefix.
 * For full-stack benchmarks use the admin panel spawn (server-authoritative).
 */
import { state } from "./store";

let enabled = false;
let overlay: HTMLDivElement | null = null;

// ── section timers ──────────────────────────────────────────────────────────
const secStart: Record<string, number> = {};
const secAccum: Record<string, number> = {};
const secAvg: Record<string, number> = {};

export function perfBegin(name: string): void {
  if (!enabled) return;
  secStart[name] = performance.now();
}
export function perfEnd(name: string): void {
  if (!enabled) return;
  const s = secStart[name];
  if (s !== undefined) secAccum[name] = (secAccum[name] ?? 0) + (performance.now() - s);
}

// ── counters (events per second, e.g. network messages) ────────────────────
const counters: Record<string, number> = {};
const counterRates: Record<string, number> = {};
export function perfCount(name: string, n = 1): void {
  if (!enabled) return;
  counters[name] = (counters[name] ?? 0) + n;
}

// ── three.js renderer registry (draw calls) ────────────────────────────────
type ThreeInfo = { name: string; info: { render: { calls: number; triangles: number } } };
const threeInfos: ThreeInfo[] = [];
export function perfRegisterThree(name: string, info: any): void {
  // allow re-register on renderer rebuild — replace by name
  const i = threeInfos.findIndex((t) => t.name === name);
  if (i >= 0) threeInfos[i] = { name, info };
  else threeInfos.push({ name, info });
}

// ── frame accounting ────────────────────────────────────────────────────────
const FRAME_WINDOW = 240;
const frameTimes: number[] = [];
let lastFrameAt = 0;
let framesThisSec = 0;
let lastSecAt = 0;
let fps = 0;
let maxFrame = 0;

export function perfFrame(): void {
  if (!enabled) return;
  const now = performance.now();
  if (lastFrameAt) {
    const ft = now - lastFrameAt;
    frameTimes.push(ft);
    if (frameTimes.length > FRAME_WINDOW) frameTimes.shift();
    if (ft > maxFrame) maxFrame = ft;
  }
  lastFrameAt = now;
  framesThisSec++;
  if (now - lastSecAt >= 1000) {
    fps = framesThisSec * 1000 / (now - lastSecAt);
    framesThisSec = 0;
    lastSecAt = now;
    // section averages over the second
    for (const k of Object.keys(secAccum)) {
      secAvg[k] = secAccum[k] / Math.max(1, fps);
      secAccum[k] = 0;
    }
    for (const k of Object.keys(counters)) {
      counterRates[k] = counters[k];
      counters[k] = 0;
    }
    maxFrame = 0;
    renderOverlay();
  }
}

// ── overlay ─────────────────────────────────────────────────────────────────
function fmt(n: number, d = 1): string { return n.toFixed(d); }

function renderOverlay(): void {
  if (!enabled || !overlay) return;
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0;
  const onePctLowFps = p99 > 0 ? 1000 / p99 : 0;
  const mem = (performance as any).memory
    ? `${((performance as any).memory.usedJSHeapSize / 1048576) | 0} MB`
    : "n/a";

  let three = "";
  for (const t of threeInfos) {
    three += `${t.name}: ${t.info.render.calls} calls / ${(t.info.render.triangles / 1000) | 0}k tri\n`;
  }

  const benchCount = state.enemies.filter((e) => e.id.startsWith("bench-")).length;

  overlay.textContent =
    `FPS ${fmt(fps, 0)}  frame ${fmt(avg)}ms  max ${fmt(maxFrame)}ms  1%low ${fmt(onePctLowFps, 0)}fps\n` +
    `sim ${fmt(secAvg["sim"] ?? 0, 2)}ms  render ${fmt(secAvg["render"] ?? 0, 2)}ms\n` +
    `enemies ${state.enemies.length}${benchCount ? ` (${benchCount} bench)` : ""}  ` +
    `proj ${state.projectiles.length}  players ${state.others.length}  npcs ${state.npcShips?.length ?? 0}\n` +
    three +
    `heap ${mem}  net ${counterRates["net"] ?? 0}/s\n` +
    `__BENCH(n) spawn · __BENCH(0) clear · F9 toggle`;
}

function ensureOverlay(): void {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.id = "perf-overlay";
  overlay.style.cssText =
    "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;" +
    "background:rgba(3,6,12,0.85);color:#5cff8a;font:11px/1.5 Consolas,monospace;" +
    "padding:6px 10px;border:1px solid rgba(92,255,138,0.3);pointer-events:none;" +
    "white-space:pre;text-align:left;";
  document.body.appendChild(overlay);
}

export function perfSetEnabled(on: boolean): void {
  enabled = on;
  if (on) { ensureOverlay(); if (overlay) overlay.style.display = "block"; }
  else if (overlay) overlay.style.display = "none";
  (window as any).__PERF = on;
}

// ── client-local render benchmark ──────────────────────────────────────────
/**
 * Spawn n dummy enemies around the player, client-side only (id "bench-i").
 * n = 0 removes them all. They render through the normal pipeline (sprites /
 * 3D models / bars / names) but are NOT server entities. Snapshot handlers
 * must preserve ids starting with "bench-" (see loop.ts).
 */
function bench(n: number): string {
  // remove existing bench entities
  state.enemies = state.enemies.filter((e) => !e.id.startsWith("bench-"));
  const types = ["scout", "raider", "interceptor", "corvette", "destroyer", "sentinel"];
  const px = state.player.pos.x, py = state.player.pos.y;
  for (let i = 0; i < n; i++) {
    const ang = (i / Math.max(1, n)) * Math.PI * 2;
    const d = 200 + (i % 10) * 120;
    const type = types[i % types.length];
    state.enemies.push({
      id: `bench-${i}`,
      type,
      behavior: "chaser",
      name: `Bench ${i}`,
      pos: { x: px + Math.cos(ang) * d, y: py + Math.sin(ang) * d },
      vel: { x: 0, y: 0 },
      angle: ang,
      hull: 100, hullMax: 100,
      damage: 0, speed: 0,
      exp: 0, credits: 0, honor: 0,
      color: "#ff8866", size: 12,
      isBoss: false,
      zone: state.player.zone,
    } as any);
  }
  return `bench: ${n} dummy enemies (client-only render load)`;
}

// ── bootstrap ───────────────────────────────────────────────────────────────
export function initPerf(): void {
  (window as any).__BENCH = (n: number) => { const r = bench(n | 0); console.log(r); return r; };
  Object.defineProperty(window, "__PERF", {
    configurable: true,
    get: () => enabled,
    set: (v: boolean) => perfSetEnabled(!!v),
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "F9") perfSetEnabled(!enabled);
  });
}
