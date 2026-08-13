import React from "react";
import styles from "./HangarDockOverlay.module.css";

/**
 * Shared "Hero Frame" shell used by every full-screen Hangar panel
 * (S-02 Bounty, S-03 Missions, S-04 Shipyard, S-06 Drones, S-07 Market,
 * S-08 Services).
 *
 * MIGRATED from the design export, not rebuilt:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *
 * This is the FIVE-layer bevel (inset 0/1/2/3/4px), which is a different shell
 * from the three-layer PanelFrame in HangarDockOverlay.tsx — S-01's small side
 * panels use that one, the large panels use this. Both are kept.
 *
 * Every gradient, inset and chamfer step is the export's own. The chamfer
 * shrinks 0.6px per layer (22 → 21.4 → 20.8 → 20.2 → 19.6 → 19.1) so the bevel
 * bands stay parallel through the corner cut; those decimals are load-bearing,
 * not noise — rounding them makes the bands visibly diverge at the chamfer.
 */

/** Chamfered-rectangle clip: top-right and bottom-left corners cut. */
export const chamferClip = (c: number) =>
  `polygon(0 0,calc(100% - ${c}px) 0,100% ${c}px,100% 100%,${c}px 100%,0 calc(100% - ${c}px))`;

export function HeroFrame({
  width,
  chamfer = 22,
  children,
}: {
  /** Fixed panel width in px, straight from the export (Shipyard 1340 etc). */
  width: number;
  chamfer?: number;
  children: React.ReactNode;
}) {
  const c = chamfer;
  return (
    <div
      style={{
        position: "relative",
        width,
        filter:
          "drop-shadow(0 8px 0 rgba(2,1,1,.9)) drop-shadow(0 16px 20px rgba(0,0,0,.65)) drop-shadow(0 30px 44px rgba(0,0,0,.55))",
      }}
    >
      <div
        className={styles.frameGlow}
        style={{
          filter:
            "drop-shadow(0 0 8px rgba(255,138,61,.55)) drop-shadow(0 0 18px rgba(255,138,61,.3))",
        }}
      >
        <div style={{ position: "relative", overflow: "hidden", clipPath: chamferClip(c) }}>
          {/* corner ticks */}
          <i
            className={styles.cornerGlow}
            style={{
              position: "absolute", top: 6, left: 6, width: 12, height: 12,
              borderTop: "1px solid rgba(255,205,160,1)", borderLeft: "1px solid rgba(255,205,160,1)",
              zIndex: 3, pointerEvents: "none",
            }}
          />
          <i
            className={styles.cornerGlow}
            style={{
              position: "absolute", bottom: 6, right: 6, width: 12, height: 12,
              borderBottom: "1px solid rgba(255,205,160,1)", borderRight: "1px solid rgba(255,205,160,1)",
              zIndex: 3, pointerEvents: "none", animationDelay: ".4s",
            }}
          />
          {/* 5-layer bevel cascade */}
          <i style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#fff6ec,#ffb673)", clipPath: chamferClip(c) }} />
          <i style={{ position: "absolute", inset: 1, background: "linear-gradient(135deg,#ffcfa0,#d9791f)", clipPath: chamferClip(c - 0.6) }} />
          <i style={{ position: "absolute", inset: 2, background: "linear-gradient(135deg,#b8681f,#5c2e0a)", clipPath: chamferClip(c - 1.2) }} />
          <i style={{ position: "absolute", inset: 3, background: "linear-gradient(135deg,#3d2410,#170e06)", clipPath: chamferClip(c - 1.8) }} />
          <i style={{ position: "absolute", inset: 4, background: "linear-gradient(135deg,#160d05,#050302)", clipPath: chamferClip(c - 2.4) }} />
          {/* dark face the content sits on */}
          <div
            style={{
              position: "relative",
              margin: 5,
              background: "linear-gradient(165deg,#140f0b,#020101)",
              boxShadow:
                "inset 0 4px 10px rgba(0,0,0,.8),inset 0 0 0 1px rgba(255,173,110,.16),inset 0 -18px 26px rgba(0,0,0,.5)",
              clipPath: chamferClip(c - 2.9),
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The red diamond close button in every panel header. Rotated 45° with its own
 * three-layer bevel, so the glyph is counter-rotated to stay upright.
 */
export function CloseDiamond({
  onClick, label, size = 26,
}: { onClick?: () => void; label: string; size?: number }) {
  // Hover/press live in styles.closeDiamond so the exact export values are used
  // — scale 1.07 / .92 with the full pressed box-shadow ladder — instead of the
  // approximations (1.06 / .94, single glow) this previously carried in React
  // state.
  //
  // `size` exists because the Loadout export draws the SAME diamond at 30px
  // while the hangar panels use 26px. Every other value is shared, so the two
  // cannot drift apart.
  const s = size / 26;
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={styles.closeDiamond}
      style={{
        position: "relative", display: "grid", placeItems: "center",
        width: size, height: size, padding: 0, border: "none",
        background: "linear-gradient(135deg,#ffd7db,#c8303f 46%,#5c0d16)",
        color: "#fff2f3", fontSize: Math.round(10 * s * 10) / 10, fontWeight: 700, cursor: "pointer",
        transform: "rotate(45deg)",
        boxShadow: "0 3px 0 -1px rgba(58,6,12,.95),0 6px 0 -3px rgba(26,3,7,.92),0 10px 16px rgba(0,0,0,.55),0 0 14px rgba(255,77,94,.22)",
      }}
    >
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#ff97a2,#9c1c29 52%,#3d080f)" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(158deg,#ff6b7c,#8d1723 58%,#2c060c)", boxShadow: "inset 0 1px 0 rgba(255,224,228,.55),inset 0 -1px 0 rgba(0,0,0,.65),inset 0 4px 7px rgba(0,0,0,.42),inset 0 -5px 9px rgba(0,0,0,.3)" }} />
      <i style={{ position: "absolute", left: 4 * s, right: 4 * s, top: 3.5 * s, height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(255,228,232,.8),transparent)" }} />
      {/* Lower highlight — present in the Loadout export's diamond. */}
      <i style={{ position: "absolute", left: 4 * s, right: 4 * s, bottom: 4 * s, height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(255,140,155,.35),transparent)" }} />
      <i style={{ position: "relative", zIndex: 1, transform: "rotate(-45deg)", fontStyle: "normal" }}>✕</i>
    </button>
  );
}

/** Card chamfer: top-LEFT + bottom-RIGHT, mirroring the panel shell's cut.
 *  The project's own card-vs-panel rule; the export follows it throughout. */
export const cardClip = (c: number) =>
  `polygon(${c}px 0,100% 0,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,0 100%,0 ${c}px)`;

/**
 * The four-layer bevel + dark face used by every CARD (bounty, mission, drone,
 * market row detail). Same cascade as HeroFrame but mirrored and one layer
 * shorter, at 13px base chamfer.
 *
 * `sheen` draws the rotating conic highlight the export puts on the focused
 * card only — pass false for the rest, or every card in a list spins at once.
 */
export function CardFrame({
  sheen = false, padding, children,
}: { sheen?: boolean; padding?: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", clipPath: cardClip(13) }}>
      <i style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#fff6ec,#ffb673)", clipPath: cardClip(13) }} />
      <i style={{ position: "absolute", inset: 1, background: "linear-gradient(135deg,#ffcfa0,#d9791f)", clipPath: cardClip(12.4) }} />
      <i style={{ position: "absolute", inset: 2, background: "linear-gradient(135deg,#b8681f,#5c2e0a)", clipPath: cardClip(11.8) }} />
      <i style={{ position: "absolute", inset: 3, background: "linear-gradient(135deg,#3d2410,#170e06)", clipPath: cardClip(11.2) }} />
      <i style={{ position: "absolute", inset: 4, overflow: "hidden", clipPath: cardClip(10.6) }}>
        {sheen && (
          <i
            className={styles.spin}
            style={{
              position: "absolute", top: "-150%", left: "-150%", width: "400%", height: "400%",
              background:
                "conic-gradient(from 0deg,rgba(255,138,61,.4) 0deg,rgba(255,138,61,.4) 285deg,#ffe4c9 325deg,#ff8a3d 345deg,rgba(255,138,61,.4) 360deg)",
            }}
          />
        )}
      </i>
      <div
        style={{
          position: "relative", margin: 5, padding,
          background: "linear-gradient(165deg,#140f0b,#020101)",
          clipPath: cardClip(10.1),
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Three-layer glow smear sliding under/over the active tab. The export drives
 * this with staggered `transition: left` (260/380/480ms) rather than keyframes,
 * so the layers trail each other while switching — EXPORT_MANIFEST §Animations.
 */
export function TabIndicator({
  leftPct, widthPct, edge,
}: { leftPct: number; widthPct: number; edge: "top" | "bottom" }) {
  const base: React.CSSProperties = {
    position: "absolute", [edge]: 0, left: `${leftPct}%`,
    width: `${widthPct}%`, pointerEvents: "none",
    background: "linear-gradient(90deg,transparent,#ff8a3d,transparent)",
  };
  return (
    <>
      <i style={{ ...base, zIndex: 4, height: 5, opacity: .28, filter: "blur(4px)", transition: "left 480ms cubic-bezier(.22,.9,.25,1)" }} />
      <i style={{ ...base, zIndex: 4, height: 3, opacity: .55, filter: "blur(2px)", transition: "left 380ms cubic-bezier(.22,.9,.25,1)" }} />
      <i style={{ ...base, zIndex: 5, height: 2, background: "linear-gradient(90deg,transparent,#ff8a3d 22%,#ff8a3d 78%,transparent)", boxShadow: "0 0 8px #ff8a3d", transition: "left 260ms cubic-bezier(.22,.9,.25,1)" }} />
    </>
  );
}

/** The amber sub-header strip every panel puts under its title bar. */
export function SubHeader({
  glyph, title, children,
}: { glyph: string; title: string; children?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "9px 14px", border: "1px solid rgba(255,138,61,.35)",
        background: "rgba(40,20,8,.5)",
        clipPath: "polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <i style={{ fontStyle: "normal", fontSize: 11, color: "#ffb673" }}>{glyph}</i>
        <b style={{ fontFamily: "Orbitron,sans-serif", fontSize: 10, letterSpacing: ".14em", color: "#ffd9b8" }}>{title}</b>
      </div>
      {children}
    </div>
  );
}

/** Panel header bar: glyph + title on the left, close diamond on the right. */
export function PanelHeader({
  glyph, title, onClose, closeLabel,
}: { glyph: string; title: string; onClose?: () => void; closeLabel: string }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,.6)",
        background: "linear-gradient(100deg,rgba(255,138,61,.16),transparent 74%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <i style={{ fontStyle: "normal", fontSize: 15, color: "#ffb673", textShadow: "0 0 8px rgba(255,138,61,.7)" }}>{glyph}</i>
        <b style={{ fontFamily: "Orbitron,sans-serif", fontSize: 15, letterSpacing: ".16em", color: "#fbe9d8" }}>{title}</b>
      </div>
      <CloseDiamond onClick={onClose} label={closeLabel} />
    </div>
  );
}
