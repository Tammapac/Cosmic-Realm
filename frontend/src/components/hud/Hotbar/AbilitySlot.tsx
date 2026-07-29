import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CooldownOverlay } from "./CooldownOverlay";
import styles from "./AbilitySlot.module.css";

export type AbilitySlotState = "normal" | "selected" | "locked" | "empty" | "disabled";

export type AbilitySlotProps = {
  keyLabel?: string;
  icon?: ReactNode;
  count?: number | null;
  state?: AbilitySlotState;
  /** 0-1 fraction of cooldown remaining; > 0 shows the sweep overlay. */
  cooldownFraction?: number;
  cooldownSeconds?: number;
  title?: string;
  onClick?: () => void;
  onContextMenu?: () => void;
  /** Optional popover content (e.g. an ammo-type or consumable-assign
   *  list) rendered above the slot, same as the game's old per-slot
   *  dropdown menus. Caller controls open/closed state and content --
   *  the slot only positions it. */
  dropdown?: ReactNode;
};

/**
 * AbilitySlot — single hotbar cell. Covers every state from the brief:
 * normal / hover / active(=selected) / pressed / cooldown / disabled /
 * locked / empty. Hover and pressed are pure CSS (:hover/:active) so they
 * never lag behind the pointer; the rest are driven by props/game state.
 */
export function AbilitySlot({
  keyLabel,
  icon,
  count,
  state = "normal",
  cooldownFraction = 0,
  cooldownSeconds = 0,
  title,
  onClick,
  onContextMenu,
  dropdown,
}: AbilitySlotProps) {
  const [pressed, setPressed] = useState(false);
  // Cursor-anchored click flash. `id` forces React to remount the element on
  // every click so the CSS animation restarts even on rapid repeat clicks.
  const [flash, setFlash] = useState<{ x: number; y: number; id: number } | null>(null);
  const flashId = useRef(0);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; bottom: number } | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const isLocked = state === "locked";
  const isDisabled = state === "disabled";
  const isEmpty = state === "empty";
  const isSelected = state === "selected";
  const isInteractive = !isLocked && !isDisabled;
  const onCooldown = cooldownFraction > 0;

  // The slot sits inside an ancestor with clip-path + overflow:hidden (the
  // console shell's chamfered silhouette), which would silently clip any
  // popover positioned outside the slot's own box. Portal the dropdown to
  // document.body instead, anchored via a measured rect, so it renders
  // above the whole HUD instead of being cut off by the console's shape.
  useLayoutEffect(() => {
    if (!dropdown || !slotRef.current) {
      setDropdownPos(null);
      return;
    }
    const rect = slotRef.current.getBoundingClientRect();
    setDropdownPos({
      left: rect.left + rect.width / 2,
      bottom: window.innerHeight - rect.top + 10,
    });
  }, [dropdown]);

  return (
    <div
      ref={slotRef}
      className={[
        styles.slot,
        isSelected ? styles.selected : "",
        isLocked ? styles.locked : "",
        isDisabled ? styles.disabled : "",
        isEmpty ? styles.empty : "",
        isInteractive ? "hud-interactive" : "",
      ]
        .join(" ")
        .trim()}
      style={{ "--slot-accent": isSelected ? "var(--hud-gold)" : "var(--hud-cyan)" } as React.CSSProperties}
    >
      {/* Layer 1: outer frame silhouette */}
      <div className={styles.border} />
      {/* Layer 2: mid bracket -- a slightly inset structural ring that
          gives the slot a "mounted component" reading instead of a flat
          card; carries the brushed-metal texture */}
      <div className={`${styles.bracket} hud-mat-brushed`} />
      {isSelected && (
        <>
          <div className={styles.ringOuter} />
          <div className={styles.ringInner} />
        </>
      )}
      <button
        type="button"
        className={styles.hitArea}
        title={title}
        disabled={!isInteractive}
        aria-label={title ?? "Ability slot"}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.();
        }}
        onMouseDown={(e) => {
          setPressed(true);
          // Click flash AT the cursor (design handoff): a short bright bloom
          // centred on where the pointer actually hit, so the slot answers the
          // click at the point of contact instead of only dimming as a whole.
          const r = e.currentTarget.getBoundingClientRect();
          setFlash({
            x: ((e.clientX - r.left) / r.width) * 100,
            y: ((e.clientY - r.top) / r.height) * 100,
            id: flashId.current++,
          });
        }}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
      >
        {flash && (
          <span
            key={flash.id}
            className={styles.clickFlash}
            style={{ left: `${flash.x}%`, top: `${flash.y}%` }}
            onAnimationEnd={() => setFlash(null)}
          />
        )}
        {/* Layer 3: recessed inner face */}
        <span className={`${styles.inner} ${pressed && isInteractive ? styles.pressed : ""}`}>
          <span className={styles.innerNoise} />
          {keyLabel && <span className={styles.keyLabel}>{keyLabel}</span>}
          <span className={styles.cornerMarkTl} />
          <span className={styles.cornerMarkBr} />
          {!isEmpty && icon && <span className={`${styles.icon} ${onCooldown ? styles.iconDimmed : ""}`}>{icon}</span>}
          {isLocked && <span className={styles.lockIcon}>&#128274;</span>}
          {count != null && count > 0 && <span className={styles.count}>×{count}</span>}
          {onCooldown && <CooldownOverlay fraction={cooldownFraction} secondsLeft={cooldownSeconds} />}
        </span>
      </button>
      {dropdown && dropdownPos &&
        createPortal(
          <div
            className={styles.dropdownAnchor}
            style={{ position: "fixed", left: dropdownPos.left, bottom: dropdownPos.bottom, transform: "translateX(-50%)" }}
          >
            {dropdown}
          </div>,
          document.body
        )}
    </div>
  );
}

export type SlotDropdownProps = {
  header: string;
  children: ReactNode;
};

/** Popover shell for AbilitySlot's `dropdown` prop -- same brushed-metal
 *  + chamfered-corner material language as the rest of Formfamily A/D,
 *  positioned above the slot it belongs to. */
export function SlotDropdown({ header, children }: SlotDropdownProps) {
  return (
    <div className={`${styles.slotDropdown} hud-mat-brushed`}>
      <div className={styles.slotDropdownHeader}>{header}</div>
      {children}
    </div>
  );
}

export type SlotDropdownRowProps = {
  icon: ReactNode;
  color: string;
  name: string;
  desc?: string;
  count?: number | null;
  isActive?: boolean;
  onClick: () => void;
};

export function SlotDropdownRow({ icon, color, name, desc, count, isActive, onClick }: SlotDropdownRowProps) {
  return (
    <button
      type="button"
      className={`${styles.slotDropdownRow} ${isActive ? styles.slotDropdownRowActive : ""}`}
      style={{ "--row-accent": color } as React.CSSProperties}
      onClick={onClick}
    >
      <span className={styles.slotDropdownRowIcon}>{icon}</span>
      <span className={styles.slotDropdownRowText}>
        <span className={styles.slotDropdownRowName}>{name}</span>
        {desc && <span className={styles.slotDropdownRowDesc}>{desc}</span>}
      </span>
      {count != null && <span className={styles.slotDropdownRowCount}>×{count}</span>}
    </button>
  );
}
