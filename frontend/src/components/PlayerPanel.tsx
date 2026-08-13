// Ported 1:1, element-for-element, from the Cosmic Kit design export
// (Cosmic Kit.dc.html, P-01 · PLAYER PANEL markup at lines 609-774, real
// data arrays at lines 6631-6651). Structure follows the Kit exactly:
//
//   console casting (4-layer metal rim)
//     content plate
//       HUD quickslots — absolute, top:8px right:16px, z-index:10
//       ONE identity row (flex): portrait | name/faction/rank/level block
//         (padding-right:300px reserves the quickslot area) | points chips
//         (margin-left:18px, floated right within the row)
//       2 divider hairlines
//       ONE 4-column grid: reputation | cargo hold | wallet (CREDITS+HONOR
//         stacked) | mcoins (bare, un-wrapped, own grid cell)
//
// My first two attempts restructured this into stacked rows and reordered
// columns instead of translating the Kit's actual nesting — this is the
// corrected, verbatim version.
//
// Real colors/labels from the Kit's own data (not guessed):
// - hudSlots (6631): Inventory ▤ / Skills ✦ / Missions ▣ / Clan ◈ / Mail ✉
//   / Settings ⚙, color #cfe4f5, glow rgba(150,190,235,.5).
// - wallet (6641): CREDITS #e8b94d (gold), HONOR #ff5cf0 (pink) — ONE
//   stacked column, topUpShow:"none" on both (no + button).
// - mcoin (6639): its own separate array/grid-cell — #4ee2ff (cyan),
//   topUpShow:"block" (has the 25px "+" with cTopUp/cGoldSheen glow).
// - points (6647): ATTR #b866ff (purple) / SKILL #5cff8a (green).
//
// Scope decisions (explicit, this session):
// - "Points to spend" wired to real data: ATTR = attrBudget() -
//   attrSpent() (game/store.ts, the real attribute system behind
//   PlayerStatsPanel), SKILL = player.skillPoints. SPEND opens the
//   matching real panel.
// - HUD quickslots: Inventory/Skills/Missions/Clan/Settings map onto the
//   same real MenuPanel destinations (passed in as props from GameHud,
//   which already owns those handlers). Mail has no backing feature in
//   this codebase (no messaging system) — rendered disabled.
// - Reputation is a real 5-segment tier bar (Adversary/Rival/Neutral/
//   Honorable/Exalted, reputationForHonor()'s real thresholds) instead of
//   the Kit's 6-segment demo bar.
// - No rank-art PNG exists for any rank (rank_11.png is Kit demo art) —
//   rank renders as styled text only, no image slot.
//
// Replaces the old octagonal-portrait TopPanel (components/hud/TopPanel/),
// which was a bespoke "Formfamily F" design, not a Kit port at all.
import { useGame, state as gameState, bump, cargoCapacity, attrBudget, attrSpent } from "../game/store";
import { EXP_FOR_LEVEL, FACTIONS, rankFor, rankLabel, reputationForHonor } from "../game/types";
import { usePressable } from "./hud/usePressable";
import { HexSlotButton as HudSlotButton } from "./hud/HexSlotButton";

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

const PLAYER_PANEL_KEYFRAMES = `
@keyframes cPulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes cSweep{0%{transform:skewX(-18deg) translateX(-120%)}100%{transform:skewX(-18deg) translateX(760%)}}
@keyframes cFil{0%,100%{opacity:.55;filter:blur(.4px)}42%{opacity:1;filter:blur(0)}68%{opacity:.75;filter:blur(.6px)}}
@keyframes cNode{0%{background-position:0 50%}100%{background-position:-140px 50%}}
@keyframes cTopUp{0%,100%{transform:scale(1);text-shadow:0 0 6px rgba(232,185,77,.6),0 0 14px rgba(232,185,77,.35),0 1px 1px rgba(0,0,0,.7)}50%{transform:scale(1.16);text-shadow:0 0 12px rgba(255,214,120,1),0 0 26px rgba(232,185,77,.8),0 0 44px rgba(232,185,77,.45),0 1px 1px rgba(0,0,0,.7)}}
@keyframes cGoldSheen{0%{background-position:-160% 0}100%{background-position:260% 0}}
`;

