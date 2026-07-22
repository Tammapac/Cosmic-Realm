import { useGame } from "../game/store";

// Boss HP bar on the PNG GUI middle loading-bar art (boss-bar.png):
// shown top-center whenever a boss is alive in the current zone. The red
// fill sits inside the art's dark channel (measured: L3.1 R2.7 T40 B32.6 %
// + safety) so it never overlaps the metal frame; the amber gem stays free.
// Bar appears only when the player is close enough to the boss to matter
// (roughly one screen and a bit beyond).
const BOSS_BAR_RANGE = 1600;

export function BossBar() {
  useGame((s) => s.tick);
  const enemies = useGame((s) => s.enemies);
  const docked = useGame((s) => s.dockedAt);
  const player = useGame((s) => s.player);
  if (docked) return null;
  // nearest living boss within range
  let boss: (typeof enemies)[number] | null = null;
  let bestD = BOSS_BAR_RANGE;
  for (const e of enemies) {
    if (!e.isBoss || e.hull <= 0) continue;
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.y - player.pos.y);
    if (d < bestD) { bestD = d; boss = e; }
  }
  if (!boss) return null;
  const pct = Math.max(0, Math.min(100, (boss.hull / Math.max(1, boss.hullMax)) * 100));

  return (
    <div
      className="pointer-events-none"
      style={{
        position: "fixed", left: "50%", top: 66, transform: "translateX(-50%)",
        width: "min(560px, 58vw)", zIndex: 34,
      }}
    >
      <div
        className="text-center font-bold truncate"
        style={{
          color: "var(--hud-gold)", fontSize: 15, letterSpacing: "0.22em",
          fontFamily: "var(--font-display)", textShadow: "0 0 10px rgba(232,185,77,0.4), 0 1px 2px #000",
          marginBottom: 2,
        }}
      >
        ◆ {(boss.name || "DREADNOUGHT").toUpperCase()} ◆
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "620 / 95",
          backgroundImage: "url(/assets/ui/boss-bar.png)",
          backgroundSize: "100% 100%",
          filter: "drop-shadow(0 3px 12px rgba(0,0,0,0.7))",
        }}
      >
        {/* fill matches the art's true black channel (rows 45-57 of 95) */}
        <div style={{ position: "absolute", left: "3.3%", right: "3.0%", top: "47.4%", bottom: "40%", overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`, height: "100%",
              background: "linear-gradient(180deg, #ff8a6a 0%, #ff3b4d 50%, #8f1622 100%)",
              boxShadow: "0 0 10px #ff3b4daa",
              transition: "width 0.2s ease-out",
            }}
          />
        </div>
        {/* HP numbers under the channel, on the frame's lower band */}
        <div
          className="absolute flex items-center justify-center tabular-nums font-bold"
          style={{
            left: 0, right: 0, top: "63%", height: "30%",
            fontSize: 11, color: "#ffd0cc", textShadow: "0 1px 2px #000, 0 0 6px #000",
            letterSpacing: "0.06em",
          }}
        >
          {Math.round(boss.hull)} / {Math.round(boss.hullMax)}
        </div>
      </div>
    </div>
  );
}
