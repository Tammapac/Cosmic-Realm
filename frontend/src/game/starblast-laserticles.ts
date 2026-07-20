/**
 * Starblast laser core+trail particle system, ported from
 * starblastStandard.html.
 *
 * Sources:
 * - `this.Il10O = function() {...}` at starblastStandard.html:5359-5469
 *   (procedural laser shape texture atlas: 7 shapes x 5 gradient/darkness
 *   rows, drawn into a 2048x1024 canvas).
 * - `this.Laserticles = function() {...}` at starblastStandard.html:5470-5537
 *   (GPU-buffer particle pool: one "core" point per laser + a per-type
 *   number of "trail" points spawned behind it every tick, plus impact
 *   fragments on kill()).
 *
 * Same THREE.Points -> PIXI.Mesh translation rationale as
 * starblast-explosions.ts (see that file's header for the full
 * explanation of the quad-per-point substitution for gl_PointSize/
 * gl_PointCoord, and for why the toroidal system_size wrap is dropped).
 *
 * Untouched from source: core/trail pool split (core_size=500), the
 * per-type trail particle counts and speed/size falloff curves in lll1O(),
 * the kill() impact-fragment count (18 normal / 8 for types 1-3) and its
 * angle-jitter logic, the vertex shader's exponential rise-to-speed curve
 * and lifetime-based opacity falloff, the fragment shader's
 * rotated-per-particle texture-atlas sampling (co/si rotation matrix), and
 * every literal color-atlas coordinate in Il10O's 7 shape definitions.
 */
import * as PIXI from "pixi.js";

// ── Il10O: procedural laser shape texture atlas ──────────────────────────
// Ported verbatim from t.shape1..t.shape7 / t.drawGradient / t.drawLaser /
// t.createTexture (starblastStandard.html:5361-5469). Each shape is an
// array of point-loops (outline polygons in a -2..2 x -1..1 local space),
// laid into a 5-column x 2-row grid cell of the atlas, each cell 3x3
// "units" apart per the original's `translate(s%5*3, 3*floor(s/5))`.
type Shape = number[][][];

function shape1(): Shape {
  const pts: number[][] = [];
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    let l = Math.cos(t);
    let n = Math.sin(t);
    l = l < 0 ? -Math.sqrt(-l) : Math.sqrt(l);
    n = n < 0 ? -Math.sqrt(-n) : Math.sqrt(n);
    pts.push([l, n / 3]);
  }
  return [pts];
}

function shape2(): Shape {
  const l: number[][] = [];
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    let a = Math.cos(t);
    let o = Math.sin(t);
    a = a < 0 ? -Math.sqrt(-a) : Math.sqrt(a);
    o = o < 0 ? -1 : Math.sqrt(o);
    l.push([1.4 * a, 0.2 + o / 10]);
  }
  const n: number[][] = [];
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    let a = Math.cos(t);
    let o = Math.sin(t);
    a = a < 0 ? -Math.sqrt(-a) : Math.sqrt(a);
    o = o < 0 ? -Math.sqrt(-o) : 1;
    n.push([1.4 * a, o / 10 - 0.2]);
  }
  return [l, n];
}

function shape3(): Shape {
  return [
    [
      [2, 0], [1, 0.1], [0.55, 0.8], [0.35, -0.1], [0.05, 0.8], [-0.25, -0.1],
      [-0.55, 0.8], [-1, 0.1], [-2, 0], [-1, -0.1], [-0.85, -0.8], [-0.55, 0.1],
      [-0.25, -0.8], [0.05, 0.1], [0.35, -0.8], [0.55, 0.1], [0.75, -0.8], [1, -0.1], [2, 0],
    ],
  ];
}

function shape4(): Shape {
  return [
    [[1.4, -0.6], [1.1, -0.6], [1.1, 0.6], [1.4, 0.6]],
    [[0.55, -0.6], [0.25, -0.6], [0.25, 0.6], [0.55, 0.6]],
    [[-0.55, -0.6], [-0.25, -0.6], [-0.25, 0.6], [-0.55, 0.6]],
    [[-1.4, -0.6], [-1.1, -0.6], [-1.1, 0.6], [-1.4, 0.6]],
  ];
}

