import { useCallback, useRef } from "react";
import type { HudElement, Vec2 } from "../types";
import styles from "./VertexHandles.module.css";

type VertexHandlesProps = {
  element: HudElement;
  zoom: number;
  onMovePoint: (index: number, point: Vec2) => void;
  onCommit: () => void;
  onAddPoint: (afterIndex: number, point: Vec2) => void;
  onRemovePoint: (index: number) => void;
};

/** One draggable handle per polygon vertex, plus a thin midpoint handle
 * on every edge for adding new points -- this is what lets the user pull
 * any corner, angle, or edge of a shape's outline into whatever silhouette
 * they want (beveled corners, trapezoid sides, angled cuts), matching how
 * a vector-path editor's node tool works. Points are stored as 0..1
 * fractions of the element's own box so dragging math stays independent
 * of canvas zoom -- only the on-screen delta needs dividing by zoom. */
export function VertexHandles({ element, zoom, onMovePoint, onCommit, onAddPoint, onRemovePoint }: VertexHandlesProps) {
  const points = element.points ?? [];
  // Captures the point's value AND the pointer's starting screen position
  // once, at drag start -- every subsequent move computes the new point
  // as origin + total screen delta, entirely independent of `points`
  // (which is stale inside this closure across the whole drag: it was
  // captured at mount/last-render time, and a fresh handleMove closure is
  // NOT created on each store update, only on each React render of this
  // component triggered by a *different* prop change). Anchoring to the
  // last moved-to position instead of the original start would work too,
  // but re-reading a moving `current` from `points` mid-drag is what
  // caused the vertex to freeze after its first frame.
  const dragState = useRef<{ index: number; originScreenX: number; originScreenY: number; originPoint: Vec2 } | null>(
    null
  );

  const handlePointerDown = useCallback(
    (index: number) => (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onCommit();
      const origin = points[index];
      if (!origin) return;
      dragState.current = { index, originScreenX: e.clientX, originScreenY: e.clientY, originPoint: origin };

      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragState.current) return;
        const dx = (moveEvent.clientX - dragState.current.originScreenX) / zoom;
        const dy = (moveEvent.clientY - dragState.current.originScreenY) / zoom;
        const next: Vec2 = {
          x: dragState.current.originPoint.x + dx / element.width,
          y: dragState.current.originPoint.y + dy / element.height,
        };
        onMovePoint(dragState.current.index, next);
      };
      const handleUp = () => {
        dragState.current = null;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [points, element.width, element.height, zoom, onMovePoint, onCommit]
  );

  const handleContextMenu = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onRemovePoint(index);
    },
    [onRemovePoint]
  );

  const handleMidpointClick = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      const a = points[index];
      const b = points[(index + 1) % points.length];
      if (!a || !b) return;
      onAddPoint(index, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    },
    [points, onAddPoint]
  );

  if (points.length === 0) return null;

  return (
    <div className={styles.overlay}>
      {points.map((p, i) => {
        const next = points[(i + 1) % points.length];
        const midX = (p.x + next.x) / 2;
        const midY = (p.y + next.y) / 2;
        return (
          <div key={`edge-${i}`}>
            <div
              className={styles.midpoint}
              style={{ left: `${midX * 100}%`, top: `${midY * 100}%` }}
              onClick={handleMidpointClick(i)}
              title="Click to add a point here"
            />
          </div>
        );
      })}
      {points.map((p, i) => (
        <div
          key={`vertex-${i}`}
          className={styles.vertex}
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          onPointerDown={handlePointerDown(i)}
          onContextMenu={handleContextMenu(i)}
          title="Drag to move · right-click to delete"
        />
      ))}
    </div>
  );
}
