import styles from "./TopPanel.module.css";

export type TopPanelProps = {
  playerName: string;
  clanName: string;
  rank: number;
  rankName?: string;
  rankColor?: string;
  level: number;
  exp: number;
  expToNext: number;
  credits: number;
  honor: number;
  cargo: number;
  cargoMax: number;
  /** Opens the pilot dossier (attributes, career paths, rankings) --
   *  same click target the old pre-rebuild TopBar had on its rank
   *  octagon. */
  onOpenPilotDossier?: () => void;
};

/** Octagon outline matching the 24%/76% chamfer used by portraitWindow
 *  and portraitWindowCore's own clip-path, as an SVG stroke instead of
 *  a mask-composite ring -- a stroked path keeps constant width through
 *  every corner regardless of angle, avoiding the clip-path-percentage
 *  mismatch that collapsed the mask-based ring at the diagonals. */
function OctagonGloss({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon
        points="24,1 76,1 99,24 99,76 76,99 24,99 1,76 1,24"
        fill="none"
        stroke={color}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Outline matching rankBadge's own clip-path (12% 0, 88% 0, 100% 26%,
 *  100% 100%, 0 100%, 0 26%) as an SVG stroke, same reasoning as
 *  OctagonGloss -- a clipped box-shadow doesn't reliably render as a
 *  border on a non-rectangular clip-path shape. */
function RankBadgeOutline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon
        points="12,1 88,1 99,26 99,99 1,99 1,26"
        fill="none"
        stroke={color}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * TopPanel — Formfamily F. Horizontal command-bar following the
 * reference silhouette: octagonal portrait/rank module (own double-
 * octagon frame, top tab, overhanging rank badge), main console strip
 * with a seam accent line, and an icon-button cluster. Silhouette pass
 * -- content zones inside the main strip and cluster land next.
 */
export function TopPanel({
  playerName,
  clanName,
  rank,
  rankName,
  rankColor = "var(--hud-cyan)",
  level,
  exp,
  expToNext,
  credits,
  honor,
  cargo,
  cargoMax,
  onOpenPilotDossier,
}: TopPanelProps) {
  const expPct = Math.max(0, Math.min(100, (exp / Math.max(1, expToNext)) * 100));
  return (
    <div className={`${styles.wrap} hud-interactive`}>
      <div
        className={styles.portraitWrap}
        role={onOpenPilotDossier ? "button" : undefined}
        tabIndex={onOpenPilotDossier ? 0 : undefined}
        title={onOpenPilotDossier ? "Open pilot dossier" : undefined}
        onClick={onOpenPilotDossier}
        onKeyDown={(e) => {
          if (onOpenPilotDossier && (e.key === "Enter" || e.key === " ")) onOpenPilotDossier();
        }}
        style={onOpenPilotDossier ? { cursor: "pointer" } : undefined}
      >
        <div className={styles.portraitBasePlate} />
        <div className={styles.portraitGlowRim} />
        <div className={styles.portraitCrispEdge} />
        <div className={`${styles.portraitOuter} hud-mat-brushed`} />
        <div className={styles.portraitSideDetail} />
        <div className={styles.portraitMidRing} />
        <div className={styles.portraitInnerRing} />
        <div className={styles.portraitWindow} />
        <div className={styles.portraitWindowGloss}>
          <OctagonGloss color="rgba(210, 240, 255, 0.85)" />
        </div>
        <div className={styles.portraitWindowCore} />
        <img
          className={styles.portraitRankIcon}
          src={`/assets/ui/ranks/rank_${String(rank + 1).padStart(2, "0")}.png`}
          alt=""
          style={{ filter: `drop-shadow(0 0 8px ${rankColor}88) drop-shadow(0 1px 2px #000)` }}
        />
        {rankName && (
          <span className={styles.portraitRankName} style={{ color: rankColor }}>
            {rankName}
          </span>
        )}
        <div className={styles.portraitWindowCoreGloss}>
          <OctagonGloss color="rgba(210, 240, 255, 0.75)" />
        </div>
        <div className={`${styles.portraitWindowMark} ${styles.portraitWindowMarkTl}`} />
        <div className={`${styles.portraitWindowMark} ${styles.portraitWindowMarkTr}`} />
        <div className={`${styles.portraitWindowMark} ${styles.portraitWindowMarkBl}`} />
        <div className={`${styles.portraitWindowMark} ${styles.portraitWindowMarkBr}`} />
        <div className={styles.portraitTab}>▲</div>
        <div className={`${styles.portraitTabBracket} ${styles.portraitTabBracketLeft}`} />
        <div className={`${styles.portraitTabBracket} ${styles.portraitTabBracketRight}`} />
        <div className={`${styles.portraitTick} ${styles.portraitTickLeft}`} />
        <div className={`${styles.portraitTick} ${styles.portraitTickRight}`} />
        <div className={styles.rankBadge}>
          <span className={styles.rankLabel}>RANK</span>
          <span className={styles.rankValue}>{rank}</span>
          <div className={styles.rankBadgeGloss}>
            <RankBadgeOutline color="var(--hud-cyan-dim)" />
          </div>
        </div>
      </div>

      <div className={`${styles.mainStrip} panel`}>
        <span className="panel-rim" />

        <div className={styles.mainContent}>
          <div className={styles.identityPanel}>
            <div className={styles.nameHeader}>
              <span className={styles.playerName}>{playerName}</span>
              <span className={styles.clanName}>{clanName}</span>
            </div>

            <div className={styles.levelRow}>
              <span className={styles.levelLabel}>LVL {level}</span>
              <div className={styles.expTrack}>
                <div className={styles.expFill} style={{ width: `${expPct}%` }} />
              </div>
              <span className={styles.cargoLabel} style={{ color: "var(--hud-green)" }}>
                CARGO {cargo.toLocaleString()}/{cargoMax.toLocaleString()}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statIcon} style={{ color: "var(--hud-gold)" }}>◎</span>
              <span className={styles.statLabel}>CREDITS</span>
              <span className={styles.statValue} style={{ color: "var(--hud-gold)" }}>{credits.toLocaleString()}</span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statIcon} style={{ color: "var(--hud-magenta)" }}>✦</span>
              <span className={styles.statLabel}>HONOR</span>
              <span className={styles.statValue} style={{ color: "var(--hud-magenta)" }}>{honor.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
