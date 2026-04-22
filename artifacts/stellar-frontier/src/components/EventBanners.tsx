import { useGame } from "../game/store";

export function EventBanners() {
  const events = useGame((s) => s.events);
  if (events.length === 0) return null;
  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none" style={{ bottom: 156 }}>
      {events.slice(-2).map((ev) => {
        const a = Math.min(1, ev.ttl / 4);
        return (
          <div
            key={ev.id}
            className="panel px-2.5 py-1 text-center"
            style={{
              opacity: a,
              minWidth: 220,
              maxWidth: 320,
              borderColor: ev.color || "var(--accent-cyan)",
              boxShadow: `0 0 12px ${ev.color || "#4ee2ff"}44`,
            }}
          >
            <div
              className="font-bold tracking-[0.25em] text-[10px]"
              style={{ color: ev.color || "var(--accent-cyan)" }}
            >
              ◆ {ev.title}
            </div>
            <div className="text-dim text-[9px] mt-0.5 leading-tight">{ev.body}</div>
          </div>
        );
      })}
    </div>
  );
}
