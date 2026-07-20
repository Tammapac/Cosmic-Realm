import { useMemo, useState } from "react";
import { useEditorStore } from "../store";
import type { HudElement } from "../types";
import styles from "./LayerPanel.module.css";

/** Tree view of all elements (root-level + nested groups), ordered by
 * z-index descending (topmost paint = topmost row, the usual layer-panel
 * convention). Supports select, multi-select (shift), rename, lock,
 * hide, and reordering via up/down buttons -- drag-to-reorder is left for
 * a later pass since z-index buttons already cover the MVP requirement. */
export function LayerPanel() {
  const doc = useEditorStore((s) => s.doc);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const toggleHidden = useEditorStore((s) => s.toggleHidden);
  const updateElement = useEditorStore((s) => s.updateElement);
  const setZIndex = useEditorStore((s) => s.setZIndex);
  const removeElements = useEditorStore((s) => s.removeElements);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, HudElement[]>();
    for (const el of Object.values(doc.elements)) {
      const list = map.get(el.parentId) ?? [];
      list.push(el);
      map.set(el.parentId, list);
    }
    for (const list of map.values()) list.sort((a, b) => b.zIndex - a.zIndex);
    return map;
  }, [doc.elements]);

  function startRename(el: HudElement) {
    setRenamingId(el.id);
    setRenameValue(el.name);
  }

  function commitRename() {
    if (renamingId) updateElement(renamingId, { name: renameValue.trim() || "Element" });
    setRenamingId(null);
  }

  function bump(el: HudElement, dir: 1 | -1) {
    setZIndex(el.id, el.zIndex + dir);
  }

  function renderNode(el: HudElement, depth: number) {
    const isSelected = selectedIds.includes(el.id);
    const children = childrenByParent.get(el.id) ?? [];

    return (
      <div key={el.id}>
        <div
          data-layer-row={el.id}
          className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={(e) => {
            if (e.shiftKey) toggleSelect(el.id);
            else select([el.id]);
          }}
        >
          <span className={styles.kindDot} data-kind={el.kind} />
          {renamingId === el.id ? (
            <input
              autoFocus
              className={styles.renameInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenamingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={styles.name} onDoubleClick={() => startRename(el)}>
              {el.name}
            </span>
          )}
          <span className={styles.actions}>
            <button
              className={styles.iconBtn}
              title="Move up"
              onClick={(e) => {
                e.stopPropagation();
                bump(el, 1);
              }}
            >
              ▲
            </button>
            <button
              className={styles.iconBtn}
              title="Move down"
              onClick={(e) => {
                e.stopPropagation();
                bump(el, -1);
              }}
            >
              ▼
            </button>
            <button
              className={`${styles.iconBtn} ${el.locked ? styles.iconActive : ""}`}
              title="Lock"
              onClick={(e) => {
                e.stopPropagation();
                toggleLock(el.id);
              }}
            >
              {el.locked ? "🔒" : "🔓"}
            </button>
            <button
              className={`${styles.iconBtn} ${el.hidden ? styles.iconActive : ""}`}
              title="Toggle visibility"
              onClick={(e) => {
                e.stopPropagation();
                toggleHidden(el.id);
              }}
            >
              {el.hidden ? "🚫" : "👁"}
            </button>
            <button
              className={styles.iconBtn}
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                removeElements([el.id]);
              }}
            >
              ✕
            </button>
          </span>
        </div>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  const roots = childrenByParent.get(null) ?? [];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Layers</div>
      <div className={styles.tree}>
        {roots.length === 0 ? (
          <div className={styles.empty}>No elements yet</div>
        ) : (
          roots.map((el) => renderNode(el, 0))
        )}
      </div>
    </div>
  );
}
