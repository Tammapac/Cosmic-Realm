// Shared hover plumbing for the rich ItemTooltip (design handoff §3.6).
//
// The tooltip has to render in VIEWPORT space, not inside the panel that owns
// the slot: every one of those panels has `overflow: hidden` on its scroll
// area, which would clip the card. Each call site would otherwise repeat the
// same three pieces — hover state, a rect-to-position calculation, and a fixed
// layer — so they live here once.
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ModuleItem } from "../game/types";
import { ItemTooltip } from "../components/ItemTooltip";

interface HoverState {
  item: ModuleItem;
  equipped?: ModuleItem | null;
  action?: string;
  x: number;
  y: number;
}

/** Roughly the card's footprint; used to keep it inside the viewport. */
const CARD_W = 300;
const CARD_H = 320;

export function useItemTooltip() {
  const [hover, setHover] = useState<HoverState | null>(null);

  /** Attach to a slot element's pointer handlers. */
  const bind = (
    item: ModuleItem,
    opts?: { equipped?: ModuleItem | null; action?: string },
  ) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      // Prefer the right side of the slot; flip left when that would run off
      // the edge, so slots near the right border still show a full card.
      const x = r.right + 10 + CARD_W > window.innerWidth ? r.left - CARD_W - 10 : r.right + 10;
      setHover({
        item,
        equipped: opts?.equipped ?? null,
        action: opts?.action,
        x: Math.max(8, x),
        y: Math.max(8, Math.min(r.top, window.innerHeight - CARD_H)),
      });
    },
    onPointerLeave: () =>
      setHover((h) => (h?.item.instanceId === item.instanceId ? null : h)),
  });

  const clear = () => setHover(null);

  // PORTAL, not just position:fixed. The panels that own these slots use
  // `clip-path` for their chamfered silhouette, and clip-path clips fixed
  // descendants too — so a card rendered in the tree got cut off at the
  // panel edge. Escaping to <body> is the only reliable fix.
  const layer: ReactNode = hover
    ? createPortal(
        <div
          style={{
            position: "fixed",
            left: hover.x,
            top: hover.y,
            zIndex: 4000,
            pointerEvents: "none",
          }}
        >
          <ItemTooltip item={hover.item} equipped={hover.equipped} action={hover.action} />
        </div>,
        document.body,
      )
    : null;

  return { bind, clear, layer };
}
