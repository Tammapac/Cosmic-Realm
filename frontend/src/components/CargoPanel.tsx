// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-02 ·
// CARGO HOLD section + its renderVals() logic). Every color, gradient,
// clip-path and animation below is copied verbatim from that source — the
// gauge/tick/segment markup, the material-row hex bevel stack and the
// jettison/premium dialogs all match line for line.
//
// Data plumbing: driven by the real player.cargo (CargoItem[]) and
// RESOURCES catalog. The Kit's per-resource icon is an image URL
// ({{ c.icon }}); this game's RESOURCES entries only carry a Unicode
// glyph + color (no PNG sprite), so the glyph renders as text in the same
// slot instead of a background-image.
//
// TRADE DRONE is a Kit-only concept (a Premium service that auto-sells
// cargo) with no server-side economy hook yet in this game — its button
// is wired to the same "PREMIUM REQUIRED" dialog the Kit itself shows for
// non-Premium players, never a fake sell action.
import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "./useDraggable";
import { useGame, state as gameState, bump, removeCargo, cargoUsed, cargoCapacity } from "../game/store";
import { RESOURCES, SHIP_CLASSES, type ResourceId, type Resource } from "../game/types";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { KitDialog, KitDialogActions } from "./hud/KitDialog";
import { KitPillButton } from "./hud/KitPillButton";
import { usePressable } from "./hud/usePressable";

type CargoRow = { id: ResourceId; r: Resource; qty: number; value: number; share: number };

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

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

const RECESS_BG = "#0b0e16"; // the Kit's per-item recessBg — this game has no per-resource recess tint, so one steel-dark tone is used for all rows
const HEX = "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)";

