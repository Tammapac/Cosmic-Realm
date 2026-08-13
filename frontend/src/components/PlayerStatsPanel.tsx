// Ported 1:1, element-for-element, from the Cosmic Kit design export
// (Cosmic Kit.dc.html, I-12 · PILOT DOSSIER markup at lines 3980-4238, real
// runtime data generators at lines 5260-5349, static data at 7083-7175).
// Chamfered print-portal window (same 34px-chamfer chrome as Cargo/Skills/
// ZoneMap this session), cyan accent per the Kit's own I-12 palette.
//
// Real data wired throughout, nothing invented:
// - Identity/rank/honor bar: rankFor(), HONOR_RANKS (next-rank threshold).
// - ATTRIBUTES: the existing real system (game/store.ts ATTRIBUTES/
//   attrValue/attrBudget/attrSpent) — now with a genuine pending/commit
//   flow matching the Kit exactly (pdDraft/pdSpent/pdCommit/pdRespec):
//   the +/- buttons only touch local component state, nothing is written
//   to player.skills until COMMIT calls buyAttribute()/sellAttribute()
//   the right number of times. RESPEC costs Credits, not MCoins — MCoins
//   is server-authoritative and save() deliberately never sends it
//   (game/store.ts:790-793), so a client-side MCoins charge here would
//   silently revert on the next sync and never actually deduct anything;
//   Credits mirrors the existing resetSkills() respec exactly.
// - CAREER PATHS: this codebase's real 3 tracks (Bounty Hunter / Miner /
//   Trader, from PATHS below, unchanged from the pre-rebuild component)
//   styled with the Kit's per-card chamfered-plate treatment. The Kit
//   shows 6 demo tracks; only 3 have real metrics here.
// - LIFETIME RECORD: player.milestones (real totals) instead of the Kit's
//   demo PD_KILLS array — same 6-stat hero+rail layout.
// - Detail progression list: the currently-selected career's PD_DETAIL
//   equivalent — built from that path's own metric/tiers (kills, mined,
//   credits) since there's no separate detailed-breakdown data source.
// - RANKINGS is not part of I-12's own markup, but the previous component
//   had a working leaderboard tab wired to a real endpoint — kept as a
//   second tab (PROFILE / RANKINGS) rather than deleting real functionality
//   the Kit simply doesn't have a slot for.
import { useState } from "react";
import { useDraggable } from "./useDraggable";
import {
  state as gameState, bump, useGame, ATTRIBUTES, attrValue, attrSpent, attrBudget,
  buyAttribute, sellAttribute, respecAttributes, RESPEC_ATTRIBUTES_COST,
} from "../game/store";
import { effectiveStats } from "../game/loop";
import { FACTIONS, SHIP_CLASSES, rankFor, rankIcon, rankIconSrcSet, rankLabel, nextRankFor } from "../game/types";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

const DOSSIER_KEYFRAMES = `
@keyframes cPulse{0%,100%{opacity:.45}50%{opacity:1}}
`;

const PATHS = [
  {
    id: "hunter", name: "BOUNTY HUNTER", icon: "⌖", color: "#ff4d5e",
    metric: (m: any) => (m?.totalKills ?? 0) + (m?.bossKills ?? 0) * 10,
    unit: "kills",
    tiers: [0, 50, 150, 400, 1000, 2500, 6000, 15000, 40000, 100000],
    titles: ["Recruit", "Gunhand", "Stalker", "Marauder", "Executioner", "Warlord", "Reaper", "Dread Pilot", "Void Slayer", "Legend"],
  },
  {
    id: "miner", name: "MINER", icon: "◈", color: "#e8b94d",
    metric: (m: any) => m?.totalMined ?? 0,
    unit: "ore",
    tiers: [0, 40, 120, 300, 800, 2000, 5000, 12000, 30000, 80000],
    titles: ["Prospector", "Digger", "Rockbreaker", "Vein Chaser", "Drill Master", "Core Splitter", "Belt Baron", "Depth Lord", "Asteroid King", "Legend"],
  },
  {
    id: "trader", name: "TRADER", icon: "⬢", color: "#5cff8a",
    metric: (m: any) => m?.totalCreditsEarned ?? 0,
    unit: "cr earned",
    tiers: [0, 5000, 20000, 60000, 150000, 400000, 1000000, 2500000, 6000000, 15000000],
    titles: ["Peddler", "Hauler", "Merchant", "Broker", "Financier", "Magnate", "Tycoon", "Cartel Boss", "Trade Prince", "Legend"],
  },
  // Exploration — player.milestones.totalWarps (the same "Pathfinder"
  // milestone tracked at MILESTONE_TIERS in game/types.ts).
  {
    id: "explorer", name: "EXPLORER", icon: "◇", color: "#4ee2ff",
    metric: (m: any) => m?.totalWarps ?? 0,
    unit: "warps",
    tiers: [0, 5, 25, 100, 500, 2000, 6000, 15000, 40000, 100000],
    titles: ["Drifter", "Wayfarer", "Pathfinder", "Voidwalker", "Star Runner", "Deep Rover", "Sector Ghost", "Void Sage", "Realm Charter", "Legend"],
  },
  // Contracts and Salvage — these had NO tracked running total anywhere in
  // the codebase before this pass. Added as real, persistent lifetime
  // counters (player.milestones.totalContracts/totalSalvaged, game/
  // types.ts) incremented at the actual moment each event happens:
  // totalContracts in claimMission() (store.ts) when a mission reward is
  // claimed; totalSalvaged in tryCollectNearbyBoxes()/collectCargoBox()
  // (store.ts) when a resource cargo box is actually picked up. Colors
  // match the Kit's own PD_CAREER data (contracts #b866ff, salvage
  // #ff5cf0).
  {
    id: "contracts", name: "CONTRACTS", icon: "▣", color: "#b866ff",
    metric: (m: any) => m?.totalContracts ?? 0,
    unit: "contracts",
    tiers: [0, 5, 25, 100, 400, 1200, 3500, 9000, 25000, 70000],
    titles: ["Freelancer", "Runner", "Fixer", "Broker", "Operative", "Handler", "Underboss", "Syndicate Agent", "Cartel Fixer", "Legend"],
  },
  {
    id: "salvager", name: "SALVAGE", icon: "⬡", color: "#ff5cf0",
    metric: (m: any) => m?.totalSalvaged ?? 0,
    unit: "salvaged",
    tiers: [0, 10, 50, 200, 800, 3000, 9000, 25000, 70000, 200000],
    titles: ["Scrapper", "Wreck Diver", "Hull Stripper", "Debris Hound", "Reclaimer", "Wreck Baron", "Void Picker", "Relic Hunter", "Salvage King", "Legend"],
  },
] as const;

