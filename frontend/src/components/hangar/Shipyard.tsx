import React from "react";
import styles from "./HangarDockOverlay.module.css";
import { HeroFrame, PanelHeader } from "./HeroFrame";
import {
  SHIPYARD_HULLS, STAT_CAPS, STAT_ORDER, LORE_ORDER,
  CARD_W, CARD_GAP, CARD_STEP, VIEW_W, VIEW_H, PANEL_W,
  CARD_SCALE, CARD_OPACITY, TRACK_TRANSITION,
  type ShipyardHull, type ShipStats,
} from "./Shipyard.constants";

/**
 * S-04 · Shipyard
 *
 * MIGRATED from the design export, not rebuilt:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (section "S-04 · SHIPYARD")
 *
 * Every gradient, clip-path, inset, shadow and animation value is the export's
 * own. Two project adaptations, the same two the Dock Overlay already made:
 *
 *   1. Fonts. NONE — the export's own `Orbitron` / `JetBrains Mono` are used
 *      verbatim. They are loaded in index.html for these panels. (Earlier this
 *      port substituted --font-display / --font-mono; that rendered the carousel
 *      chevrons round instead of angular and was rejected on sight.)
 *   2. Ship render. The export's <image-slot id="shipyard-hero-N"> is an EMPTY
 *      drag-and-drop placeholder (no artwork exists to export — EXPORT_MANIFEST
 *      §Assets). PORT_NOTES.md §1 resolves this: the slot is filled from THIS
 *      project's renders. `renderShip` receives the hull and returns a node; the
 *      250x250 / perspective:700px / cTurntable wrapper around it is preserved
 *      exactly, so the motion language is unchanged whatever goes inside.
 *
 * Card chamfers are cut top-LEFT/bottom-RIGHT (13px), mirroring the panel shell's
 * top-right/bottom-left cut — the project's own card-vs-panel rule, and the
 * export follows it here.
 */

// The export writes "font-family:Orbitron,sans-serif" literally on 154 rules.
// NOT var(--font-display): that token is the project's Kenney Future Narrow,
// whose U+2039/U+203A chevrons are round — the carousel arrows then read as
// circles instead of the design's sharp angular arrows. Orbitron is loaded in
// index.html for exactly this reason.
const display: React.CSSProperties = { fontFamily: "Orbitron,sans-serif" };
// The export writes "font-family:'JetBrains Mono',monospace" on 86 rules.
// --font-mono was never defined anywhere in this project, so this resolved
// to nothing and every figure fell back to the browser default.
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace" };

/** Card chamfer: top-left + bottom-right (mirrored vs the panel shell). */
const cardClip = (c: number) =>
  `polygon(${c}px 0,100% 0,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,0 100%,0 ${c}px)`;

export interface ShipyardProps {
  hulls?: ShipyardHull[];
  /** Bar denominators. Defaults to the export's STAT_CAPS; the host passes caps
   *  derived from the real fleet so the bars scale to what is actually sold. */
  statCaps?: ShipStats;
  /** Live 3D/GLB render for a hull, drawn inside the export's turntable wrapper. */
  renderShip?: (hull: ShipyardHull, index: number) => React.ReactNode;
  /** Fired when BOARD SHIP is pressed. Purchase/ownership rules live in the game. */
  onBoard?: (hull: ShipyardHull, index: number) => void;
  onClose?: () => void;

  // ── Ownership / affordability ──────────────────────────────────────────
  // The export has no concept of these: every card is unconditionally
  // purchasable there. PORT_NOTES.md §4 lists "not enough credits" and "ship
  // not unlocked" as product decisions for the target project, and specifies
  // the LOOK (dimmed ~0.4-0.5, cursor not-allowed) without the RULE. These
  // props carry the rule in from the game; when they are omitted the panel
  // behaves exactly as the export does.
  /** Ship ids/names the player already owns — those show BOARD instead of a price. */
  ownedShips?: string[];
  /** Player's credit balance, used only to dim unaffordable hulls. */
  credits?: number;
  /** Currently flown hull; its card reads ACTIVE. */
  currentShip?: string;
}

