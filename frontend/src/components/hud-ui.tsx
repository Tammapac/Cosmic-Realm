/**
 * hud-ui — the shared window/dialog/button component library.
 *
 * DESIGN SYSTEM (extracted from the existing HUD — hotbar, minimap, chat,
 * top panel — via hud-tokens.css / hud-materials.css / HudFrame):
 *
 *   Material    navy metal: gradient rgba(14,22,40,.92)→rgba(8,14,26,.9),
 *               brushed horizontal grain + diagonal micro-noise, machined
 *               bevel (light top rim, dark bottom shade), scanlines,
 *               backdrop blur(3px)
 *   Frame       crisp 1px accent RING (element bg shows as the border,
 *               fill inset by 1px) — cyan rgba(78,226,255,.85) standard,
 *               gold rgba(232,185,77,.75) for featured windows
 *   Corners     beveled cuts, radius 0 everywhere (tl/br 10px on plates,
 *               8-point cut on framed windows, 4px on buttons/slots)
 *   Accents     cyan #4ee2ff = energy/interactive · gold #e8b94d =
 *               currency/confirm · red #ff4d5e = danger
 *   Title band  2px cyan tick + tracked uppercase Kenney text, gradient
 *               wash left→right, 1px dim divider below
 *   Buttons     .gbtn family ONLY (corner ticks, plate, hover glow):
 *               default=secondary · gbtn-gold=primary/confirm ·
 *               gbtn-red=danger; disabled dims text+ticks
 *   Type        Kenney Future Narrow for EVERYTHING in windows
 *               (var(--font-display)), tracked uppercase labels,
 *               tabular-nums for numbers
 *   Depth       0 4px 18px black shadow + inner 34px black inset
 *
 * These components wrap the skin classes (hud-skin.css) so every window
 * is built from the same primitives — never hand-roll a popup again.
 */
import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from "react";

/** Standard window plate: ring frame + title band + content. */
export function HudWindow({
  title,
  onClose,
  children,
  footer,
  width,
  style,
  dragHandle,
  gold,
}: {
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  style?: CSSProperties;
  dragHandle?: { onPointerDown: (e: ReactPointerEvent) => void; style: CSSProperties };
  gold?: boolean;
}) {
  return (
    <div
      className={`panel ${gold ? "panel-gold" : ""}`}
      style={{ width, maxWidth: "94vw", maxHeight: "88vh", display: "flex", flexDirection: "column", ...style }}
    >
      <div
        className="hud-titleband"
        onPointerDown={dragHandle?.onPointerDown}
        style={{ padding: "7px 12px", letterSpacing: "0.28em", ...(dragHandle?.style ?? {}) }}
      >
        <span style={{ flex: 1, minWidth: 0 }} className="truncate">{title}</span>
        {onClose && (
          <button className="gbtn gbtn-red" style={{ padding: "1px 8px", fontSize: 10 }} onClick={onClose} title="Close">
            ✕
          </button>
        )}
      </div>
      <div style={{ minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>{children}</div>
      {footer && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "10px 12px", borderTop: "1px solid var(--hud-border-dim)", flexShrink: 0 }}>
          {footer}
        </div>
      )}
    </div>
  );
}

/** Modal wrapper: dimmed backdrop, centered window, backdrop-click closes. */
export function HudDialog({
  title,
  onClose,
  children,
  footer,
  width = 420,
  zIndex = 9999,
  gold,
}: {
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  zIndex?: number;
  gold?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <HudWindow title={title} onClose={onClose} footer={footer} width={width} gold={gold}>
        {children}
      </HudWindow>
    </div>
  );
}

/** Horizontal divider in the panel language. */
export function HudDivider({ style }: { style?: CSSProperties }) {
  return <div className="sci-divider" style={{ height: 1, margin: "8px 0", ...style }} />;
}

/** Button family wrapper — variants map onto the gbtn skin classes. */
export function HudButton({
  variant = "secondary",
  children,
  style,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
}) {
  const cls = variant === "primary" ? "gbtn gbtn-gold" : variant === "danger" ? "gbtn gbtn-red" : "gbtn";
  return (
    <button {...props} className={`${cls} ${className}`} style={{ padding: "6px 18px", fontSize: 11, ...style }}>
      {children}
    </button>
  );
}
