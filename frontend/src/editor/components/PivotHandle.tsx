import { useCallback, useRef } from "react";
import type { HudElement } from "../types";
import styles from "./PivotHandle.module.css";

type PivotHandleProps = {
  element: HudElement;
  zoom: number;
  onChange: (pivot: { x: number; y: number }) => void;
  onCommit: () => void;
};

/** Draggable crosshair marking the element's pivot (rotation/scale
 * origin). Rendered in canvas space at the element's current transform,
 * so it tracks rotation visually; dragging it updates pivot as a 0..1
 * fraction of the element's own box, independent of canvas zoom. */
export function PivotHandle({ element, zoom, onChange, onCommit }: PivotHandleProps) {
  // Origin pivot + origin screen position are captured once at drag
  // start; every move computes origin + total delta. Re-deriving "current
  // pivot" from `element.pivot` inside handleMove would read a value
  // frozen at closure-creation time (this callback isn't recreated on
  // every onChange-triggered re-render), making the handle freeze after
  // its first move frame -- the same bug class as VertexHandles' drag.
  const dragState = useRef<{ startX: number; startY: number; originPivot: { x: number; y: number } } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = { startX: e.clientX, startY: e.clientY, originPivot: element.pivot };

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragState.current) return;
        // Pivot handle sits inside the (rotated) element's own coordinate
        // space via the parent's transform, so raw client delta divided by
        // zoom + element size is enough -- rotation is handled by the
        // browser because this handle is a child of the rotated element.
        const dx = (moveEvent.clientX - dragState.current.startX) / zoom;
        const dy = (moveEvent.clientY - dragState.current.startY) / zoom;
        const newX = Math.max(0, Math.min(1, dragState.current.originPivot.x + dx / element.width));
        const newY = Math.max(0, Math.min(1, dragState.current.originPivot.y + dy / element.height));
        onChange({ x: newX, y: newY });
      };

      const handleUp = () => {
        dragState.current = null;
        onCommit();
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [element.pivot, element.width, element.height, zoom, onChange, onCommit]
  );

  return (
    <div
      className={styles.pivot}
      style={{
        left: `${element.pivot.x * 100}%`,
        top: `${element.pivot.y * 100}%`,
      }}
      onPointerDown={handlePointerDown}
      title="Drag to move pivot"
    >
      <div className={styles.crosshairV} />
      <div className={styles.crosshairH} />
      <div className={styles.dot} />
    </div>
  );
}
