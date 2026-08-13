// ─────────────────────────────────────────────────────────────────────────────
// HangarDoorController — opens/closes ONLY the hangar door, nothing else.
//
// Milestone 3. Supports the cleanest available door representation, in priority
// order:
//   A. A GLTF animation clip (preferred). cosmic_station.glb ships
//      "HangarRampAction.002" targeting the "HangarRamp" node's rotation.
//   B. A separate named door mesh (or two) animated by this controller when no
//      clip exists — local rotation/position tween, original closed transform
//      preserved.
//   D. Door merged into the station mesh → NOT supported; we refuse rather than
//      fake it by moving the whole station. The caller gets a rejected promise
//      and a clear error, and the model must be fixed in Blender.
//
// This controller owns its own AnimationMixer (case A) and must be pumped via
// update(dt) from the scene's existing loop — it never starts its own RAF.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from "three";

/** Preferred names, checked case-insensitively. */
const DOOR_NODE_NAMES = ["HangarRamp", "HangarDoor", "HangarDoor_Left", "HangarDoor_Right"];
const OPEN_CLIP_NAMES = ["Hangar_Open", "HangarRampAction", "Open"];
const CLOSE_CLIP_NAMES = ["Hangar_Close", "Close"];

type DoorMode = "clip" | "mesh" | "none";

export interface DoorInit {
  /** The loaded station scene root (gltf.scene). */
  root: THREE.Object3D;
  /** Animation clips from the same GLTF (gltf.animations). */
  clips?: THREE.AnimationClip[];
}

export class HangarDoorController {
  private mode: DoorMode = "none";
  private mixer: THREE.AnimationMixer | null = null;
  private openAction: THREE.AnimationAction | null = null;
  private closeAction: THREE.AnimationAction | null = null;
  // Case A (clip) manual time-scrub state:
  private clipDur = 0;
  private clipClosedTime = 0; // clip time where the door is fully CLOSED
  private clipOpenTime = 0;   // clip time where the door is fully OPEN
  private clipScrub: { t: number; dur: number; from: number; to: number; resolve: () => void } | null = null;
  // Case B (mesh tween) state:
  private doorMeshes: THREE.Object3D[] = [];
  /** The node the CLIP animates. Empty doorMeshes in "clip" mode, so tracked separately. */
  private clipTarget: THREE.Object3D | null = null;
  private closedQuats: THREE.Quaternion[] = [];
  private openQuats: THREE.Quaternion[] = [];
  private tween: { t: number; dur: number; dir: 1 | -1; resolve: () => void } | null = null;
  private isOpen = false;
  private busy = false;

  constructor(init: DoorInit) {
    this.detect(init);
  }

  /** What representation did we find? "clip" | "mesh" | "none". */
  get doorMode(): DoorMode {
    return this.mode;
  }

  get ready(): boolean {
    return this.mode !== "none";
  }

  /**
   * The node the door animation actually moves — i.e. where the hangar mouth
   * IS. The station layer reads its world position to tell the docking flow
   * which point in the world to fly the ship into. Null when no door.
   */
  get doorNode(): THREE.Object3D | null {
    return this.clipTarget ?? this.doorMeshes[0] ?? null;
  }

