// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-09 ·
// CREATE A CLAN section — HTML template ~line 3444-3646, real behavior in
// the app's JS state builder ~line 5453-5598) — "charter form · live crest
// preview · every field validated before the ledger clears".
//
// This is a faithful port of the Kit's ACTUAL data, not a reduced guess:
// 27 crest shapes (CF_SHAPE), 57 symbols (CF_SYM), 32 palette colors
// (CF_PAL), 8 recruiting focuses (CF_FOCUS), and the exact validation rules
// (tag 3-4 chars, 1-3 recruiting tags REQUIRED, admission open/apply/invite,
// min level in steps of 5 from 0-60). Band/face crest gradients are derived
// from a single "outer colour" via shadeHex(), matching the Kit's own
// cfBand/cfFace formulas — see backend/src/game/clanData.ts for the same
// constants and shading function, kept in sync so the live preview here
// matches what the server actually stores and every other panel renders.
import { useState } from "react";
import { useGame, state as gameState, bump } from "../game/store";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";
import { createClan } from "../net/api";
import type { ClanAdmission } from "../game/types";

const ACCENT = "#b866ff";
const KEYFRAMES = `
@keyframes cfPulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes cfSweep{0%{left:-45%}100%{left:115%}}
@keyframes cfTip{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
`;

const CREATE_COST = 250000;

// Verbatim from the Kit's CF_SHAPE array (Cosmic Kit.dc.html ~line 7002).
const CF_SHAPE: [string, string][] = [
  ["hex", "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)"],
  ["flat", "polygon(26% 0,74% 0,100% 50%,74% 100%,26% 100%,0 50%)"],
  ["shield", "polygon(6% 0,94% 0,100% 62%,50% 100%,0 62%)"],
  ["kite", "polygon(50% 0,100% 50%,50% 100%,0 50%)"],
  ["oct", "polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)"],
  ["cut", "polygon(0 0,72% 0,100% 28%,100% 100%,28% 100%,0 72%)"],
  ["blade", "polygon(50% 0,100% 22%,86% 100%,14% 100%,0 22%)"],
  ["arrow", "polygon(50% 0,100% 34%,82% 100%,18% 100%,0 34%)"],
  ["star", "polygon(50% 0,62% 34%,98% 36%,70% 58%,80% 96%,50% 74%,20% 96%,30% 58%,2% 36%,38% 34%)"],
  ["cross", "polygon(34% 0,66% 0,66% 34%,100% 34%,100% 66%,66% 66%,66% 100%,34% 100%,34% 66%,0 66%,0 34%,34% 34%)"],
  ["disc", "circle(50% at 50% 50%)"],
  ["chev", "polygon(50% 0,100% 30%,100% 100%,50% 72%,0 100%,0 30%)"],
  ["pent", "polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)"],
  ["banner", "polygon(0 0,100% 0,100% 78%,50% 100%,0 78%)"],
  ["spade", "polygon(50% 0,100% 44%,74% 100%,26% 100%,0 44%)"],
  ["gem", "polygon(28% 0,72% 0,100% 34%,50% 100%,0 34%)"],
  ["tri", "polygon(50% 4%,100% 96%,0 96%)"],
  ["rune", "polygon(18% 0,82% 0,100% 22%,82% 100%,18% 100%,0 22%)"],
  ["visor", "polygon(0 18%,100% 18%,100% 62%,50% 100%,0 62%)"],
  ["wedge", "polygon(0 0,100% 0,74% 100%,26% 100%)"],
  ["fang", "polygon(50% 0,100% 30%,100% 70%,50% 100%,0 100%,0 0)"],
  ["prism", "polygon(50% 0,94% 25%,94% 75%,50% 100%,6% 75%,6% 25%)"],
  ["slab", "polygon(12% 0,88% 0,100% 14%,100% 86%,88% 100%,12% 100%,0 86%,0 14%)"],
  ["talon", "polygon(50% 0,100% 18%,88% 72%,50% 100%,12% 72%,0 18%)"],
  ["ward", "polygon(50% 0,100% 20%,100% 60%,50% 100%,0 60%,0 20%)"],
  ["pylon", "polygon(34% 0,66% 0,100% 26%,100% 74%,66% 100%,34% 100%,0 74%,0 26%)"],
  ["comet", "polygon(50% 0,100% 40%,72% 100%,28% 100%,0 40%)"],
  ["orb", "circle(46% at 50% 50%)"],
];
const clipOf = (k: string) => (CF_SHAPE.find((p) => p[0] === k) ?? CF_SHAPE[0])[1];

