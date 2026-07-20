import { useEffect, useState } from "react";
import { useEditorStore } from "./store";
import { EditorCanvas } from "./components/EditorCanvas";
import { LayerPanel } from "./components/LayerPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { Toolbar } from "./components/Toolbar";
import styles from "./HudEditor.module.css";
import "../styles/hud/hud-tokens.css";
import "../styles/hud/hud-animations.css";
import "../styles/hud/hud-theme.css";
import "../styles/hud/hud-materials.css";

const AUTOSAVE_INTERVAL_MS = 15_000;

/** Root editor shell: toolbar on top, layer tree on the left, canvas in
 * the middle, inspector on the right. Owns view-only state (grid/snap/zoom
 * toggles, reference background image) that doesn't belong in the
 * document itself; document state lives in the zustand store. */
export function HudEditor() {
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const gridSize = 20;

  const loadFromLocalStorage = useEditorStore((s) => s.loadFromLocalStorage);
  const saveToLocalStorage = useEditorStore((s) => s.saveToLocalStorage);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const removeElements = useEditorStore((s) => s.removeElements);
  const duplicateElements = useEditorStore((s) => s.duplicateElements);

  // Load any prior autosave once on mount.
  useEffect(() => {
    loadFromLocalStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic autosave.
  useEffect(() => {
    const id = setInterval(saveToLocalStorage, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [saveToLocalStorage]);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selectedIds.length) duplicateElements(selectedIds);
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveToLocalStorage();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) {
        e.preventDefault();
        removeElements(selectedIds);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, selectedIds, removeElements, duplicateElements, saveToLocalStorage]);

  return (
    <div className={styles.shell}>
      <Toolbar
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        snapToGrid={snapToGrid}
        onToggleSnap={() => setSnapToGrid((v) => !v)}
        showSafeArea={showSafeArea}
        onToggleSafeArea={() => setShowSafeArea((v) => !v)}
        onSetBackgroundImage={setBackgroundImage}
      />
      <div className={styles.body}>
        <div className={styles.leftPanel}>
          <LayerPanel />
        </div>
        <EditorCanvas
          showGrid={showGrid}
          showSafeArea={showSafeArea}
          snapToGrid={snapToGrid}
          gridSize={gridSize}
          backgroundImage={backgroundImage}
        />
        <div className={styles.rightPanel}>
          <InspectorPanel />
        </div>
      </div>
    </div>
  );
}

export default HudEditor;
