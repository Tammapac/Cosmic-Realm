// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-11 ·
// SETTINGS section). Sidebar of 5 tabs (Graphics/Audio/Controls/Gameplay/
// Interface) + a SYSTEM info block, a content pane of setting rows
// (dropdown/slider/toggle/keybind), and a dirty-state footer (Discard /
// Apply — "NO CHANGES" when nothing is pending). Red accent, matching the
// Kit's own screenshot (distinct from Social's purple).
//
// Rows that already drove real behavior before this port (master volume,
// UI scale, particle density, control scheme) stay wired to the same game
// state/localStorage keys. Every other row is new surface from the Kit and
// is local-only (persisted to localStorage, no gameplay effect yet) until
// asked to wire up — same UI-first approach used for the Social panel port.
import { useEffect, useMemo, useState } from "react";
import { useGame, state as gameState, bump } from "../game/store";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";
import { setVolume } from "../game/sound";
import { getGpuName } from "../game/RendererSettings";


const ACCENT = "#ff4d5e";

function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255) + Math.round(255 * amt);
  let g = (n >> 8 & 255) + Math.round(255 * amt);
  let b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function rgbaHex(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

type Kind = "dropdown" | "slider" | "toggle" | "keybind";
type SettingDef = {
  key: string;
  label: string;
  desc: string;
  kind: Kind;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  fmt?: (v: number) => string;
};

const SECTIONS: { key: string; label: string; settings: SettingDef[] }[] = [
  {
    key: "graphics",
    label: "GRAPHICS",
    settings: [
      { key: "qualityPreset", label: "Quality preset", desc: "Applies a whole set of values at once.", kind: "dropdown", options: ["LOW", "MEDIUM", "HIGH", "ULTRA"] },
      { key: "resolution", label: "Resolution", desc: "Render target of the game window.", kind: "dropdown", options: ["1280 × 720", "1600 × 900", "1920 × 1080", "2560 × 1440"] },
      { key: "displayMode", label: "Display mode", desc: "Fullscreen releases the desktop compositor.", kind: "dropdown", options: ["WINDOWED", "BORDERLESS", "FULLSCREEN"] },
      { key: "textureQuality", label: "Texture quality", desc: "Hull, station and asteroid detail.", kind: "dropdown", options: ["LOW", "MEDIUM", "HIGH"] },
      { key: "shadowQuality", label: "Shadow quality", desc: "Costs the most on crowded stations.", kind: "dropdown", options: ["OFF", "LOW", "MEDIUM", "HIGH"] },
      { key: "renderScale", label: "Render scale", desc: "Draws below native and upscales; 100 is native.", kind: "slider", min: 50, max: 150, step: 5, unit: "%" },
      { key: "frameCap", label: "Frame cap", desc: "Zero lifts the cap entirely.", kind: "slider", min: 30, max: 240, step: 6, unit: " FPS" },
      { key: "particleDensity", label: "Particle density", desc: "Weapon trails, thruster wash, debris.", kind: "slider", min: 0, max: 100, step: 5, unit: "%" },
      { key: "bloom", label: "Bloom", desc: "Light bleed around emitters and stars.", kind: "toggle" },
      { key: "motionBlur", label: "Motion blur", desc: "Smears fast camera turns.", kind: "toggle" },
      { key: "vsync", label: "V-Sync", desc: "Locks the monitor and kills tearing.", kind: "toggle" },
    ],
  },
  {
    key: "audio",
    label: "AUDIO",
    settings: [
      { key: "masterVolume", label: "Master volume", desc: "Rides above every other bus.", kind: "slider", min: 0, max: 100, step: 5, unit: "%" },
      { key: "music", label: "Music", desc: "Score and station themes.", kind: "slider", min: 0, max: 100, step: 5, unit: "%" },
      { key: "effects", label: "Effects", desc: "Weapons, engines, impacts.", kind: "slider", min: 0, max: 100, step: 5, unit: "%" },
      { key: "voiceComms", label: "Voice comms", desc: "Party and clan channels.", kind: "slider", min: 0, max: 100, step: 5, unit: "%" },
      { key: "ambience", label: "Ambience", desc: "Hull hum, belt wind, station traffic.", kind: "slider", min: 0, max: 100, step: 5, unit: "%" },
      { key: "outputDevice", label: "Output device", desc: "Where the client sends audio.", kind: "dropdown", options: ["SYSTEM DEFAULT", "HEADSET", "SPEAKERS"] },
      { key: "muteWhenUnfocused", label: "Mute when unfocused", desc: "Silences the client in the background.", kind: "toggle" },
      { key: "combatWarnings", label: "Combat warnings", desc: "Lock-on and hull alarms cut through.", kind: "toggle" },
    ],
  },
  {
    key: "controls",
    label: "CONTROLS",
    settings: [
      { key: "primaryFire", label: "Primary fire", desc: "Fires the mounted weapon group.", kind: "keybind" },
      { key: "secondaryFire", label: "Secondary fire", desc: "Launches the ordnance in slot 2.", kind: "keybind" },
      { key: "afterburner", label: "Afterburner", desc: "Burns fuel for a speed window.", kind: "keybind" },
      { key: "inventory", label: "Inventory", desc: "Opens the cargo and gear panel.", kind: "keybind" },
      { key: "zoneMap", label: "Zone map", desc: "Opens the full scope.", kind: "keybind" },
      { key: "clanHall", label: "Clan hall", desc: "Opens the clan panel.", kind: "keybind" },
      { key: "mouseSensitivity", label: "Mouse sensitivity", desc: "Turn rate per centimeter of movement.", kind: "slider", min: 20, max: 200, step: 5, unit: "%" },
      { key: "invertVerticalAxis", label: "Invert vertical axis", desc: "Pull to climb.", kind: "toggle" },
      { key: "holdToFire", label: "Hold to fire", desc: "Off means every shot is a click.", kind: "toggle" },
    ],
  },
  {
    key: "gameplay",
    label: "GAMEPLAY",
    settings: [
      { key: "targetLock", label: "Target lock", desc: "How the reticle picks its target.", kind: "dropdown", options: ["NEAREST", "LOWEST HP", "LAST HIT", "MANUAL ONLY"] },
      { key: "chatFilter", label: "Chat filter", desc: "Language filter on public channels.", kind: "dropdown", options: ["OFF", "MILD", "STRICT"] },
      { key: "tooltipDelay", label: "Tooltip delay", desc: "Milliseconds before a tooltip opens.", kind: "slider", min: 0, max: 800, step: 50, unit: " MS" },
      { key: "damageNumbers", label: "Damage numbers", desc: "Floating numbers over every hit.", kind: "toggle" },
      { key: "autoRepairOnDock", label: "Auto repair on dock", desc: "Spends credits the moment you dock.", kind: "toggle" },
      { key: "pvpEntryWarning", label: "PvP entry warning", desc: "Asks before you cross into contested space.", kind: "toggle" },
    ],
  },
  {
    key: "interface",
    label: "INTERFACE",
    settings: [
      { key: "hudScale", label: "HUD scale", desc: "Size of every HUD element.", kind: "slider", min: 70, max: 130, step: 5, unit: "%" },
      { key: "chatOpacity", label: "Chat opacity", desc: "Background of the chat window.", kind: "slider", min: 0, max: 100, step: 5, unit: "%" },
      { key: "minimapSize", label: "Minimap size", desc: "Scope in the corner of the HUD.", kind: "dropdown", options: ["SMALL", "MEDIUM", "LARGE"] },
      { key: "colourblindMode", label: "Colourblind mode", desc: "Recolours rarity and threat marks.", kind: "dropdown", options: ["OFF", "PROTANOPIA", "DEUTERANOPIA", "TRITANOPIA"] },
      { key: "showPilotNames", label: "Show pilot names", desc: "Names over ships in space.", kind: "toggle" },
      { key: "scopeGrid", label: "Scope grid", desc: "Grid lines inside the minimap.", kind: "toggle" },
      { key: "contextualHints", label: "Contextual hints", desc: "Tips for systems you haven't used.", kind: "toggle" },
    ],
  },
];

const KEYBIND_DEFAULTS: Record<string, string> = {
  primaryFire: "MOUSE 1", secondaryFire: "MOUSE 2", afterburner: "SHIFT",
  inventory: "I", zoneMap: "M", clanHall: "G",
};

const DEFAULTS: Record<string, string | number | boolean> = {
  qualityPreset: "HIGH", resolution: "1920 × 1080", displayMode: "BORDERLESS", textureQuality: "HIGH", shadowQuality: "MEDIUM",
  renderScale: 100, frameCap: 144, particleDensity: 100, bloom: true, motionBlur: false, vsync: true,
  masterVolume: 80, music: 55, effects: 85, voiceComms: 70, ambience: 60, outputDevice: "SYSTEM DEFAULT", muteWhenUnfocused: true, combatWarnings: true,
  ...KEYBIND_DEFAULTS, mouseSensitivity: 100, invertVerticalAxis: false, holdToFire: true,
  targetLock: "NEAREST", chatFilter: "MILD", tooltipDelay: 250, damageNumbers: true, autoRepairOnDock: false, pvpEntryWarning: true,
  hudScale: 100, chatOpacity: 70, minimapSize: "MEDIUM", colourblindMode: "OFF", showPilotNames: true, scopeGrid: true, contextualHints: false,
};

const STORAGE_KEY = "cr-settings-v1";

// Only keep keys that still exist in DEFAULTS with a matching value type —
// drops stale/removed settings (e.g. autoLoot after it was cut) and null/
// corrupt entries from an earlier session instead of letting them silently
// clobber a sane default (this is how a slider ended up rendering empty:
// a leftover `renderScale: null` from mid-drag testing overrode 100).
function loadSaved(): Record<string, string | number | boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const clean: Record<string, string | number | boolean> = {};
    for (const key of Object.keys(DEFAULTS)) {
      const v = parsed[key];
      if (typeof v === typeof DEFAULTS[key]) clean[key] = v;
    }
    return clean;
  } catch { return {}; }
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { hover, handlers } = usePressable();
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "none", cursor: "pointer", textAlign: "left",
        fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.14em", fontWeight: 700,
        color: active ? "#fff2f3" : "rgba(226,236,250,.6)",
        background: active ? "linear-gradient(90deg,rgba(255,77,94,.28),rgba(6,5,8,.9))" : hover ? "rgba(255,77,94,.06)" : "linear-gradient(180deg,#160c0e,#0a0708)",
        boxShadow: active ? "inset 0 1px 0 rgba(255,224,228,.35),inset 0 -1px 0 rgba(0,0,0,.7),inset 3px 0 0 #ff4d5e" : "inset 0 1px 0 rgba(255,224,228,.05),inset 0 -1px 0 rgba(0,0,0,.7),inset 3px 0 0 transparent",
        transition: "background .16s ease,box-shadow .16s ease",
      }}
    >
      {label}
    </button>
  );
}

