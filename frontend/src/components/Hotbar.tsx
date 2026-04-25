import { useGame, useConsumable, state, bump, pushNotification, getActiveAmmoType, getAmmoCount, switchAmmoType, getAmmoWeaponIds, rocketAmmoMax, getActiveRocketAmmoType, getRocketAmmoCount, switchRocketAmmoType, rocketMissileMax } from "../game/store";
import { CONSUMABLE_DEFS, ROCKET_AMMO_TYPE_DEFS, LASER_AMMO_TYPE_ORDER, RocketAmmoType, ROCKET_MISSILE_TYPE_DEFS, ROCKET_MISSILE_TYPE_ORDER, RocketMissileType } from "../game/types";

const SLOT_KEYS = ["3", "4", "5", "6", "7", "8", "9", "0"];

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

  if (docked) return null;

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
    bump();
  };

  const selectRocketAmmo = (type: RocketMissileType) => {
    switchRocketAmmoType(type);
    state.showRocketAmmoSelector = false;
    bump();
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 4,
        zIndex: 50,
        pointerEvents: "auto",
      }}
    >
      <button
        onClick={toggleAttack}
        onMouseDown={(e) => e.preventDefault()}
        title={selectedTarget?.kind === "enemy" ? (isAttacking ? "Stop attacking" : `Attack ${selectedTarget.name}`) : "Select an enemy first"}
        style={{
          position: "relative",
          width: 78,
          height: 52,
          border: `2px solid ${isAttacking ? "#ff5c6c" : attackOnCooldown ? "#7a1a22" : "#ff3b4d"}`,
          background: isAttacking ? "#3a0a10" : attackOnCooldown ? "#14040a" : "#24070b",
          borderRadius: 4,
          color: attackOnCooldown ? "#7a3a44" : "#ffb3bb",
          fontFamily: "'Courier New', monospace",
          fontWeight: "bold",
          cursor: attackOnCooldown ? "not-allowed" : "pointer",
          boxShadow: attackOnCooldown ? "none" : "0 0 10px #ff3b4d55",
          overflow: "hidden",
          transition: "border-color 0.07s, background 0.07s, color 0.07s",
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

      {/* Ammo selector (key 1) */}
      <div style={{ position: "relative" }}>
        <div
          onClick={toggleAmmoSelector}
          title={`${ammoDef.name} — Click or press 1 to change ammo type`}
          style={{
            width: 52,
            height: 52,
            border: `2px solid ${ammoDef.color}`,
            background: showAmmoSelector ? `${ammoDef.color}33` : "#0c1220",
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            fontFamily: "'Courier New', monospace",
            boxShadow: showAmmoSelector ? `0 0 12px ${ammoDef.color}88` : `0 0 6px ${ammoDef.color}44`,
          }}
        >
          <div style={{ position: "absolute", top: 2, left: 4, fontSize: 9, color: "#556", zIndex: 3 }}>1</div>
          <div style={{ fontSize: 18, lineHeight: 1, color: ammoDef.color, zIndex: 3, textShadow: `0 0 8px ${ammoDef.color}`, fontWeight: "bold" }}>
            {ammoDef.glyph}
          </div>
          <div style={{ position: "absolute", bottom: 2, right: 4, fontSize: 8, fontWeight: "bold", color: ammoCount === 0 ? "#553" : "#ccc", zIndex: 3 }}>
            {ammoDef.shortName}
          </div>
        </div>

        {showAmmoSelector && (
          <div
            style={{
              position: "absolute",
              bottom: 58,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#0a0e1a",
              border: "1px solid #334",
              borderRadius: 6,
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 160,
              boxShadow: "0 0 20px rgba(0,0,0,0.8)",
              zIndex: 60,
            }}
          >
            <div style={{ fontSize: 8, color: "#667", letterSpacing: "0.15em", textAlign: "center", padding: "2px 0" }}>
              SELECT AMMO TYPE
            </div>
            {LASER_AMMO_TYPE_ORDER.map((type) => {
              const def = ROCKET_AMMO_TYPE_DEFS[type];
              const count = getAmmoCount(type);
              const isActive = type === activeAmmoType;
              return (
                <div
                  key={type}
                  onClick={(e) => { e.stopPropagation(); selectAmmo(type); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: isActive ? `${def.color}22` : "transparent",
                    border: isActive ? `1px solid ${def.color}88` : "1px solid transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#ffffff0a"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{ fontSize: 16, color: def.color, fontWeight: "bold", width: 20, textAlign: "center", textShadow: `0 0 6px ${def.color}` }}>
                    {def.glyph}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: isActive ? def.color : "#ccc", fontWeight: isActive ? "bold" : "normal" }}>
                      {def.shortName} {isActive && "◂"}
                    </div>
                    <div style={{ fontSize: 8, color: "#667" }}>{def.description}</div>
                  </div>
                  <div style={{ fontSize: 10, color: count === 0 ? "#ff5c6c" : "#aaa", fontWeight: "bold", fontFamily: "'Courier New', monospace" }}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rocket ammo selector (key 2) */}
      <div style={{ position: "relative" }}>
        <div
          onClick={toggleRocketAmmoSelector}
          title={`${rocketDef.name} — Click or press 2 to change rocket type`}
          style={{
            width: 52,
            height: 52,
            border: `2px solid ${rocketDef.color}`,
            background: showRocketAmmoSelector ? `${rocketDef.color}33` : "#0c1220",
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            fontFamily: "'Courier New', monospace",
            boxShadow: showRocketAmmoSelector ? `0 0 12px ${rocketDef.color}88` : `0 0 6px ${rocketDef.color}44`,
          }}
        >
          <div style={{ position: "absolute", top: 2, left: 4, fontSize: 9, color: "#556", zIndex: 3 }}>2</div>
          <div style={{ fontSize: 18, lineHeight: 1, color: rocketDef.color, zIndex: 3, textShadow: `0 0 8px ${rocketDef.color}`, fontWeight: "bold" }}>
            {rocketDef.glyph}
          </div>
          <div style={{ position: "absolute", bottom: 2, right: 4, fontSize: 8, fontWeight: "bold", color: rocketCount === 0 ? "#553" : "#ccc", zIndex: 3 }}>
            {rocketDef.shortName}
          </div>
        </div>

        {showRocketAmmoSelector && (
          <div
            style={{
              position: "absolute",
              bottom: 58,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#0a0e1a",
              border: "1px solid #334",
              borderRadius: 6,
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 160,
              boxShadow: "0 0 20px rgba(0,0,0,0.8)",
              zIndex: 60,
            }}
          >
            <div style={{ fontSize: 8, color: "#667", letterSpacing: "0.15em", textAlign: "center", padding: "2px 0" }}>
              SELECT ROCKET TYPE
            </div>
            {ROCKET_MISSILE_TYPE_ORDER.map((type) => {
              const def = ROCKET_MISSILE_TYPE_DEFS[type];
              const count = getRocketAmmoCount(type);
              const isActive = type === activeRocketType;
              return (
                <div
                  key={type}
                  onClick={(e) => { e.stopPropagation(); selectRocketAmmo(type); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: isActive ? `${def.color}22` : "transparent",
                    border: isActive ? `1px solid ${def.color}88` : "1px solid transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#ffffff0a"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{ fontSize: 16, color: def.color, fontWeight: "bold", width: 20, textAlign: "center", textShadow: `0 0 6px ${def.color}` }}>
                    {def.glyph}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: isActive ? def.color : "#ccc", fontWeight: isActive ? "bold" : "normal" }}>
                      {def.shortName} {isActive && "◂"}
                    </div>
                    <div style={{ fontSize: 8, color: "#667" }}>{def.description}</div>
                  </div>
                  <div style={{ fontSize: 10, color: count === 0 ? "#ff5c6c" : "#aaa", fontWeight: "bold", fontFamily: "'Courier New', monospace" }}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hotbar.map((id, i) => {
        const def = id ? CONSUMABLE_DEFS[id] : null;
        const count = id ? (consumables[id] ?? 0) : 0;
        const cd = cooldowns[i] ?? 0;
        const isEmpty = !id || count === 0;
        let isActive = false;
        if (id === "afterburn-fuel" && afterburnUntil > tick) isActive = true;
        if (id === "repair-bot" && repairBotUntil > tick) isActive = true;

        return (
          <div
            key={i}
            onClick={() => !isEmpty && useConsumable(i)}
            title={def ? `${def.name}: ${def.description}` : "Empty slot"}
            style={{
              width: 52,
              height: 52,
              border: `2px solid ${def ? def.color : "#334"}`,
              background: isActive
                ? `${def?.color ?? "#444"}33`
                : isEmpty
                ? "#080c18"
                : "#0c1220",
              borderRadius: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: isEmpty ? "default" : "pointer",
              position: "relative",
              overflow: "hidden",
              fontFamily: "'Courier New', monospace",
              transition: "border-color 0.15s",
              boxShadow: isActive ? `0 0 12px ${def?.color}88` : undefined,
            }}
          >
            {cd > 0 && def && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  width: "100%",
                  height: `${(cd / def.cooldown) * 100}%`,
                  background: "rgba(0,0,0,0.6)",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
            )}
            <div style={{ position: "absolute", top: 2, left: 4, fontSize: 9, color: "#556", zIndex: 3 }}>
              {SLOT_KEYS[i]}
            </div>
            <div
              style={{
                fontSize: 20,
                lineHeight: 1,
                color: def ? def.color : "#334",
                zIndex: 3,
                textShadow: def ? `0 0 8px ${def.color}` : undefined,
              }}
            >
              {def ? def.icon : "·"}
            </div>
            {def && (
              <div
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 4,
                  fontSize: 9,
                  fontWeight: "bold",
                  color: count === 0 ? "#553" : "#ccc",
                  zIndex: 3,
                }}
              >
                ×{count}
              </div>
            )}
            {cd > 0 && (
              <div
                style={{
                  position: "absolute",
                  fontSize: 11,
                  fontWeight: "bold",
                  color: "#fff",
                  zIndex: 4,
                  textShadow: "0 1px 3px #000",
                }}
              >
                {Math.ceil(cd)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
