import { useEffect, useRef, useState } from "react";
import { getVolume, getMuted, setVolume, setMuted } from "../game/sound";
import { state, bump, pushNotification } from "../game/store";

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

// options.png window (PNG GUI pack) — native 809x691, interior demo controls
// cleaned out (see options-window.png). All coordinates below are native px
// scaled by K. Baked art kept: OPTIONS title, close icon, SAVE / EXIT buttons.
const K = 680 / 809;
const W = 680;
const H = Math.round(691 * K);
const px = (n: number) => Math.round(n * K);

const AMBER = "#f7a832";
const AMBER_DIM = "#8a5c14";

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
        borderBottom: tab === t ? `2px solid ${AMBER}` : "2px solid transparent",
        fontSize: 12,
        letterSpacing: "0.18em",
        color: tab === t ? AMBER : AMBER_DIM,
        textShadow: tab === t ? `0 0 8px ${AMBER}88` : "none",
        transition: "color 0.12s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: "relative", width: W, height: H, filter: "drop-shadow(0 10px 40px rgba(0,0,0,0.8))" }}>
        <img
          src="/assets/ui/atlas/options-window.png"
          alt=""
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />

        {/* close — hotspot over the baked ⊘ icon */}
        <button
          onClick={onClose}
          title="Close (ESC)"
          style={{
            position: "absolute", left: px(665), top: px(39), width: px(38), height: px(38),
            background: "none", border: "none", cursor: "pointer", borderRadius: "50%",
            transition: "box-shadow 0.12s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px ${AMBER}aa`; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
        />

        {/* tabs at the top of the interior */}
        <div style={{ position: "absolute", left: px(150), top: px(162), width: px(510), display: "flex", justifyContent: "center", gap: 10 }}>
          {tabBtn("sound", "SOUND")}
          {tabBtn("graphics", "GRAPHICS")}
          {tabBtn("controls", "CONTROLS")}
        </div>

        {/* content area inside the thin orange frame */}
        <div
          style={{
            position: "absolute", left: px(165), top: px(215), width: px(480), height: px(320),
            display: "flex", flexDirection: "column", gap: px(26),
            fontFamily: "var(--font-display)", color: "#e8c890",
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
                        color: particles === level ? "#2b1c05" : AMBER_DIM,
                        background: particles === level ? `linear-gradient(180deg, #ffd062, ${AMBER})` : "rgba(247,168,50,0.06)",
                        border: `1px solid ${particles === level ? AMBER : "rgba(247,168,50,0.25)"}`,
                        boxShadow: particles === level ? `0 0 10px ${AMBER}66` : "none",
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
              {KEYBINDINGS.map(({ action, key }) => (
                <div
                  key={action}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "4px 10px",
                    background: "rgba(247,168,50,0.05)",
                    boxShadow: "inset 0 0 0 1px rgba(247,168,50,0.12)",
                  }}
                >
                  <span style={{ fontSize: 11, letterSpacing: "0.08em", color: "#d8b070" }}>{action.toUpperCase()}</span>
                  <span
                    style={{
                      fontSize: 10, color: AMBER, padding: "1px 10px",
                      background: "rgba(247,168,50,0.1)",
                      boxShadow: `inset 0 0 0 1px ${AMBER}44`,
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

        {/* SAVE / EXIT — hotspots over the baked buttons */}
        <BakedButton left={px(255)} top={px(578)} width={px(141)} height={px(78)} label="Save settings" onClick={onSave} />
        <BakedButton left={px(422)} top={px(578)} width={px(141)} height={px(78)} label="Close" onClick={onClose} />
      </div>
    </div>
  );
}

function SettingRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ width: 138, fontSize: 12, letterSpacing: "0.14em", color: AMBER, textShadow: `0 0 6px ${AMBER}55`, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>{children}</div>
      {value && (
        <span style={{ width: 44, textAlign: "right", fontSize: 12, color: "#ffd67a", flexShrink: 0 }} className="tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
}

/** DarkOrbit-style tick slider: ◄ segmented ticks ►, click/drag to set. */
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
        color: AMBER, fontSize: 13, lineHeight: 1, fontFamily: "var(--font-display)",
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
          background: ticks("rgba(247,168,50,0.16)"),
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0, width: `${v * 100}%`,
            background: ticks(AMBER),
            filter: `drop-shadow(0 0 3px ${AMBER})`,
          }}
        />
      </div>
      {arrow(1)}
    </div>
  );
}

/** Octagonal toggle in the style of the window's baked round buttons. */
function OctToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 30, height: 30, cursor: "pointer",
        clipPath: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
        border: "none",
        background: on
          ? `radial-gradient(circle at 50% 38%, #ffd062 0%, ${AMBER} 60%, #a06010 100%)`
          : "radial-gradient(circle at 50% 38%, #3a2a10 0%, #1a1206 70%)",
        boxShadow: on ? `0 0 14px ${AMBER}aa` : "inset 0 0 0 1px rgba(247,168,50,0.3)",
        transition: "background 0.15s, box-shadow 0.15s",
      }}
    />
  );
}

/** Invisible hotspot over a button baked into the window art. */
function BakedButton({ left, top, width, height, label, onClick }: {
  left: number; top: number; width: number; height: number; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        position: "absolute", left, top, width, height,
        background: "none", border: "none", cursor: "pointer",
        transition: "filter 0.1s, box-shadow 0.12s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `inset 0 0 18px ${AMBER}55`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    />
  );
}
