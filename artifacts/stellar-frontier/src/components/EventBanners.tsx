import { useGame } from "../game/store";

export function EventBanners() {
  const events = useGame((s) => s.events);
  if (events.length === 0) return null;
  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">
      {events.slice(-3).map((ev) => {
        const a = Math.min(1, ev.ttl / 4);
        return (
          <div
            key={ev.id}
            className="panel px-4 py-2 text-center"
            style={{
              opacity: a,
              minWidth: 320,
              borderColor: ev.color || "var(--accent-cyan)",
              boxShadow: `0 0 24px ${ev.color || "#4ee2ff"}55`,
            }}
          >
            <div
              className="font-bold tracking-[0.3em] text-xs"
              style={{ color: ev.color || "var(--accent-cyan)" }}
            >
              ◆ {ev.title}
            </div>
            <div className="text-dim text-[10px] mt-0.5">{ev.body}</div>
          </div>
        );
      })}
    </div>
  );
}
