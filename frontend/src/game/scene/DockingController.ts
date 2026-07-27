// ─────────────────────────────────────────────────────────────────────────────
// DockingController — orchestrates the docking request → approach → commit.
//
// M4: the DOCKING scene state owns the ship — it flies a DockingPath from
// wherever the player was to the station, facing along the curve.
// M5: DockingCameraController leads and pushes the camera in along the way.
// M6: a blackout (SceneFade) covers the actual world swap. The dock is no
// longer committed on arrival; HANGAR_LOADING commits it behind black, then
// HANGAR fades the world back in. Still no door — that is a later milestone.
//
// The cinematic is pumped by sceneManager.update(dt), which the sim loop calls
// AFTER applyServerSmoothing(). That ordering matters: server smoothing lerps
// the player toward the server's position every frame, so the cinematic has to
// write last to actually own the ship. No new RAF loop is created.
//
// Everything here runs only when ENABLE_NEW_DOCKING_FLOW is true.
// ─────────────────────────────────────────────────────────────────────────────

import { sceneManager, GameState } from "./GameSceneManager";
import { state, bump, save, pushNotification, runDockingServices } from "../store";
import { sendDockEnter, sendDockLeave } from "../../net/socket";
import { STATIONS } from "../types";
import { effectiveStats } from "../loop";
import { DockingPath, buildDockingApproach, buildUndockDeparture, DOOR_THROUGH } from "./DockingPath";
import { dockingCamera } from "./DockingCameraController";
import { sceneFade } from "./SceneFade";
import { saveLocation, loadLocation, clearLocation } from "./DockingPersistence";
import { getStationDoor, getStationDoorWorldOffset } from "../three-station-layer";
import { ENABLE_HANGAR_3D_SCENE, ENABLE_SHARED_3D_SCENE } from "../renderer-config";
import { HangarScene, activeHangarScene, setActiveHangarScene } from "./HangarScene";
import { setShipLiftFactor } from "../three-world-layer";

/**
 * Blackout timing (M6). The fade-out is STARTED before arrival so the screen is
 * fully black exactly as the ship touches the dock — fading only after arrival
 * would show the ship sitting still for half a second first.
 */
const FADE_OUT_MS = 420;
const FADE_IN_MS = 500;
/**
 * How long the screen stays black once the dock is committed. Right now the
 * hangar is the existing 2D panel and needs no loading at all, so a swap with
 * no black hold reads as a glitch rather than a transition. This is also where
 * the real HangarScene preload plugs in later — replace the timer with the
 * asset promise and the sequence around it does not change.
 */
const MIN_BLACK_MS = 260;

/**
 * Prepare the hangar behind the blackout. With the 3D hangar flag on, this
 * preloads the real HangarScene (its own GLB, cached) for the player's ship and
 * stashes it in `activeHangarScene`. With the flag off, it just holds black for
 * MIN_BLACK_MS so the 2D-panel swap doesn't read as a glitch (original behaviour).
 */
async function hangarReady(): Promise<void> {
  if (!ENABLE_HANGAR_3D_SCENE) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, MIN_BLACK_MS));
    return;
  }
  try {
    disposeHangarScene(); // clear any stale scene first
    const shipClass = String(state.player?.shipClass ?? "skimmer");
    const hs = await HangarScene.preload(shipClass);
    setActiveHangarScene(hs);
  } catch (e) {
    // Fall back to the black-hold + 2D panel if the 3D preload fails.
    console.error("[docking] HangarScene preload failed — falling back to 2D", e);
    setActiveHangarScene(null);
    await new Promise<void>((resolve) => window.setTimeout(resolve, MIN_BLACK_MS));
  }
}

/** Dispose + clear the active 3D hangar scene (idempotent). */
function disposeHangarScene(): void {
  if (activeHangarScene) {
    try { activeHangarScene.dispose(); } catch { /* ignore */ }
    setActiveHangarScene(null);
  }
  state.hangarIntroDone = false;
}

/**
 * Approach pacing. Duration scales with path length so a dock triggered from
 * 40 units out doesn't take as long as one from 300 — a fixed duration made
 * short approaches crawl. Clamped at both ends so it always reads as a
 * deliberate manoeuvre and never drags.
 */
