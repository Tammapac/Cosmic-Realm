import { useGame } from "../game/store";
import { ENEMY_DEFS, ZONES } from "../game/types";

const TYPE_GLYPHS: Record<string, string> = {
  scout:     "◇",
  raider:    "◈",
  destroyer: "⬡",
  voidling:  "✦",
  dread:     "☠",
};

export function QuestTracker() {
  const activeQuests = useGame((s) => s.player.activeQuests);
  const docked = useGame((s) => s.dockedAt);

  if (docked || activeQuests.length === 0) return null;

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{ top: 110, left: 12, display: "flex", flexDirection: "column", gap: 6, maxWidth: 300 }}
    >
      <div
        className="tracking-widest"
        style={{ color: "var(--text-mute)", fontSize: 10, letterSpacing: "0.22em" }}
      >
        ▸ ACTIVE BOUNTIES
      </div>
      {activeQuests.slice(0, 5).map((q) => {
        const pct = Math.min(1, q.progress / q.killCount);
        const done = q.completed;
        const color = done ? "#5cff8a" : (ENEMY_DEFS[q.killType]?.color ?? "#4ee2ff");
        const glyph = TYPE_GLYPHS[q.killType] ?? "•";
        const zoneName = (ZONES as any)[q.zone]?.name ?? q.zone;
        return (
          <div
            key={q.id}
            className="panel px-2.5 py-2"
            style={{
              borderColor: color + "44",
              boxShadow: done ? `0 0 8px ${color}33, inset 0 0 8px ${color}08` : "none",
              opacity: done ? 0.9 : 1,
            }}
          >
            {/* Title row */}
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="shrink-0"
                style={{ color, fontSize: 12, lineHeight: 1 }}
              >
                {glyph}
              </span>
              <span
                className="truncate font-bold"
                style={{ color, fontSize: 11, flex: 1, minWidth: 0 }}
              >
                {q.title}
              </span>
              <span
                className="tabular-nums shrink-0 font-bold"
                style={{ color, fontSize: 12 }}
              >
                {Math.min(q.progress, q.killCount)}/{q.killCount}
              </span>
            </div>

            {/* Zone label */}
            <div
              className="truncate mt-0.5"
              style={{ color: "var(--text-mute)", fontSize: 9, letterSpacing: "0.1em" }}
            >
              {zoneName.toUpperCase()}
            </div>

            {/* Progress bar */}
            <div
              className="mt-1.5 overflow-hidden"
              style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct * 100}%`,
                  background: color,
                  boxShadow: `0 0 4px ${color}88`,
                  transition: "width 0.3s ease",
                  borderRadius: 2,
                }}
              />
            </div>

            {done && (
              <div
                className="tracking-widest mt-1 font-bold"
                style={{ color: "#5cff8a", fontSize: 9, letterSpacing: "0.18em" }}
              >
                ✓ READY TO TURN IN
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