function DirtyDot() {
  return <i style={{ width: 5, height: 5, flex: "0 0 auto", borderRadius: "50%", background: "#ffb454", boxShadow: "0 0 7px #ffb454" }} />;
}

function Dropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const { hover, handlers } = usePressable();
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)} {...handlers}
        style={{
          display: "flex", alignItems: "center", gap: 10, minWidth: 168, padding: "7px 11px", border: "none", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em", color: "#f2d9db",
          background: "linear-gradient(180deg,#1c1012,#0c0708)",
          boxShadow: `inset 0 2px 5px rgba(0,0,0,.7),inset 0 0 0 1px ${hover || open ? rgbaHex(ACCENT, 0.45) : "rgba(0,0,0,.6)"},inset 0 -1px 0 rgba(255,150,160,.1)`,
        }}
      >
        <span style={{ flex: 1 }}>{value}</span>
        <span style={{ fontSize: 8, color: rgbaHex(ACCENT, 0.8), transform: open ? "rotate(180deg)" : "none", transition: "transform .14s ease" }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", zIndex: 5, top: "100%", left: 0, right: 0, marginTop: 3, padding: 3, display: "grid", gap: 2, background: "linear-gradient(180deg,#1c1012,#0c0708)", boxShadow: `inset 0 0 0 1px ${rgbaHex(ACCENT, 0.4)},0 8px 20px rgba(0,0,0,.6)` }}>
          {options.map((o) => (
            <button
              key={o} onClick={() => { onChange(o); setOpen(false); }}
              style={{
                padding: "6px 9px", border: "none", cursor: "pointer", textAlign: "left",
                fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.06em",
                color: o === value ? "#fff2f3" : "rgba(226,236,250,.7)",
                background: o === value ? rgbaHex(ACCENT, 0.18) : "transparent",
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Matches the Kit's I-11 slider: a thin dark track (~5px) filled with a red
// gradient bar, capped by a glossy highlight fused to the end of the fill
// (not a large freestanding ball). Fixed pixel width, not flex — the parent
// SettingRow's value column is `flex: "0 0 auto"`, so a flex:1 child here
// never actually gets room to grow and the whole track collapses to a few
// px (which is why this read as "just a dot" instead of a draggable bar).
// The hit target (a taller invisible padded strip) stays generous even
// though the visible track is thin, so it's still easy to grab.
function Slider({ value, min, max, step, unit, onChange }: { value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  const TRACK_W = 180;
  const TRACK_H = 5;
  const HANDLE = 14;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{ position: "relative", width: TRACK_W, height: 20, cursor: "pointer", display: "flex", alignItems: "center", touchAction: "none" }}
        onPointerDown={(e) => {
          const el = e.currentTarget;
          const setFrom = (clientX: number) => {
            const rect = el.getBoundingClientRect();
            const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const raw = min + t * (max - min);
            onChange(Math.round(raw / step) * step);
          };
          el.setPointerCapture(e.pointerId);
          setFrom(e.clientX);
          const move = (ev: PointerEvent) => setFrom(ev.clientX);
          const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, height: TRACK_H, background: "linear-gradient(180deg,#0c0708,#1a0f11)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.55)" }} />
        <div style={{ position: "absolute", left: 0, height: TRACK_H, width: `${pct}%`, background: `linear-gradient(90deg,${shadeHex(ACCENT, -0.15)},${ACCENT})`, boxShadow: `0 0 6px ${rgbaHex(ACCENT, 0.55)}` }} />
        <div style={{ position: "absolute", top: "50%", left: `${pct}%`, width: HANDLE, height: HANDLE, marginLeft: -HANDLE / 2, marginTop: -HANDLE / 2, borderRadius: "50%", background: "radial-gradient(circle at 34% 30%,#fff,#ffb4bb 42%,#c8303f 78%,#7a1420)", boxShadow: "0 1px 2px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.4)" }} />
      </div>
      <small style={{ width: 52, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "#f2d9db", flex: "0 0 auto" }}>{value}{unit}</small>
    </div>
  );
}

// Matches the Kit's I-11 toggle: a pill track with the ON/OFF word set
// into the dark side, and a chamfered color block (not a round knob) that
// sits on the other side — red block + "ON" on the left when on, grey
// block + "OFF" on the right when off.
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  const { hover, handlers } = usePressable();
  const chamfer = "polygon(6px 0,100% 0,100% 100%,0 100%,0 6px)";
  const chamferOff = "polygon(0 0,100% 0,100% 100%,6px 100%,0 calc(100% - 6px))";
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        position: "relative", width: 78, height: 24, padding: 0, border: "none", cursor: "pointer", overflow: "hidden",
        background: "linear-gradient(180deg,#1c1012,#0c0708)",
        boxShadow: `inset 0 2px 5px rgba(0,0,0,.7),inset 0 0 0 1px ${hover ? rgbaHex(ACCENT, 0.4) : "rgba(0,0,0,.6)"}`,
        filter: hover ? "brightness(1.08)" : "none",
        transition: "filter .12s ease",
      }}
    >
      <span style={{ position: "absolute", top: 0, bottom: 0, display: "flex", alignItems: "center", left: on ? 10 : "auto", right: on ? "auto" : 10, fontFamily: "var(--font-display)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: on ? "rgba(226,236,250,.35)" : "rgba(226,236,250,.7)" }}>
        {on ? "ON" : "OFF"}
      </span>
      <i style={{
        position: "absolute", top: 0, bottom: 0, width: 40,
        left: on ? "calc(100% - 40px)" : 0,
        background: on ? `linear-gradient(150deg,#ffb4bb,${ACCENT} 46%,#7a1420)` : "linear-gradient(150deg,#dbe6f5,#7d8a9c 46%,#2a323d)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 4px rgba(0,0,0,.3)",
        clipPath: on ? chamfer : chamferOff,
        transition: "left .15s cubic-bezier(.2,.9,.25,1)",
      }}>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: on ? "#3a060c" : "#0e141c" }}>
          {on ? "ON" : "OFF"}
        </span>
      </i>
    </button>
  );
}

function KeybindChip({ value, listening, onClick }: { value: string; listening: boolean; onClick: () => void }) {
  const { hover, handlers } = usePressable();
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        minWidth: 78, padding: "5px 12px", border: "none", cursor: "pointer",
        fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", fontWeight: 700,
        color: listening ? "#fff2f3" : "#dbe9fb",
        background: listening ? `linear-gradient(180deg,${shadeHex(ACCENT, 0.1)},${ACCENT})` : "linear-gradient(180deg,#151e2c,#0a0f18)",
        boxShadow: listening ? `inset 0 2px 5px rgba(0,0,0,.5),0 0 10px ${rgbaHex(ACCENT, 0.6)}` : `inset 0 2px 5px rgba(0,0,0,.7),inset 0 0 0 1px ${hover ? "rgba(120,150,190,.4)" : "rgba(0,0,0,.6)"}`,
        textAlign: "center",
      }}
    >
      {listening ? "PRESS A KEY…" : value}
    </button>
  );
}

