import { useEffect, useState } from "react";
import { getVolume, getMuted, setVolume, setMuted } from "../game/sound";
import { state, bump } from "../game/store";

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

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} style={{
      padding: "8px 18px", cursor: "pointer", fontFamily: "inherit",
      background: tab === t ? "rgba(68,238,204,0.12)" : "transparent",
      border: tab === t ? "1px solid rgba(68,238,204,0.4)" : "1px solid rgba(255,255,255,0.08)",
      borderRadius: "6px", fontSize: "13px", letterSpacing: "0.5px",
      color: tab === t ? "#44eecc" : "#777",
    }}>{label}</button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)", display: "flex",
      alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "linear-gradient(180deg, #0a0e14 0%, #131920 100%)",
        border: "1px solid rgba(68,238,204,0.25)", borderRadius: "12px",
        padding: "28px 32px", width: "440px",
        boxShadow: "0 0 60px rgba(68,238,204,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
        color: "#d0d8e0", fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#44eecc", letterSpacing: "2px" }}>SETTINGS</span>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#666", fontSize: "14px", cursor: "pointer", padding: "4px 10px",
            borderRadius: "6px", fontFamily: "inherit",
          }}>ESC</button>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {tabBtn("sound", "SOUND")}
          {tabBtn("graphics", "GRAPHICS")}
          {tabBtn("controls", "CONTROLS")}
        </div>

        {tab === "sound" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "13px" }}>Master Volume</span>
                <span style={{ fontSize: "13px", color: "#44eecc" }}>{Math.round(vol * 100)}%</span>
              </div>
              <input type="range" min="0" max="100" value={Math.round(vol * 100)}
                onChange={e => onVol(parseInt(e.target.value) / 100)}
                style={{ width: "100%", accentColor: "#44eecc", cursor: "pointer" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px" }}>Mute All Sounds</span>
              <button onClick={onMute} style={{
                width: "46px", height: "26px", borderRadius: "13px", border: "none", cursor: "pointer",
                background: muted ? "#44eecc" : "rgba(255,255,255,0.12)", position: "relative",
                transition: "background 0.2s",
              }}>
                <div style={{
                  width: "20px", height: "20px", borderRadius: "50%", background: "#fff",
                  position: "absolute", top: "3px", transition: "left 0.2s",
                  left: muted ? "23px" : "3px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                }} />
              </button>
            </div>
          </div>
        )}

        {tab === "graphics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "13px" }}>UI Scale</span>
                <span style={{ fontSize: "13px", color: "#44eecc" }}>{Math.round(uiScale * 100)}%</span>
              </div>
              <input type="range" min="70" max="140" value={Math.round(uiScale * 100)}
                onChange={e => onScale(parseInt(e.target.value) / 100)}
                style={{ width: "100%", accentColor: "#44eecc", cursor: "pointer" }} />
            </div>
            <div>
              <span style={{ fontSize: "13px", display: "block", marginBottom: "10px" }}>Particle Effects</span>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["low", "medium", "high"] as const).map(level => (
                  <button key={level} onClick={() => onParticles(level)} style={{
                    flex: 1, padding: "10px 0", cursor: "pointer", fontFamily: "inherit",
                    border: particles === level ? "1px solid rgba(68,238,204,0.45)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "6px",
                    background: particles === level ? "rgba(68,238,204,0.1)" : "rgba(255,255,255,0.02)",
                    color: particles === level ? "#44eecc" : "#666",
                    fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px",
                  }}>{level}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "controls" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {KEYBINDINGS.map(({ action, key }) => (
              <div key={action} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "9px 14px", borderRadius: "4px",
                background: "rgba(255,255,255,0.02)",
              }}>
                <span style={{ fontSize: "13px", color: "#bbb" }}>{action}</span>
                <span style={{
                  fontSize: "11px", color: "#44eecc", padding: "3px 12px",
                  background: "rgba(68,238,204,0.06)", borderRadius: "4px",
                  border: "1px solid rgba(68,238,204,0.15)", letterSpacing: "0.5px",
                  fontFamily: "monospace",
                }}>{key}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "24px", textAlign: "center", color: "#333", fontSize: "11px" }}>
          Press ESC to close
        </div>
      </div>
    </div>
  );
}
