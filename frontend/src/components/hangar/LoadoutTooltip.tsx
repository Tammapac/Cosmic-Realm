import React from "react";
import styles from "./HangarDockOverlay.module.css";
import { LOADOUT_RARITY } from "./Loadout.constants";

/**
 * Loadout hover tooltip — MIGRATED VERBATIM from the design export.
 *
 * Source: "Loadout Panel (UI Redesign Directions - Armor).dc.html", the
 * `{{ tooltip.* }}` block plus its `showTip()` / `tipFx()` builders.
 *
 * Geometry is the export's own and was wrong in the first port:
 *   width 276 (not 260) · padding 7.5 (not 1.5) · chamfer ladder 20 → 16.48
 *   bevel plates at inset 0 / 1.5 / 3 / 4.5 / 6, face at 15.6
 *
 * The bevel colours come from tipFx(): b2..b4 are the RARITY hex shaded by
 * (+.55/-.1/-.5/-.68), (-.2/-.62/-.82) and (-.62/-.88) — so the frame itself is
 * tinted per rarity. The outermost plate is a fixed steel gradient.
 *
 * Legendary / relic / celestial each get their own animated aura, verbatim:
 *   legendary  radial gold, cLegBreath 4.2s
 *   relic      radial + conic magenta, cRelicSwirl 8s + cRelicFlare 3.6s
 *   celestial  full conic spectrum, cCelDrift 11s + cCelBreath 5s, plus a sheen
 *
 * Positioning: cursor + 16px as in the export, but in VIEWPORT space — the
 * panel's shell carries `clip-path`, which clips every descendant regardless of
 * z-index, so the tooltip is portalled onto <body> by the panel.
 */

const display: React.CSSProperties = { fontFamily: "Orbitron,sans-serif" };
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace" };

const clipTR = (c: number) =>
  `polygon(0 0,calc(100% - ${c}px) 0,100% ${c}px,100% 100%,${c}px 100%,0 calc(100% - ${c}px))`;

/** shadeHex / rgba — the export's own helpers. */
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

export interface LoadoutTipData {
  name: string;
  rarity: string;
  slot: string;
  ilvl: number | null;
  icon: string;
  equipped: boolean;
  x: number;
  y: number;
}

/** tipFx — the export's rarity aura, verbatim. */
function tipFx(tier: string) {
  if (tier === "celestial") {
    return {
      show: true, sheen: true, blur: "7px", cls: styles.auraCelestial,
      bg: "conic-gradient(from 0deg,rgba(196,255,255,.6),rgba(150,214,255,.2) 14%,rgba(255,214,255,.55) 30%,rgba(180,190,255,.18) 46%,rgba(214,255,246,.55) 62%,rgba(160,220,255,.2) 78%,rgba(196,255,255,.6))",
    };
  }
  if (tier === "relic") {
    return {
      show: true, sheen: false, blur: "8px", cls: styles.auraRelic,
      bg: "radial-gradient(closest-side,rgba(255,150,246,.6),rgba(255,92,240,.22) 54%,transparent 78%),conic-gradient(from 90deg,rgba(255,92,240,.1),rgba(255,170,250,.55) 22%,rgba(255,92,240,.12) 44%,rgba(255,140,246,.5) 68%,rgba(255,92,240,.1))",
    };
  }
  if (tier === "legendary") {
    return {
      show: true, sheen: false, blur: "6px", cls: styles.auraLegendary,
      bg: "radial-gradient(closest-side,rgba(255,236,180,.62),rgba(232,185,77,.2) 58%,transparent 80%)",
    };
  }
  return { show: false, sheen: false, blur: "0px", cls: undefined, bg: "none" };
}

/**
 * The item card body — SHARED by the hover tooltip and the Tactical Readout.
 *
 * ONE shape for both: the user asked for the readout to show exactly what
 * hovering an item shows, so there is no second variant to drift out of sync.
 * `compareRows` swaps the stat block for "a → b" rows, `headLabel` overrides the
 * rarity line ("NEW · LEGENDARY" on the compare card).
 */
/** One "a → b" comparison row, the export's compareRows shape. */
export interface LoadoutCompareRow {
  label: string;
  aVal: string | number;
  bVal: string | number;
  arrow: string;
  arrowColor: string;
}

