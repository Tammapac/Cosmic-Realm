import { useGame } from "../game/store";

export function EventBanners() {
  const events = useGame((s) => s.events);
  if (events.length === 0) return null;
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none"
      style={{ bottom: 158 }}
    >
      {events.slice(-2).map((ev) => {
        const a = Math.min(1, ev.ttl / 4);
        const accentColor = ev.color || "var(--accent-cyan)";
        return (
          <div
            key={ev.id}
            className="panel px-3 py-1.5 text-center"
            style={{
              opacity: a,
              minWidth: 200,
              maxWidth: 340,
              borderColor: accentColor,
              boxShadow: `0 0 14px ${ev.color || "#4ee2ff"}33, 0 2px 8px rgba(0,0,0,0.6)`,
              transition: "opacity 0.3s",
            }}
          >
            <div
              className="font-bold tracking-widest whitespace-nowrap overflow-hidden"
              style={{
                color: accentColor,
                fontSize: 11.8,
                letterSpacing: "0.22em",
                textOverflow: "ellipsis",
              }}
            >
              ◆ {ev.title}
            </div>
            <div
              className="mt-0.5 leading-snug"
              style={{ color: "var(--text-dim)", fontSize: 10.6 }}
            >
              {ev.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}
