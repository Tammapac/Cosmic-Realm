// The ONE close button used everywhere in the inventory UI (window headers,
// popups, tooltips) — verbatim gradient/shadow/hover/active values from
// Cosmic Kit.dc.html (e.g. line 856's <button aria-label="Close">). This is
// the confirmed reference; do not simplify it.
import { usePressable } from "./usePressable";

export function CloseButton({ onClick, title, size = 26, fontSize = 11 }: { onClick: () => void; title?: string; size?: number; fontSize?: number }) {
  const { hover, active, handlers } = usePressable();
  const scale = active ? 0.92 : hover ? 1.07 : 1;
  const brightness = active ? 1.35 : hover ? 1.14 : 1;
  const glow = active ? "0 1px 0 -1px rgba(58,6,12,.96),0 2px 0 -3px rgba(26,3,7,.92),0 4px 8px rgba(0,0,0,.62),0 0 10px rgba(255,77,94,.4)"
    : "0 3px 0 -1px rgba(58,6,12,.95),0 6px 0 -3px rgba(26,3,7,.92),0 10px 16px rgba(0,0,0,.55),0 0 14px rgba(255,77,94,.22)";
  return (
    <button
      aria-label="Close" onClick={onClick} title={title}
      {...handlers}
      style={{
        position: "relative", display: "grid", placeItems: "center", width: size, height: size, padding: 0, border: "none",
        background: "linear-gradient(135deg,#ffd7db,#c8303f 46%,#5c0d16)", color: "#fff2f3", fontSize, fontWeight: 700, cursor: "pointer",
        transform: `rotate(45deg) scale(${scale})`, filter: `brightness(${brightness})`,
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),box-shadow .14s ease,filter .14s ease",
        boxShadow: glow,
      }}
    >
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#ff97a2,#9c1c29 52%,#3d080f)" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(158deg,#ff6b7c,#8d1723 58%,#2c060c)", boxShadow: "inset 0 1px 0 rgba(255,224,228,.55),inset 0 -1px 0 rgba(0,0,0,.65),inset 0 4px 7px rgba(0,0,0,.42)" }} />
      <i style={{ position: "absolute", left: 4, right: 4, top: 3.5, height: 1, display: "block", background: "linear-gradient(90deg,transparent,rgba(255,228,232,.8),transparent)" }} />
      <i style={{ position: "relative", transform: "rotate(-45deg)", fontStyle: "normal", textShadow: "0 1px 2px rgba(46,0,4,.9)" }}>✕</i>
    </button>
  );
}
