import { useEffect, useRef, useState } from "react";
import { useDraggable } from "./useDraggable";
import { getVolume, getMuted, setVolume, setMuted } from "../game/sound";
import { state, bump, pushNotification } from "../game/store";

const KEYBINDINGS_WASD = [
  { action: "Thrust (toward cursor)", key: "W" },
  { action: "Reverse", key: "S" },
  { action: "Strafe Left / Right", key: "A / D" },
  { action: "Aim (free fire direction)", key: "Cursor" },
  { action: "Fire Lasers (hold)", key: "Left Click" },
  { action: "Fire Rockets (hold)", key: "Right Click" },
  { action: "Toggle Laser", key: "1" },
  { action: "Toggle Rockets", key: "2" },
  { action: "Consumables", key: "3 - 9" },
  { action: "Dock / Afterburner", key: "Space" },
  { action: "Galaxy Map", key: "M" },
  { action: "Clan Panel", key: "C" },
  { action: "Social Panel", key: "H" },
  { action: "Minimap Zoom +/-", key: "+ / -" },
  { action: "Settings", key: "ESC" },
];

const KEYBINDINGS = [
  { action: "Move Ship", key: "Left Click" },
  { action: "Attack / Lock Target", key: "Double Click" },
  { action: "Toggle Laser", key: "1" },
  { action: "Toggle Rockets", key: "2" },
  { action: "Consumables", key: "3 - 9" },
  { action: "Dock / Afterburner", key: "Space" },
  { action: "Galaxy Map", key: "M" },
  { action: "Clan Panel", key: "C" },
  { action: "Social Panel", key: "H" },
  { action: "Minimap Zoom +/-", key: "+ / -" },
  { action: "Settings", key: "ESC" },
];

// HUD accent (hud_preview reference) — the old options-window.png art skin
// used amber #f7a832; the window is now a native HUD panel.
const ACCENT = "#4ee2ff";
const ACCENT_DIM = "#3d7f99";

