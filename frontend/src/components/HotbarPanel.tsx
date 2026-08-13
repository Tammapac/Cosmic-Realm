// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, H-02 ·
// COMBAT CONSOLE section + its renderVals() logic, VIT()/HB() helpers).
// Every gradient/shadow/state is copied verbatim — the chamfered console
// casting (metal rim, three steel bands, panel seams, vent grilles, cable
// run with lit contacts, corner screws, hazard stripe, two scratch
// passes), the AUTO toggle, the segmented hull/shield cell banks (one
// capsule per ~600 points of max, clamped 2-8, each with its own fill
// animation/filament/nodes/arc), and the slot strip below (same slot
// chrome as before: metal rim, bevel bands, status LED, cooldown wipe,
// lock hatch, marching-ants selection ring).
//
// Only 8 slots (the ones the live game actually uses) instead of the
// Kit's decorative extras: weapon fire/ammo, rocket fire/ammo, and 6
// consumable slots — see game/store.ts's 8-long player.hotbar array.
// AUTO toggle is a new local on/off (no server-side auto-use logic exists
// yet) — wiring it to real auto-use behaviour is a separate feature.
//
// Data plumbing + dropdown menus (ammo/rocket-type picker, consumable
// assign) are carried over from the old GameHud.tsx wiring verbatim; the
// dropdown portal mechanics (position measured off the slot's own rect,
// rendered into document.body so the console's clip-path never clips it)
// reuse the same approach AbilitySlot.tsx used.
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useGame, state as gameState, bump,
  getActiveAmmoType, getAmmoCount, switchAmmoType,
  getActiveRocketAmmoType, getRocketAmmoCount, switchRocketAmmoType,
  useConsumable, setHotbarSlot,
} from "../game/store";
import { effectiveStats } from "../game/loop";
import {
  CONSUMABLE_DEFS, ROCKET_AMMO_TYPE_DEFS, LASER_AMMO_TYPE_ORDER,
  ROCKET_MISSILE_TYPE_DEFS, ROCKET_MISSILE_TYPE_ORDER,
  type ConsumableId, type RocketAmmoType, type RocketMissileType,
} from "../game/types";
import { usePressable } from "./hud/usePressable";

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

// Keyframes this console needs that aren't guaranteed present elsewhere
// (cPulse/cSweep happen to also be injected by InventoryPanel, but this
// panel must not depend on another one being mounted). Values verbatim
// from the Kit's global <style> block.
const CONSOLE_KEYFRAMES = `
@keyframes cPulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes cSweep{0%{transform:skewX(-18deg) translateX(-120%)}100%{transform:skewX(-18deg) translateX(760%)}}
@keyframes cFlow{0%{background-position:0 50%,0 50%}100%{background-position:-260px 50%,-160px 50%}}
@keyframes cFil{0%,100%{opacity:.55;filter:blur(.4px)}42%{opacity:1;filter:blur(0)}68%{opacity:.75;filter:blur(.6px)}}
@keyframes cArc{0%,88%,100%{opacity:0}90%{opacity:.9}92%{opacity:.2}94%{opacity:.7}96%{opacity:0}}
@keyframes cMarch{0%{background-position:0 0,0 100%,0 0,100% 0}100%{background-position:16px 0,-16px 100%,0 -16px,100% 16px}}
@keyframes cRegen{0%,100%{opacity:.25;transform:scaleY(.75)}50%{opacity:.9;transform:scaleY(1)}}
`;

function useRegenerating(value: number, idleMs = 600): boolean {
  const prev = useRef(value);
  const [on, setOn] = useState(false);
  const timerRef = useRef<number>();
  useLayoutEffect(() => {
    if (value > prev.current) setOn(true);
    prev.current = value;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOn(false), idleMs);
    return () => window.clearTimeout(timerRef.current);
  }, [value, idleMs]);
  return on;
}

// ── Vitals: one capsule per ~600 points of max, clamped 2-8. Verbatim
// from the Kit's VIT() helper — each segment fills independently so the
// bar grows in cells as the ship's ceiling rises.
type VitalSeg = { pct: number; radiusL: boolean; radiusR: boolean; partial: boolean; fil: string; arc: string };
function buildVital(cur: number, max: number) {
  const n = Math.max(2, Math.min(8, Math.round(max / 600)));
  const per = max / n;
  const segs: VitalSeg[] = [];
  for (let i = 0; i < n; i++) {
    const p = Math.max(0, Math.min(1, (cur - i * per) / per));
    segs.push({
      pct: p * 100, radiusL: i === 0, radiusR: i === n - 1, partial: p > 0 && p < 1,
      fil: `${(3.4 + i * 0.7).toFixed(1)}s`, arc: `${(5.9 + i * 1.4).toFixed(1)}s`,
    });
  }
  return segs;
}

