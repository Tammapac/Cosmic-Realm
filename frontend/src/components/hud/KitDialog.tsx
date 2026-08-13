// The Kit's confirm-dialog chrome — same 5-layer metal-rim frame as the
// item tooltip (real brushed-metal atlas tile + 4 tinted bevel layers, all
// six corners chamfered), reused for every popup in the inventory so panels
// never drift from this one reference instead of each screen improvising
// its own chrome. Header keeps the pulsing diamond + title + CloseButton.
import type { ReactNode } from "react";
import { usePressable } from "./usePressable";
import { CloseButton } from "./CloseButton";

export type KitDialogAccent = "red" | "gold";

const ACCENTS: Record<KitDialogAccent, { hex: string; title: string; headerWash: string }> = {
  red: { hex: "#ff4d5e", title: "#ffd0d5", headerWash: "linear-gradient(100deg,rgba(255,77,94,.2),transparent 72%)" },
  gold: { hex: "#e8b94d", title: "#f5dda6", headerWash: "linear-gradient(100deg,rgba(232,185,77,.22),transparent 72%)" },
};

const shadeHex = (hex: string, amt: number): string => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255) + Math.round(255 * amt), g = (n >> 8 & 255) + Math.round(255 * amt), b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};
const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

export function KitDialog({
  accent, title, width = 320, onDismiss, children,
}: {
  accent: KitDialogAccent; title: string; width?: number; onDismiss?: () => void; children: ReactNode;
}) {
  const a = ACCENTS[accent];
  const wash = rgba(a.hex, 0.16), glow = rgba(a.hex, 0.6);
  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 40, display: "grid", placeItems: "center", background: "rgba(3,4,10,.78)", backdropFilter: "blur(3px)" }}
      onClick={onDismiss}
    >
      <div
        style={{ position: "relative", width, boxSizing: "border-box", padding: 7.5, filter: `drop-shadow(0 4px 0 rgba(3,5,10,.92)) drop-shadow(0 9px 9px rgba(0,0,0,.75)) drop-shadow(0 18px 24px rgba(0,0,0,.6)) drop-shadow(0 0 22px ${glow})` }}
        onClick={(e) => e.stopPropagation()}
      >
        <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))" }} />
        <i style={{ position: "absolute", inset: 1.5, display: "block", background: `linear-gradient(135deg,${shadeHex(a.hex, 0.55)},${shadeHex(a.hex, -0.1)} 38%,${shadeHex(a.hex, -0.5)} 72%,${shadeHex(a.hex, -0.68)})`, clipPath: "polygon(0 0,calc(100% - 19.12px) 0,100% 19.12px,100% 100%,19.12px 100%,0 calc(100% - 19.12px))" }} />
        <i style={{ position: "absolute", inset: 3, display: "block", background: `linear-gradient(135deg,${shadeHex(a.hex, -0.2)},${shadeHex(a.hex, -0.62)} 45%,${shadeHex(a.hex, -0.82)})`, clipPath: "polygon(0 0,calc(100% - 18.24px) 0,100% 18.24px,100% 100%,18.24px 100%,0 calc(100% - 18.24px))" }} />
        <i style={{ position: "absolute", inset: 4.5, display: "block", background: `linear-gradient(135deg,${shadeHex(a.hex, -0.62)},${shadeHex(a.hex, -0.88)} 60%,#05070b)`, clipPath: "polygon(0 0,calc(100% - 17.36px) 0,100% 17.36px,100% 100%,17.36px 100%,0 calc(100% - 17.36px))" }} />
        <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 16.48px) 0,100% 16.48px,100% 100%,16.48px 100%,0 calc(100% - 16.48px))" }} />
        <div style={{ position: "relative", zIndex: 1, overflow: "hidden", background: `radial-gradient(130% 100% at 50% -14%,${wash},transparent 74%),linear-gradient(180deg,#1e2632,#0c1119 62%,#05080d)`, boxShadow: "inset 0 5px 10px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)", clipPath: "polygon(0 0,calc(100% - 15.6px) 0,100% 15.6px,100% 100%,15.6px 100%,0 calc(100% - 15.6px))" }}>
          <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "10px 34px 10px 12px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(170,205,245,.1)", background: `linear-gradient(100deg,${wash},transparent 74%)` }}>
            <i style={{ width: 7, height: 7, flex: "0 0 auto", background: a.hex, boxShadow: `0 0 9px ${a.hex}`, transform: "rotate(45deg)", animation: "cPulse 1.5s ease-in-out infinite" }} />
            <b style={{ fontFamily: "var(--font-display)", fontSize: 13.6, letterSpacing: "0.18em", color: a.title }}>{title}</b>
            {onDismiss && (
              <div style={{ position: "absolute", right: 11, top: 11 }}>
                <CloseButton onClick={onDismiss} size={20} fontSize={9} />
              </div>
            )}
          </div>
          <div style={{ position: "relative", padding: "13px 14px 14px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// Single-corner-chamfer button used only inside KitDialog action rows —
// verbatim structure from Cosmic Kit.dc.html's YES/NO buttons (askThrow
// dialog, lines 827-844): two gradient layers with a single bottom-right
// clip, an inner span with the same top-highlight/bottom-glow stripe pair
// as KitPillButton, but its own chamfer geometry — never merge these two
// button shapes, the Kit source keeps them visually distinct on purpose.

const ACTION_TONES = {
  green: { rim: "linear-gradient(135deg,#ddffe9,#4f9c68 45%,#183226)", mid: "linear-gradient(135deg,#3d7a52,#0d1c14)", bg: "linear-gradient(180deg,rgba(92,255,138,.24),rgba(7,12,9,.96))", color: "#dfffe9", spec: "rgba(214,255,228,.85)", under: "#5cff8a" },
  red: { rim: "linear-gradient(135deg,#ffdfe3,#a8505c 45%,#3a151b)", mid: "linear-gradient(135deg,#7c3540,#1c0b0f)", bg: "linear-gradient(180deg,rgba(255,77,94,.24),rgba(12,7,9,.96))", color: "#ffdfe3", spec: "rgba(255,214,220,.85)", under: "#ff4d5e" },
  gold: { rim: "linear-gradient(135deg,#fff4d2,#e8b94d 45%,#6b4d0c)", mid: "linear-gradient(135deg,#c99a2e,#3a2a06)", bg: "linear-gradient(180deg,rgba(232,185,77,.24),rgba(12,9,4,.96))", color: "#ffe6a8", spec: "rgba(255,244,214,.85)", under: "#e8b94d" },
} as const;

/**
 * The action row used by every KitDialog. The left button keeps the
 * dialog's own bottom-right chamfer cut (so it reads as part of the same
 * frame family as the pill buttons); the right button is square — it sits
 * against the popup's own chamfered outer edge, so it doesn't need one of
 * its own and a second cut there would look doubled-up.
 */
export function KitDialogActions({
  left, right,
}: {
  left: { label: string; onClick: () => void; disabled?: boolean; tone?: keyof typeof ACTION_TONES };
  right: { label: string; onClick: () => void; tone?: keyof typeof ACTION_TONES };
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
      <KitDialogLabelButton label={left.label} onClick={left.onClick} disabled={left.disabled} tone={ACTION_TONES[left.tone ?? "green"]} corner="chamfer" />
      <KitDialogLabelButton label={right.label} onClick={right.onClick} tone={ACTION_TONES[right.tone ?? "red"]} corner="square" />
    </div>
  );
}

function KitDialogLabelButton({
  label, tone, onClick, disabled, corner,
}: {
  label: string; tone: { rim: string; mid: string; bg: string; color: string; spec: string; under: string };
  onClick: () => void; disabled?: boolean; corner: "chamfer" | "square";
}) {
  const { hover, active, handlers } = usePressable();
  const lift = !disabled && hover ? -2 : !disabled && active ? 3 : 0;
  const scale = !disabled && active ? 0.95 : 1;
  // Verbatim from the Kit's VENT/KEEP buttons: style-active keeps a tight
  // drop-shadow + brightness bump, it never drops the glow entirely — a
  // pressed button that goes flat reads as broken, not as "pressed".
  const glow = !disabled && hover
    ? `drop-shadow(0 6px 3px rgba(0,0,0,.55)) drop-shadow(0 0 20px ${tone.under}99) brightness(1.12)`
    : !disabled && active
    ? `drop-shadow(0 1px 1px rgba(0,0,0,.6)) drop-shadow(0 0 10px ${tone.under}66) brightness(1.32)`
    : `drop-shadow(0 3px 2px rgba(0,0,0,.55)) drop-shadow(0 0 10px ${tone.under}40)`;
  // Chamfer sits on the bottom-left corner only — matching the dialog's own
  // outer frame, which is chamfered top-right/bottom-left (see KitDialog's
  // clip-path). A bottom-right cut here would fight that shape instead of
  // following it.
  const clip = (inset: number) => corner === "chamfer"
    ? `polygon(0 0,100% 0,100% 100%,${10 - inset}px 100%,0 calc(100% - ${10 - inset}px))`
    : "none";
  return (
    <button
      onClick={onClick} disabled={disabled} {...handlers}
      style={{
        position: "relative", padding: 0, border: "none", background: "none",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
        filter: glow,
        transform: `translateY(${lift}px) scale(${scale})`,
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: tone.rim, clipPath: clip(0) }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: tone.mid, clipPath: clip(1) }} />
      <span style={{ position: "relative", display: "block", margin: 3, overflow: "hidden", background: tone.bg, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,255,255,.16)", clipPath: clip(2) }}>
        <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${tone.spec},transparent)` }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${tone.under},transparent)`, opacity: 0.75, animation: "cPulse 3s ease-in-out infinite" }} />
        <b style={{ position: "relative", display: "block", padding: "8px 10px", fontFamily: "var(--font-display)", fontSize: 11.2, letterSpacing: "0.2em", fontWeight: 800, color: tone.color, textAlign: "center" }}>
          {label}
        </b>
      </span>
    </button>
  );
}
