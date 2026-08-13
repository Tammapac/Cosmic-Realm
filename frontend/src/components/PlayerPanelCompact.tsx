// Cosmic Kit P-01b · PLAYER PANEL — COMPACT.
//
// Reconstructed from a sharp reference screenshot of the Kit's own P-01b
// section (the compact variant lives in the Cosmic Kit.dc.html maintained
// in the claude.ai/design project, added there in a later session than
// the export this codebase otherwise ports 1:1 from — the local export
// only has the full P-01). All primitives/colors/chrome are the SAME as
// the full PlayerPanel — only the layout differs, per the Kit's own P-01b
// silhouette: THREE real rows, not one:
//   row 1: portrait | name+faction badge | rank+RANK n/20 | big LEVEL
//     chip + a long XP bar | quickslot hexagons flush right
//   row 2: REPUTATION segmented bar (full width) + tier name right-aligned
//     | CARGO HOLD bar (full width) + "used/max kt · free" right-aligned
//   row 3: ATTR n + SPEND | SKILL n + SPEND | CREDITS | HONOR | MCOINS (+topup)
export type PlayerPanelCompactProps = {
  onOpenSkills?: () => void;
  onOpenExchange?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenSettings?: () => void;
};
import { useGame, state as gameState, bump, cargoCapacity, attrBudget, attrSpent } from "../game/store";
import { EXP_FOR_LEVEL, FACTIONS, rankFor, rankLabel, reputationForHonor, MAX_RANK_INDEX } from "../game/types";
import { usePressable } from "./hud/usePressable";
import { HexSlotButton as HudSlotButton } from "./hud/HexSlotButton";

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

const PLAYER_PANEL_COMPACT_KEYFRAMES = `
@keyframes cPulseCompact{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes cSweepCompact{0%{transform:skewX(-18deg) translateX(-120%)}100%{transform:skewX(-18deg) translateX(760%)}}
@keyframes cFilCompact{0%,100%{opacity:.55;filter:blur(.4px)}42%{opacity:1;filter:blur(0)}68%{opacity:.75;filter:blur(.6px)}}
@keyframes cTopUpCompact{0%,100%{transform:scale(1);text-shadow:0 0 6px rgba(232,185,77,.6),0 0 14px rgba(232,185,77,.35),0 1px 1px rgba(0,0,0,.7)}50%{transform:scale(1.16);text-shadow:0 0 12px rgba(255,214,120,1),0 0 26px rgba(232,185,77,.8),0 0 44px rgba(232,185,77,.45),0 1px 1px rgba(0,0,0,.7)}}
@keyframes cGoldSheenCompact{0%{background-position:-160% 0}100%{background-position:260% 0}}
`;

const REP_TIERS = ["Adversary", "Rival", "Neutral", "Honorable", "Exalted"] as const;
const FACTION_ICON_FILE: Record<string, string> = { EIC: "eic", MMO: "mmo", VRU: "vru" };

// Row 3 wallet chip — identical markup to the full panel's WalletChip, just
// re-declared here so this file stays self-contained like the others.
function WalletChipCompact({ hex, glow, hi, lo, label, value, topUp }: { hex: string; glow: string; hi: string; lo: string; label: string; value: string; topUp?: boolean }) {
  const { hover, active, handlers } = usePressable();
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, padding: "3px 9px", flex: "0 0 auto", border: `1px solid ${hex}52`, background: `linear-gradient(150deg,${hex}1a,rgba(6,5,12,.92))`, boxShadow: "inset 0 1px 0 rgba(220,238,255,.16)", clipPath: "polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px))" }}>
      <i style={{ width: 8, height: 8, flex: "0 0 auto", background: `linear-gradient(150deg,${hi},${hex} 55%,${lo})`, boxShadow: `0 0 10px ${glow},inset 0 1px 0 rgba(255,255,255,.45)`, transform: "rotate(45deg)" }} />
      <small style={{ flex: "0 0 auto", fontSize: 8.9, letterSpacing: "0.16em", color: "rgba(206,226,246,.9)", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</small>
      <b style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 13.9, fontWeight: 700, color: hex, fontVariantNumeric: "tabular-nums", textShadow: `0 0 9px ${glow}`, whiteSpace: "nowrap" }}>{value}</b>
      {topUp && (
        <button
          aria-label="Top up MCoins" {...handlers}
          style={{
            position: "relative", flex: "0 0 auto", padding: "0 1px", marginLeft: 1, border: "none", background: "none", fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 900, lineHeight: 1, cursor: "pointer",
            filter: active ? "brightness(1.4)" : hover ? "brightness(1.25)" : "none", transition: "filter .14s ease",
          }}
        >
          <i style={{ position: "relative", fontStyle: "normal", background: "linear-gradient(168deg,#fff4d2 0%,#ffe08a 26%,#e8b94d 52%,#a97c1c 74%,#ffe6a8 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "cTopUpCompact 2.2s ease-in-out infinite", display: "inline-block" }}>+</i>
          <i style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg,transparent 38%,rgba(255,255,255,.9) 50%,transparent 62%)", backgroundSize: "260% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "cGoldSheenCompact 2.8s linear infinite", fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 900, lineHeight: 1, fontStyle: "normal", display: "grid", placeItems: "center", pointerEvents: "none" }}>+</i>
        </button>
      )}
    </div>
  );
}

