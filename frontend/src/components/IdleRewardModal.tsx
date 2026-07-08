import { useGame, claimIdleReward, dismissIdleReward } from "../game/store";

export function IdleRewardModal() {
  const r = useGame((s) => s.pendingIdleReward);
  if (!r) return null;
  const hours = Math.floor(r.secondsAway / 3600);
  const mins = Math.floor((r.secondsAway % 3600) / 60);

  return (
    <div className="absolute z-[58] pointer-events-auto" style={{ right: 16, bottom: 96 }}>
      <div
        className="panel panel-framed panel-gold"
        style={{
          width: 240,
          padding: "10px 12px",
          borderColor: "#ffd24a88",
          boxShadow: "0 0 18px #ffd24a33, inset 0 0 12px rgba(0,0,0,0.4)",
        }}
      >
        <div className="scanline" />

        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
          <div
            className="font-bold tracking-widest"
            style={{ color: "var(--accent-amber)", fontSize: 10, letterSpacing: "0.2em" }}
          >
            ⌬ IDLE REWARD
          </div>
          <button
            className="transition-colors duration-150"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-mute)",
              cursor: "pointer",
              fontSize: 12,
              padding: "0 2px",
              lineHeight: 1,
            }}
            onClick={dismissIdleReward}
          >
            ✕
          </button>
        </div>

        {/* Away time */}
        <div style={{ color: "var(--text-dim)", fontSize: 10, marginBottom: 8 }}>
          Away {hours > 0 ? `${hours}h ` : ""}{mins}m · couriers ran ops.
        </div>

        {/* Reward boxes */}
        <div className="flex gap-2 mb-2.5">
          <div
            className="flex-1 text-center"
            style={{
              background: "rgba(255,210,74,0.06)",
              border: "1px solid rgba(255,210,74,0.2)",
              padding: "5px 4px",
              borderRadius: 2,
            }}
          >
            <div className="hud-label">CR</div>
            <div
              className="font-bold tabular-nums"
              style={{ color: "var(--accent-amber)", fontSize: 14 }}
            >
              +{r.credits.toLocaleString()}
            </div>
          </div>
          <div
            className="flex-1 text-center"
            style={{
              background: "rgba(255,92,240,0.06)",
              border: "1px solid rgba(255,92,240,0.2)",
              padding: "5px 4px",
              borderRadius: 2,
            }}
          >
            <div className="hud-label">XP</div>
            <div
              className="font-bold tabular-nums"
              style={{ color: "var(--accent-magenta)", fontSize: 14 }}
            >
              +{r.exp.toLocaleString()}
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary w-full"
          style={{ padding: "5px 0", fontSize: 10, letterSpacing: "0.2em" }}
          onClick={claimIdleReward}
        >
          CLAIM REWARD
        </button>
      </div>
    </div>
  );
}