// Material row: verbatim from the Kit's cargoRows markup, split into an
// outer entrance-animation wrapper + inner interactive row — see
// InventoryPanel's ItemSlot/EmptySlot comment: the entrance animation
// (cInvRow, fill-mode "both") and a live hover/active transform can't share
// one element without the keyframe's end-state permanently owning
// `transform`.
function MaterialRow({ row, i, isSel, onClick }: { row: CargoRow; i: number; isSel: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const hex = row.r.color;
  const edgeHi = shadeHex(hex, 0.5), edgeLo = shadeHex(hex, -0.55);
  const transform = active ? "translateY(1px) scale(.985)" : hover ? "translateY(-2px)" : "none";
  const brightness = active ? 1.25 : hover ? 1.1 : 1;
  return (
    <div style={{ animation: `cInvRow .34s cubic-bezier(.2,.9,.25,1) ${(i * 0.03).toFixed(2)}s both` }}>
      <div role="button" aria-label={row.r.name} onClick={onClick} {...handlers} style={{
        position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "7px 11px 7px 8px", cursor: "pointer", overflow: "hidden",
        background: isSel ? "linear-gradient(90deg,rgba(78,226,255,.12),transparent)" : "rgba(6,9,15,.5)",
        boxShadow: "inset 0 1px 0 rgba(220,238,255,.08),inset 0 -1px 0 rgba(0,0,0,.6),inset 0 2px 5px rgba(0,0,0,.45)",
        clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)",
        transition: "transform .14s ease,background .22s ease,filter .14s ease",
        transform, filter: `brightness(${brightness})`,
      }}>
        <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: hex, boxShadow: `0 0 10px ${hex}`, opacity: isSel ? 1 : 0.3 }} />

        <div style={{ "--sk": "44px", position: "relative", width: "var(--sk)", height: "var(--sk)", flex: "0 0 auto", padding: "calc(var(--sk)*0.0625)", boxSizing: "border-box", background: `linear-gradient(150deg,${edgeHi},${hex} 45%,${edgeLo})`, clipPath: HEX, filter: "drop-shadow(0 2px 0 rgba(3,5,10,.85)) drop-shadow(0 4px 5px rgba(0,0,0,.6))" } as React.CSSProperties}>
          <div style={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center", overflow: "hidden", background: RECESS_BG, clipPath: HEX }}>
            <i style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#ffffff,#8592a8)", opacity: 0.9, clipPath: HEX }} />
            <i style={{ position: "absolute", inset: "2%", background: "linear-gradient(135deg,#c3cedd,#414c5e)", opacity: 0.8, clipPath: HEX }} />
            <i style={{ position: "absolute", inset: "3.75%", background: "linear-gradient(135deg,#5b6678,#1a1e26)", opacity: 0.85, clipPath: HEX }} />
            <i style={{ position: "absolute", inset: "5.5%", background: "linear-gradient(135deg,#242a34,#000000)", opacity: 0.9, clipPath: HEX }} />
            <i style={{ position: "absolute", inset: "7.5%", background: "linear-gradient(135deg,#0c0e12,#000000)", opacity: 0.8, clipPath: HEX }} />
            <i style={{ position: "absolute", inset: "9.25%", background: "linear-gradient(135deg,#2a303c,#0d0f14)", opacity: 0.6, clipPath: HEX }} />
            <i style={{ position: "absolute", inset: "7.25%", background: RECESS_BG, clipPath: HEX }} />
            <i style={{ position: "absolute", inset: 0, margin: "auto", width: "56%", height: "56%", background: hex, opacity: 0.26, boxShadow: `0 0 10px ${hex}`, clipPath: HEX }} />
            <i style={{ position: "relative", fontSize: 23.6, color: hex, filter: `drop-shadow(0 0 7px ${hex}) drop-shadow(0 2px 3px rgba(0,0,0,.75))`, zIndex: 3 }}>{row.r.glyph}</i>
          </div>
        </div>

        <div style={{ position: "relative", display: "grid", gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <b style={{ fontSize: 14.2, fontWeight: 700, color: "#eef6ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.r.name}</b>
            <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(180,212,236,.5)" }}>{row.r.basePrice}cr/u</small>
          </div>
          <div style={{ position: "relative", height: 6, overflow: "hidden", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 2px 3px rgba(0,0,0,.75),inset 0 -1px 0 rgba(220,238,255,.1)" }}>
            <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${row.share * 100}%`, background: `linear-gradient(180deg,${edgeHi},${hex} 55%,${edgeLo})`, boxShadow: `0 0 9px ${hex}` }} />
            <i style={{ position: "absolute", left: 0, top: 0, width: `${row.share * 100}%`, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent)" }} />
          </div>
        </div>

        <div style={{ position: "relative", display: "grid", gap: 1, justifyItems: "end", flex: "0 0 auto" }}>
          <b style={{ fontFamily: "var(--font-mono)", fontSize: 16.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#eaf8ff" }}>x{row.qty}</b>
          <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.4, letterSpacing: "0.1em", color: "rgba(180,212,236,.5)" }}>{row.value.toLocaleString()}cr · {Math.round(row.share * 100)}%</small>
        </div>
      </div>
    </div>
  );
}

export function CargoPanel() {
  const show = useGame((s) => s.showCargo);
  const cargo = useGame((s) => s.player.cargo);
  const shipClass = useGame((s) => s.player.shipClass);
  const [sel, setSel] = useState<ResourceId | null>(null);
  const [askJet, setAskJet] = useState(false);
  const [premium, setPremium] = useState(false);
  const [playToken] = useState(0);
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const drag = useDraggable("cargo", { resetOnMount: true });

  useEffect(() => {
    if (show) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const used = cargoUsed();
  const cap = cargoCapacity();
  const pct = cap > 0 ? Math.min(1, used / cap) : 0;
  const free = Math.max(0, cap - used);

  const rows = useMemo(() => {
    return cargo
      .filter((c) => c.qty > 0)
      .map((c) => {
        // A resourceId absent from the client's RESOURCES catalog (loot
        // added server-side ahead of a client deploy, or any future
        // mismatch) must still show up in the hold — silently dropping it
        // previously made real, weighed cargo invisible while the volume
        // gauge (which sums qty directly, not through this map) kept
        // counting it, producing a "100% full but empty" panel.
        const r = RESOURCES[c.resourceId] ?? {
          id: c.resourceId, name: c.resourceId, basePrice: 0, glyph: "?", color: "#8aa0c0",
          description: "Unrecognized cargo.",
        };
        const value = c.qty * r.basePrice;
        const share = cap > 0 ? Math.min(1, c.qty / cap) : 0;
        return { id: c.resourceId, r, qty: c.qty, value, share };
      })
      .sort((a, b) => b.value - a.value);
  }, [cargo, cap]);

  const curId = sel && rows.some((r) => r.id === sel) ? sel : rows[0]?.id ?? null;
  const cur = rows.find((r) => r.id === curId) ?? null;

  const cls = SHIP_CLASSES[shipClass];
  const cargoValue = rows.reduce((a, r) => a + r.value, 0);

  // Capacity read as a comb of upright strokes; each stroke is one 1/72 of
  // the hold, colored by resource. Filled-tick count is allocated by
  // largest-remainder rounding (Hamilton's method) instead of raw
  // cumulative-share boundaries: with N=72 fixed ticks and up to a dozen+
  // materials, a boundary-based bucket can round a low-share resource's
  // slice down to zero width and it silently vanishes from the bar. The
  // remainder method guarantees every resource with qty>0 keeps at least
  // one visible tick.
  const cargoTicks = useMemo(() => {
    const N = 72;
    const filledN = Math.round(N * pct);
    const totalQty = rows.reduce((a, r) => a + r.qty, 0);
    let entries: (typeof rows[number] | undefined)[] = [];
    if (totalQty > 0 && filledN > 0) {
      const raw = rows.map((r) => (r.qty / totalQty) * filledN);
      const base = raw.map((v) => Math.max(1, Math.floor(v)));
      let assigned = base.reduce((a, b) => a + b, 0);
      const order = raw
        .map((v, i) => ({ i, rem: v - Math.floor(v) }))
        .sort((a, b) => b.rem - a.rem);
      let k = 0;
      while (assigned > filledN && k < order.length) {
        const idx = order[order.length - 1 - k].i;
        if (base[idx] > 1) { base[idx]--; assigned--; }
        k++;
      }
      k = 0;
      while (assigned < filledN && rows.length > 0) {
        base[order[k % order.length].i]++;
        assigned++;
        k++;
      }
      entries = rows.flatMap((r, i) => Array(base[i]).fill(r));
    }
    return Array.from({ length: N }, (_, i) => {
      const row = entries[i];
      const major = i % 6 === 0;
      if (!row) return { hit: false, hex: "#1a2430", top: "#26333f", glow: "transparent", blur: "0px", h: major ? "11px" : "7px", op: 0.85, anim: "none", row: null as typeof rows[number] | null };
      const hex = row.r.color;
      return { hit: true, hex, top: shadeHex(hex, 0.5), glow: rgba(hex, 0.75), blur: major ? "9px" : "6px", h: major ? "26px" : "19px", op: 1, anim: `cInvRow .5s cubic-bezier(.2,.9,.25,1) ${(i * 0.008).toFixed(3)}s both`, row };
    });
  }, [rows, pct]);
  const [tickHover, setTickHover] = useState<{ row: typeof rows[number]; x: number } | null>(null);

  const doJettison = () => {
    if (!curId) return;
    removeCargo(curId, cur?.qty ?? 0);
    bump();
    setAskJet(false);
    setSel(null);
  };

  if (!mounted) return null;

  const requestClose = () => { setClosing(true); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); gameState.showCargo = false; bump(); };

  return (
    <div className="fixed z-50" style={{ top: 40, left: "calc(50% - 310px)", width: 620, pointerEvents: "auto", ...drag.style }}>
      <PrintPortal
        playToken={playToken}
        accent="#4ee2ff"
        duration={1250}
        chamfer={34}
        closing={closing}
        onClosed={closing ? onPortalClosed : undefined}
        style={{ width: 620, margin: "0 auto" }}
      >
        <div style={{ position: "relative", padding: 10, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(78,226,255,.18))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 29.31px) 0,100% 29.31px,100% 100%,29.31px 100%,0 calc(100% - 29.31px))" }} />
          <i style={{ position: "absolute", left: 22, right: 44, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
          <i style={{ position: "absolute", left: 44, right: 22, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(150,190,235,.3),transparent)", pointerEvents: "none" }} />

          <div style={{
            position: "relative", zIndex: 1, display: "grid", gap: 11, padding: "13px 15px 14px", overflow: "hidden",
            background: "radial-gradient(130% 100% at 50% -12%,rgba(120,200,235,.26),transparent 74%),linear-gradient(180deg,#1e2b38,#0d151d 62%,#070b11)",
            boxShadow: "inset 0 6px 12px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)",
            clipPath: "polygon(0 0,calc(100% - 28.14px) 0,100% 28.14px,100% 100%,28.14px 100%,0 calc(100% - 28.14px))",
          }}>
            <i style={{ position: "absolute", inset: 0, clipPath: "polygon(0 0,calc(100% - 28.14px) 0,100% 28.14px,100% 100%,28.14px 100%,0 calc(100% - 28.14px))", background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
            <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,#4ee2ff,transparent)", boxShadow: "0 0 12px #4ee2ff", opacity: 0.55, pointerEvents: "none" }} />

            {askJet && cur && (
              <KitDialog accent="red" title="VENT CARGO" width={340} onDismiss={() => setAskJet(false)}>
                <p style={{ margin: "0 0 6px", fontSize: 14.8, lineHeight: 1.55, color: "rgba(240,224,232,.9)" }}>Blow {cur.r.name} out of the bay?</p>
                <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5, color: "rgba(226,196,206,.6)" }}>{cur.qty} m³ drifts off into the dark. No salvage run brings it back.</p>
                <KitDialogActions
                  left={{ label: "VENT", onClick: doJettison, tone: "green" }}
                  right={{ label: "KEEP", onClick: () => setAskJet(false) }}
                />
              </KitDialog>
            )}

            {premium && (
              <KitDialog accent="gold" title="PREMIUM REQUIRED" width={376} onDismiss={() => setPremium(false)}>
                <p style={{ margin: "0 0 6px", fontSize: 14.8, lineHeight: 1.55, color: "rgba(246,236,216,.9)" }}>The trade drone is a premium service.</p>
                <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5, color: "rgba(226,212,182,.6)" }}>With Premium the drone hauls your load to the nearest station and sells it for {cargoValue.toLocaleString()}cr while you keep mining. Without it, you have to dock yourself.</p>
                <KitDialogActions
                  left={{ label: "GET PREMIUM", onClick: () => setPremium(false), tone: "gold" }}
                  right={{ label: "NOT NOW", onClick: () => setPremium(false) }}
                />
              </KitDialog>
            )}

            <div onPointerDown={drag.handleProps.onPointerDown} style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "0 2px 0 2px", marginRight: 34, cursor: "grab", ...drag.handleProps.style }}>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 15.3, letterSpacing: "0.2em", color: "#cfefff" }}>CARGO HOLD</b>
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.2, color: "rgba(196,218,240,.75)" }}>{cls.name.toUpperCase()} · {Math.round(pct * 100)}% LOAD</small>
              <span style={{ flex: 1 }} />
              <CloseButton onClick={requestClose} title="Close" />
            </div>

            <div style={{ position: "relative", display: "grid", gap: 9, padding: "12px 13px 13px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,7,13,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06),inset 0 6px 14px rgba(0,0,0,.5)" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <small style={{ fontFamily: "var(--font-display)", fontSize: 8.9, letterSpacing: "0.24em", color: "rgba(150,190,220,.7)" }}>OCCUPIED VOLUME</small>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <b style={{ fontFamily: "var(--font-display)", fontSize: 30.7, fontWeight: 800, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums", color: "#eaf8ff", textShadow: "0 0 16px rgba(78,226,255,.45)" }}>{used}</b>
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "rgba(180,212,236,.6)" }}>/ {cap} m³</small>
                  </div>
                </div>
                <span style={{ flex: 1 }} />
                <div style={{ display: "grid", gap: 5, justifyItems: "end" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px", background: "rgba(3,6,12,.8)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.55),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
                    <i style={{ width: 5, height: 5, background: "#5cff8a", boxShadow: "0 0 8px #5cff8a", transform: "rotate(45deg)" }} />
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.8, fontVariantNumeric: "tabular-nums", color: "rgba(214,240,224,.85)" }}>{free} m³ FREE</small>
                  </span>
                  <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(180,212,236,.55)" }}>{cargoValue.toLocaleString()}cr · {rows.length} TYPES</small>
                </div>
              </div>

              <div style={{ position: "relative", height: 34, padding: "0 2px", display: "flex", alignItems: "flex-end", gap: 2, background: "linear-gradient(180deg,rgba(4,7,12,.9),rgba(8,13,20,.5) 40%,transparent)", boxShadow: "inset 0 -1px 0 rgba(200,232,250,.14)" }}>
                <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "linear-gradient(180deg,#c8d6e6,#5d6b7c 40%,#161d27)", boxShadow: "0 1px 0 rgba(0,0,0,.9),0 3px 5px rgba(0,0,0,.6)" }} />
                <i style={{ position: "absolute", left: 0, right: 0, bottom: 3, height: 1, background: "linear-gradient(90deg,transparent,rgba(220,240,255,.4),transparent)" }} />
                {cargoTicks.map((t, i) => (
                  <i
                    key={i}
                    onMouseEnter={(e) => { if (t.row) setTickHover({ row: t.row, x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2 }); }}
                    onMouseLeave={() => setTickHover(null)}
                    style={{
                      position: "relative", flex: 1, minWidth: 0, height: t.h,
                      background: `linear-gradient(180deg,${t.top},${t.hex})`,
                      boxShadow: t.hit ? `0 0 ${t.blur} ${t.glow}` : "none", opacity: t.op, transformOrigin: "bottom",
                      animation: t.anim, cursor: t.hit ? "default" : undefined,
                    }}
                  />
                ))}
                <i style={{ position: "absolute", left: "90%", bottom: 0, top: 2, width: 1, background: "repeating-linear-gradient(180deg,rgba(255,77,94,.9) 0 3px,transparent 3px 6px)", boxShadow: "0 0 8px rgba(255,77,94,.7)", pointerEvents: "none" }} />

                {tickHover && (
                  <div style={{
                    position: "absolute", left: tickHover.x, bottom: "calc(100% + 8px)", transform: "translateX(-50%)",
                    zIndex: 25, padding: "6px 10px", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                    background: "linear-gradient(180deg,#1a212c,#0a0d13)", boxShadow: `inset 0 0 0 1px ${rgba(tickHover.row.r.color, 0.4)},0 4px 0 rgba(3,5,10,.9),0 8px 10px rgba(0,0,0,.6),0 0 14px ${rgba(tickHover.row.r.color, 0.35)}`,
                    pointerEvents: "none",
                  }}>
                    <i style={{ width: 5, height: 5, background: tickHover.row.r.color, boxShadow: `0 0 7px ${tickHover.row.r.color}`, transform: "rotate(45deg)", flex: "0 0 auto" }} />
                    <b style={{ fontSize: 13, fontWeight: 700, color: "#eef6ff" }}>{tickHover.row.r.name}</b>
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 11.2, color: "rgba(196,218,240,.6)" }}>x{tickHover.row.qty} · {tickHover.row.value.toLocaleString()}cr</small>
                    <i style={{
                      position: "absolute", left: "50%", top: "100%", width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5,
                      background: "#0a0d13", transform: "rotate(45deg)", boxShadow: `1px 1px 0 ${rgba(tickHover.row.r.color, 0.4)}`,
                    }} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px" }}>
                {rows.map((row) => (
                  <span key={row.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <i style={{ width: 6, height: 6, background: row.r.color, boxShadow: `0 0 7px ${row.r.color}`, transform: "rotate(45deg)" }} />
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", color: "rgba(190,216,238,.65)" }}>{row.r.name.toUpperCase()}</small>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ position: "relative", display: "grid", gap: 6, padding: 10, background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.6)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06),inset 0 6px 14px rgba(0,0,0,.5)", maxHeight: 280, minHeight: 0, overflowY: "auto", alignContent: "start" }}>
              {rows.length === 0 ? (
                <div style={{ padding: "18px 8px", textAlign: "center", fontSize: 13, color: "rgba(190,216,238,.5)", fontStyle: "italic" }}>Cargo bay empty</div>
              ) : rows.map((row, i) => (
                <MaterialRow key={row.id} row={row} i={i} isSel={row.id === curId} onClick={() => setSel(row.id)} />
              ))}
            </div>

            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, padding: "7px 11px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
                {cur ? (
                  <>
                    <i style={{ display: "grid", placeItems: "center", width: 32, height: 28, flex: "0 0 auto", fontSize: 17.7, color: cur.r.color, filter: `drop-shadow(0 0 7px ${cur.r.color})` }}>{cur.r.glyph}</i>
                    <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 14.2, fontWeight: 700, color: "#eef6ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur.r.name}</b>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", color: cur.r.color }}>x{cur.qty} · {cur.value.toLocaleString()}cr</small>
                    </span>
                  </>
                ) : (
                  <small style={{ fontSize: 13, color: "rgba(190,216,238,.5)" }}>No cargo selected</small>
                )}
              </span>
              <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                <KitPillButton
                  onClick={() => cur && setAskJet(true)}
                  disabled={!cur}
                  tone={{
                    rim: "linear-gradient(150deg,#ffdfe3,#a8505c 45%,#2c1015)",
                    mid: "linear-gradient(150deg,#7c3540,#1a0a0e)",
                    bg: "linear-gradient(180deg,rgba(255,77,94,.2),rgba(12,6,10,.94))",
                    color: "#ffd0d5",
                    spec: "rgba(255,214,220,.7)",
                    under: "#ff4d5e",
                  }}
                  icon={<i style={{ position: "relative", fontStyle: "normal", fontSize: 13 }}>⇱</i>}
                >
                  JETTISON
                </KitPillButton>
                <KitPillButton
                  onClick={() => setPremium(true)}
                  tone={{
                    rim: "linear-gradient(150deg,#fff4d2,#e8b94d 46%,#6b4d0c)",
                    mid: "linear-gradient(150deg,#c99a2e,#3a2a06)",
                    bg: "linear-gradient(180deg,rgba(232,185,77,.26),rgba(12,8,4,.95))",
                    color: "#f7e3b2",
                    spec: "rgba(255,244,214,.85)",
                    under: "#e8b94d",
                  }}
                  icon={<i style={{ position: "relative", fontStyle: "normal", fontSize: 13 }}>✦</i>}
                >
                  TRADE DRONE · {cargoValue.toLocaleString()}cr
                </KitPillButton>
              </div>
            </div>
          </div>
        </div>
      </PrintPortal>
    </div>
  );
}