// Chamfered rim + inset content plate + top spec-highlight line — the same
// recipe confirmed against the Kit for Social's ADD/INVITE/BLOCK buttons,
// applied here for DISCARD / APPLY / RESTORE DEFAULTS.
function ActionButton({ label, rim, plate, text, line, disabled, onClick }: { label: string; rim: [string, string, string]; plate: [string, string]; text: string; line: string; disabled?: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const [top, mid, bot] = rim;
  const [plateTop, plateBot] = plate;
  return (
    <button
      onClick={onClick} disabled={disabled} {...(disabled ? {} : handlers)}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        filter: active ? "brightness(1.3)" : hover ? "brightness(1.16)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: `linear-gradient(150deg,${top},${mid} 46%,${bot})`, clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", margin: 2, padding: "8px 18px", overflow: "hidden", background: `linear-gradient(180deg,${plateTop},${plateBot})`, color: text, fontFamily: "var(--font-display)", fontSize: 9.5, letterSpacing: "0.14em", fontWeight: 700, boxShadow: `inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 ${rgbaHex(line, 0.25)}`, clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)" }}>
        <i style={{ position: "absolute", left: 5, right: 5, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${rgbaHex(line, 0.6)},transparent)` }} />
        <span style={{ position: "relative" }}>{label}</span>
      </span>
    </button>
  );
}

function SettingRow({ def, value, dirty, listening, onChange, onKeybindClick }: {
  def: SettingDef; value: string | number | boolean; dirty: boolean; listening: boolean;
  onChange: (v: string | number | boolean) => void; onKeybindClick: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 10px", background: "rgba(255,77,94,.03)", boxShadow: "inset 0 0 0 1px rgba(255,77,94,.08)" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7 }}>
        {dirty && <DirtyDot />}
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <b style={{ fontSize: 11.5, fontWeight: 700, color: "#f2ecee" }}>{def.label}</b>
          <small style={{ fontSize: 9.5, color: "rgba(214,196,200,.55)" }}>{def.desc}</small>
        </div>
      </div>
      <div style={{ flex: "0 0 auto" }}>
        {def.kind === "dropdown" && <Dropdown value={value as string} options={def.options!} onChange={onChange} />}
        {def.kind === "slider" && <Slider value={value as number} min={def.min!} max={def.max!} step={def.step!} unit={def.unit!} onChange={onChange} />}
        {def.kind === "toggle" && <Toggle on={value as boolean} onClick={() => onChange(!value)} />}
        {def.kind === "keybind" && <KeybindChip value={value as string} listening={listening} onClick={onKeybindClick} />}
      </div>
    </div>
  );
}

export default function SettingsMenu({ onClose }: { onClose: () => void }) {
  const player = useGame((s) => s.player);
  const pingMs = useGame((s) => s.netPingMs);
  const gpuName = useMemo(() => getGpuName(), []);
  const [playToken] = useState(0);
  const [closing, setClosing] = useState(false);
  const [section, setSection] = useState("graphics");
  const [listeningKey, setListeningKey] = useState<string | null>(null);

  const saved = useMemo(() => ({ ...DEFAULTS, ...loadSaved() }), []);
  const [draft, setDraft] = useState<Record<string, string | number | boolean>>(saved);
  const [applied, setApplied] = useState<Record<string, string | number | boolean>>(saved);

  useEffect(() => {
    if (listeningKey === null) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === "Escape") { setListeningKey(null); return; }
      const label = e.code.startsWith("Key") ? e.code.slice(3) : e.code.startsWith("Digit") ? e.code.slice(5) : e.key.length === 1 ? e.key.toUpperCase() : e.key.toUpperCase();
      setDraft((d) => ({ ...d, [listeningKey]: label }));
      setListeningKey(null);
    };
    const click = (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      setDraft((d) => ({ ...d, [listeningKey]: e.button === 2 ? "MOUSE 2" : "MOUSE 1" }));
      setListeningKey(null);
    };
    window.addEventListener("keydown", h, true);
    window.addEventListener("mousedown", click, true);
    return () => { window.removeEventListener("keydown", h, true); window.removeEventListener("mousedown", click, true); };
  }, [listeningKey]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && listeningKey === null) { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose, listeningKey]);

  const dirtyKeys = useMemo(() => {
    const keys: string[] = [];
    for (const s of SECTIONS) for (const d of s.settings) if (draft[d.key] !== applied[d.key]) keys.push(d.key);
    return keys;
  }, [draft, applied]);

  // Live-wire the settings that already had real behavior before this port.
  const applyLive = (key: string, value: string | number | boolean) => {
    if (key === "masterVolume") { setVolume((value as number) / 100); }
    if (key === "hudScale") { gameState.uiScale = (value as number) / 100; bump(); }
    if (key === "particleDensity") { (window as any).__particleDensity = (value as number) / 100; }
  };

  const setValue = (key: string, value: string | number | boolean) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const onApply = () => {
    for (const key of dirtyKeys) applyLive(key, draft[key]);
    setApplied(draft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  };
  const onDiscard = () => setDraft(applied);
  const onRestoreDefaults = () => setDraft({ ...DEFAULTS });

  const close = () => { setClosing(true); };
  const onPortalClosed = () => onClose();

  const activeSection = SECTIONS.find((s) => s.key === section)!;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 64, paddingBottom: 32, overflowY: "auto", background: "rgba(12,2,4,.7)" }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <PrintPortal playToken={playToken} closing={closing} onClosed={onPortalClosed} accent={ACCENT} duration={1300} chamfer={34} style={{ width: "min(96vw, 900px)", flexShrink: 0 }}>
        <div style={{ position: "relative", padding: 18, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(10,2,3,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(255,77,94,.2))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: "#0d0405", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 0, display: "block", background: "rgba(255,77,94,.5)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "rgba(255,224,228,.6)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "rgba(10,2,3,.7)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "rgba(255,180,190,.4)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "rgba(10,2,3,.65)", clipPath: "polygon(0 0,calc(100% - 29.32px) 0,100% 29.32px,100% 100%,29.32px 100%,0 calc(100% - 29.32px))" }} />
          <i style={{ position: "absolute", left: 26, right: 48, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
          <i style={{ position: "absolute", left: 48, right: 26, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,180,190,.4),transparent)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 12, padding: "14px 15px 15px", overflow: "hidden", background: "linear-gradient(150deg,#2e1418,#0d0405)", boxShadow: "inset 0 5px 12px rgba(0,0,0,.6),inset 0 0 0 1px rgba(10,2,3,.6),inset 0 -2px 0 rgba(255,180,190,.18)", clipPath: "polygon(0 0,calc(100% - 23.47px) 0,100% 23.47px,100% 100%,23.47px 100%,0 calc(100% - 23.47px))" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0 1px 10px", borderBottom: "1px solid rgba(0,0,0,.55)" }}>
              <i style={{ width: 7, height: 7, flex: "0 0 auto", background: ACCENT, boxShadow: `0 0 10px ${ACCENT}`, transform: "rotate(45deg)" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.24em", color: "#ffe6e8" }}>SETTINGS</b>
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.1em", color: "rgba(240,206,210,.8)" }}>
                CLIENT 4.2.1 · PROFILE {(player?.name ?? "PILOT").toUpperCase()}
              </small>
              <span style={{ flex: 1 }} />
              <CloseButton onClick={close} title="Close" size={24} fontSize={10} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "212px 1fr", gap: 12, alignItems: "stretch" }}>
              <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 9, padding: "16px 14px", maxHeight: 476, border: "2px solid rgba(255,77,94,.5)", background: "linear-gradient(150deg,#2e1418,#0d0405)", boxShadow: "inset 0 0 0 2px rgba(255,224,228,.6),inset 0 0 0 4px rgba(10,2,3,.7),inset 0 0 0 6px rgba(255,180,190,.4),inset 0 0 0 8px rgba(10,2,3,.65),inset 0 0 0 10px rgba(176,52,72,.3),inset 0 0 0 12px rgba(10,2,3,.6),inset 0 0 0 14px rgba(86,32,42,.25),inset 0 0 0 16px rgba(10,2,3,.55)" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  {SECTIONS.map((s) => (
                    <TabButton key={s.key} label={s.label} active={section === s.key} onClick={() => setSection(s.key)} />
                  ))}
                </div>

                <div style={{ minHeight: 0 }} />

                <div style={{ display: "grid", gap: 6, padding: "10px 11px 11px", minWidth: 0, background: "linear-gradient(180deg,#1c1012,#0a0708)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,180,190,.12)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                  <small style={{ fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.22em", color: "rgba(226,236,250,.55)", marginBottom: 2 }}>SYSTEM</small>
                  {[
                    ["CLIENT", "4.2.1"],
                    ["RENDERER", "WEBGL2"],
                    ["GPU", gpuName ?? "UNKNOWN"],
                    ["PING", pingMs != null ? `${pingMs} MS` : "— MS"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: "var(--font-mono)", fontSize: 9.5 }}>
                      <span style={{ color: "rgba(214,196,200,.6)", flex: "0 0 auto" }}>{k}</span>
                      <span style={{ color: "#dbe9fb", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v}>{v}</span>
                    </div>
                  ))}
                </div>

                <ActionButton label="RESTORE DEFAULTS" rim={["#dbe6f5", "#7d8a9c", "#2a323d"]} plate={["#1b232e", "#080c12"]} text="#dbe9fb" line="#ebf5ff" onClick={onRestoreDefaults} />
              </div>

              <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 9, padding: "16px 14px", border: "2px solid rgba(255,77,94,.5)", background: "linear-gradient(150deg,#2e1418,#0d0405)", boxShadow: "inset 0 0 0 2px rgba(255,224,228,.6),inset 0 0 0 4px rgba(10,2,3,.7),inset 0 0 0 6px rgba(255,180,190,.4),inset 0 0 0 8px rgba(10,2,3,.65),inset 0 0 0 10px rgba(176,52,72,.3),inset 0 0 0 12px rgba(10,2,3,.6),inset 0 0 0 14px rgba(86,32,42,.25),inset 0 0 0 16px rgba(10,2,3,.55)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: "1px solid rgba(0,0,0,.55)" }}>
                  <i style={{ width: 5, height: 5, background: ACCENT, boxShadow: `0 0 8px ${ACCENT}`, transform: "rotate(45deg)" }} />
                  <b style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.2em", color: "#ffe6e8" }}>{activeSection.label}</b>
                  <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "rgba(214,196,200,.6)" }}>{activeSection.settings.length} SETTINGS</small>
                </div>

                <div style={{ display: "grid", gap: 3, alignContent: "start", overflowY: "auto", minHeight: 300, maxHeight: 400 }}>
                  {activeSection.settings.map((def) => (
                    <SettingRow
                      key={def.key} def={def} value={draft[def.key]} dirty={draft[def.key] !== applied[def.key]}
                      listening={listeningKey === def.key}
                      onChange={(v) => setValue(def.key, v)}
                      onKeybindClick={() => setListeningKey(def.key)}
                    />
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
                  <ActionButton label="DISCARD" rim={["#dbe6f5", "#7d8a9c", "#2a323d"]} plate={["#1b232e", "#080c12"]} text="#dbe9fb" line="#ebf5ff" disabled={dirtyKeys.length === 0} onClick={onDiscard} />
                  <ActionButton label={dirtyKeys.length > 0 ? `APPLY (${dirtyKeys.length})` : "NO CHANGES"} rim={["#ffb4bb", ACCENT, "#7a1420"]} plate={dirtyKeys.length ? [shadeHex(ACCENT, 0.1), ACCENT] : ["#1b232e", "#080c12"]} text={dirtyKeys.length ? "#fff2f3" : "rgba(226,236,250,.5)"} line="#ffe6e8" disabled={dirtyKeys.length === 0} onClick={onApply} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </PrintPortal>
    </div>
  );
}
