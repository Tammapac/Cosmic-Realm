// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, N-01 ·
// MINIMAP SCOPE section + its renderVals() logic). Every gradient/shadow/
// clip-path is copied verbatim — the chamfered console casting (metal
// rim, three steel bands, panel seams, corner screws), the zone header
// chip, the hexagon scope (stepped metal bands, scanlines, corner
// reflection, vignette), the bearing tape/tick ring/readout columns, the
// conic sweep + boot-scan line, the compass letters, corner clamps, and
// the zoom/MAP control row.
//
// Same purple energy-flow wash as the Combat Console (H-02) / Chat (W-04)
// — one consistent atmosphere across all three consoles.
//
// Contact blips stay on a single <canvas> instead of one DOM element per
// blip (the Kit's own sc-for markup): a prior version of this HUD
// measured 17.4ms/frame with 100-200 NPCs as individual animated divs,
// down to 5.1ms with them hidden. The canvas draws the same look (dot +
// glow, hostile pulse, sweep-synced scan flash) for a few hundred
// microseconds regardless of contact count.
//
// MAP opens ZoneMapPanel.tsx (state.showZoneMap) — the I-06 local contact
// map for the CURRENT zone (sites, portals, players, enemies, asteroids,
// cargo as blips around the ship). This is distinct from the zone-to-zone
// travel picker (GalaxyMapPanel.tsx, state.showMap, opened with the M key)
// — the two were previously confused with each other. The full
// rank/reputation zone header is still out of scope for this pass.
import { useEffect, useRef, useState } from "react";
import { useGame, useGameSlow, state as gameState, bump } from "../game/store";
import { ZONES, RESOURCES } from "../game/types";
import { usePressable } from "./hud/usePressable";

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

const MINIMAP_KEYFRAMES = `
@keyframes cPulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes cSweep{0%{transform:skewX(-18deg) translateX(-120%)}100%{transform:skewX(-18deg) translateX(760%)}}
@keyframes cSpin{to{transform:rotate(360deg)}}
@keyframes cBootScan{0%{top:-10%;opacity:0}12%{opacity:1}100%{top:108%;opacity:0}}
@keyframes cBlip{0%,100%{opacity:.45;transform:translate(-50%,-50%) rotate(45deg) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) rotate(45deg) scale(1.4)}}
@keyframes cPing{0%{opacity:.75;transform:translate(-50%,-50%) scale(.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.4)}}
`;

const MAP_GRID = [14, 22, 32, 46];
const MAP_RING1 = [8, 14, 20, 26];
const MAP_RING2 = [22, 30, 37, 43];
const MAP_RING3 = [38, 44, 48, 52];
const MAP_RANGE = [" 2 km", " 5 km", "10 km", "25 km"];
const MAP_CONTACTS = ["02", "06", "09", "14"];

const CLAMPS = [
  { left: 12, right: "auto" as const, top: 12, bottom: "auto" as const, bt: "rgba(157,242,255,.75)", bl: "rgba(157,242,255,.75)", br: "transparent", bb: "transparent" },
  { left: "auto" as const, right: 12, top: 12, bottom: "auto" as const, bt: "rgba(157,242,255,.75)", bl: "transparent", br: "rgba(157,242,255,.75)", bb: "transparent" },
  { left: 12, right: "auto" as const, top: "auto" as const, bottom: 12, bt: "transparent", bl: "rgba(157,242,255,.75)", br: "transparent", bb: "rgba(157,242,255,.75)" },
  { left: "auto" as const, right: 12, top: "auto" as const, bottom: 12, bt: "transparent", bl: "transparent", br: "rgba(157,242,255,.75)", bb: "rgba(157,242,255,.75)" },
];

export type MinimapBlipKind = "ally" | "hostile" | "neutral" | "objective" | "resource" | "loot";
export type MinimapBlipData = { x: number; y: number; kind: MinimapBlipKind; title?: string };

const BLIP_HEX: Record<MinimapBlipKind, string> = {
  ally: "#5cff8a", hostile: "#ff4d5e", neutral: "#9fe0ff", objective: "#b866ff", resource: "#e8b94d", loot: "#4ee2ff",
};

const SWEEP_PERIOD_S = 4.2;

