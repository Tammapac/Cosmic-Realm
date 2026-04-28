#!/usr/bin/env python3
"""Replace MissionsTab with the new tabbed version."""

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# Find the MissionsTab function boundaries
marker = '// ── MISSIONS'
start_idx = hcode.find(marker)
if start_idx < 0:
    # Try without the dash style
    start_idx = hcode.find('function MissionsTab()')
    if start_idx > 0:
        # Back up to the comment line before it
        prev_nl = hcode.rfind('\n', 0, start_idx)
        if prev_nl > 0:
            start_idx = prev_nl + 1

end_marker = 'function AmmoTab()'
end_idx = hcode.find(end_marker)

if start_idx < 0 or end_idx < 0:
    print(f"ERROR: Could not find MissionsTab boundaries (start={start_idx}, end={end_idx})")
    exit(1)

print(f"  Found MissionsTab at chars {start_idx}-{end_idx}")

new_missions_tab = '''// ── MISSIONS ──────────────────────────────────────────────────────────────
function MissionsTab() {
  const player = useGame((s) => s.player);
  const missionBoard = useGame((s) => s.missionBoard);
  useGame((s) => s.tick);
  const [activeTab, setActiveTab] = useState<"daily" | "combat" | "transport" | "gathering" | "delivery" | "exploration">("daily");

  const next = new Date(player.lastDailyReset + 24 * 3600 * 1000);
  const hrs = Math.max(0, Math.floor((next.getTime() - Date.now()) / 3600000));
  const mins = Math.max(0, Math.floor(((next.getTime() - Date.now()) % 3600000) / 60000));

  const tabs = [
    { id: "daily" as const, label: "Daily", icon: "\\u2605" },
    { id: "transport" as const, label: "Transport", icon: "\\u25B6" },
    { id: "gathering" as const, label: "Gathering", icon: "\\u25B0" },
    { id: "delivery" as const, label: "Delivery", icon: "\\u25C6" },
    { id: "exploration" as const, label: "Exploration", icon: "\\u2726" },
  ];

  const boardByCategory = (cat: string) => (missionBoard ?? []).filter((m: any) => m.category === cat);

  const renderMission = (m: any) => {
    const pct = Math.min(1, m.progress / m.target);
    const claimed = m.claimed;
    const ready = m.completed && !claimed;
    return (
      <div
        key={m.id}
        className="panel p-3"
        style={{
          opacity: claimed ? 0.5 : 1,
          borderColor: ready ? "#5cff8a" : "var(--border-soft)",
        }}
      >
        <div className="font-bold text-[13px] text-cyan mb-1">{m.title}</div>
        <div className="text-dim text-[13px] mb-2">{m.description}</div>
        {m.targetStationId && (
          <div className="text-[12px] text-magenta mb-1">Target: {STATIONS.find((s: any) => s.id === m.targetStationId)?.name ?? m.targetStationId}</div>
        )}
        <div className="text-mute text-[13px] tabular-nums mb-1">
          {m.progress}/{m.target}
        </div>
        <div className="w-full h-1 mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full"
            style={{
              width: `${pct * 100}%`,
              background: ready ? "#5cff8a" : "var(--accent-cyan)",
            }}
          />
        </div>
        <div className="text-amber text-[13px] mb-2">
          +{m.rewardCredits.toLocaleString()}cr +{m.rewardExp.toLocaleString()}xp +{m.rewardHonor}hr
        </div>
        <button
          className="btn btn-primary w-full"
          style={{ padding: "4px 8px", fontSize: 13 }}
          disabled={!ready}
          onClick={() => claimMission(m.id)}
        >
          {claimed ? "CLAIMED" : ready ? "CLAIM" : "IN PROGRESS"}
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-3">
      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap border-b pb-2" style={{ borderColor: "var(--border-soft)" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={"btn " + (activeTab === t.id ? "btn-primary" : "")}
            style={{ padding: "5px 12px", fontSize: 12 }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Daily tab */}
      {activeTab === "daily" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-cyan tracking-widest text-sm">DAILY MISSIONS</div>
              <div className="text-mute text-[13px] mt-1">Resets in {hrs}h {mins}m</div>
            </div>
            <button
              className="btn btn-amber"
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={rerollDaily}
              disabled={player.credits < 500}
            >
              REROLL 500cr
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {player.dailyMissions.map((m: any) => renderMission(m))}
          </div>
          {/* Milestones */}
          <div className="text-cyan tracking-widest text-sm mt-4 mb-2">LIFETIME MILESTONES</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(player.milestones).map(([k, v]) => (
              <div key={k} className="panel p-2">
                <div className="text-mute text-[12px] tracking-widest uppercase">{k}</div>
                <div className="text-amber font-bold text-sm tabular-nums">{(v as number).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Category tabs */}
      {activeTab !== "daily" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-cyan tracking-widest text-sm">{activeTab.toUpperCase()} MISSIONS</div>
              <div className="text-mute text-[13px] mt-1">Complete missions to earn credits, XP, and honor.</div>
            </div>
            <button
              className="btn btn-amber"
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={rerollMissionBoard}
              disabled={player.credits < 2000}
            >
              REFRESH 2,000cr
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {boardByCategory(activeTab).map((m: any) => renderMission(m))}
            {boardByCategory(activeTab).length === 0 && (
              <div className="text-mute text-sm italic col-span-3">No missions available. Try refreshing the board.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

'''

hcode = hcode[:start_idx] + new_missions_tab + hcode[end_idx:]
print("  -> Replaced MissionsTab with tabbed categories")

# Make sure useState is imported
if 'useState' not in hcode[:2000]:
    # Find react imports
    if 'useMemo' in hcode[:2000]:
        hcode = hcode.replace('useMemo', 'useMemo, useState', 1)
        print("  -> Added useState to imports")
    elif 'from "react"' in hcode[:2000]:
        hcode = hcode.replace('from "react"', '{ useState } from "react"', 1)
        print("  -> Added useState import")

# Make sure STATIONS is imported in Hangar
if 'STATIONS' not in hcode[:5000]:
    # Add to the types import line
    if 'QUEST_POOL' in hcode[:5000]:
        hcode = hcode.replace('QUEST_POOL', 'QUEST_POOL, STATIONS', 1)
        print("  -> Added STATIONS import")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

print("DONE!")