const APPROACH_SPEED = 150; // world units / second (slower = more deliberate run-in)
const APPROACH_MIN = 2.0;
const APPROACH_MAX = 4.5;   // longer, so the fly-in under the hangar door reads
/** Visible pause at the hangar opening AFTER arrival, before the blackout starts —
 *  so the player actually sees the ship reach the station instead of it cutting to
 *  black mid-approach. */
const DOCK_ARRIVAL_HOLD_S = 0.8;
/** Ship lift factor the approach descends TO (1 = full float above stations). The
 *  hangar opening on cosmic_station_v2 @ 900px sits at ~0.047 of full lift; a touch
 *  above that lands the ship IN the opening, occluded by the roof, not through it. */
const DOCK_SINK_FACTOR = 0.06;

function approachDuration(length: number): number {
  return Math.max(APPROACH_MIN, Math.min(APPROACH_MAX, length / APPROACH_SPEED));
}

/** Smoothstep — the ship eases out of its drift and settles into the dock. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Advance a cinematic by one frame: fly the path, face along it, derive a
 * velocity, and drive the camera. Shared by the approach (M4) and the departure
 * (M7) — the two differ only in which curve they follow and what happens on
 * arrival.
 *
 * @returns the eased progress u, so the caller can react to arrival.
 */
function flyPath(cin: Cinematic, dt: number): number {
  cin.t = Math.min(1, cin.t + dt / cin.duration);
  const u = ease(cin.t);
  const p = cin.path.pointAt(u);
  state.player.pos.x = p.x;
  state.player.pos.y = p.y;
  state.player.angle = cin.path.headingAt(u);
  // Report the velocity the path actually produced instead of zero — the
  // engine-trail and thruster code downstream keys off p.vel, so zeroing it
  // would make the ship glide in silently with dead engines.
  //
  // This measures path-point to path-point, NOT against player.pos: by the
  // time we run, applyServerSmoothing() has already dragged player.pos toward
  // the server's idea of where the ship is. Differencing against that produced
  // absurd speeds (measured >3000 u/s in the ?dock-test harness with smoothing
  // pulling the other way).
  if (dt > 0) {
    state.player.vel.x = (p.x - cin.lastX) / dt;
    state.player.vel.y = (p.y - cin.lastY) / dt;
  }
  cin.lastX = p.x;
  cin.lastY = p.y;

  // M5: same u as the path, so the camera can never drift out of sync with the
  // ship. Must run AFTER pos is written — the lead offset is measured from the
  // ship's current position to the focus point.
  dockingCamera.apply(u);
  return u;
}

// ── Door (M9) ────────────────────────────────────────────────────────────────
// The door belongs to the station's 3D instance, which only exists while the
// station is on screen — it is created on the first frame it renders and
// destroyed by endStationFrame() when it leaves. So the door is never simply
// "there" when we want it, and every use has to tolerate a null and retry.
//
// Both helpers below return whether they got hold of a door, so the callers can
// keep asking on later ticks instead of giving up on the first miss.

/** Animate the door. Fire-and-forget — the cinematic never waits on it. */
function tryAnimateDoor(stationId: string, open: boolean): boolean {
  const door = getStationDoor(stationId);
  if (!door) return false;
  // Rejects only when there is no door to animate, which getStationDoor already
  // ruled out; catch anyway so a model change can never surface as an unhandled
  // rejection in the middle of a dock.
  void (open ? door.open() : door.close()).catch(() => {});
  return true;
}

/**
 * Where the ship should actually end up: the hangar mouth, not the station's
 * nominal position.
 *
 * These are far apart. The station model is drawn ~1843 world units across while
 * the dock prompt fires at 300, so by the time you can dock you are already deep
 * inside the hull's footprint and the ramp is another ~700 units further out.
 * Flying to station.pos parks the ship on top of the station instead of in it.
 *
 * Falls back to the station centre whenever the offset is unknown (no 3D
 * instance yet, doorless model, flag off) — that is exactly the pre-M9 path.
 */
export function dockPoint(station: { pos: { x: number; y: number } ; id: string }): { x: number; y: number } {
  const off = getStationDoorWorldOffset(station.id);
  if (!off) return { x: station.pos.x, y: station.pos.y };
  return { x: station.pos.x + off.x, y: station.pos.y + off.y };
}

