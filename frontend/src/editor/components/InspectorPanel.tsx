import { useEditorStore } from "../store";
import { defaultPolygonPoints } from "../types";
import styles from "./InspectorPanel.module.css";

const ANCHOR_PRESETS: { label: string; pivot: { x: number; y: number } }[] = [
  { label: "↖", pivot: { x: 0, y: 0 } },
  { label: "↑", pivot: { x: 0.5, y: 0 } },
  { label: "↗", pivot: { x: 1, y: 0 } },
  { label: "←", pivot: { x: 0, y: 0.5 } },
  { label: "•", pivot: { x: 0.5, y: 0.5 } },
  { label: "→", pivot: { x: 1, y: 0.5 } },
  { label: "↙", pivot: { x: 0, y: 1 } },
  { label: "↓", pivot: { x: 0.5, y: 1 } },
  { label: "↘", pivot: { x: 1, y: 1 } },
];

/** MVP inspector: transform fields only (position, size, rotation, pivot,
 * opacity, z-index). Style/color/border/state editing are later phases
 * per the project's staged rollout. */
export function InspectorPanel() {
  const doc = useEditorStore((s) => s.doc);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const updateElement = useEditorStore((s) => s.updateElement);
  const commit = useEditorStore((s) => s.commit);
  const align = useEditorStore((s) => s.align);
  const duplicateElements = useEditorStore((s) => s.duplicateElements);
  const groupElements = useEditorStore((s) => s.groupElements);
  const ungroup = useEditorStore((s) => s.ungroup);
  const removeElements = useEditorStore((s) => s.removeElements);

  if (selectedIds.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Inspector</div>
        <div className={styles.empty}>Select an element to edit its properties</div>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Inspector · {selectedIds.length} selected</div>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Align</div>
          <div className={styles.alignRow}>
            <button onClick={() => align(selectedIds, "left")}>⇤</button>
            <button onClick={() => align(selectedIds, "centerX")}>⇔</button>
            <button onClick={() => align(selectedIds, "right")}>⇥</button>
            <button onClick={() => align(selectedIds, "top")}>⇱</button>
            <button onClick={() => align(selectedIds, "centerY")}>⇕</button>
            <button onClick={() => align(selectedIds, "bottom")}>⇲</button>
          </div>
          <div className={styles.buttonRow}>
            <button onClick={() => groupElements(selectedIds)}>Group</button>
            <button onClick={() => duplicateElements(selectedIds)}>Duplicate</button>
            <button className={styles.danger} onClick={() => removeElements(selectedIds)}>
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  const el = doc.elements[selectedIds[0]];
  if (!el) return null;

  function field(
    label: string,
    value: number,
    onChange: (v: number) => void,
    opts?: { step?: number; min?: number; max?: number }
  ) {
    return (
      <label className={styles.field}>
        <span>{label}</span>
        <input
          type="number"
          value={Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0}
          step={opts?.step ?? 1}
          min={opts?.min}
          max={opts?.max}
          onFocus={() => commit()}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
      </label>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Inspector</div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Transform</div>
        <div className={styles.grid2}>
          {field("X", el.x, (v) => updateElement(el.id, { x: v }))}
          {field("Y", el.y, (v) => updateElement(el.id, { y: v }))}
          {field("W", el.width, (v) => updateElement(el.id, { width: Math.max(1, v) }), { min: 1 })}
          {field("H", el.height, (v) => updateElement(el.id, { height: Math.max(1, v) }), { min: 1 })}
          {field("Rotation", el.rotation, (v) => updateElement(el.id, { rotation: v }), { step: 1 })}
          {field("Z-Index", el.zIndex, (v) => updateElement(el.id, { zIndex: v }), { step: 1 })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Pivot / Anchor</div>
        <div className={styles.anchorGrid}>
          {ANCHOR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={
                Math.abs(el.pivot.x - preset.pivot.x) < 0.01 && Math.abs(el.pivot.y - preset.pivot.y) < 0.01
                  ? styles.anchorActive
                  : ""
              }
              onClick={() => {
                commit();
                updateElement(el.id, { pivot: preset.pivot });
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className={styles.grid2}>
          {field("Pivot X", el.pivot.x, (v) => updateElement(el.id, { pivot: { ...el.pivot, x: v } }), {
            step: 0.05,
            min: 0,
            max: 1,
          })}
          {field("Pivot Y", el.pivot.y, (v) => updateElement(el.id, { pivot: { ...el.pivot, y: v } }), {
            step: 0.05,
            min: 0,
            max: 1,
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Appearance</div>
        <div className={styles.grid2}>
          {field("Opacity", el.opacity, (v) => updateElement(el.id, { opacity: Math.max(0, Math.min(1, v)) }), {
            step: 0.05,
            min: 0,
            max: 1,
          })}
        </div>
      </div>

      {el.kind === "polygon" && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Shape ({(el.points ?? []).length} points)</div>
          <p className={styles.hint}>
            Drag the gold dots on the canvas to reshape corners and edges (they sit slightly inside the
            blue resize handles). Hover an edge for a faint add-point dot; right-click a gold dot to
            delete it (minimum 3 points).
          </p>
          <div className={styles.buttonRow}>
            <button onClick={() => updateElement(el.id, { points: defaultPolygonPoints() })}>Reset to rectangle</button>
          </div>
        </div>
      )}

      {el.kind === "text" && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Text</div>
          <textarea
            className={styles.textarea}
            value={el.text ?? ""}
            onFocus={() => commit()}
            onChange={(e) => updateElement(el.id, { text: e.target.value })}
          />
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Actions</div>
        <div className={styles.buttonRow}>
          <button onClick={() => duplicateElements([el.id])}>Duplicate</button>
          {el.kind === "group" ? (
            <button onClick={() => ungroup(el.id)}>Ungroup</button>
          ) : null}
          <button className={styles.danger} onClick={() => removeElements([el.id])}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
