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

// `img` = PNG icon in /assets/ui/icons/. When present it replaces the Unicode
// glyph; `icon` stays as a fallback (used for `cargo`, which has no PNG yet).
const MENU_BUTTONS = [
  { key: "inventory", icon: "▦", img: "inventory",  title: "Inventory" },
  { key: "cargo",     icon: "⬡", img: "cargo",       title: "Cargo" },
  { key: "skills",    icon: "✦", img: "skills",     title: "Skills" },
  { key: "missions",  icon: "⚑", img: "missions",   title: "Missions" },
  { key: "map",       icon: "◈", img: "galaxy-map", title: "Star Map" },
  { key: "clan",      icon: "⛊", img: "clan",       title: "Clan" },
  { key: "friends",   icon: "☺", img: "friends",    title: "Friends" },
  { key: "settings",  icon: "⚙", img: "settings",   title: "Settings" },
] as const;

const ICON_SRC = (name: string) => `/assets/ui/icons/${name}.png`;

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
              <span className={styles.buttonInner}>
                {b.img
                  ? <img className={styles.buttonIcon} src={ICON_SRC(b.img)} alt="" aria-hidden="true" draggable={false} />
                  : b.icon}
              </span>
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
            <span className={styles.buttonInner}>
              <img className={styles.buttonIcon} src={ICON_SRC("log-out")} alt="" aria-hidden="true" draggable={false} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
