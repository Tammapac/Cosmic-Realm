// The Kit's hexagon HUD-slot button (Cosmic Kit.dc.html lines 626-638),
// extracted verbatim from PlayerPanel so the quickslot row and the floating
// SideMenu render the exact same 9-layer chamfered frame from one source.
// Extensions over the original quickslot-only version:
// - `img`: renders a PNG icon (the MenuPanel's /assets/ui/icons/ set)
//   instead of a Unicode glyph.
// - `tone: "red"`: the Kit's red gradient family (same values as
//   CloseButton/PmButton red) for the logout slot.
import { usePressable } from "./usePressable";

const HEX = "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)";

// Kit steel cascade (white → light steel → dark steel → near-black) and its
// red counterpart built from the Kit's own red family (#ffd7db/#c8303f/
// #5c0d16 → #ff97a2/#9c1c29/#3d080f → #ff6b7c/#8d1723/#2c060c).
const TONES = {
  steel: {
    shell: "linear-gradient(150deg,#5a6577,#262c37 55%,#0d1119)",
    l1: "linear-gradient(135deg,#ffffff,#8592a8)",
    l2: "linear-gradient(135deg,#c3cedd,#414c5e)",
    l3: "linear-gradient(135deg,#5b6678,#1a1e26)",
    l4: "linear-gradient(135deg,#242a34,#000000)",
    l5: "linear-gradient(135deg,#0c0e12,#000000)",
    face: "radial-gradient(130% 100% at 50% -12%,rgba(170,205,245,.3),rgba(90,120,160,.12) 52%,transparent 74%),linear-gradient(180deg,#28323f,#0d131b 62%,#070b11)",
    // Brighter, fully-filled steel interior for PNG-icon slots (dark icon
    // art on the dark glyph face read as hollow rings) — per user feedback.
    faceFilled: "radial-gradient(130% 100% at 50% -12%,rgba(170,205,245,.5),rgba(90,120,160,.25) 52%,transparent 80%),linear-gradient(180deg,#3c4c60,#1a2532 62%,#101823)",
    faceShadow: "inset 0 2px 5px rgba(0,0,0,.7),inset 0 -1px 0 rgba(170,205,245,.16)",
    scan: "repeating-linear-gradient(90deg,rgba(200,235,255,.05) 0 1px,transparent 1px 3px)",
    glyph: "#cfe4f5",
    glyphShadow: "0 1px 2px rgba(0,0,0,.9),0 0 9px rgba(150,190,235,.5)",
  },
  red: {
    shell: "linear-gradient(150deg,#7a4550,#37181e 55%,#160a0d)",
    l1: "linear-gradient(135deg,#ffd7db,#c8909a)",
    l2: "linear-gradient(135deg,#e0a8b0,#5c2a32)",
    l3: "linear-gradient(135deg,#8d4550,#241014)",
    l4: "linear-gradient(135deg,#3a1a20,#000000)",
    l5: "linear-gradient(135deg,#140709,#000000)",
    face: "radial-gradient(130% 100% at 50% -12%,rgba(255,140,155,.3),rgba(160,60,75,.12) 52%,transparent 74%),linear-gradient(180deg,#3f2028,#1b0d11 62%,#110709)",
    faceFilled: "radial-gradient(130% 100% at 50% -12%,rgba(255,140,155,.5),rgba(160,60,75,.25) 52%,transparent 80%),linear-gradient(180deg,#5a2c36,#2a1319 62%,#170b0e)",
    faceShadow: "inset 0 2px 5px rgba(0,0,0,.7),inset 0 -1px 0 rgba(255,160,175,.16)",
    scan: "repeating-linear-gradient(90deg,rgba(255,205,215,.05) 0 1px,transparent 1px 3px)",
    glyph: "#ffd0d5",
    glyphShadow: "0 1px 2px rgba(0,0,0,.9),0 0 9px rgba(255,92,110,.5)",
  },
} as const;

