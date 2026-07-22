import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useDraggable } from "./useDraggable";
import { useGame, state, bump } from "../game/store";
import { ENEMY_DEFS, ZONES } from "../game/types";

const TYPE_GLYPHS: Record<string, string> = {
  scout:     "◇",
  raider:    "◈",
  destroyer: "⬡",
  voidling:  "✦",
  dread:     "☠",
};

// HUD accent (was amber #f7a832 in the old art-window skin)
const AMBER = "#4ee2ff";

// Fallbacks for missing mission data — never render black/empty placeholders.
const titleOf = (q: any): string =>
  (typeof q?.title === "string" && q.title.trim()) || "Unbenannte Mission";
const descOf = (q: any): string =>
  (typeof q?.description === "string" && q.description.trim()) ||
  "Für diese Mission liegen keine weiteren Details vor.";
const categoryOf = (q: any): string =>
  (typeof q?.category === "string" && q.category.trim()) || "Allgemein";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

// Tech-font quest title in the style of PNG GUI/Quests/questexample.png:
// centered uppercase, orange glow, thin separator line underneath, and
// ▮▮▮ tick marks flanking the highlighted entry.
function QuestRow({
  q, highlighted, onClick, size = 10.5,
}: { q: any; highlighted?: boolean; onClick?: () => void; size?: number }) {
  const done = q.completed;
  const color = done ? "#7dff9c" : AMBER;
  const goal = Math.max(0, q.killCount ?? 0);
  const cur = Math.min(Math.max(0, q.progress ?? 0), goal);
  const count = goal > 0 ? `${cur}/${goal}` : "—";
  return (
    <div className="q-row" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className="flex items-center justify-center gap-2" style={{ padding: "4px 2px 3px" }}>
        {highlighted && <span className="q-ticks" />}
        <span
          className="truncate"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: size,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color,
            textShadow: `0 0 7px ${color}99, 0 0 2px ${color}`,
            fontWeight: highlighted ? 700 : 400,
            maxWidth: "78%",
          }}
          title={`${titleOf(q)}\n${descOf(q)}\nPROGRESS ${count}${q.completed ? " · COMPLETE" : ""}\nREWARDS: ${(q.rewardCredits ?? 0).toLocaleString()} CR · ${q.rewardExp ?? 0} XP · ${q.rewardHonor ?? 0} HONOR`}
        >
          {done ? "✓ " : ""}{titleOf(q)}
        </span>
        <span
          className="tabular-nums shrink-0"
          style={{ fontFamily: "var(--font-display)", fontSize: size - 2, color: `${color}cc` }}
        >
          {count}
        </span>
        {highlighted && <span className="q-ticks" />}
      </div>
      <div className="q-line" />
    </div>
  );
}

export function QuestTracker() {
  const activeQuests = useGame((s) => s.player.activeQuests);
  const docked = useGame((s) => s.dockedAt);
  const showJournal = useGame((s) => s.showJournal);
  const showTracker = useGame((s) => s.showQuestTracker);

  return (
    <>
      {!docked && showTracker && activeQuests.length > 0 && <TrackerPanel quests={activeQuests.slice(0, 7)} />}
      {showJournal && <JournalWindow />}
    </>
  );
}

