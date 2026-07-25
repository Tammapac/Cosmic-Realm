// ─────────────────────────────────────────────────────────────────────────────
// DockingCameraController — the camera move that accompanies the approach (M5).
//
// There is no camera object in this project to animate. The "camera" is the
// Pixi worldLayer: pivot = the ship's position, scale = state.cameraZoom. So
// this controller drives exactly two numbers:
//
//   • state.cameraOffset — displaces the pivot off the ship, toward the
//     station, so the dock is framed during the approach instead of sitting at
//     the edge of the screen. Shaped as a bell curve: zero at both ends, since
//     at u=1 the ship IS at the station and any offset would just be a jolt.
//
//   • state.cameraZoom — a slow push-in that lands exactly as the ship docks.
//
// It owns no timer and no RAF. apply(u) is called from the DOCKING scene state
// with the same eased progress the ship flies, so the camera can never drift
// out of sync with the path.
//
// release() restores the player's own zoom and clears the offset. That must
// happen on EVERY exit — completed, cancelled or errored — or the player is
// left with a shoved camera.
// ─────────────────────────────────────────────────────────────────────────────

import { state } from "../store";
import type { Vec2 } from "./DockingPath";

/** How much closer the camera pushes in by the time the ship docks. */
const ZOOM_IN = 1.28;
/**
 * ...and how much when there is a door to fly into (M10).
 *
 * Far stronger, because the thing the shot has to sell is small: the HangarRamp
 * spans under a tenth of the model, ~177 screen px on an 1843 px station. At the
 * plain 1.28 it stays a detail on the hull. At 2.1 it fills a third of the
 * screen and reads as an opening the ship is entering.
 */
const ZOOM_IN_DOOR = 2.1;
/** Hard clamps, matching the wheel/pinch limits in App.tsx. */
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.5;

/** Fraction of the remaining ship→station gap the camera leads by. */
const LEAD_FRACTION = 0.4;
/** Never displace further than this, so the ship cannot leave the screen. */
const LEAD_MAX = 130;

/**
 * Chase framing (M10). The camera sits AHEAD of the ship along its line of
 * travel, which puts the ship low in frame with the door it is flying into dead
 * centre — "behind the ship, looking into the hangar", expressed in the only
 * terms this projection has.
 *
 * 150 world units at the docked zoom is roughly a third of the screen height,
 * so the ship trails visibly without sliding off the bottom edge.
 */
const CHASE_LEAD = 150;
/** Progress at which the framing starts handing over from lead to chase. */
const CHASE_FROM = 0.45;

/** Clamped smoothstep — zero slope at both ends, so handovers have no seam. */
function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

export class DockingCameraController {
  /** The point the camera leads toward — the dock coming in, the exit going out. */
  private focus: Vec2 = { x: 0, y: 0 };
  /** The player's own zoom, captured at dock and handed back at undock. */
  private baseZoom = 1;
  /** Zoom ramp for the current move. Docking pushes in, undocking pulls back. */
  private fromZoom = 1;
  private toZoom = 1;
  private active = false;
  /**
   * Direction of travel on arrival — the axis running in through the hangar
   * mouth. Null when there is no door (factories, flag off), and that null is
   * what keeps those docks on the original bell-curve framing.
   */
  private axis: Vec2 | null = null;