  private detect(init: DoorInit): void {
    const { root, clips } = init;

    // Case A: a usable animation clip that drives a door node.
    if (clips && clips.length) {
      const findClip = (names: string[]) =>
        clips.find((c) => names.some((n) => c.name.toLowerCase().includes(n.toLowerCase())));
      const openClip = findClip(OPEN_CLIP_NAMES) ?? (clips.length === 1 ? clips[0] : undefined);
      if (openClip) {
        this.mixer = new THREE.AnimationMixer(root);
        this.openAction = this.mixer.clipAction(openClip);
        this.openAction.setLoop(THREE.LoopOnce, 1);
        this.openAction.clampWhenFinished = true;
        this.clipDur = openClip.duration;
        // Drive the door by setting the action's .time then applying it with
        // mixer.update(0). The action must be enabled+playing with full weight
        // for update(0) to write the pose; we scrub .time ourselves so it never
        // advances on its own. Deterministic in both directions.
        this.openAction.enabled = true;
        this.openAction.setEffectiveWeight(1);
        this.openAction.play();
        // The exported clip may be a full open→hold→close cycle (not just an
        // open). Find the time of MAXIMUM movement (fully open) and a closed
        // time, so open()/close() scrub to the right poses regardless of how the
        // clip was authored.
        this.findClipPoses(root);
        this.openAction.time = this.clipClosedTime;
        this.mixer.update(0);
        this.mode = "clip";
        return;
      }
    }

    // Case B: separate named door mesh(es) we can tween ourselves.
    const meshes: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (DOOR_NODE_NAMES.some((n) => o.name.toLowerCase() === n.toLowerCase())) meshes.push(o);
    });
    if (meshes.length) {
      this.doorMeshes = meshes;
      for (const m of meshes) {
        this.closedQuats.push(m.quaternion.clone());
        // Default open transform: rotate 95° about local X (a ramp folding down).
        const openQ = m.quaternion.clone().multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI * 0.53),
        );
        this.openQuats.push(openQ);
      }
      this.mode = "mesh";
      return;
    }

    // Case D: nothing usable found.
    this.mode = "none";
    console.error(
      "[HangarDoor] No door clip or named door mesh found. The door is likely " +
      "merged into the station mesh — fix the model in Blender (name it 'HangarDoor' " +
      "or add a 'Hangar_Open' clip). Refusing to fake it by moving the whole station.",
    );
  }

  /**
   * Sample the clip to find the closed vs. open times. The exported clip is a
   * full open→hold→close cycle, so "open" is the time of maximum door
   * displacement, not the clip end. We measure the animated door node's
   * quaternion angle away from its rest pose across the clip.
   */
  private findClipPoses(root: THREE.Object3D): void {
    if (!this.mixer || !this.openAction) return;
    // Find a node the clip actually animates (rotation/quaternion track).
    const clip = this.openAction.getClip();
    let target: THREE.Object3D | null = null;
    for (const track of clip.tracks) {
      const nodeName = track.name.split(".")[0];
      root.traverse((o) => { if (!target && o.name === nodeName) target = o; });
      if (target) break;
    }
    if (!target) { this.clipClosedTime = 0; this.clipOpenTime = clip.duration * 0.4; return; }
    this.clipTarget = target;

    const rest = (target as THREE.Object3D).quaternion.clone();
    let maxAngle = -1, openT = 0;
    const STEPS = 40;
    for (let i = 0; i <= STEPS; i++) {
      const t = (i / STEPS) * clip.duration;
      this.openAction.time = t;
      this.mixer.update(0);
      const ang = rest.angleTo((target as THREE.Object3D).quaternion);
      if (ang > maxAngle) { maxAngle = ang; openT = t; }
    }
    this.clipOpenTime = openT;
    this.clipClosedTime = 0; // clip starts closed
  }

  /** Open the door. Resolves when the motion finishes. */
  open(): Promise<void> {
    return this.run(true);
  }

  /** Close the door. Resolves when the motion finishes. */
  close(): Promise<void> {
    return this.run(false);
  }

  /** Snap the door to a state with no animation (e.g. spawn already-open). */
  setImmediate(open: boolean): void {
    this.cancelTween();
    this.isOpen = open;
    if (this.mode === "clip" && this.openAction && this.mixer) {
      this.openAction.time = open ? this.clipOpenTime : this.clipClosedTime;
      this.mixer.update(0);
    } else if (this.mode === "mesh") {
      for (let i = 0; i < this.doorMeshes.length; i++) {
        this.doorMeshes[i].quaternion.copy(open ? this.openQuats[i] : this.closedQuats[i]);
      }
    }
  }

  private run(open: boolean): Promise<void> {
    if (this.mode === "none") {
      return Promise.reject(new Error("[HangarDoor] no door to animate"));
    }
    if (this.busy) {
      // Prevent duplicate simultaneous actions — ignore, resolve immediately.
      console.warn("[HangarDoor] motion already in progress, ignoring request");
      return Promise.resolve();
    }
    if (open === this.isOpen) return Promise.resolve(); // already there

    this.busy = true;
    return new Promise<void>((resolve) => {
      const done = () => { this.busy = false; this.isOpen = open; resolve(); };

      if (this.mode === "clip" && this.openAction) {
        // Manual, deterministic scrub between the closed and open clip times.
        const from = this.openAction.time;
        const to = open ? this.clipOpenTime : this.clipClosedTime;
        this.clipScrub = { t: 0, dur: 0.9, from, to, resolve: done };
      } else if (this.mode === "mesh") {
        this.tween = { t: 0, dur: 0.9, dir: open ? 1 : -1, resolve: done };
      } else {
        done();
      }
    });
  }

  private cancelTween(): void {
    if (this.tween) { this.tween.resolve(); this.tween = null; }
    if (this.clipScrub) { this.clipScrub.resolve(); this.clipScrub = null; }
    this.busy = false;
  }

  /** Pump from the scene loop. dt in seconds. */
  update(dt: number): void {
    // Clip mode: drive the door by scrubbing the mixer's absolute time. We never
    // call mixer.update(dt) here, so the clip only moves when we scrub it.
    if (this.clipScrub && this.openAction && this.mixer) {
      const cs = this.clipScrub;
      cs.t = Math.min(1, cs.t + dt / cs.dur);
      const e = cs.t * cs.t * (3 - 2 * cs.t); // ease in-out
      this.openAction.time = cs.from + (cs.to - cs.from) * e;
      this.mixer.update(0);
      if (cs.t >= 1) {
        const resolve = cs.resolve;
        this.clipScrub = null;
        resolve();
      }
    }
    if (this.tween) {
      const tw = this.tween;
      tw.t += (dt / tw.dur) * tw.dir;
      const clamped = Math.max(0, Math.min(1, tw.t));
      // ease in-out
      const e = clamped * clamped * (3 - 2 * clamped);
      for (let i = 0; i < this.doorMeshes.length; i++) {
        this.doorMeshes[i].quaternion.copy(
          this.closedQuats[i].clone().slerp(this.openQuats[i], e),
        );
      }
      if (tw.t <= 0 || tw.t >= 1) {
        const resolve = tw.resolve;
        this.tween = null;
        resolve();
      }
    }
  }

  dispose(): void {
    this.cancelTween();
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.openAction = null;
    this.closeAction = null;
    this.doorMeshes = [];
    this.clipTarget = null;
    this.closedQuats = [];
    this.openQuats = [];
  }
}