// Verbatim from the Kit's CF_SYM array.
const CF_SYM = ["★", "✦", "☾", "⚔", "⛨", "✧", "☢", "✵", "⌘", "☠", "⚑", "♆", "⌬", "✜", "❂", "⟁", "◈", "⚙", "⚕", "☄", "✹", "⌖", "⏣", "⎔", "⨂", "⩊", "⟠", "⧗", "☗", "⚛", "➶", "♜", "☫", "⌁", "⍟", "⧉", "⚜", "☬", "✠", "♁", "⟴", "⌭", "⎈", "⏧", "✺", "⟡", "♞", "☤", "⚝", "⩩", "⧨", "♅", "⌇", "⏥", "☸", "✥"];

// Verbatim from the Kit's CF_PAL array.
const CF_PAL = [
  "#b866ff", "#4ee2ff", "#5cff8a", "#e8b94d", "#ff4d5e", "#ff5cf0", "#ff8c4d", "#9fb6d4",
  "#7d5cff", "#00d4a8", "#c8ff5c", "#ffd166", "#ff6f91", "#8affff", "#f2f7ff", "#5b6675",
  "#ff2e63", "#00ffc8", "#ffe14d", "#5c8cff", "#d94dff", "#7cff4d", "#ff9ecb", "#2a3140",
  "#c9a227", "#00a3ff", "#a8ff3d", "#ff5722", "#9d4edd", "#38e8b0", "#e6e6fa", "#101722",
];

// Verbatim from the Kit's CF_FOCUS array.
const CF_FOCUS = ["SECTOR WAR", "BOUNTY", "MINING", "SALVAGE", "EXPLORATION", "DUNGEONS", "TRADE", "ESCORT"];

// Same integer-shift shading as the Kit's shadeHex() — derives band/face
// gradient stops from the single "outer colour" pick.
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

const ADMISSIONS: { key: ClanAdmission; label: string }[] = [
  { key: "open", label: "OPEN" },
  { key: "apply", label: "APPLY" },
  { key: "invite", label: "INVITE" },
];

function fieldWrap(): React.CSSProperties {
  return {
    position: "relative", display: "grid", gap: 5, padding: "11px 12px 12px",
    background: "linear-gradient(180deg,#141020,#06050c)",
    boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(201,168,255,.14)",
    clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))",
  };
}
const fieldLabel: React.CSSProperties = { flex: 1, fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" };
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "none", outline: "none",
  fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.04em", color: "#f2f7ff",
  background: "linear-gradient(180deg,#0a0810,#040309)",
  boxShadow: "inset 0 3px 6px rgba(0,0,0,.8),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -1px 0 rgba(201,168,255,.16)",
};

type PickerKind = "shape" | "symbol" | "color";