/**
 * Unit vector pointing OUT of the hangar, for the undock sweep. Defaults to +y
 * (screen-down), which is both the legacy undock direction and where the pinned
 * station puts its ramp.
 */
function dockExitDir(stationId: string): { x: number; y: number } {
  return doorAxis(stationId) ?? { x: 0, y: 1 };
}

/**
 * Unit vector from the station centre out through the door, or null when there
 * is no door to speak of. Null is meaningful: it is what keeps the flag-off and
 * doorless paths on their original geometry instead of silently assuming +y.
 */
function doorAxis(stationId: string): { x: number; y: number } | null {
  const off = getStationDoorWorldOffset(stationId);
  if (!off) return null;
  const len = Math.hypot(off.x, off.y);
  if (len < 1) return null;
  return { x: off.x / len, y: off.y / len };
}

/** Snap the door with no animation — for use behind the blackout. */
function trySetDoor(stationId: string, open: boolean): boolean {
  const door = getStationDoor(stationId);
  if (!door) return false;
  door.setImmediate(open);
  return true;
}

interface Cinematic {
  path: DockingPath;
  /** Raw progress 0..1 (eased before it is used to sample the path). */
  t: number;
  /** Seconds this approach runs for (derived from path length). */
  duration: number;
  /** Previous position ON THE PATH — the basis for the derived velocity. */
  lastX: number;
  lastY: number;
  stationId: string;
  kind: string;
  committed: boolean;
  /** Set once the pre-arrival blackout has been kicked off, so it fires once. */
  fading: boolean;
  /** M9: set once the door request actually reached a door, so it fires once. */
  doorDone: boolean;
  /** Seconds elapsed since the ship arrived at the opening (the visible hold). */
  holdT?: number;
}

let cinematic: Cinematic | null = null;

/**
 * The outbound flight (M7). Kept separate from `cinematic` rather than reusing
 * it: DOCKING and UNDOCKING are mutually exclusive states, but sharing one
 * variable would let a stale approach be mistaken for a departure if a
 * transition ever went wrong.
 */
let departure: Cinematic | null = null;

/**
 * Guards the async hangar-loading sequence. Every run takes a ticket; if the
 * player cancels or undocks mid-load the ticket goes stale and the sequence
 * abandons instead of committing a dock nobody asked for any more.
 */
let loadRun = 0;
/** Set by bootIntoStoredLocation so the next HANGAR entry stages the 3D scene
 *  PARKED (no fly-in) — a login-while-docked resumes, it doesn't re-fly-in. */
let restoreParked = false;

/** True while the approach owns the ship's position. */
export function isDockingCinematicActive(): boolean {
  return cinematic !== null && !cinematic.committed;
}

/** Progress of the current approach, 0..1. Returns 0 when idle (for HUD/debug). */
export function dockingProgress(): number {
  return cinematic ? cinematic.t : 0;
}

/**
 * Register the DOCKING state handler that flies the approach.
 *
 * Must be called AFTER any generic/placeholder handler registration, because
 * GameSceneManager.register() overwrites by state key — last one wins.
 */
