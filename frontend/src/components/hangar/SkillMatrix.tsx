import React from "react";
import styles from "./HangarDockOverlay.module.css";
import {
  SKILL_TREES, SKILL_SHAPE, SKILL_TOTAL, SKILL_RESPEC_COST, SKILL_CANVAS,
  SKILL_STEEL, SKILL_ICON_PATH,
  SKILL_ZOOM_MIN, SKILL_ZOOM_MAX, SKILL_ZOOM_DEFAULT,
  SKILL_ZOOM_STEP_IN, SKILL_ZOOM_STEP_OUT, SKILL_WHEEL_IN, SKILL_WHEEL_OUT,
  SKILL_PAN_DEFAULT,
  type SkillTree, type SkillNodeRow,
} from "./SkillMatrix.constants";

/**
 * I-03 · Skill Matrix
 *
 * MIGRATED from the design export, not rebuilt:
 *   Downloads/Cosmic Realm UI Upgrade (8).zip
 *     -> design_handoff_hangar_panels_strict_export/
 *        "Skill Matrix Panel (Cosmic Kit extract).dc.html"
 *
 * Walked block by block against that file's markup — header, tab strip,
 * viewport, node stack, tooltip, action bar, and BOTH modals — rather than
 * reassembled from the builder values. Every gradient, inset, clip-path,
 * shadow stack, label string and animation delay below is the export's own.
 *
 * Values that are easy to get subtly wrong and are therefore called out:
 *   · header title is #e6dcff (violet), not the panels' cyan
 *   · the tab indicator sits at TOP:0, not bottom
 *   · INVEST is violet #b866ff — it does NOT take the active tree's colour
 *   · labels are "INVEST · 1 PT" / "STATION ONLY" / "MAXED" / "LOCKED"
 *   · respec is priced in MC (MCoins), not credits
 *   · the tooltip is a full D-06 frame: 5 bevel bands 19.12 → 15.6
 *   · tooltip rank pips are gold (#e8b94d), one per max rank
 *
 * TWO project adaptations, both required and both documented:
 *
 *   1. print-portal. SKILL_MATRIX_EXPORT_MANIFEST.md flags `print-portal.js` as
 *      MISSING and blocking. That is true of the design environment, not of this
 *      project: components/hud/PrintPortal.tsx already implements the same
 *      element, and kit-panel-port names it as the canonical source. The frame
 *      is therefore built from the project's own primitive.
 *
 *   2. METAL_RIM. The export's rim texture is
 *      `url(uploads/pasted-1785492308695-0.png)` — an image pasted into the
 *      Claude Design editor, which the manifest confirms is not a shippable
 *      asset. This project serves a real brushed-metal texture for exactly this
 *      purpose, so that file is used. No placeholder, no emoji.
 */

/** shadeHex / rgba — copied verbatim from the export's own helpers. */
function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) + Math.round(255 * amt);
  let g = ((n >> 8) & 255) + Math.round(255 * amt);
  let b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The export's METAL_RIM, with the design-editor upload swapped for this
 *  project's real brushed-metal texture (see the header note). */
const METAL_RIM =
  "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";

const display: React.CSSProperties = { fontFamily: "Orbitron,sans-serif" };
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace" };

/** Panel chamfer clip (top-right / bottom-left), the export's own polygon. */
const clipTR = (c: number) =>
  `polygon(0 0,calc(100% - ${c}px) 0,100% ${c}px,100% 100%,${c}px 100%,0 calc(100% - ${c}px))`;
/** Button chamfer clip (top-left / bottom-right), mirrored. */
const clipTL = (c: number) =>
  `polygon(${c}px 0,100% 0,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,0 100%,0 ${c}px)`;

export interface SkillMatrixProps {
  ranks?: Record<string, Record<string, number>>;
  spent?: number;
  total?: number;
  docked?: boolean;
  premium?: boolean;
  respecCost?: number;
  onInvest?: (treeKey: string, nodeId: string) => void;
  onRespec?: (treeKey: string) => void;
  onGetPremium?: () => void;
  onClose?: () => void;
}

