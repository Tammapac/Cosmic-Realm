import { useEffect, useState } from "react";
import { useGame, useConsumable, state, bump, pushNotification, setHotbarSlot, getActiveAmmoType, getAmmoCount, switchAmmoType, getActiveRocketAmmoType, getRocketAmmoCount, switchRocketAmmoType } from "../game/store";
import { effectiveStats } from "../game/loop";
import { CONSUMABLE_DEFS, ConsumableId, ROCKET_AMMO_TYPE_DEFS, LASER_AMMO_TYPE_ORDER, RocketAmmoType, ROCKET_MISSILE_TYPE_DEFS, ROCKET_MISSILE_TYPE_ORDER, RocketMissileType } from "../game/types";

// ── Lower HUD — Asset-Kit (StyleReferences/Asset_Baukasten.png) ──────────────
// The hotbar frame, status bars and slots are the ACTUAL kit parts, extracted
// to transparent PNGs (Kit/extract.py) — one coherent source, guaranteed
// consistent style. hotkey_bar.png is the 12-cell kit hotbar (native 527×70);
// the game's abilities occupy the first N cells (measured even grid). HP + Shield
// kit bars sit above. Live fill/%/icons/cooldowns are drawn over the static art.
const UI = "/assets/ui/kit";
const HB_NAT_W = 527, HB_NAT_H = 70;                  // hotkey_bar native
const CONSOLE_W = 780;                                // on-screen width
const K = CONSOLE_W / HB_NAT_W;
const CONSOLE_H = Math.round(HB_NAT_H * K);           // ≈ 104
const N_CELLS = 12;                                   // kit hotbar has 12 cells
const N_SLOTS = 8;                                    // game abilities shown
// measured cell dividers (fraction of width): 0.006 .. 0.983, pitch ~0.082.
const CELL0 = 0.043, CELL_PITCH = 0.0817;             // center of cell i = CELL0 + i*pitch
const SLOT_S = Math.round(CONSOLE_W * CELL_PITCH * 0.86);
const SLOT_H = SLOT_S;
const SLOT_Y = Math.round(CONSOLE_H * 0.5 - SLOT_H / 2 + CONSOLE_H * 0.02);
const cellCenterX = (i: number) => CONSOLE_W * (CELL0 + i * CELL_PITCH);
const slotX = (i: number) => Math.round(cellCenterX(i) - SLOT_S / 2);
// HP + Shield kit bars, stacked above the hotbar
const BAR_W = Math.round(CONSOLE_W * 0.44);
const BAR_H = Math.round(BAR_W * (21 / 181));         // bar aspect
const HP_COLOR = "#5cff8a";
const SH_COLOR = "#4ee2ff";
const HULL_RING = "#ff6b6b";

