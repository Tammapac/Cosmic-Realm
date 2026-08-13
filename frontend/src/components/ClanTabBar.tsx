// Small tab strip shown in both ClanDirectoryPanel and ClanHallPanel headers
// once the player has a clan, letting them switch between the two without
// closing and reopening the window. Not part of the Kit export (the Kit
// treats I-07/I-08 as separate standalone screens) — this is the minimum
// UI needed to satisfy "tabs between directory and hall" while keeping both
// panels' Kit-accurate internals untouched.
import { state as gameState, bump } from "../game/store";
import { usePressable } from "./hud/usePressable";

const ACCENT = "#b866ff";

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  return (
    <button
      onClick={onClick} aria-label={`Switch to ${label}`} aria-pressed={active} {...handlers}
      style={{
        position: "relative", padding: "4px 10px", border: "none", cursor: active ? "default" : "pointer",
        fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.16em",
        color: active ? "#eddcff" : "rgba(214,200,242,.5)",
        background: active ? `${ACCENT}2a` : "rgba(255,255,255,.03)",
        boxShadow: active ? `inset 0 0 0 1px ${ACCENT}88` : "inset 0 0 0 1px rgba(255,255,255,.06)",
        clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)",
        transform: pressed ? "translateY(1px)" : hover && !active ? "translateY(-2px)" : "none",
        transition: "transform .13s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      {label}
    </button>
  );
}

export function ClanTabBar({ active }: { active: "directory" | "hall" }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <Tab label="DIRECTORY" active={active === "directory"} onClick={() => { gameState.clanTab = "directory"; bump(); }} />
      <Tab label="HALL" active={active === "hall"} onClick={() => { gameState.clanTab = "hall"; bump(); }} />
    </div>
  );
}