function ArrowButton({
  side, onClick, label,
}: { side: "left" | "right"; onClick?: () => void; label: string }) {
  // Hover/press come from styles.arrowBtn — the export's brightness(1.3) /
  // brightness(1.4), not the 1.25-only approximation this used to carry.
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={styles.arrowBtn}
      style={{
        position: "absolute", [side]: 2, top: "50%", transform: "translateY(-50%)",
        zIndex: 30, border: "none", background: "none", padding: "10px 6px",
        cursor: "pointer",
      }}
    >
      <i
        className={styles.pulse}
        style={{
          fontStyle: "normal", display: "block", ...display,
          fontSize: 64, fontWeight: 900, lineHeight: 1, color: "#ff8a3d",
          textShadow: "0 0 10px #ff8a3d,0 0 22px rgba(255,138,61,.85),0 0 46px rgba(255,138,61,.5)",
        }}
      >
        {side === "left" ? "‹" : "›"}
      </i>
    </button>
  );
}

/** Recessed data column (lore on the left, stats on the right). */
function DataColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid", gap: 8, alignContent: "start", padding: "10px 12px",
        background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.55)",
        boxShadow: "inset 2px 2px 0 rgba(0,0,0,.4),inset -1px -1px 0 rgba(143,176,208,.06)",
      }}
    >
      <small style={{ fontSize: 7, letterSpacing: ".16em", color: "rgba(210,190,175,.55)", fontWeight: 700 }}>
        {title}
      </small>
      {children}
    </div>
  );
}