// Row 3 points chip — icon badge + SPEND button, same chrome as the full
// panel's PointsChip.
function PointsChipCompact({ hex, glow, tint, label, points, onSpend }: { hex: string; glow: string; tint: string; label: string; points: number; onSpend: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 9px", flex: "0 0 auto", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
      <span style={{ position: "relative", display: "grid", placeItems: "center", width: 18, height: 18, flex: "0 0 auto", background: "linear-gradient(150deg,#e6eefa,#6d7a8c 44%,#1a212c)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }}>
        <i style={{ position: "absolute", inset: 1.5, background: `linear-gradient(165deg,${tint},rgba(5,7,13,.96))`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", boxShadow: "inset 0 2px 5px rgba(0,0,0,.8)" }} />
        <b style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 10.6, fontWeight: 800, color: hex, textShadow: `0 0 8px ${glow}` }}>{label === "ATTR" ? "◈" : "✦"}</b>
      </span>
      <small style={{ flex: "0 0 auto", fontSize: 8.9, letterSpacing: "0.16em", color: "rgba(206,226,246,.9)", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</small>
      <b style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 14.2, fontWeight: 700, color: "#f4edff", fontVariantNumeric: "tabular-nums" }}>{points}</b>
      <button
        onClick={onSpend} aria-label={`Spend ${label} points`} disabled={points <= 0} {...handlers}
        style={{
          position: "relative", flex: "0 0 auto", padding: 0, border: "none", cursor: points > 0 ? "pointer" : "default", background: "none", opacity: points > 0 ? 1 : 0.45,
          transform: points > 0 && active ? "translateY(2px)" : points > 0 && hover ? "translateY(-1px)" : "none", transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
          filter: points > 0 && active ? "brightness(1.32)" : points > 0 && hover ? "brightness(1.12)" : "none",
        }}
      >
        <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 45%,#2a3038)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }} />
        <i style={{ position: "absolute", inset: 1.4, display: "block", background: "linear-gradient(135deg,#5c6878,#161b22)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)" }} />
        <span style={{ position: "relative", display: "block", margin: 2.8, overflow: "hidden", background: `linear-gradient(180deg,${tint},rgba(8,10,16,.96))`, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,238,255,.14)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)" }}>
          <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(200,235,255,.05) 0 1px,transparent 1px 4px)" }} />
          <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${hex},transparent)`, opacity: 0.7, animation: "cPulseCompact 3s ease-in-out infinite" }} />
          <i style={{ position: "absolute", top: 0, left: "-40%", width: "24%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(255,255,255,.26),transparent)", transform: "skewX(-18deg)", animation: "cSweepCompact 3.6s ease-in-out infinite" }} />
          <b style={{ position: "relative", display: "block", padding: "4px 8px", fontFamily: "var(--font-display)", fontSize: 8.2, letterSpacing: "0.16em", fontWeight: 800, color: "#eaf4ff" }}>SPEND</b>
        </span>
      </button>
    </div>
  );
}

export function PlayerPanelCompact({ onOpenSkills, onOpenExchange, onOpenLeaderboard, onOpenSettings }: PlayerPanelCompactProps) {
  const player = useGame((s) => s.player);
  const { hover: portraitHover, active: portraitActive, handlers: portraitHandlers } = usePressable();

  const rank = rankFor(player.honor);
  const faction = player.faction ? FACTIONS[player.faction] : null;
  const rep = reputationForHonor(player.honor);
  const repTierIdx = REP_TIERS.indexOf(rep.name as (typeof REP_TIERS)[number]);
  const expToNext = EXP_FOR_LEVEL(player.level);
  const expPct = expToNext > 0 ? Math.min(1, player.exp / expToNext) : 0;
  const cargoUsed = player.cargo.reduce((a, c) => a + c.qty, 0);
  const cargoMax = cargoCapacity();
  const cargoPct = cargoMax > 0 ? Math.min(1, cargoUsed / cargoMax) : 0;
  const iconFile = faction ? FACTION_ICON_FILE[faction.tag] : undefined;
  const attrPoints = Math.max(0, attrBudget() - attrSpent());

  const openDossier = () => { gameState.showPlayerStats = true; bump(); };
  const openJournal = () => { gameState.showJournal = true; bump(); };
  const openSkills = onOpenSkills ?? (() => { gameState.showSkillTree = true; bump(); });

  return (
    // P-01b: same 4-layer metal console casing as P-01, sized to content
    // instead of the full panel's fixed 1140px — three real rows within.
    // 760px was measured too tight: row 1 alone (portrait + name/rank
    // block + level chip + a readable XP bar + 6 quickslots) needs ~900px
    // before padding, which was clipping the trailing quickslots and the
    // row-3 MCOINS chip off the right edge of the console casing.
    <div style={{ position: "relative", width: 980, padding: 7, boxSizing: "border-box", filter: "drop-shadow(0 4px 0 rgba(3,5,10,.95)) drop-shadow(0 8px 8px rgba(0,0,0,.8)) drop-shadow(0 16px 20px rgba(0,0,0,.7)) drop-shadow(0 0 24px rgba(184,102,255,.16))" }}>
      <style>{PLAYER_PANEL_COMPACT_KEYFRAMES}</style>
      <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.42),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(16px 0,calc(100% - 16px) 0,100% 16px,100% calc(100% - 16px),calc(100% - 16px) 100%,16px 100%,0 calc(100% - 16px),0 16px)" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 40%,#3f4854 74%,#232932)", clipPath: "polygon(13px 0,calc(100% - 13px) 0,100% 13px,100% calc(100% - 13px),calc(100% - 13px) 100%,13px 100%,0 calc(100% - 13px),0 13px)" }} />
      <i style={{ position: "absolute", inset: 4.5, display: "block", background: "linear-gradient(135deg,#6f7b8c,#2b323d 52%,#0e1218)", clipPath: "polygon(11px 0,calc(100% - 11px) 0,100% 11px,100% calc(100% - 11px),calc(100% - 11px) 100%,11px 100%,0 calc(100% - 11px),0 11px)" }} />
      <i style={{ position: "absolute", inset: 5.5, display: "block", background: "linear-gradient(135deg,#241533,#0a0512)", clipPath: "polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)" }} />

      <div style={{
        position: "relative", display: "grid", gap: 6, padding: "8px 12px 9px",
        background: "repeating-linear-gradient(90deg,rgba(140,190,220,.03) 0 1px,transparent 1px 3px),radial-gradient(700px 240px at 50% -26%,rgba(150,96,225,.3),rgba(96,44,168,.1) 48%,transparent 72%),linear-gradient(180deg,#2a1c3f,#120c1e 58%,#08050f)",
        boxShadow: "inset 0 3px 9px rgba(0,0,0,.7),inset 0 -1px 0 rgba(220,200,250,.2)",
        clipPath: "polygon(9px 0,calc(100% - 9px) 0,100% 9px,100% calc(100% - 9px),calc(100% - 9px) 100%,9px 100%,0 calc(100% - 9px),0 9px)",
      }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(74deg,transparent 0 26px,rgba(255,255,255,.03) 26px 27px,transparent 27px 61px),repeating-linear-gradient(-58deg,transparent 0 43px,rgba(255,255,255,.02) 43px 44px,transparent 44px 97px)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(184,102,255,.6),transparent)", boxShadow: "0 0 12px rgba(184,102,255,.55)", pointerEvents: "none" }} />

        {/* row 1: portrait | name+faction | rank | level chip + XP bar | quickslots */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <button
            onClick={openDossier} aria-label="Open pilot dossier" title="Pilot Dossier" {...portraitHandlers}
            style={{
              position: "relative", width: 36, height: 36, flex: "0 0 auto", padding: 2.5, boxSizing: "border-box", border: "none", cursor: "pointer",
              background: "linear-gradient(150deg,#f2f7ff,#8f9cae 34%,#39424f 68%,#141a24)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)",
              filter: portraitActive ? "brightness(1.3) drop-shadow(0 1px 0 rgba(3,5,10,.9)) drop-shadow(0 0 12px rgba(78,226,255,.35))" : portraitHover ? "brightness(1.22) drop-shadow(0 4px 0 rgba(3,5,10,.9)) drop-shadow(0 0 16px rgba(78,226,255,.5))" : "drop-shadow(0 2px 0 rgba(3,5,10,.9)) drop-shadow(0 0 12px rgba(78,226,255,.35))",
              transform: portraitActive ? "translateY(1px) scale(.96)" : portraitHover ? "translateY(-2px) scale(1.06)" : "none",
              transition: "transform .16s ease,filter .16s ease",
            }}
          >
            <i style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", margin: 2.5, background: "radial-gradient(circle at 50% 32%,rgba(78,226,255,.22),rgba(5,10,18,.96) 74%)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", boxShadow: "inset 0 3px 8px rgba(0,0,0,.85)" }} />
            {iconFile && <i style={{ position: "absolute", inset: 0, margin: "auto", width: 21, height: 21, backgroundImage: `url(/assets/ui/factions/${iconFile}.png)`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: "drop-shadow(0 0 6px rgba(78,226,255,.6))" }} />}
          </button>

          <div style={{ display: "grid", gap: 1, flex: "0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 900, letterSpacing: "0.05em", color: "#fbf6ff", whiteSpace: "nowrap" }}>{player.name}</b>
              {faction && (
                <span style={{ padding: "2px 6px", fontFamily: "var(--font-display)", fontSize: 7.4, letterSpacing: "0.14em", fontWeight: 700, color: faction.color, border: `1px solid ${faction.color}72`, background: `${faction.color}1a`, clipPath: "polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%)", whiteSpace: "nowrap" }}>{faction.name.toUpperCase()}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <small style={{ fontFamily: "var(--font-display)", fontSize: 8.5, letterSpacing: "0.16em", color: rank.color, whiteSpace: "nowrap" }}>{rank.name.toUpperCase()}</small>
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 7.8, color: "rgba(196,218,240,.75)", whiteSpace: "nowrap" }}>{rankLabel(rank, { total: MAX_RANK_INDEX })}</small>
            </div>
          </div>

          {/* big level chip, hexagon badge */}
          <div style={{ position: "relative", width: 30, height: 30, flex: "0 0 auto", filter: "drop-shadow(0 2px 0 rgba(3,5,10,.9)) drop-shadow(0 0 10px rgba(184,102,255,.5))" }}>
            <i style={{ position: "absolute", inset: 0, background: "linear-gradient(150deg,#e0b6ff,#8a4fc9 52%,#3a1a5c)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
            <i style={{ position: "absolute", inset: 2, background: "radial-gradient(circle at 50% 32%,rgba(184,102,255,.4),#1a0f28 76%)", boxShadow: "inset 0 2px 5px rgba(0,0,0,.7)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
            <b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 12.6, fontWeight: 900, color: "#f4ecff", textShadow: "0 0 8px rgba(184,102,255,.8)" }}>{player.level}</b>
          </div>

          {/* XP bar, fills remaining row width */}
          <div style={{ position: "relative", flex: 1, minWidth: 140, height: 12, borderRadius: 7, background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),0 2px 0 -1px rgba(3,5,10,.95),0 4px 6px -1px rgba(0,0,0,.7)" }}>
            <i style={{ position: "absolute", inset: 1.5, borderRadius: 5, background: "linear-gradient(180deg,#01030a,#0a1018 46%,#040810)", boxShadow: "inset 0 2px 5px rgba(0,0,0,.9)" }} />
            <i style={{ position: "absolute", inset: 3, borderRadius: 4, overflow: "hidden" }}>
              <i style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${expPct * 100}%`, borderRadius: "4px 1px 1px 4px", background: "linear-gradient(180deg,#e0b6ff,#b866ff 30%,#5a2a8c 88%,#b866ff)", boxShadow: "0 0 14px rgba(184,102,255,.8),inset 0 0 8px rgba(184,102,255,.5)", transition: "width .4s cubic-bezier(.2,.9,.25,1)" }}>
                <i style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1.5, transform: "translateY(-50%)", background: "linear-gradient(90deg,transparent,#fff 8%,#fff 92%,transparent)", boxShadow: "0 0 5px #fff,0 0 12px #b866ff", animation: "cFilCompact 4s ease-in-out infinite" }} />
              </i>
            </i>
            <small style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 8.2, color: "rgba(226,238,252,.92)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{Math.round(player.exp).toLocaleString()} / {expToNext.toLocaleString()}</small>
          </div>

          {/* quickslots, flush right */}
          <div style={{ display: "flex", gap: 6, flex: "0 0 auto", filter: "drop-shadow(0 2px 0 rgba(3,5,10,.9)) drop-shadow(0 4px 5px rgba(0,0,0,.7))" }}>
            <HudSlotButton glyph="⛊" title="Pilot Dossier" onClick={openDossier} size={28} />
            <HudSlotButton glyph="▤" title="Journal" onClick={openJournal} size={28} />
            <HudSlotButton glyph="▲" title="Ranking" onClick={onOpenLeaderboard} size={28} />
            <HudSlotButton glyph="⌬" title="Exchange" onClick={onOpenExchange} size={28} />
            <HudSlotButton glyph="✉" title="Mail (coming soon)" disabled size={28} />
            <HudSlotButton glyph="⚙" title="Settings" onClick={onOpenSettings} size={28} />
          </div>
        </div>

        {/* row 2: reputation (full-width bar) + cargo (full-width bar) */}
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 9px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
            <i style={{ width: 6, height: 6, flex: "0 0 auto", background: "#ff5cf0", boxShadow: "0 0 8px #ff5cf0", transform: "rotate(45deg)" }} />
            <small style={{ fontSize: 8.5, letterSpacing: "0.2em", color: "rgba(206,226,246,.9)", fontWeight: 700, whiteSpace: "nowrap" }}>REPUTATION</small>
            <div style={{ display: "flex", gap: 2, flex: 1, height: 8, minWidth: 0 }}>
              {REP_TIERS.map((t, i) => (
                <span key={t} title={t} style={{
                  position: "relative", flex: 1, height: 8,
                  background: i <= repTierIdx ? `linear-gradient(180deg,${rep.color},${rep.color}99)` : "rgba(255,255,255,.06)",
                  boxShadow: i === repTierIdx ? `0 0 8px ${rep.color},inset 0 0 0 1px ${rep.color}` : i <= repTierIdx ? `0 0 4px ${rep.color}66` : "inset 0 0 0 1px rgba(255,255,255,.08)",
                  clipPath: "polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%)",
                }} />
              ))}
            </div>
            <b style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 9.8, letterSpacing: "0.14em", color: rep.color, textShadow: `0 0 8px ${rep.color}99`, whiteSpace: "nowrap" }}>{rep.name.toUpperCase()}</b>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 9px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
            <i style={{ width: 6, height: 6, flex: "0 0 auto", background: "#4ee2ff", boxShadow: "0 0 8px #4ee2ff", transform: "rotate(45deg)" }} />
            <small style={{ fontSize: 8.5, letterSpacing: "0.2em", color: "rgba(206,226,246,.9)", fontWeight: 700, whiteSpace: "nowrap" }}>CARGO HOLD</small>
            <div style={{ position: "relative", flex: 1, height: 9, minWidth: 0, overflow: "hidden", background: "rgba(3,6,13,.9)", boxShadow: "inset 0 0 0 1px rgba(120,200,255,.28),inset 0 0 0 2px rgba(0,0,0,.8),inset 0 3px 6px rgba(0,0,0,.9)", clipPath: "polygon(3px 0,100% 0,100% calc(100% - 3px),calc(100% - 3px) 100%,0 100%,0 3px)" }}>
              <i style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${cargoPct * 100}%`, WebkitMaskImage: "repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 8px)", maskImage: "repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 8px)", background: "linear-gradient(90deg,#1a6d8a,#4ee2ff 55%,#b6f0ff)", filter: "drop-shadow(0 0 4px #4ee2ff)", transition: "width .4s cubic-bezier(.2,.9,.25,1)" }} />
            </div>
            <small style={{ flex: "0 0 auto", fontFamily: "var(--font-mono)", fontSize: 9.5, color: "#bfeaff", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{cargoUsed} / {cargoMax}</small>
          </div>
        </div>

        {/* row 3: points chips + wallet + mcoins */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
          <PointsChipCompact hex="#b866ff" glow="rgba(184,102,255,.6)" tint="rgba(184,102,255,.2)" label="ATTR" points={attrPoints} onSpend={openDossier} />
          <PointsChipCompact hex="#5cff8a" glow="rgba(92,255,138,.6)" tint="rgba(92,255,138,.18)" label="SKILL" points={player.skillPoints} onSpend={openSkills} />
          <span style={{ flex: 1, minWidth: 8 }} />
          <WalletChipCompact hex="#e8b94d" glow="rgba(232,185,77,.55)" hi="#ffe6a8" lo="#3a2c10" label="CREDITS" value={player.credits.toLocaleString()} />
          <WalletChipCompact hex="#ff5cf0" glow="rgba(255,92,240,.55)" hi="#ffc9f6" lo="#4a0d44" label="HONOR" value={player.honor.toLocaleString()} />
          <WalletChipCompact hex="#4ee2ff" glow="rgba(78,226,255,.55)" hi="#d6f8ff" lo="#0b3a4a" label="MCOINS" value={player.mcoins.toLocaleString()} topUp />
        </div>
      </div>
    </div>
  );
}