function shape5(): Shape {
  const n: number[][] = [];
  const t = [0, 70, 90, 110, 180, 250, 270, 290, 360];
  const s = [1, 1, 0.7, 1, 1, 1, 0.7, 1, 1];
  for (let e = 0; e <= s.length - 1; e++) {
    const a = Math.cos((t[e] * Math.PI) / 180) * s[e];
    const o = Math.sin((t[e] * Math.PI) / 180) * s[e];
    n.push([a, o / 2]);
  }
  return [n];
}

function shape6(): Shape {
  return [
    [[2, 0.4], [2, -0.4], [-2, -0.4], [-2, 0.4]],
    [[0.4, 2], [0.4, -2], [-0.4, -2], [-0.4, 2]],
  ];
}

function shape7(): Shape {
  const pts: number[][] = [];
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    pts.push([Math.cos(t), Math.sin(t)]);
  }
  return [pts];
}

/** Ported from t.drawGradient (starblastStandard.html:5365-5367). */
function drawGradient(ctx: CanvasRenderingContext2D, brightness: number | undefined, drawCenterLine: number): void {
  const e = brightness == null ? 0.5 : brightness;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `hsla(10,100%,100%,${e})`);
  g.addColorStop(1, "hsla(10,100%,100%,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  if (drawCenterLine === 1) {
    ctx.fillStyle = "#000";
    ctx.fillRect(-1, -0.025, 2, 0.05);
  }
}

/** Ported from t.drawLaser (starblastStandard.html:5462-5468). */
function drawLaser(ctx: CanvasRenderingContext2D, shape: Shape): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.3);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,.5)");
  ctx.fillStyle = g;
  for (const loop of shape) {
    ctx.beginPath();
    for (const [ox, oy] of loop) ctx.lineTo(0.3 * ox, 0.3 * oy);
    ctx.closePath();
    ctx.fill();
  }
}

/** Ported from t.createTexture (starblastStandard.html:5361-5364). Produces
 *  the 2048x1024 laser-shape atlas sampled by both the laserticle fragment
 *  shader (per-type shape lookup) and Laserticles' own createTexture(),
 *  which simply wraps this canvas as a THREE/PIXI texture. */
function createLaserAtlasTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const shapes: Shape[] = [shape1(), shape2(), shape3(), shape4(), shape5(), shape6(), shape7()];
  const ctx = canvas.getContext("2d")!;
  ctx.translate(0, canvas.height);
  ctx.scale(canvas.width / 8, -canvas.width / 8);
  ctx.translate(0.5, 0.5);
  ctx.scale(0.5, 0.5);
  const brightness = [0.5, 0.1, 0.04, 0.1, 0.5];
  for (let s = 0; s < shapes.length; s++) {
    ctx.save();
    ctx.translate((s % 5) * 3, 3 * Math.floor(s / 5));
    drawGradient(ctx, brightness[s], s);
    drawLaser(ctx, shapes[s]);
    ctx.restore();
  }
  return canvas;
}

// ── Laserticles: GPU-buffer laser core+trail particle pool ──────────────
// Ported from t.prototype.l0111 (starblastStandard.html:5510-5533).
// gl_PointCoord -> vCorner quad substitution as in starblast-explosions.ts.
// `type`-dependent atlas offset (toffset) and per-particle rotation
// (co/si, computed from `angle`, or forced to 0 for type 5 = impact
// fragments) are carried over exactly.
const VERT_SRC = `
attribute vec2 aCorner;
attribute vec3 aPosition;
attribute vec2 aSpeed;
attribute float aSize;
attribute float aTime;
attribute float aAngle;
attribute float aSpeedRatio;
attribute vec3 aColor;
attribute float aOpac;
attribute float aType;
attribute float aLifetime;

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
uniform float uNow;

varying float vOpacity;
varying vec3 vColor;
varying float vCo;
varying float vSi;
varying vec2 vToffset;
varying vec2 vCorner;

void main() {
  float t = max(0.0, (uNow - aTime) / 60.0);
  float rise = 1.0 - exp(-t * 0.5);
  float c = cos(aAngle);
  float s = sin(aAngle);
  vec2 pos = aPosition.xy;
  pos.x += aSpeedRatio * c * rise * 100.0 + aSpeed.x * 60.0 * t;
  pos.y += aSpeedRatio * s * rise * 100.0 + aSpeed.y * 60.0 * t;

  vOpacity = 1.0 * pow(max(0.0, (aLifetime - t) / aLifetime), aOpac);
  float pointSize = aSize * vOpacity;
  vColor = aColor;

  float a = aAngle;
  if (aType == 5.0) { a = 0.0; }
  vCo = cos(a);
  vSi = -sin(a);
  vToffset = vec2(mod(aType, 5.0) * 1.5, floor(aType / 5.0) * 1.5);
  vCorner = aCorner;

  vec2 screenPos = pos + aCorner * pointSize * 0.5;
  vec3 transformed = translationMatrix * vec3(screenPos, 1.0);
  gl_Position = vec4((projectionMatrix * transformed).xy, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision mediump float;

uniform sampler2D uTexture;
varying float vOpacity;
varying vec3 vColor;
varying float vCo;
varying float vSi;
varying vec2 vToffset;
varying vec2 vCorner;

void main() {
  vec2 pt = vCorner;
  pt = vec2(pt.x * vCo + pt.y * vSi, pt.x * vSi - pt.y * vCo);
  vec4 c = texture2D(uTexture, (vToffset + pt * 0.5 + 0.5) * vec2(0.125, 0.25));
  gl_FragColor = c * vec4(vColor, vOpacity);
}
`;

