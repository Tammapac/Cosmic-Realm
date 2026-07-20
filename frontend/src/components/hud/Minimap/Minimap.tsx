import styles from "./Minimap.module.css";

export type MinimapBlipKind = "ally" | "hostile" | "neutral" | "objective" | "resource" | "loot";

export type MinimapBlipData = {
  /** Position within the scan circle, 0-100 on both axes (50/50 = center). */
  x: number;
  y: number;
  kind: MinimapBlipKind;
  title?: string;
};

export type MinimapProps = {
  zoneName: string;
  coords?: string;
  blips?: MinimapBlipData[];
};

const BLIP_CLASS: Record<MinimapBlipKind, string> = {
  ally: styles.blipAlly,
  hostile: styles.blipHostile,
  neutral: styles.blipNeutral,
  objective: styles.blipObjective,
  resource: styles.blipResource,
  loot: styles.blipLoot,
};

const SWEEP_PERIOD_S = 4.5;

/** Angle (0deg = 12 o'clock, clockwise) from the scan circle's center to a
 *  blip at (x, y) percent -- matches .scanSweep's own conic-gradient,
 *  which starts "from 0deg" at 12 o'clock and sweeps clockwise. Used to
 *  time each blip's scan-flash so it lights up exactly when the rotating
 *  beam passes over it. */
function angleOf(x: number, y: number): number {
  const dx = x - 50;
  const dy = y - 50;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Minimap — Formfamily E (radar console). Same octagonal chamfered shell,
 * glow rim, PCB veins and noise grain as the Hotbar, housing a recessed
 * circular scan window with a rotating sweep and position blips.
 */
export function Minimap({ zoneName, coords, blips = [] }: MinimapProps) {
  return (
    <div className={`${styles.consoleWrap} hud-interactive`}>
      <div className={styles.glowRim} />
      <div className={styles.crispEdge} />
      <div className={styles.innerFrame} />

      <div className={`${styles.console} hud-mat-brushed`}>
        <div className={styles.innerBevel} />
        <div className={styles.consoleVeins} />
        <div className={styles.consoleNoise} />
        <div className={styles.consoleSheen} />

        <div className={styles.zoneDisplayCollar}>
          <div className={styles.zoneDisplay}>
            <span className={styles.zoneDisplayText}>{zoneName}</span>
          </div>
        </div>

        <div className={styles.header}>{coords && <span className={styles.coords}>{coords}</span>}</div>

        <div className={styles.scanCollarWrap}>
          <div className={styles.scanWindow}>
            <div className={styles.scanGrid} />
            <div className={styles.scanRing} />
            <div className={styles.scanSweep} />
            {blips.map((b, i) => {
              const blipDelay = (angleOf(b.x, b.y) / 360) * SWEEP_PERIOD_S;
              return (
                <div
                  key={i}
                  className={`${styles.blip} ${BLIP_CLASS[b.kind]}`}
                  style={{ left: `${b.x}%`, top: `${b.y}%`, "--blip-delay": `${blipDelay}s` } as React.CSSProperties}
                  title={b.title}
                >
                  <div className={styles.blipScanFlash} />
                </div>
              );
            })}
            <div className={styles.scanCenter} />
            <div className={styles.scanVignette} />
          </div>
          <div className={styles.scanRimLight} />
        </div>

        <div className={styles.footer}>
          <span className={styles.footerTick} />
          <span className={styles.footerLabel}>Sensor Range 1.2km</span>
          <span className={styles.footerTick} />
        </div>
      </div>
    </div>
  );
}
