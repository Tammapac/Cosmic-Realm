import { AbilitySlot, type AbilitySlotState } from "./AbilitySlot";
import { HealthBar } from "../PlayerStatus/HealthBar";
import { ShieldBar } from "../PlayerStatus/ShieldBar";
import styles from "./Hotbar.module.css";

export type HotbarSlotData = {
  keyLabel: string;
  icon?: React.ReactNode;
  count?: number | null;
  state?: AbilitySlotState;
  cooldownFraction?: number;
  cooldownSeconds?: number;
  title?: string;
  /** Optional popover (ammo-type/consumable-assign menu) shown above
   *  this slot -- see AbilitySlot's own `dropdown` prop. */
  dropdown?: React.ReactNode;
};

export type HotbarProps = {
  slots: HotbarSlotData[];
  hull: number;
  hullMax: number;
  shield: number;
  shieldMax: number;
  onSlotClick?: (index: number) => void;
  onSlotContextMenu?: (index: number) => void;
};

/**
 * Hotbar — Formfamily A (horizontal HUD module). One continuous shaped
 * shell, HP/Shield built into the top of the same silhouette (not a
 * separate stacked box) with the ability slots directly below. Lighter
 * brushed surface fading toward the base, glow rim around the whole
 * outline.
 */
export function Hotbar({ slots, hull, hullMax, shield, shieldMax, onSlotClick, onSlotContextMenu }: HotbarProps) {
  return (
    <div className={`${styles.consoleWrap} hud-interactive`}>
      <div className={`${styles.console} panel panel-frameless`}>
        <div className={styles.statusRow}>
          <div className={styles.statusWing}>
            <HealthBar hull={hull} hullMax={hullMax} compact />
          </div>
          <div className={styles.statusDivider} />
          <div className={styles.statusWing}>
            <ShieldBar shield={shield} shieldMax={shieldMax} compact mirrored />
          </div>
        </div>

        <div className={styles.slotChannel}>
          {slots.map((s, i) => (
            <AbilitySlot
              key={i}
              keyLabel={s.keyLabel}
              icon={s.icon}
              count={s.count}
              state={s.state}
              cooldownFraction={s.cooldownFraction}
              cooldownSeconds={s.cooldownSeconds}
              title={s.title}
              dropdown={s.dropdown}
              onClick={() => onSlotClick?.(i)}
              onContextMenu={() => onSlotContextMenu?.(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
