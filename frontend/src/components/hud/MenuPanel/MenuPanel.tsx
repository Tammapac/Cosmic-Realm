import styles from "./MenuPanel.module.css";

export type MenuPanelProps = {
  onOpenInventory?: () => void;
  onOpenSkills?: () => void;
  onOpenMap?: () => void;
  onOpenFriends?: () => void;
  onOpenSettings?: () => void;
  onOpenMissions?: () => void;
  onOpenCargo?: () => void;
  onOpenClan?: () => void;
  onLogout?: () => void;
};

const MENU_BUTTONS = [
  { key: "inventory", icon: "▦", title: "Inventory" },
  { key: "cargo", icon: "⬡", title: "Cargo" },
  { key: "skills", icon: "✦", title: "Skills" },
  { key: "missions", icon: "⚑", title: "Missions" },
  { key: "map", icon: "◈", title: "Star Map" },
  { key: "clan", icon: "⛊", title: "Clan" },
  { key: "friends", icon: "☺", title: "Friends" },
  { key: "settings", icon: "⚙", title: "Settings" },
] as const;

/**
 * MenuPanel — Formfamily H. Standalone icon-button strip (inventory,
 * skills, map, friends, settings) in a single horizontal row, inside
 * an elongated shell with one angled corner cut. Anchored top-right,
 * independent of TopPanel.
 */
export function MenuPanel({
  onOpenInventory,
  onOpenSkills,
  onOpenMap,
  onOpenFriends,
  onOpenSettings,
  onOpenMissions,
  onOpenCargo,
  onOpenClan,
  onLogout,
}: MenuPanelProps) {
  const handlers: Record<string, (() => void) | undefined> = {
    inventory: onOpenInventory,
    skills: onOpenSkills,
    map: onOpenMap,
    friends: onOpenFriends,
    settings: onOpenSettings,
    missions: onOpenMissions,
    cargo: onOpenCargo,
    clan: onOpenClan,
  };

  return (
    <div className={`${styles.consoleWrap} hud-interactive`}>
      <div className={styles.glowRim} />
      <div className={styles.crispEdge} />

      <div className={`${styles.console} hud-mat-brushed`}>
        <div className={styles.innerBevel} />
        <div className={styles.consoleVeins} />
        <div className={styles.consoleNoise} />
        <div className={styles.consoleSheen} />

        <div className={styles.row}>
          {MENU_BUTTONS.map((b) => (
            <button key={b.key} type="button" className={styles.button} title={b.title} onClick={handlers[b.key]}>
              <span className={styles.buttonFrame} />
              <span className={styles.buttonBracket} />
              <span className={styles.buttonInner}>{b.icon}</span>
            </button>
          ))}
          {/* separator + red logout button, set apart at the far right */}
          <span className={styles.sep} />
          <button
            type="button"
            className={`${styles.button} ${styles.logoutButton}`}
            title="Logout"
            onClick={onLogout}
          >
            <span className={styles.buttonFrame} />
            <span className={styles.buttonBracket} />
            <span className={styles.buttonInner}>⏻</span>
          </button>
        </div>
      </div>
    </div>
  );
}