// 4 corners (one per quad vertex) -- see starblast-explosions.ts CORNERS
// comment for why this is 4, not 6, entries.
const CORNERS = [-1, -1, 1, -1, 1, 1, -1, 1];

/** Matches ll1O0's `this.type = Math.max(0, Math.min(6, 0|type))` domain. */
export type LaserticleType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type LaserSpawnParams = {
  x: number;
  y: number;
  z: number;
  vx: number; // I1111 — ship/source velocity carried into the trail drift
  vy: number; // I10lI
  angle: number;
  spawnTime: number; // OI11l — tick the laser was fired
  speed: number; // laser travel speed (used for speedratio = speed/100)
  damage: number;
  type: LaserticleType;
  lifetimeFrames: number; // lIlO0 — frames until this laser's trail fades
  colorHex: number; // IlO01 — already-resolved 0xRRGGBB
};

/** Per-laser handle returned by addLaser(), mirroring ll1O0's core_index/
 *  index bookkeeping so kill() can find this laser's core slot again. */
export class LaserticleHandle {
  coreIndex = 0;
  trailIndex = 0;
  x: number;
  y: number;
  z: number;
  angle: number;
  damage: number;
  type: LaserticleType;
  speed: number;
  lifetimeFrames: number;

  constructor(p: LaserSpawnParams) {
    this.x = p.x;
    this.y = p.y;
    this.z = p.z;
    this.angle = p.angle;
    this.damage = p.damage;
    this.type = p.type;
    this.speed = p.speed;
    this.lifetimeFrames = p.lifetimeFrames;
  }
}

export class StarblastLaserticles {
  readonly mesh: PIXI.Mesh<PIXI.Shader>;
  private readonly size: number;
  private readonly coreSize = 500;
  private readonly trailSize: number;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly sizes: Float32Array;
  private readonly times: Float32Array;
  private readonly angles: Float32Array;
  private readonly speedRatios: Float32Array;
  private readonly colors: Float32Array;
  private readonly opacities: Float32Array;
  private readonly types: Float32Array;
  private readonly lifetimes: Float32Array;
  private readonly corners: Float32Array;
  private readonly geometry: PIXI.Geometry;
  private readonly shader: PIXI.Shader;
  private index: number;
  private coreIndex = 0;
  private readonly startTime = Date.now();
  private dirty = false;