export function installDockingScene(): void {
  sceneManager.register(GameState.DOCKING, {
    enter(ctx) {
      const station = STATIONS.find((s) => s.id === ctx.stationId);
      if (!station) {
        console.error("[docking] DOCKING entered without a valid station", ctx);
        cinematic = null;
        dockingCamera.release();
        sceneFade.clearNow();
        // Bail back to SPACE rather than sitting in a locked state forever.
        // Deferred on purpose: we are inside enter(), which the manager runs
        // with `transitioning = true`, and transitionTo() rejects nested calls.
        // Called inline this would be silently dropped and the machine would
        // wedge in DOCKING — controls locked, docking dead for the session.
        // A timer, not queueMicrotask: the manager clears `transitioning` in a
        // finally block reached through microtasks, so a microtask queued here
        // would still run too early.
        window.setTimeout(() => {
          if (sceneManager.state === GameState.DOCKING) {
            void sceneManager.transitionTo(GameState.SPACE, { reason: "invalid station" });
          }
        }, 0);
        return;
      }
      // Aim at the hangar mouth, not the station's nominal centre — see
      // dockPoint(). This is what makes the ship fly INTO the door.
      const target = dockPoint(station);
      // ...and along the door's own axis, so it goes THROUGH rather than nosing
      // up against the opening from whatever bearing the player docked at. The
      // axis points outward, so travel-on-arrival is its negation. Undefined
      // when there is no door — buildDockingApproach then behaves as before.
      const out = doorAxis(station.id);
      const path = buildDockingApproach(
        state.player.pos,
        state.player.vel,
        target,
        out ? { x: -out.x, y: -out.y } : undefined,
      );
      cinematic = {
        path,
        t: 0,
        duration: approachDuration(path.length),
        lastX: state.player.pos.x,
        lastY: state.player.pos.y,
        stationId: station.id,
        kind: station.kind,
        committed: false,
        fading: false,
        doorDone: false,
      };
      // M9: open the door at the START of the approach. The door takes 0.9 s and
      // the shortest approach is APPROACH_MIN (1.2 s), so it is always fully open
      // before the ship arrives. Fire-and-forget on purpose — the approach timing
      // is driven by the path, and making it wait on the door would couple the
      // pacing to an asset detail. If the station's 3D instance is not built yet
      // this misses, and update() keeps asking.
      cinematic.doorDone = tryAnimateDoor(station.id, true);
      // Kill drift immediately — from here the path, not physics, moves the ship.
      state.player.vel = { x: 0, y: 0 };
      // Point the SERVER at the station too. The cinematic only moves the local
      // ship; the server keeps flying toward the last move order (cameraTarget
      // is what App.tsx emits as input:move). Without this the authoritative
      // position drifts away from the dock, and the snap would land on the
      // player the moment applyServerSmoothing takes over again after undock.
      state.cameraTarget.x = station.pos.x;
      state.cameraTarget.y = station.pos.y;
      // M5: take the camera. Captures the player's zoom so exit() can give it
      // back exactly as it was.
      // Follow the ship to the DOOR, not the station centre — 700 units apart is
      // enough to leave the ship hanging off the bottom of the screen otherwise.
      // M10: the same run-in axis handed to the path also frames the shot, so
      // the camera trails the ship straight into the opening instead of merely
      // pointing at the station.
      dockingCamera.begin(target, out ? { x: -out.x, y: -out.y } : undefined);
      pushNotification(`Docking with ${station.name}...`, "good");
      bump();
    },

    update(dt) {
      const cin = cinematic;
      if (!cin || cin.committed) return;

      flyPath(cin, dt);

      // "Fly INTO the hangar" (top-down): the ship normally floats 1500·zoom above
      // every station so it can never clip a hull. Ramp that lift DOWN over the run-in
      // so the ship descends to the hangar-opening height and the station's roof/door
      // geometry OCCLUDES it — it reads as the ship slipping into the station. With
      // cosmic_station_v2 (building-scaled), the opening sits at ~0.05 of full lift,
      // a comfortable target that lands the ship IN the opening (not through the hull).
      if (ENABLE_SHARED_3D_SCENE) {
        // t 0.3 → 1.0 maps lift 1 → DOCK_SINK_FACTOR (smoothstepped for a soft descent).
        const k = Math.max(0, Math.min(1, (cin.t - 0.3) / 0.7));
        const e = k * k * (3 - 2 * k); // smoothstep
        setShipLiftFactor(1 - e * (1 - DOCK_SINK_FACTOR));
      }

      // M9: the station's 3D instance is created on its first rendered frame, so
      // enter() can be a tick or two too early. Keep asking until a door answers.
      if (!cin.doorDone) cin.doorDone = tryAnimateDoor(cin.stationId, true);

      // Let the WHOLE approach play visibly (no fade during the fly-in) so the
      // player can see the ship reach the station opening. Only once it has ARRIVED
      // do we hold briefly at the opening, then fade — never before.
      if (cin.t < 1) return;

      // Arrived. Count up a short visible hold at the opening before the blackout,
      // so the player sees the ship sitting in the hangar mouth.
      cin.holdT = (cin.holdT ?? 0) + dt;
      if (!cin.fading && cin.holdT >= DOCK_ARRIVAL_HOLD_S) {
        cin.fading = true;
        void sceneFade.toBlack(FADE_OUT_MS);
      }
      // Commit + transition only once the black has covered the screen, so the
      // scene swap happens behind it (no visible pop).
      if (cin.fading && cin.holdT >= DOCK_ARRIVAL_HOLD_S + FADE_OUT_MS / 1000) {
        cin.committed = true;
        dockingCamera.settle();
        void sceneManager.transitionTo(GameState.HANGAR_LOADING, {
          stationId: cin.stationId,
          kind: cin.kind,
        });
      }
    },

    exit(next) {
      const aborted = cinematic;
      cinematic = null;
      // Bailing back to space means the player keeps flying — give the camera
      // back exactly as they left it. Going on to the hangar means the push-in
      // should persist, or the view would pop out for one frame first.
      if (next === GameState.SPACE) {
        // M9: the player is still watching, so close it visibly rather than
        // leaving a cancelled dock with a door hanging open. Going the other way
        // (on to the hangar) is handled behind the blackout instead.
        if (aborted) tryAnimateDoor(aborted.stationId, false);
        // Cancelled dock → put the ship back up to full lift, or it would stay sunk
        // into the world plane (half-buried in stations) as the player flies on.
        if (ENABLE_SHARED_3D_SCENE) setShipLiftFactor(1);
        dockingCamera.release();
        // Aborted mid-fade: drop the blackout instantly rather than fading a
        // screen the player never agreed to lose.
        loadRun++;
        sceneFade.clearNow();
      } else {
        dockingCamera.settle();
      }
    },
  });

  // ── HANGAR_LOADING (M6) ────────────────────────────────────────────────────
  // Everything visible happens behind the blackout: the dock is committed, the
  // world is swapped, and only then does the screen come back.
  sceneManager.register(GameState.HANGAR_LOADING, {
    enter(ctx) {
      const stationId = String(ctx.stationId ?? "");
      const kind = String(ctx.kind ?? "");
      const run = ++loadRun;

      // Deliberately NOT awaited. GameSceneManager awaits enter() with
      // `transitioning = true`, and transitionTo() rejects nested calls — so
      // awaiting this here would deadlock the machine in HANGAR_LOADING
      // forever. Kicking it off and returning lets the transition settle first.
      void (async () => {
        try {
          // Normally already black (started pre-arrival); this only waits out
          // the remainder. Entering HANGAR_LOADING by any other route — the
          // debug handle, a future save-game load — fades from here instead.
          await sceneFade.toBlack(FADE_OUT_MS);
          if (run !== loadRun) return;

          commitDock(stationId, kind);
          // M9: the ship is inside — shut the door. Snapped, not animated: the
          // screen is black, so an animation would only be a 0.9 s wait nobody
          // can see, and commitDock() has just halted the sim tick anyway.
          trySetDoor(stationId, false);
          await hangarReady();
          if (run !== loadRun) return;

          await sceneManager.transitionTo(GameState.HANGAR, { stationId });
        } catch (e) {
          // Never leave the player staring at a black screen.
          console.error("[docking] hangar loading failed — recovering", e);
          disposeHangarScene();
          sceneFade.clearNow();
          dockingCamera.release();
          sceneManager.forceState(GameState.SPACE);
        }
      })();
    },
  });

  // ── HANGAR (M6) ────────────────────────────────────────────────────────────
  // The world behind the blackout is now the hangar, so reveal it.
  sceneManager.register(GameState.HANGAR, {
    enter() {
      if (ENABLE_HANGAR_3D_SCENE && activeHangarScene) {
        const hs = activeHangarScene;
        hs.show();          // attaches its own canvas at z-index 3
        hs.showParked();    // stage the ship so the first frame isn't empty
        if (restoreParked) {
          // Login-while-docked: no fly-in, just reveal the parked hangar + menu.
          restoreParked = false;
          state.hangarIntroDone = true;
          void sceneFade.toClear(FADE_IN_MS);
        } else {
          // Normal dock: reveal, then play the fly-in; the 2D menu is gated on
          // state.hangarIntroDone so it appears only AFTER the cinematic settles.
          state.hangarIntroDone = false;
          void (async () => {
            await sceneFade.toClear(FADE_IN_MS);
            try { await hs.playIntro(); } catch { /* ignore */ }
            state.hangarIntroDone = true;
            bump();           // re-render so the menu mounts
          })();
        }
      } else {
        // 2D-panel path: menu shows immediately (dockedAt is already set).
        state.hangarIntroDone = true;
        void sceneFade.toClear(FADE_IN_MS);
      }
    },
  });

  // ── UNDOCKING (M7) ─────────────────────────────────────────────────────────
  // The mirror image of docking: black out, leave the station behind the black,
  // then fade back in ON the outbound flight so the player watches themselves
  // pull away rather than appearing 200 units out with no explanation.
  sceneManager.register(GameState.UNDOCKING, {
    enter(ctx) {
      const stationId = String(ctx.stationId ?? state.dockedAt ?? "");
      const run = ++loadRun;
      departure = null;

      // Fire-and-forget for the same reason as HANGAR_LOADING: the manager
      // awaits enter() with `transitioning = true`, so awaiting here would
      // deadlock the machine.
      void (async () => {
        try {
          // 3D hangar: play the lift-off outro FIRST, while the hangar is still
          // visible (no black yet) — otherwise the fly-out would run hidden behind
          // the blackout and read as "no animation". THEN black out and tear it down.
          if (ENABLE_HANGAR_3D_SCENE && activeHangarScene) {
            try { await activeHangarScene.playOutro(); } catch { /* ignore */ }
            if (run !== loadRun) return;
            await sceneFade.toBlack(FADE_OUT_MS);
            if (run !== loadRun) return;
            disposeHangarScene();
          } else {
            await sceneFade.toBlack(FADE_OUT_MS);
            if (run !== loadRun) return;
          }

          const station = STATIONS.find((s) => s.id === stationId);
          // Clearing dockedAt restarts the sim loop (loop.ts:994) and with it
          // the pump that flies the path below — so everything the departure
          // needs must be in place before this line.
          // Leave FROM the hangar mouth, heading out along the door's own axis —
          // starting at the station centre would fly the ship out through solid
          // hull. Both fall back to centre/+y when there is no door.
          const mouth = station ? dockPoint(station) : null;
          const path = station && mouth
            ? buildUndockDeparture(
                mouth,
                dockExitDir(station.id),
                // Start inside the hangar only if there IS one to start inside of.
                doorAxis(station.id) ? DOOR_THROUGH : 0,
              )
            : null;

          if (station && path && mouth) {
            // The dock left the ship exactly on the station; assert it anyway,
            // since a login-while-docked (M8) may not have flown an approach.
            // pointAt(0) rather than the mouth: with a door the path starts a
            // little way inside, and the ship must be where its path begins or
            // the first frame teleports it.
            const start = path.pointAt(0);
            state.player.pos.x = start.x;
            state.player.pos.y = start.y;
            const exit = path.pointAt(1);
            // Point the SERVER at the exit as well, or its authoritative
            // position stays at the dock and applyServerSmoothing() drags the
            // ship back the moment the cinematic lets go.
            state.cameraTarget.x = exit.x;
            state.cameraTarget.y = exit.y;
            dockingCamera.beginUndock(exit);
            departure = {
              path,
              t: 0,
              duration: approachDuration(path.length),
              lastX: start.x,
              lastY: start.y,
              stationId,
              kind: "",
              committed: false,
              fading: false,
              doorDone: false,
            };
            // M9: snapped open while the screen is still black, so the fade
            // reveals a station the ship can actually leave through. Animating
            // here would mean the door was still swinging as the world appeared.
            departure.doorDone = trySetDoor(stationId, true);
          } else {
            console.error("[docking] undock without a valid station", stationId);
          }

          commitUndock();
          if (run !== loadRun) return;

          // Deliberately NOT awaited: the fade-in runs WHILE the ship flies, so
          // the departure is visible. Awaiting it would reveal a ship already
          // half way out.
          void sceneFade.toClear(FADE_IN_MS);

          // No path (unknown station) means nothing to fly — go straight back.
          if (!departure) forceUndock("no departure path");
        } catch (e) {
          console.error("[docking] undock failed — recovering", e);
          forceUndock("undock error");
        }
      })();
    },

    update(dt) {
      const dep = departure;
      if (!dep || dep.committed) return;

      flyPath(dep, dt);

      // M9: the station instance is rebuilt from scratch when the world comes
      // back, so the snap in enter() often lands before it exists. Animate on the
      // retry rather than snapping — by now the screen is no longer black, and a
      // door that pops open in one frame would read as a glitch.
      if (!dep.doorDone) dep.doorDone = tryAnimateDoor(dep.stationId, true);

      if (dep.t >= 1) {
        dep.committed = true;
        void sceneManager.transitionTo(GameState.SPACE, { reason: "undocked" });
      }
    },

    exit() {
      // M9: close it behind the departing ship — the player is out in space and
      // watching, so this one is animated.
      if (departure) tryAnimateDoor(departure.stationId, false);
      departure = null;
      // Hand the camera back at the player's own zoom. apply() has already
      // ramped it there, so this is normally a no-op — it matters on the
      // aborted paths, where the flight never finished.
      dockingCamera.release();
    },
  });
}