export default function SettingsMenu({ onClose }: { onClose: () => void }) {
  const [vol, setVol] = useState(() => getVolume());
  const [muted, setMut] = useState(() => getMuted());
  const [uiScale, setUiScale] = useState(() => {
    const s = localStorage.getItem("sf-ui-scale");
    return s ? parseFloat(s) : 1;
  });
  const [particles, setParticles] = useState(() => {
    return localStorage.getItem("sf-particles") || "high";
  });
  const [tab, setTab] = useState<"sound" | "graphics" | "controls">("sound");
  const [controlMode, setControlMode] = useState<"mouse" | "wasd">(() => state.controlMode);
  const drag = useDraggable("settings");

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose]);

  const onVol = (v: number) => { setVol(v); setVolume(v); };
  const onMute = () => { const m = !muted; setMut(m); setMuted(m); };
  const onScale = (v: number) => {
    setUiScale(v);
    localStorage.setItem("sf-ui-scale", String(v));
    state.uiScale = v;
    bump();
  };
  const onParticles = (level: string) => {
    setParticles(level);
    localStorage.setItem("sf-particles", level);
    (window as any).__particleDensity = level === "low" ? 0.3 : level === "medium" ? 0.6 : 1;
  };
  const onSave = () => { pushNotification("Settings saved", "good"); onClose(); };
  const onControlMode = (m: "mouse" | "wasd") => {
    setControlMode(m);
    state.controlMode = m;
    localStorage.setItem("cr-control-mode", m);
    bump();
  };

  const tabBtn = (t: typeof tab, label: string) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      style={{
        padding: "5px 16px",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        background: "transparent",
        border: "none",
        borderBottom: tab === t ? `2px solid ${ACCENT}` : "2px solid transparent",
        fontSize: 12,
        letterSpacing: "0.18em",
        color: tab === t ? ACCENT : ACCENT_DIM,
        textShadow: tab === t ? `0 0 8px ${ACCENT}88` : "none",
        transition: "color 0.12s",
      }}
    >
      {label}
    </button>
  );

  // HUD framed window (reference language): title band + tab row + content
  // + real SAVE/EXIT buttons. All settings logic unchanged.
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel" style={{ width: 620, maxWidth: "94vw", maxHeight: "88vh", display: "flex", flexDirection: "column", ...drag.style }}>
        <div className="hud-titleband" onPointerDown={drag.handleProps.onPointerDown} style={{ fontSize: 13, letterSpacing: "0.32em", padding: "8px 12px", ...drag.handleProps.style }}>
          <span style={{ flex: 1 }}>Options</span>
          <button className="gbtn gbtn-red" style={{ padding: "1px 8px", fontSize: 10 }} onClick={onClose} title="Close (ESC)">✕</button>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "8px 12px 0" }}>
          {tabBtn("sound", "SOUND")}
          {tabBtn("graphics", "GRAPHICS")}
          {tabBtn("controls", "CONTROLS")}
        </div>

        {/* content */}
        <div
          style={{
            padding: "18px 24px", minHeight: 240,
            display: "flex", flexDirection: "column", gap: 22,
            fontFamily: "var(--font-display)", color: "#b8d8f0",
            overflowY: tab === "controls" ? "auto" : "visible",
          }}
        >
          {tab === "sound" && (
            <>
              <SettingRow label="MASTER VOLUME" value={`${Math.round(vol * 100)}%`}>
                <TickSlider value={vol} onChange={onVol} />
              </SettingRow>
              <SettingRow label="MUTE ALL" value={muted ? "ON" : "OFF"}>
                <OctToggle on={muted} onClick={onMute} />
              </SettingRow>
            </>
          )}

          {tab === "graphics" && (
            <>
              <SettingRow label="UI SCALE" value={`${Math.round(uiScale * 100)}%`}>
                <TickSlider value={(uiScale - 0.4) / 1.0} onChange={(v) => onScale(Math.round((0.4 + v * 1.0) * 20) / 20)} />
              </SettingRow>
              <SettingRow label="PARTICLES" value="">
                <div style={{ display: "flex", gap: 8 }}>
                  {(["low", "medium", "high"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => onParticles(level)}
                      style={{
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontFamily: "var(--font-display)",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: particles === level ? "#06222e" : ACCENT_DIM,
                        background: particles === level ? `linear-gradient(180deg, #9fe8ff, ${ACCENT})` : "rgba(78,226,255,0.06)",
                        border: `1px solid ${particles === level ? ACCENT : "rgba(78,226,255,0.25)"}`,
                        boxShadow: particles === level ? `0 0 10px ${ACCENT}66` : "none",
                        fontWeight: particles === level ? 700 : 400,
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </SettingRow>
            </>
          )}

          {tab === "controls" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingRight: 6 }}>
              {/* Control scheme picker */}
              <div
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 10px", marginBottom: 6,
                  background: "rgba(78,226,255,0.08)",
                  boxShadow: "inset 0 0 0 1px rgba(78,226,255,0.2)",
                }}
              >
                <span style={{ fontSize: 11, letterSpacing: "0.08em", color: "#b8d8f0" }}>CONTROL SCHEME</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {([["mouse", "MOUSE"], ["wasd", "WASD"]] as const).map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => onControlMode(m)}
                      style={{
                        padding: "4px 12px", cursor: "pointer",
                        fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.12em",
                        background: controlMode === m ? "rgba(78,226,255,0.18)" : "transparent",
                        border: "none",
                        boxShadow: controlMode === m ? `inset 0 0 0 1px ${ACCENT}` : "inset 0 0 0 1px rgba(78,226,255,0.25)",
                        color: controlMode === m ? ACCENT : ACCENT_DIM,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {(controlMode === "wasd" ? KEYBINDINGS_WASD : KEYBINDINGS).map(({ action, key }) => (
                <div
                  key={action}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "4px 10px",
                    background: "rgba(78,226,255,0.05)",
                    boxShadow: "inset 0 0 0 1px rgba(78,226,255,0.12)",
                  }}
                >
                  <span style={{ fontSize: 11, letterSpacing: "0.08em", color: "#b8d8f0" }}>{action.toUpperCase()}</span>
                  <span
                    style={{
                      fontSize: 10, color: ACCENT, padding: "1px 10px",
                      background: "rgba(78,226,255,0.1)",
                      boxShadow: `inset 0 0 0 1px ${ACCENT}44`,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {key}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SAVE / EXIT */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, padding: "4px 12px 14px" }}>
          <button className="gbtn gbtn-gold" style={{ padding: "7px 26px", fontSize: 12 }} onClick={onSave}>SAVE</button>
          <button className="gbtn" style={{ padding: "7px 26px", fontSize: 12 }} onClick={onClose}>EXIT</button>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 138, fontSize: 12, letterSpacing: "0.14em", color: ACCENT, textShadow: `0 0 6px ${ACCENT}55`, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>{children}</div>
      {value && (
        <span style={{ width: 44, textAlign: "right", fontSize: 12, color: "#dff6ff", flexShrink: 0 }} className="tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
}

/** Segmented tick slider: ◄ ticks ►, click/drag to set. */
function TickSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const v = Math.max(0, Math.min(1, value));
  const ticks = (c: string) => `repeating-linear-gradient(90deg, ${c} 0px, ${c} 4px, transparent 4px, transparent 7px)`;

  const setFromEvent = (clientX: number) => {
    const el = barRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onChange(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => { if (dragging.current) setFromEvent(e.clientX); };
    const up = () => { dragging.current = false; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  const arrow = (dir: -1 | 1) => (
    <button
      onClick={() => onChange(Math.max(0, Math.min(1, v + dir * 0.05)))}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: "0 4px",
        color: ACCENT, fontSize: 13, lineHeight: 1, fontFamily: "var(--font-display)",
      }}
    >
      {dir < 0 ? "◄" : "►"}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
      {arrow(-1)}
      <div
        ref={barRef}
        onPointerDown={(e) => { dragging.current = true; setFromEvent(e.clientX); }}
        style={{
          position: "relative", flex: 1, height: 18, cursor: "pointer",
          background: ticks("rgba(78,226,255,0.16)"),
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0, width: `${v * 100}%`,
            background: ticks(ACCENT),
            filter: `drop-shadow(0 0 3px ${ACCENT})`,
          }}
        />
      </div>
      {arrow(1)}
    </div>
  );
}

/** Octagonal toggle in the HUD accent. */
function OctToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 30, height: 30, cursor: "pointer",
        clipPath: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
        border: "none",
        background: on
          ? `radial-gradient(circle at 50% 38%, #9fe8ff 0%, ${ACCENT} 60%, #1a5e78 100%)`
          : "radial-gradient(circle at 50% 38%, #10283e 0%, #081420 70%)",
        boxShadow: on ? `0 0 14px ${ACCENT}aa` : "inset 0 0 0 1px rgba(78,226,255,0.3)",
        transition: "background 0.15s, box-shadow 0.15s",
      }}
    />
  );
}