export function Shipyard({
  hulls = SHIPYARD_HULLS, statCaps = STAT_CAPS, renderShip, onBoard, onClose,
  ownedShips, credits, currentShip,
}: ShipyardProps) {
  const [idx, setIdx] = React.useState(0);
  const last = hulls.length - 1;
  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(last, i + 1));

  // Same formula as the export's shipyardTrackX: centre the active card in the
  // viewport. Drag is not wired here (the export drives it from pointer state);
  // the arrows produce the identical transform.
  const trackX = VIEW_W / 2 - (idx * CARD_STEP + CARD_W / 2);

  return (
    <div
      style={{
        position: "relative", padding: "40px 24px", display: "grid", placeItems: "center",
        background: "radial-gradient(600px 360px at 50% 26%,rgba(255,138,61,.1),transparent 70%),#05040a",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,.6)",
      }}
    >
      <HeroFrame width={PANEL_W} chamfer={22}>
        <PanelHeader glyph="▲" title="SHIPYARD" onClose={onClose} closeLabel="Close shipyard" />

        {/* sub-header strip */}
        <div style={{ display: "grid", gap: 10, padding: "16px 20px 8px" }}>
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              padding: "9px 14px", border: "1px solid rgba(255,138,61,.35)",
              background: "rgba(40,20,8,.5)",
              clipPath: "polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i style={{ fontStyle: "normal", fontSize: 11, color: "#ffb673" }}>▲</i>
              <b style={{ ...display, fontSize: 10, letterSpacing: ".14em", color: "#ffd9b8" }}>AVAILABLE HULLS</b>
            </div>
            <small style={{ fontSize: 8.5, letterSpacing: ".14em", color: "rgba(210,190,175,.55)", fontWeight: 700 }}>
              HULL · SHIELD · SPEED · DAMAGE
            </small>
            <small style={{ fontSize: 8.5, letterSpacing: ".1em", color: "rgba(210,190,175,.55)", fontWeight: 700 }}>
              DRAG OR USE THE ARROWS
            </small>
          </div>
        </div>

        {/* carousel */}
        <div style={{ position: "relative", padding: "14px 4px 26px 20px" }}>
          <ArrowButton side="left" onClick={prev} label="Scroll hulls left" />
          <ArrowButton side="right" onClick={next} label="Scroll hulls right" />

          <div
            style={{
              position: "relative", width: VIEW_W, height: VIEW_H, margin: "0 auto",
              overflow: "hidden", cursor: "grab",
              background: "radial-gradient(560px 320px at 50% 40%,rgba(255,138,61,.08),transparent 72%)",
            }}
          >
            {/* grid backdrop */}
            <i
              style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                backgroundImage:
                  "repeating-linear-gradient(0deg,rgba(255,173,110,.05) 0 1px,transparent 1px 26px)," +
                  "repeating-linear-gradient(90deg,rgba(255,173,110,.05) 0 1px,transparent 1px 26px)",
              }}
            />
            <div
              style={{
                position: "absolute", top: 0, left: 0, height: "100%",
                display: "flex", alignItems: "center", gap: CARD_GAP,
                transform: `translateX(${trackX}px)`, transition: TRACK_TRANSITION,
              }}
            >
              {hulls.map((sh, i) => {
                const adist = Math.min(3, Math.abs(i - idx));
                const scale = CARD_SCALE[adist];
                const opacity = CARD_OPACITY[adist];
                const zIndex = 10 - adist;
                return (
                  <div
                    key={sh.name}
                    onClick={() => setIdx(i)}
                    style={{
                      position: "relative", flex: "0 0 auto", width: CARD_W,
                      transform: `scale(${scale})`, zIndex, opacity, cursor: "pointer",
                      filter: "drop-shadow(0 5px 0 rgba(2,1,1,.9)) drop-shadow(0 10px 12px rgba(0,0,0,.6))",
                      transition: "transform 420ms cubic-bezier(.22,.9,.25,1),opacity 420ms ease",
                    }}
                  >
                    <div style={{ position: "relative", overflow: "hidden", clipPath: cardClip(13) }}>
                      {/* card bevel cascade (mirrored chamfer, 0.6px per layer) */}
                      <i style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#fff6ec,#ffb673)", clipPath: cardClip(13) }} />
                      <i style={{ position: "absolute", inset: 1, background: "linear-gradient(135deg,#ffcfa0,#d9791f)", clipPath: cardClip(12.4) }} />
                      <i style={{ position: "absolute", inset: 2, background: "linear-gradient(135deg,#b8681f,#5c2e0a)", clipPath: cardClip(11.8) }} />
                      <i style={{ position: "absolute", inset: 3, background: "linear-gradient(135deg,#3d2410,#170e06)", clipPath: cardClip(11.2) }} />
                      {/* rotating conic sheen, only on the centred card */}
                      <i style={{ position: "absolute", inset: 4, overflow: "hidden", clipPath: cardClip(10.6) }}>
                        {i === idx && (
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
                          position: "relative", margin: 5,
                          background: "linear-gradient(165deg,#1c150e,#050301)",
                          clipPath: cardClip(10.1),
                        }}
                      >
                        {/* title block */}
                        <div style={{ display: "grid", gap: 2, padding: "14px 18px 10px" }}>
                          <b style={{ ...display, fontSize: 16, letterSpacing: ".04em", color: "#ffb673", textShadow: "0 0 10px rgba(255,138,61,.65),0 0 22px rgba(255,138,61,.35)" }}>
                            {sh.name}
                          </b>
                          <small style={{ fontSize: 9.5, color: "rgba(226,212,198,.72)" }}>{sh.tagline}</small>
                        </div>

                        {/* 3-column body: lore | viewport | stats */}
                        <div style={{ display: "grid", gridTemplateColumns: "148px 1fr 190px", gap: 14, padding: "4px 18px 16px", alignItems: "stretch" }}>
                          <DataColumn title="HULL DATA">
                            <div style={{ display: "grid", gap: 2, paddingTop: 5, borderTop: "1px solid rgba(255,138,61,.14)" }}>
                              {LORE_ORDER.map((k) => (
                                <div key={k} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                                  <small style={{ fontSize: 7, letterSpacing: ".12em", color: "rgba(206,226,246,.55)", fontWeight: 700 }}>{k}</small>
                                  <b style={{ ...mono, fontSize: 10.5, color: "#f2ece0" }}>{sh.lore[k]}</b>
                                </div>
                              ))}
                            </div>
                          </DataColumn>

                          {/* turntable viewport */}
                          <div style={{ position: "relative", overflow: "hidden", background: "radial-gradient(120% 130% at 50% 26%,rgba(255,138,61,.14),#070502 72%)" }}>
                            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(180deg,rgba(0,0,0,.24) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
                            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", perspective: "700px" }}>
                              <div
                                className={styles.turntable}
                                style={{
                                  width: 250, height: 250,
                                  filter: "drop-shadow(0 16px 13px rgba(0,0,0,.55)) drop-shadow(0 0 18px rgba(255,138,61,.4))",
                                }}
                              >
                                {renderShip?.(sh, i)}
                              </div>
                            </div>
                          </div>

                          <DataColumn title="LOADOUT SLOTS">
                            <div style={{ display: "grid", gap: 4, paddingTop: 5, borderTop: "1px solid rgba(255,138,61,.14)" }}>
                              {STAT_ORDER.map((k) => {
                                const pct = Math.round((sh.stats[k] / statCaps[k]) * 100);
                                return (
                                  <div key={k} style={{ display: "grid", gap: 2 }}>
                                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                                      <small style={{ fontSize: 7, letterSpacing: ".12em", color: "rgba(206,226,246,.6)", fontWeight: 700 }}>{k}</small>
                                      <b style={{ ...mono, fontSize: 10, color: "#ffd9b8" }}>{sh.stats[k]}</b>
                                    </div>
                                    <i style={{ display: "block", height: 3, background: "rgba(0,0,0,.5)", boxShadow: "inset 0 1px 2px rgba(0,0,0,.6)" }}>
                                      <i style={{ display: "block", height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,rgba(255,138,61,.5),#ff8a3d)", boxShadow: "0 0 5px #ff8a3d" }} />
                                    </i>
                                  </div>
                                );
                              })}
                            </div>
                          </DataColumn>
                        </div>

                        {/* price + BOARD SHIP.
                            Three states beyond the export's single one — see the
                            ownership props above. With none of them supplied
                            `owned`/`active` stay false and `afford` stays true,
                            which reproduces the export exactly. */}
                        {(() => {
                          const owned = !!ownedShips?.includes(sh.name);
                          const active = currentShip != null && sh.name === currentShip;
                          const afford = credits == null || owned || credits >= sh.price;
                          const hex = active ? "#5cff8a" : afford ? "#ff8a3d" : "#8aa0c0";
                          // The export has ONE label — "BOARD SHIP" — and one
                          // price line, "CREDITS {{ card.priceFmt }}". The extra
                          // states below exist because this game has ownership
                          // and a credit balance the export's demo did not; they
                          // keep the export's wording wherever it applies and
                          // only diverge where there is genuinely something else
                          // to say (already flying it / cannot afford it).
                          const label = active ? "ACTIVE" : !afford ? "INSUFFICIENT CREDITS" : "BOARD SHIP";
                          const disabled = active || !afford;
                          return (
                            <div style={{ display: "grid", gap: 10, padding: "0 18px 18px" }}>
                              <b style={{ ...mono, fontSize: 12, fontWeight: 700, color: owned ? "#5cff8a" : "#e8b94d", textShadow: `0 0 8px ${owned ? "rgba(92,255,138,.5)" : "rgba(232,185,77,.5)"}` }}>
                                {owned ? "OWNED" : `CREDITS ${sh.price.toLocaleString("en-US")}`}
                              </b>
                              <button
                                aria-label={`${label} — ${sh.name}`}
                                disabled={disabled}
                                onClick={(e) => { e.stopPropagation(); if (!disabled) onBoard?.(sh, i); }}
                                className={disabled ? undefined : styles.cta}
                                style={{
                                  position: "relative", display: "grid", justifyItems: "center", gap: 8,
                                  padding: "8px 4px", border: "none", background: "none", width: "100%",
                                  cursor: disabled ? "not-allowed" : "pointer",
                                  opacity: afford ? 1 : 0.45,
                                  transition: "filter .14s ease",
                                }}
                              >
                                <i className={styles.pulse} style={{ width: "100%", height: 2, background: `linear-gradient(90deg,transparent,${hex} 12%,#ffe4c9 50%,${hex} 88%,transparent)`, boxShadow: `0 0 6px ${hex},0 0 16px ${hex}cc,0 0 30px ${hex}80` }} />
                                <b style={{ ...display, fontSize: 12, fontWeight: 900, letterSpacing: ".24em", color: "#fff2e2", textShadow: `0 0 8px ${hex},0 0 18px ${hex}e6,0 0 36px ${hex}99` }}>
                                  {label}
                                </b>
                                <i className={styles.pulse} style={{ width: "100%", height: 2, background: `linear-gradient(90deg,transparent,${hex} 12%,#ffe4c9 50%,${hex} 88%,transparent)`, boxShadow: `0 0 6px ${hex},0 0 16px ${hex}cc,0 0 30px ${hex}80` }} />
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </HeroFrame>
    </div>
  );
}
