// MIGRATED from the Cosmic Kit design export — not reconstructed.
//
// Source: Downloads/N-02 Target Lock.dc.html (markup + its DCLogic tlBuild()
// builder + the cFlow / cFil keyframes). Every gradient, shadow, inset,
// clip-path and animation below is copied from that file.
//
// The Kit ships two card variants driven by `kind`:
//   npc    — flat: name + HP only, lighter drop-shadow stack
//   player — full depth: name + LEVEL + SHIP + HP, heavier shadow stack
//
// LOGIC is this project's own. The Kit hardcodes `hex` per target; here the
// colour is derived from the game's real allegiance rules:
//   red   (#ff4d5e) — all NPCs, and players of a different faction
//   green (#5cff8a) — own faction, and party members
import { useGame, state as gameState, bump } from "../game/store";

// cFlow / cFil — verbatim from the export's <style> block.
const KEYFRAMES = `
@keyframes cFlow{0%{background-position:0 50%,0 50%}100%{background-position:-260px 50%,-160px 50%}}
@keyframes cFil{0%,100%{opacity:.55;filter:blur(.4px)}42%{opacity:1;filter:blur(0)}68%{opacity:.75;filter:blur(.6px)}}
`;

// shadeHex — the Cosmic Kit main file's version (Cosmic Kit.dc.html), a plain
// lighten/darken.
//
// The N-02 export ships a variant that also mixes toward luminance
// (`gray = r*.3+g*.59+b*.11; v + (gray-v)*amt`). That is the main file's
// SEPARATE `desat()` helper folded into shadeHex, and with a negative amt it
// does not darken — it inverts. Measured on this panel's red:
//   shadeHex("#ff4d5e", -0.5)  ->  #aceced   (cyan)
//   shadeHex("#ff4d5e", -0.88) ->  #31f7f8   (cyan)
// which is exactly the blue-green bleeding through the middle of the frame.
// The plain form keeps the ramp in-hue: -0.5 -> #800000, -0.88 -> #1f0000.
function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255) + Math.round(255 * amt);
  let g = (n >> 8 & 255) + Math.round(255 * amt);
  let b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

// The export references `uploads/pasted-1785492308695-0.png` — a Claude-internal
// upload that is not in the export. The project's own brushed-metal atlas tile
// is the same material and is already used by CargoPanel/ChatPanel/HotbarPanel.
const METAL_RIM = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";

const HOSTILE = "#ff4d5e";
const FRIENDLY = "#5cff8a";

export type LockTarget = {
  kind: "npc" | "player";
  id: string;
  name: string;
  hex: string;
  hp: number;
  hpMax: number;
  lvl?: number;
  ship?: string;
};