export function HexSlotButton({ glyph, img, onClick, title, disabled, badge, tone = "steel", size = 40 }: {
  glyph?: string;
  img?: string;
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  badge?: number;
  tone?: "steel" | "red";
  size?: number;
}) {
  const { hover, active, handlers } = usePressable();
  const live = !disabled && !!onClick;
  const t = TONES[tone];
  return (
    <button
      onClick={onClick} aria-label={title} title={title} disabled={!live} {...(live ? handlers : {})}
      style={{
        position: "relative", width: size, height: size, padding: 2.5, boxSizing: "border-box", border: "none", cursor: live ? "pointer" : "default",
        background: "linear-gradient(150deg,rgba(255,255,255,.55),rgba(255,255,255,.22) 45%,rgba(0,0,0,.5))", clipPath: HEX,
        opacity: live ? 1 : 0.4,
        boxShadow: "inset 0 4px 6px rgba(0,0,0,.6),inset 0 -1px 0 rgba(143,176,208,.25)",
        transform: live && active ? "translateY(2px) scale(.96)" : live && hover ? "translateY(-3px) scale(1.06)" : "none",
        filter: live && (active || hover) ? "brightness(1.22)" : "none",
        transition: "transform .16s ease,filter .16s ease",
      }}
    >
      <span style={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center", overflow: "hidden", background: t.shell, clipPath: HEX }}>
        {/* Kit lines 628-634: the full 6-layer metal-rim cascade before the
            actual panel face — insets scale off SK=40px exactly like the
            Kit's --sk custom property. */}
        <i style={{ position: "absolute", inset: 0, display: "block", background: t.l1, opacity: 0.9, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: 0.8, display: "block", background: t.l2, opacity: 0.8, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: 1.5, display: "block", background: t.l3, opacity: 0.85, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: 2.2, display: "block", background: t.l4, opacity: 0.9, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: 2.9, display: "block", background: t.l5, opacity: 0.8, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: 2.9, display: "block", background: img ? t.faceFilled : t.face, boxShadow: t.faceShadow, clipPath: "polygon(50% 0.5px,calc(100% - 0.5px) 26%,calc(100% - 0.5px) 74%,50% calc(100% - 0.5px),0.5px 74%,0.5px 26%)" }} />
        <i style={{ position: "absolute", inset: 2.9, display: "block", background: t.scan, clipPath: HEX, pointerEvents: "none" }} />
        {live && hover && (
          <i style={{ position: "absolute", top: 0, left: "-60%", width: "40%", height: "220%", background: "linear-gradient(100deg,transparent,rgba(255,255,255,.22),transparent)", transform: "rotate(20deg) translateX(220%)", transition: "transform .5s ease,opacity .1s ease", pointerEvents: "none" }} />
        )}
        {img ? (
          // Source PNGs are only ~120-180px (this is the real ceiling on
          // sharpness — no CSS trick recovers detail the source doesn't
          // have; re-exporting the icon set at a higher resolution is the
          // actual fix if these still read soft). `crisp-edges` was wrong
          // here — that's a nearest-neighbor hint meant for pixel-art
          // UPscaling, and on this DOWNscale (160px source → ~39px
          // rendered) it skips the browser's normal bilinear averaging and
          // makes small detail look worse, not better. Left unset so the
          // browser uses its default high-quality downscale filter, sized
          // up slightly so what detail exists reads clearer, and a mild
          // contrast/saturation lift to make the linework pop against the
          // slot's dark face instead of leaning on a filter stack.
          <img
            src={img} alt="" aria-hidden="true" draggable={false}
            style={{
              position: "relative", width: "78%", height: "78%", objectFit: "contain",
              opacity: live ? 1 : 0.5,
              filter: live ? "drop-shadow(0 1px 2px rgba(0,0,0,.85)) contrast(1.12) saturate(1.15)" : "grayscale(.6)",
            }}
          />
        ) : (
          <b style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: Math.round(size * 0.47 * 10) / 10, fontWeight: 800, color: live ? t.glyph : "rgba(180,200,220,.5)", textShadow: live ? t.glyphShadow : "none" }}>{glyph}</b>
        )}
      </span>
      {!!badge && badge > 0 && (
        <i style={{ position: "absolute", top: -3, right: -3, minWidth: 13, height: 13, padding: "0 3px", borderRadius: "50%", display: "grid", placeItems: "center", background: "#5cff8a", boxShadow: "0 0 6px #5cff8a,0 1px 2px rgba(0,0,0,.6)", fontFamily: "var(--font-mono)", fontSize: 9.4, fontWeight: 700, fontStyle: "normal", color: "#052", zIndex: 2 }}>{badge}</i>
      )}
    </button>
  );
}
