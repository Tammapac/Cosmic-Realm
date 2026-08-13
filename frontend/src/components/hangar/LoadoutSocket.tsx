import React from "react";
import styles from "./HangarDockOverlay.module.css";
import { LOADOUT_RARITY } from "./Loadout.constants";

/**
 * Loadout item socket — MIGRATED VERBATIM from the design export.
 *
 * Source: "Loadout Panel (UI Redesign Directions - Armor).dc.html", the
 * `bank.sockets` loop inside the `id="1c"` panel block.
 *
 * The socket is a hexagon with 2.5px of bezel and SEVEN stacked inner plates at
 * inset 0 / .8 / 1.5 / 2.2 / 3 / 3.7 / 2.9px. That ladder is what gives it the
 * machined look — collapsing it to one or two shapes (which an earlier port of
 * another panel did) reads as a flat sticker. Every gradient below is the
 * export's own.
 *
 * The project's own HexSlotButton was considered per the kit-panel-port skill,
 * but its bezel differs from this one; the user chose the export as the visual
 * source of truth here, so the export's ladder is reproduced.
 *
 * NOTE: no native `title` attribute. The panel renders its own D-06 tooltip, and
 * the browser's own bubble showed on top of it as a second box. `aria-label`
 * still carries the same text for screen readers.
 */

/** The export's hexagon clip, used by every layer. */
export const HEX_CLIP = "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)";

export type SocketState =
  | { kind: "empty" }
  | { kind: "locked"; rank: number }
  | { kind: "drone"; slot: string }
  | { kind: "filled"; rarity: string; name: string; ilvl: number; icon: string; glyph: string };

export interface LoadoutSocketProps {
  state: SocketState;
  active?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onHover?: (e: React.MouseEvent) => void;
  onLeave?: () => void;
  title: string;
}

export function LoadoutSocket({
  state, active = false, onClick, onDoubleClick, onHover, onLeave, title,
}: LoadoutSocketProps) {
  const filled = state.kind === "filled";
  const locked = state.kind === "locked";
  const drone = state.kind === "drone";

  const d = filled ? LOADOUT_RARITY[state.rarity] ?? LOADOUT_RARITY.common : null;

  // ── colours, verbatim from the socket builder ──────────────────────────
  const border = filled ? d![0] : locked ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.22)";
  const edgeHi = filled ? "rgba(255,255,255,.55)" : "rgba(188,214,255,.3)";
  const edgeLo = filled ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.55)";

  const recessTint = filled
    ? ({
        common: "#0b0e16", uncommon: "#07120d", rare: "#06111c", epic: "#0f0819",
        legendary: "#120f05", relic: "#120f05", celestial: "#06111c",
      }[state.rarity] ?? "#0b0e16")
    : "#0b0e16";

  const recessBg = filled
    ? `linear-gradient(150deg,#4a5262,#20242d 55%,${recessTint})`
    : locked
      ? "repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 1px,transparent 1px 8px),linear-gradient(150deg,#3a4250,#181d26)"
      : "linear-gradient(150deg,#3a4250,#181d26)";

  const shadow = filled
    ? `0 0 ${d![2]} ${d![3]},inset 0 4px 6px rgba(0,0,0,.6),inset 0 -1px 0 rgba(143,176,208,.25)`
    : "inset 0 3px 5px rgba(0,0,0,.65),inset 0 -1px 0 rgba(143,176,208,.08)";

  const glyphColor = locked ? "rgba(160,192,214,.35)" : "rgba(160,192,214,.5)";
  const glyph = filled ? state.glyph : drone ? "◇" : locked ? "⌧" : "+";
  const tag = drone ? state.slot.slice(0, 1).toUpperCase() : locked ? `R${state.rank}` : "";

  return (
    <div
      role="button"
      aria-label={title}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={styles.loSocket}
      style={{
        position: "relative", aspectRatio: "1", padding: 2.5,
        background: `linear-gradient(150deg,${edgeHi},${border} 45%,${edgeLo})`,
        clipPath: HEX_CLIP, cursor: "pointer", boxShadow: shadow,
        // The export lifts and brightens the ACTIVE socket, not just on hover.
        transform: active ? "translateY(-5px) scale(1.08)" : undefined,
        filter: active ? "brightness(1.3)" : undefined,
        ["--socket-glow" as string]: filled ? d![3] : "rgba(180,205,230,.2)",
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center", overflow: "hidden", background: recessBg, clipPath: HEX_CLIP }}>
        {/* The seven-plate bevel ladder — verbatim insets and gradients. */}
        <i style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#ffffff,#8592a8)", opacity: 0.9, clipPath: HEX_CLIP }} />
        <i style={{ position: "absolute", inset: ".8px", background: "linear-gradient(135deg,#c3cedd,#414c5e)", opacity: 0.8, clipPath: HEX_CLIP }} />
        <i style={{ position: "absolute", inset: "1.5px", background: "linear-gradient(135deg,#5b6678,#1a1e26)", opacity: 0.85, clipPath: HEX_CLIP }} />
        <i style={{ position: "absolute", inset: "2.2px", background: "linear-gradient(135deg,#242a34,#000000)", opacity: 0.9, clipPath: HEX_CLIP }} />
        <i style={{ position: "absolute", inset: "3px", background: "linear-gradient(135deg,#0c0e12,#000000)", opacity: 0.8, clipPath: HEX_CLIP }} />
        <i style={{ position: "absolute", inset: "3.7px", background: "linear-gradient(135deg,#2a303c,#0d0f14)", opacity: 0.6, clipPath: HEX_CLIP }} />
        <i style={{ position: "absolute", inset: "2.9px", background: recessBg, clipPath: HEX_CLIP }} />

        {filled ? (
          <i
            style={{
              position: "relative", width: "58%", height: "58%",
              backgroundImage: `url(${state.icon})`, backgroundSize: "contain",
              backgroundRepeat: "no-repeat", backgroundPosition: "center",
              filter: `drop-shadow(0 0 8px ${d![3]})`,
            }}
          />
        ) : (
          <i
            className={locked ? undefined : styles.pulse}
            style={{ position: "relative", fontStyle: "normal", fontSize: 15, fontWeight: 700, color: glyphColor }}
          >
            {glyph}
          </i>
        )}

        {tag && (
          <small style={{ position: "absolute", bottom: 2, ...{ fontFamily: "'JetBrains Mono',monospace" }, fontSize: 6.5, letterSpacing: ".06em", color: glyphColor }}>
            {tag}
          </small>
        )}
      </div>
    </div>
  );
}

export default LoadoutSocket;
