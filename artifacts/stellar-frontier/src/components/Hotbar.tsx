import { useGame, useConsumable } from "../game/store";
import { CONSUMABLE_DEFS } from "../game/types";

const SLOT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export function Hotbar() {
  const hotbar = useGame((s) => s.player.hotbar);
  const consumables = useGame((s) => s.player.consumables);
  const cooldowns = useGame((s) => s.hotbarCooldowns);
  const afterburnUntil = useGame((s) => s.afterburnUntil);
  const repairBotUntil = useGame((s) => s.repairBotUntil);
  const tick = useGame((s) => s.tick);
  const docked = useGame((s) => s.dockedAt);

  if (docked) return null;

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
