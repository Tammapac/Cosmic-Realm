import React from "react";
import styles from "./HangarDockOverlay.module.css";

/**
 * Loadout action buttons — MIGRATED VERBATIM from the design export.
 *
 * Source: "Loadout Panel (UI Redesign Directions - Armor).dc.html", the EQUIP /
 * COMPARE / SELL buttons in the Tactical Readout.
 *
 * Each is a FIVE-plate bevel stack (inset 0/2/4/6/8) with its own clip shape,
 * over a face inset by margin 9 — not a flat bordered box. The three differ
 * only in palette and in which corners are cut:
 *
 *   equip    both TOP corners cut, ladder 16 → 16 (constant), face 10
 *   compare  bottom-LEFT cut,      ladder 14 → 10,             face 7
 *   sell     bottom-RIGHT cut,     ladder 14 → 10,             face 7
 *
 * The face carries four more layers: a 1px vertical pinstripe, a top specular
 * line, a bottom accent rule (EQUIP's pulses at cPulse 3s) and a sweep that
 * only runs on hover.
 */

type Variant = "equip" | "compare" | "sell";

/** Bevel palettes, verbatim per variant. */
const PLATES: Record<Variant, string[]> = {
  equip: [
    "linear-gradient(135deg,#fff6ec,#ffb673)",
    "linear-gradient(135deg,#ffcfa0,#d9791f)",
    "linear-gradient(135deg,#b8681f,#5c2e0a)",
    "linear-gradient(135deg,#3d2410,#170e06)",
    "linear-gradient(135deg,#160d05,#050302)",
  ],
  compare: [
    "linear-gradient(135deg,#f0e9f7,#8f7bb0)",
    "linear-gradient(135deg,#b6a2e0,#544a6e)",
    "linear-gradient(135deg,#6f5f8c,#26202f)",
    "linear-gradient(135deg,#2c2738,#151220)",
    "linear-gradient(135deg,#0e0c14,#040308)",
  ],
  sell: [
    "linear-gradient(135deg,#ffedee,#c46a72)",
    "linear-gradient(135deg,#ffb3ba,#7a3038)",
    "linear-gradient(135deg,#9c4a52,#341015)",
    "linear-gradient(135deg,#3a1418,#1e0c0e)",
    "linear-gradient(135deg,#160809,#040203)",
  ],
};

/** Clip per variant and cut size — the export's own polygons. */
function clipFor(v: Variant, c: number): string {
  if (v === "equip") {
    // both top corners cut
    return `polygon(${c}px 0,calc(100% - ${c}px) 0,100% ${c}px,100% 100%,0 100%,0 ${c}px)`;
  }
  if (v === "compare") {
    // bottom-left cut
    return `polygon(0 0,100% 0,100% 100%,${c}px 100%,0 calc(100% - ${c}px))`;
  }
  // bottom-right cut
  return `polygon(0 0,100% 0,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,0 100%)`;
}

const FACE: Record<Variant, { bg: string; pin: string; spec: string; rule: string; sweep: string; color: string; shadow: string }> = {
  equip: {
    bg: "linear-gradient(150deg,rgba(255,138,61,.42),rgba(34,20,12,.94))",
    pin: "repeating-linear-gradient(90deg,rgba(220,190,255,.05) 0 1px,transparent 1px 4px)",
    spec: "rgba(246,236,255,.7)",
    rule: "#c98cff",
    sweep: "rgba(255,255,255,.28)",
    color: "#f6ecff",
    shadow: "inset 0 3px 6px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,190,255,.15)",
  },
  compare: {
    bg: "linear-gradient(150deg,rgba(157,111,217,.16),rgba(24,17,34,.9))",
    pin: "repeating-linear-gradient(90deg,rgba(210,190,240,.045) 0 1px,transparent 1px 4px)",
    spec: "rgba(230,220,250,.55)",
    rule: "#a98adf",
    sweep: "rgba(255,255,255,.22)",
    color: "#e6def4",
    shadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(200,180,235,.12)",
  },
  sell: {
    bg: "linear-gradient(150deg,rgba(255,77,94,.18),rgba(34,10,16,.9))",
    pin: "repeating-linear-gradient(90deg,rgba(255,180,190,.05) 0 1px,transparent 1px 4px)",
    spec: "rgba(255,225,230,.6)",
    rule: "#ff6b7c",
    sweep: "rgba(255,255,255,.24)",
    color: "#ffe2e5",
    shadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,160,170,.12)",
  },
};