const REP_TIERS = ["Adversary", "Rival", "Neutral", "Honorable", "Exalted"] as const;
const FACTION_ICON_FILE: Record<string, string> = { EIC: "eic", MMO: "mmo", VRU: "vru" };

// Kit lines 743-767: wallet (CREDITS/HONOR, topUpShow:"none") and mcoin
// (own array, topUpShow:"block") share this exact chip markup verbatim.
function WalletChip({ hex, glow, hi, lo, label, value, topUp }: { hex: string; glow: string; hi: string; lo: string; label: string; value: string; topUp?: boolean }) {
  const { hover, active, handlers } = usePressable();
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, padding: "2px 9px", border: `1px solid ${hex}52`, background: `linear-gradient(150deg,${hex}1a,rgba(6,5,12,.92))`, boxShadow: "inset 0 1px 0 rgba(220,238,255,.16)", clipPath: "polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px))" }}>
      <i style={{ width: 9, height: 9, flex: "0 0 auto", background: `linear-gradient(150deg,${hi},${hex} 55%,${lo})`, boxShadow: `0 0 11px ${glow},inset 0 1px 0 rgba(255,255,255,.45)`, transform: "rotate(45deg)" }} />
      <small style={{ flex: "0 0 auto", fontSize: 8.9, letterSpacing: "0.16em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>{label}</small>
      <b style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 14.8, fontWeight: 700, color: hex, fontVariantNumeric: "tabular-nums", textShadow: `0 0 10px ${glow}` }}>{value}</b>
      <span style={{ flex: 1 }} />
      {topUp && (
        <button
          aria-label="Top up MCoins" {...handlers}
          style={{
            position: "relative", flex: "0 0 auto", padding: "0 2px", border: "none", background: "none", fontFamily: "var(--font-display)", fontSize: 29.5, fontWeight: 900, lineHeight: 1, cursor: "pointer",
            filter: active ? "brightness(1.4)" : hover ? "brightness(1.25)" : "none", transition: "filter .14s ease",
          }}
        >
          <i style={{ position: "relative", fontStyle: "normal", background: "linear-gradient(168deg,#fff4d2 0%,#ffe08a 26%,#e8b94d 52%,#a97c1c 74%,#ffe6a8 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "cTopUp 2.2s ease-in-out infinite", display: "inline-block" }}>+</i>
          <i style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg,transparent 38%,rgba(255,255,255,.9) 50%,transparent 62%)", backgroundSize: "260% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "cGoldSheen 2.8s linear infinite", fontFamily: "var(--font-display)", fontSize: 29.5, fontWeight: 900, lineHeight: 1, fontStyle: "normal", display: "grid", placeItems: "center", pointerEvents: "none" }}>+</i>
        </button>
      )}
    </div>
  );
}

