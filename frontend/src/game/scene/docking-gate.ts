// ─────────────────────────────────────────────────────────────────────────────
// docking-gate — the single authoritative "is player control locked?" check.
//
// Consolidates the scattered `if (state.dockedAt) return;` guards. When the new
// docking flow is OFF this returns EXACTLY `!!state.dockedAt`, so existing
// behaviour is byte-for-byte unchanged. When ON, control is also locked during
// the DOCKING / HANGAR_LOADING / UNDOCKING scene-manager transitions so the
// cinematic can run before dockedAt is finally committed.
// ─────────────────────────────────────────────────────────────────────────────

import { state } from "../store";
import { ENABLE_NEW_DOCKING_FLOW } from "../renderer-config";
import { sceneManager, GameState } from "./GameSceneManager";

/** True while normal player movement / firing input must be ignored. */
export function isControlLocked(): boolean {
  // Existing, always-honoured lock: a fully docked player never has controls.
  if (state.dockedAt) return true;

  if (!ENABLE_NEW_DOCKING_FLOW) return false;

  // New flow only: also lock during the docking/undocking transition window.
  const s = sceneManager.state;
  return (
    s === GameState.DOCKING ||
    s === GameState.HANGAR_LOADING ||
    s === GameState.UNDOCKING
  );
}
