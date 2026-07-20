import { type CSSProperties, type ReactNode, useMemo } from "react";
import styles from "./HudFrame.module.css";

export type HudCutCorners = {
  tl?: number;
  tr?: number;
  bl?: number;
  br?: number;
};

export type HudFrameProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Bevel size per corner in px. Omit a corner (0) to keep it square. */
  cut?: HudCutCorners | number;
  /** Draw small L-shaped corner ticks instead of a full border. */
  cornerTicks?: boolean;
  /** Accent color driving border/glow (defaults to cyan). */
  accent?: string;
  /** Elevated = slightly brighter fill, used for hover/active panels. */
  raised?: boolean;
  /** Disable the border entirely (content-only clip). */
  noBorder?: boolean;
  as?: keyof JSX.IntrinsicElements;
};

function buildClipPath(cut: Required<HudCutCorners>): string {
  const { tl, tr, bl, br } = cut;
  return [
    `${tl}px 0`,
    `calc(100% - ${tr}px) 0`,
    `100% ${tr}px`,
    `100% calc(100% - ${br}px)`,
    `calc(100% - ${br}px) 100%`,
    `${bl}px 100%`,
    `0 calc(100% - ${bl}px)`,
    `0 ${tl}px`,
  ].join(", ");
}

/**
 * HudFrame — the single reusable beveled-corner container the whole HUD is
 * built from. Uses clip-path polygons (not border-image PNGs) so corners
 * stay crisp at any resolution and never need image assets.
 */
export function HudFrame({
  children,
  className,
  style,
  cut = 8,
  cornerTicks = false,
  accent,
  raised = false,
  noBorder = false,
  as: Tag = "div",
}: HudFrameProps) {
  const resolvedCut: Required<HudCutCorners> =
    typeof cut === "number"
      ? { tl: cut, tr: cut, bl: cut, br: cut }
      : { tl: cut.tl ?? 0, tr: cut.tr ?? 0, bl: cut.bl ?? 0, br: cut.br ?? 0 };

  const clipPath = useMemo(() => buildClipPath(resolvedCut), [
    resolvedCut.tl,
    resolvedCut.tr,
    resolvedCut.bl,
    resolvedCut.br,
  ]);

  // Inner layer (the panel fill) sits inset by the border width, so its own
  // bevel must shrink by roughly the same amount or the cut corners would
  // show a squared-off notch instead of a clean parallel inset line.
  const BORDER_PX = 1;
  const innerCut: Required<HudCutCorners> = {
    tl: Math.max(0, resolvedCut.tl - BORDER_PX),
    tr: Math.max(0, resolvedCut.tr - BORDER_PX),
    bl: Math.max(0, resolvedCut.bl - BORDER_PX),
    br: Math.max(0, resolvedCut.br - BORDER_PX),
  };
  const innerClipPath = useMemo(() => buildClipPath(innerCut), [
    innerCut.tl,
    innerCut.tr,
    innerCut.bl,
    innerCut.br,
  ]);

  const cssVars = {
    "--hud-frame-accent": accent ?? "var(--hud-cyan)",
  } as CSSProperties;

  return (
    <Tag
      className={[styles.frame, raised ? styles.raised : "", className ?? ""].join(" ").trim()}
      style={{ ...cssVars, ...style }}
    >
      <div className={styles.clipBody} style={{ clipPath, background: noBorder ? "transparent" : undefined }}>
        <div className={styles.borderLayer} style={{ clipPath: noBorder ? clipPath : innerClipPath }} />
        <div className={styles.content}>{children}</div>
      </div>
      {cornerTicks && (
        <>
          {resolvedCut.tl > 0 && <span className={`${styles.tick} ${styles.tickTl}`} />}
          {resolvedCut.tr > 0 && <span className={`${styles.tick} ${styles.tickTr}`} />}
          {resolvedCut.bl > 0 && <span className={`${styles.tick} ${styles.tickBl}`} />}
          {resolvedCut.br > 0 && <span className={`${styles.tick} ${styles.tickBr}`} />}
        </>
      )}
    </Tag>
  );
}
