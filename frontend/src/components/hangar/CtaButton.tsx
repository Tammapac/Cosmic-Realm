import React from "react";
import styles from "./HangarDockOverlay.module.css";

/**
 * The banded CTA button (BUY / SELL / SELL ALL / RENEW / service actions),
 * MIGRATED verbatim from the design export:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (helpers shadeHex/desat/rgba, methods bands()/g()/cta())
 *
 * The export builds this button's five gradient bands procedurally from ONE
 * accent colour, so a green BUY and a red SELL are the same component with a
 * different hex. Those helpers are ported exactly rather than replaced with
 * hand-picked colours, or every state would need its own palette.
 *
 * `dim` is the export's disabled treatment: desaturate the base, flatten the
 * face, drop the glow and kill pointer events — used for SELL when the player
 * holds none of a commodity.
 */

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb by a flat 0-1 amount. */
export function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) + Math.round(255 * amt);
  let g = ((n >> 8) & 255) + Math.round(255 * amt);
  let b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Pull a colour toward its own luminance — the export's disabled desaturation. */
export function desat(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const mix = (c: number) => Math.round(c + (l - c) * amt);
  return `#${((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1)}`;
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** One bevel band: a 135° gradient from `amt` to `amt - .35`. */
const band = (hex: string, amt: number) =>
  `linear-gradient(135deg,${shadeHex(hex, amt)},${shadeHex(hex, amt - 0.35)})`;

const chamfer = (c: number) =>
  `polygon(0 0,calc(100% - ${c}px) 0,100% ${c}px,100% 100%,${c}px 100%,0 calc(100% - ${c}px))`;

export interface CtaButtonProps {
  hex: string;
  label: string;
  /** Optional figure rendered inside the button face after the label, in mono —
   *  the export's "BUY 1  ·  11 CR" pattern. */
  suffix?: React.ReactNode;
  textColor?: string;
  /** Brighter face + full underline, for the primary action in a pair. */
  selected?: boolean;
  /** Disabled treatment (desaturated, no glow, not clickable). */
  dim?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export function CtaButton({
  hex, label, suffix, textColor = "#fff2e2", selected = false, dim = false, onClick, ariaLabel, style,
}: CtaButtonProps) {
  const base = dim ? desat(hex, 0.82) : hex;
  const b1 = band(base, dim ? 0.5 : 0.67);
  const b2 = band(base, dim ? 0.3 : 0.28);
  const b3 = band(base, dim ? 0.02 : -0.05);
  const b4 = band(base, dim ? -0.2 : -0.42);

  const face = dim
    ? "linear-gradient(180deg,rgba(255,255,255,.03),rgba(10,7,14,.96))"
    : `linear-gradient(180deg,${rgba(hex, selected ? 0.4 : 0.24)},rgba(10,7,14,.96))`;
  const spec = dim ? "rgba(220,210,240,.25)" : shadeHex(hex, 0.55);
  const under = dim ? "rgba(255,255,255,.1)" : hex;
  const underOp = dim ? 0.15 : selected ? 1 : 0.5;
  const color = dim ? "rgba(200,190,220,.5)" : textColor;
  const glow = dim
    ? "none"
    : `drop-shadow(0 3px 2px rgba(0,0,0,.55)) drop-shadow(0 0 ${selected ? "14px " : "9px "}${rgba(hex, selected ? 0.45 : 0.3)})`;

  return (
    <button
      aria-label={ariaLabel ?? label}
      onClick={dim ? undefined : onClick}
      disabled={dim}
      // styles.cta carries the export's hover/press behaviour (translateY ∓1px
      // plus a brightness/drop-shadow bump). It has to be a class, not inline
      // style: the export declares these with style-hover/style-active, which
      // only its own runtime understands, and an inline `filter` would win over
      // the :hover rule — so the resting glow is passed as a CSS variable that
      // the stylesheet composes into both states.
      className={dim ? undefined : styles.cta}
      style={{
        position: "relative", padding: 0, border: "none", background: "none",
        flex: "0 0 auto", cursor: dim ? "not-allowed" : "pointer",
        filter: glow, pointerEvents: dim ? "none" : "auto",
        // The resting drop-shadow, re-applied by the :hover/:active rules so the
        // glow is not lost when they replace `filter` wholesale.
        ["--cta-rest" as string]: glow,
        ["--cta-glow" as string]: rgba(hex, 0.45),
        ...style,
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: b1, clipPath: chamfer(8) }} />
      <i style={{ position: "absolute", inset: 1, display: "block", background: b2, clipPath: chamfer(7.4) }} />
      <i style={{ position: "absolute", inset: 2, display: "block", background: b3, clipPath: chamfer(6.8) }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: b4, clipPath: chamfer(6.2) }} />
      <i
        style={{
          position: "relative", display: "block", margin: 4, overflow: "hidden", background: face,
          boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,190,255,.1)",
        }}
      >
        <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${spec},transparent)` }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${under},transparent)`, opacity: underOp }} />
        <span
          style={{
            position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, padding: "9px 14px", whiteSpace: "nowrap",
          }}
        >
          <b
            style={{
              fontFamily: "Orbitron,sans-serif", fontSize: 9, fontWeight: 800,
              letterSpacing: ".14em", color,
            }}
          >
            {label}
          </b>
          {/* Trailing figure inside the face — the export puts the total in the
              button itself ("BUY 1" + "11 CR"), not in a label above it. */}
          {suffix != null && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600, color }}>
              {suffix}
            </span>
          )}
        </span>
      </i>
    </button>
  );
}