export function Hotbar() {
  const hotbar = useGame((s) => s.player.hotbar);
  const consumables = useGame((s) => s.player.consumables);
  const cooldowns = useGame((s) => s.hotbarCooldowns);
  const afterburnUntil = useGame((s) => s.afterburnUntil);
  const repairBotUntil = useGame((s) => s.repairBotUntil);
  const tick = useGame((s) => s.tick);
  const attackCooldownUntil = useGame((s) => s.attackCooldownUntil);
  const attackCooldownDuration = useGame((s) => s.attackCooldownDuration);
  const docked = useGame((s) => s.dockedAt);
  const selectedTarget = useGame((s) => s.selectedWorldTarget);
  const isAttacking = useGame((s) => s.isAttacking);
  const isLaserFiring = useGame((s) => s.isLaserFiring);
  const isRocketFiring = useGame((s) => s.isRocketFiring);
  const showAmmoSelector = useGame((s) => s.showAmmoSelector);
  const showRocketAmmoSelector = useGame((s) => s.showRocketAmmoSelector);
  const player = useGame((s) => s.player);

  // which consumable slot (0-6) has its assign dropdown open
  const [assignSlot, setAssignSlot] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAssignSlot(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (docked) return null;

  const es = effectiveStats();
  const attackOnCooldown = tick < attackCooldownUntil;

  const toggleAttack = () => {
    if (!selectedTarget || selectedTarget.kind !== "enemy") {
      pushNotification("Select an enemy first", "bad");
      return;
    }
    const enemy = state.enemies.find((e) => e.id === selectedTarget.id);
    if (!enemy) {
      pushNotification("Target lost", "bad");
      return;
    }
    const newVal = !(state.isLaserFiring || state.isRocketFiring);
    state.isLaserFiring = newVal;
    state.isRocketFiring = newVal;
    state.isAttacking = newVal;
    bump();
  };

  const activeAmmoType = getActiveAmmoType();
  const ammoDef = ROCKET_AMMO_TYPE_DEFS[activeAmmoType];
  const ammoCount = getAmmoCount(activeAmmoType);

  const activeRocketType = getActiveRocketAmmoType();
  const rocketDef = ROCKET_MISSILE_TYPE_DEFS[activeRocketType];
  const rocketCount = getRocketAmmoCount(activeRocketType);

  const toggleAmmoSelector = () => {
    state.showAmmoSelector = !state.showAmmoSelector;
    state.showRocketAmmoSelector = false;
    setAssignSlot(null);
    bump();
  };

  const selectAmmo = (type: RocketAmmoType) => {
    switchAmmoType(type);
    state.showAmmoSelector = false;
    bump();
  };

  const toggleRocketAmmoSelector = () => {
    state.showRocketAmmoSelector = !state.showRocketAmmoSelector;
    state.showAmmoSelector = false;
    setAssignSlot(null);
    bump();
  };

  const selectRocketAmmo = (type: RocketMissileType) => {
    switchRocketAmmoType(type);
    state.showRocketAmmoSelector = false;
    bump();
  };

  const toggleAssign = (i: number) => {
    setAssignSlot(assignSlot === i ? null : i);
    state.showAmmoSelector = false;
    state.showRocketAmmoSelector = false;
    bump();
  };

  const assignConsumable = (i: number, id: ConsumableId | null) => {
    setHotbarSlot(i, id);
    setAssignSlot(null);
  };

  const shieldPct = Math.max(0, Math.min(100, (player.shield / Math.max(1, es.shieldMax)) * 100));
  const hullPct = Math.max(0, Math.min(100, (player.hull / Math.max(1, es.hullMax)) * 100));

  return (
    <div
      style={{
        position: "fixed",
        bottom: 6,
        left: "50%",
        transform: "translateX(-50%)",
        width: CONSOLE_W,
        height: CONSOLE_H,
        zIndex: 50,
        pointerEvents: "none",
        filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.75))",
      }}
    >
      {/* HP + Shield kit bars, stacked above the hotbar */}
      <KitBar
        img={`${UI}/bar_health.png`} left={6} top={-BAR_H * 2 - 6}
        width={BAR_W} height={BAR_H} pct={hullPct} color={HULL_RING}
        title={`Hull ${Math.round(player.hull)}/${Math.round(es.hullMax)}`}
      />
      <KitBar
        img={`${UI}/bar_shield.png`} left={CONSOLE_W - BAR_W - 6} top={-BAR_H * 2 - 6}
        width={BAR_W} height={BAR_H} pct={shieldPct} color={SH_COLOR}
        title={`Shield ${Math.round(player.shield)}/${Math.round(es.shieldMax)}`}
      />

      {/* kit hotbar frame (12 cells) */}
      <img
        src={`${UI}/hotkey_bar.png`}
        alt=""
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", imageRendering: "auto" }}
      />

      {/* attack toggle, docked left of the console under the shield gauge */}
      <button
        onClick={toggleAttack}
        onMouseDown={(e) => e.preventDefault()}
        title={selectedTarget?.kind === "enemy" ? (isAttacking ? "Stop attacking" : `Attack ${selectedTarget.name}`) : "Select an enemy first"}
        style={{
          position: "absolute",
          left: -58,
          top: CONSOLE_H - 50,
          width: 48,
          height: 48,
          border: `2px solid ${isAttacking ? "#ff5c6c" : attackOnCooldown ? "#7a1a22" : "#ff3b4d"}`,
          background: isAttacking ? "#3a0a10" : attackOnCooldown ? "#14040a" : "#24070b",
          borderRadius: "50%",
          color: attackOnCooldown ? "#7a3a44" : "#ffb3bb",
          fontFamily: "var(--font-display)",
          fontWeight: "bold",
          fontSize: 11.8,
          letterSpacing: "0.08em",
          cursor: attackOnCooldown ? "not-allowed" : "pointer",
          boxShadow: isAttacking ? "0 0 14px #ff3b4d, 0 0 28px #ff3b4d44" : attackOnCooldown ? "none" : "0 0 10px #ff3b4d55",
          overflow: "hidden",
          transition: "border-color 0.07s, background 0.07s, color 0.07s, box-shadow 0.15s",
          animation: isAttacking ? "attack-pulse 1s ease-in-out infinite" : undefined,
          pointerEvents: "auto",
        }}
      >
        {attackOnCooldown && (
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 3,
            background: "#ff3b4d",
            width: `${Math.max(0, Math.min(100, (1 - (attackCooldownUntil - tick) / Math.max(0.01, attackCooldownDuration)) * 100))}%`,
            transition: "width 0.05s linear",
          }} />
        )}
        {isAttacking ? "FIRING" : "ATTACK"}
      </button>

      {/* slot 1 — laser ammo (key 1) */}
      <TraySlot
        left={slotX(0)}
        keyLabel="1"
        glyph={ammoDef.glyph}
        color={ammoDef.color}
        sub={ammoDef.shortName}
        count={ammoCount}
        active={isLaserFiring || showAmmoSelector}
        title={`${ammoDef.name}\n${ammoDef.description}\nDMG ×${ammoDef.damageMul}${ammoDef.hasAoe ? " · AOE SPLASH" : ""}${ammoDef.stunDuration ? ` · STUN ${ammoDef.stunDuration}s` : ""} · COST ${ammoDef.costPerRound} CR/round\nIN STOCK ${ammoCount} — click to change ammo type · key 1 toggles laser fire`}
        onClick={toggleAmmoSelector}
      >
        {showAmmoSelector && (
          <Dropdown header="SELECT AMMO TYPE">
            {LASER_AMMO_TYPE_ORDER.map((type) => {
              const def = ROCKET_AMMO_TYPE_DEFS[type];
              return (
                <DropRow
                  key={type}
                  glyph={def.glyph}
                  color={def.color}
                  name={def.shortName}
                  desc={def.description}
                  count={getAmmoCount(type)}
                  isActive={type === activeAmmoType}
                  onClick={() => selectAmmo(type)}
                />
              );
            })}
          </Dropdown>
        )}
      </TraySlot>

      {/* slot 2 — rockets (key 2) */}
      <TraySlot
        left={slotX(1)}
        keyLabel="2"
        glyph={rocketDef.glyph}
        color={rocketDef.color}
        sub={rocketDef.shortName}
        count={rocketCount}
        active={isRocketFiring || showRocketAmmoSelector}
        title={`${rocketDef.name}\n${rocketDef.description}\nDMG ×${rocketDef.damageMul} · COST ${rocketDef.costPerRound} CR/round\nIN STOCK ${rocketCount} — click to change rocket type · key 2 toggles rocket fire`}
        onClick={toggleRocketAmmoSelector}
      >
        {showRocketAmmoSelector && (
          <Dropdown header="SELECT ROCKET TYPE">
            {ROCKET_MISSILE_TYPE_ORDER.map((type) => {
              const def = ROCKET_MISSILE_TYPE_DEFS[type];
              return (
                <DropRow
                  key={type}
                  glyph={def.glyph}
                  color={def.color}
                  name={def.shortName}
                  desc={def.description}
                  count={getRocketAmmoCount(type)}
                  isActive={type === activeRocketType}
                  onClick={() => selectRocketAmmo(type)}
                />
              );
            })}
          </Dropdown>
        )}
      </TraySlot>

      {/* slots 3-8 — consumables (hotbar 0-5): click to use, right-click / empty click to assign.
          8 slots total (laser + rockets + 6 consumables) to match UIEXAMPLE2. */}
      {hotbar.slice(0, 6).map((id, i) => {
        const def = id ? CONSUMABLE_DEFS[id] : null;
        const count = id ? (consumables[id] ?? 0) : 0;
        const cd = cooldowns[i] ?? 0;
        const usable = !!def && count > 0;
        let isActive = false;
        if (id === "afterburn-fuel" && afterburnUntil > tick) isActive = true;
        if (id === "repair-bot" && repairBotUntil > tick) isActive = true;

        return (
          <TraySlot
            key={i}
            left={slotX(i + 2)}
            keyLabel={String(i + 3)}
            glyph={def ? def.icon : "·"}
            color={def ? def.color : "#5a4626"}
            sub={def ? `×${count}` : ""}
            count={def ? count : null}
            active={isActive || assignSlot === i}
            title={def ? `${def.name}\n${def.description}\n${def.cooldown > 0 ? `COOLDOWN ${def.cooldown}s · ` : ""}OWNED ×${count} · MAX STACK ${def.stackMax}\nClick to use · right-click to reassign` : "Empty slot\nClick to assign a consumable"}
            onClick={() => (usable ? useConsumable(i) : toggleAssign(i))}
            onContextMenu={() => toggleAssign(i)}
            cooldownPct={def && cd > 0 ? cd / def.cooldown : 0}
            cooldownText={cd > 0 ? Math.ceil(cd) : null}
          >
            {assignSlot === i && (
              <Dropdown header={`ASSIGN SLOT ${i + 3}`}>
                {(Object.keys(CONSUMABLE_DEFS) as ConsumableId[]).map((cid) => {
                  const cdef = CONSUMABLE_DEFS[cid];
                  return (
                    <DropRow
                      key={cid}
                      glyph={cdef.icon}
                      color={cdef.color}
                      name={cdef.name}
                      desc={cdef.description}
                      count={consumables[cid] ?? 0}
                      isActive={id === cid}
                      onClick={() => assignConsumable(i, cid)}
                    />
                  );
                })}
                <DropRow glyph="∅" color="#8a6a3a" name="Empty" desc="Clear this slot" count={null} isActive={id === null} onClick={() => assignConsumable(i, null)} />
              </Dropdown>
            )}
          </TraySlot>
        );
      })}
    </div>
  );
}