  constructor(size = 2000, screenHeightZoomProvider: () => { height: number; zoom: number } = () => ({ height: 1000, zoom: 1 })) {
    this.size = size;
    this.trailSize = size - this.coreSize;
    this.index = this.coreSize;
    this.getScreen = screenHeightZoomProvider;

    this.positions = new Float32Array(3 * size * 4);
    this.speeds = new Float32Array(2 * size * 4);
    this.sizes = new Float32Array(size * 4);
    this.times = new Float32Array(size * 4);
    this.angles = new Float32Array(size * 4);
    this.speedRatios = new Float32Array(size * 4);
    this.colors = new Float32Array(3 * size * 4);
    this.opacities = new Float32Array(size * 4);
    this.types = new Float32Array(size * 4);
    this.lifetimes = new Float32Array(size * 4);
    this.corners = new Float32Array(size * 8);

    for (let i = 0; i < size; i++) {
      // lifetime=1 (not 0): VERT_SRC's vOpacity is pow((aLifetime-t)/aLifetime, aOpac)
      // — aLifetime=0 divides by zero (NaN) for every idle pool slot before
      // its first addLaser()/kill() write. size=0 already keeps idle slots
      // invisible (pointSize = aSize*vOpacity = 0), so this only removes the
      // NaN, not a second visibility mechanism.
      this.writeVertexShared(i, 0, 0, 1000, 0, 0, 0, 0, 1, 1, 0, 0, 0, [0, 0, 0]);
      this.corners.set(CORNERS, i * 8);
    }

    this.geometry = new PIXI.Geometry()
      .addAttribute("aPosition", this.positions, 3)
      .addAttribute("aSpeed", this.speeds, 2)
      .addAttribute("aSize", this.sizes, 1)
      .addAttribute("aTime", this.times, 1)
      .addAttribute("aAngle", this.angles, 1)
      .addAttribute("aSpeedRatio", this.speedRatios, 1)
      .addAttribute("aColor", this.colors, 3)
      .addAttribute("aOpac", this.opacities, 1)
      .addAttribute("aType", this.types, 1)
      .addAttribute("aLifetime", this.lifetimes, 1)
      .addAttribute("aCorner", this.corners, 2)
      .addIndex(this.buildIndices(size) as unknown as number[]);

    const atlasCanvas = createLaserAtlasTexture();
    const texture = PIXI.Texture.from(atlasCanvas);
    texture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;

    this.shader = PIXI.Shader.from(VERT_SRC, FRAG_SRC, {
      uTexture: texture,
      uNow: 0,
    });

    const state = PIXI.State.for2d();
    // TEMP DIAGNOSTIC — NORMAL instead of ADD, to test whether the mesh
    // draws any fragments at all vs. additive blending into invisibility.
    // Revert to PIXI.BLEND_MODES.ADD once the real cause is confirmed.
    state.blendMode = PIXI.BLEND_MODES.NORMAL;
    state.depthTest = false;

    this.mesh = new PIXI.Mesh(this.geometry, this.shader, state);
  }

  private getScreen: () => { height: number; zoom: number };

  // See starblast-explosions.ts buildIndices() for why this prefers
  // Uint16Array: a Uint32 index buffer silently fails to draw at all on a
  // WebGL context without canUseUInt32ElementIndex.
  private buildIndices(size: number): Uint16Array | Uint32Array {
    const maxIndex = size * 4 - 1;
    const idx = maxIndex <= 65535 ? new Uint16Array(size * 6) : new Uint32Array(size * 6);
    for (let i = 0; i < size; i++) {
      const v = i * 4;
      idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
    }
    return idx;
  }

  private writeVertexShared(
    i: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    time: number,
    angle: number,
    opac: number,
    lifetime: number,
    speedRatio: number,
    size: number,
    type: number,
    color: [number, number, number]
  ): void {
    for (let c = 0; c < 4; c++) {
      const v = i * 4 + c;
      this.positions[3 * v] = x;
      this.positions[3 * v + 1] = y;
      this.positions[3 * v + 2] = z;
      this.speeds[2 * v] = sx;
      this.speeds[2 * v + 1] = sy;
      this.times[v] = time;
      this.angles[v] = angle;
      this.opacities[v] = opac;
      this.lifetimes[v] = lifetime;
      this.speedRatios[v] = speedRatio;
      this.sizes[v] = size;
      this.types[v] = type;
      this.colors[3 * v] = color[0];
      this.colors[3 * v + 1] = color[1];
      this.colors[3 * v + 2] = color[2];
    }
  }

