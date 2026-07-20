import { HudPanel } from "../HudPanel/HudPanel";
import { ResourceBar } from "./ResourceBar";
import styles from "./PlayerStatus.module.css";

export type PlayerStatusProps = {
  credits: number;
  honor: number;
  level: number;
  exp: number;
  expToNext: number;
  zoneName: string;
};

/**
 * PlayerStatus — top-left HUD panel. Per latest direction: credits, honor,
 * level, exp, current map only (no portrait/ship thumbnail block).
 */
export function PlayerStatus({ credits, honor, level, exp, expToNext, zoneName }: PlayerStatusProps) {
  return (
    <HudPanel title={zoneName} cut={{ tl: 12, br: 12 }} className={styles.panel}>
      <div className={styles.statRow}>
        <Stat label="Level" value={level} accent="var(--hud-cyan)" />
        <div className={styles.statDivider} />
        <Stat label="Credits" value={credits.toLocaleString()} accent="var(--hud-energy)" />
        <div className={styles.statDivider} />
        <Stat label="Honor" value={honor.toLocaleString()} accent="var(--hud-magenta)" />
      </div>
      <ResourceBar label="Experience" value={exp} max={expToNext} color="var(--hud-cyan)" compact showNumbers={false} />
    </HudPanel>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}