/** One target card. Structure and every style value come from the export. */
function TargetCard({ t, onClose }: { t: LockTarget; onClose: (t: LockTarget) => void }) {
  const isPlayer = t.kind === "player";
  const pct = t.hpMax > 0 ? Math.round(t.hp / t.hpMax * 100) : 0;
  const hex = t.hex;
  const hi = shadeHex(hex, .45), lo = shadeHex(hex, -.55);
  const glow = rgba(hex, .6), wash = rgba(hex, .16);
  const b2 = `linear-gradient(135deg,${shadeHex(hex, .55)},${shadeHex(hex, -.1)} 38%,${shadeHex(hex, -.5)} 72%,${shadeHex(hex, -.68)})`;
  const b3 = `linear-gradient(135deg,${shadeHex(hex, -.2)},${shadeHex(hex, -.62)} 45%,${shadeHex(hex, -.82)})`;
  const b4 = `linear-gradient(135deg,${shadeHex(hex, -.62)},${shadeHex(hex, -.88)} 60%,#05070b)`;
  const shadowFilter = isPlayer
    ? `drop-shadow(0 4px 0 rgba(3,5,10,.9)) drop-shadow(0 9px 10px rgba(0,0,0,.7)) drop-shadow(0 17px 22px rgba(0,0,0,.55)) drop-shadow(0 0 16px ${rgba(hex, .6)})`
    : `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 7px 8px rgba(0,0,0,.6)) drop-shadow(0 0 12px ${rgba(hex, .4)})`;
  const readout = `${t.hp.toLocaleString("en-US")} / ${t.hpMax.toLocaleString("en-US")}`;

  const row = (label: string, value: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
      <i style={{ width: 5, height: 5, flex: "0 0 auto", background: hex, boxShadow: `0 0 7px ${hex}`, transform: "rotate(45deg)" }} />
      <small style={{ flex: 1, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: ".06em", color: "rgba(186,210,236,.7)" }}>{label}</small>
      <small style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, fontVariantNumeric: "tabular-nums", color: "#dbe9fb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{value}</small>
    </div>
  );

  return (
    <div style={{ position: "relative", width: 236, padding: 6, boxSizing: "border-box", filter: shadowFilter }}>
      {/* 5-band chamfer bezel: 20 → 19.12 → 18.24 → 17.36 → 16.48 → 15.6 */}
      <i style={{ position: "absolute", inset: 0, display: "block", background: METAL_RIM, backgroundSize: "cover,400% 400%", backgroundPosition: "center,100% 0%", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: b2, clipPath: "polygon(0 0,calc(100% - 19.12px) 0,100% 19.12px,100% 100%,19.12px 100%,0 calc(100% - 19.12px))" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: b3, clipPath: "polygon(0 0,calc(100% - 18.24px) 0,100% 18.24px,100% 100%,18.24px 100%,0 calc(100% - 18.24px))" }} />
      <i style={{ position: "absolute", inset: 4.5, display: "block", background: b4, clipPath: "polygon(0 0,calc(100% - 17.36px) 0,100% 17.36px,100% 100%,17.36px 100%,0 calc(100% - 17.36px))" }} />
      <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 16.48px) 0,100% 16.48px,100% 100%,16.48px 100%,0 calc(100% - 16.48px))" }} />

      <div style={{ position: "relative", zIndex: 1, overflow: "hidden", background: `radial-gradient(130% 100% at 50% -14%,${wash},transparent 74%),linear-gradient(180deg,#1e2632,#0c1119 62%,#05080d)`, boxShadow: "inset 0 5px 10px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)", clipPath: "polygon(0 0,calc(100% - 15.6px) 0,100% 15.6px,100% 100%,15.6px 100%,0 calc(100% - 15.6px))" }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />

        {/* Header */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "10px 34px 10px 12px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(170,205,245,.1)", background: `linear-gradient(100deg,${wash},transparent 74%)` }}>
          <i style={{ width: 9, height: 9, flex: "0 0 auto", background: hex, boxShadow: `0 0 9px ${hex}`, transform: "rotate(45deg)" }} />
          <span style={{ display: "grid", minWidth: 0, flex: 1 }}>
            <b style={{ fontSize: 13.5, fontWeight: 700, color: "#f2f7ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</b>
          </span>
          <button
            aria-label={`Clear target lock on ${t.name}`}
            onClick={() => onClose(t)}
            className="tl-close"
            style={{ position: "absolute", right: 11, top: 11, display: "grid", placeItems: "center", width: 22, height: 22, padding: 0, border: "none", background: "linear-gradient(135deg,#ffd7db,#c8303f 46%,#5c0d16)", color: "#fff2f3", fontSize: 9, fontWeight: 700, cursor: "pointer", transform: "rotate(45deg)", transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease", boxShadow: "0 3px 0 -1px rgba(58,6,12,.95),0 6px 0 -3px rgba(26,3,7,.92),0 9px 14px rgba(0,0,0,.55),0 0 12px rgba(255,77,94,.22)" }}
          >
            <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#ff97a2,#9c1c29 52%,#3d080f)" }} />
            <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(158deg,#ff6b7c,#8d1723 58%,#2c060c)", boxShadow: "inset 0 1px 0 rgba(255,224,228,.55),inset 0 -1px 0 rgba(0,0,0,.65),inset 0 4px 7px rgba(0,0,0,.42)" }} />
            <i style={{ position: "absolute", left: 3.5, right: 3.5, top: 3, height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(255,228,232,.8),transparent)" }} />
            <i style={{ position: "relative", transform: "rotate(-45deg)", fontStyle: "normal", textShadow: "0 1px 2px rgba(46,0,4,.9)" }}>✕</i>
          </button>
        </div>

        {/* Body */}
        <div style={{ position: "relative", display: "grid", gap: 5, padding: "10px 12px 4px" }}>
          {isPlayer && row("LEVEL", String(t.lvl ?? 0))}
          {isPlayer && row("SHIP", t.ship ?? "")}

          {/* HP vitals capsule */}
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <b style={{ width: 20, flex: "0 0 auto", fontFamily: "Orbitron,sans-serif", fontSize: 7, letterSpacing: ".16em", color: hex, textShadow: `0 0 8px ${glow}` }}>HP</b>
            <span style={{ position: "relative", flex: 1, height: 16, borderRadius: 8, background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.55),inset -1px -1px 1px rgba(0,0,0,.7),0 2px 0 -1px rgba(3,5,10,.95),0 4px 5px -1px rgba(0,0,0,.75)" }}>
              <i style={{ position: "absolute", inset: 1.5, borderRadius: 6.5, background: "linear-gradient(180deg,#01030a 0%,#0a1018 46%,#040810 100%)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.9),inset 0 3px 6px rgba(0,0,0,.9)" }} />
              <i style={{ position: "absolute", inset: 3, borderRadius: 5.5, overflow: "hidden" }}>
                <i style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pct}%`, borderRadius: 5.5, overflow: "hidden", background: `linear-gradient(180deg,${hi} 0%,${hex} 26%,${hex} 62%,${lo} 88%,${hex} 100%)`, boxShadow: `0 0 14px ${glow},0 0 26px ${glow},inset 0 0 10px ${hex}`, transition: "width .5s cubic-bezier(.2,.9,.25,1)" }}>
                  <i style={{ position: "absolute", inset: "-45% 0", background: "radial-gradient(70% 120% at 30% 50%,rgba(255,255,255,.22),transparent 72%),radial-gradient(90% 140% at 78% 50%,rgba(255,255,255,.14),transparent 74%)", backgroundSize: "260px 100%,410px 100%", backgroundRepeat: "repeat-x", filter: "blur(5px)", animation: "cFlow 4.6s linear infinite", mixBlendMode: "screen" }} />
                  <i style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, transform: "translateY(-50%)", background: "linear-gradient(90deg,transparent,#ffffff 6%,#ffffff 94%,transparent)", boxShadow: `0 0 5px #ffffff,0 0 12px ${hex},0 0 20px ${glow}`, animation: "cFil 3.6s ease-in-out infinite" }} />
                  <i style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.34) 0%,rgba(255,255,255,.06) 30%,transparent 48%,rgba(0,0,0,.3) 100%)" }} />
                </i>
                <i style={{ position: "absolute", inset: 0, borderRadius: 5.5, background: "linear-gradient(180deg,rgba(255,255,255,.2) 0%,rgba(255,255,255,.03) 40%,transparent 55%,rgba(255,255,255,.05) 100%)", pointerEvents: "none" }} />
              </i>
              <i style={{ position: "absolute", left: 6, right: 6, top: 2, height: 1, borderRadius: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)" }} />
            </span>
            <small style={{ flex: "0 0 auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontVariantNumeric: "tabular-nums", color: "#dbe9fb" }}>{readout}</small>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TargetLockPanel() {
  const sel = useGame((s) => s.selectedWorldTarget);
  const enemies = useGame((s) => s.enemies);
  const others = useGame((s) => s.others);
  const player = useGame((s) => s.player);

  if (!sel || sel.kind === "asteroid") return null;

  let target: LockTarget | null = null;

  if (sel.kind === "enemy") {
    const e = enemies.find((x) => x.id === sel.id);
    if (e) {
      // Every NPC is hostile — red, flat card.
      target = {
        kind: "npc", id: e.id,
        name: e.name ?? e.type.toUpperCase(),
        hex: HOSTILE, hp: Math.max(0, Math.round(e.hull)), hpMax: Math.round(e.hullMax),
      };
    }
  } else if (sel.kind === "player") {
    const p = others.find((x) => x.id === sel.id);
    if (p) {
      // Green for party members and own faction, red for anyone else.
      const friendly = p.inParty || (!!player.faction && p.faction === player.faction);
      target = {
        kind: "player", id: p.id, name: p.name,
        hex: friendly ? FRIENDLY : HOSTILE,
        hp: Math.max(0, Math.round(p.hull)), hpMax: Math.round(p.hullMax),
        lvl: p.level, ship: p.shipClass,
      };
    }
  }

  if (!target) return null;

  const clear = () => {
    gameState.selectedWorldTarget = null;
    gameState.attackTargetId = null;
    gameState.isLaserFiring = false;
    gameState.isRocketFiring = false;
    gameState.isAttacking = false;
    bump();
  };

  return (
    // Sits immediately to the RIGHT of the player panel, top-aligned with it.
    // GameHud places that panel at left:24 / top:48 and PlayerPanelCompact is
    // 980px wide, so it ends at x=1004; 12px gap puts this at 1016. Previously
    // this was centred (left:50%), which laid it straight over the panel.
    <div style={{ position: "fixed", left: "min(1016px, calc(100vw - 260px))", top: 48, zIndex: 12, pointerEvents: "auto" }}>
      <style>{KEYFRAMES}{`
        .tl-close:hover{filter:brightness(1.14);transform:rotate(45deg) scale(1.08)}
        .tl-close:active{transform:rotate(45deg) scale(.92);filter:brightness(1.3)}
      `}</style>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <TargetCard t={target} onClose={clear} />
      </div>
    </div>
  );
}
