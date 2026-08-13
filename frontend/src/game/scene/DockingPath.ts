// ─────────────────────────────────────────────────────────────────────────────
// DockingPath — the smooth approach curve the ship flies during docking (M4).
//
// The Cosmic Realm world is 2D (PixiJS; the ship is state.player.pos {x,y}).
// So this is a 2D Catmull-Rom spline rather than a THREE.CatmullRomCurve3 —
// pulling three.js into the sim tick just to evaluate a flat curve would be
// pure overhead, and the Three.js camera here is a fixed top-down ortho anyway.
//
// The curve is ARC-LENGTH parameterised: pointAt(u) advances the same distance
// for the same change in u anywhere along the path. Without that, a raw spline
// visibly speeds up on long segments and crawls on short ones.
//
// Pure math, no engine state — safe to unit-test and impossible to destabilise
// the game with.
// ─────────────────────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

/** Standard uniform Catmull-Rom interpolation between p1 and p2. */
function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Resolution of the arc-length lookup table. 96 is plenty for a ~1000px path. */
const LUT_SAMPLES = 96;

export class DockingPath {
  /** Control points with the endpoints duplicated so the spline reaches them. */
  private readonly ctrl: Vec2[];
  private readonly segs: number;
  /** Cumulative arc length at each LUT sample. */
  private readonly lut: number[] = [];
  /** Total length of the curve in world units. */
  readonly length: number;

  constructor(points: Vec2[]) {
    if (points.length < 2) throw new Error("[DockingPath] need at least 2 points");
    const first = points[0];
    const last = points[points.length - 1];
    // Duplicating the ends gives the first/last segment a sane tangent, so the
    // ship leaves its start position and arrives at the dock without a kink.
    this.ctrl = [first, ...points, last];
    this.segs = this.ctrl.length - 3;

    let acc = 0;
    let prev = this.raw(0);
    this.lut.push(0);
    for (let i = 1; i <= LUT_SAMPLES; i++) {
      const p = this.raw((i / LUT_SAMPLES) * this.segs);
      acc += Math.hypot(p.x - prev.x, p.y - prev.y);
      this.lut.push(acc);
      prev = p;
    }
    this.length = acc;
  }

  /** Raw spline evaluation. s ∈ [0, segs] — NOT arc-length parameterised. */
  private raw(s: number): Vec2 {
    const clamped = Math.max(0, Math.min(this.segs - 1e-6, s));
    const i = Math.floor(clamped);
    const t = clamped - i;
    return catmullRom(this.ctrl[i], this.ctrl[i + 1], this.ctrl[i + 2], this.ctrl[i + 3], t);
  }

