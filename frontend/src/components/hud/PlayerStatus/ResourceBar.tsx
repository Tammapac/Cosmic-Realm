import styles from "./ResourceBar.module.css";

export type ResourceBarProps = {
  label: string;
  value: number;
  max: number;
  color: string;
  /** Below this fraction (0-1) the bar switches to its "critical" pulse. */
  criticalThreshold?: number;
  /** Shows a lighter secondary fill layer sliding toward the primary fill
   *  (used for "regenerating" — the bar is healing back up). */
  regenerating?: boolean;
  /** Adds a bright temporary overlay (used for "temporarily boosted"). */
  boosted?: boolean;
  /** Color the fill shifts toward once value/max <= 50%. Only HP uses this
   *  (red warning); other bars keep their own color at any fill level. */
  lowColor?: string;
  showNumbers?: boolean;
  compact?: boolean;
  /** Flips the track's angled-cut silhouette (outer end low, inner end
   *  rising toward center) -- used when the bar sits on the right side of
   *  a shell so its slope mirrors the left-side bar. */
  mirrored?: boolean;
};

/**
 * ResourceBar — generic thin bar used for HP, Shield, Energy and EXP. All
 * four states from the brief (normal / low / critical / regenerating /
 * boosted) are expressed here so HealthBar and ShieldBar are thin wrappers.
 */
export function ResourceBar({
  label,
  value,
  max,
  color,
  criticalThreshold = 0.25,
  regenerating = false,
  boosted = false,
  lowColor,
  showNumbers = true,
  compact = false,
  mirrored = false,
}: ResourceBarProps) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const isCritical = pct / 100 <= criticalThreshold;
  const isLow = !!lowColor && pct / 100 <= 0.5;

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ""} ${mirrored ? styles.mirrored : ""}`}>
      {!compact && (
        <div className={styles.header}>
          <span className={styles.label}>{label}</span>
          {showNumbers && (
            <span className={styles.numbers}>
              {Math.round(value)}
              <span className={styles.numbersMax}>/{Math.round(max)}</span>
            </span>
          )}
        </div>
      )}
      <div
        className={styles.trackWrap}
        style={{ "--rb-color": color, "--rb-low-color": lowColor ?? color } as React.CSSProperties}
      >
        <div className={styles.trackGlowBloom} />
        <div className={styles.trackGlowEdge} />
        <div className={`${styles.track} ${isCritical ? styles.critical : ""}`}>
          {/* fillClip is the width%-driven element (same as before), but
              it no longer carries the fill's own clip-path/background --
              clip-path percentages resolve against an element's OWN box,
              so a polygon copied onto a variable-width div would resolve
              differently at every fill level instead of matching the
              track's actual (fixed-width) silhouette. Splitting the
              width-driven crop from the shape-driven fill fixes that:
              .fill is always 100% of the TRACK's width and carries the
              track's own silhouette, while .fillClip -- sized to pct% --
              just crops it from the left, so whatever sliver of the
              angled-cut/chamfer silhouette falls within that width shows
              through correctly instead of a flat rectangular edge. */}
          <div className={styles.fillClip} style={{ width: `${pct}%` }}>
            {/* .fill must always span the TRACK's full width so its
                clip-path polygon (percent-based points included)
                resolves against the track's real proportions -- since
                this element's own box is only pct% of that width (it
                sits inside the pct%-wide .fillClip crop), its width is
                scaled back up by the inverse fraction so 100% of ITS
                box always equals 100% of the track's box, at any fill
                level. pct === 0 is guarded to avoid a divide-by-zero
                blowing the width up to Infinity. */}
            <div
              className={`${styles.fill} ${isLow ? styles.fillLow : ""} ${regenerating ? styles.fillRegen : ""}`}
              style={{ width: pct > 0 ? `${(100 / pct) * 100}%` : "100%" }}
            >
              <div className={styles.shimmer} />
            </div>
          </div>
          {boosted && <div className={styles.boostOverlay} />}
          {compact && showNumbers && (
            <span className={styles.numbersInline}>
              {Math.round(value)}
              <span className={styles.numbersMax}>/{Math.round(max)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
