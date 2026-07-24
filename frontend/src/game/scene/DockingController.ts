// ─────────────────────────────────────────────────────────────────────────────
// DockingController — orchestrates the docking request → transition → commit.
//
// Milestone 2 scope ONLY: begin the DOCKING scene state (which locks controls
// via isControlLocked), then, after a short placeholder delay standing in for
// the not-yet-built cinematic, commit the existing dock (dockedAt + hangar UI)
// exactly the way the legacy path does. No camera move, no door, no path yet.
//
// Everything here runs only when ENABLE_NEW_DOCKING_FLOW is true.
// ─────────────────────────────────────────────────────────────────────────────

import { sceneManager, GameState } from "./GameSceneManager";
import { state, bump, save, pushNotification, runDockingServices } from "../store";
import { sendDockEnter } from "../../net/socket";
import { STATIONS } from "../types";
import { effectiveStats } from "../loop";

let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Begin docking with a station. Locks controls immediately (DOCKING state),
 * then commits the dock after a placeholder delay. Safe to call repeatedly —
 * a second request while one is in flight is ignored.
 */
export async function requestDock(stationId: string): Promise<void> {
  if (sceneManager.state !== GameState.SPACE) {
    console.warn("[docking] requestDock ignored — not in SPACE (", sceneManager.state, ")");
    return;
  }
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station) {
    console.error("[docking] requestDock: invalid station", stationId);
    return;
  }

  const started = await sceneManager.transitionTo(GameState.DOCKING, { stationId });
  if (!started) return; // rejected/locked — stay in SPACE, controls unaffected

  // Freeze drift immediately so the ship doesn't keep gliding while "locked".
  state.player.vel = { x: 0, y: 0 };
  pushNotification("Docking sequence engaged...", "good");
  bump();

  // Placeholder for the future cinematic. M6 replaces this timeout with the
  // real path + door + fade + HangarScene load. For now, after a beat, commit
  // the legacy dock so the flow ends in the working docked state.
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    // If something cancelled us back to SPACE, abort.
    if (sceneManager.state !== GameState.DOCKING) return;
    commitDock(stationId, station.kind);
  }, 1200);
}

/** Commit the actual dock — mirrors the legacy instant-dock behaviour. */
function commitDock(stationId: string, kind: string): void {
  state.dockedAt = stationId;
  sendDockEnter();
  state.hangarTab = kind === "factory" ? "refinery" : "bounties";
  state.player.vel = { x: 0, y: 0 };
  save();
  bump();
  const stats = effectiveStats();
  runDockingServices(stats.hullMax, stats.shieldMax);
  // Advance the scene machine to HANGAR (the 2D Hangar panel already keys off
  // dockedAt, so this is currently just bookkeeping; the real HangarScene
  // arrives in a later milestone).
  sceneManager.transitionTo(GameState.HANGAR_LOADING, { stationId })
    .then((ok) => { if (ok) sceneManager.transitionTo(GameState.HANGAR, { stationId }); });
}

/** Cancel an in-flight docking request, restoring SPACE + controls. */
export function cancelDock(reason = "cancelled"): void {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  if (sceneManager.state === GameState.DOCKING) {
    sceneManager.transitionTo(GameState.SPACE, { reason });
    pushNotification("Docking aborted", "bad");
    bump();
  }
}

/**
 * Sync the scene machine back to SPACE when the player undocks. The legacy
 * undock path only clears state.dockedAt; this keeps the scene machine from
 * getting stuck in HANGAR (which would block all future docking). Idempotent
 * and forgiving of whatever state we're in.
 */
export function requestUndock(): void {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
  if (sceneManager.state === GameState.SPACE) return; // already there
  // M2: undocking is instant (no reverse cinematic yet). Force straight back to
  // SPACE so the machine can never wedge and docking is immediately available
  // again. The animated UNDOCKING sequence is added in M7.
  sceneManager.forceState(GameState.SPACE);
  console.log("[docking] undock → SPACE");
}