function TrackerPanel({ quests }: { quests: any[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useDraggable("quest-tracker");
  const open = (id: string) => {
    state.journalQuestId = id;
    state.showJournal = true;
    bump();
  };
  // HUD plate (hotbar/minimap reference language) instead of the baked
  // quest-window.png art: cyan ring, cut corners, title band, scanlines.
  return (
    <div
      className="hud-plate absolute z-30 pointer-events-none"
      style={{ top: 104, right: 8, width: 300, maxHeight: 380, display: "flex", flexDirection: "column", ...drag.style }}
    >
      <div className="hud-titleband pointer-events-auto" onPointerDown={drag.handleProps.onPointerDown} style={drag.handleProps.style}>Quests</div>
      <div
        className="overflow-y-auto pointer-events-auto"
        style={{ padding: "6px 8px", minHeight: 0 }}
      >
        {quests.map((q) => (
          <div key={q.id} onMouseEnter={() => setHovered(q.id)} onMouseLeave={() => setHovered(null)}>
            <QuestRow q={q} highlighted={hovered === q.id} onClick={() => open(q.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Full journal popup (journal.png) — left index selects, detail pane right.
// Plate geometry measured directly in the rendered atlas (898x553), both axes
// confirmed by contiguous-run scans: 12 plates, first at y=111, pitch 29.55,
// height 24.5, x 112..270 (w=158).
const PLATE_TOP = 111 / 553;
const PLATE_PITCH = 29.55 / 553;
const PLATE_H = 24.5 / 553;
const PLATE_LEFT = 112 / 898;
const PLATE_W = 158 / 898;

function JournalWindow() {
  const activeQuests = useGame((s) => s.player.activeQuests);
  const storeSel = useGame((s) => s.journalQuestId);
  const [localSel, setLocalSel] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const maxOffset = Math.max(0, activeQuests.length - 12);
  const off = Math.min(offset, maxOffset);
  const quests = activeQuests.slice(off, off + 12);
  const selId = localSel ?? storeSel;
  // Resolve the selection against the LIVE list. If the chosen mission was
  // completed/turned-in/deleted (or the id is invalid), fall back to the
  // first valid mission so the detail pane never goes blank.
  const selected = activeQuests.find((q) => q.id === selId) ?? activeQuests[0] ?? null;

  // Reconcile the persisted selection whenever the mission list changes: if
  // the selected id no longer exists, auto-pick the first valid mission (or
  // clear when the list is empty). Runs after accept/complete/reload.
  useEffect(() => {
    const exists = selId != null && activeQuests.some((q) => q.id === selId);
    if (exists) return;
    const next = activeQuests[0]?.id ?? null;
    if (localSel !== null) setLocalSel(next);
    if (storeSel !== next) { state.journalQuestId = next; }
  }, [activeQuests, selId, localSel, storeSel]);

  const close = () => { state.showJournal = false; state.journalQuestId = null; bump(); };
  const drag = useDraggable("journal");

  // HUD framed window (reference language) instead of the baked journal.png
  // art. Two columns: quest list left (natural scrolling replaces the art's
  // baked arrow triangles), detail + reward right. All logic unchanged.
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.55)", pointerEvents: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="panel" style={{ width: 880, height: 540, maxWidth: "96vw", maxHeight: "92vh", display: "flex", flexDirection: "column", ...drag.style }}>
        <div className="hud-titleband" onPointerDown={drag.handleProps.onPointerDown} style={{ fontSize: 14, letterSpacing: "0.35em", padding: "8px 14px", ...drag.handleProps.style }}>
          <span style={{ flex: 1 }}>Journal</span>
          <button className="gbtn gbtn-red" style={{ padding: "2px 10px", fontSize: 11 }} onClick={close}>✕</button>
        </div>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* quest index — natural scrolling replaces the art's baked arrows */}
          <div style={{ width: 240, flexShrink: 0, overflowY: "auto", padding: "8px 6px 8px 10px", borderRight: "1px solid rgba(90,130,180,0.25)" }}>
            {activeQuests.map((q) => {
              const sel = selected && q.id === selected.id;
              const locked = q.locked === true;
              const cls = [
                "j-row",
                sel ? "j-row--sel" : "",
                q.completed ? "j-row--done" : "",
                locked ? "j-row--locked" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={q.id}
                  onClick={() => setLocalSel(q.id)}
                  className={cls}
                  title={titleOf(q)}
                  style={{
                    position: "relative", display: "block", width: "100%", minHeight: 26,
                    marginBottom: 4, textAlign: "left", padding: "4px 8px",
                  }}
                >
                  <span className="truncate" style={{ display: "block", maxWidth: "100%" }}>
                    {q.completed ? "✓ " : ""}{titleOf(q)}
                  </span>
                </button>
              );
            })}
          </div>
          {/* detail pane */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "10px 14px" }}>
            {selected && (
              <div
                className="text-center truncate"
                style={{
                  fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700,
                  letterSpacing: "0.22em", textTransform: "uppercase",
                  color: AMBER, textShadow: `0 0 8px ${AMBER}aa, 0 0 2px ${AMBER}`,
                  paddingBottom: 6, borderBottom: "1px solid rgba(78,226,255,0.25)",
                }}
              >
                {titleOf(selected)}
              </div>
            )}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 2px" }}>
              {selected ? (
                <DetailPane q={selected} />
              ) : (
                <div style={{ color: `${AMBER}cc`, fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.06em", padding: 8, textShadow: `0 0 6px ${AMBER}66` }}>
                  ACCEPT BOUNTIES AND MISSIONS AT ANY STATION, THEN TRACK THEM HERE.
                </div>
              )}
            </div>
            {selected && (
              <div style={{ flexShrink: 0, borderTop: "1px solid rgba(78,226,255,0.25)", paddingTop: 8 }}>
                <div
                  className="text-center"
                  style={{
                    fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700,
                    letterSpacing: "0.3em", color: AMBER,
                    textShadow: `0 0 8px ${AMBER}aa`, marginBottom: 6,
                  }}
                >
                  REWARD
                </div>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <RewardCell label="CREDITS" value={fmtNum(selected.rewardCredits)} />
                  <RewardCell label="HONOR" value={fmtNum(selected.rewardHonor)} />
                  <RewardCell label="TIER" value={`${selected.tier ?? 1}`} />
                  <RewardCell label="XP" value={fmtNum(selected.rewardExp)} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailPane({ q }: { q: any }) {
  const goal = Math.max(0, q.killCount ?? 0);
  const cur = Math.min(Math.max(0, q.progress ?? 0), goal);
  const pct = goal > 0 ? Math.min(1, cur / goal) : 0;
  const done = q.completed;
  const zoneName = (ZONES as any)[q.zone]?.name ?? q.zone ?? "";
  const zoneLabel = (ZONES as any)[q.zone]?.label ?? "";
  const body: CSSProperties = {
    color: `${AMBER}dd`,
    fontFamily: "var(--font-display)",
    fontSize: 10.5,
    letterSpacing: "0.05em",
    lineHeight: 1.7,
    textTransform: "uppercase",
    textShadow: `0 0 6px ${AMBER}55`,
  };
  return (
    <div style={{ paddingRight: 8, paddingTop: 2 }}>
      <div style={body}>
        SECTOR [{categoryOf(q)}]{zoneLabel ? ` ${zoneLabel}` : ""}{zoneName ? ` ${zoneName}` : ""} —{" "}
        TARGET: {(ENEMY_DEFS[q.killType]?.name ?? q.killType ?? "—")}{goal > 0 ? ` × ${goal}` : ""} · PROGRESS {goal > 0 ? `${cur}/${goal}` : "—"}
        {done && <span style={{ color: "#7dff9c", textShadow: "0 0 6px #7dff9c88" }}> · ✓ READY TO TURN IN</span>}
      </div>
      <div className="overflow-hidden" style={{ height: 5, background: "rgba(78,226,255,0.12)", margin: "8px 0 10px" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: done ? "#7dff9c" : AMBER, boxShadow: `0 0 6px ${done ? "#7dff9c" : AMBER}88` }} />
      </div>
      <div style={body}>{descOf(q)}</div>
    </div>
  );
}

// Glowing reward readout, journalexample style: "CREDITS 3000" inline
function RewardCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 flex items-baseline justify-center gap-1 min-w-0" title={`${label} ${value}`}>
      <span
        className="shrink-0"
        style={{
          fontSize: 9, letterSpacing: "0.12em", color: `${AMBER}bb`,
          fontFamily: "var(--font-display)", fontWeight: 700, textShadow: `0 0 5px ${AMBER}66`,
        }}
      >
        {label}
      </span>
      <span
        className="tabular-nums font-bold truncate"
        style={{
          fontSize: 14, color: AMBER, minWidth: 0,
          fontFamily: "var(--font-display)", textShadow: `0 0 9px ${AMBER}99, 0 0 2px ${AMBER}`,
        }}
      >
        {value}
      </span>
    </div>
  );
}