function pathProgress(path: (typeof PATHS)[number], milestones: any) {
  const v = path.metric(milestones);
  let lv = 0;
  for (let i = 0; i < path.tiers.length; i++) if (v >= path.tiers[i]) lv = i;
  const cur = path.tiers[lv];
  const next = path.tiers[lv + 1];
  const pct = next != null ? Math.min(100, ((v - cur) / Math.max(1, next - cur)) * 100) : 100;
  return { v, lv: lv + 1, title: path.titles[lv], next, pct, maxed: next == null };
}

// Kit's PD_ATTR per-point bonus percentages (dmg 1.0/hp 1.5/sh 1.5/spd 0.5),
// keyed to our real ATTRIBUTES ids in the same order.
const ATTR_BONUS_PCT: Record<string, number> = { "attr-fire": 1.0, "attr-res": 1.5, "attr-shd": 1.5, "attr-thr": 0.5 };

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + Math.round(255 * amt)));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + Math.round(255 * amt)));
  const b = Math.max(0, Math.min(255, (n & 255) + Math.round(255 * amt)));
  return `rgb(${r},${g},${b})`;
};
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function StepButton({ n, active, onClick }: { n: number; active: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  return (
    <button
      onClick={onClick} aria-label={`Spend ${n} point${n > 1 ? "s" : ""} per click`} {...handlers}
      style={{
        flex: 1, position: "relative", padding: "5px 0", border: "none", cursor: "pointer",
        fontFamily: "var(--font-display)", fontSize: 11.2, letterSpacing: "0.16em", fontWeight: 700,
        color: active ? "#f4ecff" : "rgba(206,222,246,.55)",
        background: active ? "linear-gradient(180deg,rgba(184,102,255,.3),rgba(6,5,12,.92))" : "linear-gradient(180deg,#0d141c,#04070c)",
        boxShadow: active ? "inset 0 1px 0 rgba(226,200,255,.4),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 0 14px rgba(184,102,255,.2)" : "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 3px 6px rgba(0,0,0,.5)",
        clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
        transform: pressed ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        filter: pressed ? "brightness(1.32)" : hover ? "brightness(1.18)" : "none",
        transition: "transform .13s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", left: 5, right: 5, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${active ? "#b866ff" : "rgba(184,102,255,.25)"},transparent)`, boxShadow: active ? "0 0 9px #b866ff" : "0 0 3px rgba(184,102,255,.25)" }} />
      <span style={{ position: "relative" }}>×{n}</span>
    </button>
  );
}

// "-" is red (take a point back), "+" is green (spend a point) — a clearer
// affordance than the Kit's own steel/green pair, per explicit request.
function PmButton({ glyph, color, disabled, onClick }: { glyph: "+" | "−"; color: "red" | "green"; disabled: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const grad = color === "green"
    ? { rim: "linear-gradient(135deg,#d8ffe6,#30a856 46%,#0d3a1c)", i1: "linear-gradient(135deg,#8effb0,#1c7d3c 52%,#08290f)", i2: "linear-gradient(158deg,#5cff8a,#17692f 58%,#061e0b)", text: "#eaffef", glow: "0 3px 0 -1px rgba(4,26,12,.95),0 6px 0 -3px rgba(2,14,7,.92),0 9px 14px rgba(0,0,0,.55),0 0 12px rgba(92,255,138,.22)" }
    : { rim: "linear-gradient(135deg,#ffd7db,#c8303f 46%,#5c0d16)", i1: "linear-gradient(135deg,#ff97a2,#9c1c29 52%,#3d080f)", i2: "linear-gradient(158deg,#ff6b7c,#8d1723 58%,#2c060c)", text: "#fff2f3", glow: "0 3px 0 -1px rgba(58,6,12,.95),0 6px 0 -3px rgba(26,3,7,.92),0 9px 14px rgba(0,0,0,.55),0 0 12px rgba(255,77,94,.22)" };
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={glyph === "+" ? "Add a point" : "Take a point back"} {...handlers}
      style={{
        position: "relative", display: "grid", placeItems: "center", width: 24, height: 24, flex: "0 0 auto", margin: "0 3px", padding: 0, border: "none",
        cursor: disabled ? "not-allowed" : "pointer", filter: disabled ? "saturate(.25) brightness(.7)" : "none",
        background: grad.rim, color: grad.text, fontFamily: "var(--font-display)", fontSize: 14.2, fontWeight: 700,
        boxShadow: grad.glow,
        transform: !disabled && active ? "translateY(2px)" : !disabled && hover ? "translateY(-2px)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),box-shadow .14s ease,filter .14s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: grad.i1 }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: grad.i2, boxShadow: "inset 0 1px 0 rgba(226,238,252,.5),inset 0 -1px 0 rgba(0,0,0,.65),inset 0 4px 7px rgba(0,0,0,.42)" }} />
      <i style={{ position: "absolute", left: 3.5, right: 3.5, top: 3, height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(235,245,255,.75),transparent)" }} />
      <i style={{ position: "relative", fontStyle: "normal", textShadow: "0 1px 2px rgba(2,6,12,.9)" }}>{glyph}</i>
    </button>
  );
}

export function PlayerStatsPanel() {
  const show = useGame((s) => s.showPlayerStats);
  useGame((s) => s.tick);
  const player = useGame((s) => s.player);
  const [career, setCareer] = useState<(typeof PATHS)[number]["id"]>("hunter");
  const [step, setStep] = useState<1 | 5 | 10>(1);
  // pending/commit: draft holds unsaved deltas per attr id (can be
  // negative-relative via sellAttribute at commit time), nothing touches
  // player.skills until Commit — matches the Kit's pdDraft/pdSpent split.
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ text: string; hex: string } | null>(null);
  const [playToken] = useState(0);
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);

  const drag = useDraggable("playerstats", { resetOnMount: true });

  if (show && !mounted) { setMounted(true); setClosing(false); }
  else if (!show && mounted && !closing) { setClosing(true); }
  if (!mounted) return null;

  const close = () => { gameState.showPlayerStats = false; bump(); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); };

  const rank = rankFor(player.honor);
  const nextRank = nextRankFor(player.honor);
  // Clamp at BOTH ends. An Outlaw's next rank is the entry rank at minHonor 0,
  // so the old expression divided by zero and produced -Infinity; negative
  // honor generally produced a negative width.
  const honorPct = nextRank
    ? Math.max(0, Math.min(100, (player.honor / Math.max(1, nextRank.minHonor)) * 100))
    : 100;
  const honorLeft = nextRank ? Math.max(0, nextRank.minHonor - player.honor) : 0;
  const cls = SHIP_CLASSES[player.shipClass];
  const stats = effectiveStats();
  const draftUsed = Object.values(draft).reduce((a, v) => a + Math.max(0, v), 0);
  const free = Math.max(0, attrBudget() - attrSpent() - draftUsed);

  const curPath = PATHS.find((p) => p.id === career)!;
  const curProgress = pathProgress(curPath, player.milestones);

  const doCommit = () => {
    if (draftUsed <= 0) { setToast({ text: "Spend a point first", hex: "#cbb2f5" }); return; }
    for (const [id, delta] of Object.entries(draft)) {
      for (let i = 0; i < delta; i++) buyAttribute(id);
      for (let i = 0; i < -delta; i++) sellAttribute(id);
    }
    setDraft({});
    setToast({ text: `${draftUsed} point${draftUsed > 1 ? "s" : ""} locked into your build`, hex: "#5cff8a" });
  };
  const doRespec = () => {
    if (respecAttributes()) { setDraft({}); setToast({ text: `Every point refunded for ${RESPEC_ATTRIBUTES_COST.toLocaleString()}cr`, hex: "#cfefff" }); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "grid", placeItems: "center", background: "rgba(2,4,12,.7)", ...drag.style }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <style>{DOSSIER_KEYFRAMES}</style>
      <PrintPortal playToken={playToken} accent="#4ee2ff" duration={1300} chamfer={34} closing={closing} onClosed={closing ? onPortalClosed : undefined} style={{ width: "min(96vw, 1080px)" }}>
        <div style={{ position: "relative", padding: 18, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(2,5,9,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(78,226,255,.18))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: "#04070d", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 0, display: "block", background: "rgba(78,226,255,.5)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "rgba(226,250,255,.65)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "rgba(3,7,10,.7)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "rgba(157,233,255,.45)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "rgba(3,7,10,.65)", clipPath: "polygon(0 0,calc(100% - 29.32px) 0,100% 29.32px,100% 100%,29.32px 100%,0 calc(100% - 29.32px))" }} />
          <i style={{ position: "absolute", inset: 10, display: "block", background: "rgba(44,132,160,.3)", clipPath: "polygon(0 0,calc(100% - 28.15px) 0,100% 28.15px,100% 100%,28.15px 100%,0 calc(100% - 28.15px))" }} />
          <i style={{ position: "absolute", inset: 12, display: "block", background: "rgba(3,7,10,.6)", clipPath: "polygon(0 0,calc(100% - 26.98px) 0,100% 26.98px,100% 100%,26.98px 100%,0 calc(100% - 26.98px))" }} />
          <i style={{ position: "absolute", inset: 14, display: "block", background: "rgba(24,66,82,.25)", clipPath: "polygon(0 0,calc(100% - 25.81px) 0,100% 25.81px,100% 100%,25.81px 100%,0 calc(100% - 25.81px))" }} />
          <i style={{ position: "absolute", inset: 16, display: "block", background: "rgba(3,7,10,.55)", clipPath: "polygon(0 0,calc(100% - 24.64px) 0,100% 24.64px,100% 100%,24.64px 100%,0 calc(100% - 24.64px))" }} />

          <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 8, padding: "10px 15px 11px", overflow: "hidden", background: "linear-gradient(150deg,#1d3644,#060b11)", boxShadow: "inset 0 5px 12px rgba(0,0,0,.6),inset 0 0 0 1px rgba(3,7,10,.6),inset 0 -2px 0 rgba(157,233,255,.2)", clipPath: "polygon(0 0,calc(100% - 23.47px) 0,100% 23.47px,100% 100%,23.47px 100%,0 calc(100% - 23.47px))" }}>
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.04) 11px 12px,transparent 12px 23px)", pointerEvents: "none" }} />

            {/* header */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0 1px 7px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(157,233,255,.14)", cursor: "move", touchAction: "none", userSelect: "none", ...drag.handleProps.style }} onPointerDown={drag.handleProps.onPointerDown}>
              <i style={{ width: 7, height: 7, flex: "0 0 auto", background: "#4ee2ff", boxShadow: "0 0 10px #4ee2ff", transform: "rotate(45deg)", animation: "cPulse 1.9s ease-in-out infinite" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 15.9, letterSpacing: "0.2em", color: "#d8f6ff" }}>PILOT DOSSIER</b>
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.4, letterSpacing: "0.1em", color: "rgba(200,228,242,.72)" }}>SERVICE RECORD</small>
              <span style={{ flex: 1 }} />
              {free > 0 && (
                <small style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 9.8, letterSpacing: "0.14em", color: "#eddcff", background: "rgba(184,102,255,.16)", boxShadow: "inset 0 0 0 1px rgba(184,102,255,.45)", animation: "cPulse 1.9s ease-in-out infinite" }}>{free} POINTS FREE</small>
              )}
              <CloseButton onClick={close} title="Close" size={22} fontSize={9} />
            </div>

            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "352px 1fr", gap: 12, alignItems: "stretch" }}>

                {/* left column: identity/honor, attributes, active bonus */}
                <div style={{ position: "relative", display: "grid", gap: 9, alignContent: "start", gridTemplateRows: "auto auto 1fr", padding: "13px 18px", border: "2px solid rgba(78,226,255,.5)", background: "linear-gradient(150deg,#1d3644,#060b11)", boxShadow: "inset 0 0 0 2px rgba(226,250,255,.65),inset 0 0 0 4px rgba(3,7,10,.7),inset 0 0 0 6px rgba(157,233,255,.45),inset 0 0 0 8px rgba(3,7,10,.65),inset 0 0 0 10px rgba(44,132,160,.3),inset 0 0 0 12px rgba(3,7,10,.6),inset 0 0 0 14px rgba(24,66,82,.25),inset 0 0 0 16px rgba(3,7,10,.55)" }}>

                  {/* identity + honor bar */}
                  <div style={{ position: "relative", display: "grid", gap: 6, padding: "8px 13px 9px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% 0%,rgba(78,226,255,.14),transparent 74%),linear-gradient(180deg,#0f1620,#050a0e)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 rgba(157,233,255,.2)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                    <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(120,190,220,.05) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ position: "relative", width: 38, height: 38, flex: "0 0 auto", filter: "drop-shadow(0 3px 0 rgba(2,5,9,.9)) drop-shadow(0 7px 9px rgba(0,0,0,.7)) drop-shadow(0 0 18px rgba(78,226,255,.4))" }}>
                        <i style={{ position: "absolute", inset: 0, background: "linear-gradient(150deg,#e2faff,#6fa8bd 42%,#245061 72%,#0d222c)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                        <i style={{ position: "absolute", inset: 3, background: "linear-gradient(150deg,#74bdd6,#173845 56%,#06131a)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                        <i style={{ position: "absolute", inset: 5.5, background: "radial-gradient(circle at 50% 32%,rgba(78,226,255,.5),#05090f 74%)", boxShadow: "inset 0 3px 8px rgba(0,0,0,.7)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                        {/* Real rank insignia, not rank.symbol. The glyph
                            ("✦"/"★") was a stand-in from before rank art
                            existed and rendered the same shape for several
                            ranks in a row, so the octagon carried no
                            information the text beside it did not already
                            give. Sized past the octagon's inner face (inset
                            5.5 of 38 -> a 27px core) because the badge art is
                            padded 6% inside its own canvas; `contain` keeps
                            the aspect and the overhang lands on the bezel the
                            same way the glyph's glow used to. */}
                        <img
                          src={rankIcon(rank)}
                          srcSet={rankIconSrcSet(rank)}
                          alt=""
                          draggable={false}
                          title={rank.name}
                          // Centred and height-driven rather than inset on all
                          // four sides: `inset` forces a square, and the art
                          // is no longer square, so a wide chevron rank would
                          // be letterboxed to half height inside the octagon.
                          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", height: "calc(100% - 7px)", width: "auto", maxWidth: "calc(100% + 4px)", objectFit: "contain", filter: `drop-shadow(0 0 7px ${rank.color}aa) drop-shadow(0 1px 2px #000)`, pointerEvents: "none" }}
                        />
                      </div>
                      <div style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
                        <b style={{ fontFamily: "var(--font-display)", fontSize: 18.9, letterSpacing: "0.05em", color: "#e8fbff", textShadow: "0 0 12px rgba(78,226,255,.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</b>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <small style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.05em", color: "rgba(200,228,242,.8)", whiteSpace: "nowrap" }}>{player.clan ? `${player.clan} · ` : ""}{player.faction ? FACTIONS[player.faction].tag : cls.name.toUpperCase()}</small>
                          <small style={{ padding: "2px 7px", fontFamily: "var(--font-display)", fontSize: 8.9, letterSpacing: "0.14em", color: "#9de9ff", background: "rgba(78,226,255,.16)", boxShadow: "inset 0 0 0 1px rgba(78,226,255,.42)", whiteSpace: "nowrap" }}>{rankLabel(rank, { withName: true })}</small>
                          <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.4, color: "rgba(196,214,238,.7)", whiteSpace: "nowrap" }}>LV {player.level}</small>
                        </div>
                      </div>
                    </div>

                    <div style={{ position: "relative", display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <small style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.22em", color: "rgba(255,201,246,.8)" }}>{nextRank ? `HONOR TO ${nextRank.name.toUpperCase()}` : "MAXIMUM RANK"}</small>
                        <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.4, fontVariantNumeric: "tabular-nums", color: "#ffc9f6" }}>{player.honor.toLocaleString()}{nextRank ? ` / ${nextRank.minHonor.toLocaleString()}` : ""}</small>
                      </div>
                      <div style={{ position: "relative", height: 10, overflow: "hidden", background: "linear-gradient(180deg,#0a0610,#04030a)", boxShadow: "inset 0 3px 6px rgba(0,0,0,.85),inset 0 0 0 1px rgba(0,0,0,.7),inset 0 -1px 0 rgba(255,92,240,.16)" }}>
                        <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${honorPct}%`, background: "linear-gradient(180deg,rgba(255,214,250,.95),#ff5cf0 46%,#8a1f80)", boxShadow: "0 0 16px rgba(255,92,240,.7)", transition: "width .5s cubic-bezier(.2,.9,.25,1)" }} />
                        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(0,0,0,.4) 0 1px,transparent 1px 5px)", pointerEvents: "none" }} />
                      </div>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(196,214,238,.55)" }}>{nextRank ? `${honorLeft.toLocaleString()} more to promote` : "Top of the ladder"}</small>
                    </div>
                  </div>

                  {/* attributes */}
                  <div style={{ position: "relative", display: "grid", gap: 4, padding: "8px 13px 9px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% 0%,rgba(184,102,255,.14),transparent 74%),linear-gradient(180deg,#0f1620,#050a0e)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 rgba(201,168,255,.2)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <small style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.26em", color: "rgba(226,200,255,.8)" }}>ATTRIBUTES</small>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 14.2, color: free > 0 ? "#eddcff" : "rgba(190,214,236,.55)" }}>{free} UNSPENT</small>
                    </div>
                    <div style={{ position: "relative", display: "flex", gap: 6 }}>
                      {[1, 5, 10].map((n) => <StepButton key={n} n={n} active={step === n} onClick={() => setStep(n as 1 | 5 | 10)} />)}
                    </div>
                    {ATTRIBUTES.map((a) => {
                      const committed = attrValue(a.id);
                      const d = draft[a.id] || 0;
                      const v = committed + d;
                      const touched = d !== 0;
                      const pct = Math.min(100, (v / Math.max(1, attrBudget())) * 100);
                      const bonus = "+" + (v * ATTR_BONUS_PCT[a.id]).toFixed(1).replace(/\.0$/, "") + "%";
                      return (
                        <div key={a.id} style={{
                          position: "relative", display: "grid", gap: 2, padding: "4px 10px 5px",
                          background: touched ? `radial-gradient(120% 100% at 0% 50%,${rgba(a.color, 0.14)},transparent 70%),linear-gradient(180deg,#0d141c,#04070c)` : "linear-gradient(180deg,#0b1118,#04070c)",
                          boxShadow: touched ? `inset 0 2px 5px rgba(0,0,0,.7),inset 0 0 0 1px ${rgba(a.color, 0.42)},inset 0 -2px 0 ${rgba(a.color, 0.38)}` : "inset 0 2px 5px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.1)",
                          clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <i style={{ width: 6, height: 6, flex: "0 0 auto", background: a.color, boxShadow: `0 0 8px ${a.color}`, transform: "rotate(45deg)" }} />
                            <b style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 11.8, letterSpacing: "0.16em", color: "#e6f3ff" }}>{a.name}</b>
                            <small style={{ fontFamily: "var(--font-mono)", fontSize: 15.9, fontVariantNumeric: "tabular-nums", color: a.color, textShadow: `0 0 9px ${rgba(a.color, 0.7)}` }}>{bonus}</small>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <PmButton glyph="−" color="red" disabled={d <= 0} onClick={() => setDraft((s) => ({ ...s, [a.id]: Math.max(0, (s[a.id] || 0) - Math.min(step, s[a.id] || 0)) }))} />
                            <div style={{ position: "relative", flex: 1, height: 7, display: "grid", alignItems: "center" }}>
                              <i style={{ position: "absolute", left: 0, right: 0, height: 7, background: "linear-gradient(180deg,#070b11,#04070b)", boxShadow: `inset 0 2px 5px rgba(0,0,0,.85),inset 0 0 0 1px rgba(0,0,0,.7),inset 0 -1px 0 ${rgba(a.color, 0.3)}` }} />
                              <i style={{ position: "absolute", left: 0, height: 7, width: `${pct}%`, background: `linear-gradient(180deg,${shade(a.color, 0.45)},${a.color} 48%,${shade(a.color, -0.45)})`, boxShadow: `0 0 12px ${rgba(a.color, 0.7)}`, transition: "width .3s cubic-bezier(.2,.9,.25,1)" }} />
                              <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(0,0,0,.42) 0 1px,transparent 1px 6px)", pointerEvents: "none" }} />
                            </div>
                            <small style={{ width: 56, flex: "0 0 auto", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 15.9, fontVariantNumeric: "tabular-nums", color: "#e6f3ff", whiteSpace: "nowrap" }}>{v} PTS</small>
                            <PmButton
                              glyph="+" color="green" disabled={free <= 0}
                              onClick={() => {
                                if (free <= 0) { setToast({ text: "No unspent points left", hex: "#ff8c9b" }); return; }
                                const n = Math.min(step, free);
                                setDraft((s) => ({ ...s, [a.id]: (s[a.id] || 0) + n }));
                                setToast(n < step ? { text: `Only ${n} point${n > 1 ? "s" : ""} left — spent those`, hex: "#cbb2f5" } : null);
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, paddingTop: 1 }}>
                      <button onClick={doRespec} aria-label="Refund every attribute point for Credits" style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer" }}>
                        <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#e2f8ff,#4b95ad 44%,#173540)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
                        <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, margin: 2.5, padding: "7px 6px", overflow: "hidden", background: "linear-gradient(180deg,#123039,#050f14)", color: "#d8f6ff", fontFamily: "var(--font-display)", fontSize: 11.2, letterSpacing: "0.14em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(157,233,255,.25)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
                          <i style={{ fontStyle: "normal", fontSize: 14.2 }}>◈</i>
                          <span>RESPEC · {RESPEC_ATTRIBUTES_COST.toLocaleString()}</span>
                        </span>
                      </button>
                      <button onClick={doCommit} disabled={draftUsed <= 0} aria-label={draftUsed > 0 ? `Commit ${draftUsed} attribute points` : "Spend points first"} style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: draftUsed > 0 ? "pointer" : "not-allowed", filter: draftUsed > 0 ? "none" : "saturate(.25) brightness(.72)" }}>
                        <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#f0e2ff,#a274d6 44%,#3a2450)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
                        <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", margin: 2.5, padding: "7px 6px", overflow: "hidden", background: "linear-gradient(180deg,#3b2358,#150c22)", color: "#f4ecff", fontFamily: "var(--font-display)", fontSize: 11.2, letterSpacing: "0.14em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(226,200,255,.25)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
                          <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(184,102,255,.85),transparent)", opacity: 0.8 }} />
                          <span>{draftUsed > 0 ? `COMMIT ${draftUsed}` : "NOTHING TO SPEND"}</span>
                        </span>
                      </button>
                    </div>
                    {toast && <small style={{ fontFamily: "var(--font-mono)", fontSize: 14.2, letterSpacing: "0.04em", color: toast.hex }}>{toast.text}</small>}
                  </div>

                  {/* active bonus summary */}
                  <div style={{ position: "relative", display: "grid", gap: 4, alignContent: "start", padding: "8px 13px 9px", background: "linear-gradient(180deg,#0f1620,#050a0e)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(157,233,255,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                    <small style={{ fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>ACTIVE BONUS</small>
                    {[
                      { k: "DAMAGE", v: `${Math.round(stats.damage)}`, hex: "#ff4d5e" },
                      { k: "HULL", v: `${Math.round(stats.hullMax)}`, hex: "#5cff8a" },
                      { k: "SHIELD", v: `${Math.round(stats.shieldMax)}`, hex: "#4ee2ff" },
                      { k: "SPEED", v: `${Math.round(stats.speed)}`, hex: "#e8b94d" },
                    ].map((t) => (
                      <div key={t.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: `inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 ${rgba(t.hex, 0.3)}` }}>
                        <i style={{ width: 5, height: 5, flex: "0 0 auto", background: t.hex, boxShadow: `0 0 7px ${t.hex}`, transform: "rotate(45deg)" }} />
                        <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.05em", color: "rgba(196,214,238,.72)" }}>{t.k}</small>
                        <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.8, fontVariantNumeric: "tabular-nums", color: t.hex }}>{t.v}</small>
                      </div>
                    ))}
                  </div>
                </div>

                {/* right column: career paths, lifetime record, detail progression */}
                <div style={{ position: "relative", display: "grid", gap: 9, alignContent: "start", gridTemplateRows: "auto auto 1fr", padding: "13px 18px", border: "2px solid rgba(78,226,255,.5)", background: "linear-gradient(150deg,#1d3644,#060b11)", boxShadow: "inset 0 0 0 2px rgba(226,250,255,.65),inset 0 0 0 4px rgba(3,7,10,.7),inset 0 0 0 6px rgba(157,233,255,.45),inset 0 0 0 8px rgba(3,7,10,.65),inset 0 0 0 10px rgba(44,132,160,.3),inset 0 0 0 12px rgba(3,7,10,.6),inset 0 0 0 14px rgba(24,66,82,.25),inset 0 0 0 16px rgba(3,7,10,.55)" }}>

                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "0 2px 2px" }}>
                    <i style={{ width: 6, height: 6, background: "#4ee2ff", boxShadow: "0 0 9px #4ee2ff", transform: "rotate(45deg)" }} />
                    <b style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 14.2, letterSpacing: "0.24em", color: "#d8f6ff" }}>CAREER PATHS</b>
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 13.6, color: "rgba(200,228,242,.7)" }}>{PATHS.length} TRACKS</small>
                  </div>

                  <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {PATHS.map((p) => {
                      const pr = pathProgress(p, player.milestones);
                      const on = career === p.id;
                      return (
                        <div
                          key={p.id} role="button" aria-label={`${p.name} path, level ${pr.lv}`} onClick={() => setCareer(p.id)}
                          style={{
                            position: "relative", padding: 5, boxSizing: "border-box", cursor: "pointer",
                            background: `linear-gradient(150deg,${shade(p.color, 0.55)},${shade(p.color, -0.08)} 40%,${shade(p.color, -0.52)} 72%,${shade(p.color, -0.72)})`,
                            clipPath: "polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)",
                            filter: `drop-shadow(0 3px 0 rgba(2,5,9,.92)) drop-shadow(0 6px 7px rgba(0,0,0,.65)) drop-shadow(0 0 ${on ? "18px" : "8px"} ${rgba(p.color, on ? 0.85 : 0.45)})`,
                          }}
                        >
                          <i style={{ position: "absolute", inset: 1.5, display: "block", background: `linear-gradient(150deg,${shade(p.color, -0.16)},${shade(p.color, -0.6)} 48%,${shade(p.color, -0.84)})`, clipPath: "polygon(13px 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%,0 13px)" }} />
                          <i style={{ position: "absolute", inset: 3, display: "block", background: `linear-gradient(150deg,${shade(p.color, -0.55)},${shade(p.color, -0.86)} 60%,#04070c)`, clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }} />
                          <div style={{ position: "relative", display: "grid", gap: 5, padding: "8px 12px 8px", overflow: "hidden", background: `radial-gradient(130% 100% at 50% -10%,${rgba(p.color, on ? 0.22 : 0.11)},transparent 74%),linear-gradient(180deg,#0f1720,#05090f 62%,#04070c)`, boxShadow: `inset 0 5px 10px rgba(0,0,0,.72),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 ${rgba(p.color, on ? 0.5 : 0.28)}`, clipPath: "polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)" }}>
                            <i style={{ position: "absolute", left: 9, right: 9, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${rgba(shade(p.color, 0.7).startsWith("rgb") ? p.color : p.color, on ? 0.85 : 0.5)},transparent)`, pointerEvents: "none" }} />
                            <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,${p.color},transparent)`, opacity: on ? 1 : 0.35, pointerEvents: "none" }} />
                            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9 }}>
                              <div style={{ position: "relative", width: 28, height: 28, flex: "0 0 auto", filter: `drop-shadow(0 2px 0 rgba(2,5,9,.9)) drop-shadow(0 0 ${on ? "18px" : "8px"} ${rgba(p.color, on ? 0.85 : 0.45)})` }}>
                                <i style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,${shade(p.color, 0.3)},${shade(p.color, -0.34)} 52%,${shade(p.color, -0.64)})`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                                <i style={{ position: "absolute", inset: 2.5, background: `radial-gradient(circle at 50% 34%,${rgba(p.color, on ? 0.5 : 0.24)},#05080f 76%)`, boxShadow: "inset 0 2px 5px rgba(0,0,0,.7)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                                <i style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontStyle: "normal", fontSize: 16.5, color: p.color, textShadow: `0 0 8px ${rgba(p.color, 0.7)}` }}>{p.icon}</i>
                              </div>
                              <div style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
                                <b style={{ fontSize: 14.2, fontWeight: 700, color: on ? "#ffffff" : "rgba(226,236,250,.86)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</b>
                                <small style={{ fontFamily: "var(--font-display)", fontSize: 8.9, letterSpacing: "0.16em", color: rgba(p.color, 0.85) }}>{pr.title.toUpperCase()}</small>
                              </div>
                              <b style={{ fontFamily: "var(--font-mono)", fontSize: 19.4, fontVariantNumeric: "tabular-nums", color: p.color, textShadow: `0 0 10px ${rgba(p.color, 0.7)}` }}>{pr.lv}</b>
                            </div>
                            <div style={{ position: "relative", display: "grid", gap: 3 }}>
                              <div style={{ position: "relative", height: 8, overflow: "hidden", background: "linear-gradient(180deg,#070b11,#04070b)", boxShadow: `inset 0 2px 5px rgba(0,0,0,.85),inset 0 0 0 1px rgba(0,0,0,.7),inset 0 -1px 0 ${rgba(p.color, 0.3)}` }}>
                                <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pr.pct}%`, background: `linear-gradient(180deg,${shade(p.color, 0.45)},${p.color} 48%,${shade(p.color, -0.45)})`, boxShadow: `0 0 12px ${rgba(p.color, 0.7)}`, transition: "width .4s cubic-bezier(.2,.9,.25,1)" }} />
                                <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(0,0,0,.4) 0 1px,transparent 1px 5px)", pointerEvents: "none" }} />
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                                <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10.6, letterSpacing: "0.04em", color: "rgba(190,214,236,.55)" }}>{p.unit}</small>
                                <small style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontVariantNumeric: "tabular-nums", color: "rgba(214,230,248,.8)" }}>{pr.v.toLocaleString()}{pr.maxed ? "" : ` / ${pr.next!.toLocaleString()}`}</small>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ position: "relative", display: "grid", gap: 9, alignContent: "start" }}>
                    {/* lifetime record */}
                    <div style={{ display: "grid", gap: 5, padding: "8px 13px 9px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% 0%,rgba(255,77,94,.1),transparent 74%),linear-gradient(180deg,#0f1620,#050a0e)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 rgba(255,140,155,.18)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                      <small style={{ fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.26em", color: "rgba(246,214,220,.8)" }}>LIFETIME RECORD</small>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                        {[
                          { k: "PLAYER KILLS", v: player.milestones.totalKills.toLocaleString(), hex: "#ff4d5e" },
                          { k: "BOSS KILLS", v: player.milestones.bossKills.toLocaleString(), hex: "#ff8c4d" },
                          { k: "DEATHS", v: player.milestones.totalDeaths.toLocaleString(), hex: "#9fb6d4" },
                        ].map((k) => (
                          <div key={k.k} style={{ position: "relative", display: "grid", gap: 1, padding: "6px 12px 7px", overflow: "hidden", background: `radial-gradient(120% 100% at 0% 0%,${rgba(k.hex, 0.13)},transparent 72%),linear-gradient(180deg,#0c1219,#04070c)`, boxShadow: `inset 0 3px 6px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 ${rgba(k.hex, 0.35)}`, clipPath: "polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)" }}>
                            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
                              <i style={{ width: 5, height: 5, background: k.hex, boxShadow: `0 0 8px ${k.hex}`, transform: "rotate(45deg)" }} />
                              <small style={{ fontFamily: "var(--font-display)", fontSize: 8.2, letterSpacing: "0.18em", color: k.hex }}>{k.k}</small>
                            </div>
                            <b style={{ position: "relative", fontFamily: "var(--font-mono)", fontSize: 18.9, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#eaf6ff", textShadow: `0 0 12px ${rgba(k.hex, 0.55)}` }}>{k.v}</b>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {[
                          { k: "ORE MINED", v: player.milestones.totalMined.toLocaleString(), hex: "#e8b94d" },
                          { k: "CREDITS EARNED", v: player.milestones.totalCreditsEarned.toLocaleString(), hex: "#5cff8a" },
                          { k: "WARPS", v: player.milestones.totalWarps.toLocaleString(), hex: "#b866ff" },
                        ].map((k) => (
                          <div key={k.k} style={{ position: "relative", display: "flex", alignItems: "center", overflow: "hidden", background: "linear-gradient(180deg,#0a0f16,#04070c)", boxShadow: `inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 ${rgba(k.hex, 0.28)}`, clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }}>
                            <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: k.hex, boxShadow: `0 0 9px ${rgba(k.hex, 0.5)}` }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 8, width: 160, flex: "0 0 auto", padding: "4px 11px", borderRight: "1px solid rgba(0,0,0,.6)" }}>
                              <i style={{ width: 6, height: 6, flex: "0 0 auto", background: k.hex, boxShadow: `0 0 8px ${rgba(k.hex, 0.5)}`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                              <small style={{ fontFamily: "var(--font-display)", fontSize: 8.2, letterSpacing: "0.12em", color: k.hex, whiteSpace: "nowrap" }}>{k.k}</small>
                            </div>
                            <b style={{ flex: 1, padding: "4px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12.6, fontVariantNumeric: "tabular-nums", color: "#eaf6ff", textShadow: `0 0 9px ${rgba(k.hex, 0.5)}` }}>{k.v}</b>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* selected career detail progression — the list box
                        itself is a FIXED height (not maxHeight), so the
                        panel's overall size can never change no matter
                        which career or how many tiers are shown. Rows are
                        spread with justify-content:space-between across
                        that fixed height instead of a top-packed gap, so
                        fewer rows (e.g. a career close to max rank with
                        only 2-3 tiers left) fill the box evenly rather
                        than clumping at the top with dead space below.
                        Overflow still scrolls if a career ever has more
                        tiers than comfortably fit. */}
                    <div style={{ display: "grid", gap: 5, padding: "8px 13px 9px", background: "linear-gradient(180deg,#0f1620,#050a0e)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(157,233,255,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                      <small style={{ fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>{curPath.name} · PROGRESSION</small>
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 5, height: 210, overflowY: "auto", paddingRight: 2 }}>
                        {curPath.tiers.map((tier, i) => {
                          const reached = curProgress.v >= tier;
                          // Progress toward THIS row's own threshold, measured from the
                          // previous tier's floor — not toward the next tier's threshold.
                          // The old formula compared progress against the gap to the
                          // NEXT tier, which reads as 0% for every unreached row whose
                          // current value is still below its own floor (e.g. 2,277 ore
                          // against a 5,000 target showed an empty bar because it was
                          // being measured against the 5,000→12,000 gap instead).
                          const prevTier = curPath.tiers[i - 1] ?? 0;
                          const segPct = reached ? 100 : Math.min(100, Math.max(0, ((curProgress.v - prevTier) / Math.max(1, tier - prevTier)) * 100));
                          if (i === 0) return null; // tier 0 is the "Recruit" floor, not a real progression row
                          return (
                            <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", overflow: "hidden", background: i % 2 ? "linear-gradient(180deg,#080d14,#04070c)" : "linear-gradient(180deg,#0b1119,#05080e)", boxShadow: `inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 ${rgba(curPath.color, 0.28)}`, clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }}>
                              <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: curPath.color, boxShadow: `0 0 8px ${rgba(curPath.color, 0.5)}`, opacity: 0.75 }} />
                              <b style={{ width: 30, flex: "0 0 auto", textAlign: "center", fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.06em", color: curPath.color, opacity: 0.65 }}>{String(i).padStart(2, "0")}</b>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, width: 172, flex: "0 0 auto", padding: "5px 11px 5px 0", borderRight: "1px solid rgba(0,0,0,.6)" }}>
                                <i style={{ width: 6, height: 6, flex: "0 0 auto", background: curPath.color, boxShadow: `0 0 7px ${rgba(curPath.color, 0.5)}`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                                <small style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.05em", color: "rgba(206,224,244,.78)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{curPath.titles[i].toUpperCase()}</small>
                              </div>
                              <div style={{ position: "relative", flex: 1, padding: "5px 13px", minWidth: 0 }}>
                                <div style={{ position: "relative", height: 5, overflow: "hidden", background: "linear-gradient(180deg,#050a10,#03060a)", boxShadow: "inset 0 2px 4px rgba(0,0,0,.9),inset 0 0 0 1px rgba(0,0,0,.7)" }}>
                                  <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${segPct}%`, background: `linear-gradient(180deg,${shade(curPath.color, 0.45)},${curPath.color} 52%,${shade(curPath.color, -0.45)})`, boxShadow: `0 0 9px ${rgba(curPath.color, 0.5)}`, transition: "width .4s cubic-bezier(.2,.9,.25,1)" }} />
                                </div>
                              </div>
                              <b style={{ width: 130, flex: "0 0 auto", padding: "5px 12px 5px 0", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12.6, fontVariantNumeric: "tabular-nums", color: reached ? curPath.color : "rgba(190,214,236,.5)", borderLeft: "1px solid rgba(0,0,0,.6)", whiteSpace: "nowrap" }}>{tier.toLocaleString()} {curPath.unit}</b>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </PrintPortal>
    </div>
  );
}

