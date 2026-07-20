/**
 * Starblast camera shake, ported from starblastStandard.html.
 *
 * Source: `t.prototype.shakeCamera` at starblastStandard.html:6152-6154,
 * the `this.shake = {x,y,I1111,I10lI,r,IOl01}` state init at 6131-6138,
 * and the per-frame spring-damper integration inside `t.prototype.lO1I1`
 * at 6158:
 *
 *   this.shake.x += this.shake.I1111
 *   this.shake.y += this.shake.I10lI
 *   this.shake.r += this.shake.IOl01
 *   n = .2
 *   this.shake.I1111 -= this.shake.x * n
 *   this.shake.I10lI -= this.shake.y * n
 *   this.shake.IOl01 -= this.shake.r * n
 *   this.shake.I1111 *= .7
 *   this.shake.I10lI *= .7
 *   this.shake.IOl01 *= .7
 *
 * i.e. a critically-damped spring: each tick, offset integrates velocity,
 * velocity gets pulled back toward zero proportional to offset (spring
 * constant .2), then velocity itself decays by .7 (damping) -- run once
 * per simulated tick (Starblast ticks at a variable rate up to 60Hz inside
 * lO1I1's `for (l=1,a=IlOO1(); l<=a; l+=1)` loop; here it's driven once
 * per rendered frame from pixiRender(), which is the equivalent
 * "how many simulation steps happened this frame" granularity Cosmic
 * Realm already uses elsewhere).
 *
 * shakeCamera(t,e,i) itself (6152-6154) computes distance from the local
 * player to the impact point (t,e), early-outs beyond a 25-unit radius,
 * then derives impulse strength `s = max(0,1-n/25)*i*.5` and applies it at
 * a random angle to the velocity (I1111/I10lI), plus a small rotational
 * kick (IOl01 += .08*s*(random-.5)).
 *
 * Cosmic Realm's existing call sites (loop.ts, ~14 locations) already
 * compute their own event-specific distance falloff before writing a
 * single 0..1 intensity into `state.cameraShake` (max-wins accumulator,
 * no position) -- there is no per-event hit position plumbed through to
 * a shared consumer. Per explicit product decision, those call sites are
 * left untouched (they are the "trigger" layer, not in scope for this
 * port); this module ports the "apply" layer only: it treats the
 * resulting `state.cameraShake` value directly as `i` (power) with the
 * distance term `max(0,1-n/25)` fixed at 1 (no position available), i.e.
 * `s = i*.5`, then runs the exact same random-angle impulse + spring
 * integration as the source. This is the one deliberate formula
 * simplification in the whole port, and it only affects the "distance
 * gate", not the spring itself or its .2/.7/.08 constants.
 */

export type ShakeState = {
  x: number;
  y: number;
  vx: number; // I1111
  vy: number; // I10lI
  r: number;
  vr: number; // IOl01
};

export function createShakeState(): ShakeState {
  return { x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0 };
}

/**
 * Ported from shakeCamera (starblastStandard.html:6152-6154). `power` is
 * the source's `i` parameter (already includes Cosmic Realm's own
 * distance falloff from the trigger site, see file header). Distance gate
 * `max(0, 1-n/25)` is fixed to 1 since no hit position is threaded through
 * — see header note.
 */
export function applyShakeImpulse(shake: ShakeState, power: number): void {
  if (power <= 0) return;
  const s = power * 0.5;
  const angle = 2 * Math.random() * Math.PI;
  shake.vx += Math.cos(angle) * s;
  shake.vy += Math.sin(angle) * s;
  shake.vr += 0.08 * s * (Math.random() - 0.5);
}

/**
 * Ported from the spring-damper integration inside lO1I1
 * (starblastStandard.html:6158). Call once per simulated step; Cosmic
 * Realm calls this once per rendered frame (see starblast-camera-shake
 * consumer in pixi-renderer-v2-integrated.ts).
 */
export function stepShake(shake: ShakeState): void {
  shake.x += shake.vx;
  shake.y += shake.vy;
  shake.r += shake.vr;
  const springConstant = 0.2;
  shake.vx -= shake.x * springConstant;
  shake.vy -= shake.y * springConstant;
  shake.vr -= shake.r * springConstant;
  shake.vx *= 0.7;
  shake.vy *= 0.7;
  shake.vr *= 0.7;
}