/** Energy fill drawn over the console channel, using the extracted segment
 *  tiles (green then blue, exactly like the reference). The tiles are repeated
 *  horizontally and clipped to the fill percentage. */
/** Kit status bar (health/shield/energy/xp). The kit PNG already holds the
 *  colored fill at 100%; we clip its visible width to `pct` so it depletes,
 *  keeping the end-caps by overlaying the full frame at low opacity behind. */
function KitBar({ img, left, top, width, height, pct, color, title }: {
  img: string; left: number; top: number; width: number; height: number; pct: number; color: string; title: string;
}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div title={title} style={{ position: "absolute", left, top, width, height, pointerEvents: "auto" }}>
      {/* empty frame behind (dim) so the capsule ends stay visible when low */}
      <img src={img} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: "grayscale(0.7) brightness(0.5)", pointerEvents: "none" }} />
      {/* filled bar, clipped to pct */}
      <div style={{ position: "absolute", inset: 0, width: `${p}%`, overflow: "hidden", transition: "width 0.2s linear" }}>
        <img src={img} alt="" aria-hidden style={{ position: "absolute", left: 0, top: 0, width, height, maxWidth: "none", pointerEvents: "none", filter: `drop-shadow(0 0 3px ${color}66)` }} />
      </div>
    </div>
  );
}

