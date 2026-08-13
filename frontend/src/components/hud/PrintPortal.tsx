// PrintPortal — the Cosmic Kit "3D printer" window opener/closer. Wraps any
// panel content: a static top-edge light rail, a travelling beam that prints
// the window downward (or retracts it on close), and a canvas spark emitter
// (micro/spark/ember/fall particles riding the beam edge). Ported 1:1 from
// the Cosmic Kit design export's <print-portal> custom element (same easing,
// particle rates and keyframe timings) onto React state instead of a
// web-component shadow root, so it composes with the rest of the HUD.
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Particle = { x: number; y: number; vx: number; vy: number; r: number; k: number; g: number; t: number; l: number };

const hex2rgb = (h: string): [number, number, number] => {
  h = (h || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "4ee2ff", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (rgb: [number, number, number], t: number): [number, number, number] =>
  rgb.map((c) => Math.round(c + (255 - c) * t)) as [number, number, number];
const rgba = (rgb: [number, number, number], a: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

let SPRITE: { key: string; c: HTMLCanvasElement } | null = null;
function sprite(rgb: [number, number, number]): HTMLCanvasElement {
  const key = rgb.join(",");
  if (SPRITE && SPRITE.key === key) return SPRITE.c;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, "rgba(255,255,255,1)");
  rg.addColorStop(0.22, rgba(mix(rgb, 0.85), 0.9));
  rg.addColorStop(0.5, rgba(mix(rgb, 0.2), 0.38));
  rg.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = rg;
  g.fillRect(0, 0, 32, 32);
  SPRITE = { key, c };
  return c;
}

const SNAP = 380; // upper beam collapse duration at the end of a close

export type PrintPortalHandle = { play: () => void; close: () => void };

type PrintPortalProps = {
  /** Bumped by the caller to trigger a fresh open animation (e.g. re-open key). */
  playToken: number | string;
  accent?: string;
  duration?: number;
  chamfer?: number;
  /** Called once the close animation (print + snap) has fully finished. */
  onClosed?: () => void;
  /** Set true to run the close animation instead of open. */
  closing?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

export function PrintPortal({ playToken, accent = "#4ee2ff", duration = 1350, chamfer = 18, onClosed, closing = false, style, children }: PrintPortalProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [mode, setMode] = useState<"in" | "out">("in");

  const rgb = hex2rgb(accent);
  const D = duration;
  const d = (f: number) => `${((D * f) / 1350).toFixed(3)}ms`;
  const A = (a: number) => rgba(rgb, a);
  const L = (t: number, a: number) => rgba(mix(rgb, t), a);
  const core = L(0.72, 1);
  const EASE = "cubic-bezier(.28,.62,.28,1)";
  const CH = chamfer;

  const out = mode === "out";
  const HOST = out
    ? `ppPrintOut ${d(1350)} ${EASE} both, ppHostOut ${SNAP}ms ease-in ${d(1350)} both`
    : `ppPrint ${d(1350)} ${EASE} both`;
  const TAIL = out ? `, ppSnap ${SNAP}ms cubic-bezier(.5,0,.85,.4) ${d(1350)} both` : "";
  const BEAM = `${out ? "ppBeamOut" : "ppBeam"} ${d(1350)} ${EASE} both${TAIL}`;
  const beamOrb = (side: "L" | "R") =>
    `${out ? "ppBeamOut" : "ppBeam"} ${d(1350)} ${EASE} both` + (out ? `, ppOrb${side} ${SNAP}ms cubic-bezier(.5,0,.85,.4) ${d(1350)} both` : "");
  const UP = `${out ? "ppBeamUpOut" : "ppBeamUp"} ${d(1350)} ${EASE} both`;
  const OPEN = Math.round(Math.min(D * 0.34, 460));
  const RAIL = out ? `ppSnap ${SNAP}ms cubic-bezier(.5,0,.85,.4) ${d(1350)} both` : `ppOpen ${OPEN}ms cubic-bezier(.16,.84,.34,1) both`;
  const orbAnim = (side: "L" | "R") =>
    out ? `ppOrb${side} ${SNAP}ms cubic-bezier(.5,0,.85,.4) ${d(1350)} both` : `ppOrb${side}In ${OPEN}ms cubic-bezier(.16,.84,.34,1) both`;

  const clipTop = `polygon(0 0,calc(100% - ${CH}px) 0,100% ${CH}px,100% 100%,0 100%)`;
  const clipBot = `polygon(0 0,100% 0,100% 100%,${CH}px 100%,0 calc(100% - ${CH}px))`;
  const orbBg = `radial-gradient(circle,rgba(255,255,255,.95) 0 1.5px,${L(0.8, 0.6)} 4px,${A(0.28)} 8px,${A(0.08)} 12px,transparent 15px)`;
  const lineBg = `linear-gradient(90deg,transparent,${L(0.55, 1)} 6%,#ffffff 28%,#ffffff 72%,${L(0.55, 1)} 94%,transparent)`;
  const lineShadow = `0 0 8px #ffffff,0 0 18px ${A(1)},0 0 42px ${A(0.9)},0 0 84px ${A(0.52)}`;
  const haloBg = `linear-gradient(90deg,transparent,${A(0.75)} 10%,${L(0.8, 0.95)} 50%,${A(0.75)} 90%,transparent)`;

  const AMB: [number, string, number, number, 0 | 1][] = [
    [3, "A", 1.15, 0, 1], [8, "C", 1.5, 0.42, 0], [13, "B", 1, 0.86, 0], [18, "A", 1.3, 0.25, 0],
    [23, "C", 1.45, 1.1, 1], [27, "B", 1.05, 0.6, 0], [32, "A", 1.2, 0.15, 0], [37, "C", 1.55, 0.95, 0],
    [42, "B", 0.95, 0.5, 1], [47, "A", 1.25, 1.25, 0], [52, "C", 1.4, 0.3, 0], [57, "B", 1.1, 0.72, 0],
    [62, "A", 1.35, 1.05, 1], [67, "C", 1.5, 0.08, 0], [72, "B", 1, 0.55, 0], [77, "A", 1.2, 0.9, 0],
    [82, "C", 1.45, 0.38, 1], [87, "B", 1.05, 1.18, 0], [92, "A", 1.3, 0.68, 0], [96, "C", 1.6, 0.2, 0],
  ];

  // Re-mount into "in" mode whenever the caller bumps playToken; switch to
  // "out" when the caller sets closing (equip/discard flows do this before
  // unmounting the panel entirely).
  useLayoutEffect(() => {
    setMode(closing ? "out" : "in");
  }, [playToken, closing]);

  // Canvas spark engine — one simulation per mode switch, mirrors the
  // original's emit-rate-per-particle-type + gravity + fade-in/out curve.
  useEffect(() => {
    const el = canvasRef.current;
    const host = hostRef.current;
    if (!el || !host) return;
    const dir = out ? -1 : 1;
    const rgbCur = rgb;
    const spr = sprite(rgbCur);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = host.offsetWidth || 720;
    const h = host.offsetHeight || 480;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const IN = dir > 0;
    const bx = (u: number) => { const v = 1 - u; return 3 * v * v * u * 0.28 + 3 * v * u * u * 0.28 + u * u * u; };
    const byv = (u: number) => { const v = 1 - u; return 3 * v * v * u * 0.62 + 3 * v * u * u + u * u * u; };
    const ease = (t: number) => { let lo = 0, hi = 1, u = t; for (let i = 0; i < 10; i++) { u = (lo + hi) / 2; if (bx(u) < t) lo = u; else hi = u; } return byv(u); };
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const TRAVEL = D * 0.92;
    const P: Particle[] = [];
    const carry = { m: 0, s: 0, e: 0, f: 0 };
    const t0 = performance.now();
    const dens = Math.max(0.35, Math.min(1.6, w / 720));
    let last = t0;

    const frame = (now: number) => {
      const dt = Math.min(now - last, 48) / 1000;
      last = now;
      const age = now - t0;
      const p = age < TRAVEL ? ease(age / TRAVEL) : 1;
      const line = (IN ? p : 1 - p) * h;
      if (age < TRAVEL) {
        const emit = (k: keyof typeof carry, rate: number, make: () => Particle) => {
          carry[k] += rate * dens * dt;
          while (carry[k] >= 1) { carry[k]--; P.push(make()); }
        };
        emit("m", 1400, () => { const a = Math.random() * 6.2832, sp = rnd(20, 80); return { x: rnd(6, w - 6), y: line, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rnd(0.7, 1.7), k: 1, g: 0, t: 0, l: rnd(0.26, 0.6) }; });
        emit("s", 380, () => ({ x: rnd(4, w - 4), y: line, vx: rnd(-16, 16), vy: rnd(-95, -45), r: rnd(1.3, 2.6), k: 1.9, g: 30, t: 0, l: rnd(0.5, 0.95) }));
        emit("e", 170, () => ({ x: rnd(4, w - 4), y: line, vx: rnd(-12, 12), vy: rnd(-160, -75), r: rnd(1, 2), k: 1.7, g: 5, t: 0, l: rnd(1.4, 2.2) }));
        emit("f", 130, () => ({ x: rnd(4, w - 4), y: line, vx: rnd(-12, 12), vy: rnd(25, 75), r: rnd(1, 1.9), k: 1.5, g: 45, t: 0, l: rnd(0.4, 0.8) }));
      }
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = P.length - 1; i >= 0; i--) {
        const q = P[i];
        q.t += dt;
        if (q.t >= q.l) { P[i] = P[P.length - 1]; P.pop(); continue; }
        q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        const f = q.t / q.l;
        ctx.globalAlpha = f < 0.12 ? f / 0.12 : 1 - (f - 0.12) / 0.88;
        const sw = q.r * 4.2, sh = sw * q.k;
        ctx.drawImage(spr, q.x - sw / 2, q.y - sh / 2, sw, sh);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (age < TRAVEL + 300 || P.length) rafRef.current = requestAnimationFrame(frame);
      else { rafRef.current = 0; ctx.clearRect(0, 0, w, h); }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = 0; };
  }, [mode, playToken, D, accent]);

  // Fire onClosed once the close animation (print + snap) has fully played.
  // onClosed is read through a ref: callers routinely pass a fresh inline
  // closure every render (this component re-renders on every store tick via
  // useGame), and depending on it directly would restart — and therefore
  // never fire — this timer.
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  useEffect(() => {
    if (!out) return;
    const total = D + SNAP;
    const t = setTimeout(() => onClosedRef.current?.(), total);
    return () => clearTimeout(t);
  }, [out, D]);

  return (
    // isolation:isolate pins a fresh stacking context here, so the beam/rail
    // layers' high internal z-indexes (up to 63) can never bleed above
    // sibling overlays (popups, modals) that live outside this wrapper.
    <div ref={hostRef} style={{ position: "relative", display: "block", isolation: "isolate", ...style }}>
      <style>{`
@keyframes ppPrint{0%{clip-path:inset(-90px -90px calc(100% - 14px) -90px)}92%{clip-path:inset(-90px -90px -4px -90px)}100%{clip-path:inset(-90px -90px -90px -90px)}}
@keyframes ppPrintOut{0%{clip-path:inset(-90px -90px -4px -90px)}92%{clip-path:inset(-90px -90px 100% -90px)}100%{clip-path:inset(-90px -90px 100% -90px)}}
@keyframes ppHostOut{0%{opacity:1}70%{opacity:1}100%{opacity:0}}
@keyframes ppOpen{from{transform:scaleX(.05);opacity:.45;filter:brightness(2.6)}to{transform:scaleX(1);opacity:1;filter:brightness(1)}}
@keyframes ppOrbLIn{from{left:calc(50% - 15px);opacity:.45}to{left:-15px;opacity:1}}
@keyframes ppOrbRIn{from{right:calc(50% - 15px);opacity:.45}to{right:${CH - 15}px;opacity:1}}
@keyframes ppSnap{0%{transform:scaleX(1);opacity:1;filter:brightness(1)}52%{transform:scaleX(.1);opacity:1;filter:brightness(2.4)}78%{transform:scaleX(.03);opacity:1;filter:brightness(3)}100%{transform:scaleX(0);opacity:0;filter:brightness(3)}}
@keyframes ppOrbL{0%{left:-15px;opacity:1}52%{left:calc(3px + 0.9 * (50% - 18px));opacity:1}78%{left:calc(3px + 0.97 * (50% - 18px));opacity:1}100%{left:calc(50% - 15px);opacity:0}}
@keyframes ppOrbR{0%{right:${CH - 15}px;opacity:1}52%{right:calc(3px + 0.9 * (50% - 18px));opacity:1}78%{right:calc(3px + 0.97 * (50% - 18px));opacity:1}100%{right:calc(50% - 15px);opacity:0}}
@keyframes ppBeam{0%{top:0;opacity:1;transform:scaleX(.34)}92%{top:100%;opacity:1;transform:scaleX(1)}100%{top:100%;opacity:1;transform:scaleX(1)}}
@keyframes ppBeamOut{0%{top:100%;opacity:1;transform:scaleX(1)}92%{top:0;opacity:1;transform:scaleX(1)}100%{top:0;opacity:1;transform:scaleX(1)}}
@keyframes ppBeamUp{0%{top:0;opacity:0;transform:translateY(-100%) scaleX(.34)}16%{opacity:1}92%{top:100%;opacity:1;transform:translateY(-100%) scaleX(1)}100%{top:100%;opacity:1;transform:translateY(-100%) scaleX(1)}}
@keyframes ppBeamUpOut{0%{top:100%;opacity:1;transform:translateY(-100%) scaleX(1)}92%{top:0;opacity:1;transform:translateY(-100%) scaleX(1)}100%{top:0;opacity:0;transform:translateY(-100%) scaleX(1)}}
@keyframes ppHeat{0%{opacity:0}7%{opacity:1}100%{opacity:0}}
@keyframes ppSpkA{0%{opacity:0;transform:translate(0,4px) scale(.5)}14%{opacity:1;transform:translate(0,-4px) scale(1)}62%{opacity:.85}100%{opacity:0;transform:translate(2px,-58px) scale(.35)}}
@keyframes ppSpkB{0%{opacity:0;transform:translate(0,4px) scale(.5)}16%{opacity:1;transform:translate(-1px,-5px) scale(1)}58%{opacity:.8}100%{opacity:0;transform:translate(-8px,-42px) scale(.3)}}
@keyframes ppSpkC{0%{opacity:0;transform:translate(0,4px) scale(.45)}12%{opacity:1;transform:translate(1px,-6px) scale(1)}66%{opacity:.75}100%{opacity:0;transform:translate(7px,-76px) scale(.25)}}
      `}</style>

      <div key={`${playToken}-${mode}`} style={{ position: "relative", display: "block", animation: HOST }}>
        {children}
      </div>

      {/* top rail washes */}
      <i style={{ position: "absolute", pointerEvents: "none", left: 0, right: 0, top: 0, height: 84, zIndex: 53, clipPath: clipTop, animation: RAIL }}>
        <i style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg,${L(0.85, 0.14)},${L(0.4, 0.05)} 30%,${A(0.015)} 62%,transparent)`, filter: "blur(11px)" }} />
      </i>
      <i style={{ position: "absolute", pointerEvents: "none", left: 0, right: 0, top: 0, height: 50, zIndex: 54, clipPath: clipTop, animation: RAIL }}>
        <i style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg,${L(0.85, 0.24)},${L(0.4, 0.07)} 42%,transparent)`, filter: "blur(7px)" }} />
      </i>
      <i style={{ position: "absolute", pointerEvents: "none", left: 0, right: 0, top: 0, height: 116, zIndex: 52, clipPath: clipTop, animation: RAIL }}>
        <i style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 100% at 50% 0%,${L(0.4, 0.09)},${A(0.03)} 46%,transparent 76%)`, filter: "blur(10px)" }} />
      </i>
      <i style={{ position: "absolute", pointerEvents: "none", transformOrigin: "50% 50%", left: -8, right: CH - 2, top: 0, height: 9, marginTop: -4, zIndex: 58, background: haloBg, filter: "blur(4px)", animation: RAIL }} />
      <i style={{ position: "absolute", pointerEvents: "none", transformOrigin: "50% 50%", left: -6, right: CH - 2, top: 0, height: 2, zIndex: 61, background: lineBg, boxShadow: lineShadow, animation: RAIL }} />
      <i style={{ position: "absolute", pointerEvents: "none", left: -15, top: 0, width: 30, height: 30, marginTop: -15, zIndex: 63, background: orbBg, filter: "blur(1.5px)", animation: orbAnim("L") }} />
      <i style={{ position: "absolute", pointerEvents: "none", right: CH - 15, top: 0, width: 30, height: 30, marginTop: -15, zIndex: 63, background: orbBg, filter: "blur(1.5px)", animation: orbAnim("R") }} />

      {/* travelling print beam */}
      <i style={{ position: "absolute", pointerEvents: "none", left: CH, right: -26, top: 0, height: 54, marginTop: -53, zIndex: 57, background: `linear-gradient(180deg,transparent,${A(0.05)} 40%,${L(0.3, 0.16)} 74%,${L(0.85, 0.4)})`, filter: "blur(6px)", animation: BEAM }} />
      <i style={{ position: "absolute", pointerEvents: "none", left: CH - 2, right: -8, top: 0, height: 9, marginTop: -4, zIndex: 58, background: haloBg, animation: BEAM }} />
      <i style={{ position: "absolute", pointerEvents: "none", left: CH - 2, right: -8, top: 0, height: 3, marginTop: -2.5, zIndex: 59, background: "linear-gradient(90deg,transparent,rgba(255,120,220,.5) 8%,transparent 22%,transparent 78%,rgba(120,255,220,.5) 92%,transparent)", filter: "blur(1.5px)", animation: BEAM }} />
      <i style={{ position: "absolute", pointerEvents: "none", left: CH - 2, right: -6, top: 0, height: 2, zIndex: 61, background: lineBg, boxShadow: lineShadow, animation: BEAM }} />
      <i style={{ position: "absolute", pointerEvents: "none", left: CH - 2, right: -6, top: 0, height: 3, marginTop: -0.5, zIndex: 62, background: "repeating-linear-gradient(90deg,rgba(255,255,255,.55) 0 3px,transparent 3px 11px)", filter: "blur(2.2px)", opacity: 0.3, animation: BEAM }} />
      <i style={{ position: "absolute", pointerEvents: "none", left: CH - 15, top: 0, width: 30, height: 30, marginTop: -15, zIndex: 63, background: orbBg, filter: "blur(1.5px)", animation: beamOrb("L") }} />
      <i style={{ position: "absolute", pointerEvents: "none", right: -15, top: 0, width: 30, height: 30, marginTop: -15, zIndex: 63, background: orbBg, filter: "blur(1.5px)", animation: beamOrb("R") }} />

      {/* bottom rail washes (mirror, animates on the "up" trigger) */}
      <i style={{ position: "absolute", pointerEvents: "none", left: 0, right: 0, top: 0, height: 84, zIndex: 53, clipPath: clipBot, animation: UP }}>
        <i style={{ position: "absolute", inset: 0, background: `linear-gradient(0deg,${L(0.85, 0.13)},${L(0.4, 0.045)} 30%,${A(0.015)} 62%,transparent)`, filter: "blur(11px)" }} />
      </i>
      <i style={{ position: "absolute", pointerEvents: "none", left: 0, right: 0, top: 0, height: 50, zIndex: 54, clipPath: clipBot, animation: UP }}>
        <i style={{ position: "absolute", inset: 0, background: `linear-gradient(0deg,${L(0.85, 0.22)},${L(0.4, 0.065)} 42%,transparent)`, filter: "blur(7px)" }} />
      </i>
      <i style={{ position: "absolute", pointerEvents: "none", left: 0, right: 0, top: 0, height: 112, zIndex: 52, clipPath: clipBot, animation: UP }}>
        <i style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 100% at 50% 100%,${L(0.4, 0.08)},${A(0.025)} 46%,transparent 76%)`, filter: "blur(10px)" }} />
      </i>

      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 56, pointerEvents: "none", display: "block", width: "100%", height: "100%" }} />

      {/* ambient sparks riding the travelling beam edge */}
      <i style={{ position: "absolute", pointerEvents: "none", left: 10, right: 10, top: 0, height: 0, zIndex: 55, animation: UP }}>
        {AMB.map(([x, v, dur, del, big], i) => (
          <i
            key={i}
            style={{
              position: "absolute", bottom: -1, borderRadius: 2,
              left: `${x}%`, width: big ? 2.4 : 1.6, height: big ? 4.5 : 2.6,
              background: `linear-gradient(180deg,#ffffff,${core} 55%,${A(0)})`,
              boxShadow: `0 0 4px ${L(0.8, 0.95)},0 0 10px ${A(0.7)}`,
              animation: `ppSpk${v} ${dur}s linear ${del}s infinite`,
            }}
          />
        ))}
      </i>
      <i style={{ position: "absolute", pointerEvents: "none", inset: 0, zIndex: 52, background: `radial-gradient(140% 70% at 50% 0%,${L(0.4, 0.45)},transparent 72%)`, animation: `ppHeat ${d(1350)} ease-out both` }} />
    </div>
  );
}