export function LoadoutItemCard({
  tip, compareRows, headLabel,
}: {
  tip: LoadoutTipData;
  /** When given, the stat block shows these instead of Item Level / Status —
   *  the export renders the compare card with exactly the same shell. */
  compareRows?: LoadoutCompareRow[];
  /** Overrides the rarity line, e.g. "NEW · LEGENDARY" on the compare card. */
  headLabel?: string;
}) {
  const d = LOADOUT_RARITY[tip.rarity] ?? LOADOUT_RARITY.common;
  const hex = d[0];
  const label = d[4];
  const wash = rgba(hex, 0.16);
  const glow = rgba(hex, 0.6);
  const fx = tipFx(tip.rarity);

  return (
    <div
      style={{
        position: "relative", zIndex: 1, overflow: "hidden",
        background: `radial-gradient(130% 100% at 50% -14%,${wash},transparent 74%),linear-gradient(180deg,#1e2632,#0c1119 62%,#05080d)`,
        boxShadow: "inset 0 5px 10px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)",
        clipPath: clipTR(15.6),
      }}
    >
      <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
      {fx.show && (
        <i className={fx.cls} style={{ position: "absolute", inset: "-40%", background: fx.bg, filter: `blur(${fx.blur})`, mixBlendMode: "screen", pointerEvents: "none" }} />
      )}
      {fx.sheen && (
        <i style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <i className={styles.celSheen} style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "22%", background: "linear-gradient(100deg,transparent,rgba(255,244,214,.4),rgba(255,222,255,.28),transparent)", filter: "blur(4px)" }} />
        </i>
      )}

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(170,205,245,.1)", background: `linear-gradient(100deg,${wash},transparent 74%)` }}>
          <i style={{ display: "block", width: 26, height: 23, flex: "0 0 auto", backgroundImage: `url(${tip.icon})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 7px ${glow})` }} />
          <span style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
            <b style={{ fontSize: 11.5, fontWeight: 700, color: "#f2f7ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tip.name}</b>
            <small style={{ ...display, fontSize: 7, letterSpacing: ".18em", color: hex }}>{headLabel ?? `${label} · ${tip.slot}`}</small>
          </span>
        </div>

        <div style={{ position: "relative", display: "grid", gap: 8, padding: "11px 12px 12px" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
              <i style={{ width: 5, height: 5, background: hex, boxShadow: `0 0 7px ${hex}`, transform: "rotate(45deg)" }} />
              <small style={{ flex: 1, ...mono, fontSize: 9, letterSpacing: ".06em", color: "rgba(186,210,236,.7)" }}>ITEM LEVEL</small>
              <b style={{ ...mono, fontSize: 10, color: "#eef4ff" }}>{tip.ilvl ?? "—"}</b>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
              <i style={{ width: 5, height: 5, background: tip.equipped ? "#5cff8a" : hex, boxShadow: `0 0 7px ${tip.equipped ? "#5cff8a" : hex}`, transform: "rotate(45deg)" }} />
              <small style={{ flex: 1, ...mono, fontSize: 9, letterSpacing: ".06em", color: "rgba(186,210,236,.7)" }}>STATUS</small>
              <b style={{ ...mono, fontSize: 10, color: tip.equipped ? "#5cff8a" : "rgba(200,215,235,.75)" }}>
                {tip.equipped ? "EQUIPPED" : "IN STORAGE"}
              </b>
            </div>
          </div>
          {compareRows ? (
            <div style={{ display: "grid", gap: 4 }}>
              {compareRows.map((cr) => (
                <div key={cr.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                  <small style={{ flex: 1, ...mono, fontSize: 9, letterSpacing: ".06em", color: "rgba(186,210,236,.7)" }}>{cr.label}</small>
                  <b style={{ ...mono, fontSize: 10, color: "#eef4ff" }}>
                    {cr.aVal} → {cr.bVal} <em style={{ fontStyle: "normal", color: cr.arrowColor }}>{cr.arrow}</em>
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <small style={{ fontSize: 8.5, letterSpacing: ".04em", color: "rgba(170,196,222,.5)" }}>
              Click to {tip.equipped ? "unequip" : "equip"}
            </small>
          )}
        </div>
    </div>
  );
}

export function LoadoutTooltip({ tip }: { tip: LoadoutTipData }) {
  const d = LOADOUT_RARITY[tip.rarity] ?? LOADOUT_RARITY.common;
  const hex = d[0];

  // Rarity-tinted bevel plates, verbatim from tipFx().
  const b2 = `linear-gradient(135deg,${shadeHex(hex, 0.55)},${shadeHex(hex, -0.1)} 38%,${shadeHex(hex, -0.5)} 72%,${shadeHex(hex, -0.68)})`;
  const b3 = `linear-gradient(135deg,${shadeHex(hex, -0.2)},${shadeHex(hex, -0.62)} 45%,${shadeHex(hex, -0.82)})`;
  const b4 = `linear-gradient(135deg,${shadeHex(hex, -0.62)},${shadeHex(hex, -0.88)} 60%,#05070b)`;

  return (
    <div
      className={styles.skTip}
      style={{
        // FIXED, not absolute: portalled onto <body> to escape the panel's
        // clip-path, so these are viewport coordinates.
        position: "fixed", left: tip.x, top: tip.y, zIndex: 9999,
        width: 276, padding: 7.5, boxSizing: "border-box", pointerEvents: "none",
        filter: `drop-shadow(0 4px 0 rgba(3,5,10,.92)) drop-shadow(0 9px 9px rgba(0,0,0,.75)) drop-shadow(0 18px 24px rgba(0,0,0,.6)) drop-shadow(0 0 22px ${hex})`,
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 45%,#2a3038)", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: clipTR(20) }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: b2, clipPath: clipTR(19.12) }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: b3, clipPath: clipTR(18.24) }} />
      <i style={{ position: "absolute", inset: 4.5, display: "block", background: b4, clipPath: clipTR(17.36) }} />
      <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: clipTR(16.48) }} />
      <LoadoutItemCard tip={tip} />
    </div>
  );
}

export default LoadoutTooltip;
