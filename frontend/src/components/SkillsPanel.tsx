// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-03 ·
// SKILL MATRIX section + its renderVals() logic). Every color, gradient,
// clip-path and animation below is copied verbatim from that source — the
// TREES/SHAPE node data, the link/node/tooltip markup and the header/tab/
// footer chrome all match line for line.
//
// Grundgerüst scope (explicit): frame + header + tabs + node grid + tooltip
// + selection footer, using the Kit's own 3-tree/20-node data verbatim.
// NOT included yet (deferred to a later step): mouse drag-to-pan / wheel-
// zoom on the viewport, and the two popups (no-skill-bench hint, respec
// confirmation) — the viewport renders at a fixed centered scale, and the
// RESPEC button is present but not wired to a dialog yet.
import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "./useDraggable";
import { useGame, state as gameState, bump } from "../game/store";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { KitDialog, KitDialogActions } from "./hud/KitDialog";
import { KitPillButton } from "./hud/KitPillButton";
import { usePressable } from "./hud/usePressable";

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

// Skill-matrix-only keyframes from the Kit's global <style> block (cSkFlow/
// cSkRing/cSkMax/cSkNode) — not present in any shared stylesheet yet.
const SKILL_KEYFRAMES = `
@keyframes cSkFlow{to{stroke-dashoffset:-28}}
@keyframes cSkRing{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.85;transform:scale(1.14)}}
@keyframes cSkNode{0%{opacity:0;transform:scale(.55)}100%{opacity:1;transform:scale(1)}}
@keyframes cSkMax{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.9;transform:scale(1.18)}}
@keyframes cSkTip{0%{opacity:0;transform:translateY(6px) scale(.96)}100%{opacity:1;transform:none}}
`;

const shadeHex = (hex: string, amt: number): string => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255) + Math.round(255 * amt), g = (n >> 8 & 255) + Math.round(255 * amt), b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};
const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};

// [id, x, y, shape, name, icon, maxRank, description, per-rank effect] — verbatim from the Kit source.
type NodeTuple = [string, number, number, "n" | "e" | "k", string, string, number, string, string];