// Kit lines 684-704: points (ATTR/SKILL) chip verbatim, including the
// 5-layer chamfered SPEND button.
function PointsChip({ hex, glow, tint, label, points, onSpend }: { hex: string; glow: string; tint: string; label: string; points: number; onSpend: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 9px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
      <span style={{ position: "relative", display: "grid", placeItems: "center", width: 22, height: 22, flex: "0 0 auto", background: "linear-gradient(150deg,#e6eefa,#6d7a8c 44%,#1a212c)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }}>
        <i style={{ position: "absolute", inset: 2, background: `linear-gradient(165deg,${tint},rgba(5,7,13,.96))`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", boxShadow: "inset 0 2px 5px rgba(0,0,0,.8)" }} />
        <b style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800, color: hex, textShadow: `0 0 9px ${glow}` }}>{label === "ATTR" ? "◈" : "✦"}</b>
      </span>
      <small style={{ flex: "0 0 auto", fontSize: 8.9, letterSpacing: "0.16em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>{label}</small>
      <b style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 15.3, fontWeight: 700, color: "#f4edff", fontVariantNumeric: "tabular-nums" }}>{points}</b>
      <span style={{ flex: 1 }} />
      <button
        onClick={onSpend} aria-label={`Spend ${label} points`} disabled={points <= 0} {...handlers}
        style={{
          position: "relative", flex: "0 0 auto", padding: 0, border: "none", cursor: points > 0 ? "pointer" : "default", background: "none", opacity: points > 0 ? 1 : 0.45,
          transform: points > 0 && active ? "translateY(3px)" : points > 0 && hover ? "translateY(-2px)" : "none", transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
          filter: points > 0 && active ? "brightness(1.32)" : points > 0 && hover ? "brightness(1.12)" : "none",
        }}
      >
        <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 45%,#2a3038)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)" }} />
        <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#5c6878,#161b22)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }} />
        <span style={{ position: "relative", display: "block", margin: 3, overflow: "hidden", background: `linear-gradient(180deg,${tint},rgba(8,10,16,.96))`, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,238,255,.14)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)" }}>
          <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(200,235,255,.05) 0 1px,transparent 1px 4px)" }} />
          <i style={{ position: "absolute", left: 5, right: 5, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(230,246,255,.8),transparent)" }} />
          <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${hex},transparent)`, opacity: 0.7, animation: "cPulse 3s ease-in-out infinite" }} />
          <i style={{ position: "absolute", top: 0, left: "-40%", width: "24%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(255,255,255,.26),transparent)", transform: "skewX(-18deg)", animation: "cSweep 3.6s ease-in-out infinite" }} />
          <b style={{ position: "relative", display: "block", padding: "5px 9px", fontFamily: "var(--font-display)", fontSize: 8.9, letterSpacing: "0.16em", fontWeight: 800, color: "#eaf4ff" }}>SPEND</b>
        </span>
      </button>
    </div>
  );
}

// Kit lines 626-638: the hexagon HUD-slot button — now the shared
// HexSlotButton (components/hud/HexSlotButton.tsx, imported above as
// HudSlotButton), extracted verbatim so this quickslot row and the
// floating SideMenu render one identical frame.

export type PlayerPanelProps = {
  onOpenSkills?: () => void;
  onOpenMissions?: () => void;
  onOpenClan?: () => void;
  onOpenSettings?: () => void;
};

export function PlayerPanel({ onOpenSkills, onOpenMissions, onOpenClan, onOpenSettings }: PlayerPanelProps) {
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
    // Kit line 616: width:1080px in the demo showcase. Measured live: the
    // identity row (portrait + name/faction/rank/level + ATTR/SKILL
    // points, all side by side on one line per the Kit's own markup)
    // needs ~750px unwrapped — this panel is sized to fit that on one
    // row, same as the Kit, rather than an arbitrary narrower guess that
    // forced everything to stack/wrap.
    <div style={{ position: "relative", width: 1140, padding: 8, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 22px 26px rgba(0,0,0,.7)) drop-shadow(0 38px 48px rgba(0,0,0,.55)) drop-shadow(0 0 30px rgba(184,102,255,.16))" }}>
      <style>{PLAYER_PANEL_KEYFRAMES}</style>
      <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.42),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(18px 0,calc(100% - 18px) 0,100% 18px,100% calc(100% - 18px),calc(100% - 18px) 100%,18px 100%,0 calc(100% - 18px),0 18px)" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 40%,#3f4854 74%,#232932)", clipPath: "polygon(15px 0,calc(100% - 15px) 0,100% 15px,100% calc(100% - 15px),calc(100% - 15px) 100%,15px 100%,0 calc(100% - 15px),0 15px)" }} />
      <i style={{ position: "absolute", inset: 5, display: "block", background: "linear-gradient(135deg,#6f7b8c,#2b323d 52%,#0e1218)", clipPath: "polygon(13px 0,calc(100% - 13px) 0,100% 13px,100% calc(100% - 13px),calc(100% - 13px) 100%,13px 100%,0 calc(100% - 13px),0 13px)" }} />
      <i style={{ position: "absolute", inset: 6.5, display: "block", background: "linear-gradient(135deg,#241533,#0a0512)", clipPath: "polygon(11.5px 0,calc(100% - 11.5px) 0,100% 11.5px,100% calc(100% - 11.5px),calc(100% - 11.5px) 100%,11.5px 100%,0 calc(100% - 11.5px),0 11.5px)" }} />

      <div style={{
        // No overflow:hidden — this grid has no explicit height, so it
        // should size to its content's max-content height automatically.
        // overflow:hidden here (copied forward from the Kit's markup,
        // where the demo frame is tall enough that it never mattered) was
        // capping the box at a stale/undersized height and silently
        // clipping the bottom of the stat grid — confirmed live via
        // getBoundingClientRect: the wallet column needed 63px but only
        // rendered 50px. The clipPath below already handles the visual
        // corner-chamfer clipping geometrically, so overflow:hidden was
        // never load-bearing for that.
        position: "relative", display: "grid", gap: 4, padding: "6px 14px 7px",
        background: "repeating-linear-gradient(90deg,rgba(140,190,220,.03) 0 1px,transparent 1px 3px),radial-gradient(700px 240px at 50% -26%,rgba(150,96,225,.3),rgba(96,44,168,.1) 48%,transparent 72%),linear-gradient(180deg,#2a1c3f,#120c1e 58%,#08050f)",
        boxShadow: "inset 0 3px 9px rgba(0,0,0,.7),inset 0 -1px 0 rgba(220,200,250,.2)",
        clipPath: "polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)",
      }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(74deg,transparent 0 26px,rgba(255,255,255,.03) 26px 27px,transparent 27px 61px),repeating-linear-gradient(-58deg,transparent 0 43px,rgba(255,255,255,.02) 43px 44px,transparent 44px 97px)", pointerEvents: "none" }} />

        {/* Kit line 624/6631: HUD quickslots, absolute top-right, z-index:10.
            Slots 1+2 are the Kit's own Pilot Dossier / Journal icons (both
            exist in the Kit as separate P-panels) replacing Inventory/
            Skills — those stay reachable via the portrait button and
            MenuPanel respectively, so nothing is lost, per explicit user
            direction to keep this row at 6 slots. */}
        <div style={{ position: "absolute", top: 8, right: 16, zIndex: 10, display: "flex", gap: 9, filter: "drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7))" }}>
          <HudSlotButton glyph="⛊" title="Pilot Dossier" onClick={openDossier} />
          <HudSlotButton glyph="▤" title="Journal" onClick={openJournal} />
          <HudSlotButton glyph="▣" title="Missions" onClick={onOpenMissions} />
          <HudSlotButton glyph="◈" title="Clan" onClick={onOpenClan} />
          <HudSlotButton glyph="✉" title="Mail (coming soon)" disabled />
          <HudSlotButton glyph="⚙" title="Settings" onClick={onOpenSettings} />
        </div>

        <i style={{ position: "absolute", right: 8, top: 8, width: 5, height: 5, borderRadius: "50%", background: "radial-gradient(circle at 34% 30%,#e6eefa,#5b6675 52%,#12161d)", boxShadow: "0 1px 2px rgba(0,0,0,.85)", zIndex: 9, pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 8, bottom: 8, width: 5, height: 5, borderRadius: "50%", background: "radial-gradient(circle at 34% 30%,#e6eefa,#5b6675 52%,#12161d)", boxShadow: "0 1px 2px rgba(0,0,0,.85)", zIndex: 9, pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(184,102,255,.6),transparent)", boxShadow: "0 0 12px rgba(184,102,255,.55)", pointerEvents: "none" }} />

        {/* Kit line 647: ONE identity row — portrait, name/faction/rank/
            level block, and the ATTR/SKILL points chips, all side by side
            on the same line, exactly like the Kit's own markup. Panel is
            sized (800px) so this fits without wrapping. */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, minWidth: 0, paddingRight: 270 }}>
          <button
            onClick={openDossier} aria-label="Open pilot dossier" title="Pilot Dossier" {...portraitHandlers}
            style={{
              position: "relative", width: 44, height: 44, flex: "0 0 auto", padding: 3, boxSizing: "border-box", border: "none", cursor: "pointer",
              background: "linear-gradient(150deg,#f2f7ff,#8f9cae 34%,#39424f 68%,#141a24)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)",
              filter: portraitActive ? "brightness(1.3) drop-shadow(0 1px 0 rgba(3,5,10,.9)) drop-shadow(0 0 16px rgba(78,226,255,.35))" : portraitHover ? "brightness(1.22) drop-shadow(0 5px 0 rgba(3,5,10,.9)) drop-shadow(0 0 22px rgba(78,226,255,.5))" : "drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 0 16px rgba(78,226,255,.35))",
              transform: portraitActive ? "translateY(2px) scale(.96)" : portraitHover ? "translateY(-3px) scale(1.06)" : "none",
              transition: "transform .16s ease,filter .16s ease",
            }}
          >
            <i style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", margin: 3, background: "radial-gradient(circle at 50% 32%,rgba(78,226,255,.22),rgba(5,10,18,.96) 74%)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", boxShadow: "inset 0 3px 8px rgba(0,0,0,.85)" }} />
            {iconFile && <i style={{ position: "absolute", inset: 0, margin: "auto", width: 26, height: 26, backgroundImage: `url(/assets/ui/factions/${iconFile}.png)`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: "drop-shadow(0 0 8px rgba(78,226,255,.6))" }} />}
          </button>

          {/* Two text rows instead of the Kit's three: the rank moved inline
              behind the faction badge (the 1140px row has ample free width)
              so the whole panel loses a text-row of height — done at the
              user's explicit request to make the panel shorter without
              shrinking any font. */}
          <div style={{ display: "grid", gap: 2, flex: "0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 17.7, fontWeight: 900, letterSpacing: "0.06em", color: "#fbf6ff", whiteSpace: "nowrap" }}>{player.name}</b>
              {faction && (
                <span style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 8.9, letterSpacing: "0.18em", fontWeight: 700, color: faction.color, border: `1px solid ${faction.color}72`, background: `${faction.color}1a`, clipPath: "polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)", whiteSpace: "nowrap" }}>{faction.name.toUpperCase()}</span>
              )}
              <b style={{ fontFamily: "var(--font-display)", fontSize: 11.8, letterSpacing: "0.2em", color: rank.color, whiteSpace: "nowrap" }}>{rank.name.toUpperCase()}</b>
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(196,218,240,.8)", whiteSpace: "nowrap" }}>{rankLabel(rank)}</small>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flex: "0 0 auto" }}>
                <small style={{ fontSize: 10, letterSpacing: "0.24em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>LEVEL</small>
                <b style={{ fontFamily: "var(--font-display)", fontSize: 21.2, fontWeight: 900, lineHeight: 1, color: "#e2d2ff", textShadow: "0 0 16px rgba(184,102,255,.65)" }}>{player.level}</b>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                <span style={{ position: "relative", width: 132, height: 11, borderRadius: 7, background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),0 2px 0 -1px rgba(3,5,10,.95),0 4px 6px -1px rgba(0,0,0,.7)" }}>
                  <i style={{ position: "absolute", inset: 1.5, borderRadius: 5, background: "linear-gradient(180deg,#01030a,#0a1018 46%,#040810)", boxShadow: "inset 0 2px 5px rgba(0,0,0,.9)" }} />
                  <i style={{ position: "absolute", inset: 3, borderRadius: 4, overflow: "hidden" }}>
                    <i style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${expPct * 100}%`, borderRadius: "4px 1px 1px 4px", background: "linear-gradient(180deg,#e0b6ff,#b866ff 30%,#5a2a8c 88%,#b866ff)", boxShadow: "0 0 14px rgba(184,102,255,.8),inset 0 0 8px rgba(184,102,255,.5)", transition: "width .4s cubic-bezier(.2,.9,.25,1)" }}>
                      <i style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1.5, transform: "translateY(-50%)", background: "linear-gradient(90deg,transparent,#fff 8%,#fff 92%,transparent)", boxShadow: "0 0 5px #fff,0 0 12px #b866ff", animation: "cFil 4s ease-in-out infinite" }} />
                      <i style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 7, transform: "translateY(-50%)", background: "radial-gradient(circle at 14px 50%,#fff 0 1.3px,transparent 4px)", backgroundSize: "70px 100%", backgroundRepeat: "repeat-x", filter: "blur(.5px)", animation: "cNode 6s linear infinite", mixBlendMode: "screen" }} />
                      <i style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,.05) 32%,transparent 50%,rgba(0,0,0,.3))" }} />
                    </i>
                  </i>
                </span>
                <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(226,238,252,.92)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{Math.round(player.exp).toLocaleString()} / {expToNext.toLocaleString()}</small>
              </div>
            </div>
          </div>

          {/* Kit line 683: points chips sit in the SAME row, floated right */}
          <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
            <PointsChip hex="#b866ff" glow="rgba(184,102,255,.6)" tint="rgba(184,102,255,.2)" label="ATTR" points={attrPoints} onSpend={openDossier} />
            <PointsChip hex="#5cff8a" glow="rgba(92,255,138,.6)" tint="rgba(92,255,138,.18)" label="SKILL" points={player.skillPoints} onSpend={openSkills} />
          </div>
        </div>

        <i style={{ position: "relative", height: 1, background: "linear-gradient(90deg,transparent,rgba(184,102,255,.35) 12%,rgba(184,102,255,.35) 88%,transparent)" }} />
        <i style={{ position: "relative", height: 1, background: "linear-gradient(90deg,transparent,rgba(184,102,255,.28) 12%,rgba(184,102,255,.28) 88%,transparent)" }} />

        {/* Kit line 715: ONE 4-column grid — reputation, cargo hold,
            wallet (CREDITS+HONOR stacked), mcoins (bare, own cell). */}
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr) minmax(0,.78fr) minmax(0,.78fr)", gap: 9, minWidth: 0, alignItems: "stretch" }}>
          <div style={{ display: "grid", gap: 4, padding: "5px 10px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i style={{ width: 6, height: 6, flex: "0 0 auto", background: "#ff5cf0", boxShadow: "0 0 8px #ff5cf0", transform: "rotate(45deg)" }} />
              <small style={{ fontSize: 10, letterSpacing: "0.24em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>REPUTATION</small>
              <i style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(255,92,240,.35),transparent)" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 11.8, letterSpacing: "0.16em", color: rep.color, textShadow: `0 0 10px ${rep.color}99`, whiteSpace: "nowrap" }}>{rep.name.toUpperCase()}</b>
            </div>
            <div style={{ display: "flex", gap: 3, height: 8 }}>
              {REP_TIERS.map((t, i) => {
                const lit = i <= repTierIdx;
                const isCurrent = i === repTierIdx;
                return (
                  <span key={t} title={t} style={{
                    position: "relative", flex: 1, height: 8,
                    background: lit ? `linear-gradient(180deg,${rep.color},${rep.color}99)` : "rgba(255,255,255,.06)",
                    boxShadow: isCurrent ? `0 0 8px ${rep.color},inset 0 0 0 1px ${rep.color}` : lit ? `0 0 4px ${rep.color}66` : "inset 0 0 0 1px rgba(255,255,255,.08)",
                    clipPath: "polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%)",
                  }} />
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: 4, padding: "5px 10px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i style={{ width: 6, height: 6, flex: "0 0 auto", background: "#4ee2ff", boxShadow: "0 0 8px #4ee2ff", transform: "rotate(45deg)" }} />
              <small style={{ fontSize: 10, letterSpacing: "0.24em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>CARGO HOLD</small>
              <i style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(78,226,255,.35),transparent)" }} />
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, color: "#bfeaff", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{cargoUsed} / {cargoMax}</small>
            </div>
            <div style={{ position: "relative", height: 11, overflow: "hidden", background: "rgba(3,6,13,.9)", boxShadow: "inset 0 0 0 1px rgba(120,200,255,.28),inset 0 0 0 2px rgba(0,0,0,.8),inset 0 3px 6px rgba(0,0,0,.9)", clipPath: "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)" }}>
              <i style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${cargoPct * 100}%`, WebkitMaskImage: "repeating-linear-gradient(90deg,#000 0 6px,transparent 6px 9px)", maskImage: "repeating-linear-gradient(90deg,#000 0 6px,transparent 6px 9px)", background: "linear-gradient(90deg,#1a6d8a,#4ee2ff 55%,#b6f0ff)", filter: "drop-shadow(0 0 5px #4ee2ff)", transition: "width .4s cubic-bezier(.2,.9,.25,1)" }} />
            </div>
          </div>

          {/* Kit line 743: wallet column — CREDITS + HONOR stacked */}
          <div style={{ display: "grid", gap: 5, minWidth: 0, alignContent: "stretch" }}>
            <WalletChip hex="#e8b94d" glow="rgba(232,185,77,.55)" hi="#ffe6a8" lo="#3a2c10" label="CREDITS" value={player.credits.toLocaleString()} />
            <WalletChip hex="#ff5cf0" glow="rgba(255,92,240,.55)" hi="#ffc9f6" lo="#4a0d44" label="HONOR" value={player.honor.toLocaleString()} />
          </div>

          {/* Kit line 756: mcoin is its OWN, un-wrapped grid cell */}
          <WalletChip hex="#4ee2ff" glow="rgba(78,226,255,.55)" hi="#d6f8ff" lo="#0b3a4a" label="MCOINS" value={player.mcoins.toLocaleString()} topUp />
        </div>
      </div>
    </div>
  );
}
