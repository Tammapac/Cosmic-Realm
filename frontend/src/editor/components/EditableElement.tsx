import { forwardRef, useCallback, useRef } from "react";
import { useEditorStore } from "../store";
import type { HudElement } from "../types";
import { HudComponentPreview } from "./HudComponentPreview";
import { PolygonPreview } from "./PolygonPreview";
import styles from "./EditableElement.module.css";

const HUD_COMPONENT_KINDS = new Set(["hud-hotbar", "hud-player-status", "hud-health-bar", "hud-shield-bar"]);

type EditableElementProps = {
  element: HudElement;
  selected: boolean;
  zoom: number;
  onPointerDown: (e: React.PointerEvent) => void;
};

/** Renders a single HudElement at its stored transform. react-moveable
 * targets this DOM node directly by ref during drag/resize/rotate, so the
 * store only needs to be updated onDragEnd/onResizeEnd/onRotateEnd (see
 * EditorCanvas) rather than on every intermediate frame.
 *
 * Polygon elements are the one exception: Moveable is disabled for them
 * entirely (see EditorCanvas) because its always-on drag outline sits in
 * the same on-screen position as our own vertex handles with no reliable
 * z-index to separate the two portal-rendered layers, making it a coin
 * flip which one a click lands on. So polygons get their own minimal
 * pointer-drag-to-move implementation right here instead. */
export const EditableElement = forwardRef<HTMLDivElement, EditableElementProps>(
  ({ element, selected, zoom, onPointerDown }, ref) => {
    const updateElement = useEditorStore((s) => s.updateElement);
    const commit = useEditorStore((s) => s.commit);
    const dragState = useRef<{ startX: number; startY: number } | null>(null);

    const handlePolygonPointerDown = useCallback(
      (e: React.PointerEvent) => {
        onPointerDown(e);
        if (element.locked) return;
        commit();
        dragState.current = { startX: e.clientX, startY: e.clientY };

        const handleMove = (moveEvent: PointerEvent) => {
          if (!dragState.current) return;
          const dx = (moveEvent.clientX - dragState.current.startX) / zoom;
          const dy = (moveEvent.clientY - dragState.current.startY) / zoom;
          updateElement(element.id, { x: element.x + dx, y: element.y + dy });
          dragState.current = { startX: moveEvent.clientX, startY: moveEvent.clientY };
        };
        const handleUp = () => {
          dragState.current = null;
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      },
      [element.id, element.locked, element.x, element.y, zoom, onPointerDown, updateElement, commit]
    );

    if (element.hidden) return null;

    const transform = `translate(${element.x}px, ${element.y}px) rotate(${element.rotation}deg)`;
    const transformOrigin = `${element.pivot.x * 100}% ${element.pivot.y * 100}%`;
    const isPolygon = element.kind === "polygon";

    return (
      <div
        ref={ref}
        data-element-id={element.id}
        className={[styles.element, selected ? styles.selected : "", element.locked ? styles.locked : ""].join(" ")}
        style={{
          width: element.width,
          height: element.height,
          transform,
          transformOrigin,
          zIndex: element.zIndex,
          opacity: element.opacity,
          ...(isPolygon ? {} : element.style),
        }}
        onPointerDown={isPolygon ? handlePolygonPointerDown : onPointerDown}
      >
        {isPolygon ? (
          <PolygonPreview points={element.points ?? []} style={element.style} />
        ) : element.kind === "text" ? (
          <span className={styles.textContent}>{element.text}</span>
        ) : HUD_COMPONENT_KINDS.has(element.kind) ? (
          <div
            style={
              element.points
                ? {
                    position: "absolute",
                    inset: 0,
                    clipPath: `polygon(${element.points.map((p) => `${p.x * 100}% ${p.y * 100}%`).join(", ")})`,
                  }
                : { position: "absolute", inset: 0 }
            }
          >
            <HudComponentPreview kind={element.kind} boxWidth={element.width} boxHeight={element.height} />
          </div>
        ) : element.kind === "group" ? null : (
          <span className={styles.kindLabel}>{element.name}</span>
        )}
      </div>
    );
  }
);
EditableElement.displayName = "EditableElement";
