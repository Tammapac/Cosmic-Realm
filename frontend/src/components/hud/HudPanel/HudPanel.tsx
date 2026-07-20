import type { CSSProperties, ReactNode } from "react";
import { HudFrame, type HudCutCorners } from "../HudFrame/HudFrame";
import styles from "./HudPanel.module.css";

export type HudPanelProps = {
  children?: ReactNode;
  title?: string;
  accent?: string;
  cut?: HudCutCorners | number;
  className?: string;
  style?: CSSProperties;
  interactive?: boolean;
  scanlines?: boolean;
};

/**
 * HudPanel — standard content panel: beveled frame + optional title band +
 * scanline texture. This is the base every larger HUD region (PlayerStatus,
 * Radar shell, ChatPanel, UtilityMenu) composes from.
 */
export function HudPanel({
  children,
  title,
  accent,
  cut = { tl: 10, br: 10 },
  className,
  style,
  interactive = true,
  scanlines = true,
}: HudPanelProps) {
  return (
    <HudFrame
      cut={cut}
      accent={accent}
      className={[styles.panel, interactive ? "hud-interactive" : "", className ?? ""].join(" ").trim()}
      style={style}
    >
      {scanlines && <div className="hud-scanlines" />}
      {title && (
        <div className={styles.titleBand}>
          <span className={styles.titleTick} />
          <span className={styles.titleText}>{title}</span>
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </HudFrame>
  );
}