function VitalRow({
  label, cur, max, hex, hi, lo, glow, textColor, regen,
}: { label: string; cur: number; max: number; hex: string; hi: string; lo: string; glow: string; textColor: string; regen: boolean }) {
  const segs = buildVital(cur, max);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <b style={{ width: 72, flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.24em", fontWeight: 800, color: hex, textShadow: `0 0 9px ${glow}` }}>{label}</b>
      <span style={{ display: "flex", flex: 1, gap: 3 }}>
        {segs.map((sg, i) => {
          const rL = sg.radiusL ? 8 : 2, rR = sg.radiusR ? 8 : 2;
          const radius = `${rL}px ${rR}px ${rR}px ${rL}px`;
          const rLin = sg.radiusL ? 6 : 1, rRin = sg.radiusR ? 6 : 1;
          const radiusIn = `${rLin}px ${rRin}px ${rRin}px ${rLin}px`;
          const rLf = sg.radiusL ? 5 : 1, rRf = sg.radiusR ? 5 : 1;
          const radiusFace = `${rLf}px ${rRf}px ${rRf}px ${rLf}px`;
          return (
            <span key={i} style={{ position: "relative", flex: 1, height: 17, borderRadius: radius, background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.55),inset -1px -1px 1px rgba(0,0,0,.7),0 2px 0 -1px rgba(3,5,10,.95),0 4px 5px -1px rgba(0,0,0,.75),0 8px 12px -2px rgba(0,0,0,.55)" }}>
              <i style={{ position: "absolute", inset: 1.5, borderRadius: radiusIn, background: "linear-gradient(180deg,#01030a 0%,#0a1018 46%,#040810 100%)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.9),inset 0 3px 6px rgba(0,0,0,.9)" }} />
              {/* Fixed-size wrapper at the segment's full inner box (never
                  resized by fill %) carries the glow — box-shadow on a
                  differently-sized, dynamically-resizing ancestor was the
                  earlier bug (glow got clipped, and nested absolute
                  children lost their positioning reference at small
                  widths). Fill % is expressed only as the width of the
                  gradient layer INSIDE this fixed box, via clip-path, so
                  every animated child always has the full segment box as
                  its positioning + rendering context regardless of pct. */}
              <i style={{ position: "absolute", inset: 3, borderRadius: radiusFace, boxShadow: sg.pct > 0 ? `0 0 18px ${glow},0 0 34px ${glow}` : "none" }}>
                <i style={{ position: "absolute", inset: 0, borderRadius: radiusFace, overflow: "hidden", clipPath: `inset(0 ${100 - sg.pct}% 0 0)`, transition: "clip-path .5s cubic-bezier(.2,.9,.25,1)" }}>
                  <i style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg,${hi} 0%,${hex} 26%,${hex} 62%,${lo} 88%,${hex} 100%)`, boxShadow: `inset 0 0 12px ${hex}` }} />
                  <i style={{ position: "absolute", inset: "-45% 0", background: "radial-gradient(70% 120% at 30% 50%,rgba(255,255,255,.35),transparent 72%),radial-gradient(90% 140% at 78% 50%,rgba(255,255,255,.25),transparent 74%)", backgroundSize: "260px 100%,410px 100%", backgroundRepeat: "repeat-x", filter: "blur(5px)", animation: "cFlow 12s linear infinite" }} />
                  <i style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, transform: "translateY(-50%)", background: "linear-gradient(90deg,transparent,#ffffff 6%,#ffffff 94%,transparent)", boxShadow: `0 0 5px #ffffff,0 0 12px ${hex},0 0 22px ${glow}`, animation: `cFil ${sg.fil} ease-in-out infinite` }} />
                  <i style={{ position: "absolute", left: "44%", top: 1, bottom: 1, width: 1, background: "#ffffff", boxShadow: "0 0 6px #ffffff", animation: `cArc ${sg.arc} linear infinite` }} />
                  <i style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(255,255,255,.34) 0%,rgba(255,255,255,.06) 30%,transparent 48%,rgba(0,0,0,.3) 100%)" }} />
                </i>
                {sg.partial && (
                  <i style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${sg.pct}% - 3px)`, width: 3, borderRadius: 2, background: "#ffffff", opacity: 0.9, boxShadow: `0 0 8px ${hex},0 0 18px ${hex}`, animation: "cPulse 3s ease-in-out infinite" }} />
                )}
                {sg.partial && regen && (
                  <i style={{ position: "absolute", top: 0, bottom: 0, left: `${sg.pct}%`, right: 0, background: `linear-gradient(90deg,${glow},transparent 46%)`, animation: "cRegen 1.8s ease-in-out infinite" }} />
                )}
                <i style={{ position: "absolute", inset: 0, borderRadius: radiusIn, background: "linear-gradient(180deg,rgba(255,255,255,.2) 0%,rgba(255,255,255,.03) 40%,transparent 55%,rgba(255,255,255,.05) 100%)", pointerEvents: "none" }} />
              </i>
              <i style={{ position: "absolute", left: 7, right: 7, top: 2, height: 1, borderRadius: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)" }} />
            </span>
          );
        })}
      </span>
      <b style={{ width: 128, flex: "0 0 auto", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", fontFamily: "var(--font-display)", fontSize: 13.6, fontWeight: 700, color: textColor, fontVariantNumeric: "tabular-nums", textShadow: `0 0 8px ${glow}` }}>
        {cur.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
      </b>
    </div>
  );
}

type SlotVisual = {
  icon?: string;
  glyph?: string;
  glyphColor?: string;
  count?: number | null;
  countColor?: string;
  keyLabel: string;
  ledColor: string;
  ledOp: number;
  ledAnim?: string;
  selShow?: boolean;
  glowShow?: boolean;
  glowColor?: string;
  cdShow?: boolean;
  cdDeg?: string;
  lockShow?: boolean;
  opacity?: number;
  iconOp?: number;
  title?: string;
};

// Loadout-picker popover — the SAME 5-layer metal-rim frame construction
// as the item tooltip / KitDialog (real brushed-metal atlas tile + 4
// tinted bevel layers, hexagon-chamfered corners), not a simplified
// 2-layer version. This is an anchored popover (not a full-screen modal),
// so it skips KitDialog's backdrop/dismiss-on-click-outside wrapper.
function SlotDropdown({ header, children }: { header: string; children: React.ReactNode }) {
  const accent = "#4ee2ff";
  const wash = rgba(accent, 0.16), glow = rgba(accent, 0.6);
  return (
    <div style={{ position: "relative", width: 232, boxSizing: "border-box", padding: 7.5, filter: `drop-shadow(0 4px 0 rgba(3,5,10,.92)) drop-shadow(0 9px 9px rgba(0,0,0,.75)) drop-shadow(0 18px 24px rgba(0,0,0,.6)) drop-shadow(0 0 22px ${glow})` }}>
      <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: "polygon(0 0,calc(100% - 19.12px) 0,100% 19.12px,100% 100%,19.12px 100%,0 calc(100% - 19.12px))" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: "polygon(0 0,calc(100% - 18.24px) 0,100% 18.24px,100% 100%,18.24px 100%,0 calc(100% - 18.24px))" }} />
      <i style={{ position: "absolute", inset: 4.5, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: "polygon(0 0,calc(100% - 17.36px) 0,100% 17.36px,100% 100%,17.36px 100%,0 calc(100% - 17.36px))" }} />
      <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 16.48px) 0,100% 16.48px,100% 100%,16.48px 100%,0 calc(100% - 16.48px))" }} />
      <div style={{ position: "relative", zIndex: 1, overflow: "hidden", background: `radial-gradient(130% 100% at 50% -14%,${wash},transparent 74%),linear-gradient(180deg,#1e2632,#0c1119 62%,#05080d)`, boxShadow: "inset 0 5px 10px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)", clipPath: "polygon(0 0,calc(100% - 15.6px) 0,100% 15.6px,100% 100%,15.6px 100%,0 calc(100% - 15.6px))" }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(170,205,245,.1)", background: `linear-gradient(100deg,${wash},transparent 74%)` }}>
          <i style={{ width: 7, height: 7, flex: "0 0 auto", background: accent, boxShadow: `0 0 9px ${accent}`, transform: "rotate(45deg)", animation: "cPulse 1.5s ease-in-out infinite" }} />
          <b style={{ fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.16em", color: "#cfefff" }}>{header}</b>
        </div>
        <div style={{ position: "relative", display: "grid", padding: 5, maxHeight: 260, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function SlotDropdownRow({
  icon, color, name, desc, count, isActive, onClick,
}: { icon: React.ReactNode; color: string; name: string; desc?: string; count?: number | null; isActive?: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button onClick={onClick} {...handlers} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 7px", border: "none", cursor: "pointer",
      background: isActive ? `linear-gradient(90deg,${color}2e,transparent)` : hover ? "rgba(255,255,255,.05)" : "transparent",
      transform: active ? "scale(.98)" : "none", transition: "background .15s ease,transform .1s ease",
    }}>
      <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, flex: "0 0 auto", color, fontSize: 15.3 }}>{icon}</span>
      <span style={{ display: "grid", gap: 1, flex: 1, minWidth: 0, textAlign: "left" }}>
        <b style={{ fontSize: 12.4, color: "#eef2ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</b>
        {desc && <small style={{ fontSize: 10, color: "rgba(190,214,236,.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{desc}</small>}
      </span>
      {count != null && <small style={{ flex: "0 0 auto", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(200,220,240,.6)" }}>×{count}</small>}
    </button>
  );
}

function HotbarSlot({
  v, dropdown, onClick, onContextMenu,
}: { v: SlotVisual; dropdown?: React.ReactNode; onClick?: () => void; onContextMenu?: () => void }) {
  const { hover, active, handlers } = usePressable();
  const slotRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    if (!dropdown || !slotRef.current) { setDropdownPos(null); return; }
    const rect = slotRef.current.getBoundingClientRect();
    setDropdownPos({ left: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top + 10 });
  }, [dropdown]);

  const locked = !!v.lockShow;
  // Verbatim: style-hover="translateY(-4px) scale(1.05)" style-active="scale(.92)"
  const transform = locked ? "none" : active ? "scale(.92)" : hover ? "translateY(-4px) scale(1.05)" : "none";

  return (
    <div style={{ display: "grid", justifyItems: "center" }}>
      <div
        ref={slotRef} role="button" aria-label={v.title} title={v.title}
        onClick={locked ? undefined : onClick}
        onContextMenu={(e) => { e.preventDefault(); if (!locked) onContextMenu?.(); }}
        {...(locked ? {} : handlers)}
        style={{
          "--hb": "56px", position: "relative", width: "var(--hb)", height: "var(--hb)",
          cursor: locked ? "not-allowed" : "pointer", transition: "transform .1s cubic-bezier(.2,.9,.25,1)",
          transform, opacity: v.opacity ?? 1,
        } as React.CSSProperties}
      >
        <i style={{ position: "absolute", inset: 0, display: "block", borderRadius: "calc(var(--hb)*0.07)", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7),0 calc(var(--hb)*0.05) 0 calc(var(--hb)*-0.014) rgba(3,5,10,.95),0 calc(var(--hb)*0.1) calc(var(--hb)*0.09) calc(var(--hb)*-0.03) rgba(0,0,0,.8),0 calc(var(--hb)*0.19) calc(var(--hb)*0.24) calc(var(--hb)*-0.05) rgba(0,0,0,.7),0 calc(var(--hb)*0.3) calc(var(--hb)*0.4) rgba(0,0,0,.5)" }} />
        <i style={{ position: "absolute", inset: "calc(var(--hb)*0.028)", display: "block", borderRadius: "calc(var(--hb)*0.058)", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)" }} />
        <i style={{ position: "absolute", inset: "calc(var(--hb)*0.056)", display: "block", borderRadius: "calc(var(--hb)*0.05)", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)" }} />
        <i style={{ position: "absolute", inset: "calc(var(--hb)*0.084)", display: "block", borderRadius: "calc(var(--hb)*0.044)", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)" }} />
        <i style={{ position: "absolute", inset: "calc(var(--hb)*0.112)", display: "block", borderRadius: "calc(var(--hb)*0.038)", overflow: "hidden", background: "radial-gradient(130% 100% at 50% -12%,rgba(170,205,245,.3),rgba(90,120,160,.12) 52%,transparent 74%),linear-gradient(180deg,#28323f,#0d131b 62%,#070b11)", boxShadow: "inset 0 calc(var(--hb)*0.04) calc(var(--hb)*0.08) rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 calc(var(--hb)*-0.02) 0 rgba(170,205,245,.16)" }} />
        <i style={{ position: "absolute", left: "calc(var(--hb)*0.16)", right: "calc(var(--hb)*0.16)", top: "calc(var(--hb)*0.03)", height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)" }} />
        <i style={{ position: "absolute", left: "calc(var(--hb)*0.2)", right: "calc(var(--hb)*0.2)", bottom: "calc(var(--hb)*0.032)", height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(150,190,235,.3),transparent)" }} />
        <i style={{ position: "absolute", inset: "calc(var(--hb)*0.112)", display: "block", borderRadius: "calc(var(--hb)*0.038)", background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: "calc(var(--hb)*0.112)", right: "calc(var(--hb)*0.112)", top: "calc(var(--hb)*0.34)", height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(0,0,0,.6) 20%,rgba(0,0,0,.6) 80%,transparent)", boxShadow: "0 1px 0 rgba(180,210,240,.09)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: "calc(var(--hb)*0.2)", right: "calc(var(--hb)*0.2)", bottom: "calc(var(--hb)*0.155)", height: "calc(var(--hb)*0.035)", display: "block", background: "repeating-linear-gradient(90deg,rgba(0,0,0,.55) 0 2px,transparent 2px 5px)", opacity: 0.7, pointerEvents: "none" }} />
        {(["left", "right"] as const).map((lr) => (["top", "bottom"] as const).map((tb) => (
          <i key={`${lr}-${tb}`} style={{ position: "absolute", [lr]: "calc(var(--hb)*0.062)", [tb]: "calc(var(--hb)*0.062)", width: "calc(var(--hb)*0.036)", height: "calc(var(--hb)*0.036)", display: "block", borderRadius: "50%", background: "radial-gradient(circle at 34% 30%,#dfe8f2,#5b6675 55%,#161b22)", boxShadow: "0 1px 1px rgba(0,0,0,.8)", pointerEvents: "none" }} />
        )))}
        <i style={{ position: "absolute", left: "calc(var(--hb)*0.28)", right: "calc(var(--hb)*0.28)", bottom: "calc(var(--hb)*0.088)", height: "calc(var(--hb)*0.022)", display: "block", borderRadius: 1, background: v.ledColor, opacity: v.ledOp, boxShadow: `0 0 calc(var(--hb)*0.07) ${v.ledColor}`, animation: v.ledAnim, pointerEvents: "none" }} />
        {v.selShow && (
          <i style={{
            position: "absolute", inset: "calc(var(--hb)*0.128)", display: "block", borderRadius: "calc(var(--hb)*0.034)",
            backgroundImage: "linear-gradient(90deg,rgba(225,252,255,.95) 45%,transparent 0),linear-gradient(90deg,rgba(225,252,255,.95) 45%,transparent 0),linear-gradient(0deg,rgba(225,252,255,.95) 45%,transparent 0),linear-gradient(0deg,rgba(225,252,255,.95) 45%,transparent 0)",
            backgroundSize: "16px 2.5px,16px 2.5px,2.5px 16px,2.5px 16px", backgroundRepeat: "repeat-x,repeat-x,repeat-y,repeat-y", backgroundPosition: "0 0,0 100%,0 0,100% 0",
            animation: "cMarch .6s linear infinite", opacity: 0.9,
            filter: "blur(1.4px) drop-shadow(0 0 4px rgba(78,226,255,.9)) drop-shadow(0 0 12px rgba(78,226,255,.75)) drop-shadow(0 0 26px rgba(78,226,255,.5)) drop-shadow(0 0 44px rgba(78,226,255,.28))",
            pointerEvents: "none",
          }} />
        )}
        <i style={{ position: "absolute", inset: "calc(var(--hb)*0.112)", display: "block", borderRadius: "calc(var(--hb)*0.038)", overflow: "hidden", pointerEvents: "none" }}>
          <i style={{ position: "absolute", top: 0, bottom: 0, left: "-40%", width: "22%", background: "linear-gradient(100deg,transparent,rgba(255,255,255,.3),transparent)", transform: "skewX(-18deg)", animation: hover && !locked ? "cSweep .55s linear infinite" : "none" }} />
        </i>
        {v.glowShow && (
          <i style={{ position: "absolute", inset: 0, display: "block", borderRadius: "calc(var(--hb)*0.07)", boxShadow: `0 0 calc(var(--hb)*0.18) ${v.glowColor},0 0 calc(var(--hb)*0.34) ${v.glowColor}`, pointerEvents: "none" }} />
        )}
        {v.icon && (
          <i style={{ position: "absolute", left: "50%", top: "47%", transform: "translate(-50%,-50%)", display: "block", width: "calc(var(--hb)*0.5)", height: "calc(var(--hb)*0.42)", backgroundImage: `url(${v.icon})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", opacity: v.iconOp ?? 1, filter: "drop-shadow(0 calc(var(--hb)*0.02) calc(var(--hb)*0.03) rgba(0,0,0,.8))" }} />
        )}
        {v.glyph && (
          <b style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%)", fontFamily: "var(--font-display)", fontSize: "calc(var(--hb)*0.42)", fontWeight: 800, lineHeight: 1, color: v.glyphColor ?? "#cfe4f5", opacity: v.iconOp ?? 1, textShadow: `0 calc(var(--hb)*0.015) calc(var(--hb)*0.025) rgba(0,0,0,.9),0 0 calc(var(--hb)*0.12) ${v.glyphColor ?? "rgba(150,190,235,.5)"}`, pointerEvents: "none" }}>{v.glyph}</b>
        )}
        {v.cdShow && (
          <i style={{ position: "absolute", inset: "calc(var(--hb)*0.112)", display: "block", borderRadius: "calc(var(--hb)*0.038)", background: `conic-gradient(rgba(5,8,14,.78) ${v.cdDeg},transparent 0)`, pointerEvents: "none" }} />
        )}
        {locked && (
          <i style={{ position: "absolute", inset: "calc(var(--hb)*0.112)", display: "block", borderRadius: "calc(var(--hb)*0.038)", background: "repeating-linear-gradient(45deg,rgba(0,0,0,.5) 0 1px,transparent 1px 8px),rgba(5,7,13,.6)", pointerEvents: "none" }} />
        )}
        <b style={{ position: "absolute", left: "calc(var(--hb)*0.09)", bottom: "calc(var(--hb)*0.055)", fontFamily: "var(--font-mono)", fontSize: "calc(var(--hb)*0.13)", fontWeight: 700, color: "rgba(200,218,238,.72)", textShadow: "0 1px 2px #000" }}>{v.keyLabel}</b>
        {v.count != null && v.count > 0 && (
          <b style={{ position: "absolute", right: "calc(var(--hb)*0.09)", bottom: "calc(var(--hb)*0.05)", fontFamily: "var(--font-body)", fontSize: "calc(var(--hb)*0.145)", fontWeight: 700, color: v.countColor ?? "rgba(226,236,248,.9)", textShadow: "0 1px 2px #000,0 0 4px #000" }}>{v.count}</b>
        )}
      </div>
      {dropdown && dropdownPos &&
        createPortal(
          <div style={{ position: "fixed", left: dropdownPos.left, bottom: dropdownPos.bottom, transform: "translateX(-50%)", zIndex: 200 }}>
            {dropdown}
          </div>,
          document.body,
        )}
    </div>
  );
}

function AutoToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const filter = on
    ? (hover ? "brightness(1.25)" : "drop-shadow(0 0 14px rgba(92,255,138,.4))")
    : (hover ? "brightness(1.25)" : "drop-shadow(0 2px 3px rgba(0,0,0,.5))");
  const bd = on
    ? "linear-gradient(150deg,rgba(150,255,190,.85),rgba(92,255,138,.6) 45%,rgba(28,107,57,.5))"
    : "linear-gradient(150deg,rgba(200,214,230,.4),rgba(108,120,137,.28) 45%,rgba(42,50,61,.3))";
  const bg = on
    ? "radial-gradient(120% 90% at 50% 118%,rgba(92,255,138,.34),rgba(92,255,138,.1) 46%,transparent 72%),linear-gradient(180deg,rgba(10,20,15,.9),rgba(6,10,14,.94))"
    : "linear-gradient(180deg,rgba(150,190,235,.04),rgba(7,9,15,.94))";
  const shadow = on
    ? "inset 0 0 22px rgba(92,255,138,.3),inset 0 0 10px rgba(92,255,138,.18)"
    : "inset 0 -6px 12px rgba(0,0,0,.5)";
  return (
    <button
      aria-label={on ? "Auto-use consumables: on" : "Auto-use consumables: off"}
      onClick={onClick} {...handlers}
      style={{
        position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        width: 56, flex: "0 0 auto", padding: "7px 5px 6px", border: "none", background: bd, cursor: "pointer",
        filter, transition: "all .18s ease",
        transform: active ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        clipPath: "polygon(7px 0,calc(100% - 7px) 0,100% 7px,100% calc(100% - 7px),calc(100% - 7px) 100%,7px 100%,0 calc(100% - 7px),0 7px)",
      }}
    >
      <i style={{ position: "absolute", inset: 1, background: bg, boxShadow: shadow, clipPath: "polygon(6.4px 0,calc(100% - 6.4px) 0,100% 6.4px,100% calc(100% - 6.4px),calc(100% - 6.4px) 100%,6.4px 100%,0 calc(100% - 6.4px),0 6.4px)" }} />
      <i style={{ position: "absolute", inset: 1, background: "repeating-linear-gradient(90deg,rgba(200,235,255,.05) 0 1px,transparent 1px 4px)", pointerEvents: "none", clipPath: "polygon(6.4px 0,calc(100% - 6.4px) 0,100% 6.4px,100% calc(100% - 6.4px),calc(100% - 6.4px) 100%,6.4px 100%,0 calc(100% - 6.4px),0 6.4px)" }} />
      <i style={{ position: "relative", width: 7, height: 7, background: on ? "#5cff8a" : "rgba(120,150,185,.45)", boxShadow: `0 0 8px ${on ? "#5cff8a" : "rgba(120,150,185,.45)"}`, transform: "rotate(45deg)", animation: on ? "cPulse 1.7s ease-in-out infinite" : "none" }} />
      <b style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.16em", fontWeight: 800, color: on ? "#cdf6d9" : "rgba(206,220,238,.6)" }}>AUTO</b>
      <small style={{ position: "relative", fontFamily: "var(--font-mono)", fontSize: 8.9, letterSpacing: "0.06em", color: on ? "#5cff8a" : "rgba(160,190,215,.45)" }}>{on ? "ON" : "OFF"}</small>
    </button>
  );
}

export function HotbarPanel() {
  const player = useGame((s) => s.player);
  const showAmmoSelector = useGame((s) => s.showAmmoSelector);
  const showRocketAmmoSelector = useGame((s) => s.showRocketAmmoSelector);
  const isLaserFiring = useGame((s) => s.isLaserFiring);
  const isRocketFiring = useGame((s) => s.isRocketFiring);
  const cooldowns = useGame((s) => s.hotbarCooldowns);
  const afterburnUntil = useGame((s) => s.afterburnUntil);
  const repairBotUntil = useGame((s) => s.repairBotUntil);
  const tick = useGame((s) => s.tick);
  const docked = useGame((s) => s.dockedAt);
  const [assignSlot, setAssignSlot] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);

  useRegenerating(player.hull);
  useRegenerating(player.shield);

  if (docked) return null;

  const es = effectiveStats();

  const activeAmmoType = getActiveAmmoType();
  const ammoDef = ROCKET_AMMO_TYPE_DEFS[activeAmmoType];
  const ammoCount = getAmmoCount(activeAmmoType);

  const activeRocketType = getActiveRocketAmmoType();
  const rocketDef = ROCKET_MISSILE_TYPE_DEFS[activeRocketType];
  const rocketCount = getRocketAmmoCount(activeRocketType);

  const toggleAmmoSelector = () => {
    gameState.showAmmoSelector = !gameState.showAmmoSelector;
    gameState.showRocketAmmoSelector = false;
    setAssignSlot(null);
    bump();
  };
  const selectAmmo = (t: RocketAmmoType) => { switchAmmoType(t); gameState.showAmmoSelector = false; bump(); };
  const toggleRocketAmmoSelector = () => {
    gameState.showRocketAmmoSelector = !gameState.showRocketAmmoSelector;
    gameState.showAmmoSelector = false;
    setAssignSlot(null);
    bump();
  };
  const selectRocketAmmo = (t: RocketMissileType) => { switchRocketAmmoType(t); gameState.showRocketAmmoSelector = false; bump(); };
  const toggleAssign = (i: number) => {
    setAssignSlot(assignSlot === i ? null : i);
    gameState.showAmmoSelector = false;
    gameState.showRocketAmmoSelector = false;
    bump();
  };
  const assignConsumable = (i: number, id: ConsumableId | null) => { setHotbarSlot(i, id); setAssignSlot(null); };

  const consumableSlots = player.hotbar.slice(0, 6).map((id, i) => {
    const def = id ? CONSUMABLE_DEFS[id] : null;
    const count = id ? (player.consumables[id] ?? 0) : 0;
    const cd = cooldowns[i] ?? 0;
    const usable = !!def && count > 0;
    let selected = false;
    if (id === "afterburn-fuel" && afterburnUntil > tick) selected = true;
    if (id === "repair-bot" && repairBotUntil > tick) selected = true;
    const cdFrac = def && cd > 0 ? cd / def.cooldown : 0;

    const v: SlotVisual = {
      icon: def?.icon, keyLabel: String(i + 3),
      count: def ? count : null,
      ledColor: !def ? "rgba(120,150,185,.5)" : cdFrac > 0 ? "rgba(120,150,185,.5)" : "#5cff8a",
      ledOp: !def ? 0.5 : 0.85,
      selShow: selected, glowShow: selected, glowColor: "rgba(78,226,255,.5)",
      cdShow: cdFrac > 0, cdDeg: `${Math.round(cdFrac * 360)}deg`,
      iconOp: cdFrac > 0 ? 0.55 : def ? 1 : 0.25,
      title: def
        ? `${def.name} — ${def.description} — owned ×${count} — click to use, right-click to reassign`
        : "Empty slot — click to assign a consumable",
    };
    const dropdown = assignSlot === i ? (
      <SlotDropdown header={`Assign slot ${i + 3}`}>
        {(Object.keys(CONSUMABLE_DEFS) as ConsumableId[]).map((cid) => {
          const cdef = CONSUMABLE_DEFS[cid];
          return (
            <SlotDropdownRow key={cid} icon={cdef.icon} color={cdef.color} name={cdef.name} desc={cdef.description}
              count={player.consumables[cid] ?? 0} isActive={id === cid} onClick={() => assignConsumable(i, cid)} />
          );
        })}
        <SlotDropdownRow icon="∅" color="#8aa0c0" name="Empty" desc="Clear this slot" isActive={id === null} onClick={() => assignConsumable(i, null)} />
      </SlotDropdown>
    ) : undefined;
    const onUse = () => (usable ? useConsumable(i) : toggleAssign(i));
    return { v, dropdown, onUse, onContext: () => toggleAssign(i) };
  });

  const weaponSlot: SlotVisual = {
    glyph: ammoDef.glyph, glyphColor: ammoDef.color, keyLabel: "1",
    ledColor: isLaserFiring ? "#5cff8a" : "rgba(120,150,185,.5)", ledOp: isLaserFiring ? 0.9 : 0.5,
    selShow: isLaserFiring || showAmmoSelector, glowShow: isLaserFiring || showAmmoSelector, glowColor: rgba(ammoDef.color, 0.5),
    count: ammoCount, countColor: ammoDef.color,
    title: `${ammoDef.name} — ${ammoDef.description} — in stock ${ammoCount} — click to change ammo, key 1 toggles fire`,
  };
  const rocketSlot: SlotVisual = {
    glyph: rocketDef.glyph, glyphColor: rocketDef.color, keyLabel: "2",
    ledColor: isRocketFiring ? "#5cff8a" : "rgba(120,150,185,.5)", ledOp: isRocketFiring ? 0.9 : 0.5,
    selShow: isRocketFiring || showRocketAmmoSelector, glowShow: isRocketFiring || showRocketAmmoSelector, glowColor: rgba(rocketDef.color, 0.5),
    count: rocketCount, countColor: rocketDef.color,
    title: `${rocketDef.name} — ${rocketDef.description} — in stock ${rocketCount} — click to change rocket type, key 2 toggles fire`,
  };

  return (
    <div style={{ position: "relative", width: 560, padding: 8, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 22px 26px rgba(0,0,0,.7)) drop-shadow(0 38px 48px rgba(0,0,0,.55)) drop-shadow(0 0 34px rgba(184,102,255,.16))" }}>
      <style>{CONSOLE_KEYFRAMES}</style>
      <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.42),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(18px 0,calc(100% - 18px) 0,100% 18px,100% calc(100% - 18px),calc(100% - 18px) 100%,18px 100%,0 calc(100% - 18px),0 18px)" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 40%,#3f4854 74%,#232932)", clipPath: "polygon(15px 0,calc(100% - 15px) 0,100% 15px,100% calc(100% - 15px),calc(100% - 15px) 100%,15px 100%,0 calc(100% - 15px),0 15px)" }} />
      <i style={{ position: "absolute", inset: 5, display: "block", background: "linear-gradient(135deg,#6f7b8c,#2b323d 52%,#0e1218)", clipPath: "polygon(13px 0,calc(100% - 13px) 0,100% 13px,100% calc(100% - 13px),calc(100% - 13px) 100%,13px 100%,0 calc(100% - 13px),0 13px)" }} />
      <i style={{ position: "absolute", inset: 6.5, display: "block", background: "linear-gradient(135deg,#241533,#0a0512)", clipPath: "polygon(11.5px 0,calc(100% - 11.5px) 0,100% 11.5px,100% calc(100% - 11.5px),calc(100% - 11.5px) 100%,11.5px 100%,0 calc(100% - 11.5px),0 11.5px)" }} />

      <div style={{
        position: "relative", display: "grid", gap: 13, padding: "14px 18px 15px", overflow: "hidden",
        background: "repeating-linear-gradient(90deg,rgba(140,190,220,.03) 0 1px,transparent 1px 3px),radial-gradient(620px 240px at 50% -22%,rgba(150,96,225,.32),rgba(96,44,168,.12) 48%,transparent 72%),linear-gradient(180deg,#2a1c3f,#120c1e 58%,#08050f)",
        boxShadow: "inset 0 3px 9px rgba(0,0,0,.7),inset 0 -1px 0 rgba(220,200,250,.2)",
        clipPath: "polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)",
      }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(74deg,transparent 0 26px,rgba(255,255,255,.035) 26px 27px,transparent 27px 61px),repeating-linear-gradient(-58deg,transparent 0 43px,rgba(255,255,255,.022) 43px 44px,transparent 44px 97px)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 20, right: 20, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,214,255,.6),transparent)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(184,102,255,.6),transparent)", boxShadow: "0 0 12px rgba(184,102,255,.55)", pointerEvents: "none" }} />
        {(["left", "right"] as const).map((s) => (
          <i key={s} style={{ position: "absolute", [s]: 8, top: 8, width: 5, height: 5, borderRadius: "50%", background: "radial-gradient(circle at 34% 30%,#e6eefa,#5b6675 52%,#12161d)", boxShadow: "0 1px 2px rgba(0,0,0,.85)", pointerEvents: "none" }} />
        ))}
        {(["left", "right"] as const).map((s) => (
          <i key={`${s}-b`} style={{ position: "absolute", [s]: 8, bottom: 8, width: 5, height: 5, borderRadius: "50%", background: "radial-gradient(circle at 34% 30%,#e6eefa,#5b6675 52%,#12161d)", boxShadow: "0 1px 2px rgba(0,0,0,.85)", pointerEvents: "none" }} />
        ))}
        <i style={{ position: "absolute", left: 74, top: 5, height: 52, width: 1, background: "linear-gradient(180deg,transparent,rgba(0,0,0,.75) 18%,rgba(0,0,0,.75) 82%,transparent)", boxShadow: "1px 0 0 rgba(200,180,240,.09)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", right: 74, top: 5, height: 52, width: 1, background: "linear-gradient(180deg,transparent,rgba(0,0,0,.75) 18%,rgba(0,0,0,.75) 82%,transparent)", boxShadow: "-1px 0 0 rgba(200,180,240,.09)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 5, top: 22, width: 8, height: 30, background: "repeating-linear-gradient(180deg,rgba(0,0,0,.6) 0 2px,rgba(180,210,240,.07) 2px 5px)", borderRadius: 1, boxShadow: "inset 1px 0 2px rgba(0,0,0,.8)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", right: 5, top: 22, width: 8, height: 30, background: "repeating-linear-gradient(180deg,rgba(0,0,0,.6) 0 2px,rgba(180,210,240,.07) 2px 5px)", borderRadius: 1, boxShadow: "inset -1px 0 2px rgba(0,0,0,.8)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 18, bottom: 5, width: 118, height: 12, pointerEvents: "none", background: "radial-gradient(circle at 4px 9px,rgba(184,102,255,.5) 0 1.4px,transparent 1.6px),radial-gradient(circle at 114px 3px,rgba(78,226,255,.5) 0 1.4px,transparent 1.6px)", borderBottom: "1px solid rgba(0,0,0,.5)", borderRadius: "0 0 0 7px", boxShadow: "0 1px 0 rgba(200,180,240,.06)" }} />
        <i style={{ position: "absolute", right: 18, bottom: 5, width: 118, height: 12, pointerEvents: "none", background: "radial-gradient(circle at 114px 9px,rgba(184,102,255,.5) 0 1.4px,transparent 1.6px),radial-gradient(circle at 4px 3px,rgba(78,226,255,.5) 0 1.4px,transparent 1.6px)", borderBottom: "1px solid rgba(0,0,0,.5)", borderRadius: "0 0 7px 0", boxShadow: "0 1px 0 rgba(200,180,240,.06)" }} />
        <i style={{ position: "absolute", left: "50%", bottom: 3, transform: "translateX(-50%)", width: 64, height: 3, background: "repeating-linear-gradient(115deg,rgba(232,185,77,.5) 0 3px,rgba(10,7,16,.6) 3px 6px)", opacity: 0.7, pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <AutoToggle on={auto} onClick={() => setAuto((a) => !a)} />
          <div style={{ display: "grid", gap: 7, flex: 1, minWidth: 0 }}>
            <VitalRow label="HULL" cur={Math.round(player.hull)} max={Math.round(es.hullMax)} hex="#ff0022" hi="#ff5566" lo="#2e0005" glow="rgba(255,0,34,.9)" textColor="#ffd0d5" regen={false} />
            <VitalRow label="SHIELD" cur={Math.round(player.shield)} max={Math.round(es.shieldMax)} hex="#0066ff" hi="#4fb0ff" lo="#00113d" glow="rgba(0,102,255,.9)" textColor="#dff6ff" regen />
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", justifyContent: "center", gap: 9 }}>
          <HotbarSlot v={weaponSlot} onClick={toggleAmmoSelector}
            dropdown={showAmmoSelector ? (
              <SlotDropdown header="Select ammo type">
                {LASER_AMMO_TYPE_ORDER.map((t) => {
                  const def = ROCKET_AMMO_TYPE_DEFS[t];
                  return <SlotDropdownRow key={t} icon={def.glyph} color={def.color} name={def.shortName} desc={def.description} count={getAmmoCount(t)} isActive={t === activeAmmoType} onClick={() => selectAmmo(t)} />;
                })}
              </SlotDropdown>
            ) : undefined} />
          <HotbarSlot v={rocketSlot} onClick={toggleRocketAmmoSelector}
            dropdown={showRocketAmmoSelector ? (
              <SlotDropdown header="Select rocket type">
                {ROCKET_MISSILE_TYPE_ORDER.map((t) => {
                  const def = ROCKET_MISSILE_TYPE_DEFS[t];
                  return <SlotDropdownRow key={t} icon={def.glyph} color={def.color} name={def.shortName} desc={def.description} count={getRocketAmmoCount(t)} isActive={t === activeRocketType} onClick={() => selectRocketAmmo(t)} />;
                })}
              </SlotDropdown>
            ) : undefined} />
          {consumableSlots.map((s, i) => (
            <HotbarSlot key={i} v={s.v} dropdown={s.dropdown} onClick={s.onUse} onContextMenu={s.onContext} />
          ))}
        </div>
      </div>
    </div>
  );
}
