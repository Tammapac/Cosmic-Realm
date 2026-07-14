import { useEffect, useState } from "react";
import { useGame, useConsumable, state, bump, pushNotification, setHotbarSlot, getActiveAmmoType, getAmmoCount, switchAmmoType, getActiveRocketAmmoType, getRocketAmmoCount, switchRocketAmmoType } from "../game/store";
import { effectiveStats } from "../game/loop";
import { CONSUMABLE_DEFS, ConsumableId, ROCKET_AMMO_TYPE_DEFS, LASER_AMMO_TYPE_ORDER, RocketAmmoType, ROCKET_MISSILE_TYPE_DEFS, ROCKET_MISSILE_TYPE_ORDER, RocketMissileType } from "../game/types";

// ── Redesigned HUD (Cosmic Realm reference) ──────────────────────────────────
// The bottom HUD is one console housing (console.png) containing a segmented
// energy bar strip across the top and a row of 9 slots below, flanked by a
// circular SHIELD gauge (left, cyan) and HULL gauge (right, red). Assets are
// the coherent AI-generated UI kit in /assets/ui/redesign/. All game logic is
// unchanged — only the visual layer is the new kit.
const UI = "/assets/ui/redesign";
// console.png native geometry (from the kit renderer, console meta):
//   native W=656, H=128, pad=12, OUTER=4, bar_h=24, slot=64, gap=6, slots=9
// The console has NO baked slot wells — the game draws its 9 slot frames in the
// open bay, so these constants map the game slots onto the console's bay exactly.
const NAT_W = 656, NAT_H = 128, NAT_PAD = 12, NAT_OUTER = 4;
const NAT_BAR_H = 24, NAT_SLOT = 64, NAT_GAP = 6;
const N_SLOTS = 9;
const CONSOLE_SCALE = 1.28;
const CONSOLE_W = Math.round(NAT_W * CONSOLE_SCALE);
const CONSOLE_H = Math.round(NAT_H * CONSOLE_SCALE);
const K = CONSOLE_SCALE;
// slot grid: bay starts at (OUTER+pad) native, each slot NAT_SLOT wide
const SLOT_S = Math.round(NAT_SLOT * K);
const SLOT_GAP = Math.round(NAT_GAP * K);
const SLOT_X0 = Math.round((NAT_OUTER + NAT_PAD) * K);
const SLOT_Y = Math.round((NAT_OUTER + NAT_PAD + NAT_BAR_H + 8) * K); // below the bar strip
const SLOT_H = SLOT_S;
const slotX = (i: number) => SLOT_X0 + i * (SLOT_S + SLOT_GAP);
// bar strip geometry inside the console top
const BAR_X = Math.round((NAT_OUTER + NAT_PAD) * K);
const BAR_Y = Math.round((NAT_OUTER + NAT_PAD) * K);
const BAR_W = Math.round((N_SLOTS * NAT_SLOT + (N_SLOTS - 1) * NAT_GAP) * K);
const BAR_H = Math.round(NAT_BAR_H * K);
// circular gauges
const GAUGE = 148;

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
      {/* console housing (bar strip + slot grid), from the redesigned UI kit */}
      <img
        src={`${UI}/console.png`}
        alt=""
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />

      {/* ── flanking SHIELD gauge (left) ── */}
      <CircleGauge
        side="left" pct={shieldPct} ring={SH_COLOR}
        img={`${UI}/master_circle_shield.png`}
        title={`Shield ${Math.round(player.shield)}/${Math.round(es.shieldMax)}`}
      />
      {/* ── flanking HULL gauge (right) ── */}
      <CircleGauge
        side="right" pct={hullPct} ring={HULL_RING}
        img={`${UI}/master_circle_hull.png`}
        title={`Hull ${Math.round(player.hull)}/${Math.round(es.hullMax)}`}
      />

      {/* segmented energy bar strip across the console top (shield fill) */}
      <TickBar
        left={BAR_X} width={BAR_W}
        value={player.shield} max={es.shieldMax} color={SH_COLOR}
        title={`Shield ${Math.round(player.shield)}/${Math.round(es.shieldMax)}`}
      />

      {/* attack toggle, docked left of the console under the shield gauge */}
      <button
        onClick={toggleAttack}
        onMouseDown={(e) => e.preventDefault()}
        title={selectedTarget?.kind === "enemy" ? (isAttacking ? "Stop attacking" : `Attack ${selectedTarget.name}`) : "Select an enemy first"}
        style={{
          position: "absolute",
          left: -GAUGE - 6,
          top: CONSOLE_H - 54,
          width: 52,
          height: 52,
          border: `2px solid ${isAttacking ? "#ff5c6c" : attackOnCooldown ? "#7a1a22" : "#ff3b4d"}`,
          background: isAttacking ? "#3a0a10" : attackOnCooldown ? "#14040a" : "#24070b",
          borderRadius: "50%",
          color: attackOnCooldown ? "#7a3a44" : "#ffb3bb",
          fontFamily: "var(--font-display)",
          fontWeight: "bold",
          fontSize: 10,
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

      {/* slots 3-9 — consumables (hotbar 0-6): click to use, right-click / empty click to assign */}
      {hotbar.slice(0, 7).map((id, i) => {
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

/** Segmented energy bar drawn inside the console's top bar strip. Fill runs
 *  green→cyan (shield). "+"/lightning endcaps sit in the console art. */
function TickBar({ left, width, value, max, color, title }: { left: number; width: number; value: number; max: number; color: string; title: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const ticks = (c: string) => `repeating-linear-gradient(90deg, ${c} 0px, ${c} 5px, transparent 5px, transparent 8px)`;
  return (
    <div
      title={title}
      style={{
        position: "absolute",
        left,
        top: BAR_Y,
        width,
        height: BAR_H,
        background: ticks(`${color}18`),
        overflow: "hidden",
        pointerEvents: "auto",
        borderRadius: 3,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${pct}%`,
          background: ticks(pct > 50 ? color : "#5cff8a"),
          filter: `drop-shadow(0 0 4px ${color})`,
          transition: "width 0.15s linear",
        }}
      />
    </div>
  );
}

/** Circular shield/hull gauge flanking the console. Static ring art from the
 *  UI kit; the % fill arc + label are drawn here over the hollow center. */
function CircleGauge({ side, pct, ring, img, title }: {
  side: "left" | "right"; pct: number; ring: string; img: string; title: string;
}) {
  const R = GAUGE / 2;
  const CIRC = 2 * Math.PI * (R * 0.62);
  const off = CIRC * (1 - pct / 100);
  return (
    <div
      title={title}
      style={{
        position: "absolute",
        [side]: -GAUGE - 2,
        top: (CONSOLE_H - GAUGE) / 2,
        width: GAUGE,
        height: GAUGE,
        pointerEvents: "auto",
      }}
    >
      <img src={img} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {/* fill arc over the hollow center */}
      <svg width={GAUGE} height={GAUGE} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle
          cx={R} cy={R} r={R * 0.62}
          fill="none" stroke={ring} strokeWidth={5}
          strokeDasharray={CIRC} strokeDashoffset={off}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${ring})`, transition: "stroke-dashoffset 0.2s linear" }}
        />
      </svg>
      {/* % + label */}
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", pointerEvents: "none",
      }}>
        <div style={{ fontSize: 22, fontWeight: "bold", color: ring, fontFamily: "var(--font-display)", textShadow: `0 0 8px ${ring}88, 0 1px 2px #000` }}>
          {Math.round(pct)}%
        </div>
        <div style={{ fontSize: 9, letterSpacing: "0.16em", color: `${ring}cc`, fontFamily: "var(--font-display)", marginTop: 1 }}>
          {side === "left" ? "SHIELD" : "HULL"}
        </div>
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
  const slotArt = active
    ? `${UI}/master_slot_active.png`
    : hovered
      ? `${UI}/master_slot_hover.png`
      : `${UI}/master_slot_normal.png`;
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
          transition: "filter 0.1s",
          filter: active ? `drop-shadow(0 0 6px ${color}66)` : "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* kit slot frame art */}
        <img src={slotArt} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
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
        <div style={{ position: "absolute", top: 3, left: 5, fontSize: 9, color: "#8a6a3a", zIndex: 3, fontFamily: "var(--font-display)" }}>
          {keyLabel}
        </div>
        <div style={{ fontSize: 19, lineHeight: 1, color, zIndex: 3, textShadow: `0 0 8px ${color}`, fontWeight: "bold" }}>
          {glyph}
        </div>
        {sub && (
          <div style={{ position: "absolute", bottom: 3, right: 5, fontSize: 9, fontWeight: "bold", color: count === 0 ? "#6a4a2a" : "#e8c890", zIndex: 3 }}>
            {sub}
          </div>
        )}
        {cooldownText != null && (
          <div style={{ position: "absolute", fontSize: 12, fontWeight: "bold", color: "#fff", zIndex: 4, textShadow: "0 1px 3px #000" }}>
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
      <div style={{ fontSize: 8, color: "rgba(232,200,144,0.65)", letterSpacing: "0.18em", textAlign: "center", padding: "3px 0 2px", fontFamily: "var(--font-display)" }}>
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
      <div style={{ fontSize: 16, color, fontWeight: "bold", width: 20, textAlign: "center", textShadow: `0 0 6px ${color}` }}>
        {glyph}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: isActive ? color : "#e8d5b0", fontWeight: isActive ? "bold" : "normal" }}>
          {name} {isActive && "◂"}
        </div>
        <div style={{ fontSize: 8, color: "#8a7a5a" }}>{desc}</div>
      </div>
      {count != null && (
        <div style={{ fontSize: 10, color: count === 0 ? "#ff5c6c" : "#c8b088", fontWeight: "bold", fontFamily: "'Courier New', monospace" }}>
          {count}
        </div>
      )}
    </div>
  );
}
