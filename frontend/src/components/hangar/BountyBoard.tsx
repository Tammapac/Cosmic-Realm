import React from "react";
import styles from "./HangarDockOverlay.module.css";
import { HeroFrame, PanelHeader } from "./HeroFrame";
import { RARITY, TIER_ORDER } from "./rarity";
import {
  BOUNTIES, DANGER_LABELS, DANGER_COLORS, BOUNTY_ACTIVE,
  BOUNTY_CARD_W, BOUNTY_CARD_GAP, BOUNTY_CARD_STEP, BOUNTY_VIEW_W, BOUNTY_VIEW_H,
  BOUNTY_PANEL_W, BOUNTY_TAB_PCT,
  type BountyContract,
} from "./Bounty.constants";

/**
 * S-02 · Bounty Board
 *
 * MIGRATED from the design export, not rebuilt:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (section "S-02 · BOUNTY BOARD")
 *
 * Same amber Hero-Frame shell as S-04; the carousel is the same mechanism at a
 * different size (260px cards in a 760px viewport vs 680/1040).
 *
 * Tier gating is the export's own rule: a tab or card is locked when its danger
 * band exceeds `unlockedTier`. Which tier a player has actually unlocked is game
 * state — PORT_NOTES.md §4 calls this out as a product decision, so it comes in
 * as a prop and defaults to the export's own demo value.
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

const cardClip = (c: number) =>
  `polygon(${c}px 0,100% 0,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,0 100%,0 ${c}px)`;

export interface BountyBoardProps {
  contracts?: BountyContract[];
  /** Highest danger band the player may take (1-5). Cards above it show LOCKED. */
  unlockedTier?: number;
  activeCount?: number;
  activeCap?: number;
  /** Contract names the player has already accepted. The export has no
   *  accepted state at all — only the ACTIVE n/m counter — so a contract taken
   *  in this panel looked untouched the moment you switched tabs. This carries
   *  the real activeQuests through so the card can show it. */
  acceptedNames?: string[];
  onAccept?: (contract: BountyContract, index: number) => void;
  onClose?: () => void;
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

/**
 * Three-layer glow smear that slides under/over the active tab. The export uses
 * staggered `transition: left` (260/380/480ms) rather than a keyframe animation,
 * so the layers trail each other while switching — see EXPORT_MANIFEST §Animations.
 */
function TabIndicator({ leftPct, edge }: { leftPct: number; edge: "top" | "bottom" }) {
  const common: React.CSSProperties = {
    position: "absolute", [edge]: 0, left: `${leftPct}%`,
    width: `${BOUNTY_TAB_PCT}%`, pointerEvents: "none",
    background: "linear-gradient(90deg,transparent,#ff8a3d,transparent)",
  };
  return (
    <>
      <i style={{ ...common, zIndex: 4, height: 5, opacity: .28, filter: "blur(4px)", transition: "left 480ms cubic-bezier(.22,.9,.25,1)" }} />
      <i style={{ ...common, zIndex: 4, height: 3, opacity: .55, filter: "blur(2px)", transition: "left 380ms cubic-bezier(.22,.9,.25,1)" }} />
      <i
        style={{
          ...common, zIndex: 5, height: 2,
          background: "linear-gradient(90deg,transparent,#ff8a3d 22%,#ff8a3d 78%,transparent)",
          boxShadow: "0 0 8px #ff8a3d",
          transition: "left 260ms cubic-bezier(.22,.9,.25,1)",
        }}
      />
    </>
  );
}

