import { useRef, useState, useCallback, useEffect } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

/**
 * useDraggable — makes a window movable by dragging its title band.
 *
 * Usage:
 *   const drag = useDraggable("inventory");
 *   <div style={{ ...yourStyle, ...drag.style }}>          // the window
 *     <div className="hud-titleband" {...drag.handleProps}> // the handle
 *
 * The offset is applied as a CSS transform, so it composes with any
 * existing positioning (fixed/absolute/flex-centered). Positions persist
 * per window id for the whole session (module map, survives close/open),
 * and are clamped so a window can never be dragged fully off screen.
 * Pointer-down on buttons/inputs inside the handle is ignored, so close
 * buttons in title bands keep working.
 */
const sessionPositions = new Map<string, { x: number; y: number }>();

const EDGE = 70; // px of the window that must stay reachable

export function useDraggable(
  id: string,
  opts?: { resetOnMount?: boolean },
): {
  style: CSSProperties;
  handleProps: { onPointerDown: (e: ReactPointerEvent) => void; style: CSSProperties };
} {
  // resetOnMount: the window always opens at its fixed CSS default position;
  // any drag offset from a previous open is cleared each time it mounts, so
  // re-opening always lands it back at the default (dragging still works for
  // the current session until it's closed again).
  const [pos, setPos] = useState(() =>
    opts?.resetOnMount ? { x: 0, y: 0 } : sessionPositions.get(id) ?? { x: 0, y: 0 },
  );
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (opts?.resetOnMount) sessionPositions.delete(id);
  }, [id, opts?.resetOnMount]);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("button, input, select, textarea, a")) return;
    const start = sessionPositions.get(id) ?? { x: 0, y: 0 };
    drag.current = { sx: e.clientX, sy: e.clientY, ox: start.x, oy: start.y };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const nx = Math.max(-(window.innerWidth - EDGE), Math.min(window.innerWidth - EDGE, d.ox + ev.clientX - d.sx));
      const ny = Math.max(-(window.innerHeight - EDGE), Math.min(window.innerHeight - EDGE, d.oy + ev.clientY - d.sy));
      const p = { x: nx, y: ny };
      sessionPositions.set(id, p);
      setPos(p);
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  }, [id]);

  return {
    style: pos.x !== 0 || pos.y !== 0 ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : {},
    handleProps: { onPointerDown, style: { cursor: "move", touchAction: "none", userSelect: "none" } },
  };
}