function angleOf(x: number, y: number): number {
  const dx = x - 50, dy = y - 50;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function BlipCanvas({ blips }: { blips: MinimapBlipData[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blipsRef = useRef(blips);
  blipsRef.current = blips;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(rect.width * dpr), H = Math.round(rect.height * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      ctx.clearRect(0, 0, W, H);

      const t = now / 1000;
      const sweepDeg = ((t % SWEEP_PERIOD_S) / SWEEP_PERIOD_S) * 360;
      const hostilePulse = reducedMotion ? 1 : 0.725 + 0.275 * Math.cos((2 * Math.PI * t) / 1.4);

      for (const b of blipsRef.current) {
        const x = (b.x / 100) * W, y = (b.y / 100) * H;
        const c = BLIP_HEX[b.kind] ?? "#4ee2ff";
        const r = (b.kind === "resource" ? 2 : 3) * dpr;

        ctx.globalAlpha = b.kind === "hostile" ? hostilePulse : b.kind === "resource" ? 0.85 : 1;
        ctx.shadowColor = c;
        ctx.shadowBlur = 5 * dpr;
        ctx.fillStyle = c;
        if (b.kind === "objective" || b.kind === "loot") {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-r, -r, r * 2, r * 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        if (!reducedMotion) {
          const diff = (sweepDeg - angleOf(b.x, b.y) + 360) % 360;
          if (diff < 25) {
            const k = 1 - diff / 25;
            const fr = 10 * dpr;
            ctx.globalAlpha = 0.9 * k;
            ctx.shadowBlur = 0;
            const g = ctx.createRadialGradient(x, y, 0, x, y, fr);
            g.addColorStop(0, "rgba(255,255,255,0.9)");
            g.addColorStop(0.7, "rgba(255,255,255,0)");
            g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, fr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 3 }} />;
}

function ZoomButton({ glyph, active, onClick }: { glyph: string; active: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  const filter = pressed
    ? "drop-shadow(0 1px 1px rgba(0,0,0,.6)) brightness(1.32)"
    : hover
    ? "drop-shadow(0 5px 3px rgba(0,0,0,.55)) brightness(1.15)"
    : "drop-shadow(0 3px 2px rgba(0,0,0,.55))";
  return (
    <button aria-label={glyph === "+" ? "Zoom in" : "Zoom out"} onClick={onClick} {...handlers} style={{
      position: "relative", flex: "0 0 auto", width: 26, height: 26, padding: 0, border: "none", background: "none", cursor: "pointer",
      transform: pressed ? "translateY(3px)" : hover ? "translateY(-2px)" : "none", filter, transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
    }}>
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 45%,#2a3038)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#5c6878,#161b22)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)" }} />
      <span style={{ position: "absolute", inset: 3, display: "grid", placeItems: "center", overflow: "hidden", background: "linear-gradient(180deg,rgba(78,226,255,.16),rgba(8,10,16,.96))", boxShadow: "inset 0 2px 4px rgba(0,0,0,.6)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)" }}>
        <i style={{ position: "absolute", left: 4, right: 4, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(230,246,255,.7),transparent)" }} />
        <b style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800, color: active ? "#9fe0ff" : "rgba(120,150,185,.4)" }}>{glyph}</b>
      </span>
    </button>
  );
}

function MapButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const filter = active
    ? "brightness(1.32) drop-shadow(0 1px 1px rgba(0,0,0,.6))"
    : hover
    ? `drop-shadow(0 6px 3px rgba(0,0,0,.55)) drop-shadow(0 0 20px rgba(78,226,255,.6)) brightness(1.12)`
    : open
    ? "drop-shadow(0 4px 2px rgba(0,0,0,.55)) drop-shadow(0 0 20px rgba(78,226,255,.6))"
    : "drop-shadow(0 4px 2px rgba(0,0,0,.55)) drop-shadow(0 0 12px rgba(78,226,255,.25))";
  return (
    <button aria-label="Open sector chart" onClick={onClick} {...handlers} style={{
      position: "relative", flex: "0 0 auto", padding: 0, border: "none", background: "none", cursor: "pointer",
      transform: active ? "translateY(3px)" : hover ? "translateY(-2px)" : "none", filter, transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
    }}>
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 45%,#2a3038)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#5c6878,#161b22)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)" }} />
      <span style={{ position: "relative", display: "block", margin: 3, overflow: "hidden", background: open ? "linear-gradient(180deg,rgba(78,226,255,.4),rgba(8,10,16,.96))" : "linear-gradient(180deg,rgba(78,226,255,.16),rgba(8,10,16,.96))", boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,238,255,.14)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(200,235,255,.05) 0 1px,transparent 1px 4px)" }} />
        <i style={{ position: "absolute", left: 5, right: 5, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(230,246,255,.8),transparent)" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,#4ee2ff,transparent)", opacity: 0.7, animation: "cPulse 3s ease-in-out infinite" }} />
        <i style={{ position: "absolute", top: 0, left: "-40%", width: "24%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(255,255,255,.26),transparent)", transform: "skewX(-18deg)", animation: "cSweep 3.6s ease-in-out infinite" }} />
        <b style={{ position: "relative", display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.16em", fontWeight: 800, color: "#eaf4ff" }}>
          <i style={{ fontStyle: "normal", fontSize: 10.6, color: "#9fe0ff" }}>▣</i>MAP
        </b>
      </span>
    </button>
  );
}

export function MinimapPanel() {
  const player = useGame((s) => s.player);
  const showZoneMap = useGame((s) => s.showZoneMap);
  // Heavy per-entity lists redraw at 5Hz instead of every game tick,
  // matching the old Minimap's perf tuning.
  const enemies = useGameSlow((s) => s.enemies);
  const others = useGameSlow((s) => s.others);
  const asteroids = useGameSlow((s) => s.asteroids);
  const cargoBoxes = useGameSlow((s) => s.cargoBoxes);
  const [zoom, setZoom] = useState(2); // 1-4, matches MAP_GRID/RING/RANGE index

  const zoneDef = ZONES[player.zone];
  const zoneName = zoneDef ? `${zoneDef.name.toUpperCase()} · ${zoneDef.label}` : player.zone.toUpperCase();
  const range = [1200, 1800, 2600, 4200][zoom - 1];

  const toBlip = (dx: number, dy: number): { x: number; y: number } | null => {
    const x = 50 + (dx / range) * 50;
    const y = 50 + (dy / range) * 50;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x, y };
  };
  const blips: MinimapBlipData[] = [];
  for (const e of enemies) {
    const p = toBlip(e.pos.x - player.pos.x, e.pos.y - player.pos.y);
    if (p) blips.push({ ...p, kind: "hostile", title: e.name ?? e.type });
  }
  for (const o of others) {
    const p = toBlip(o.pos.x - player.pos.x, o.pos.y - player.pos.y);
    if (p) blips.push({ ...p, kind: "ally", title: o.name });
  }
  for (const a of asteroids) {
    if (a.zone !== player.zone) continue;
    const p = toBlip(a.pos.x - player.pos.x, a.pos.y - player.pos.y);
    if (p) blips.push({ ...p, kind: "resource", title: RESOURCES[a.yields]?.name ?? "Asteroid" });
  }
  for (const cb of cargoBoxes) {
    const p = toBlip(cb.pos.x - player.pos.x, cb.pos.y - player.pos.y);
    if (p) blips.push({ ...p, kind: "loot", title: "Cargo" });
  }

  const i = zoom - 1;
  const mapGrid = `${MAP_GRID[i]}px`;
  const ring1 = `${MAP_RING1[i]}%`, ring2 = `${MAP_RING2[i]}%`, ring3 = `${MAP_RING3[i]}%`;
  const mapRange = MAP_RANGE[i], mapContacts = MAP_CONTACTS[i];
  const mapRangeColor = zoom === 4 ? "#f0cd7a" : "#9fe0ff";

  // Kit original is 286px (Cosmic Kit.dc.html line 490) — every inner
  // font-size/gap/padding below is calibrated to that width. Shrinking
  // the box itself (200px, then 240px) broke that calibration: the
  // coords row's min-content width (X/Y/range text + 2 zoom buttons +
  // MAP button) no longer fit inside the smaller box, squeezing MAP
  // out. Right fix: keep the panel at its native 286px internally, then
  // scale the whole rendered result down uniformly with CSS transform —
  // every element shrinks together, nothing reflows or gets cramped.
  //
  // A transformed box keeps its NATIVE size for layout purposes, so the
  // outer wrapper measures the native box via ResizeObserver and reports
  // the true SCALED footprint (both width and height) to sibling HUD
  // panels — no guessed/hardcoded height, and no overflow:hidden that
  // could clip the bottom off (that was the earlier "half missing" bug).
  const SCALE = 0.82; // 286px wide * 0.82 ≈ 235px on screen
  const NATIVE_W = 286;
  // Fixed, not measured: the console's DOM structure (padding, hexagon
  // aspectRatio off the now-pinned 1fr column, coords row) is constant, so
  // its native height is deterministic — 426px, confirmed by live
  // measurement. A ResizeObserver here previously re-measured on every
  // sub-pixel layout tick (font rendering, the range-ring inset
  // transitions, etc.) and fed straight into the wrapper's reserved size,
  // making the whole panel visibly grow/shrink while flying. A constant
  // removes that jitter source entirely.
  const NATIVE_H = 426;

  return (
    <div style={{ width: Math.ceil(NATIVE_W * SCALE), height: Math.ceil(NATIVE_H * SCALE) }}>
    <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
    <div style={{ position: "relative", width: NATIVE_W, padding: 8, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 22px 26px rgba(0,0,0,.7)) drop-shadow(0 38px 48px rgba(0,0,0,.55)) drop-shadow(0 0 30px rgba(78,226,255,.16))" }}>
      <style>{MINIMAP_KEYFRAMES}</style>
      <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.42),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(18px 0,calc(100% - 18px) 0,100% 18px,100% calc(100% - 18px),calc(100% - 18px) 100%,18px 100%,0 calc(100% - 18px),0 18px)" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 40%,#3f4854 74%,#232932)", clipPath: "polygon(15px 0,calc(100% - 15px) 0,100% 15px,100% calc(100% - 15px),calc(100% - 15px) 100%,15px 100%,0 calc(100% - 15px),0 15px)" }} />
      <i style={{ position: "absolute", inset: 5, display: "block", background: "linear-gradient(135deg,#6f7b8c,#2b323d 52%,#0e1218)", clipPath: "polygon(13px 0,calc(100% - 13px) 0,100% 13px,100% calc(100% - 13px),calc(100% - 13px) 100%,13px 100%,0 calc(100% - 13px),0 13px)" }} />
      <i style={{ position: "absolute", inset: 6.5, display: "block", background: "linear-gradient(135deg,#152233,#050a12)", clipPath: "polygon(11.5px 0,calc(100% - 11.5px) 0,100% 11.5px,100% calc(100% - 11.5px),calc(100% - 11.5px) 100%,11.5px 100%,0 calc(100% - 11.5px),0 11.5px)" }} />

      <div style={{
        // gridTemplateColumns:"1fr" pins the (implicit, single) column
        // track to the container's own available width. Without it, a
        // grid item with aspectRatio:"1" and no explicit row height can
        // get its column track auto-sized from the item's OWN preferred
        // (aspect-ratio-driven) size instead of strictly from the parent
        // — confirmed live: the hexagon rendered 271.297px wide against a
        // 270px-wide content box, overflowing ~8.7px past the right edge
        // while a matching gap opened on the left (the console frame
        // clipping that overflow made it read as "missing" chrome).
        position: "relative", display: "grid", gridTemplateColumns: "1fr", gap: 9, padding: "11px 12px 12px", overflow: "hidden",
        background: "repeating-linear-gradient(90deg,rgba(140,190,220,.03) 0 1px,transparent 1px 3px),radial-gradient(620px 240px at 50% -22%,rgba(150,96,225,.32),rgba(96,44,168,.12) 48%,transparent 72%),linear-gradient(180deg,#2a1c3f,#120c1e 58%,#08050f)",
        boxShadow: "inset 0 3px 9px rgba(0,0,0,.72),inset 0 -1px 0 rgba(200,230,255,.16)",
        clipPath: "polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)",
      }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(74deg,transparent 0 26px,rgba(255,255,255,.03) 26px 27px,transparent 27px 61px),repeating-linear-gradient(-58deg,transparent 0 43px,rgba(255,255,255,.02) 43px 44px,transparent 44px 97px)", pointerEvents: "none" }} />
        {(["left", "right"] as const).map((s) => (
          <i key={s} style={{ position: "absolute", [s]: 7, top: 7, width: 5, height: 5, borderRadius: "50%", background: "radial-gradient(circle at 34% 30%,#e6eefa,#5b6675 52%,#12161d)", boxShadow: "0 1px 2px rgba(0,0,0,.85)", zIndex: 9, pointerEvents: "none" }} />
        ))}
        {(["left", "right"] as const).map((s) => (
          <i key={`${s}-b`} style={{ position: "absolute", [s]: 7, bottom: 7, width: 5, height: 5, borderRadius: "50%", background: "radial-gradient(circle at 34% 30%,#e6eefa,#5b6675 52%,#12161d)", boxShadow: "0 1px 2px rgba(0,0,0,.85)", zIndex: 9, pointerEvents: "none" }} />
        ))}
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(78,226,255,.55),transparent)", boxShadow: "0 0 12px rgba(78,226,255,.5)", pointerEvents: "none" }} />

        {/* zone header — minWidth:0 on the grid container + its flex/text
            children stops the long zone-name string from forcing this
            track (and the whole panel) wider than its box; without it a
            grid item's default min-width:auto lets content blow out the
            ancestor, same trap as Cargo's earlier scroll bug.
            War-status chip lives inline here, exactly like the Kit's own
            header row (Cosmic Kit.dc.html line 508: diamond + label +
            CONTESTED chip together) — not floating over the hexagon,
            which was never the Kit's placement and just ate scope space.
            Placeholder: the real game has no zone conflict-state field
            yet, so this always reads CONTESTED for now. */}
        <div style={{ position: "relative", minWidth: 0, display: "grid", gap: 5, padding: "7px 9px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,7,14,.7)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.07)", clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <i style={{ width: 7, height: 7, flex: "0 0 auto", background: "#4ee2ff", boxShadow: "0 0 9px #4ee2ff", transform: "rotate(45deg)", animation: "cPulse 1.9s ease-in-out infinite" }} />
            <small style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10.6, letterSpacing: "0.22em", color: "rgba(160,190,215,.6)", fontWeight: 700 }}>ZONE · {zoneDef?.label ?? "—"}</small>
            <span style={{ flex: "0 0 auto", padding: "3px 7px", fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, color: "#ffd0d5", border: "1px solid rgba(255,77,94,.5)", background: "rgba(60,10,20,.55)", clipPath: "polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)" }}>CONTESTED</span>
          </div>
          <b style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-display)", fontSize: 16.5, letterSpacing: "0.14em", color: "#9fe0ff", textShadow: "0 0 10px rgba(78,226,255,.5)" }}>{zoneName}</b>
        </div>

        {/* hexagon scope */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "1", padding: 7, boxSizing: "border-box", background: "linear-gradient(150deg,#f2f7ff,#8f9cae 32%,#39424f 66%,#141a24)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", filter: "drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 7px 9px rgba(0,0,0,.75)) drop-shadow(0 0 22px rgba(78,226,255,.28))" }}>
          <i style={{ position: "absolute", inset: 2.5, background: "linear-gradient(150deg,#5d6a7c,#222932 48%,#080c12)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
          <i style={{ position: "absolute", inset: 4.5, background: "linear-gradient(150deg,#111820,#04070c)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
          <div
            onClick={(e) => {
              // Inverse of toBlip(): click position -> 0-100% of the scope
              // box -> world-space delta from the player, scaled by the
              // same `range` the blips themselves use for this zoom level.
              const rect = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * 100;
              const py = ((e.clientY - rect.top) / rect.height) * 100;
              const dx = ((px - 50) / 50) * range;
              const dy = ((py - 50) / 50) * range;
              gameState.cameraTarget = { x: player.pos.x + dx, y: player.pos.y + dy };
              bump();
              window.dispatchEvent(new Event("cr-input-flush"));
            }}
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", cursor: "crosshair", background: "radial-gradient(circle at 50% 44%,#0b1a29,#04070e 78%)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", boxShadow: "inset 0 5px 14px rgba(0,0,0,.9),inset 0 0 28px rgba(78,226,255,.14),inset 0 -3px 8px rgba(0,0,0,.8)" }}>
            <i style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg,rgba(78,226,255,.09) 0 1px,transparent 1px ${mapGrid}),repeating-linear-gradient(90deg,rgba(78,226,255,.09) 0 1px,transparent 1px ${mapGrid})`, transition: "background-image .3s ease" }} />
            <i style={{ position: "absolute", inset: ring1, border: "1px solid rgba(78,226,255,.14)", borderRadius: "50%", transition: "inset .3s cubic-bezier(.2,.9,.25,1)" }} />
            <i style={{ position: "absolute", inset: ring2, border: "1px solid rgba(78,226,255,.12)", borderRadius: "50%", transition: "inset .3s cubic-bezier(.2,.9,.25,1)" }} />
            <i style={{ position: "absolute", inset: ring3, border: "1px solid rgba(78,226,255,.1)", borderRadius: "50%", transition: "inset .3s cubic-bezier(.2,.9,.25,1)" }} />
            <i style={{ position: "absolute", inset: "-18%", background: "conic-gradient(from 0deg,rgba(182,240,255,.42) 0deg,rgba(78,226,255,.2) 14deg,rgba(78,226,255,.05) 38deg,transparent 76deg)", animation: `cSpin ${SWEEP_PERIOD_S}s linear infinite` }} />
            <i style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "linear-gradient(90deg,transparent,rgba(78,226,255,.22),transparent)" }} />
            <i style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "linear-gradient(180deg,transparent,rgba(78,226,255,.22),transparent)" }} />
            <i style={{ position: "absolute", inset: "6%", borderRadius: "50%", background: "repeating-conic-gradient(from 0deg,rgba(157,242,255,.45) 0deg 0.5deg,transparent 0.5deg 15deg)", WebkitMask: "radial-gradient(circle,transparent 44%,#000 44%,#000 48%,transparent 48%)", mask: "radial-gradient(circle,transparent 44%,#000 44%,#000 48%,transparent 48%)" }} />
            <i style={{ position: "absolute", inset: "6%", borderRadius: "50%", background: "repeating-conic-gradient(from 0deg,rgba(157,242,255,.55) 0deg 0.8deg,transparent 0.8deg 90deg)", WebkitMask: "radial-gradient(circle,transparent 40%,#000 40%,#000 49%,transparent 49%)", mask: "radial-gradient(circle,transparent 40%,#000 40%,#000 49%,transparent 49%)" }} />
            <span style={{ position: "absolute", left: 0, right: 0, top: "28%", display: "flex", justifyContent: "space-between", padding: "0 11%", fontFamily: "var(--font-mono)", fontSize: 8.3, letterSpacing: "0.06em", color: "rgba(157,242,255,.5)" }}>
              <i style={{ fontStyle: "normal" }}>315</i><i style={{ fontStyle: "normal" }}>000</i><i style={{ fontStyle: "normal" }}>045</i>
            </span>
            <span style={{ position: "absolute", left: "9%", top: "44%", display: "grid", gap: 2, fontFamily: "var(--font-mono)", fontSize: 8.3, lineHeight: 1.5, letterSpacing: "0.04em", color: "rgba(157,242,255,.42)" }}>
              <i style={{ fontStyle: "normal" }}>SCAN 87%</i>
              <i style={{ fontStyle: "normal" }}>CTS {mapContacts}</i>
              <i style={{ fontStyle: "normal" }}>RNG{mapRange}</i>
            </span>
            <span style={{ position: "absolute", right: "9%", top: "44%", display: "grid", gap: 2, justifyItems: "end", fontFamily: "var(--font-mono)", fontSize: 8.3, lineHeight: 1.5, letterSpacing: "0.04em", color: "rgba(157,242,255,.42)" }}>
              <i style={{ fontStyle: "normal" }}>GRID {player.zone.slice(0, 6).toUpperCase()}</i>
              <i style={{ fontStyle: "normal" }}>HDG {Math.round(((player.angle ?? 0) * 180) / Math.PI) % 360}</i>
              <i style={{ fontStyle: "normal" }}>LOCK ▲</i>
            </span>

            <BlipCanvas blips={blips} />

            <i style={{ position: "absolute", left: "50%", top: "50%", width: 15, height: 1, transform: "translate(-50%,-14px)", background: "rgba(157,242,255,.5)" }} />
            <i style={{ position: "absolute", left: "50%", top: "50%", width: 1, height: 15, transform: "translate(-14px,-50%)", background: "rgba(157,242,255,.5)" }} />
            <i style={{ position: "absolute", left: "50%", top: "50%", width: 1, height: 15, transform: "translate(13px,-50%)", background: "rgba(157,242,255,.5)" }} />
            {/* Heading arrow — the CSS triangle points up by default (tip
                at top = north = the sprite-neutral pose), matching the
                Pixi world renderer's own `rotation = angle + PI/2`
                convention (pixi-renderer-v2-integrated.ts, e.g. line 2489)
                for the exact same reason: angle=0 is math-convention east,
                so it needs the extra +90 deg to point the up-drawn arrow
                the right way. */}
            <i style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, margin: "-9px 0 0 -6px", borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "15px solid #9fe0ff", transform: `rotate(${((player.angle ?? 0) * 180) / Math.PI + 90}deg)`, transformOrigin: "50% 61%", filter: "drop-shadow(0 0 8px rgba(78,226,255,.9))", zIndex: 4 }} />
            <i style={{ position: "absolute", left: "50%", top: "50%", width: 26, height: 26, border: "1px solid rgba(157,242,255,.35)", borderRadius: "50%", transform: "translate(-50%,-50%)", animation: "cPulse 2.4s ease-in-out infinite" }} />
            <b style={{ position: "absolute", left: "50%", top: 5, transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 9.4, color: "rgba(157,242,255,.75)" }}>N</b>
            <b style={{ position: "absolute", left: "50%", bottom: 5, transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 9.4, color: "rgba(157,242,255,.4)" }}>S</b>
            <b style={{ position: "absolute", left: 5, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 9.4, color: "rgba(157,242,255,.4)" }}>W</b>
            <b style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 9.4, color: "rgba(157,242,255,.4)" }}>E</b>
            <i style={{ position: "absolute", left: 0, right: 0, top: "-20%", height: "26%", background: "linear-gradient(180deg,transparent,rgba(182,240,255,.1) 62%,rgba(182,240,255,.3))", animation: "cBootScan 5.5s linear infinite", pointerEvents: "none" }} />
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
            <i style={{ position: "absolute", inset: 0, background: "linear-gradient(168deg,rgba(210,240,255,.16) 0%,rgba(210,240,255,.04) 26%,transparent 46%)", pointerEvents: "none" }} />
            <i style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 95% at 50% 42%,transparent 46%,rgba(0,0,0,.55) 100%)", pointerEvents: "none" }} />
          </div>
          {CLAMPS.map((c, ci) => (
            <i key={ci} style={{ position: "absolute", left: c.left, right: c.right, top: c.top, bottom: c.bottom, width: 16, height: 16, borderTop: `2px solid ${c.bt}`, borderLeft: `2px solid ${c.bl}`, borderRight: `2px solid ${c.br}`, borderBottom: `2px solid ${c.bb}`, filter: "drop-shadow(0 0 5px rgba(157,242,255,.5))" }} />
          ))}
        </div>

        {/* coords + controls — minWidth:0 here (not just on the inner
            coords <span>) is required: as a grid item, this row's default
            min-width:auto lets its children's combined intrinsic width
            force the whole grid column wider whenever the X/Y coordinate
            text changes length while flying (e.g. "X 62" vs "X -476"),
            which is exactly what was making the hexagon scope below it
            visibly grow/shrink — same trap fixed elsewhere this session,
            missed on this specific row. */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span style={{ flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,7,14,.7)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.07)" }}>
            <small style={{ flex: "0 0 auto", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "#2f88a8" }}>X</small>
            <b style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 11.2, color: "#9fe0ff", fontVariantNumeric: "tabular-nums" }}>{Math.round(player.pos.x)}</b>
            <small style={{ flex: "0 0 auto", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "#2f88a8" }}>Y</small>
            <b style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 11.2, color: "#9fe0ff", fontVariantNumeric: "tabular-nums" }}>{Math.round(player.pos.y)}</b>
            <i style={{ flex: "0 0 auto", width: 1, height: 11, background: "rgba(150,190,235,.22)" }} />
            <b style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 11.2, color: mapRangeColor, fontVariantNumeric: "tabular-nums", textShadow: "0 0 8px rgba(78,226,255,.45)" }}>{mapRange}</b>
          </span>
          <ZoomButton glyph="+" active={zoom < 4} onClick={() => setZoom((z) => Math.min(4, z + 1))} />
          <ZoomButton glyph="–" active={zoom > 1} onClick={() => setZoom((z) => Math.max(1, z - 1))} />
          <MapButton open={showZoneMap} onClick={() => { gameState.showZoneMap = !gameState.showZoneMap; bump(); }} />
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}