/**
 * Begin docking with a station. Enters DOCKING, which locks controls via
 * isControlLocked() and starts the approach. Safe to call repeatedly — a second
 * request while one is in flight is rejected by the state machine.
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
  await sceneManager.transitionTo(GameState.DOCKING, { stationId });
}

/**
 * Commit the actual dock — mirrors the legacy instant-dock behaviour.
 *
 * Called from HANGAR_LOADING while the screen is black. Note that setting
 * state.dockedAt stops the sim loop (loop.ts:994), which also stops
 * sceneManager.update() — nothing tick-driven may be relied on after this
 * point. The fade is a CSS transition precisely because of that.
 */
function commitDock(stationId: string, kind: string): void {
  state.dockedAt = stationId;
  sendDockEnter();
  state.hangarTab = kind === "factory" ? "refinery" : "bounties";
  state.player.vel = { x: 0, y: 0 };
  // M8: remember it, so closing the tab in the hangar puts you back in the
  // hangar. save() below persists the position the ship ended at, which is the
  // station itself — so the server agrees on where you are.
  saveLocation("STATION", stationId, state.player.zone);
  save();
  bump();
  const stats = effectiveStats();
  runDockingServices(stats.hullMax, stats.shieldMax);
}

/** Cancel an in-flight docking request, restoring SPACE + controls. */
export function cancelDock(reason = "cancelled"): void {
  if (sceneManager.state === GameState.DOCKING) {
    sceneManager.transitionTo(GameState.SPACE, { reason });
    pushNotification("Docking aborted", "bad");
    bump();
  }
}