export function BountyBoard({
  contracts = BOUNTIES,
  unlockedTier = 3,
  activeCount = BOUNTY_ACTIVE.count,
  activeCap = BOUNTY_ACTIVE.cap,
  acceptedNames,
  onAccept,
  onClose,
}: BountyBoardProps) {
  const acceptedSet = React.useMemo(() => new Set(acceptedNames ?? []), [acceptedNames]);
  const [filter, setFilter] = React.useState<"all" | number>("all");
  const [idx, setIdx] = React.useState(0);

  const tabs = React.useMemo(
    () => [
      { key: "all" as const, label: "ALL", dot: "#ffb673" },
      ...DANGER_LABELS.map((label, i) => ({ key: (i + 1) as number, label, dot: DANGER_COLORS[i] })),
    ],
    [],
  );

  const visible = React.useMemo(
    () => (filter === "all" ? contracts : contracts.filter((c) => c.danger === filter)),
    [contracts, filter],
  );

  const last = Math.max(0, visible.length - 1);
  const clamped = Math.min(idx, last);
  const trackX = BOUNTY_VIEW_W / 2 - (clamped * BOUNTY_CARD_STEP + BOUNTY_CARD_W / 2);
  const tabIdx = tabs.findIndex((t) => t.key === filter);

  return (
    <div
      style={{
        position: "relative", padding: "40px 24px", display: "grid", placeItems: "center",
        background: "radial-gradient(600px 360px at 50% 26%,rgba(255,138,61,.1),transparent 70%),#05040a",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,.6)",
      }}
    >
      <HeroFrame width={BOUNTY_PANEL_W} chamfer={22}>
        <PanelHeader glyph="★" title="BOUNTIES" onClose={onClose} closeLabel="Close bounty board" />

        <div style={{ display: "grid", gap: 10, padding: "16px 20px 8px" }}>
          {/* sub-header strip */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              padding: "9px 14px", border: "1px solid rgba(255,138,61,.35)",
              background: "rgba(40,20,8,.5)",
              clipPath: "polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i style={{ fontStyle: "normal", fontSize: 11, color: "#ffb673" }}>★</i>
              <b style={{ ...display, fontSize: 10, letterSpacing: ".14em", color: "#ffd9b8" }}>BOUNTY BOARD</b>
            </div>
            <small style={{ fontSize: 8.5, letterSpacing: ".14em", color: "rgba(210,190,175,.55)", fontWeight: 700 }}>
              KILL CONTRACTS · REPEATABLE
            </small>
            <span style={{ ...mono, fontSize: 9, letterSpacing: ".04em", color: "#5cff8a", textShadow: "0 0 6px rgba(92,255,138,.5)" }}>
              ACTIVE {activeCount} / {activeCap}
            </span>
          </div>

          {/* danger tabs */}
          <div
            style={{
              position: "relative", display: "flex", alignItems: "stretch", gap: 1, overflow: "hidden",
              background: "rgba(4,8,16,.55)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)",
              clipPath: "polygon(10px 0,100% 0,100% 100%,0 100%,0 10px)",
            }}
          >
            {tabs.map((t, i) => {
              const locked = i > 0 && i > unlockedTier;
              const on = filter === t.key;
              return (
                <button
                  key={String(t.key)}
                  aria-label={t.label}
                  disabled={locked}
                  onClick={() => { if (!locked) { setFilter(t.key); setIdx(0); } }}
                  className={styles.tabBtn}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "9px 6px", border: "none", cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.4 : 1,
                    background: on ? "rgba(255,138,61,.14)" : "none",
                    color: on ? "#ffd9b8" : "rgba(226,210,196,.72)",
                    ...display, fontSize: 8.5, letterSpacing: ".12em", fontWeight: 700,
                  }}
                >
                  <i style={{ width: 6, height: 6, flex: "0 0 auto", background: t.dot, boxShadow: `0 0 7px ${t.dot}`, transform: "rotate(45deg)", opacity: on ? 1 : 0 }} />
                  {t.label}
                  {locked && <i style={{ fontStyle: "normal", fontSize: 8, marginLeft: 1 }}>⌧</i>}
                </button>
              );
            })}
            {tabIdx >= 0 && (
              <>
                <TabIndicator leftPct={tabIdx * BOUNTY_TAB_PCT} edge="top" />
                <TabIndicator leftPct={tabIdx * BOUNTY_TAB_PCT} edge="bottom" />
              </>
            )}
          </div>
        </div>

        {/* carousel */}
        <div style={{ position: "relative", padding: "18px 4px 28px 20px" }}>
          <ArrowButton side="left" onClick={() => setIdx((i) => Math.max(0, i - 1))} label="Scroll contracts left" />
          <ArrowButton side="right" onClick={() => setIdx((i) => Math.min(last, i + 1))} label="Scroll contracts right" />

          <div
            style={{
              position: "relative", width: BOUNTY_VIEW_W, height: BOUNTY_VIEW_H, margin: "0 auto",
              overflow: "hidden", cursor: "grab",
              background: "radial-gradient(420px 260px at 50% 46%,rgba(255,138,61,.1),transparent 72%)",
            }}
          >
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
                display: "flex", alignItems: "center", gap: BOUNTY_CARD_GAP,
                transform: `translateX(${trackX}px)`,
                transition: "transform 420ms cubic-bezier(.22,.9,.25,1)",
              }}
            >
              {visible.map((bc, i) => {
                const adist = Math.min(3, Math.abs(i - clamped));
                const scale = [1.02, 0.86, 0.74, 0.64][adist];
                const opacity = [1, 0.6, 0.36, 0.2][adist];
                const r = RARITY[bc.tier];
                const tierN = TIER_ORDER.indexOf(bc.tier) + 1;
                const locked = bc.danger > unlockedTier;
                return (
                  <div
                    key={`${bc.name}-${i}`}
                    onClick={() => setIdx(i)}
                    style={{
                      position: "relative", flex: "0 0 auto", width: BOUNTY_CARD_W,
                      transform: `scale(${scale})`, zIndex: 10 - adist, opacity, cursor: "pointer",
                      filter: "drop-shadow(0 5px 0 rgba(2,1,1,.9)) drop-shadow(0 10px 12px rgba(0,0,0,.6))",
                      transition: "transform 420ms cubic-bezier(.22,.9,.25,1),opacity 420ms ease",
                    }}
                  >
                    <div style={{ position: "relative", overflow: "hidden", clipPath: cardClip(13) }}>
                      <i style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#fff6ec,#ffb673)", clipPath: cardClip(13) }} />
                      <i style={{ position: "absolute", inset: 1, background: "linear-gradient(135deg,#ffcfa0,#d9791f)", clipPath: cardClip(12.4) }} />
                      <i style={{ position: "absolute", inset: 2, background: "linear-gradient(135deg,#b8681f,#5c2e0a)", clipPath: cardClip(11.8) }} />
                      <i style={{ position: "absolute", inset: 3, background: "linear-gradient(135deg,#3d2410,#170e06)", clipPath: cardClip(11.2) }} />

                      <div style={{ position: "relative", margin: 5, background: "linear-gradient(165deg,#1c150e,#050301)", clipPath: cardClip(10.1) }}>
                        {/* tier row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px 6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ ...display, fontSize: 9, fontWeight: 900, letterSpacing: ".1em", color: r.hex, textShadow: `0 0 ${r.glowSize} ${r.glow}` }}>
                              T{tierN}
                            </span>
                            <small style={{ ...mono, fontSize: 7.5, color: "rgba(200,190,180,.5)" }}>
                              BC-{108 + i}
                            </small>
                          </div>
                          <span style={{ fontSize: 7, letterSpacing: ".14em", fontWeight: 700, color: bc.kind === "player" ? "#ff8a94" : "rgba(210,190,175,.6)" }}>
                            {bc.kind === "player" ? "WANTED PLAYER" : "HOSTILE NPC"}
                          </span>
                        </div>

                        {/* target block */}
                        <div style={{ display: "grid", gap: 6, padding: "6px 12px 10px" }}>
                          <div style={{ display: "grid", gap: 2 }}>
                            <b style={{ ...display, fontSize: 13, letterSpacing: ".03em", color: "#ffd9b8", textShadow: "0 0 10px rgba(255,138,61,.5)" }}>
                              {bc.name}
                            </b>
                            {bc.kind === "npc" && bc.subtitle && (
                              <small style={{ fontSize: 8.5, color: "rgba(226,212,198,.7)" }}>{bc.subtitle}</small>
                            )}
                            {bc.kind === "player" && (
                              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                <span style={{ ...mono, fontSize: 8.5, color: "#4ee2ff" }}>LV {bc.level}</span>
                                <small style={{ fontSize: 8, color: "rgba(226,212,198,.6)" }}>{bc.ship}</small>
                              </div>
                            )}
                          </div>

                          {/* danger pips */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <i
                                key={n}
                                style={{
                                  width: 6, height: 6, transform: "rotate(45deg)",
                                  background: n <= bc.danger ? DANGER_COLORS[bc.danger - 1] : "rgba(255,255,255,.12)",
                                  boxShadow: n <= bc.danger ? `0 0 6px ${DANGER_COLORS[bc.danger - 1]}` : "none",
                                }}
                              />
                            ))}
                            <small style={{ fontSize: 7, letterSpacing: ".14em", fontWeight: 700, color: "rgba(210,190,175,.6)", marginLeft: 2 }}>
                              {DANGER_LABELS[bc.danger - 1]}
                            </small>
                          </div>

                          {/* location */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ ...mono, fontSize: 8.5, color: "#ffb673" }}>{bc.zone}</span>
                            <i style={{ fontStyle: "normal", fontSize: 8, color: "rgba(210,190,175,.45)" }}>◎</i>
                            <small style={{ fontSize: 8, color: "rgba(210,190,175,.6)" }}>{bc.sector}</small>
                          </div>

                          {/* rewards */}
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ ...mono, fontSize: 10, color: "#e8b94d", textShadow: "0 0 8px rgba(232,185,77,.5)" }}>
                              <i style={{ fontStyle: "normal", marginRight: 3 }}>$</i>{bc.credits.toLocaleString("en-US")}
                            </span>
                            <span style={{ ...mono, fontSize: 10, color: "#ff5cf0", textShadow: "0 0 8px rgba(255,92,240,.45)" }}>
                              <i style={{ fontStyle: "normal", marginRight: 3 }}>◆</i>{bc.honor}
                            </span>
                          </div>

                          {locked ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 4px", opacity: 0.5, ...display, fontSize: 9, letterSpacing: ".2em", fontWeight: 700, color: "rgba(226,210,196,.7)" }}>
                              <i style={{ fontStyle: "normal" }}>⌧</i>LOCKED
                            </div>
                          ) : (
                            <button
                              aria-label={`Accept contract ${bc.name}`}
                              onClick={(e) => { e.stopPropagation(); if (!acceptedSet.has(bc.name)) onAccept?.(bc, i); }}
                              className={styles.cta}
                              style={{
                                position: "relative", display: "grid", justifyItems: "center", gap: 6,
                                padding: "6px 4px", border: "none", background: "none", width: "100%",
                                cursor: acceptedSet.has(bc.name) ? "default" : "pointer",
                                transition: "filter .14s ease",
                              }}
                            >
                              {/* Accepted contracts read green + ✓ so the state
                                  survives leaving and re-entering the panel. */}
                              <i className={styles.pulse} style={{ width: "100%", height: 2, background: acceptedSet.has(bc.name) ? "linear-gradient(90deg,transparent,#5cff8a 12%,#e6fff0 50%,#5cff8a 88%,transparent)" : "linear-gradient(90deg,transparent,#ff8a3d 12%,#ffe4c9 50%,#ff8a3d 88%,transparent)", boxShadow: acceptedSet.has(bc.name) ? "0 0 6px #5cff8a,0 0 16px rgba(92,255,138,.8)" : "0 0 6px #ff8a3d,0 0 16px rgba(255,138,61,.8)" }} />
                              <b style={{ ...display, fontSize: 10, fontWeight: 900, letterSpacing: ".24em", color: acceptedSet.has(bc.name) ? "#eaffef" : "#fff2e2", textShadow: acceptedSet.has(bc.name) ? "0 0 8px #5cff8a,0 0 18px rgba(92,255,138,.9)" : "0 0 8px #ff8a3d,0 0 18px rgba(255,138,61,.9)" }}>
                                {acceptedSet.has(bc.name) ? "✓ ACCEPTED" : "ACCEPT"}
                              </b>
                              <i className={styles.pulse} style={{ width: "100%", height: 2, background: acceptedSet.has(bc.name) ? "linear-gradient(90deg,transparent,#5cff8a 12%,#e6fff0 50%,#5cff8a 88%,transparent)" : "linear-gradient(90deg,transparent,#ff8a3d 12%,#ffe4c9 50%,#ff8a3d 88%,transparent)", boxShadow: acceptedSet.has(bc.name) ? "0 0 6px #5cff8a,0 0 16px rgba(92,255,138,.8)" : "0 0 6px #ff8a3d,0 0 16px rgba(255,138,61,.8)" }} />
                            </button>
                          )}
                        </div>
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
