import { useGame, useConsumable, state, bump, pushNotification } from "../game/store";
import { CONSUMABLE_DEFS } from "../game/types";
import { effectiveStats, queueAttackTarget } from "../game/loop";

const SLOT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"];

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

  if (docked) return null;

  const attackOnCooldown = tick < attackCooldownUntil;

  const attackSelectedTarget = () => {
    if (!selectedTarget || selectedTarget.kind !== "enemy") {
      pushNotification("Select an enemy first", "bad");
      return;
    }
    const enemy = state.enemies.find((e) => e.id === selectedTarget.id);
    if (!enemy) {
      pushNotification("Target lost", "bad");
      return;
    }
    queueAttackTarget(enemy.id);
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
        onClick={attackSelectedTarget}
        title={selectedTarget?.kind === "enemy" ? `Attack ${selectedTarget.name}` : "Select an enemy first"}
        style={{
          position: "relative",
          width: 78,
          height: 52,
          border: `2px solid ${attackOnCooldown ? "#7a1a22" : "#ff3b4d"}`,
          background: attackOnCooldown ? "#14040a" : "#24070b",
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
        ATTACK
      </button>
      {hotbar.map((id, i) => {
        const def = id ? CONSUMABLE_DEFS[id] : null;
        const count = id ? (consumables[id] ?? 0) : 0;
        const cd = cooldowns[i] ?? 0;
        const isEmpty = !id || count === 0;
        // Active indicator for time-based consumables
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
            {/* Cooldown fill overlay */}
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
            {/* Slot key label */}
            <div
              style={{
                position: "absolute",
                top: 2,
                left: 4,
                fontSize: 9,
                color: "#556",
                zIndex: 3,
              }}
            >
              {SLOT_KEYS[i]}
            </div>
            {/* Icon */}
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
            {/* Count */}
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
            {/* Cooldown timer text */}
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
