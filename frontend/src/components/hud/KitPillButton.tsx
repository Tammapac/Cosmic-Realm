// The ONE pill-button chrome used everywhere in the inventory footer (THROW
// OUT, PAGE 1/2, the gold PAGE 3 buy button, and any future footer action).
// Verbatim structure from Cosmic Kit.dc.html's askThrow/invPages buttons:
// two chamfered gradient layers (rim, mid) + an inner span with its own top
// highlight stripe and bottom accent-glow stripe. Every caller supplies only
// the four colors (rim/mid/bg gradients + spec/under stripe colors) — the
// layer structure itself must never drift between buttons.
import { type ReactNode } from "react";
import { usePressable } from "./usePressable";

export type KitPillTone = {
  rim: string;      // outer chamfered layer (inset:0)
  mid: string;       // inner chamfered layer (inset:1.5)
  bg: string;         // the span's own fill
  color: string;       // label text color
  spec: string;         // top highlight stripe color
  under: string;         // bottom accent-glow stripe color (or "transparent")
};

export function KitPillButton({
  tone, disabled, glowOnHover = true, animation, onClick, title, icon, children,
}: {
  tone: KitPillTone; disabled?: boolean; glowOnHover?: boolean; animation?: string;
  onClick?: () => void; title?: string; icon?: ReactNode; children: ReactNode;
}) {
  const { hover, active, handlers } = usePressable();
  const lift = !disabled && hover ? -2 : !disabled && active ? 2 : 0;
  const scale = !disabled && active ? 0.95 : 1;
  // The tone's own accent (tone.under) drives a colored glow on hover, kept
  // through active as a tighter version — matching KitDialogLabelButton and
  // the Kit's own style-hover/style-active spec. A flat black shadow with
  // no accent, or one that vanishes on press, reads as an inert/disabled
  // button rather than a pressed one.
  // Intensity matches KitDialogLabelButton's VENT/KEEP glow (99/66 hex-alpha
  // suffixes = ~60%/40% opacity) — a full-opacity accent stacked on top of a
  // brightness boost read as too hot next to that reference.
  const accent = tone.under === "transparent" ? null : tone.under;
  const glow = !disabled && hover && glowOnHover
    ? `drop-shadow(0 5px 0 rgba(3,5,10,.92)) drop-shadow(0 8px 9px rgba(0,0,0,.7)) drop-shadow(0 16px 20px rgba(0,0,0,.5))${accent ? ` drop-shadow(0 0 20px ${accent}99)` : ""}`
    : !disabled && active
    ? `drop-shadow(0 1px 0 rgba(3,5,10,.92)) drop-shadow(0 2px 4px rgba(0,0,0,.6))${accent ? ` drop-shadow(0 0 10px ${accent}66)` : ""} brightness(1.15)`
    : `drop-shadow(0 3px 0 rgba(3,5,10,.92)) drop-shadow(0 5px 6px rgba(0,0,0,.7)) drop-shadow(0 11px 14px rgba(0,0,0,.5))`;
  return (
    <button
      onClick={onClick} disabled={disabled} title={title} {...handlers}
      style={{
        position: "relative", padding: 0, border: "none", background: "none",
        cursor: disabled ? "default" : "pointer", filter: glow, transform: `translateY(${lift}px) scale(${scale})`,
        transition: "filter .16s ease,transform .12s cubic-bezier(.2,.9,.25,1)", animation,
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: tone.rim, clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: tone.mid, clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, margin: 3, padding: "6px 12px", overflow: "hidden", background: tone.bg, color: tone.color, fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.16em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,238,255,.14)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
        <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${tone.spec},transparent)` }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: tone.under === "transparent" ? "transparent" : `linear-gradient(90deg,transparent,${tone.under},transparent)`, opacity: tone.under === "transparent" ? 0 : 0.75, boxShadow: tone.under === "transparent" ? "none" : `0 0 8px ${tone.under}` }} />
        {icon}
        <span style={{ position: "relative" }}>{children}</span>
      </span>
    </button>
  );
}