/**
 * Leave the station — the whole legacy undock, replaced (M7).
 *
 * Owns everything the old inline handler did (clear dockedAt, tell the server,
 * move the ship clear of the station, save), so callers with the flag on must
 * NOT also run those steps: doing both would teleport the ship out from under
 * the cinematic before it starts.
 *
 * Falls back to an instant undock whenever an animated one makes no sense —
 * not in the hangar, or not actually docked.
 */
export function requestUndock(): void {
  if (sceneManager.state === GameState.HANGAR && state.dockedAt) {
    void sceneManager.transitionTo(GameState.UNDOCKING, { stationId: state.dockedAt });
    return;
  }
  forceUndock("not in hangar");
}

/** The world half of undocking, run behind the blackout by the UNDOCKING state. */
function commitUndock(): void {
  state.dockedAt = null;
  // Restore full ship lift so the ship reappears floating above the station (the
  // approach ramped it down to sink under the roof); otherwise it exits half-buried.
  if (ENABLE_SHARED_3D_SCENE) setShipLiftFactor(1);
  sendDockLeave();
  saveLocation("SPACE", null, state.player.zone);
  save();
  bump();
}

/**
 * Instant, unconditional return to SPACE — no cinematic, no fade.
 *
 * For paths where an outbound flight would be wrong or impossible: entering a
 * dungeon straight from the hangar (the player is warping, not flying out),
 * error recovery, and test resets. Idempotent and forgiving of whatever state
 * the machine is in, so it can never wedge and block future docking.
 */