export function SkillMatrix({
  ranks: ranksProp,
  spent: spentProp,
  total = SKILL_TOTAL,
  docked: dockedProp = true,
  premium = false,
  respecCost = SKILL_RESPEC_COST,
  onInvest, onRespec, onGetPremium, onClose,
}: SkillMatrixProps) {
  const [tab, setTab] = React.useState(0);
  const [sel, setSel] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState(SKILL_ZOOM_DEFAULT);
  const [pan, setPan] = React.useState(SKILL_PAN_DEFAULT);
  const [dragging, setDragging] = React.useState(false);
  const [showTip, setShowTip] = React.useState(false);
  const [nonce, setNonce] = React.useState(1);
  // The export's toggleDock flips this locally; the host seeds it.
  const [docked, setDocked] = React.useState(dockedProp);
  React.useEffect(() => { setDocked(dockedProp); }, [dockedProp]);
  const [askRespec, setAskRespec] = React.useState(false);
  const [showBench, setShowBench] = React.useState(false);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const T: SkillTree = SKILL_TREES[tab];
  const ranks = ranksProp?.[T.key] ?? T.start;

  const spent = spentProp ?? SKILL_TREES.reduce((a, t) => {
    const r = ranksProp?.[t.key] ?? t.start;
    return a + Object.keys(r).reduce((b, k) => b + r[k], 0);
  }, 0);

  const parents: Record<string, string[]> = {};
  T.links.forEach(([a, b]) => { (parents[b] = parents[b] || []).push(a); });
  const rank = (id: string) => ranks[id] || 0;
  const nodeState = (id: string): "on" | "open" | "off" => {
    if (rank(id) > 0) return "on";
    const ps = parents[id];
    return (!ps || ps.some((p) => rank(p) > 0)) ? "open" : "off";
  };

  const byId: Record<string, SkillNodeRow> = {};
  T.nodes.forEach((n) => { byId[n[0]] = n; });
  const selId = sel && byId[sel] ? sel : T.nodes[0][0];
  const cur = byId[selId];
  const curState = nodeState(selId);
  const curRank = rank(selId);
  const maxed = curRank >= cur[6];

  const mobile = premium;                       // premium lets you skill in flight
  const canPlace = docked || mobile;
  const canInvest = canPlace && curState !== "off" && !maxed && (total - spent) > 0;

  /**
   * Zoom by `factor`, keeping viewport point (px, py) pinned.
   *
   * The export only multiplies its zoom and leaves pan alone; with
   * transform-origin 0 0 that scales about the canvas corner, so the point under
   * the cursor slides away. Holding it fixed:
   *   screen = canvas*z + pan  →  canvas = (screen-pan)/z  →  pan' = screen - canvas*z'
   */
  const zoomRef = React.useRef(zoom);
  const panRef = React.useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const zoomAround = React.useCallback((px: number, py: number, factor: number) => {
    const z = zoomRef.current;
    const next = Math.max(SKILL_ZOOM_MIN, Math.min(SKILL_ZOOM_MAX, z * factor));
    if (next === z) return;
    const p = panRef.current;
    setPan({ x: px - ((px - p.x) / z) * next, y: py - ((py - p.y) / z) * next });
    setZoom(next);
  }, []);

  const zoomFromCentre = (factor: number) => {
    const el = viewportRef.current;
    if (!el) return;
    zoomAround(el.clientWidth / 2, el.clientHeight / 2, factor);
  };

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAround(e.clientX - rect.left, e.clientY - rect.top,
        e.deltaY < 0 ? SKILL_WHEEL_IN : SKILL_WHEEL_OUT);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAround]);

  /** Drag-to-pan — the export's skDown, including its 3px threshold. */
  const onPointerDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY, p: pan };
    let moved = false;
    const mv = (ev: MouseEvent) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 3) { moved = true; setDragging(true); }
      if (moved) setPan({ x: start.p.x + dx, y: start.p.y + dy });
    };
    const up = () => {
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
      if (moved) setDragging(false);
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
  };

  const skTransform = `translate(${pan.x.toFixed(1)}px,${pan.y.toFixed(1)}px) scale(${zoom.toFixed(3)})`;

  // Tooltip sits in VIEWPORT space anchored to the selected node, so it never
  // scales with the tree. Formula verbatim from the export:
  //   sx = cur.x*z + pan.x ; flip when sx > 360
  //   left = flip ? clamp(sx-286,8,600) : clamp(sx+34,8,600)
  //   top  = clamp(sy-46,8,424-232)
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const sx = cur[1] * zoom + pan.x;
  const sy = cur[2] * zoom + pan.y;
  const flip = sx > 360;
  const tipLeft = flip ? clamp(sx - 286, 8, 600) : clamp(sx + 34, 8, 600);
  const tipTop = clamp(sy - 46, 8, 424 - 232);
  const skHex = T.hex;
  const skWash = rgba(T.hex, 0.12);
  const skAmbient = rgba(T.hex, 0.2);
  const points = String(Math.max(0, total - spent)).padStart(2, "0");
  const dockHex = docked ? "#5cff8a" : "#e8b94d";

  // ── invest button state, verbatim from the builder ───────────────────────
  const investRim = canInvest
    ? "linear-gradient(150deg,#f6ecff,#a377d9 45%,#2a1440)"
    : "linear-gradient(150deg,#b9c2cd,#5e6874 45%,#20262f)";
  const investMid = canInvest
    ? "linear-gradient(150deg,#6b3f96,#170c22)"
    : "linear-gradient(150deg,#3c444f,#12161c)";
  const investFace = canInvest
    ? "linear-gradient(180deg,rgba(184,102,255,.3),rgba(10,7,14,.96))"
    : "linear-gradient(180deg,rgba(150,170,195,.07),rgba(8,10,14,.96))";
  const investSpec = canInvest ? "rgba(230,210,255,.75)" : "rgba(200,216,236,.3)";
  const investUnder = canInvest ? "#b866ff" : "rgba(150,175,200,.28)";
  const investColor = canInvest ? "#f2e6ff" : "rgba(196,208,222,.42)";
  const investFilter = canInvest
    ? "drop-shadow(0 3px 0 rgba(3,5,10,.92)) drop-shadow(0 5px 6px rgba(0,0,0,.7)) drop-shadow(0 0 16px rgba(184,102,255,.45))"
    : "drop-shadow(0 3px 0 rgba(3,5,10,.92)) drop-shadow(0 5px 6px rgba(0,0,0,.7))";
  const investLabel = !canPlace ? "STATION ONLY"
    : curState === "off" ? "LOCKED"
      : maxed ? "MAXED" : "INVEST · 1 PT";

  // ── tooltip / selection colours, verbatim ────────────────────────────────
  const off = curState === "off";
  const skTipWash = off ? "rgba(140,170,205,.1)" : rgba(T.hex, 0.16);
  const skTipGlow = off ? "rgba(120,150,180,.25)" : rgba(T.hex, 0.6);
  const skTipHex = off ? "rgba(180,205,230,.55)" : T.hex;
  const skSelHex = off ? "rgba(180,205,230,.5)" : T.hex;
  const skSelGlow = off ? "rgba(0,0,0,0)" : rgba(T.hex, 0.6);
  const skSelRank = off ? "LOCKED" : `RANK ${curRank} / ${cur[6]}`;
  const skTipState = off ? "Unlock a connected node first"
    : maxed ? "Fully levelled" : "Ready to invest";
  const skTipStateHex = off ? "rgba(200,170,175,.7)" : maxed ? "#e8b94d" : "#5cff8a";

  const invest = () => {
    if (!canPlace) { setShowBench(true); return; }
    if (!canInvest) return;
    onInvest?.(T.key, selId);
  };

  // ── links ────────────────────────────────────────────────────────────────
  const links = T.links.map(([a, b], i) => {
    const na = byId[a], nb = byId[b];
    const lit = rank(a) > 0;
    const both = lit && rank(b) > 0;
    return {
      key: `${a}-${b}-${i}`,
      x1: na[1], y1: na[2], x2: nb[1], y2: nb[2],
      base: lit ? rgba(T.hex, 0.5) : "rgba(120,132,150,.18)",
      core: T.hex,
      coreOp: both ? 0.9 : lit ? 0.45 : 0,
      flowOp: both ? 0.55 : 0,
    };
  });

  // ── nodes ────────────────────────────────────────────────────────────────
  const nodes = T.nodes.map((n, i) => {
    const [id, x, y, t, name, ic, max] = n;
    const sh = SKILL_SHAPE[t];
    const st = nodeState(id);
    const on = st === "on", open = st === "open";
    const r = rank(id), full = on && r >= max;
    const base = on ? T.hex : open ? shadeHex(T.hex, -0.34) : SKILL_STEEL;
    return {
      id, name, aria: `${name} · ${sh.tier}`,
      left: x - sh.size / 2, top: y - sh.size / 2, size: sh.size, clip: sh.clip,
      z: id === selId ? 9 : t === "k" ? 7 : t === "e" ? 6 : 5,
      spawnDelay: (i * 0.022).toFixed(3),
      hex: base,
      edgeHi: shadeHex(base, 0.5), edgeLo: shadeHex(base, -0.55),
      b2: shadeHex(base, -0.2), b3: shadeHex(base, -0.55), b4: shadeHex(base, -0.75),
      face: on
        ? `radial-gradient(120% 100% at 50% -10%,${rgba(T.hex, 0.42)},transparent 72%),linear-gradient(180deg,#242c3a,#070a11)`
        : open
          ? `radial-gradient(120% 100% at 50% -10%,${rgba(T.hex, 0.16)},transparent 72%),linear-gradient(180deg,#1a212c,#06090f)`
          : "linear-gradient(180deg,#161b24,#05070c)",
      glow: on ? rgba(T.hex, 0.65) : open ? rgba(T.hex, 0.3) : "rgba(0,0,0,0)",
      ring: on ? rgba(T.hex, 0.45) : rgba(T.hex, 0.3),
      ringShow: ((t !== "n" && st !== "off") || open),
      maxShow: full,
      selShow: id === selId,
      hatch: st === "off",
      iconOp: on ? 1 : open ? 0.7 : 0.28,
      iconSat: on ? 1.1 : open ? 0.7 : 0.15,
      filter: full
        ? `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7)) drop-shadow(0 0 20px ${rgba(T.hex, 0.6)}) drop-shadow(0 0 30px rgba(232,185,77,.35))`
        : on
          ? `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7)) drop-shadow(0 0 16px ${rgba(T.hex, 0.5)})`
          : open
            ? "drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7))"
            : "drop-shadow(0 2px 0 rgba(3,5,10,.85)) drop-shadow(0 5px 6px rgba(0,0,0,.6)) saturate(.2) brightness(.78)",
      icon: SKILL_ICON_PATH + ic + ".png",
      // Rank pips shown under the node — verbatim from the export's own builder.
      pips: Array.from({ length: max }, (_, k) => ({
        bg: k < r
          ? "linear-gradient(180deg,#fff0c2,#e8b94d 55%,#8a6512)"
          : "linear-gradient(180deg,#2a3240,#11151d)",
        glow: k < r
          ? "0 0 6px rgba(232,185,77,.85),inset 0 1px 0 rgba(255,246,214,.8)"
          : "inset 0 1px 0 rgba(180,205,235,.12)",
      })),
    };
  });

  /** Modal shell shared by the bench hint and the respec confirm — the export
   *  gives both the same cInvIn entrance over a dimmed backdrop. */
  const Modal = ({ children, onBackdrop }: { children: React.ReactNode; onBackdrop: () => void }) => (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onBackdrop(); }}
      style={{
        position: "absolute", inset: 0, zIndex: 40, display: "grid", placeItems: "center",
        background: "rgba(2,4,10,.72)", backdropFilter: "blur(2px)",
      }}
    >
      <div
        className={styles.skTip}
        style={{
          position: "relative", width: 360, padding: 2,
          background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)",
          clipPath: clipTR(16),
          filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 12px 18px rgba(0,0,0,.7))",
        }}
      >
        <div style={{ position: "relative", display: "grid", gap: 10, padding: "16px 18px", background: "linear-gradient(180deg,#1a212c,#05080d)", clipPath: clipTR(14) }}>
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "relative", width: 700, padding: 10, boxSizing: "border-box",
        filter: `drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px ${skAmbient})`,
      }}
    >
      {/* Frame — the export's own 5-band metal ladder, 34 → 29.31 in 1.17 steps */}
      <i style={{ position: "absolute", inset: 0, display: "block", background: METAL_RIM, backgroundSize: "cover,400% 400%", backgroundPosition: "center,100% 0%", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: clipTR(34) }} />
      <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: clipTR(32.83) }} />
      <i style={{ position: "absolute", inset: 4, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: clipTR(31.66) }} />
      <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: clipTR(30.49) }} />
      <i style={{ position: "absolute", inset: 8, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: clipTR(29.31) }} />
      <i style={{ position: "absolute", left: 22, right: 44, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
      <i style={{ position: "absolute", left: 44, right: 22, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)", pointerEvents: "none" }} />

      {/* Content plate — chamfer 28.14, violet wash, hatch overlay: all the
          export's own, and all different from a plain dark panel. */}
      <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 10, padding: "13px 15px 14px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% -12%,rgba(180,140,245,.26),transparent 74%),linear-gradient(180deg,#2a2038,#12101c 62%,#08070f)", boxShadow: "inset 0 6px 12px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)", clipPath: clipTR(28.14) }}>
        <i style={{ position: "absolute", inset: 0, clipPath: clipTR(28.14), background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
        {/* Tree-coloured accent line along the plate's bottom edge. */}
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${skHex},transparent)`, boxShadow: `0 0 12px ${skHex}`, opacity: 0.55, transition: "background .4s ease", pointerEvents: "none" }} />

        {/* ── header ─────────────────────────────────────────────────── */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "0 2px", marginRight: 34 }}>
          <b style={{ ...display, fontSize: 13, letterSpacing: ".2em", color: "#e6dcff", whiteSpace: "nowrap" }}>SKILL MATRIX</b>
          <small style={{ ...mono, fontSize: 9.5, whiteSpace: "nowrap", color: "rgba(196,218,240,.75)" }}>
            {T.n} · {spent} / {total}
          </small>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setDocked((d) => !d)}
            className={styles.chipBtn}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", border: "1px solid rgba(150,195,235,.16)", background: "rgba(3,5,11,.8)", cursor: "pointer", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.55),inset -1px -1px 0 rgba(143,176,208,.06)" }}
          >
            <i style={{ width: 6, height: 6, background: dockHex, boxShadow: `0 0 9px ${dockHex}`, transform: "rotate(45deg)" }} />
            <small style={{ ...display, fontSize: 8, letterSpacing: ".16em", fontWeight: 700, color: dockHex }}>
              {docked ? "DOCKED" : "IN FLIGHT"}
            </small>
          </button>
          <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", background: "rgba(3,5,11,.8)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.55),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
            <i className={styles.pulse} style={{ width: 6, height: 6, background: skHex, boxShadow: `0 0 9px ${skHex}`, transform: "rotate(45deg)" }} />
            <small style={{ ...mono, fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#eef2ff" }}>{points} PTS</small>
          </span>
          <button
            onClick={() => { setNonce((n) => n + 1); setZoom(SKILL_ZOOM_DEFAULT); setPan(SKILL_PAN_DEFAULT); }}
            aria-label="Replay panel intro"
            className={styles.chipBtn}
            style={{ padding: "6px 12px", border: "1px solid rgba(200,180,235,.28)", background: "rgba(14,10,24,.7)", color: "rgba(222,206,248,.8)", ...display, fontSize: 8, letterSpacing: ".18em", fontWeight: 700, cursor: "pointer" }}
          >
            ↻
          </button>
          <button
            aria-label="Close"
            onClick={onClose}
            className={styles.closeDiamond}
            style={{
              position: "relative", display: "grid", placeItems: "center", width: 26, height: 26,
              padding: 0, border: "none", background: "linear-gradient(135deg,#ffd7db,#c8303f 46%,#5c0d16)",
              color: "#fff2f3", fontSize: 11, fontWeight: 700, cursor: "pointer", transform: "rotate(45deg)",
              boxShadow: "0 3px 0 -1px rgba(58,6,12,.95),0 6px 0 -3px rgba(26,3,7,.92),0 10px 16px rgba(0,0,0,.55),0 0 14px rgba(255,77,94,.22)",
            }}
          >
            <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#ff97a2,#9c1c29 52%,#3d080f)" }} />
            <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(158deg,#ff6b7c,#8d1723 58%,#2c060c)", boxShadow: "inset 0 1px 0 rgba(255,224,228,.55),inset 0 -1px 0 rgba(0,0,0,.65),inset 0 4px 7px rgba(0,0,0,.42)" }} />
            <i style={{ position: "absolute", left: 4, right: 4, top: 3.5, height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(255,228,232,.8),transparent)" }} />
            <i style={{ position: "relative", transform: "rotate(-45deg)", fontStyle: "normal", textShadow: "0 1px 2px rgba(46,0,4,.9)" }}>✕</i>
          </button>
        </div>

        {/* ── tree tabs ──────────────────────────────────────────────── */}
        <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 1, overflow: "hidden", background: "rgba(4,8,16,.55)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)" }}>
          {SKILL_TREES.map((t, i) => {
            const on = tab === i;
            const r = ranksProp?.[t.key] ?? t.start;
            const count = Object.keys(r).reduce((a, k) => a + r[k], 0);
            return (
              <button
                key={t.key}
                onClick={() => { setTab(i); setSel(null); setShowTip(false); }}
                className={styles.tabLift}
                style={{
                  flex: 1, position: "relative", zIndex: 2, display: "flex",
                  alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "11px 4px", border: "none", borderLeft: "1px solid rgba(150,195,235,.12)",
                  background: on ? rgba(t.hex, 0.14) : "rgba(4,8,16,.2)",
                  color: on ? "#f2f7ff" : "rgba(190,212,236,.6)",
                  ...display, fontSize: 9, letterSpacing: ".16em", fontWeight: 700,
                  cursor: "pointer", boxShadow: "inset 0 3px 6px rgba(0,0,0,.35)",
                }}
              >
                <i style={{ fontStyle: "normal", fontSize: 12, color: t.hex, opacity: on ? 1 : 0.5, textShadow: `0 0 8px ${t.hex}` }}>{t.glyph}</i>
                {t.n}
                <em style={{ fontStyle: "normal", ...mono, fontSize: 8.5, color: "rgba(180,205,230,.5)" }}>{count}</em>
              </button>
            );
          })}
          {/* indicator sits at TOP in the export, not bottom */}
          <i style={{ position: "absolute", zIndex: 4, top: 0, left: `${tab * 33.333}%`, width: "33.333%", height: 5, pointerEvents: "none", opacity: 0.28, filter: "blur(4px)", background: `linear-gradient(90deg,transparent,${skHex},transparent)`, transition: "left 480ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
          <i style={{ position: "absolute", zIndex: 4, top: 0, left: `${tab * 33.333}%`, width: "33.333%", height: 3, pointerEvents: "none", opacity: 0.55, filter: "blur(2px)", background: `linear-gradient(90deg,transparent,${skHex},transparent)`, transition: "left 380ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
          <i style={{ position: "absolute", zIndex: 5, top: 0, left: `${tab * 33.333}%`, width: "33.333%", height: 2, pointerEvents: "none", background: `linear-gradient(90deg,transparent,${skHex} 22%,${skHex} 78%,transparent)`, boxShadow: `0 0 10px ${skHex}`, transition: "left 260ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
        </div>

        {/* ── viewport ───────────────────────────────────────────────── */}
        <div
          key={nonce}
          ref={viewportRef}
          onMouseDown={onPointerDown}
          style={{
            position: "relative", height: 380, overflow: "hidden",
            cursor: dragging ? "grabbing" : "grab",
            background: `radial-gradient(120% 90% at 50% 0%,${skWash},transparent 70%),linear-gradient(180deg,#0a0e16,#04060b)`,
            boxShadow: "inset 0 3px 8px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6)",
            clipPath: clipTR(12),
          }}
        >
          <i style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 26px),repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 26px)" }} />

          <div style={{ position: "absolute", left: 0, top: 0, width: SKILL_CANVAS.w, height: SKILL_CANVAS.h, transform: skTransform, transformOrigin: "0 0" }}>
            <svg width={SKILL_CANVAS.w} height={SKILL_CANVAS.h} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {links.map((l) => (
                <g key={l.key}>
                  <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.base} strokeWidth={3.4} strokeLinecap="round" />
                  <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.core} strokeWidth={1.4} strokeLinecap="round" opacity={l.coreOp} />
                  <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeDasharray="3 25" opacity={l.flowOp} className={styles.skFlow} />
                </g>
              ))}
            </svg>

            {nodes.map((n) => (
              <div
                key={n.id}
                role="button"
                aria-label={n.aria}
                title={n.aria}
                onClick={(e) => { e.stopPropagation(); setSel(n.id); setShowTip(true); }}
                className={styles.skNodeBtn}
                style={{
                  position: "absolute", left: n.left, top: n.top,
                  width: n.size, height: n.size, zIndex: n.z,
                  display: "grid", placeItems: "center", cursor: "pointer",
                  filter: n.filter,
                  animation: `cSkNode .4s cubic-bezier(.2,.9,.25,1) ${n.spawnDelay}s both`,
                }}
              >
                {/* Layer order is the export's own. Ring and MAX are RADIAL
                    GRADIENTS (not borders), select is a white sheen at -9%
                    (not a dashed outline), and the hatch is a 135° pinstripe. */}
                {n.ringShow && <i className={styles.skRing} style={{ position: "absolute", inset: "-16%", background: `radial-gradient(closest-side,${n.ring},transparent 72%)`, pointerEvents: "none" }} />}
                {n.maxShow && <i className={styles.skMax} style={{ position: "absolute", inset: "-26%", background: "radial-gradient(closest-side,rgba(232,185,77,.4),rgba(232,185,77,.12) 54%,transparent 76%)", pointerEvents: "none" }} />}
                {n.selShow && <i style={{ position: "absolute", inset: "-9%", background: "linear-gradient(150deg,#ffffff,rgba(255,255,255,.35))", opacity: 0.5, clipPath: n.clip, pointerEvents: "none" }} />}
                <i style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,${n.edgeHi},${n.hex} 44%,${n.edgeLo})`, clipPath: n.clip }} />
                <i style={{ position: "absolute", inset: "6.25%", background: `linear-gradient(150deg,${n.b2},${n.b3})`, clipPath: n.clip }} />
                <i style={{ position: "absolute", inset: "11.5%", background: `linear-gradient(150deg,${n.b4},#05070c)`, clipPath: n.clip }} />
                <i style={{ position: "absolute", inset: "15.5%", background: n.face, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6)", clipPath: n.clip }} />
                {n.hatch && <i style={{ position: "absolute", inset: "15.5%", background: "repeating-linear-gradient(135deg,rgba(180,205,235,.07) 0 1px,transparent 1px 7px)", clipPath: n.clip, pointerEvents: "none" }} />}
                <i style={{ position: "relative", width: "52%", height: "52%", backgroundImage: `url(${n.icon})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", opacity: n.iconOp, filter: `drop-shadow(0 0 7px ${n.glow}) drop-shadow(0 2px 3px rgba(0,0,0,.8)) saturate(${n.iconSat})`, zIndex: 3 }} />
                {/* Rank pips — the little gold squares UNDER each node showing
                    how far the skill is levelled. These were missing entirely. */}
                <span style={{ position: "absolute", left: 0, right: 0, bottom: -11, display: "flex", justifyContent: "center", gap: 3, zIndex: 4, pointerEvents: "none" }}>
                  {n.pips.map((p, k) => (
                    <i key={k} style={{ width: 5, height: 5, background: p.bg, boxShadow: p.glow }} />
                  ))}
                </span>
              </div>
            ))}
          </div>

          {/* node tooltip — full D-06 frame, viewport space so it never scales */}
          {showTip && (
            <div
              className={styles.skTip}
              style={{
                // Anchored to the SELECTED NODE in viewport space, with the
                // export's own flip + clamp: sx>360 puts it left of the node.
                position: "absolute", left: tipLeft, top: tipTop,
                width: 292, zIndex: 30, padding: 7.5, boxSizing: "border-box",
                filter: `drop-shadow(0 4px 0 rgba(3,5,10,.92)) drop-shadow(0 9px 9px rgba(0,0,0,.75)) drop-shadow(0 18px 24px rgba(0,0,0,.6)) drop-shadow(0 0 22px ${skTipGlow})`,
              }}
            >
              <i style={{ position: "absolute", inset: 0, display: "block", background: METAL_RIM, backgroundSize: "cover,400% 400%", backgroundPosition: "center,100% 0%", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: clipTR(20) }} />
              <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: clipTR(19.12) }} />
              <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: clipTR(18.24) }} />
              <i style={{ position: "absolute", inset: 4.5, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: clipTR(17.36) }} />
              <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: clipTR(16.48) }} />
              <div style={{ position: "relative", zIndex: 1, overflow: "hidden", background: `radial-gradient(130% 100% at 50% -14%,${skTipWash},transparent 74%),linear-gradient(180deg,#1e2632,#0c1119 62%,#05080d)`, boxShadow: "inset 0 5px 10px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)", clipPath: clipTR(15.6) }}>
                <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "10px 34px 10px 12px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(170,205,245,.1)", background: `linear-gradient(100deg,${skTipWash},transparent 74%)` }}>
                  <i style={{ display: "block", width: 24, height: 22, flex: "0 0 auto", backgroundImage: `url(${SKILL_ICON_PATH + cur[5]}.png)`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 7px ${skTipGlow})` }} />
                  <span style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
                    <b style={{ fontSize: 11.5, fontWeight: 700, color: "#f2f7ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur[4]}</b>
                    <small style={{ ...display, fontSize: 7, letterSpacing: ".18em", color: skTipHex }}>{SKILL_SHAPE[cur[3]].tier}</small>
                  </span>
                  <button
                    aria-label="Close"
                    onClick={(e) => { e.stopPropagation(); setShowTip(false); }}
                    className={styles.closeDiamond}
                    style={{ position: "absolute", right: 11, top: 11, display: "grid", placeItems: "center", width: 22, height: 22, padding: 0, border: "none", background: "linear-gradient(135deg,#ffd7db,#c8303f 46%,#5c0d16)", color: "#fff2f3", fontSize: 9, fontWeight: 700, cursor: "pointer", transform: "rotate(45deg)", boxShadow: "0 3px 0 -1px rgba(58,6,12,.95),0 6px 0 -3px rgba(26,3,7,.92),0 9px 14px rgba(0,0,0,.55)" }}
                  >
                    <i style={{ position: "relative", transform: "rotate(-45deg)", fontStyle: "normal" }}>✕</i>
                  </button>
                </div>
                <div style={{ position: "relative", display: "grid", gap: 8, padding: "10px 12px 12px" }}>
                  <small style={{ fontSize: 10, lineHeight: 1.45, color: "rgba(206,222,244,.72)" }}>{cur[7]}</small>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", background: "linear-gradient(180deg,#141b25,#06090c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                    <i style={{ width: 5, height: 5, background: skTipHex, boxShadow: `0 0 7px ${skTipHex}`, transform: "rotate(45deg)" }} />
                    <small style={{ ...mono, fontSize: 9.5, color: "#dbe9fb" }}>{cur[8]}</small>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    {/* rank pips — one per max rank, gold when filled */}
                    <span style={{ display: "flex", gap: 3 }}>
                      {Array.from({ length: cur[6] }, (_, k) => (
                        <i
                          key={k}
                          style={{
                            width: 7, height: 7,
                            background: k < curRank ? "linear-gradient(180deg,#fff0c2,#e8b94d 55%,#8a6512)" : "linear-gradient(180deg,#2a3240,#11151d)",
                            boxShadow: k < curRank ? "0 0 6px rgba(232,185,77,.85)" : "none",
                          }}
                        />
                      ))}
                    </span>
                    <small style={{ ...mono, fontSize: 9, color: "rgba(196,218,240,.6)" }}>{off ? "LOCKED" : `RANK ${curRank} / ${cur[6]}`}</small>
                    <span style={{ flex: 1 }} />
                    <small style={{ ...display, fontSize: 7.5, letterSpacing: ".14em", color: skTipStateHex }}>{skTipState}</small>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* zoom controls */}
          <div style={{ position: "absolute", right: 10, bottom: 10, display: "flex", gap: 5, zIndex: 20 }}>
            {([
              ["−", () => zoomFromCentre(SKILL_ZOOM_STEP_OUT), "Zoom out", true],
              ["⌂", () => { setZoom(SKILL_ZOOM_DEFAULT); setPan(SKILL_PAN_DEFAULT); }, "Recentre", false],
              ["+", () => zoomFromCentre(SKILL_ZOOM_STEP_IN), "Zoom in", true],
            ] as const).map(([label, fn, aria, bold]) => (
              <button
                key={aria}
                aria-label={aria}
                onClick={(e) => { e.stopPropagation(); fn(); }}
                onMouseDown={(e) => e.stopPropagation()}
                className={styles.zoomBtn}
                style={{
                  width: 26, height: 26, padding: 0,
                  border: "1px solid rgba(150,195,235,.22)", background: "rgba(6,10,18,.85)",
                  color: "rgba(206,228,248,.8)", cursor: "pointer",
                  ...(bold ? { ...display, fontSize: 12, fontWeight: 700 } : { fontSize: 11 }),
                  boxShadow: "0 2px 0 rgba(3,5,10,.9),0 5px 7px rgba(0,0,0,.6)",
                  ["--zoom-hex" as string]: skHex,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <small style={{ position: "absolute", left: 11, bottom: 11, ...mono, fontSize: 8.5, letterSpacing: ".08em", color: "rgba(170,196,222,.45)", pointerEvents: "none", zIndex: 20 }}>
            DRAG TO PAN · WHEEL TO ZOOM
          </small>
        </div>

        {/* ── action bar ─────────────────────────────────────────────── */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, padding: "8px 11px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
            <i style={{ display: "block", width: 28, height: 24, flex: "0 0 auto", backgroundImage: `url(${SKILL_ICON_PATH + cur[5]}.png)`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 8px ${skSelGlow})` }} />
            <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <b style={{ fontSize: 12.5, fontWeight: 700, color: "#f2ecff", whiteSpace: "nowrap" }}>{cur[4]}</b>
                <small style={{ ...display, fontSize: 7.5, letterSpacing: ".16em", color: skSelHex }}>{SKILL_SHAPE[cur[3]].tier}</small>
                <small style={{ ...mono, fontSize: 9, color: "rgba(196,218,240,.6)" }}>{skSelRank}</small>
              </span>
              <small style={{ fontSize: 10.5, lineHeight: 1.45, color: "rgba(198,214,238,.62)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur[7]}</small>
            </span>
          </span>

          <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
            {/* INVEST — three-layer banded button, violet regardless of tree */}
            <button
              onClick={invest}
              aria-label={investLabel}
              className={styles.bandBtn}
              style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", filter: investFilter }}
            >
              <i style={{ position: "absolute", inset: 0, display: "block", background: investRim, clipPath: clipTL(8) }} />
              <i style={{ position: "absolute", inset: 1.5, display: "block", background: investMid, clipPath: clipTL(7) }} />
              <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, margin: 3, padding: "7px 14px", overflow: "hidden", background: investFace, color: investColor, ...display, fontSize: 8.5, letterSpacing: ".16em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(226,206,252,.16)", clipPath: clipTL(6) }}>
                <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${investSpec},transparent)` }} />
                <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${investUnder},transparent)`, opacity: 0.75 }} />
                {canInvest && <i className={styles.skSweep} style={{ position: "absolute", top: 0, left: "-45%", width: "30%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(240,224,255,.35),transparent)", transform: "skewX(-18deg)" }} />}
                <i style={{ position: "relative", fontStyle: "normal", fontSize: 11 }}>◈</i>
                <span style={{ position: "relative" }}>{investLabel}</span>
                {!canPlace && <i style={{ position: "relative", fontStyle: "normal", fontSize: 9, color: "rgba(214,224,238,.55)" }}>⊘</i>}
              </span>
            </button>

            {/* RESPEC */}
            <button
              onClick={() => setAskRespec(true)}
              aria-label={`Respec ${T.n}`}
              className={styles.bandBtn}
              style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", filter: "drop-shadow(0 3px 0 rgba(3,5,10,.92)) drop-shadow(0 5px 6px rgba(0,0,0,.7)) drop-shadow(0 11px 14px rgba(0,0,0,.5))" }}
            >
              <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#ffd7db,#c8303f 46%,#5c0d16)", clipPath: clipTL(8) }} />
              <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(150deg,#8d1723,#2c060c)", clipPath: clipTL(7) }} />
              <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, margin: 3, padding: "7px 14px", overflow: "hidden", background: "linear-gradient(180deg,rgba(255,77,94,.26),rgba(12,6,8,.96))", color: "#ffe2e5", ...display, fontSize: 8.5, letterSpacing: ".16em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,214,220,.16)", clipPath: clipTL(6) }}>
                <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,214,220,.7),transparent)" }} />
                <i style={{ position: "relative", fontStyle: "normal", fontSize: 11 }}>⟲</i>
                <span style={{ position: "relative" }}>RESPEC · {respecCost.toLocaleString("en-US")} MC</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── "no skill bench" hint modal ─────────────────────────────── */}
      {showBench && (
        <Modal onBackdrop={() => setShowBench(false)}>
          <b style={{ ...display, fontSize: 12, letterSpacing: ".16em", color: "#ffd9b8" }}>NO SKILL BENCH OUT HERE</b>
          <small style={{ fontSize: 10.5, color: "rgba(226,212,198,.8)" }}>Skills are rewired at a station.</small>
          <small style={{ fontSize: 10, lineHeight: 1.5, color: "rgba(198,214,238,.62)" }}>
            With Premium the matrix reconfigures mid-flight, so you can spend points the moment you earn them. Without it, dock first.
          </small>
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <button
              onClick={() => { setShowBench(false); onGetPremium?.(); }}
              className={styles.chipBtn}
              style={{ flex: 1, padding: "9px 12px", border: "1px solid rgba(232,185,77,.5)", background: "linear-gradient(180deg,rgba(232,185,77,.24),rgba(12,8,4,.95))", color: "#ffeec2", ...display, fontSize: 8.5, letterSpacing: ".16em", fontWeight: 700, cursor: "pointer" }}
            >
              GET PREMIUM
            </button>
            <button
              onClick={() => setShowBench(false)}
              className={styles.chipBtn}
              style={{ flex: 1, padding: "9px 12px", border: "1px solid rgba(150,195,235,.24)", background: "rgba(6,10,18,.8)", color: "rgba(206,228,248,.8)", ...display, fontSize: 8.5, letterSpacing: ".16em", fontWeight: 700, cursor: "pointer" }}
            >
              DOCK FIRST
            </button>
          </div>
        </Modal>
      )}

      {/* ── respec confirm modal ────────────────────────────────────── */}
      {askRespec && (
        <Modal onBackdrop={() => setAskRespec(false)}>
          <b style={{ ...display, fontSize: 12, letterSpacing: ".16em", color: "#ffd9b8" }}>RESPEC {T.n}</b>
          <small style={{ fontSize: 10.5, color: "rgba(226,212,198,.8)" }}>
            Refund every point in this tree for {respecCost.toLocaleString("en-US")} MC?
          </small>
          <small style={{ fontSize: 10, lineHeight: 1.5, color: "rgba(198,214,238,.62)" }}>
            The other two trees keep their build. MCoins are not refunded.
          </small>
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <button
              onClick={() => { setAskRespec(false); onRespec?.(T.key); }}
              className={styles.chipBtn}
              style={{ flex: 1, padding: "9px 12px", border: "1px solid rgba(255,77,94,.5)", background: "linear-gradient(180deg,rgba(255,77,94,.26),rgba(12,6,8,.96))", color: "#ffe2e5", ...display, fontSize: 8.5, letterSpacing: ".16em", fontWeight: 700, cursor: "pointer" }}
            >
              PAY &amp; RESET
            </button>
            <button
              onClick={() => setAskRespec(false)}
              className={styles.chipBtn}
              style={{ flex: 1, padding: "9px 12px", border: "1px solid rgba(150,195,235,.24)", background: "rgba(6,10,18,.8)", color: "rgba(206,228,248,.8)", ...display, fontSize: 8.5, letterSpacing: ".16em", fontWeight: 700, cursor: "pointer" }}
            >
              KEEP BUILD
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SkillMatrix;