  /**
   * Ported from t.prototype.lll1O (starblastStandard.html:5476-5495) --
   * writes the laser's core particle, then a per-type number of trail
   * particles behind it. `handle` receives the resolved core_index/index
   * so kill() (below) can locate this laser's trail-write cursor again,
   * mirroring the source's `t.core_index = this.core_index` mutation.
   */
  addLaser(p: LaserSpawnParams, handle: LaserticleHandle): void {
    const { height, zoom } = this.getScreen();
    const r = ((p.colorHex >> 16) & 255) / 255;
    const g = ((p.colorHex >> 8) & 255) / 255;
    const b = (p.colorHex & 255) / 255;
    const color: [number, number, number] = [r, g, b];

    handle.coreIndex = this.coreIndex;
    handle.trailIndex = this.index;

    const coreSize = (60 * height) / 1000 * Math.pow(p.damage / 10, 0.75) / zoom;
    this.writeVertexShared(
      this.coreIndex,
      p.x,
      p.y,
      p.z,
      p.vx,
      p.vy,
      p.spawnTime,
      p.angle,
      0.1,
      p.lifetimeFrames / 60,
      p.speed / 100,
      coreSize,
      p.type,
      color
    );
    this.coreIndex = (this.coreIndex + 1) % this.coreSize;

    const cosA = Math.cos(p.angle);
    const sinA = Math.sin(p.angle);

    switch (p.type) {
      case 1:
        for (let n = 1; n <= 9; n++) {
          const size = (60 * height) / 1000 * Math.pow(p.damage / 10, 0.75) / zoom;
          this.writeVertexShared(
            this.index, p.x, p.y, p.z, p.vx, p.vy, p.spawnTime,
            p.angle + 0 * (Math.random() - 0.5), 0.5, p.lifetimeFrames / 60,
            (p.speed / 100) * (1 - n / 100), size, p.type, color
          );
          this.index = ((this.index - this.coreSize + 1) % this.trailSize) + this.coreSize;
        }
        break;
      case 2:
        for (let n = 1; n <= 9; n++) {
          const size = (60 * height) / 1000 * Math.pow(p.damage / 10, 0.75) / Math.pow(zoom, 1 - n / 25);
          this.writeVertexShared(
            this.index, p.x, p.y, p.z, p.vx, p.vy, p.spawnTime,
            p.angle + 0 * (Math.random() - 0.5), 0.5, p.lifetimeFrames / 60,
            (p.speed / 100) * (1 - n / 60), size, p.type, color
          );
          this.index = ((this.index - this.coreSize + 1) % this.trailSize) + this.coreSize;
        }
        break;
      case 3:
        for (let n = 1; n <= 9; n++) {
          const size = (60 * height) / 1000 * Math.pow(p.damage / 10, 0.75) / zoom;
          this.writeVertexShared(
            this.index, p.x, p.y, p.z, p.vx, p.vy, p.spawnTime,
            p.angle + 0 * (Math.random() - 0.5), 0.5, p.lifetimeFrames / 60,
            (p.speed / 100) * (1 - n / 60), size, p.type, color
          );
          this.index = ((this.index - this.coreSize + 1) % this.trailSize) + this.coreSize;
        }
        break;
      case 4:
      case 6:
        for (let n = 1; n <= 19; n++) {
          const size = 0.25 * Math.pow(Math.random(), 1) * (60 * height) / 1000 * Math.pow(p.damage / 10, 0.75) / zoom;
          this.writeVertexShared(
            this.index, p.x + 0.1 * (Math.random() - 0.5), p.y + 0.1 * (Math.random() - 0.5), p.z,
            p.vx, p.vy, p.spawnTime, p.angle + 0.025 * (Math.random() - 0.5), 0.2,
            p.lifetimeFrames / 60, Math.pow(Math.random(), 0.1) * (p.speed / 100), size, p.type, color
          );
          this.index = ((this.index - this.coreSize + 1) % this.trailSize) + this.coreSize;
        }
        break;
      default:
        for (let n = 1; n <= 19; n++) {
          const s = Math.random();
          const size = 15 * Math.random() * (60 * height) / 1000 * Math.pow(p.damage / 10, 0.75) / zoom;
          this.writeVertexShared(
            this.index, p.x - s * cosA, p.y - s * sinA, p.z, p.vx, p.vy, p.spawnTime,
            p.angle + 0 * (Math.random() - 0.5), 1, p.lifetimeFrames / 60,
            Math.pow(Math.random(), 0.05) * (p.speed / 100), size, p.type, color
          );
          this.index = ((this.index - this.coreSize + 1) % this.trailSize) + this.coreSize;
        }
    }
    this.dirty = true;
  }