const SHAPE: Record<string, { size: number; clip: string; tier: string }> = {
  n: { size: 46, clip: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", tier: "NODE" },
  e: { size: 60, clip: "polygon(50% 0,82% 18%,100% 50%,82% 82%,50% 100%,18% 82%,0 50%,18% 18%)", tier: "ELITE" },
  k: { size: 78, clip: "polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)", tier: "KEYSTONE" },
};

const TREES: { key: string; n: string; hex: string; glyph: string; nodes: NodeTuple[]; links: [string, string][]; start: Record<string, number> }[] = [
  {
    key: "off", n: "OFFENSIVE", hex: "#ff4d5e", glyph: "◤",
    nodes: [
      ["o1", 620, 60, "n", "Focused Barrel", "laser-t2", 3, "Collimates the emitter so the beam holds shape further out.", "+6% weapon range"],
      ["o2", 440, 150, "n", "Overcharge", "laser-t4", 3, "Dumps capacitor reserve into the opening volley.", "+9% burst damage"],
      ["o3", 800, 150, "n", "Splinter Rounds", "laser-t5", 3, "Every fourth shot fragments on impact.", "+4% splinter chance"],
      ["o4", 280, 250, "n", "Heat Sink Bypass", "mod1-t2", 2, "Vents through the hull instead of the sink.", "+1.4 s over heat cap"],
      ["o5", 520, 250, "e", "Ion Lance", "laser-t8", 2, "A charged shot that ignores shielding entirely.", "+18% lance damage"],
      ["o6", 720, 250, "e", "Chain Detonator", "laser-t6", 2, "Kills detonate into nearby hulls.", "+40% splash radius"],
      ["o7", 960, 250, "n", "Rapid Cycler", "genspeed-t2", 3, "Lighter bolts cycle the chamber faster.", "+8% fire rate"],
      ["o8", 170, 350, "n", "Coolant Loop", "mod1-t2", 2, "Recirculates coolant between bursts.", "-12% heat build"],
      ["o9", 400, 350, "n", "Piercing Core", "mod2-t3", 2, "Denser slug carries through plating.", "-25% armour on first hit"],
      ["o10", 840, 350, "n", "Fracture Rounds", "mod2-t4", 2, "Stacking armour shred, up to five stacks.", "+1 shred stack"],
      ["o11", 1070, 350, "n", "Twin Feed", "laser-t5", 3, "Second feed line keeps both barrels hot.", "+5% sustained damage"],
      ["o12", 300, 450, "e", "Siege Mode", "laser-t9", 2, "Anchors the ship for a heavier firing solution.", "+22% damage while anchored"],
      ["o13", 620, 450, "n", "Target Lattice", "mod0-t3", 3, "Predictive tracking on moving hulls.", "+7% accuracy"],
      ["o14", 940, 450, "e", "Havoc Protocol", "laser-t6", 2, "Each kill shortens the next reload.", "-0.4 s reload per kill"],
      ["o15", 450, 560, "n", "Rupture Charge", "mod2-t4", 2, "Charges detonate a second time on armour.", "+14% follow-up hit"],
      ["o16", 790, 560, "n", "Weakpoint Scan", "mod0-t3", 3, "Highlights structural seams mid-fight.", "+6% critical chance"],
      ["o17", 200, 660, "n", "Kinetic Bloom", "laser-t4", 2, "Impact shock spreads through the frame.", "+10% hull damage"],
      ["o18", 620, 660, "e", "Nova Cascade", "laser-t9", 2, "Overloaded shots cascade between targets.", "+1 chain target"],
      ["o19", 1040, 660, "n", "Executioner", "laser-t6", 2, "Finishing blows against crippled hulls.", "+18% damage under 30% hull"],
      ["o20", 620, 790, "k", "Singularity Round", "laser-t10", 1, "Once per engagement the round collapses into a micro-singularity that drags every hull inward.", "Unlocks Singularity Round"],
    ],
    links: [["o1", "o2"], ["o1", "o3"], ["o2", "o4"], ["o2", "o5"], ["o3", "o6"], ["o3", "o7"],
      ["o4", "o8"], ["o4", "o9"], ["o5", "o9"], ["o6", "o10"], ["o7", "o10"], ["o7", "o11"],
      ["o8", "o12"], ["o9", "o12"], ["o9", "o13"], ["o10", "o13"], ["o10", "o14"], ["o11", "o14"],
      ["o12", "o15"], ["o13", "o15"], ["o13", "o16"], ["o14", "o16"],
      ["o15", "o17"], ["o15", "o18"], ["o16", "o18"], ["o16", "o19"],
      ["o17", "o20"], ["o18", "o20"], ["o19", "o20"]],
    start: { o1: 2, o2: 1 },
  },
  {
    key: "def", n: "DEFENCE", hex: "#4ee2ff", glyph: "◇",
    nodes: [
      ["d1", 620, 50, "n", "Plating Weave", "genshield-t2", 3, "Cross-woven plates spread impact along the frame.", "+7% hull integrity"],
      ["d2", 430, 120, "n", "Deflector Bias", "genshield-t3", 3, "Biases the emitter toward recharge.", "+12% shield regen"],
      ["d3", 810, 120, "n", "Reactive Mesh", "genshield-t3", 3, "Returns part of the blocked hit as heat.", "+8% reflected heat"],
      ["d4", 270, 220, "e", "Bulwark Field", "genshield-t4", 2, "Hard cap on incoming burst per second.", "-15% burst ceiling"],
      ["d5", 620, 200, "n", "Hull Lattice", "mod0-t3", 3, "Structural bracing eases every repair.", "-20% repair cost"],
      ["d6", 970, 220, "e", "Kinetic Sink", "genshield-t4", 2, "Feeds kinetic impacts into the capacitor.", "+9% capacitor on hit"],
      ["d7", 150, 340, "n", "Redundant Cells", "mod1-t2", 2, "Spare cells keep the grid alive.", "+1 shield cell"],
      ["d8", 430, 320, "n", "Regen Cells", "mod1-t2", 2, "Passive hull regeneration out of combat.", "+0.4%/s hull regen"],
      ["d9", 810, 320, "n", "Ablative Skin", "mod3-t3", 2, "First hit after a shield break is halved.", "-50% break-through hit"],
      ["d10", 1090, 340, "n", "Static Wash", "genshield-t2", 3, "Bleeds off charge before it reaches the hull.", "+6% energy resist"],
      ["d11", 300, 450, "e", "Anchor Plates", "genshield-t4", 2, "Locks plating against knockback.", "-30% displacement"],
      ["d12", 620, 420, "n", "Field Harmonics", "genspeed-t3", 3, "Tunes the shield to the incoming waveform.", "+5% all resist"],
      ["d13", 940, 450, "e", "Overshield", "genshield-t4", 2, "Excess regen banks into a thin overshield.", "+120 overshield"],
      ["d14", 180, 570, "n", "Damage Control", "mod2-t3", 2, "Automated crews patch breaches mid-fight.", "+1 breach repair"],
      ["d15", 450, 560, "n", "Guardian Link", "mod1-t2", 2, "Shares part of the shield with the wing.", "+8% wing shield"],
      ["d16", 790, 560, "n", "Null Coating", "mod3-t3", 2, "Dampens scanning and lock-on strength.", "-14% enemy lock speed"],
      ["d17", 1060, 570, "n", "Thermal Baffle", "mod2-t4", 2, "Splits heat across the outer shell.", "+9% heat resist"],
      ["d18", 430, 680, "n", "Phase Bastion", "genshield-t4", 2, "A brief phase-out voids one volley.", "+1 voided volley"],
      ["d19", 810, 680, "n", "Last Stand", "mod0-t3", 2, "Below quarter hull the plating hardens.", "+22% resist under 25%"],
      ["d20", 620, 790, "k", "Aegis Prime", "genshield-t4", 1, "The shield never fully drops — overflow forms a second, thinner layer that regenerates on its own.", "Unlocks Aegis Prime"],
    ],
    links: [["d1", "d2"], ["d1", "d3"], ["d1", "d5"], ["d2", "d4"], ["d3", "d6"],
      ["d4", "d7"], ["d2", "d8"], ["d3", "d9"], ["d6", "d10"], ["d5", "d8"], ["d5", "d9"],
      ["d7", "d11"], ["d8", "d11"], ["d8", "d12"], ["d9", "d12"], ["d9", "d13"], ["d10", "d13"],
      ["d11", "d14"], ["d11", "d15"], ["d12", "d15"], ["d12", "d16"], ["d13", "d16"], ["d13", "d17"],
      ["d14", "d18"], ["d15", "d18"], ["d16", "d19"], ["d17", "d19"],
      ["d18", "d20"], ["d19", "d20"]],
    start: { d1: 1 },
  },
  {
    key: "uti", n: "UTILITY", hex: "#5cff8a", glyph: "◈",
    nodes: [
      ["u1", 140, 70, "n", "Scanner Boost", "mod0-t3", 3, "Wider sweep on ore and wreck signatures.", "+18% scan radius"],
      ["u2", 330, 130, "n", "Cargo Rigging", "mod1-t2", 3, "External racking on the hold frame.", "+400 m³ capacity"],
      ["u3", 560, 90, "n", "Drone Uplink", "genspeed-t2", 3, "Trade drones fly one leg faster.", "-12% drone travel"],
      ["u4", 760, 150, "n", "Signal Ghost", "genspeed-t2", 2, "Drops your signature while drifting.", "-16% detection"],
      ["u5", 980, 100, "n", "Star Charts", "mod0-t3", 3, "Deeper route data for the nav computer.", "+2 charted routes"],
      ["u6", 220, 250, "n", "Salvage Arm", "mod2-t3", 2, "Pulls intact modules out of wrecks.", "+1 salvage slot"],
      ["u7", 470, 240, "e", "Warp Tuner", "genspeed-t3", 2, "Tightens the spool-up sequence.", "-1.2 s warp spool"],
      ["u8", 680, 280, "n", "Ore Sifter", "mod2-t4", 3, "Discards slag before it enters the hold.", "+7% pure yield"],
      ["u9", 900, 250, "n", "Beacon Net", "mod1-t2", 2, "Leaves recallable beacons behind you.", "+1 beacon"],
      ["u10", 1120, 220, "e", "Void Compass", "genspeed-t5", 2, "Reveals one anomaly per system.", "+1 anomaly ping"],
      ["u11", 120, 400, "n", "Tow Rig", "mod2-t3", 2, "Hauls derelicts without a speed penalty.", "-30% tow drag"],
      ["u12", 350, 390, "n", "Micro Fabricator", "mod3-t3", 2, "Builds ammo out of silicate dust.", "+40 rounds/hour"],
      ["u13", 600, 420, "e", "Ore Refiner", "mod2-t4", 2, "Refines low-grade ore inside the hold.", "+6%/hour refine"],
      ["u14", 860, 410, "n", "Tractor Field", "mod1-t2", 2, "Scoops loose cargo without stopping.", "+35% scoop radius"],
      ["u15", 1080, 400, "n", "Deep Survey", "genspeed-t3", 3, "Reads mineral density through crust.", "+11% survey depth"],
      ["u16", 250, 540, "n", "Auto Loader", "mod3-t3", 2, "Cargo stows itself while you mine.", "-25% stow time"],
      ["u17", 520, 560, "n", "Barter Codes", "genspeed-t2", 2, "Station clerks quote you better.", "+5% sell price"],
      ["u18", 780, 570, "n", "Silent Running", "genspeed-t5", 2, "Cuts the reactor signature to a whisper.", "-22% heat trace"],
      ["u19", 1010, 560, "e", "Rift Sense", "genspeed-t5", 2, "Feels unstable space before you enter it.", "+1 rift warning"],
      ["u20", 640, 720, "k", "Nexus Protocol", "genspeed-t5", 1, "Every utility bonus feeds one shared pool that the whole wing draws from.", "Unlocks Nexus Protocol"],
    ],
    links: [["u1", "u2"], ["u3", "u2"], ["u3", "u4"], ["u5", "u4"], ["u2", "u6"], ["u2", "u7"],
      ["u3", "u7"], ["u4", "u8"], ["u4", "u9"], ["u5", "u10"],
      ["u6", "u11"], ["u6", "u12"], ["u7", "u12"], ["u7", "u13"], ["u8", "u13"], ["u8", "u14"], ["u9", "u14"], ["u10", "u15"],
      ["u11", "u16"], ["u12", "u16"], ["u12", "u17"], ["u13", "u17"], ["u13", "u18"], ["u14", "u18"], ["u15", "u19"], ["u10", "u19"],
      ["u16", "u20"], ["u17", "u20"], ["u18", "u20"], ["u19", "u20"]],
    start: { u1: 1, u2: 1 },
  },
];

const TOTAL = 48;
const STEEL = "#5b6675";
const RESPEC_COST = 2400;
const CANVAS = { w: 1240, h: 860 };
const IP = "/assets/ui/items/"; // icon path prefix, matches the Kit's IP constant

function ViewportButton({ onClick, label, accent, children }: { onClick?: () => void; label: string; accent: string; children: React.ReactNode }) {
  const { hover, active, handlers } = usePressable();
  const glow = active
    ? "drop-shadow(0 1px 0 rgba(3,5,10,.9)) brightness(1.4)"
    : hover
    ? `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 0 10px ${rgba(accent, 0.55)})`
    : "drop-shadow(0 2px 0 rgba(3,5,10,.9))";
  return (
    <button onClick={onClick} aria-label={label} {...handlers} style={{
      width: 26, height: 26, padding: 0, border: `1px solid ${hover ? accent : "rgba(150,195,235,.22)"}`,
      background: "rgba(6,10,18,.85)", color: hover ? "#eef6ff" : "rgba(206,228,248,.8)",
      fontFamily: "var(--font-display)", fontSize: 14.2, fontWeight: 700, cursor: "pointer",
      filter: glow, boxShadow: "0 5px 7px rgba(0,0,0,.6)",
      transition: "all .14s ease", transform: active ? "translateY(1px) scale(.94)" : hover ? "translateY(-2px)" : "none",
    }}>{children}</button>
  );
}

// Tab bar buttons get the same active-first press feedback as every other
// interactive element in these panels — a tab is a selector, not an inert
// label, so clicking one should visibly dip regardless of the "tabs get no
// glow" carve-out (that carve-out was about the hover glow ring, not press
// feedback).
function TreeTabButton({ t, on, count, onClick }: { t: typeof TREES[number]; on: boolean; count: number; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const transform = active ? "translateY(1px) scale(.98)" : hover ? "translateY(-1px)" : "none";
  const brightness = active ? 1.35 : hover ? 1.12 : 1;
  return (
    <button onClick={onClick} {...handlers} style={{
      flex: 1, position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "11px 4px", border: "none", borderLeft: "1px solid rgba(150,195,235,.12)",
      background: on ? `linear-gradient(180deg,${rgba(t.hex, 0.2)},rgba(6,8,14,.9))` : "rgba(8,10,18,.5)",
      color: on ? "#f2f7ff" : "rgba(206,220,238,.55)",
      fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.16em", fontWeight: 700, cursor: "pointer",
      boxShadow: "inset 0 3px 6px rgba(0,0,0,.35)", transition: "background .22s ease,color .22s ease,transform .14s ease,filter .14s ease",
      transform, filter: `brightness(${brightness})`,
    }}>
      <i style={{ fontStyle: "normal", fontSize: 14.2, color: t.hex, opacity: on ? 1 : 0.35, textShadow: `0 0 8px ${t.hex}` }}>{t.glyph}</i>
      {t.n}
      <em style={{ fontStyle: "normal", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(180,205,230,.5)" }}>{count}/{t.nodes.length}</em>
    </button>
  );
}

// ── Skill node: verbatim from the Kit's invSlots-style press behaviour
// (nodes are clickable slots, so — like InventoryPanel's ItemSlot — the
// entrance animation (cSkNode) and the hover/active transform can't share
// one element; a fill-mode "both" keyframe permanently owns `transform`
// once it finishes, silently overriding any inline value set afterward.
// Split into an outer entrance-animation wrapper + inner interactive node.
function SkillNode({
  n, i, T, st, on, nodeOpen, r, full, isCur, onPick,
}: {
  n: NodeTuple; i: number; T: typeof TREES[number]; st: "on" | "open" | "off";
  on: boolean; nodeOpen: boolean; r: number; full: boolean; isCur: boolean; onPick: () => void;
}) {
  const { hover, active, handlers } = usePressable();
  const [id, x, y, t, name, ic, max] = n;
  const sh = SHAPE[t];
  const base = on ? T.hex : nodeOpen ? shadeHex(T.hex, -0.34) : STEEL;
  const edgeHi = shadeHex(base, 0.5), edgeLo = shadeHex(base, -0.55);
  const b2 = shadeHex(base, -0.2), b3 = shadeHex(base, -0.55), b4 = shadeHex(base, -0.75);
  const face = on
    ? `radial-gradient(120% 100% at 50% -10%,${rgba(T.hex, 0.42)},transparent 72%),linear-gradient(180deg,#242c3a,#070a11)`
    : nodeOpen
    ? `radial-gradient(120% 100% at 50% -10%,${rgba(T.hex, 0.16)},transparent 72%),linear-gradient(180deg,#1a212c,#06090f)`
    : "linear-gradient(180deg,#161b24,#05070c)";
  const glow = on ? rgba(T.hex, 0.65) : nodeOpen ? rgba(T.hex, 0.3) : "rgba(0,0,0,0)";
  const ring = on ? rgba(T.hex, 0.45) : rgba(T.hex, 0.3);
  const ringShow = (t !== "n" && st !== "off") || nodeOpen;
  const iconOp = on ? 1 : nodeOpen ? 0.7 : 0.28;
  const iconSat = on ? 1.1 : nodeOpen ? 0.7 : 0.15;
  const pressGlow = active ? `drop-shadow(0 0 14px ${rgba(T.hex, 0.7)})` : hover ? `drop-shadow(0 0 10px ${rgba(T.hex, 0.4)})` : "";
  const filter = (full
    ? `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7)) drop-shadow(0 0 20px ${rgba(T.hex, 0.6)}) drop-shadow(0 0 30px rgba(232,185,77,.35))`
    : on
    ? `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7)) drop-shadow(0 0 16px ${rgba(T.hex, 0.5)})`
    : nodeOpen
    ? "drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7))"
    : "drop-shadow(0 2px 0 rgba(3,5,10,.85)) drop-shadow(0 5px 6px rgba(0,0,0,.6)) saturate(.2) brightness(.78)") + (pressGlow ? ` ${pressGlow}` : "");
  const transform = active ? "translateY(2px) scale(.94)" : hover ? "translateY(-2px) scale(1.05)" : "none";
  const pips = Array.from({ length: max }, (_, k) => ({
    bg: k < r ? "linear-gradient(180deg,#fff0c2,#e8b94d 55%,#8a6512)" : "linear-gradient(180deg,#2a3240,#11151d)",
    glow: k < r ? "0 0 6px rgba(232,185,77,.85),inset 0 1px 0 rgba(255,246,214,.8)" : "inset 0 1px 0 rgba(180,205,235,.12)",
  }));
  return (
    <div style={{ position: "absolute", left: x - sh.size / 2, top: y - sh.size / 2, width: sh.size, height: sh.size, animation: `cSkNode .4s cubic-bezier(.2,.9,.25,1) ${(i * 0.022).toFixed(3)}s both` }}>
      <div role="button" aria-label={`${name} · ${sh.tier}`}
        onClick={onPick} {...handlers}
        style={{
          position: "relative", width: "100%", height: "100%",
          display: "grid", placeItems: "center", cursor: "pointer", zIndex: isCur ? 9 : t === "k" ? 7 : t === "e" ? 6 : 5,
          transition: "transform .16s cubic-bezier(.2,.9,.25,1),filter .16s ease", filter, transform,
        }}
      >
        <i style={{ position: "absolute", inset: "-16%", display: ringShow ? "block" : "none", background: `radial-gradient(closest-side,${ring},transparent 72%)`, animation: "cSkRing 2.2s ease-in-out infinite", pointerEvents: "none" }} />
        <i style={{ position: "absolute", inset: "-26%", display: full ? "block" : "none", background: "radial-gradient(closest-side,rgba(232,185,77,.4),rgba(232,185,77,.12) 54%,transparent 76%)", animation: "cSkMax 2.6s ease-in-out infinite", pointerEvents: "none" }} />
        <i style={{ position: "absolute", inset: "-9%", display: isCur ? "block" : "none", background: "linear-gradient(150deg,#ffffff,rgba(255,255,255,.35))", opacity: 0.5, clipPath: sh.clip, pointerEvents: "none" }} />
        <i style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,${edgeHi},${base} 44%,${edgeLo})`, clipPath: sh.clip }} />
        <i style={{ position: "absolute", inset: "6.25%", background: `linear-gradient(150deg,${b2},${b3})`, clipPath: sh.clip }} />
        <i style={{ position: "absolute", inset: "11.5%", background: `linear-gradient(150deg,${b4},#05070c)`, clipPath: sh.clip }} />
        <i style={{ position: "absolute", inset: "15.5%", background: face, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6)", clipPath: sh.clip }} />
        <i style={{ position: "absolute", inset: "15.5%", display: st === "off" ? "block" : "none", background: "repeating-linear-gradient(135deg,rgba(180,205,235,.07) 0 1px,transparent 1px 7px)", clipPath: sh.clip, pointerEvents: "none" }} />
        <i style={{ position: "relative", width: "52%", height: "52%", backgroundImage: `url(${IP}${ic}.png)`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", opacity: iconOp, filter: `drop-shadow(0 0 7px ${glow}) drop-shadow(0 2px 3px rgba(0,0,0,.8)) saturate(${iconSat})`, zIndex: 3 }} />
        <span style={{ position: "absolute", left: 0, right: 0, bottom: -11, display: "flex", justifyContent: "center", gap: 3, zIndex: 4, pointerEvents: "none" }}>
          {pips.map((p, k) => (
            <i key={k} style={{ width: 5, height: 5, background: p.bg, boxShadow: p.glow }} />
          ))}
        </span>
      </div>
    </div>
  );
}

export function SkillsPanel() {
  const show = useGame((s) => s.showSkillTree);
  const [tab, setTab] = useState(0);
  const [ranks, setRanks] = useState<Record<string, Record<string, number>>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [tip, setTip] = useState(false);
  const [hint, setHint] = useState(false);
  const dockedAt = useGame((s) => s.dockedAt);
  const docked = !!dockedAt;
  const [playToken, setPlayToken] = useState(0);
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const drag = useDraggable("skills", { resetOnMount: true });

  useEffect(() => {
    if (show) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const T = TREES[tab];

  const parents = useMemo(() => {
    const p: Record<string, string[]> = {};
    T.links.forEach(([a, b]) => { (p[b] = p[b] || []).push(a); });
    return p;
  }, [T]);
  const byId = useMemo(() => {
    const m: Record<string, NodeTuple> = {};
    T.nodes.forEach((n) => { m[n[0]] = n; });
    return m;
  }, [T]);
  const treeRanks = ranks[T.key] || T.start;
  const rank = (id: string) => treeRanks[id] || 0;
  const state = (id: string): "on" | "open" | "off" => {
    if (rank(id) > 0) return "on";
    const ps = parents[id];
    return !ps || ps.some((p) => rank(p) > 0) ? "open" : "off";
  };
  const spent = TREES.reduce((a, t) => {
    const r = ranks[t.key] || t.start;
    return a + Object.keys(r).reduce((b, k) => b + r[k], 0);
  }, 0);

  const curId = sel && byId[sel] ? sel : T.nodes[0][0];
  const cur = byId[curId];
  const curState = state(curId);
  const curRank = rank(curId);
  const maxed = curRank >= cur[6];
  const premium = useGame((s) => s.player.premium);
  const canPlace = docked || premium;
  const canInvest = canPlace && curState !== "off" && !maxed && (TOTAL - spent) > 0;

  const skHex = T.hex;
  const skWash = rgba(T.hex, 0.12);
  const skAmbient = rgba(T.hex, 0.2);

  const investSkill = () => {
    if (!canPlace) { setHint(true); return; }
    if (!canInvest) return;
    setRanks((prev) => {
      const all = { ...prev };
      const r = { ...(all[T.key] || T.start) };
      r[curId] = (r[curId] || 0) + 1;
      all[T.key] = r;
      return all;
    });
  };

  if (!mounted) return null;

  const requestClose = () => { setClosing(true); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); gameState.showSkillTree = false; bump(); };

  return (
    <div className="fixed z-50" style={{ top: 40, left: "calc(50% - 360px)", width: 720, pointerEvents: "auto", ...drag.style }}>
      <style>{SKILL_KEYFRAMES}</style>
      <PrintPortal
        playToken={playToken}
        accent="#4ee2ff"
        duration={1350}
        chamfer={34}
        closing={closing}
        onClosed={closing ? onPortalClosed : undefined}
        style={{ width: 700, margin: "0 auto" }}
    >
      <div style={{ position: "relative", padding: 10, boxSizing: "border-box", filter: `drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px ${skAmbient})` }}>
        <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
        <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
        <i style={{ position: "absolute", inset: 4, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
        <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
        <i style={{ position: "absolute", inset: 8, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 29.31px) 0,100% 29.31px,100% 100%,29.31px 100%,0 calc(100% - 29.31px))" }} />
        <i style={{ position: "absolute", left: 22, right: 44, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 44, right: 22, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(150,190,235,.3),transparent)", pointerEvents: "none" }} />

        <div style={{
          position: "relative", zIndex: 1, display: "grid", gap: 11, padding: "13px 15px 14px", overflow: "hidden",
          background: "radial-gradient(130% 100% at 50% -12%,rgba(180,140,245,.26),transparent 74%),linear-gradient(180deg,#2a2038,#12101c 62%,#08070f)",
          boxShadow: "inset 0 6px 12px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)",
          clipPath: "polygon(0 0,calc(100% - 28.14px) 0,100% 28.14px,100% 100%,28.14px 100%,0 calc(100% - 28.14px))",
        }}>
          <i style={{ position: "absolute", inset: 0, clipPath: "polygon(0 0,calc(100% - 28.14px) 0,100% 28.14px,100% 100%,28.14px 100%,0 calc(100% - 28.14px))", background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
          <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${skHex},transparent)`, boxShadow: `0 0 12px ${skHex}`, opacity: 0.55, transition: "background .4s ease", pointerEvents: "none" }} />

          {hint && (
            <KitDialog accent="gold" title="NO SKILL BENCH OUT HERE" width={376} onDismiss={() => setHint(false)}>
              <p style={{ margin: "0 0 6px", fontSize: 14.8, lineHeight: 1.55, color: "rgba(246,236,216,.9)" }}>Skills are rewired at a station.</p>
              <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5, color: "rgba(226,212,182,.6)" }}>With Premium the matrix reconfigures mid-flight, so you can spend points the moment you earn them. Without it, dock first.</p>
              <KitDialogActions
                left={{ label: "GET PREMIUM", onClick: () => setHint(false), tone: "gold" }}
                right={{ label: "DOCK FIRST", onClick: () => setHint(false) }}
              />
            </KitDialog>
          )}

          {/* header */}
          <div onPointerDown={drag.handleProps.onPointerDown} style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "0 2px 0 2px", marginRight: 34, cursor: "grab", ...drag.handleProps.style }}>
            <b style={{ fontFamily: "var(--font-display)", fontSize: 15.3, letterSpacing: "0.2em", color: "#e6dcff", whiteSpace: "nowrap" }}>SKILL MATRIX</b>
            <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.2, whiteSpace: "nowrap", color: "rgba(196,218,240,.75)" }}>{T.n} · {spent} / {TOTAL}</small>
            <span style={{ flex: 1 }} />
            <span style={{
              display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", border: "1px solid rgba(150,195,235,.16)",
              background: "rgba(3,5,11,.8)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.55),inset -1px -1px 0 rgba(143,176,208,.06)",
            }}>
              <i style={{ width: 6, height: 6, background: docked ? "#5cff8a" : "#e8b94d", boxShadow: `0 0 9px ${docked ? "#5cff8a" : "#e8b94d"}`, transform: "rotate(45deg)" }} />
              <small style={{ fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.16em", fontWeight: 700, color: docked ? "#5cff8a" : "#e8b94d" }}>{docked ? "DOCKED" : "IN FLIGHT"}</small>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", background: "rgba(3,5,11,.8)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.55),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
              <i style={{ width: 6, height: 6, background: skHex, boxShadow: `0 0 9px ${skHex}`, transform: "rotate(45deg)" }} />
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.8, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#eef2ff" }}>{String(TOTAL - spent).padStart(2, "0")} PTS</small>
            </span>
            <CloseButton onClick={requestClose} title="Close" />
          </div>

          {/* tabs */}
          <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 1, overflow: "hidden", background: "rgba(4,8,16,.55)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)" }}>
            {TREES.map((t, i) => {
              const on = tab === i;
              const r = ranks[t.key] || t.start;
              const count = t.nodes.filter((n) => (r[n[0]] || 0) > 0).length;
              return (
                <TreeTabButton key={t.key} t={t} on={on} count={count}
                  onClick={() => { setTab(i); setSel(null); setTip(false); }} />
              );
            })}
            {(["top", "bottom"] as const).map((side) => (
              <div key={side}>
                <i style={{ position: "absolute", zIndex: 4, [side]: 0, left: `${tab * 33.333}%`, width: "33.333%", height: 5, pointerEvents: "none", opacity: 0.28, filter: "blur(4px)", background: `linear-gradient(90deg,transparent,${skHex},transparent)`, transition: "left 480ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
                <i style={{ position: "absolute", zIndex: 4, [side]: 0, left: `${tab * 33.333}%`, width: "33.333%", height: 3, pointerEvents: "none", opacity: 0.55, filter: "blur(2px)", background: `linear-gradient(90deg,transparent,${skHex},transparent)`, transition: "left 380ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
                <i style={{ position: "absolute", zIndex: 5, [side]: 0, left: `${tab * 33.333}%`, width: "33.333%", height: 2, pointerEvents: "none", background: `linear-gradient(90deg,transparent,${skHex} 22%,${skHex} 78%,transparent)`, boxShadow: `0 0 10px ${skHex},0 0 24px ${skHex}`, transition: "left 260ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
              </div>
            ))}
          </div>

          {/* viewport — fixed centered scale (no drag/wheel yet) */}
          <div style={{
            position: "relative", height: 424, overflow: "hidden", userSelect: "none",
            background: `radial-gradient(420px 300px at 50% 0%,${skWash},transparent 72%),radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.55)),rgba(3,4,10,.66)`,
            boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06),inset 0 6px 16px rgba(0,0,0,.55)",
          }}>
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(150,200,235,.045) 0 1px,transparent 1px 34px),repeating-linear-gradient(0deg,rgba(150,200,235,.045) 0 1px,transparent 1px 34px)", pointerEvents: "none" }} />
            <i style={{ position: "absolute", left: 0, right: 0, top: 0, height: "34%", background: `linear-gradient(180deg,${skWash},transparent)`, pointerEvents: "none" }} />

            <div style={{ position: "absolute", left: 0, top: 0, width: CANVAS.w, height: CANVAS.h, transformOrigin: "0 0", transform: "translate(17px,-4px) scale(.5)" }}>
              <svg viewBox="0 0 1240 860" style={{ position: "absolute", left: 0, top: 0, width: 1240, height: 860, pointerEvents: "none" }}>
                {T.links.map(([a, b]) => {
                  const A = byId[a], B = byId[b];
                  const sa = state(a) === "on", sb = state(b) === "on";
                  const live = sa && sb, warm = sa && state(b) === "open";
                  const hex = live || warm ? T.hex : STEEL;
                  const core = live ? shadeHex(T.hex, 0.62) : warm ? T.hex : "#39424f";
                  return (
                    <g key={`${a}-${b}`}>
                      <line x1={A[1]} y1={A[2]} x2={B[1]} y2={B[2]} stroke={hex} strokeWidth={9} strokeLinecap="round" opacity={live ? 0.22 : warm ? 0.12 : 0.05} />
                      <line x1={A[1]} y1={A[2]} x2={B[1]} y2={B[2]} stroke={hex} strokeWidth={4} strokeLinecap="round" opacity={live ? 0.4 : warm ? 0.2 : 0.1} />
                      <line x1={A[1]} y1={A[2]} x2={B[1]} y2={B[2]} stroke={core} strokeWidth={1.4} strokeLinecap="round" opacity={live ? 0.95 : warm ? 0.5 : 0.28} />
                      <line x1={A[1]} y1={A[2]} x2={B[1]} y2={B[2]} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeDasharray="3 25" opacity={live ? 0.85 : 0} style={{ animation: "cSkFlow 1.1s linear infinite" }} />
                    </g>
                  );
                })}
              </svg>

              {T.nodes.map((n, i) => {
                const [id, , , , , , max] = n;
                const st = state(id);
                const on = st === "on", nodeOpen = st === "open";
                const r = rank(id);
                const full = on && r >= max;
                return (
                  <SkillNode
                    key={id} n={n} i={i} T={T} st={st} on={on} nodeOpen={nodeOpen} r={r} full={full}
                    isCur={id === curId} onPick={() => { setSel(id); setTip(true); }}
                  />
                );
              })}
            </div>

            {/* tooltip */}
            {tip && (() => {
              const z = 0.5, panX = 17, panY = -4;
              const sx = cur[1] * z + panX, sy = cur[2] * z + panY;
              const flip = sx > 360;
              const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
              const tipLeft = clamp(flip ? sx - 286 : sx + 34, 8, 600);
              const tipTop = clamp(sy - 46, 8, 424 - 232);
              const tipHex = curState === "off" ? "rgba(180,205,230,.55)" : T.hex;
              const tipGlow = curState === "off" ? "rgba(120,150,180,.25)" : rgba(T.hex, 0.6);
              const tipWash = curState === "off" ? "rgba(140,170,205,.1)" : rgba(T.hex, 0.16);
              const tipRank = curState === "off" ? "LOCKED" : `RANK ${curRank} / ${cur[6]}`;
              const tipState = curState === "off" ? "Unlock a connected node first" : maxed ? "Fully levelled" : "Ready to invest";
              const tipStateHex = curState === "off" ? "rgba(200,170,175,.7)" : maxed ? "#e8b94d" : "#5cff8a";
              const tipPips = Array.from({ length: cur[6] }, (_, k) => ({
                bg: k < curRank ? "linear-gradient(180deg,#fff0c2,#e8b94d 55%,#8a6512)" : "linear-gradient(180deg,#2a3240,#11151d)",
                glow: k < curRank ? "0 0 6px rgba(232,185,77,.85)" : "none",
              }));
              return (
                <div style={{ position: "absolute", left: tipLeft, top: tipTop, display: "grid", width: 292, zIndex: 30, padding: 7.5, boxSizing: "border-box", filter: `drop-shadow(0 4px 0 rgba(3,5,10,.92)) drop-shadow(0 9px 9px rgba(0,0,0,.75)) drop-shadow(0 18px 24px rgba(0,0,0,.6)) drop-shadow(0 0 22px ${tipGlow})`, animation: "cSkTip .18s cubic-bezier(.2,.9,.25,1) both" }}>
                  <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))" }} />
                  <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: "polygon(0 0,calc(100% - 19.12px) 0,100% 19.12px,100% 100%,19.12px 100%,0 calc(100% - 19.12px))" }} />
                  <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: "polygon(0 0,calc(100% - 18.24px) 0,100% 18.24px,100% 100%,18.24px 100%,0 calc(100% - 18.24px))" }} />
                  <i style={{ position: "absolute", inset: 4.5, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: "polygon(0 0,calc(100% - 17.36px) 0,100% 17.36px,100% 100%,17.36px 100%,0 calc(100% - 17.36px))" }} />
                  <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 16.48px) 0,100% 16.48px,100% 100%,16.48px 100%,0 calc(100% - 16.48px))" }} />
                  <div style={{ position: "relative", zIndex: 1, overflow: "hidden", background: `radial-gradient(130% 100% at 50% -14%,${tipWash},transparent 74%),linear-gradient(180deg,#1e2632,#0c1119 62%,#05080d)`, boxShadow: "inset 0 5px 10px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)", clipPath: "polygon(0 0,calc(100% - 15.6px) 0,100% 15.6px,100% 100%,15.6px 100%,0 calc(100% - 15.6px))" }}>
                    <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "10px 34px 10px 12px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(170,205,245,.1)", background: `linear-gradient(100deg,${tipWash},transparent 74%)` }}>
                      <i style={{ display: "block", width: 24, height: 22, flex: "0 0 auto", backgroundImage: `url(${IP}${cur[5]}.png)`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 7px ${tipGlow})` }} />
                      <span style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
                        <b style={{ fontSize: 13.6, fontWeight: 700, color: "#f2f7ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur[4]}</b>
                        <small style={{ fontFamily: "var(--font-display)", fontSize: 8.3, letterSpacing: "0.18em", color: tipHex }}>{SHAPE[cur[3]].tier}</small>
                      </span>
                      <div style={{ position: "absolute", right: 11, top: 11 }}>
                        <CloseButton onClick={() => setTip(false)} size={22} fontSize={9} />
                      </div>
                    </div>
                    <div style={{ position: "relative", display: "grid", gap: 8, padding: "11px 12px 12px" }}>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(206,222,242,.78)", textWrap: "pretty" as any }}>{cur[7]}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                        <i style={{ width: 5, height: 5, background: tipHex, boxShadow: `0 0 7px ${tipHex}`, transform: "rotate(45deg)" }} />
                        <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.2, color: "#dbe9fb" }}>{cur[8]}</small>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ display: "flex", gap: 3 }}>
                          {tipPips.map((p, k) => (
                            <i key={k} style={{ width: 7, height: 7, background: p.bg, boxShadow: p.glow }} />
                          ))}
                        </span>
                        <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(196,218,240,.6)" }}>{tipRank}</small>
                        <span style={{ flex: 1 }} />
                        <small style={{ fontFamily: "var(--font-display)", fontSize: 8.9, letterSpacing: "0.14em", color: tipStateHex }}>{tipState}</small>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ position: "absolute", right: 10, bottom: 10, display: "flex", gap: 5, zIndex: 20 }}>
              <ViewportButton label="Zoom out" accent={skHex}>−</ViewportButton>
              <ViewportButton label="Recentre" accent={skHex}>⌂</ViewportButton>
              <ViewportButton label="Zoom in" accent={skHex}>+</ViewportButton>
            </div>
            <small style={{ position: "absolute", left: 11, bottom: 11, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", color: "rgba(170,196,222,.45)", pointerEvents: "none", zIndex: 20 }}>SKILL MATRIX PREVIEW</small>
          </div>

          {/* selection footer */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, padding: "8px 11px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
              <i style={{ display: "block", width: 28, height: 24, flex: "0 0 auto", backgroundImage: `url(${IP}${cur[5]}.png)`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 8px ${curState === "off" ? "rgba(0,0,0,0)" : rgba(T.hex, 0.6)})` }} />
              <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <b style={{ fontSize: 14.8, fontWeight: 700, color: "#f2ecff", whiteSpace: "nowrap" }}>{cur[4]}</b>
                  <small style={{ fontFamily: "var(--font-display)", fontSize: 8.9, letterSpacing: "0.16em", color: curState === "off" ? "rgba(180,205,230,.5)" : T.hex }}>{SHAPE[cur[3]].tier}</small>
                  <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(196,218,240,.6)" }}>{curState === "off" ? "LOCKED" : `RANK ${curRank} / ${cur[6]}`}</small>
                </span>
                <small style={{ fontSize: 12.4, lineHeight: 1.45, color: "rgba(198,214,238,.62)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur[7]}</small>
              </span>
            </span>
            <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
              <KitPillButton
                onClick={investSkill}
                tone={{
                  rim: canInvest ? "linear-gradient(150deg,#f6ecff,#a377d9 45%,#2a1440)" : "linear-gradient(150deg,#b9c2cd,#5e6874 45%,#20262f)",
                  mid: canInvest ? "linear-gradient(150deg,#6b3f96,#170c22)" : "linear-gradient(150deg,#3c444f,#12161c)",
                  bg: canInvest ? "linear-gradient(180deg,rgba(184,102,255,.3),rgba(10,7,14,.96))" : "linear-gradient(180deg,rgba(150,170,195,.07),rgba(8,10,14,.96))",
                  color: canInvest ? "#f2e6ff" : "rgba(196,208,222,.42)",
                  spec: canInvest ? "rgba(230,210,255,.75)" : "rgba(200,216,236,.3)",
                  under: canInvest ? "#b866ff" : "rgba(150,175,200,.28)",
                }}
                icon={<i style={{ position: "relative", fontStyle: "normal", fontSize: 13 }}>◈</i>}
              >
                {!canPlace ? "STATION ONLY" : curState === "off" ? "LOCKED" : maxed ? "MAXED" : "INVEST · 1 PT"}
              </KitPillButton>
              <KitPillButton
                tone={{
                  rim: "linear-gradient(150deg,#ffdfe3,#a8505c 45%,#2c1015)",
                  mid: "linear-gradient(150deg,#7c3540,#1a0a0e)",
                  bg: "linear-gradient(180deg,rgba(255,77,94,.2),rgba(12,6,10,.94))",
                  color: "#ffd0d5",
                  spec: "rgba(255,214,220,.7)",
                  under: "#ff4d5e",
                }}
                icon={<i style={{ position: "relative", fontStyle: "normal", fontSize: 13 }}>⟲</i>}
              >
                RESPEC · {RESPEC_COST.toLocaleString("en-US")} MC
              </KitPillButton>
            </div>
          </div>
        </div>
      </div>
      </PrintPortal>
    </div>
  );
}
