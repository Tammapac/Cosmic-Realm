import styles from "./CooldownOverlay.module.css";

export type CooldownOverlayProps = {
  /** 0-1, fraction of cooldown remaining. */
  fraction: number;
  secondsLeft: number;
};

/**
 * CooldownOverlay — dark radial sweep + remaining-seconds readout, drawn
 * on top of an AbilitySlot. The icon underneath must stay legible per spec,
 * so the sweep uses conic-gradient at moderate opacity rather than a flat
 * dark block.
 */
export function CooldownOverlay({ fraction, secondsLeft }: CooldownOverlayProps) {
  if (fraction <= 0) return null;
  const deg = Math.max(0, Math.min(1, fraction)) * 360;
  return (
    <div className={styles.overlay}>
      <div className={styles.sweep} style={{ "--cd-deg": `${deg}deg` } as React.CSSProperties} />
      <span className={styles.time}>{secondsLeft >= 10 ? Math.ceil(secondsLeft) : secondsLeft.toFixed(1)}</span>
    </div>
  );
}