export function forceUndock(reason = "forced"): void {
  // M9: whichever station this exit relates to, its door must not be left hanging
  // open — this path skips every exit handler that would otherwise close it.
  // Read before the two are nulled below.
  const doorStation = cinematic?.stationId ?? departure?.stationId ?? state.dockedAt;
  if (doorStation) trySetDoor(doorStation, false);
  cinematic = null;
  departure = null;
  // Tear down the 3D hangar scene too — this catch-all (dungeon entry, error
  // recovery, resets) must never leave the hangar canvas/renderer alive.
  disposeHangarScene();
  // And restore full ship lift, or a ship that was mid-descent stays sunk in a hull.
  if (ENABLE_SHARED_3D_SCENE) setShipLiftFactor(1);
  // Abandon any in-flight load/undock sequence and lift the blackout. Without
  // this, a sequence still running would later fade the screen back in — or
  // worse, push into HANGAR — on top of a player already flying.
  loadRun++;
  sceneFade.clearNow();
  // forceState below skips exit handlers, so the camera has to be handed back
  // explicitly here.
  dockingCamera.release();
  // M8: unconditionally, BEFORE the early return. This is the catch-all exit —
  // dungeon entry, error recovery, test resets — and every one of them must
  // leave a stored location of SPACE, or the next login drops the player into a
  // hangar they already left.
  saveLocation("SPACE", null, state.player.zone);
  if (sceneManager.state === GameState.SPACE) return; // already there
  sceneManager.forceState(GameState.SPACE);
  console.log("[docking] forced undock → SPACE (", reason, ")");
}

