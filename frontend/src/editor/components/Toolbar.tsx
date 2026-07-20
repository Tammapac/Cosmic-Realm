import { useRef } from "react";
import { useEditorStore } from "../store";
import type { ElementKind, HudDocument } from "../types";
import styles from "./Toolbar.module.css";

type ToolbarProps = {
  showGrid: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  showSafeArea: boolean;
  onToggleSafeArea: () => void;
  onSetBackgroundImage: (dataUrl: string | null) => void;
};

const ELEMENT_KINDS: { kind: ElementKind; label: string }[] = [
  { kind: "panel", label: "+ Panel" },
  { kind: "box", label: "+ Box" },
  { kind: "text", label: "+ Text" },
  { kind: "polygon", label: "+ Shape" },
];

/** Real, already-built HUD components (live game UI, not editor
 * placeholders) -- kept as a separate group in the toolbar so it's clear
 * these render actual project code, not generic shapes. */
const HUD_COMPONENT_KINDS: { kind: ElementKind; label: string }[] = [
  { kind: "hud-hotbar", label: "+ Hotbar" },
  { kind: "hud-player-status", label: "+ Player Status" },
  { kind: "hud-health-bar", label: "+ Health Bar" },
  { kind: "hud-shield-bar", label: "+ Shield Bar" },
];

export function Toolbar({
  showGrid,
  onToggleGrid,
  snapToGrid,
  onToggleSnap,
  showSafeArea,
  onToggleSafeArea,
  onSetBackgroundImage,
}: ToolbarProps) {
  const doc = useEditorStore((s) => s.doc);
  const addElement = useEditorStore((s) => s.addElement);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const saveToLocalStorage = useEditorStore((s) => s.saveToLocalStorage);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const resetDocument = useEditorStore((s) => s.resetDocument);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  function exportJson() {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as HudDocument;
        loadDocument(parsed);
      } catch {
        alert("Invalid layout JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function importBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onSetBackgroundImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        {ELEMENT_KINDS.map(({ kind, label }) => (
          <button key={kind} onClick={() => addElement(kind)}>
            {label}
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        {HUD_COMPONENT_KINDS.map(({ kind, label }) => (
          <button key={kind} className={styles.hudComponentBtn} onClick={() => addElement(kind)}>
            {label}
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <button disabled={past.length === 0} onClick={undo} title="Undo">
          ↶
        </button>
        <button disabled={future.length === 0} onClick={redo} title="Redo">
          ↷
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <button className={showGrid ? styles.active : ""} onClick={onToggleGrid}>
          Grid
        </button>
        <button className={snapToGrid ? styles.active : ""} onClick={onToggleSnap}>
          Snap
        </button>
        <button className={showSafeArea ? styles.active : ""} onClick={onToggleSafeArea}>
          Safe Area
        </button>
        <button onClick={() => bgInputRef.current?.click()}>Reference Image</button>
        <input ref={bgInputRef} type="file" accept="image/*" hidden onChange={importBackground} />
      </div>

      <div className={styles.spacer} />

      <div className={styles.group}>
        <button
          onClick={() => {
            saveToLocalStorage();
          }}
        >
          Save
        </button>
        <button onClick={exportJson}>Export JSON</button>
        <button onClick={() => fileInputRef.current?.click()}>Import JSON</button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={importJson} />
        <button
          className={styles.danger}
          onClick={() => {
            if (confirm("Clear the current document?")) resetDocument();
          }}
        >
          New
        </button>
      </div>
    </div>
  );
}
