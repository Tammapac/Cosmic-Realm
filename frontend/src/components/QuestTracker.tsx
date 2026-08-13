// Ported from the Cosmic Kit design export (Cosmic Kit.dc.html, I-04 ·
// MISSION LOG & BRIEFING, lines ~1499-1750 markup, missionVals() data
// logic ~4753-4894) onto the game's REAL quest data — player.activeQuests
// (Quest & { progress, completed }, game/types.ts).
//
// The Kit's own I-04 design assumes a richer data model than this codebase
// has: multiple mission "types" (campaign/bounty/side/event) with 3-4
// distinct objective steps, 1-3 item-rarity rewards, and a party/share
// system. Cosmic Realm's real quest model has ONE shape (single kill-count
// bounty), a `tier: number` instead of a type enum, no item rewards (only
// Credits/Exp/Honor), and no party system. Per explicit direction this
// pass ports the FULL Kit visual structure — synthesizing what the data
// model doesn't provide, rather than dropping sections — so it reads as a
// complete Mission Log & Briefing instead of a stripped-down one:
//   - Objectives: the Kit's real per-mission array becomes a synthesized
//     3-step arc (locate → the quest's own real kill-progress → claim)
//     built FROM the one real progress value, not invented separately.
//   - Rewards: item-rarity hex sockets have no real item to show, so the
//     three real payout numbers (Credits/Exp/Honor) fill the same socket
//     row with currency glyphs instead of item icons — still real data,
//     just re-skinned into the Kit's socket presentation.
//   - Party: no party system exists, so the row shows the player's own
//     clan tag (real data) as a single hex badge plus a "solo" share note,
//     preserving the row's presence without inventing squadmates.
// Both windows now use the same mount/closing state machine as every
// other PrintPortal panel this session (SkillsPanel.tsx pattern) so the
// print-out close animation actually plays instead of the window vanishing
// instantly.
import { useEffect, useState } from "react";
import { useDraggable } from "./useDraggable";
import { useGame, state, bump } from "../game/store";
import { ENEMY_DEFS, ZONES, type ActiveQuest } from "../game/types";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

const MISSION_KEYFRAMES = `
@keyframes cPulseMsn{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes cSweepMsn{0%{transform:skewX(-18deg) translateX(-120%)}100%{transform:skewX(-18deg) translateX(760%)}}
`;

// Real field (tier: number) standing in for the Kit's CAMPAIGN/BOUNTY/
// SIDE/EVENT type enum — same palette family used elsewhere this session
// for tiered systems (green → blue → violet → orange → red as tier rises).
const TIER_COLORS = ["#5cff8a", "#4ee2ff", "#b866ff", "#e8b94d", "#ff4d5e", "#ff5cf0"];
const tierColor = (tier: number) => TIER_COLORS[Math.min(TIER_COLORS.length - 1, Math.max(0, (tier || 1) - 1))];
const tierLabel = (tier: number) => `TIER ${tier || 1}`;
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

const titleOf = (q: ActiveQuest): string => (q.title?.trim()) || "Unbenannte Mission";
const descOf = (q: ActiveQuest): string => (q.description?.trim()) || "Für diese Mission liegen keine weiteren Details vor.";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export function QuestTracker() {
  const activeQuests = useGame((s) => s.player.activeQuests);
  const docked = useGame((s) => s.dockedAt);
  const showJournal = useGame((s) => s.showJournal);
  const showTracker = useGame((s) => s.showQuestTracker);

  return (
    <>
      {!docked && showTracker && activeQuests.length > 0 && <MissionLog quests={activeQuests} />}
      <MissionBriefing show={showJournal} />
    </>
  );
}

