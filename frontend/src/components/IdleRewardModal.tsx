import { useGame, claimIdleReward, dismissIdleReward } from "../game/store";

export function IdleRewardModal() {
  const r = useGame((s) => s.pendingIdleReward);
  if (!r) return null;
  const hours = Math.floor(r.secondsAway / 3600);
  const mins = Math.floor((r.secondsAway % 3600) / 60);

  return (
    <div className="absolute z-[58] pointer-events-auto" style={{ right: 16, bottom: 96 }}>
      <div className="panel p-2.5" style={{ width: 260, borderColor: "#ffd24a", boxShadow: "0 0 16px #ffd24a55" }}>
        <div className="scanline" />
        <div className="flex items-center justify-between mb-1">
          <div className="text-amber tracking-[0.2em] text-[10px] font-bold">⌬ IDLE REWARD</div>
          <button className="text-mute text-[10px] hover:text-white" onClick={dismissIdleReward}>✕</button>
        </div>
        <div className="text-dim text-[9px] mb-1.5">
          Away {hours > 0 ? `${hours}h ` : ""}{mins}m · couriers ran ops.
        </div>
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <div className="text-mute text-[8px] tracking-widest">CR</div>
            <div className="text-amber font-bold text-sm tabular-nums">+{r.credits.toLocaleString()}</div>
          </div>
          <div className="flex-1">
            <div className="text-mute text-[8px] tracking-widest">XP</div>
            <div className="text-magenta font-bold text-sm tabular-nums">+{r.exp.toLocaleString()}</div>
          </div>
        </div>
        <button className="btn btn-primary w-full" style={{ padding: "3px", fontSize: 10 }} onClick={claimIdleReward}>CLAIM</button>
      </div>
    </div>
  );
}