function TickBar({ left, top, width, height, value, max, title }: { left: number; top: number; width: number; height: number; value: number; max: number; title: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const fillW = Math.round((width * pct) / 100);
  // reference is a two-tone bar: first ~55% green, remainder blue
  const greenEnd = Math.round(width * 0.55);
  const tile = (name: string) =>
    `url(${UI}/${name}.png) left center / auto 100% repeat-x`;
  return (
    <div
      title={title}
      style={{ position: "absolute", left, top, width, height, overflow: "hidden", pointerEvents: "auto" }}
    >
      <div
        style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: fillW,
          overflow: "hidden",
          transition: "width 0.15s linear",
          filter: "drop-shadow(0 0 3px rgba(80,255,150,0.4))",
        }}
      >
        {/* green run */}
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: greenEnd, background: tile("bar_fill_green"), imageRendering: "pixelated" }} />
        {/* blue run */}
        <div style={{ position: "absolute", left: greenEnd, top: 0, height: "100%", width: width - greenEnd, background: tile("bar_fill_blue"), imageRendering: "pixelated" }} />
      </div>
    </div>
  );
}

function TraySlot({ left, keyLabel, glyph, color, sub, count, active, title, onClick, onContextMenu, cooldownPct = 0, cooldownText = null, children }: {
  left: number;
  keyLabel: string;
  glyph: string;
  color: string;
  sub: string;
  count: number | null;
  active: boolean;
  title: string;
  onClick: () => void;
  onContextMenu?: () => void;
  cooldownPct?: number;
  cooldownText?: number | null;
  children?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  // The console art already contains the empty slot cells; this layer only adds
  // the extracted gold active-border overlay (when active) + hover glow + the
  // live item content on top.
  return (
    <div style={{ position: "absolute", left, top: SLOT_Y, width: SLOT_S, height: SLOT_H, pointerEvents: "auto" }}>
      <div
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(); }}
        title={title}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          fontFamily: "'Courier New', monospace",
          transition: "filter 0.1s, box-shadow 0.1s",
          boxShadow: hovered && !active ? `inset 0 0 10px ${color}33` : "none",
          filter: active ? `drop-shadow(0 0 6px ${color}88)` : "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* kit cyan slot frame as the active highlight (only when active) */}
        {active && (
          <img src={`${UI}/slot_cyan.png`} alt="" aria-hidden style={{ position: "absolute", inset: "-12%", width: "124%", height: "124%", pointerEvents: "none", zIndex: 1 }} />
        )}
        {cooldownPct > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: `${Math.min(100, cooldownPct * 100)}%`,
              background: "rgba(0,0,0,0.65)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        )}
        <div style={{ position: "absolute", top: 3, left: 5, fontSize: 10.6, color: "#8a6a3a", zIndex: 3, fontFamily: "var(--font-display)" }}>
          {keyLabel}
        </div>
        <div style={{ fontSize: 22.4, lineHeight: 1, color, zIndex: 3, textShadow: `0 0 8px ${color}`, fontWeight: "bold" }}>
          {glyph}
        </div>
        {sub && (
          <div style={{ position: "absolute", bottom: 3, right: 5, fontSize: 10.6, fontWeight: "bold", color: count === 0 ? "#6a4a2a" : "#e8c890", zIndex: 3 }}>
            {sub}
          </div>
        )}
        {cooldownText != null && (
          <div style={{ position: "absolute", fontSize: 14.2, fontWeight: "bold", color: "#fff", zIndex: 4, textShadow: "0 1px 3px #000" }}>
            {cooldownText}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function Dropdown({ header, children }: { header: string; children: React.ReactNode }) {
  return (
    <div
      className="sw-tooltip"
      style={{
        position: "absolute",
        bottom: SLOT_H + 10,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "4px 3px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 178,
        boxShadow: "0 0 24px rgba(0,0,0,0.9), 0 0 12px rgba(247,168,50,0.08)",
        zIndex: 60,
      }}
    >
      <div style={{ fontSize: 9.4, color: "rgba(232,200,144,0.65)", letterSpacing: "0.18em", textAlign: "center", padding: "3px 0 2px", fontFamily: "var(--font-display)" }}>
        {header}
      </div>
      {children}
    </div>
  );
}

function DropRow({ glyph, color, name, desc, count, isActive, onClick }: {
  glyph: string;
  color: string;
  name: string;
  desc: string;
  count: number | null;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 8px",
        cursor: "pointer",
        background: isActive ? `${color}22` : "transparent",
        border: isActive ? `1px solid ${color}88` : "1px solid transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#ffffff0a"; }}
      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <div style={{ fontSize: 18.9, color, fontWeight: "bold", width: 20, textAlign: "center", textShadow: `0 0 6px ${color}` }}>
        {glyph}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11.8, color: isActive ? color : "#e8d5b0", fontWeight: isActive ? "bold" : "normal" }}>
          {name} {isActive && "◂"}
        </div>
        <div style={{ fontSize: 9.4, color: "#8a7a5a" }}>{desc}</div>
      </div>
      {count != null && (
        <div style={{ fontSize: 11.8, color: count === 0 ? "#ff5c6c" : "#c8b088", fontWeight: "bold", fontFamily: "'Courier New', monospace" }}>
          {count}
        </div>
      )}
    </div>
  );
}