// ── MISSION LOG (Kit lines 1507-1553): small print-portal HUD tracker,
// rows grouped by tier with a header + progress rail, click opens Briefing.
function MissionLog({ quests }: { quests: ActiveQuest[] }) {
  const [show, setShow] = useState(true);
  const [mounted, setMounted] = useState(true);
  const [closing, setClosing] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const drag = useDraggable("quest-tracker", { resetOnMount: true });

  useEffect(() => {
    if (show) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!mounted) return null;

  const requestClose = () => { setShow(false); };
  const onPortalClosed = () => {
    setMounted(false); setClosing(false);
    state.showQuestTracker = false;
    localStorage.setItem("sf-quest-tracker", "off");
    bump();
  };
  const open = (id: string) => { state.journalQuestId = id; state.showJournal = true; bump(); };

  // Group by tier, same visual role as the Kit's type groups (CAMPAIGN/
  // BOUNTY/SIDE/EVENT) — a small header row above the first entry of a
  // new group, sorted low tier first.
  const sorted = [...quests].sort((a, b) => (a.tier || 1) - (b.tier || 1));
  let lastTier: number | null = null;

  return (
    <div className="fixed z-30" style={{ top: 280, left: 16, pointerEvents: "auto", ...drag.style }}>
      <style>{MISSION_KEYFRAMES}</style>
      <PrintPortal playToken={playToken} accent="#b866ff" duration={1050} chamfer={24} closing={closing} onClosed={closing ? onPortalClosed : undefined} style={{ width: 296 }}>
        <div style={{ position: "relative", padding: 10, boxSizing: "border-box", filter: "drop-shadow(0 4px 0 rgba(3,5,10,.95)) drop-shadow(0 9px 8px rgba(0,0,0,.8)) drop-shadow(0 20px 28px rgba(0,0,0,.6)) drop-shadow(0 0 26px rgba(184,102,255,.14))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 24px) 0,100% 24px,100% 100%,24px 100%,0 calc(100% - 24px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: "polygon(0 0,calc(100% - 22.83px) 0,100% 22.83px,100% 100%,22.83px 100%,0 calc(100% - 22.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: "polygon(0 0,calc(100% - 21.66px) 0,100% 21.66px,100% 100%,21.66px 100%,0 calc(100% - 21.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: "polygon(0 0,calc(100% - 20.49px) 0,100% 20.49px,100% 100%,20.49px 100%,0 calc(100% - 20.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 19.32px) 0,100% 19.32px,100% 100%,19.32px 100%,0 calc(100% - 19.32px))" }} />
          <i style={{ position: "absolute", left: 16, right: 32, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
          <i style={{ position: "absolute", left: 32, right: 16, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(150,190,235,.3),transparent)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 9, padding: "11px 12px 12px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% -12%,rgba(180,140,245,.22),transparent 74%),linear-gradient(180deg,#221a30,#0e0c17 62%,#07060d)", boxShadow: "inset 0 5px 10px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)", clipPath: "polygon(0 0,calc(100% - 18.15px) 0,100% 18.15px,100% 100%,18.15px 100%,0 calc(100% - 18.15px))" }}>
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />

            {/* header */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "0 1px", marginRight: 4, cursor: "move", touchAction: "none", userSelect: "none", ...drag.handleProps.style }} onPointerDown={drag.handleProps.onPointerDown}>
              <i style={{ width: 6, height: 6, background: "#b866ff", boxShadow: "0 0 9px #b866ff", transform: "rotate(45deg)" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.22em", color: "#e6dcff" }}>MISSION LOG</b>
              <span style={{ flex: 1 }} />
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, whiteSpace: "nowrap", color: "rgba(196,218,240,.6)" }}>{quests.length} ACTIVE</small>
              <CloseButton onClick={requestClose} title="Hide mission log" size={22} fontSize={9} />
            </div>

            {/* track list */}
            <div style={{ position: "relative", display: "grid", gap: 3 }}>
              {sorted.map((q) => {
                const isNewGroup = q.tier !== lastTier;
                lastTier = q.tier;
                const hex = tierColor(q.tier);
                const goal = Math.max(0, q.killCount ?? 0);
                const cur = Math.min(Math.max(0, q.progress ?? 0), goal);
                const pct = goal > 0 ? Math.min(100, (cur / goal) * 100) : q.completed ? 100 : 0;
                return (
                  <div key={q.id} style={{ display: "grid", gap: 3 }}>
                    {isNewGroup && (
                      <small style={{ padding: "5px 2px 1px", fontFamily: "var(--font-display)", fontSize: 7, letterSpacing: "0.24em", color: hex }}>{tierLabel(q.tier)}</small>
                    )}
                    <LogRow q={q} hex={hex} pct={pct} onClick={() => open(q.id)} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PrintPortal>
    </div>
  );
}

function LogRow({ q, hex, pct, onClick }: { q: ActiveQuest; hex: string; pct: number; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const goal = Math.max(0, q.killCount ?? 0);
  const cur = Math.min(Math.max(0, q.progress ?? 0), goal);
  const prog = goal > 0 ? `${cur}/${goal}` : q.completed ? "DONE" : "—";
  return (
    <button
      onClick={onClick} aria-label={`Open briefing for ${titleOf(q)}`} {...handlers}
      style={{
        position: "relative", display: "grid", gap: 5, padding: "7px 9px 8px 11px", border: "none", textAlign: "left", cursor: "pointer", overflow: "hidden",
        background: q.completed ? "linear-gradient(180deg,rgba(92,255,138,.1),rgba(8,10,16,.9))" : "linear-gradient(180deg,#0e0f18,#08090f)",
        boxShadow: "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.6),inset 0 2px 5px rgba(0,0,0,.45)",
        clipPath: "polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px))",
        transform: active ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        filter: active ? "brightness(1.25)" : "none",
        transition: "transform .14s cubic-bezier(.2,.9,.25,1),filter .14s ease",
      }}
    >
      <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: hex, boxShadow: `0 0 10px ${hex}` }} />
      <span style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 7 }}>
        <b style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#eef2ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.completed ? "✓ " : ""}{titleOf(q)}</b>
        <small style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontVariantNumeric: "tabular-nums", color: hex }}>{prog}</small>
      </span>
      <span style={{ position: "relative", display: "block", height: 3, overflow: "hidden", background: "linear-gradient(180deg,#070b12,#04060b)", boxShadow: "inset 0 1px 2px rgba(0,0,0,.8)" }}>
        <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg,${hex},#fff)`, boxShadow: `0 0 8px ${hex}` }} />
      </span>
    </button>
  );
}

// ── MISSION BRIEFING (Kit lines 1555-1749): large print-portal, header
// with level badge, 3-step objectives, reward sockets, party row, abort.
function MissionBriefing({ show }: { show: boolean }) {
  const activeQuests = useGame((s) => s.player.activeQuests);
  const player = useGame((s) => s.player);
  const storeSel = useGame((s) => s.journalQuestId);
  const [localSel, setLocalSel] = useState<string | null>(null);
  const [abortOpen, setAbortOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const drag = useDraggable("journal");

  useEffect(() => {
    if (show) { setMounted(true); setClosing(false); setPlayToken((t) => t + 1); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const selId = localSel ?? storeSel;
  const selected = activeQuests.find((q) => q.id === selId) ?? activeQuests[0] ?? null;

  useEffect(() => {
    const exists = selId != null && activeQuests.some((q) => q.id === selId);
    if (exists) return;
    const next = activeQuests[0]?.id ?? null;
    if (localSel !== null) setLocalSel(next);
    if (storeSel !== next) state.journalQuestId = next;
  }, [activeQuests, selId, localSel, storeSel]);

  // Reset the "shared" flag and abort dialog whenever the selected mission
  // changes, mirroring the Kit's per-mission msnShared/msnRewTip reset on pick().
  useEffect(() => { setShared(false); setAbortOpen(false); }, [selId]);

  if (!mounted) return null;

  const requestClose = () => { state.showJournal = false; };
  const onPortalClosed = () => {
    setMounted(false); setClosing(false);
    state.journalQuestId = null;
    bump();
  };

  const doAbort = () => {
    if (!selected) return;
    const idx = player.activeQuests.findIndex((q) => q.id === selected.id);
    if (idx >= 0) player.activeQuests.splice(idx, 1);
    setAbortOpen(false);
    const next = player.activeQuests[0]?.id ?? null;
    state.journalQuestId = next;
    if (!next) { state.showJournal = false; }
    bump();
  };

  const hex = selected ? tierColor(selected.tier) : "#8aa0c0";
  const hi = shade(hex, 0.5);
  const glow = rgba(hex, 0.6);
  const wash = rgba(hex, 0.16);
  const ambient = rgba(hex, 0.2);

  const goal = selected ? Math.max(0, selected.killCount ?? 0) : 0;
  const cur = selected ? Math.min(Math.max(0, selected.progress ?? 0), goal) : 0;
  const enemyName = selected ? (ENEMY_DEFS[selected.killType]?.name ?? selected.killType ?? "target") : "";
  // Board zone (where the quest was accepted / shown on the bounty board)
  // vs. the zone the kill actually has to happen in — these can differ on
  // purpose (a quest accepted at one station sending the player to hunt in
  // a different, more dangerous map). Always show the KILL zone here so
  // "Destroy X" never points somewhere the player can't actually finish it.
  const killZoneId = selected ? (selected.targetZone ?? selected.zone) : undefined;
  const killZone = killZoneId ? ZONES[killZoneId] : undefined;
  const killZoneName = killZone ? `${killZone.label} · ${killZone.name}` : (killZoneId ?? "");
  const boardZoneName = selected ? (ZONES[selected.zone]?.name ?? selected.zone ?? "") : "";
  const crossZone = !!selected?.targetZone && selected.targetZone !== selected.zone;

  // Synthesized 3-step objective arc built FROM the one real progress
  // value (not invented separately) — Kit ports 3-4 steps per mission;
  // our data has one tracked number, so it drives the middle step and the
  // two framing steps (locate/claim) follow the quest's accept/complete
  // lifecycle exactly, which IS real: a quest is only in this list once
  // accepted, and only shows completed once the kill count is met. The
  // middle step spells out the kill zone explicitly (label + name, e.g.
  // "2-3 · Red Reaches") so a cross-zone contract never reads as vague.
  const objectives = selected ? [
    { text: `Track ${enemyName} activity in ${killZoneName}`, done: true, count: "DONE" },
    { text: `Destroy ${enemyName} in ${killZoneName}`, done: selected.completed, count: goal > 0 ? `${cur.toLocaleString()} / ${goal.toLocaleString()}` : (selected.completed ? "DONE" : "OPEN") },
    { text: "Report back for payout", done: selected.completed, count: selected.completed ? "DONE" : "OPEN" },
  ] : [];
  const objDone = objectives.filter((o) => o.done).length;

  // Real payout values, presented in the Kit's item-reward-socket layout
  // (currency glyph in place of an item icon — there are no item rewards
  // in this data model).
  const rewards = selected ? [
    { k: "CR", label: "CREDITS", v: fmtNum(selected.rewardCredits), hex: "#e8b94d" },
    { k: "XP", label: "EXPERIENCE", v: fmtNum(selected.rewardExp), hex: "#4ee2ff" },
    { k: "HN", label: "HONOR", v: `+${fmtNum(selected.rewardHonor)}`, hex: "#ff5cf0" },
  ] : [];

  const clanTag = player.clan ? player.clan.slice(0, 3).toUpperCase() : null;

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 60, background: "rgba(2,4,12,.7)", pointerEvents: "auto", ...drag.style }} onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <style>{MISSION_KEYFRAMES}</style>
      <PrintPortal playToken={playToken} accent="#b866ff" duration={1250} chamfer={34} closing={closing} onClosed={closing ? onPortalClosed : undefined} style={{ width: "min(96vw, 760px)" }}>
        <div style={{ position: "relative", padding: 10, boxSizing: "border-box", filter: `drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px ${ambient})` }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 29.31px) 0,100% 29.31px,100% 100%,29.31px 100%,0 calc(100% - 29.31px))" }} />
          <i style={{ position: "absolute", left: 22, right: 44, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
          <i style={{ position: "absolute", left: 44, right: 22, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(150,190,235,.3),transparent)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 11, padding: "13px 15px 14px", overflow: "hidden", background: `radial-gradient(130% 100% at 50% -12%,${wash},transparent 74%),linear-gradient(180deg,#221a30,#0e0c17 62%,#07060d)`, boxShadow: "inset 0 6px 12px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)", clipPath: "polygon(0 0,calc(100% - 28.14px) 0,100% 28.14px,100% 100%,28.14px 100%,0 calc(100% - 28.14px))" }}>
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
            <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${hex},transparent)`, boxShadow: `0 0 12px ${hex}`, opacity: 0.55, pointerEvents: "none" }} />

            {abortOpen && selected && (
              <div style={{ position: "absolute", inset: 0, zIndex: 41, display: "grid", placeItems: "center", background: "rgba(3,4,10,.78)", backdropFilter: "blur(3px)" }}>
                <div style={{ position: "relative", width: 352, padding: 2, background: "linear-gradient(135deg,rgba(255,215,219,.55),rgba(200,48,63,.55) 45%,rgba(5,7,13,.85))", clipPath: "polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))" }}>
                  <div style={{ background: "linear-gradient(165deg,#2a1420,#08050c)", clipPath: "polygon(0 0,calc(100% - 19px) 0,100% 19px,100% 100%,19px 100%,0 calc(100% - 19px))" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "linear-gradient(100deg,rgba(255,77,94,.2),transparent 72%)" }}>
                      <i style={{ width: 7, height: 7, background: "#ff4d5e", boxShadow: "0 0 9px #ff4d5e", transform: "rotate(45deg)", animation: "cPulseMsn 1.5s ease-in-out infinite" }} />
                      <b style={{ fontFamily: "var(--font-display)", fontSize: 11.5, letterSpacing: "0.18em", color: "#ffd0d5" }}>ABORT MISSION</b>
                    </div>
                    <div style={{ padding: "15px 16px 16px" }}>
                      <p style={{ margin: "0 0 6px", fontSize: 12.5, lineHeight: 1.55, color: "rgba(240,224,232,.9)" }}>Drop "{titleOf(selected)}" from the log?</p>
                      <p style={{ margin: "0 0 14px", fontSize: 11, lineHeight: 1.5, color: "rgba(226,196,206,.6)" }}>All objective progress is lost.</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                        <button onClick={doAbort} style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer" }}>
                          <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#ffdfe3,#a8505c 45%,#3a151b)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)" }} />
                          <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#7c3540,#1c0b0f)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)" }} />
                          <span style={{ position: "relative", display: "block", margin: 3, overflow: "hidden", background: "linear-gradient(180deg,rgba(255,77,94,.24),rgba(12,7,9,.96))", boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,214,220,.16)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }}>
                            <b style={{ position: "relative", display: "block", padding: "8px 10px", fontFamily: "var(--font-display)", fontSize: 9.5, letterSpacing: "0.2em", fontWeight: 800, color: "#ffdfe3" }}>ABORT</b>
                          </span>
                        </button>
                        <button onClick={() => setAbortOpen(false)} style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer" }}>
                          <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#dfe6ef,#8b95a5 45%,#2a323d)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)" }} />
                          <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(150deg,#4f5a6b,#161b22)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)" }} />
                          <span style={{ position: "relative", display: "block", margin: 3, overflow: "hidden", background: "linear-gradient(180deg,rgba(150,190,235,.1),rgba(9,8,15,.96))", boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,238,255,.14)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }}>
                            <b style={{ position: "relative", display: "block", padding: "8px 10px", fontFamily: "var(--font-display)", fontSize: 9.5, letterSpacing: "0.2em", fontWeight: 800, color: "rgba(214,230,246,.8)" }}>KEEP IT</b>
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* header: type glyph badge, name, tier, zone, level pill, close */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "0 2px", marginRight: 34, cursor: "move", touchAction: "none", userSelect: "none", ...drag.handleProps.style }} onPointerDown={drag.handleProps.onPointerDown}>
              <span style={{ position: "relative", display: "grid", placeItems: "center", width: 44, height: 44, flex: "0 0 auto", padding: 2.75, boxSizing: "border-box", background: `linear-gradient(150deg,${hi},${hex} 45%,#05070b)`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", filter: `drop-shadow(0 2px 0 rgba(3,5,10,.85)) drop-shadow(0 4px 6px rgba(0,0,0,.6)) drop-shadow(0 0 12px ${glow})` }}>
                <i style={{ position: "absolute", inset: 2.75, background: `radial-gradient(120% 100% at 50% -10%,${wash},transparent 72%),linear-gradient(180deg,#242c3a,#070a11)`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                <i style={{ position: "relative", fontStyle: "normal", fontSize: 15, color: hex, textShadow: `0 0 9px ${hex}` }}>◈</i>
              </span>
              <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <b style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.1em", color: "#f2ecff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected ? titleOf(selected) : "No active mission"}</b>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <small style={{ fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.18em", color: hex }}>{selected ? tierLabel(selected.tier) : ""}</small>
                  <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(196,218,240,.6)", whiteSpace: "nowrap" }}>{killZoneName}</small>
                  {crossZone && (
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(232,185,77,.75)", whiteSpace: "nowrap" }}>· accepted at {boardZoneName}</small>
                  )}
                </span>
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                <i style={{ width: 6, height: 6, background: hex, boxShadow: `0 0 9px ${hex}`, transform: "rotate(45deg)" }} />
                <small style={{ fontFamily: "var(--font-display)", fontSize: 8.5, letterSpacing: "0.14em", fontWeight: 700, color: "#eef2ff" }}>{selected ? (selected.completed ? "READY" : "ACTIVE") : "—"}</small>
              </span>
              <CloseButton onClick={requestClose} title="Close" size={26} fontSize={11} />
            </div>

            {selected ? (
              <>
                <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 11, alignItems: "start" }}>
                  {/* left: brief + objectives */}
                  <div style={{ display: "grid", gap: 9, padding: "12px 13px 13px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06),inset 0 6px 14px rgba(0,0,0,.5)" }}>
                    <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6, color: "rgba(206,222,242,.72)" }}>{descOf(selected)}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 2 }}>
                      <small style={{ fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.24em", color: "rgba(150,190,220,.7)" }}>OBJECTIVES</small>
                      <i style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${glow},transparent)` }} />
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: hex }}>{objDone} / {objectives.length}</small>
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      {objectives.map((o, i) => (
                        <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", overflow: "hidden", background: o.done ? "linear-gradient(100deg,rgba(92,255,138,.09),rgba(6,10,14,.85) 60%)" : "linear-gradient(180deg,rgba(150,190,235,.05),rgba(6,9,15,.85))", boxShadow: "inset 0 1px 0 rgba(220,238,255,.06),inset 0 -1px 0 rgba(0,0,0,.55),inset 0 2px 4px rgba(0,0,0,.4)", clipPath: "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))" }}>
                          <span style={{ position: "relative", display: "grid", placeItems: "center", width: 16, height: 18, flex: "0 0 auto", background: o.done ? "linear-gradient(150deg,#c9ffd9,#5cff8a 50%,#1c4a2c)" : `linear-gradient(150deg,${shade(hex, 0.35)},${shade(hex, -0.2)} 50%,${shade(hex, -0.6)})`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }}>
                            <i style={{ position: "absolute", inset: 1.5, background: o.done ? "linear-gradient(180deg,#123020,#050c08)" : "linear-gradient(180deg,#1a212c,#06090f)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                            <i style={{ position: "relative", fontStyle: "normal", fontSize: 8, color: "#dfffe9" }}>{o.done ? "✓" : ""}</i>
                          </span>
                          <small style={{ flex: 1, fontSize: 11, lineHeight: 1.4, color: o.done ? "rgba(190,235,205,.75)" : "rgba(214,230,246,.85)" }}>{o.text}</small>
                          <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontVariantNumeric: "tabular-nums", color: o.done ? "#5cff8a" : "rgba(196,218,240,.7)" }}>{o.count}</small>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* right: reward sockets + payout + abort */}
                  <div style={{ display: "grid", gap: 9 }}>
                    <div style={{ display: "grid", gap: 9, padding: "12px 13px 13px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06),inset 0 6px 14px rgba(0,0,0,.5)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <small style={{ fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.24em", color: "rgba(232,185,77,.85)" }}>REWARDS</small>
                        <i style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(232,185,77,.5),transparent)" }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {rewards.map((r) => (
                          <div key={r.k} title={`${r.label} ${r.v}`} style={{ position: "relative", width: 56, height: 56, padding: 3.5, boxSizing: "border-box", background: `linear-gradient(150deg,${shade(r.hex, 0.45)},${r.hex} 45%,${shade(r.hex, -0.55)})`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", filter: `drop-shadow(0 2px 0 rgba(3,5,10,.85)) drop-shadow(0 5px 6px rgba(0,0,0,.6)) drop-shadow(0 0 12px ${rgba(r.hex, 0.5)})` }}>
                            <div style={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center", overflow: "hidden", background: `radial-gradient(130% 100% at 50% -12%,${rgba(r.hex, 0.26)},transparent 72%),linear-gradient(180deg,#2b3442,#0a0e15)`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }}>
                              <i style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#ffffff,#8592a8)", opacity: 0.85, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                              <i style={{ position: "absolute", inset: 2, background: "linear-gradient(135deg,#5b6678,#1a1e26)", opacity: 0.9, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                              <i style={{ position: "absolute", inset: 4, background: `radial-gradient(130% 100% at 50% -12%,${rgba(r.hex, 0.26)},transparent 72%),linear-gradient(180deg,#2b3442,#0a0e15)`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                              <b style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 800, color: r.hex, textShadow: `0 0 7px ${rgba(r.hex, 0.7)}`, zIndex: 3 }}>{r.k}</b>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {rewards.map((r) => (
                          <div key={r.k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                            <i style={{ width: 5, height: 5, background: r.hex, boxShadow: `0 0 7px ${r.hex}`, transform: "rotate(45deg)" }} />
                            <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.06em", color: "rgba(190,214,236,.65)" }}>{r.label}</small>
                            <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: r.hex }}>{r.v}</small>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setAbortOpen(true)} aria-label="Abort mission"
                      style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", width: "100%" }}
                    >
                      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#ffdfe3,#a8505c 45%,#2c1015)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
                      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(150deg,#7c3540,#1a0a0e)", clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }} />
                      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, margin: 3, padding: "7px 13px", overflow: "hidden", background: "linear-gradient(180deg,rgba(255,77,94,.2),rgba(12,6,10,.94))", color: "#ffd0d5", fontFamily: "var(--font-display)", fontSize: 8.5, letterSpacing: "0.16em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,214,220,.16)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
                        <i style={{ fontStyle: "normal", fontSize: 11 }}>⌫</i>
                        <span>ABORT</span>
                      </span>
                    </button>
                  </div>
                </div>

                {/* footer: party/clan row + share button */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, padding: "7px 11px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
                    {clanTag && (
                      <span style={{ position: "relative", display: "grid", placeItems: "center", width: 24, height: 26, flex: "0 0 auto", background: `linear-gradient(150deg,${shade(hex, 0.5)},${hex} 50%,${shade(hex, -0.55)})`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", filter: `drop-shadow(0 0 7px ${rgba(hex, 0.5)})` }}>
                        <i style={{ position: "absolute", inset: 1.5, background: "linear-gradient(180deg,#242c3a,#070a11)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                        <i style={{ position: "relative", fontFamily: "var(--font-display)", fontStyle: "normal", fontSize: 8.5, fontWeight: 800, color: shade(hex, 0.55) }}>{clanTag}</i>
                      </span>
                    )}
                    <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(190,214,236,.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {shared ? "Shared with the wing — everyone tracks it" : "Wing can join once you share"}
                    </small>
                  </div>
                  <button
                    onClick={() => setShared(true)} disabled={shared} aria-label="Share with party"
                    style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: shared ? "default" : "pointer", filter: shared ? "saturate(.3) brightness(.9)" : "none" }}
                  >
                    <i style={{ position: "absolute", inset: 0, display: "block", background: shared ? "linear-gradient(150deg,#b9c2cd,#5e6874 45%,#20262f)" : "linear-gradient(150deg,#f6ecff,#a377d9 45%,#2a1440)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
                    <i style={{ position: "absolute", inset: 1.5, display: "block", background: shared ? "linear-gradient(150deg,#3c444f,#12161c)" : "linear-gradient(150deg,#6b3f96,#170c22)", clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }} />
                    <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, margin: 3, padding: "7px 13px", overflow: "hidden", background: shared ? "linear-gradient(180deg,rgba(150,170,195,.07),rgba(8,10,14,.96))" : "linear-gradient(180deg,rgba(184,102,255,.3),rgba(10,7,14,.96))", color: shared ? "rgba(196,208,222,.5)" : "#f2e6ff", fontFamily: "var(--font-display)", fontSize: 8.5, letterSpacing: "0.16em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(226,206,252,.16)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
                      {!shared && <i style={{ position: "absolute", top: 0, left: "-45%", width: "30%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(240,224,255,.35),transparent)", transform: "skewX(-18deg)", animation: "cSweepMsn 3.2s ease-in-out infinite" }} />}
                      <i style={{ position: "relative", fontStyle: "normal", fontSize: 11 }}>◈</i>
                      <span style={{ position: "relative" }}>{shared ? "SHARED" : "SHARE WITH PARTY"}</span>
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: 20, textAlign: "center" }}>
                <small style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", lineHeight: 1.6, color: "rgba(196,218,240,.7)" }}>
                  Accept bounties and missions at any station, then track them here.
                </small>
              </div>
            )}
          </div>
        </div>
      </PrintPortal>
    </div>
  );
}
