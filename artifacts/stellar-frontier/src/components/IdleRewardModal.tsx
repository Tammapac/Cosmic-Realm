import { useGame, claimIdleReward, dismissIdleReward } from "../game/store";

export function IdleRewardModal() {
  const r = useGame((s) => s.pendingIdleReward);
  if (!r) return null;
  const hours = Math.floor(r.secondsAway / 3600);
  const mins = Math.floor((r.secondsAway % 3600) / 60);

  return (
    <div className="absolute inset-0 z-[58] flex items-center justify-center" style={{ background: "rgba(2,4,12,0.85)" }}>
      <div className="panel p-5 text-center" style={{ width: "min(420px, 92vw)", borderColor: "#ffd24a" }}>
        <div className="scanline" />
        <div className="text-amber glow-amber tracking-[0.3em] text-lg font-bold mb-2">⌬ IDLE REWARD</div>
        <div className="text-dim text-[11px] mb-4">
          You were away for {hours > 0 ? `${hours}h ` : ""}{mins}m. Your station handlers ran courier ops in your absence.
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="panel p-3">
            <div className="text-mute text-[9px] tracking-widest">CREDITS</div>
            <div className="text-amber font-bold text-xl tabular-nums">+{r.credits.toLocaleString()}</div>
          </div>
          <div className="panel p-3">
            <div className="text-mute text-[9px] tracking-widest">EXPERIENCE</div>
            <div className="text-magenta font-bold text-xl tabular-nums">+{r.exp.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex gap-2 justify-center">
          <button className="btn btn-primary px-5" onClick={claimIdleReward}>CLAIM</button>
          <button className="btn" onClick={dismissIdleReward}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}