  /**
   * Ported from t.prototype.kill (starblastStandard.html:5496-5499) --
   * spawns impact fragments at the laser's actual hit point/angle. `o=8`
   * fragments for laser types 1-3, `o=18` otherwise (unchanged from
   * source). `reverseSpread`/type-6 both widen the angle jitter to a full
   * ~180 degree cone (`angle + 2*(random-.5) + PI`) instead of the narrow
   * forward jitter used otherwise — carried over exactly as the source's
   * `s || 6 === t.type` branch.
   */
  kill(handle: LaserticleHandle, hitX: number, hitY: number, reverseSpread = false): void {
    const { height, zoom } = this.getScreen();
    let fragCount = 18;
    if (handle.type > 0 && handle.type < 4) fragCount = 8;

    // Source hides the killed core by pushing its depth far away
    // (`this.vertices[3*t.core_index+2] = 1000`), relying on THREE's
    // Points depth test to drop it. VERT_SRC here never reads aPosition.z
    // (screenPos/gl_Position are computed from aPosition.xy only), so that
    // z-write is a no-op in this port — the core stayed visible, frozen at
    // its last position, until its own lifetime curve happened to fade it.
    // Zero aSize instead: pointSize = aSize * vOpacity (VERT_SRC:212), so a
    // zero size collapses the quad to nothing regardless of vOpacity/aOpac
    // (note aOpac=0 would do the opposite here — vOpacity's pow(x, aOpac)
    // term evaluates to 1.0, i.e. fully opaque, at aOpac=0).
    const coreVertexBase = handle.coreIndex * 4;
    for (let c = 0; c < 4; c++) {
      this.positions[3 * (coreVertexBase + c) + 2] = 1000;
      this.sizes[coreVertexBase + c] = 0;
    }

    for (let l = 0; l <= fragCount; l++) {
      const n = ((handle.trailIndex + l - this.coreSize) % this.trailSize) + this.coreSize;
      const angle =
        reverseSpread || handle.type === 6
          ? handle.angle + 2 * (Math.random() - 0.5) + Math.PI
          : handle.angle + 1 * (Math.random() - 0.5);
      // III00[n] = 45*random*height/1000*pow(damage/10,.75)/zoom (source:5498)
      const fragSize = (45 * Math.random() * height) / 1000 * Math.pow(handle.damage / 10, 0.75) / zoom;
      let type = handle.type;
      let opac = 1;
      let speedRatio = (handle.speed / 100) * Math.random() * 0.4;
      if (handle.type === 6) {
        type = 5;
        opac = 0.2;
        speedRatio *= 0.5;
      }
      this.writeVertexShared(
        n, hitX, hitY, 3, 0, 0, this.uNowFrame, angle, opac,
        handle.lifetimeFrames / 120, speedRatio, fragSize, type,
        [this.colors[3 * coreVertexBase], this.colors[3 * coreVertexBase + 1], this.colors[3 * coreVertexBase + 2]]
      );
    }
    this.dirty = true;
  }

  private uNowFrame = 0;

  /** Advances the shader's time uniform. Call once per tick with the
   *  game's tick counter (Starblast's `this.O0Ol1.OI1Il.OIOll`) -- unlike
   *  Explosions (which uses wall-clock seconds), Laserticles' shader and
   *  kill()/addLaser() lifetime math both run in game-tick units, so the
   *  caller passes the authoritative tick count directly. */
  tick(currentTick: number): void {
    this.uNowFrame = currentTick;
    this.shader.uniforms.uNow = currentTick;
    if (this.dirty) {
      this.geometry.getBuffer("aPosition").update(this.positions as unknown as number[]);
      this.geometry.getBuffer("aSpeed").update(this.speeds as unknown as number[]);
      this.geometry.getBuffer("aSize").update(this.sizes as unknown as number[]);
      this.geometry.getBuffer("aTime").update(this.times as unknown as number[]);
      this.geometry.getBuffer("aAngle").update(this.angles as unknown as number[]);
      this.geometry.getBuffer("aSpeedRatio").update(this.speedRatios as unknown as number[]);
      this.geometry.getBuffer("aColor").update(this.colors as unknown as number[]);
      this.geometry.getBuffer("aOpac").update(this.opacities as unknown as number[]);
      this.geometry.getBuffer("aType").update(this.types as unknown as number[]);
      this.geometry.getBuffer("aLifetime").update(this.lifetimes as unknown as number[]);
      this.dirty = false;
    }
  }

  destroy(): void {
    this.mesh.destroy({ children: true });
    this.geometry.destroy();
    this.shader.destroy();
  }
}
