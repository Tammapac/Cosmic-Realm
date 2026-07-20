import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Moveable, { type OnDrag, type OnResize, type OnRotate, type OnDragEnd, type OnResizeEnd, type OnRotateEnd } from "react-moveable";
import { useEditorStore } from "../store";
import { EditableElement } from "./EditableElement";
import { GridOverlay } from "./GridOverlay";
import { GuideLines, type GuideLine } from "./GuideLines";
import { PivotHandle } from "./PivotHandle";
import { VertexHandles } from "./VertexHandles";
import styles from "./EditorCanvas.module.css";

type EditorCanvasProps = {
  showGrid: boolean;
  showSafeArea: boolean;
  snapToGrid: boolean;
  gridSize: number;
  backgroundImage: string | null;
};

/** The zoomable/pannable stage. Renders every visible element absolutely
 * positioned in a fixed 1920x1080 coordinate space, then scales the whole
 * stage with a CSS transform for zoom -- so element x/y/width/height in
 * the store are always canvas-space pixels, independent of the viewport
 * zoom level. react-moveable is attached to the DOM node of the current
 * selection and mutates the store only on *End callbacks (drag/resize/
 * rotate), keeping intermediate frames store-free for performance. */
export function EditorCanvas({ showGrid, showSafeArea, snapToGrid, gridSize, backgroundImage }: EditorCanvasProps) {
  const doc = useEditorStore((s) => s.doc);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const updateElement = useEditorStore((s) => s.updateElement);
  const commit = useEditorStore((s) => s.commit);
  const updatePolygonPoint = useEditorStore((s) => s.updatePolygonPoint);
  const addPolygonPoint = useEditorStore((s) => s.addPolygonPoint);
  const removePolygonPoint = useEditorStore((s) => s.removePolygonPoint);

  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [guideLines, setGuideLines] = useState<GuideLine[]>([]);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const moveableRef = useRef<Moveable>(null);
  const [targetNode, setTargetNode] = useState<HTMLDivElement | null>(null);
  // True for the duration of an active Moveable gesture -- guards the
  // updateRect() sync effect below (see its comment) from firing mid-drag,
  // which was corrupting Moveable's internal drag-origin bookkeeping and
  // causing dragged elements to drift far past the cursor.
  const isInteractingRef = useRef(false);

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedElement = selectedId ? doc.elements[selectedId] : null;

  // elementRefs is a plain ref map, not reactive state -- reading it
  // directly during render can race the child's own ref-callback commit
  // when selection changes in the same tick, leaving Moveable's `target`
  // stale/null and causing it to skip rendering its control box entirely.
  // Re-resolve the DOM node imperatively after paint whenever selection
  // changes so Moveable always mounts against a real, current node.
  useLayoutEffect(() => {
    setTargetNode(selectedId ? elementRefs.current[selectedId] ?? null : null);
  }, [selectedId]);

  const visibleElements = useMemo(
    () => Object.values(doc.elements).filter((e) => !e.hidden).sort((a, b) => a.zIndex - b.zIndex),
    [doc.elements]
  );

  const elementGuidelines = useMemo(
    () =>
      Object.values(elementRefs.current).filter((el): el is HTMLDivElement => !!el && el !== targetNode),
    [doc.elements, targetNode]
  );

  // Plain wheel zooms, anchored on the cursor position (so whatever is
  // under the mouse stays under the mouse as the zoom level changes --
  // same convention as most map/canvas tools). Shift+wheel pans instead
  // (useful for trackpads/mice without a horizontal scroll axis); the
  // .viewport's overflow:hidden would otherwise make the canvas feel
  // completely unscrollable once content exceeds the screen, so panning
  // still needs a wheel-based path even with zoom as the plain-wheel
  // default.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // No e.preventDefault() here: React attaches wheel listeners as
    // passive by default, so the call was a silent no-op (logged as
    // "Unable to preventDefault inside passive event listener
    // invocation" on every tick) -- harmless, but also unnecessary,
    // since .viewport already has overflow:hidden and there's no native
    // page-scroll behavior on this element to suppress.
    if (e.shiftKey) {
      const deltaX = e.deltaX;
      const deltaY = e.deltaY;
      setPan((p) => ({ x: p.x - deltaY, y: p.y - deltaX }));
      return;
    }
    // Read everything off the synthetic event synchronously, BEFORE any
    // setState call -- React recycles/nulls out pooled synthetic event
    // fields (including e.currentTarget) once the handler that received
    // them returns, so referencing e.currentTarget/e.clientX/e.deltaY
    // from INSIDE a setZoom functional updater (which can run in a later,
    // separate render pass, e.g. when batched with the nested setPan
    // call below) reads a null target and throws "Cannot read properties
    // of null (reading 'getBoundingClientRect')". That uncaught throw
    // during render unmounted this whole component tree, which is why an
    // uploaded reference image (owned by a state hook one level up in
    // HudEditor) appeared to "vanish" after a couple of wheel-zoom ticks.
    const deltaY = e.deltaY;
    const viewportRect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const cursorX = e.clientX - viewportRect.left;
    const cursorY = e.clientY - viewportRect.top;
    setZoom((prevZoom) => {
      const nextZoom = Math.max(0.1, Math.min(3, prevZoom - deltaY * 0.001));
      setPan((prevPan) => {
        // Keep the canvas point currently under the cursor fixed on
        // screen: solve for the new pan such that
        // (cursor - newPan) / nextZoom === (cursor - prevPan) / prevZoom.
        const canvasX = (cursorX - prevPan.x) / prevZoom;
        const canvasY = (cursorY - prevPan.y) / prevZoom;
        return {
          x: cursorX - canvasX * nextZoom,
          y: cursorY - canvasY * nextZoom,
        };
      });
      return nextZoom;
    });
  }, []);

  const handleStagePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        e.preventDefault();
        return;
      }
      if (e.target === stageRef.current || (e.target as HTMLElement).dataset.canvasBg) {
        select([]);
      }
    },
    [pan, select]
  );

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!isPanning.current) return;
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    };
    const handleUp = () => {
      isPanning.current = false;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  // Keep Moveable's handles in sync whenever the selected element's
  // transform changes via a source OTHER than Moveable itself (inspector
  // field edits, pivot handle drag) -- Moveable only tracks the DOM node's
  // transform live during its own drag/resize/rotate gestures, so external
  // store writes need an explicit updateRect() to refresh the handle
  // positions/angle. MUST be skipped while a gesture is active: Moveable's
  // onDragEnd-triggered updateElement() call changes these same deps,
  // re-running this effect DURING drag-end processing and re-baselining
  // Moveable's internal drag-origin against the just-updated DOM position
  // -- that corrupted origin is what made dragged elements rocket off far
  // past the cursor and made repeated drags compound the drift.
  useLayoutEffect(() => {
    if (isInteractingRef.current) return;
    // Guard against calling updateRect() when <Moveable> isn't actually
    // mounted (no selection, element locked, or a "polygon" kind that
    // deliberately renders no Moveable at all -- see the JSX below).
    // moveableRef.current can briefly still hold a reference to an
    // already-unmounted Moveable instance across a fast sequence of
    // zoom/pan updates (e.g. rapid wheel events), and calling
    // updateRect() on it then throws "Cannot read properties of null
    // (reading 'getBoundingClientRect')" from Moveable's own internals --
    // which crashes this whole component (and, with it, any parent state
    // like HudEditor's uploaded reference image) since there's no error
    // boundary above it.
    if (!targetNode || !selectedElement || selectedElement.locked || selectedElement.kind === "polygon") return;
    // Belt-and-suspenders: even with the guard above, swallow any error
    // from a still-stale internal Moveable ref rather than letting it
    // propagate and unmount this whole component (there's no error
    // boundary above it, so an uncaught throw here previously reset
    // HudEditor's React state entirely, silently discarding things like
    // an uploaded reference image).
    try {
      moveableRef.current?.updateRect();
    } catch {
      // ignore -- next render/effect pass will resync once Moveable's
      // target is valid again
    }
  }, [
    targetNode,
    selectedElement?.x,
    selectedElement?.y,
    selectedElement?.width,
    selectedElement?.height,
    selectedElement?.rotation,
    selectedElement?.pivot.x,
    selectedElement?.pivot.y,
    zoom,
    pan.x,
    pan.y,
  ]);

  const handleElementPointerDown = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      const el = doc.elements[id];
      if (el?.locked) return;
      e.stopPropagation();
      if (e.shiftKey) {
        useEditorStore.getState().toggleSelect(id);
      } else if (!selectedIds.includes(id)) {
        select([id]);
      }
    },
    [doc.elements, selectedIds, select]
  );

  return (
    <div
      className={styles.viewport}
      onWheel={handleWheel}
      onPointerDown={handleStagePointerDown}
      style={{ cursor: isPanning.current ? "grabbing" : "default" }}
    >
      <div
        ref={stageRef}
        className={styles.stage}
        data-canvas-bg
        style={{
          width: doc.canvasWidth,
          height: doc.canvasHeight,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {backgroundImage && (
          <img src={backgroundImage} alt="" className={styles.backgroundImage} draggable={false} data-canvas-bg />
        )}
        <GridOverlay
          width={doc.canvasWidth}
          height={doc.canvasHeight}
          gridSize={gridSize}
          showGrid={showGrid}
          showSafeArea={showSafeArea}
        />
        {visibleElements
          .filter((el) => el.parentId === null)
          .map((el) => (
            <EditableElement
              key={el.id}
              element={el}
              selected={selectedIds.includes(el.id)}
              zoom={zoom}
              onPointerDown={handleElementPointerDown(el.id)}
              ref={(node) => {
                elementRefs.current[el.id] = node;
              }}
            />
          ))}
        {selectedElement && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: selectedElement.width,
              height: selectedElement.height,
              // PivotHandle's own left/top: % styles are relative to
              // THIS wrapper's box, not the whole 1920x1080 stage -- it
              // was previously rendered as a sibling of the element list
              // directly inside the stage, which made a 50% pivot land
              // at 50% of the stage's width/height (roughly the canvas
              // center) instead of the middle of the selected element,
              // making it appear to "not show up" far from the actual
              // box. Same z-index-vs-stacking-context note as the
              // polygon overlay below applies here too.
              zIndex: 3600,
              transform: `translate(${selectedElement.x}px, ${selectedElement.y}px) rotate(${selectedElement.rotation}deg)`,
              transformOrigin: `${selectedElement.pivot.x * 100}% ${selectedElement.pivot.y * 100}%`,
              pointerEvents: "none",
            }}
          >
            <PivotHandle
              element={selectedElement}
              zoom={zoom}
              onChange={(pivot) => updateElement(selectedElement.id, { pivot })}
              onCommit={commit}
            />
          </div>
        )}
        {/* Vertex handles for the outer silhouette -- shown for plain
            "polygon" shapes AND for the real HUD components (their
            outline starts pre-filled with the shipped clip-path, see
            defaultHudSilhouette in types.ts), since dragging a corner is
            how the user reshapes a component's own contour without
            touching its internal content. */}
        {selectedElement && !!selectedElement.points && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: selectedElement.width,
              height: selectedElement.height,
              // Every EditableElement carries an explicit z-index (even
              // just "1"), which promotes it to its own stacking context
              // that wins over same-level siblings regardless of DOM
              // order -- so this overlay needs a higher explicit z-index
              // of its own, not just "render it later".
              zIndex: 9999,
              transform: `translate(${selectedElement.x}px, ${selectedElement.y}px) rotate(${selectedElement.rotation}deg)`,
              transformOrigin: `${selectedElement.pivot.x * 100}% ${selectedElement.pivot.y * 100}%`,
            }}
          >
            <VertexHandles
              element={selectedElement}
              zoom={zoom}
              onMovePoint={(index, point) => updatePolygonPoint(selectedElement.id, index, point)}
              onCommit={commit}
              onAddPoint={(afterIndex, point) => addPolygonPoint(selectedElement.id, afterIndex, point)}
              onRemovePoint={(index) => removePolygonPoint(selectedElement.id, index)}
            />
          </div>
        )}
        <GuideLines width={doc.canvasWidth} height={doc.canvasHeight} lines={guideLines} />
      </div>

      {/* Plain "polygon" shapes are moved entirely through their own
          vertex handles + EditableElement's own drag-to-move (see there)
          instead of Moveable. Any element WITH vertex points (plain
          shapes and, since defaultHudSilhouette, the real HUD components
          too) also gets resizable=false: Moveable's resize UI isn't just
          8 corner/edge dots, it draws `.moveable-line` control lines
          along the ENTIRE box perimeter, which sit on top of the vertex
          handles for the ~10 of 12 Hotbar silhouette points that fall
          along an edge rather than exactly on a Moveable resize handle --
          measured directly via elementFromPoint, only the 2 points on the
          angled top cut (not touching any edge) were ever reachable with
          resizable left on. Dragging (whole-shape move) and rotating stay
          on Moveable either way; box size is still adjustable via the
          Inspector's W/H fields, just not via a drag handle that would
          otherwise blanket every vertex dot. */}
      {targetNode && selectedElement && !selectedElement.locked && selectedElement.kind !== "polygon" && (
        <Moveable
          ref={moveableRef}
          target={targetNode}
          className={selectedElement.points ? "moveable-no-lines" : undefined}
          draggable
          resizable={!selectedElement.points}
          renderDirections={selectedElement.points ? [] : undefined}
          hideDefaultLines={!!selectedElement.points}
          rotatable
          throttleDrag={0}
          throttleResize={0}
          throttleRotate={0}
          snappable={snapToGrid}
          snapGridWidth={gridSize}
          snapGridHeight={gridSize}
          isDisplaySnapDigit
          elementGuidelines={elementGuidelines}
          snapDirections={{ top: true, right: true, bottom: true, left: true, center: true, middle: true }}
          elementSnapDirections={{ top: true, right: true, bottom: true, left: true, center: true, middle: true }}
          zoom={1}
          useResizeObserver
          useMutationObserver
          origin={false}
          onDragStart={() => {
            isInteractingRef.current = true;
            commit();
          }}
          onDrag={(e: OnDrag) => {
            e.target.style.transform = e.transform;
          }}
          onDragEnd={(e: OnDragEnd) => {
            isInteractingRef.current = false;
            if (!e.lastEvent) return;
            // beforeTranslate is already the resulting canvas-space
            // position (it factors in the stage's scale() automatically
            // via getBoundingClientRect, AND already includes the
            // element's pre-drag position) -- NOT a delta to add on top
            // of selectedElement.x/y. Adding them was double-counting the
            // starting position on every single drag, which is exactly
            // why a dragged element rocketed off far past the cursor and
            // why repeated drags compounded the drift.
            const [x, y] = e.lastEvent.beforeTranslate;
            updateElement(selectedElement.id, { x, y });
            setGuideLines([]);
            moveableRef.current?.updateRect();
          }}
          onResizeStart={() => {
            isInteractingRef.current = true;
            commit();
          }}
          onResize={(e: OnResize) => {
            e.target.style.width = `${e.width}px`;
            e.target.style.height = `${e.height}px`;
            e.target.style.transform = e.drag.transform;
          }}
          onResizeEnd={(e: OnResizeEnd) => {
            isInteractingRef.current = false;
            if (!e.lastEvent) return;
            const { width, height, drag } = e.lastEvent;
            // Same "already absolute, not a delta" fix as onDragEnd above.
            const [x, y] = drag.beforeTranslate;
            updateElement(selectedElement.id, {
              width: Math.max(4, width),
              height: Math.max(4, height),
              x,
              y,
            });
            moveableRef.current?.updateRect();
          }}
          onRotateStart={() => {
            isInteractingRef.current = true;
            commit();
          }}
          onRotate={(e: OnRotate) => {
            e.target.style.transform = e.drag.transform;
          }}
          onRotateEnd={(e: OnRotateEnd) => {
            isInteractingRef.current = false;
            if (!e.lastEvent) return;
            updateElement(selectedElement.id, { rotation: e.lastEvent.rotate });
            moveableRef.current?.updateRect();
          }}
        />
      )}
    </div>
  );
}