  /** Map normalised arc length u ∈ [0,1] to the raw spline parameter. */
  private sFor(u: number): number {
    const target = Math.max(0, Math.min(1, u)) * this.length;
    let lo = 0;
    let hi = this.lut.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.lut[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const d0 = this.lut[i - 1];
    const d1 = this.lut[i];
    const f = d1 - d0 > 1e-6 ? (target - d0) / (d1 - d0) : 0;
    return ((i - 1 + f) / LUT_SAMPLES) * this.segs;
  }

  /** Position at normalised arc length u ∈ [0,1]. Constant speed in u. */
  pointAt(u: number): Vec2 {
    return this.raw(this.sFor(u));
  }

  /** Facing (radians, atan2 convention) along the curve at u. */
  headingAt(u: number): number {
    const e = 0.004;
    const a = this.pointAt(Math.max(0, u - e));
    const b = this.pointAt(Math.min(1, u + e));
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
}

/**
 * Distance in front of the station where the curved sweep ends and the final
 * straight run-in begins. Gives the approach a readable "line up, then enter"
 * shape instead of curving right up to the hull.
 */
const ENTRY_OFFSET = 150;

/**
 * How far PAST the hangar mouth the path continues, so the ship flies THROUGH
 * the door instead of stopping dead on the threshold. Only used when an
 * approach axis is supplied; without one there is no "through" to speak of.
 */
export const DOOR_THROUGH = 110;

/**
 * Build the approach curve from wherever the ship is to the dock point.
 *
 * Shape: current position → a swept mid-point (curving to whichever side the
 * ship is already drifting, so the turn looks flown rather than snapped) →
 * a lined-up entry point ENTRY_OFFSET units out → the dock itself.
 *
 * @param inDir Optional unit vector for the direction of travel ON ARRIVAL —
 *   i.e. the axis running through the hangar mouth into the station. Supplying
 *   it lines the last leg up with the door and carries the ship DOOR_THROUGH
 *   units past it, so the approach reads as flying in rather than nosing up
 *   against the opening from whatever angle the player happened to be at.
 *   Omitted, the run-in points from the ship to the target as it always did.
 */
export function buildDockingApproach(
  from: Vec2,
  vel: Vec2,
  station: Vec2,
  inDir?: Vec2,
): DockingPath {
  const dx = station.x - from.x;
  const dy = station.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  // Axis of the final run-in. Without a door this is just "straight at it".
  const axLen = inDir ? Math.hypot(inDir.x, inDir.y) : 0;
  const ax = axLen > 1e-6 ? inDir!.x / axLen : ux;
  const ay = axLen > 1e-6 ? inDir!.y / axLen : uy;

  // Curve toward the side the ship is already moving, so the arc continues its
  // motion instead of cutting across it.
  const cross = vel.x * uy - vel.y * ux;
  const side = cross > 0 ? -1 : 1;
  const sweep = Math.min(170, dist * 0.32);

  // The dock prompt appears within 300 units, so the player often triggers a
  // dock from 40-80 units out. A fixed 150-unit entry point would then sit
  // BEHIND the ship, and the spline would loop backwards before coming in —
  // measured up to 8x the direct distance. Scale it with the gap instead.
  // With a door axis the entry point is what makes the ship line UP, so it may
  // not collapse to nothing: keep a floor under it.
  const entryOffset = axLen > 1e-6
    ? Math.max(90, Math.min(ENTRY_OFFSET, dist * 0.45))
    : Math.min(ENTRY_OFFSET, dist * 0.45);

  // Entry sits back along the run-in axis — OUTSIDE the door, not merely
  // between the ship and the station.
  const entry: Vec2 = {
    x: station.x - ax * entryOffset,
    y: station.y - ay * entryOffset,
  };
  // Sweep toward the entry point rather than the dock, or the arc aims at the
  // hull and then has to kink sideways to find the opening.
  const mid: Vec2 = {
    x: from.x + (entry.x - from.x) * 0.55 - uy * sweep * side,
    y: from.y + (entry.y - from.y) * 0.55 + ux * sweep * side,
  };
  const end: Vec2 = axLen > 1e-6
    ? { x: station.x + ax * DOOR_THROUGH, y: station.y + ay * DOOR_THROUGH }
    : { x: station.x, y: station.y };

  return new DockingPath([{ x: from.x, y: from.y }, mid, entry, end]);
}

/**
 * How far from the station the ship ends up after undocking. Matches the legacy
 * instant undock exactly (`state.player.pos.y += 200`), so the animated version
 * leaves the player in the same place the old one did — only the way it gets
 * there changes.
 */
const EXIT_DISTANCE = 200;
/** Straight run before the curve starts, so the ship clears the hull first. */
const CLEARANCE = 60;

/**
 * Build the departure curve out of a station (M7).
 *
 * Not simply the approach reversed: leaving is a different manoeuvre. The ship
 * pushes straight out of the dock first (CLEARANCE), then peels off to one side
 * before settling on the exit point — the sideways sweep is what makes it read
 * as flying away rather than being pushed backwards.
 *
 * @param dir Unit direction to leave in. Defaults to +y, matching the legacy
 *            undock so the ship comes out below the station as players expect.
 */
export function buildUndockDeparture(
  station: Vec2,
  dir: Vec2 = { x: 0, y: 1 },
  insideOffset = 0,
): DockingPath {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len;
  const uy = dir.y / len;
  // Perpendicular, for the peel-off.
  const px = -uy;
  const py = ux;
  const sweep = EXIT_DISTANCE * 0.22;

  // Start INSIDE the hangar when asked, so the ship comes out through the door
  // rather than materialising on the threshold. Everything after is still
  // measured from the mouth itself, so the exit point does not move.
  const start: Vec2 = { x: station.x - ux * insideOffset, y: station.y - uy * insideOffset };
  const clear: Vec2 = { x: station.x + ux * CLEARANCE, y: station.y + uy * CLEARANCE };
  const mid: Vec2 = {
    x: station.x + ux * EXIT_DISTANCE * 0.7 + px * sweep,
    y: station.y + uy * EXIT_DISTANCE * 0.7 + py * sweep,
  };
  const exit: Vec2 = { x: station.x + ux * EXIT_DISTANCE, y: station.y + uy * EXIT_DISTANCE };

  return new DockingPath([start, clear, mid, exit]);
}
