import { useGame } from "../game/store";
import { ENEMY_DEFS } from "../game/types";

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
      style={{ top: 58, left: 12, display: "flex", flexDirection: "column", gap: 4, maxWidth: 220 }}
    >
      <div className="text-[8px] tracking-[0.25em] text-mute mb-0.5">
        ▸ ACTIVE BOUNTIES
      </div>
      {activeQuests.slice(0, 5).map((q) => {
        const pct = Math.min(1, q.progress / q.killCount);
        const done = q.completed;
        const color = done ? "#5cff8a" : ENEMY_DEFS[q.killType]?.color ?? "#4ee2ff";
        const glyph = TYPE_GLYPHS[q.killType] ?? "•";
        return (
          <div
            key={q.id}
            className="panel px-2 py-1"
            style={{
              borderColor: color + "55",
              boxShadow: done ? `0 0 10px ${color}44` : undefined,
              opacity: done ? 0.8 : 1,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                className="text-[9px] tracking-wide truncate flex items-center gap-1"
                style={{ color }}
              >
                <span style={{ opacity: 0.8 }}>{glyph}</span>
                <span className="truncate">{q.title}</span>
              </div>
              <div className="text-[10px] font-bold tabular-nums shrink-0" style={{ color }}>
                {Math.min(q.progress, q.killCount)}/{q.killCount}
              </div>
            </div>
            <div className="mt-0.5 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct * 100}%`,
                  background: color,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            {done && (
              <div className="text-[8px] tracking-widest mt-0.5" style={{ color: "#5cff8a" }}>
                ✓ READY TO TURN IN
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
