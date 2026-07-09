import { useState } from "react";
import type { CSSProperties } from "react";
import { useGame, state, bump } from "../game/store";
import { ENEMY_DEFS, ZONES } from "../game/types";

const TYPE_GLYPHS: Record<string, string> = {
  scout:     "◇",
  raider:    "◈",
  destroyer: "⬡",
  voidling:  "✦",
  dread:     "☠",
};

const AMBER = "#f7a832";

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
  const count = `${Math.min(q.progress, q.killCount)}/${q.killCount}`;
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
          title={`${q.title} — ${count}`}
        >
          {done ? "✓ " : ""}{q.title}
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
  const open = (id: string) => {
    state.journalQuestId = id;
    state.showJournal = true;
    bump();
  };
  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{ top: 104, right: 8, width: 338, height: 406, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.6))" }}
    >
      <img
        src="/assets/ui/atlas/quest-window.png"
        alt=""
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />
      {/* glass title */}
      <div
        className="absolute text-center"
        style={{
          left: "18%", right: "18%", top: "4.4%",
          fontFamily: "var(--font-display)",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.3em",
          color: "#3a2504",
          textShadow: "0 1px 0 rgba(255,235,190,0.6)",
        }}
      >
        QUESTS
      </div>
      {/* quest title list, questexample style */}
      <div
        className="absolute overflow-y-auto pointer-events-auto"
        style={{ left: "14%", right: "14%", top: "19%", bottom: "11%", paddingRight: 2 }}
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
  const selected = activeQuests.find((q) => q.id === selId) ?? quests[0] ?? null;

  const close = () => { state.showJournal = false; state.journalQuestId = null; bump(); };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.55)", pointerEvents: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div style={{ position: "relative", width: 898, height: 553, maxWidth: "96vw", filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.8))" }}>
        <img
          src="/assets/ui/atlas/journal.png"
          alt=""
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />
        <div
          className="absolute text-center"
          style={{
            left: "28%", right: "28%", top: "3.2%",
            fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700,
            letterSpacing: "0.42em", color: "#ffffff",
            textShadow: "0 0 3px rgba(58,37,4,0.9), 1px 1px 0 #3a2504, -1px -1px 0 #3a250466, 0 0 10px rgba(255,255,255,0.35)",
          }}
        >
          JOURNAL
        </div>
        <button
          onClick={close}
          title="Close"
          className="j-close"
          style={{
            position: "absolute",
            left: "86.3%",
            top: "10.5%",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "none",
            border: "none",
            cursor: "pointer",
            zIndex: 2,
          }}
        />
        {/* left index — rows positioned exactly on the art's baked plates */}
        {Array.from({ length: 12 }).map((_, i) => {
          const q = quests[i];
          if (!q) return null;
          const sel = selected && q.id === selected.id;
          return (
            <button
              key={q.id}
              onClick={() => setLocalSel(q.id)}
              className={`j-row ${sel ? "j-row--sel" : ""}`}
              title={q.title}
              style={{
                position: "absolute",
                left: `${PLATE_LEFT * 100}%`,
                width: `${PLATE_W * 100}%`,
                top: `${(PLATE_TOP + i * PLATE_PITCH) * 100}%`,
                height: `${PLATE_H * 100}%`,
                color: q.completed && !sel ? "#1d4d24" : undefined,
              }}
            >
              {/* inner span truncates so the row itself never clips the wing caps */}
              <span className="truncate" style={{ display: "block", maxWidth: "100%" }}>
                {q.completed ? "✓ " : ""}{q.title}
              </span>
            </button>
          );
        })}

        {/* scroll arrows on the art's baked ▲ / ▽ triangles */}
        {off > 0 && (
          <button
            onClick={() => setOffset(Math.max(0, off - 1))}
            title="Scroll up"
            className="absolute"
            style={{ left: "17.5%", width: "8%", top: "12.6%", height: "6%", background: "none", border: "none", cursor: "pointer" }}
          />
        )}
        {off < maxOffset && (
          <button
            onClick={() => setOffset(Math.min(maxOffset, off + 1))}
            title="Scroll down"
            className="absolute"
            style={{ left: "17.5%", width: "8%", top: "85.6%", height: "6.5%", background: "none", border: "none", cursor: "pointer" }}
          />
        )}

        {/* detail title on the baked tick-strip header line */}
        {selected && (
          <div
            className="absolute text-center truncate"
            style={{
              left: "45%", right: "25%", top: "20.6%",
              fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700,
              letterSpacing: "0.22em", textTransform: "uppercase",
              color: AMBER, textShadow: `0 0 8px ${AMBER}aa, 0 0 2px ${AMBER}`,
            }}
          >
            {selected.title}
          </div>
        )}

        {/* glowing body text */}
        <div className="absolute" style={{ left: "37.5%", right: "10.5%", top: "26%", bottom: "36%", overflowY: "auto" }}>
          {selected ? (
            <DetailPane q={selected} />
          ) : (
            <div style={{ color: `${AMBER}cc`, fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.06em", padding: 8, textShadow: `0 0 6px ${AMBER}66` }}>
              ACCEPT BOUNTIES AND MISSIONS AT ANY STATION, THEN TRACK THEM HERE.
            </div>
          )}
        </div>

        {/* REWARD header on the lower tick-strip line + values in the bottom box */}
        {selected && (
          <>
            <div
              className="absolute text-center"
              style={{
                left: "45%", right: "25%", top: "67.6%",
                fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700,
                letterSpacing: "0.3em", color: AMBER,
                textShadow: `0 0 8px ${AMBER}aa, 0 0 2px ${AMBER}`,
              }}
            >
              REWARD
            </div>
            {/* dark cover hides the art's baked icon sockets */}
            <div
              className="absolute"
              style={{ left: "38.5%", right: "13%", top: "72.8%", height: "13.2%", background: "#0c0904" }}
            />
            <div
              className="absolute flex items-center"
              style={{ left: "38.5%", right: "13%", top: "72.8%", height: "13.2%", gap: "1%", padding: "0 1.5%" }}
            >
              <RewardCell label="CREDITS" value={fmtNum(selected.rewardCredits)} />
              <RewardCell label="HONOR" value={fmtNum(selected.rewardHonor)} />
              <RewardCell label="TIER" value={`${selected.tier ?? 1}`} />
              <RewardCell label="XP" value={fmtNum(selected.rewardExp)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetailPane({ q }: { q: any }) {
  const pct = Math.min(1, q.progress / q.killCount);
  const done = q.completed;
  const zoneName = (ZONES as any)[q.zone]?.name ?? q.zone;
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
        {zoneLabel && `SECTOR [${zoneLabel}] ${zoneName} — `}
        TARGET: {(ENEMY_DEFS[q.killType]?.name ?? q.killType)} × {q.killCount} · PROGRESS {Math.min(q.progress, q.killCount)}/{q.killCount}
        {done && <span style={{ color: "#7dff9c", textShadow: "0 0 6px #7dff9c88" }}> · ✓ READY TO TURN IN</span>}
      </div>
      <div className="overflow-hidden" style={{ height: 5, background: "rgba(247,168,50,0.12)", margin: "8px 0 10px" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: done ? "#7dff9c" : AMBER, boxShadow: `0 0 6px ${done ? "#7dff9c" : AMBER}88` }} />
      </div>
      <div style={body}>{q.description}</div>
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