/**
 * Pick the scene to boot into after login and put the machine there (M8).
 *
 * Called once, from the flag-gated wiring effect in App.tsx, in place of the
 * unconditional forceState(SPACE) that used to sit there.
 *
 * forceState rather than transitionTo on purpose: this is the boot-time entry
 * the manager documents for exactly this case. A real transition would run
 * HANGAR.enter, whose only job is fading the world back IN from a blackout —
 * and at boot nothing was ever faded out, so there is nothing to reveal.
 *
 * Position is deliberately NOT touched. The server owns it (rule 1), the client
 * persisted the station position at dock time so the server already agrees, and
 * UNDOCKING.enter snaps to the station itself before building the departure —
 * so the outbound flight has a valid origin either way.
 *
 * @returns true if the player was restored into a station.
 */
export function bootIntoStoredLocation(): boolean {
  const loc = loadLocation();
  if (!loc || loc.type !== "STATION" || !loc.stationId) {
    sceneManager.forceState(GameState.SPACE);
    return false;
  }

  const station = STATIONS.find((s) => s.id === loc.stationId);
  if (!station) {
    console.warn("[docking] stored station no longer exists —", loc.stationId);
    clearLocation();
    sceneManager.forceState(GameState.SPACE);
    return false;
  }
  // The server decides which zone the player is in. If it disagrees with where
  // the dock was recorded, the dock is the stale one — a warp happened, or the
  // save is from another character.
  if (station.zone !== state.player.zone) {
    console.warn("[docking] stored dock is in", station.zone, "but player is in", state.player.zone, "— dropping it");
    clearLocation();
    sceneManager.forceState(GameState.SPACE);
    return false;
  }

  state.dockedAt = station.id;
  state.hangarTab = "bounties";
  state.player.vel = { x: 0, y: 0 };
  // Clear any stale move order left over from the fresh-state defaults, so the
  // ship is not carrying an instruction to fly somewhere the moment it undocks.
  state.cameraTarget = { x: state.player.pos.x, y: state.player.pos.y };
  // The undock ramps the zoom back to whatever the camera controller believes
  // the player's own zoom is. Nobody docked in this session, so nothing captured
  // it — without this the departure would yank them to a stale default.
  dockingCamera.adoptPlayerZoom();
  // Tell the server. Its isDocked flag is per-connection and starts false, so
  // without this the player would sit in the hangar UI while the engine still
  // treats them as a valid target. Deliberately NOT runDockingServices() — that
  // repairs and refuels, and re-running it on every reload would be a free heal.
  sendDockEnter();
  // Login-while-docked skips the docking cinematic entirely, so preload the 3D
  // hangar and stage it PARKED (no fly-in) before entering HANGAR. The
  // restoreParked flag tells the HANGAR handler to showParked instead of playIntro.
  if (ENABLE_HANGAR_3D_SCENE) {
    restoreParked = true;
    void (async () => {
      try {
        disposeHangarScene();
        const hs = await HangarScene.preload(String(state.player?.shipClass ?? "skimmer"));
        setActiveHangarScene(hs);
      } catch (e) {
        console.error("[docking] hangar restore preload failed — 2D fallback", e);
        setActiveHangarScene(null);
      }
      sceneManager.forceState(GameState.HANGAR);
      bump();
    })();
  } else {
    sceneManager.forceState(GameState.HANGAR);
    bump();
  }
  console.log("[docking] restored into station", station.id);
  return true;
}
