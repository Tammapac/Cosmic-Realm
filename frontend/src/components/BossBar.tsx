import { useGame } from "../game/store";

// Boss HP bar on the PNG GUI middle loading-bar art (boss-bar.png):
// shown top-center whenever a boss is alive in the current zone. The red
// fill sits inside the art's dark channel (measured: L3.1 R2.7 T40 B32.6 %
// + safety) so it never overlaps the metal frame; the amber gem stays free.
export function BossBar() {
  useGame((s) => s.tick);
  const enemies = useGame((s) => s.enemies);
  const docked = useGame((s) => s.dockedAt);
  if (docked) return null;
  const boss = enemies.find((e) => e.isBoss && e.hull > 0);
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
          color: "#ff8a4e", fontSize: 15, letterSpacing: "0.22em",
          fontFamily: "var(--font-display)", textShadow: "0 0 10px #ff8a4e66, 0 1px 2px #000",
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
        <div style={{ position: "absolute", left: "3.3%", right: "3.0%", top: "42%", bottom: "34%", overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`, height: "100%",
              background: "linear-gradient(180deg, #ff8a6a 0%, #ff3b4d 50%, #8f1622 100%)",
              boxShadow: "0 0 10px #ff3b4daa",
              transition: "width 0.2s ease-out",
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center tabular-nums font-bold"
            style={{ fontSize: 11, color: "#fff", textShadow: "0 1px 2px #000", letterSpacing: "0.05em" }}
          >
            {Math.round(boss.hull)} / {Math.round(boss.hullMax)}
          </div>
        </div>
      </div>
    </div>
  );
}