function CrestPicker({ label, kind, value, onPick, options, previewColor }: {
  label: string; kind: PickerKind; value: string; onPick: (v: string) => void; options: string[]; previewColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const { hover, active, handlers } = usePressable();
  return (
    <div style={{ position: "relative", display: "grid", gap: 6, alignContent: "start", padding: "9px 9px 10px", zIndex: open ? 9 : 5, background: "linear-gradient(180deg,#141020,#06050c)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(201,168,255,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
      <small style={{ fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>{label}</small>
      <button
        onClick={() => setOpen((v) => !v)} aria-label={`Choose ${label.toLowerCase()}`} {...handlers}
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "6px 7px", border: "none", cursor: "pointer",
          background: open ? `linear-gradient(180deg,${rgbaHex(ACCENT, 0.28)},rgba(6,5,12,.92))` : "linear-gradient(180deg,#1c1729,#0a0812)",
          boxShadow: "inset 0 1px 0 rgba(220,238,255,.08),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 3px 6px rgba(0,0,0,.5)",
          clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
          transform: active ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
          transition: "transform .13s cubic-bezier(.2,.9,.25,1),filter .16s ease",
        }}
      >
        <i style={{
          position: "relative", display: "grid", placeItems: "center", width: 26, height: 26, flex: "0 0 auto",
          background: kind === "shape" ? `linear-gradient(150deg,${shadeHex(previewColor ?? value, 0.35)},${shadeHex(previewColor ?? value, -0.28)} 58%,${shadeHex(previewColor ?? value, -0.6)})`
            : kind === "color" ? `linear-gradient(150deg,${shadeHex(value, 0.35)},${shadeHex(value, -0.28)} 58%,${shadeHex(value, -0.6)})`
            : "linear-gradient(180deg,#0a0810,#040309)",
          clipPath: kind === "shape" ? clipOf(value) : kind === "color" ? "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" : "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)",
          fontStyle: "normal", fontSize: 15, color: kind === "symbol" ? (previewColor ?? "#eddcff") : "transparent",
        }}>{kind === "symbol" ? value : ""}</i>
        <small style={{ position: "relative", flex: 1, minWidth: 0, textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 9.4, letterSpacing: "0.03em", color: "rgba(226,236,250,.85)" }}>
          {kind === "color" || kind === "shape" ? (kind === "shape" ? value.toUpperCase() : value.toUpperCase()) : "SELECT"}
        </small>
        <i style={{ position: "relative", fontStyle: "normal", fontSize: 9, color: "rgba(201,168,255,.8)", transform: `rotate(${open ? 180 : 0}deg)`, transition: "transform .18s cubic-bezier(.2,.9,.25,1)" }}>▾</i>
      </button>
      {open && (
        <div style={{
          position: "relative", display: "flex", flexWrap: "wrap", gap: 4, width: "100%", maxHeight: 196, overflowY: "auto",
          padding: 8, boxSizing: "border-box", zIndex: 30,
          background: "linear-gradient(180deg,#171226,#08060e)",
          boxShadow: "inset 0 3px 7px rgba(0,0,0,.8),inset 0 0 0 1px rgba(0,0,0,.7),inset 0 1px 0 rgba(226,200,255,.16),inset 0 -1px 0 rgba(184,102,255,.3)",
          clipPath: "polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))",
          animation: "cfTip .16s cubic-bezier(.2,.9,.25,1) both",
        }}>
          {options.map((opt) => {
            const isOn = opt === value;
            const swatchColor = kind === "shape" ? (previewColor ?? "#7d8a9c") : opt;
            return (
              <button
                key={opt} onClick={() => { onPick(opt); setOpen(false); }} aria-label={`${label} option ${opt}`} title={opt}
                style={{
                  position: "relative", display: "grid", placeItems: "center", width: 30, height: 30, padding: 0, border: "none", cursor: "pointer",
                  background: isOn ? `linear-gradient(180deg,${rgbaHex(ACCENT, 0.32)},rgba(6,5,12,.92))` : "linear-gradient(180deg,#1a1626,#0a0812)",
                  boxShadow: isOn ? `inset 0 1px 0 ${rgbaHex(ACCENT, 0.5)},inset 0 -1px 0 rgba(0,0,0,.7)` : "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.7)",
                  clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)",
                }}
              >
                <i style={{
                  display: "grid", placeItems: "center", width: 25, height: 25,
                  background: kind === "symbol" ? "linear-gradient(180deg,#0c0a14,#050409)" : `linear-gradient(150deg,${shadeHex(swatchColor, 0.35)},${shadeHex(swatchColor, -0.28)} 58%,${shadeHex(swatchColor, -0.6)})`,
                  clipPath: kind === "shape" ? opt && CF_SHAPE.find((s) => s[0] === opt)?.[1] : "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)",
                  fontStyle: "normal", fontSize: 15, lineHeight: 1, color: kind === "symbol" ? (opt === value ? (previewColor ?? "#eddcff") : "rgba(206,222,246,.65)") : "transparent",
                }}>{kind === "symbol" ? opt : ""}</i>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateButton({ disabled, label, onClick }: { disabled: boolean; label: string; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={label} {...(disabled ? {} : handlers)}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: disabled ? "default" : "pointer",
        filter: disabled ? "grayscale(.6) brightness(.7)" : active ? "brightness(1.32)" : hover ? "brightness(1.14)" : "none",
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#f7ecd0,#c9a34e 44%,#5c4318)", clipPath: "polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(150deg,#d9b463,#4a3413 58%,#241a09)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: 3, padding: "10px 12px", overflow: "hidden", background: "linear-gradient(180deg,#3a2c10,#150f05)", color: "#ffeec2", fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.18em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,226,160,.25)", clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }}>
        <i style={{ position: "absolute", left: 7, right: 7, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,244,214,.7),transparent)" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(232,185,77,.8),transparent)", opacity: 0.75 }} />
        {!disabled && <i style={{ position: "absolute", top: 0, left: "-45%", width: "30%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(255,244,214,.4),transparent)", transform: "skewX(-18deg)", animation: "cfSweep 3.2s ease-in-out infinite" }} />}
        <i style={{ position: "relative", fontStyle: "normal", fontSize: 11 }}>✦</i>
        <span style={{ position: "relative" }}>{label}</span>
      </span>
    </button>
  );
}

function ClearButton({ onClick }: { onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      onClick={onClick} aria-label="Clear the charter form" {...handlers}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer",
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        filter: active ? "brightness(1.3)" : hover ? "brightness(1.14)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#dbe6f5,#7d8a9c 44%,#2a323d)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", margin: 2.5, padding: "7px 6px", overflow: "hidden", background: "linear-gradient(180deg,#1b232e,#080c12)", color: "#dbe9fb", fontFamily: "var(--font-display)", fontSize: 8.5, letterSpacing: "0.16em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.2)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
        <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(235,245,255,.55),transparent)" }} />
        <span style={{ position: "relative" }}>CLEAR FORM</span>
      </span>
    </button>
  );
}

const DEFAULT_MIN_LVL = 20;

export function ClanCreatePanel({ onClose, onCreated }: { onClose: () => void; onCreated: (name: string, id: number) => void }) {
  const player = useGame((s) => s.player);
  const [playToken, setPlayToken] = useState(0);

  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [motto, setMotto] = useState("");
  const [shape, setShape] = useState("hex");
  const [symbol, setSymbol] = useState(CF_SYM[0]);
  const [outer, setOuter] = useState(CF_PAL[0]);
  const [inner, setInner] = useState<string | null>(null); // null = derive from outer, matches Kit default
  const [symHex, setSymHex] = useState<string | null>(null); // null = "#f2f7ff" default
  const [admission, setAdmission] = useState<ClanAdmission>("apply");
  const [minLevel, setMinLevel] = useState(DEFAULT_MIN_LVL);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  const effectiveInner = inner ?? shadeHex(outer, -0.35);
  const effectiveSymHex = symHex ?? "#f2f7ff";

  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 3 ? [...prev, t] : prev));

  const reset = () => {
    setName(""); setTag(""); setMotto(""); setTags([]);
    setOuter(CF_PAL[0]); setShape("hex"); setSymbol(CF_SYM[0]);
    setInner(null); setSymHex(null); setAdmission("apply"); setMinLevel(DEFAULT_MIN_LVL);
    setToast(null);
    setPlayToken((t) => t + 1);
  };

  const clean = name.trim();
  const nameOk = clean.length >= 3 && clean.length <= 24;
  const tagOk = /^[A-Z0-9]{3,4}$/.test(tag.toUpperCase());
  const tagsOk = tags.length >= 1 && tags.length <= 3;
  const fundsOk = player.credits >= CREATE_COST;
  const allOk = nameOk && tagOk && tagsOk && fundsOk;
  const doneCount = [nameOk, tagOk, tagsOk, fundsOk].filter(Boolean).length;

  const checks = [
    { k: "Clan name, 3–24 characters", ok: nameOk },
    { k: "Tag, 3–4 letters or digits", ok: tagOk },
    { k: "One to three recruiting tags", ok: tagsOk },
    { k: `Filing fee of ${CREATE_COST.toLocaleString()} credits`, ok: fundsOk },
  ];

  const submit = async () => {
    if (!allOk || busy) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await createClan(clean, tag.trim().toUpperCase(), {
        motto: motto.trim(), tags, minLevel, admission,
        crestShape: shape, crestSymbol: symbol, crestOuter: outer, crestInner: effectiveInner, crestSymbolColor: effectiveSymHex,
      });
      gameState.player.credits = res.credits ?? gameState.player.credits - CREATE_COST;
      onCreated(res.clan.name, res.clan.id);
    } catch (e: any) {
      setToast({ text: e.message || "Failed to create clan.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  const bandGrad = `linear-gradient(150deg,${shadeHex(outer, 0.4)},${shadeHex(outer, -0.3)} 52%,${shadeHex(outer, -0.66)})`;
  const faceGrad = `radial-gradient(circle at 50% 32%,${rgbaHex(effectiveInner, 0.6)},#07050d 78%)`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(2,4,12,.82)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{KEYFRAMES}</style>
      <PrintPortal playToken={playToken} accent={ACCENT} duration={1300} chamfer={34} style={{ width: "min(96vw, 1180px)" }}>
        <div style={{ position: "relative", padding: 18, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(184,102,255,.18))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: "#05070d", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 0, display: "block", background: "rgba(184,102,255,.5)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "rgba(243,232,255,.65)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "rgba(5,3,10,.7)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "rgba(201,168,255,.45)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "rgba(5,3,10,.65)", clipPath: "polygon(0 0,calc(100% - 29.32px) 0,100% 29.32px,100% 100%,29.32px 100%,0 calc(100% - 29.32px))" }} />
          <i style={{ position: "absolute", inset: 10, display: "block", background: "rgba(126,72,176,.3)", clipPath: "polygon(0 0,calc(100% - 28.15px) 0,100% 28.15px,100% 100%,28.15px 100%,0 calc(100% - 28.15px))" }} />
          <i style={{ position: "absolute", inset: 12, display: "block", background: "rgba(5,3,10,.6)", clipPath: "polygon(0 0,calc(100% - 26.98px) 0,100% 26.98px,100% 100%,26.98px 100%,0 calc(100% - 26.98px))" }} />
          <i style={{ position: "absolute", inset: 14, display: "block", background: "rgba(62,32,86,.25)", clipPath: "polygon(0 0,calc(100% - 25.81px) 0,100% 25.81px,100% 100%,25.81px 100%,0 calc(100% - 25.81px))" }} />
          <i style={{ position: "absolute", inset: 16, display: "block", background: "rgba(5,3,10,.55)", clipPath: "polygon(0 0,calc(100% - 24.64px) 0,100% 24.64px,100% 100%,24.64px 100%,0 calc(100% - 24.64px))" }} />

          <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 12, padding: "14px 15px 15px", overflow: "hidden", background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 5px 12px rgba(0,0,0,.6),inset 0 0 0 1px rgba(5,3,10,.6),inset 0 -2px 0 rgba(201,168,255,.2)", clipPath: "polygon(0 0,calc(100% - 23.47px) 0,100% 23.47px,100% 100%,23.47px 100%,0 calc(100% - 23.47px))" }}>
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.04) 11px 12px,transparent 12px 23px)", pointerEvents: "none" }} />

            {/* header */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0 1px 10px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(201,168,255,.14)" }}>
              <i style={{ width: 7, height: 7, flex: "0 0 auto", background: ACCENT, boxShadow: `0 0 10px ${ACCENT}`, transform: "rotate(45deg)", animation: "cfPulse 1.9s ease-in-out infinite" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 14.2, letterSpacing: "0.24em", color: "#eddcff" }}>CREATE A CLAN</b>
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, letterSpacing: "0.1em", color: "rgba(214,200,242,.72)" }}>CHARTER FILING · SECTOR REGISTRY</small>
              <span style={{ flex: 1 }} />
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 12.4, letterSpacing: "0.08em", color: allOk ? "#7cffb0" : "rgba(201,168,255,.8)" }}>{doneCount} / 4 CLEARED</small>
              <CloseButton onClick={onClose} title="Close" size={24} fontSize={10} />
            </div>

            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 344px", gap: 14, alignItems: "stretch" }}>

              {/* left — form */}
              <div style={{ position: "relative", display: "grid", gap: 10, alignContent: "start", padding: "22px 20px", border: `2px solid ${ACCENT}80`, background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 0 0 2px rgba(243,232,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(201,168,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(126,72,176,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(62,32,86,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>

                <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 132px", gap: 9 }}>
                  <div style={fieldWrap()}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <small style={fieldLabel}>CLAN NAME</small>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.4, color: nameOk ? "#7cffb0" : "rgba(190,214,236,.5)" }}>{clean.length}/24</small>
                    </div>
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Name your charter" aria-label="Clan name" style={inputStyle} />
                  </div>
                  <div style={fieldWrap()}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <small style={fieldLabel}>TAG</small>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.4, color: tagOk ? "#7cffb0" : "rgba(190,214,236,.5)" }}>3–4</small>
                    </div>
                    <input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))} maxLength={4} placeholder="ABC" aria-label="Clan tag" style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.24em", fontFamily: "var(--font-display)", fontSize: 13 }} />
                  </div>
                </div>

                <div style={fieldWrap()}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <small style={fieldLabel}>MOTTO</small>
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.4, color: "rgba(190,214,236,.5)" }}>{64 - motto.length} LEFT</small>
                  </div>
                  <input value={motto} onChange={(e) => setMotto(e.target.value)} maxLength={64} placeholder="One line your recruits will read first" aria-label="Clan motto" style={{ ...inputStyle, fontSize: 11 }} />
                </div>

                <div style={{ position: "relative", zIndex: 5, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7, alignItems: "start" }}>
                  <CrestPicker label="CREST SHAPE" kind="shape" value={shape} onPick={setShape} options={CF_SHAPE.map(([k]) => k)} previewColor={outer} />
                  <CrestPicker label="CREST SYMBOL" kind="symbol" value={symbol} onPick={setSymbol} options={CF_SYM} previewColor={effectiveSymHex} />
                  <CrestPicker label="OUTER COLOUR" kind="color" value={outer} onPick={setOuter} options={CF_PAL} />
                  <CrestPicker label="INNER COLOUR" kind="color" value={effectiveInner} onPick={setInner} options={CF_PAL} />
                  <CrestPicker label="SYMBOL COLOUR" kind="color" value={effectiveSymHex} onPick={setSymHex} options={CF_PAL} />
                </div>

                <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 176px", gap: 9 }}>
                  <div style={fieldWrap()}>
                    <small style={fieldLabel}>ADMISSION</small>
                    <div style={{ display: "flex", gap: 6 }}>
                      {ADMISSIONS.map((a) => (
                        <button
                          key={a.key} onClick={() => setAdmission(a.key)} aria-label={`Admission: ${a.label.toLowerCase()}`}
                          style={{
                            flex: 1, position: "relative", padding: "6px 0", border: "none", cursor: "pointer",
                            fontFamily: "var(--font-display)", fontSize: 6.5, letterSpacing: "0.14em",
                            color: admission === a.key ? "#f4ecff" : "rgba(206,222,246,.55)",
                            background: admission === a.key ? `linear-gradient(180deg,${rgbaHex(outer, 0.3)},rgba(6,5,12,.92))` : "linear-gradient(180deg,#1a1626,#0a0812)",
                            boxShadow: admission === a.key ? `inset 0 1px 0 ${rgbaHex(outer, 0.45)},inset 0 -1px 0 rgba(0,0,0,.7)` : "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.7)",
                            clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
                          }}
                        >{a.label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={fieldWrap()}>
                    <small style={fieldLabel}>MIN PILOT LEVEL</small>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <button
                        onClick={() => setMinLevel((v) => Math.max(0, v - 5))} aria-label="Lower the minimum pilot level"
                        style={{ position: "relative", width: 30, height: 28, flex: "0 0 auto", padding: 0, border: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, color: "#eddcff", background: "linear-gradient(180deg,#1e1830,#0a0812)", boxShadow: "inset 0 1px 0 rgba(226,200,255,.18),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 3px 6px rgba(0,0,0,.5)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
                      >−</button>
                      <b style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 15, fontVariantNumeric: "tabular-nums", color: "#f2f7ff" }}>{minLevel}</b>
                      <button
                        onClick={() => setMinLevel((v) => Math.min(60, v + 5))} aria-label="Raise the minimum pilot level"
                        style={{ position: "relative", width: 30, height: 28, flex: "0 0 auto", padding: 0, border: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, color: "#eddcff", background: "linear-gradient(180deg,#1e1830,#0a0812)", boxShadow: "inset 0 1px 0 rgba(226,200,255,.18),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 3px 6px rgba(0,0,0,.5)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
                      >+</button>
                    </div>
                  </div>
                </div>

                <div style={fieldWrap()}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <small style={fieldLabel}>RECRUITING FOR</small>
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.4, color: tagsOk ? "#7cffb0" : "rgba(190,214,236,.5)" }}>{tags.length} / 3 PICKED</small>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CF_FOCUS.map((t) => (
                      <button
                        key={t} onClick={() => toggleTag(t)} aria-label={`${tags.includes(t) ? "Remove" : "Recruit for"} ${t.toLowerCase()}`}
                        style={{
                          position: "relative", padding: "5px 10px", border: "none", cursor: "pointer",
                          fontFamily: "var(--font-display)", fontSize: 6.5, letterSpacing: "0.16em",
                          color: tags.includes(t) ? "#f4ecff" : "rgba(206,222,246,.5)",
                          background: tags.includes(t) ? `linear-gradient(180deg,${rgbaHex(outer, 0.28)},rgba(6,5,12,.92))` : "linear-gradient(180deg,#1a1626,#0a0812)",
                          boxShadow: tags.includes(t) ? `inset 0 1px 0 ${rgbaHex(outer, 0.45)},inset 0 -1px 0 rgba(0,0,0,.7)` : "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.7)",
                          clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)",
                        }}
                      >{t}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* right — live preview, ledger, checks, submit */}
              <div style={{ position: "relative", display: "grid", gap: 9, alignContent: "start", gridTemplateRows: "auto auto 1fr auto", padding: "22px 20px", border: `2px solid ${ACCENT}80`, background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 0 0 2px rgba(243,232,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(201,168,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(126,72,176,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(62,32,86,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>

                <div style={{ position: "relative", display: "grid", gap: 10, padding: "13px 13px 14px", overflow: "hidden", background: `radial-gradient(130% 100% at 50% 0%,${rgbaHex(outer, 0.15)},transparent 74%),linear-gradient(180deg,#141020,#06050c)`, boxShadow: `inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 ${rgbaHex(outer, 0.42)}`, clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                  <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(170,140,220,.05) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
                  <small style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>REGISTRY PREVIEW</small>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ position: "relative", width: 72, height: 72, flex: "0 0 auto", filter: `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 7px 9px rgba(0,0,0,.7)) drop-shadow(0 0 18px ${rgbaHex(outer, 0.6)})` }}>
                      <i style={{ position: "absolute", inset: 0, background: bandGrad, clipPath: clipOf(shape) }} />
                      <i style={{ position: "absolute", inset: 3, background: faceGrad, boxShadow: "inset 0 3px 8px rgba(0,0,0,.7)", clipPath: clipOf(shape) }} />
                      <b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontStyle: "normal", fontWeight: 400, fontSize: 32, lineHeight: 1, color: effectiveSymHex, textShadow: `0 0 12px ${rgbaHex(effectiveSymHex, 0.7)}` }}>{symbol}</b>
                      <i style={{ position: "absolute", inset: 3, overflow: "hidden", clipPath: clipOf(shape), pointerEvents: "none" }}>
                        <i style={{ position: "absolute", top: "-20%", bottom: "-20%", left: 0, width: "26%", background: "linear-gradient(100deg,transparent,rgba(240,228,255,.45),transparent)", filter: "blur(3px)" }} />
                      </i>
                    </div>
                    <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                        <b style={{ flex: "0 1 auto", fontFamily: "var(--font-display)", fontSize: 12.5, letterSpacing: "0.06em", color: "#eddcff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: `0 0 12px ${rgbaHex(outer, 0.6)}` }}>{clean ? clean.toUpperCase() : "UNNAMED CHARTER"}</b>
                        <small style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.14em", color: "rgba(240,246,255,.88)" }}>[{tag || "···"}]</small>
                      </div>
                      <small style={{ fontSize: 10, lineHeight: 1.5, color: "rgba(206,222,242,.68)" }}>{motto || "No motto filed yet."}</small>
                    </div>
                  </div>
                  <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 5 }}>
                    <small style={{
                      padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 6.5, letterSpacing: "0.16em",
                      color: admission === "open" ? "#5cff8a" : admission === "invite" ? "#ff8c4d" : "#4ee2ff",
                      background: rgbaHex(admission === "open" ? "#5cff8a" : admission === "invite" ? "#ff8c4d" : "#4ee2ff", 0.16),
                      boxShadow: `inset 0 0 0 1px ${rgbaHex(admission === "open" ? "#5cff8a" : admission === "invite" ? "#ff8c4d" : "#4ee2ff", 0.45)}`,
                    }}>{ADMISSIONS.find((a) => a.key === admission)?.label === "OPEN" ? "OPEN TO ALL" : admission === "invite" ? "INVITE ONLY" : "BY APPLICATION"}{minLevel > 0 ? ` · LV ${minLevel}+` : ""}</small>
                    {tags.map((g) => (
                      <small key={g} style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 6.5, letterSpacing: "0.16em", color: outer, background: rgbaHex(outer, 0.16), boxShadow: `inset 0 0 0 1px ${rgbaHex(outer, 0.42)}` }}>{g}</small>
                    ))}
                  </div>
                </div>

                <div style={{ position: "relative", display: "grid", gap: 6, padding: "11px 12px 12px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% 0%,rgba(232,185,77,.12),transparent 74%),linear-gradient(180deg,#141020,#06050c)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 rgba(232,185,77,.2)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                  <small style={{ fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(240,222,180,.8)" }}>FILING LEDGER</small>
                  {[
                    { k: "FILING FEE", v: CREATE_COST.toLocaleString(), hex: "#e8b94d" },
                    { k: "YOUR CREDITS", v: player.credits.toLocaleString(), hex: fundsOk ? "#5cff8a" : "#ff4d5e" },
                    { k: "AFTER FILING", v: Math.max(0, player.credits - CREATE_COST).toLocaleString(), hex: "#4ee2ff" },
                    { k: "STARTING SLOTS", v: "30", hex: "#b866ff" },
                  ].map((l) => (
                    <div key={l.k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <i style={{ width: 5, height: 5, flex: "0 0 auto", background: l.hex, boxShadow: `0 0 7px ${l.hex}`, transform: "rotate(45deg)" }} />
                      <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 9.4, letterSpacing: "0.05em", color: "rgba(196,214,238,.72)" }}>{l.k}</small>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.9, fontVariantNumeric: "tabular-nums", color: l.hex }}>{l.v}</small>
                    </div>
                  ))}
                </div>

                <div style={{ position: "relative", display: "grid", gap: 6, alignContent: "start", padding: "11px 12px 12px", overflow: "hidden", background: "linear-gradient(180deg,#141020,#06050c)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(201,168,255,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                  <small style={{ fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>CHARTER CHECKS</small>
                  {checks.map((c) => (
                    <div key={c.k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <i style={{ width: 12, height: 12, flex: "0 0 auto", display: "grid", placeItems: "center", fontStyle: "normal", fontSize: 8, color: c.ok ? "#5cff8a" : "#ff4d5e", background: c.ok ? "rgba(92,255,138,.16)" : "rgba(255,77,94,.16)", boxShadow: `inset 0 0 0 1px ${c.ok ? "rgba(92,255,138,.45)" : "rgba(255,77,94,.45)"}`, transform: "rotate(45deg)" }}>
                        <i style={{ display: "block", transform: "rotate(-45deg)", fontStyle: "normal" }}>{c.ok ? "✓" : "✕"}</i>
                      </i>
                      <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 9.4, letterSpacing: "0.04em", color: c.ok ? "rgba(214,230,248,.85)" : "#ff8c9b" }}>{c.k}</small>
                    </div>
                  ))}
                </div>

                <div style={{ position: "relative", display: "grid", gap: 7 }}>
                  <CreateButton disabled={!allOk || busy} label={busy ? "FILING…" : allOk ? `CREATE CLAN · ${CREATE_COST.toLocaleString()}` : "COMPLETE THE FORM"} onClick={submit} />
                  <ClearButton onClick={reset} />
                  {toast && <small style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 9.4, letterSpacing: "0.04em", color: toast.bad ? "#ff8c9b" : "#5cff8a" }}>{toast.text}</small>}
                </div>
              </div>

            </div>
          </div>
        </div>
      </PrintPortal>
    </div>
  );
}