  /**
   * Capture the player's camera and set up the push-in.
   *
   * @param inDir Direction the ship will be travelling when it reaches the
   *   dock. Supplying it switches the move to the chase framing described at
   *   CHASE_LEAD; omitting it gives the plain lead-and-push-in from M5.
   */
  begin(station: Vec2, inDir?: Vec2): void {
    this.focus = { x: station.x, y: station.y };
    this.axis = null;
    if (inDir) {
      const l = Math.hypot(inDir.x, inDir.y);
      if (l > 1e-6) this.axis = { x: inDir.x / l, y: inDir.y / l };
    }
    this.baseZoom = state.cameraZoom;
    this.fromZoom = this.baseZoom;
    const target = this.baseZoom * (this.axis ? ZOOM_IN_DOOR : ZOOM_IN);
    this.toZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, target));
    this.active = true;
  }

  /**
   * Adopt the player's current zoom as the one to hand back (M8).
   *
   * Normally begin() captures that at dock time, but a player restored into a
   * station on login never docked in this session — begin() never ran, so
   * baseZoom is still the constructor default (or a stale value left by an
   * earlier dock). Undocking would then ramp them to that wrong number instead
   * of leaving their camera alone. Called once, from the boot restore.
   */
  adoptPlayerZoom(): void {
    this.baseZoom = state.cameraZoom;
  }

  /**
   * Set up the reverse move (M7): pull back out of the station to the zoom the
   * player had before docking, leading toward where they are headed.
   *
   * Starts from wherever the zoom currently sits rather than assuming the
   * pushed-in value, so an undock that begins from an odd state (a reload while
   * docked, a cancelled dock) still ramps smoothly instead of snapping.
   */
  beginUndock(exit: Vec2): void {
    this.focus = { x: exit.x, y: exit.y };
    // Leaving is framed the way it always was: the chase belongs to the arrival,
    // where there is an opening ahead worth centring on.
    this.axis = null;
    this.fromZoom = state.cameraZoom;
    this.toZoom = this.baseZoom;
    this.active = true;
  }

  /**
   * Drive the camera from the approach progress.
   *
   * @param u Eased progress 0..1 — the same value used to sample the path.
   */
  apply(u: number): void {
    if (!this.active) return;
    const t = Math.max(0, Math.min(1, u));

    // How far the framing has handed over from "show me both" to "ride in
    // behind the ship". Smoothstepped, so the handover is a drift rather than a
    // visible switch. Always 0 without a door axis, which reproduces M5 exactly.
    const c = this.axis ? smoothstep((t - CHASE_FROM) / (1 - CHASE_FROM)) : 0;

    // Bell curve: no displacement at the start (the camera is still on the
    // ship where the player left it) and none at the end (ship and station
    // coincide). Peaks mid-approach, where framing both actually helps.
    const bell = Math.sin(Math.PI * t) * (1 - c);

    const dx = this.focus.x - state.player.pos.x;
    const dy = this.focus.y - state.player.pos.y;
    let lx = dx * LEAD_FRACTION * bell;
    let ly = dy * LEAD_FRACTION * bell;
    const len = Math.hypot(lx, ly);
    if (len > LEAD_MAX) {
      lx = (lx / len) * LEAD_MAX;
      ly = (ly / len) * LEAD_MAX;
    }
    // Added AFTER the clamp on purpose: LEAD_MAX bounds how far the camera may
    // wander off the ship toward a distant station, which is a different job
    // from the fixed trailing distance the chase wants.
    if (this.axis) {
      lx += this.axis.x * CHASE_LEAD * c;
      ly += this.axis.y * CHASE_LEAD * c;
    }
    state.cameraOffset.x = lx;
    state.cameraOffset.y = ly;

    // The zoom ramp completes exactly on arrival either way, but the chase
    // back-loads it: a linear ramp to 2.1 is already halfway zoomed while the
    // ship is still out in open space, which just looks like the view shrinking.
    // Cubed, almost all of the push-in happens over the last third — as the
    // door opens and the ship goes through it.
    const z = this.axis ? t * t * t : t;
    state.cameraZoom = this.fromZoom + (this.toZoom - this.fromZoom) * z;
  }

  /** Hand the camera back to the player. Safe to call when never begun. */
  release(): void {
    if (!this.active) return;
    state.cameraOffset.x = 0;
    state.cameraOffset.y = 0;
    state.cameraZoom = this.baseZoom;
    this.active = false;
  }

  /**
   * Leave the camera pushed in but drop the offset — used when the approach
   * completes and the hangar takes over, so there is no zoom-out pop between
   * the dock landing and the hangar appearing.
   */
  settle(): void {
    if (!this.active) return;
    state.cameraOffset.x = 0;
    state.cameraOffset.y = 0;
  }

  /** The zoom the player had before docking — what beginUndock() ramps back to. */
  get playerZoom(): number {
    return this.baseZoom;
  }

  get isActive(): boolean {
    return this.active;
  }
}

/** Shared instance — the docking flow is inherently single-shot. */
export const dockingCamera = new DockingCameraController();