/** Resting drop-shadow — EQUIP sits higher than the two secondary buttons. */
const REST_SHADOW: Record<Variant, string> = {
  equip: "drop-shadow(0 8px 3px rgba(0,0,0,.55)) drop-shadow(0 16px 22px rgba(0,0,0,.5)) drop-shadow(0 0 22px rgba(255,138,61,.35))",
  compare: "drop-shadow(0 6px 2px rgba(0,0,0,.55)) drop-shadow(0 12px 16px rgba(0,0,0,.45))",
  sell: "drop-shadow(0 6px 2px rgba(0,0,0,.55)) drop-shadow(0 12px 16px rgba(0,0,0,.45))",
};

export interface LoadoutButtonProps {
  variant: Variant;
  label: string;
  glyph?: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export function LoadoutButton({
  variant, label, glyph, disabled = false, active = false, onClick, ariaLabel,
}: LoadoutButtonProps) {
  const plates = PLATES[variant];
  const f = FACE[variant];
  // Ladder: EQUIP holds 16 on every plate; the other two step 14 → 10.
  const cut = (i: number) => (variant === "equip" ? 16 : 14 - i);
  const faceCut = variant === "equip" ? 10 : 7;

  return (
    <button
      aria-label={ariaLabel ?? label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={styles.loBtn}
      style={{
        position: "relative", padding: 0, border: "none", background: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        filter: REST_SHADOW[variant],
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {plates.map((bg, i) => (
        <i key={i} style={{ position: "absolute", inset: i * 2, display: "block", background: bg, clipPath: clipFor(variant, cut(i)) }} />
      ))}

      <span
        className={styles.loBtnFace}
        style={{
          position: "relative", display: "block", margin: 9, overflow: "hidden",
          background: f.bg, boxShadow: f.shadow, clipPath: clipFor(variant, faceCut),
          ["--face-glow" as string]:
            variant === "equip" ? "rgba(184,102,255,.35)"
              : variant === "compare" ? "rgba(157,111,217,.3)" : "rgba(255,77,94,.3)",
        }}
      >
        <i style={{ position: "absolute", inset: 0, background: f.pin }} />
        <i style={{ position: "absolute", left: variant === "equip" ? 12 : 8, right: variant === "equip" ? 12 : 8, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${f.spec},transparent)` }} />
        <i
          className={variant === "equip" ? styles.pulse3 : undefined}
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: 2,
            background: `linear-gradient(90deg,transparent,${f.rule},transparent)`,
            boxShadow: variant === "equip" ? "0 0 10px #ff8a3d" : undefined,
            opacity: variant === "equip" ? 0.75 : variant === "sell" ? 0.6 : 0.55,
          }}
        />
        {/* sweep — parked off-screen, only travels on hover */}
        <i className={styles.loBtnSweep} style={{ position: "absolute", top: 0, left: "-40%", width: "26%", height: "100%", background: `linear-gradient(100deg,transparent,${f.sweep},transparent)`, transform: "skewX(-18deg)", opacity: 0 }} />
        <b
          style={{
            position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
            gap: variant === "equip" ? 9 : 7,
            padding: variant === "equip" ? "8px 12px" : "7px 10px",
            color: active ? "#ffffff" : f.color,
            fontFamily: "Orbitron,sans-serif",
            fontSize: variant === "equip" ? 13 : 11,
            fontWeight: 800, letterSpacing: ".14em",
          }}
        >
          {glyph && (
            <i style={{ fontStyle: "normal", fontSize: variant === "equip" ? 12 : 11, color: variant === "equip" ? "#ffcfa0" : f.color, textShadow: variant === "equip" ? "0 0 8px #ff8a3d" : undefined }}>
              {glyph}
            </i>
          )}
          {label}
        </b>
      </span>
    </button>
  );
}

export default LoadoutButton;
