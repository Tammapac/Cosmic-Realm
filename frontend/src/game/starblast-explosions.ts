/**
 * Starblast explosion particle system, ported from starblastStandard.html.
 *
 * Source: `this.Explosions = function() {...}` at starblastStandard.html:5292-5358
 * (obfuscated identifiers preserved in comments below for traceability).
 *
 * Original used THREE.BufferGeometry + THREE.ShaderMaterial + THREE.Points
 * (a GPU point-sprite buffer, one draw call for the whole pool). PixiJS v7
 * has no THREE.Points equivalent, so this ports to PIXI.Geometry +
 * PIXI.Shader + a custom PIXI.Mesh in POINTS-like triangle-fan-per-point
 * form (WebGL has no native point-sprite primitive exposed by PixiJS, so
 * each "point" is drawn as a camera-facing quad — the only structural
 * change from the original; every per-particle formula in the shaders
 * below is copied verbatim from the source).
 *
 * Untouched from the source: particle pool size, explode()/blast() spawn
 * math (noise-driven directional speed, opacity/size falloff), the vertex
 * shader's decay curve `t2 = 1 - exp(-t*2)`, the fragment shader's texture
 * atlas lookup, and createTexture()'s procedural gradient generation.
 *
 * Deliberate omission (documented, not silently dropped): the original
 * wraps particle position with `mod(x + system_size*.5, system_size)` for
 * Starblast's toroidal (wrap-around) map. Cosmic Realm's world is an open
 * bounded map (see MAP_RADIUS in game/types.ts) with no position wrapping
 * anywhere in loop.ts, so that modulo is structurally inapplicable here
 * and has been removed from the ported vertex shader — every other line
 * of both shaders is unchanged.
 */
import * as PIXI from "pixi.js";

// ── Value noise (I0O10), ported verbatim from the string embedded at
// starblastStandard.html ~line 6007 (deepspaceworker source, byte-identical
// to the real in-module I0O10 class). Only `l0l1O` (fractal 2D noise) is
// used by Explosions.explode/blast; the rest of I0O10's surface (3D noise,
// worley/voronoi variants, turbulence) is not reachable from the ported
// code paths and is intentionally not carried over — this is not a
// minimized effect, it's dead code from Explosions' point of view. ──
const NOISE_TABLE_BASE = [670, 243, 963, 607, 432, 29, 624, 809, 254, 752, 691, 904, 275, 984, 586, 94, 1014, 614, 252, 178, 488, 954, 55, 836, 186, 858, 719, 562, 685, 898, 167, 844, 639, 505, 85, 386, 520, 988, 561, 889, 91, 329, 900, 847, 334, 531, 168, 57, 789, 529, 259, 323, 313, 72, 153, 606, 694, 442, 547, 922, 242, 983, 965, 876, 39, 728, 383, 109, 343, 810, 815, 144, 457, 434, 221, 279, 328, 136, 674, 556, 502, 896, 582, 250, 665, 370, 926, 912, 118, 543, 365, 467, 311, 700, 15, 297, 609, 731, 476, 634, 715, 777, 62, 1007, 525, 942, 310, 627, 630, 448, 437, 822, 300, 339, 924, 583, 92, 800, 698, 312, 542, 740, 271, 778, 895, 447, 175, 957, 17, 481, 347, 283, 366, 277, 843, 966, 927, 535, 503, 234, 746, 712, 1010, 544, 671, 295, 978, 729, 997, 287, 621, 782, 160, 433, 537, 121, 413, 304, 98, 657, 498, 946, 319, 595, 191, 341, 554, 523, 274, 209, 435, 644, 947, 979, 397, 261, 681, 786, 1006, 565, 472, 180, 318, 126, 874, 693, 526, 276, 340, 808, 884, 409, 486, 962, 960, 772, 901, 690, 359, 837, 129, 363, 509, 616, 88, 382, 730, 513, 623, 999, 504, 48, 4, 384, 281, 560, 417, 99, 773, 956, 943, 496, 558, 218, 170, 471, 536, 138, 19, 266, 6, 868, 845, 16, 985, 866, 601, 445, 458, 894, 950, 349, 1017, 125, 495, 723, 446, 647, 834, 880, 272, 475, 483, 227, 357, 750, 851, 139, 406, 336, 158, 284, 482, 324, 991, 632, 587, 663, 74, 256, 541, 120, 801, 831, 46, 522, 589, 1, 571, 368, 137, 761, 885, 968, 982, 948, 785, 391, 840, 932, 829, 117, 641, 466, 367, 688, 733, 229, 735, 14, 205, 31, 316, 333, 183, 521, 795, 58, 1021, 282, 794, 939, 40, 394, 793, 1002, 763, 212, 484, 133, 260, 465, 396, 769, 518, 955, 497, 377, 145, 508, 514, 224, 196, 454, 176, 975, 865, 1005, 1023, 986, 596, 426, 893, 551, 90, 130, 873, 22, 709, 686, 436, 236, 661, 579, 764, 362, 141, 112, 970, 987, 12, 317, 369, 26, 344, 66, 803, 493, 716, 9, 637, 945, 225, 703, 78, 346, 751, 123, 1009, 1016, 27, 52, 864, 902, 921, 292, 314, 599, 799, 263, 626, 338, 953, 491, 892, 353, 692, 917, 540, 882, 677, 744, 633, 821, 327, 60, 1020, 928, 788, 360, 414, 430, 462, 824, 820, 727, 398, 342, 273, 726, 981, 84, 82, 206, 388, 720, 806, 652, 550, 238, 159, 134, 732, 897, 500, 881, 805, 814, 701, 717, 566, 7, 211, 604, 816, 56, 658, 107, 61, 374, 320, 501, 13, 642, 863, 791, 438, 348, 97, 214, 86, 305, 875, 656, 24, 364, 767, 156, 879, 590, 734, 920, 655, 577, 83, 584, 660, 38, 100, 299, 580, 990, 636, 944, 463, 766, 996, 714, 8, 515, 87, 198, 280, 444, 131, 404, 108, 278, 487, 223, 598, 410, 395, 199, 268, 989, 75, 195, 760, 916, 977, 421, 11, 1000, 813, 216, 817, 823, 164, 668, 739, 572, 30, 707, 798, 291, 564, 77, 456, 478, 68, 643, 615, 172, 841, 672, 919, 1012, 613, 385, 980, 711, 771, 682, 232, 765, 143, 620, 631, 861, 468, 622, 201, 325, 424, 189, 608, 403, 775, 646, 673, 1013, 400, 859, 838, 345, 210, 860, 65, 63, 34, 755, 161, 479, 235, 783, 460, 826, 507, 854, 839, 666, 802, 441, 114, 443, 738, 770, 929, 857, 907, 741, 935, 949, 322, 995, 217, 667, 269, 184, 650, 1018, 506, 290, 787, 459, 721, 828, 567, 222, 494, 142, 743, 405, 76, 722, 588, 147, 899, 270, 695, 597, 337, 155, 569, 679, 853, 450, 21, 517, 197, 371, 257, 380, 244, 553, 952, 381, 827, 524, 877, 702, 306, 600, 1011, 431, 781, 594, 387, 1019, 411, 533, 659, 177, 725, 930, 933, 832, 41, 2, 687, 1008, 439, 307, 891, 871, 415, 651, 308, 298, 811, 0, 194, 592, 241, 918, 18, 973, 110, 654, 967, 490, 683, 914, 128, 992, 964, 122, 230, 149, 289, 392, 416, 852, 936, 262, 102, 938, 511, 255, 510, 165, 105, 419, 958, 294, 379, 49, 699, 330, 593, 539, 710, 106, 79, 440, 200, 704, 961, 326, 321, 759, 193, 890, 44, 549, 913, 776, 909, 552, 972, 132, 429, 748, 532, 115, 888, 635, 842, 649, 747, 807, 887, 856, 784, 148, 530, 116, 157, 372, 754, 28, 581, 67, 187, 202, 818, 181, 45, 959, 146, 124, 994, 872, 675, 706, 253, 247, 625, 570, 152, 423, 185, 361, 849, 971, 546, 412, 830, 1022, 188, 850, 140, 220, 451, 219, 768, 1015, 455, 780, 976, 449, 969, 848, 293, 249, 59, 390, 512, 538, 578, 906, 819, 862, 974, 33, 911, 135, 908, 248, 401, 951, 527, 169, 676, 640, 1003, 591, 103, 37, 285, 684, 104, 163, 753, 1004, 934, 645, 470, 774, 20, 489, 228, 461, 492, 469, 998, 296, 233, 869, 605, 315, 36, 5, 425, 878, 617, 886, 23, 355, 993, 93, 473, 555, 474, 464, 937, 925, 1001, 611, 35, 812, 174, 53, 286, 680, 267, 428, 335, 883, 653, 69, 718, 585, 749, 150, 408, 393, 915, 576, 664, 629, 756, 402, 638, 602, 245, 43, 545, 213, 303, 192, 70, 453, 910, 407, 742, 111, 548, 835, 452, 575, 903, 619, 376, 154, 302, 151, 804, 867, 574, 563, 239, 648, 179, 855, 378, 618, 264, 669, 427, 354, 399, 265, 50, 796, 166, 923, 825, 697, 534, 54, 173, 870, 792, 162, 713, 246, 89, 51, 350, 705, 251, 557, 237, 240, 736, 689, 203, 519, 73, 81, 628, 288, 331, 204, 528, 480, 389, 32, 418, 573, 757, 358, 215, 226, 42, 779, 231, 171, 190, 612, 301, 762, 708, 420, 846, 208, 485, 351, 790, 737, 10, 258, 309, 797, 127, 516, 559, 499, 352, 71, 758, 25, 568, 113, 3, 610, 101, 375, 96, 603, 745, 64, 80, 477, 332, 833, 940, 373, 905, 422, 182, 356, 941, 47, 119, 662, 931, 696, 95, 724, 678, 207];

class StarblastNoise {
  private table: number[];
  private IO00O = 1023;
  private normalize = 1 / 1023;
  private IIO11: number;
  private I1100: number;
  private OO0lI = Math.cos(0.3);
  private Il1ll = Math.sin(0.3);

  constructor(seed: number) {
    this.table = NOISE_TABLE_BASE.slice();
    const len = this.table.length;
    for (let i = 0; i < len; i++) this.table.push(this.table[i]);
    let s = seed < 1 ? seed * (1 << 30) : seed;
    this.IIO11 = s & this.IO00O;
    this.I1100 = (s >> 10) & this.IO00O;
  }

  private I1lI0(x: number, y: number, a: number): number {
    const c = (-2 * a + 3) * a * a;
    return x * (1 - c) + y * c;
  }

  private I0l11(x: number, y: number): number {
    const lI11O0 = Math.floor(x);
    const OIIOO0 = Math.floor(y);
    const IO0OO = x - lI11O0;
    const IOOO1 = y - OIIOO0;
    const lI11O = lI11O0 & this.IO00O;
    const OIIOO = OIIOO0 & this.IO00O;
    const t = this.table;
    const IO0I0 = t[this.IIO11 + t[lI11O + t[OIIOO + this.I1100]]];
    const v2 = t[this.IIO11 + t[lI11O + 1 + t[OIIOO + this.I1100]]];
    const lIOlI = t[this.IIO11 + t[lI11O + t[OIIOO + 1 + this.I1100]]];
    const OO10I = t[this.IIO11 + t[lI11O + 1 + t[OIIOO + 1 + this.I1100]]];
    return (
      this.I1lI0(this.I1lI0(IO0I0, v2, IO0OO), this.I1lI0(lIOlI, OO10I, IO0OO), IOOO1) * this.normalize
    );
  }

  /** starblastStandard.html I0O10.prototype.l0l1O — 5-octave fractal noise. */
  l0l1O(x: number, y: number, octaves = 5, persistence = 0.5, lacunarity = 1.9, cosT = this.OO0lI, sinT = this.Il1ll): number {
    let total = 0;
    let d = 1;
    let norm = 0;
    for (let i = 1; i <= octaves; i++) {
      total += this.I0l11(x, y) * d;
      norm += d;
      d *= persistence;
      const nx = lacunarity * (x * cosT + y * sinT);
      const ny = lacunarity * (y * cosT - x * sinT);
      x = nx;
      y = ny;
    }
    return total / norm;
  }
}

// ── Vertex/fragment shaders ──────────────────────────────────────────────
// Ported from t.prototype.l0111 (starblastStandard.html:5321-5344).
// modelViewMatrix/projectionMatrix (THREE) -> PIXI's built-in
// uTranslationMatrix/uProjectionMatrix (auto-supplied to every PIXI.Mesh
// shader). gl_PointSize/gl_PointCoord (WebGL point-sprite primitives) have
// no PIXI equivalent since PIXI draws triangles, not GL_POINTS -- ported
// as a per-corner quad with a `corner` attribute (-1..1 per axis) standing
// in for gl_PointCoord, sized via a per-vertex `vSize`. The system_size
// world-wrap modulo is removed (see file header) since Cosmic Realm's map
// does not wrap. Every other formula (decay curve, opacity, size falloff,
// texture atlas offset) is unchanged.
const VERT_SRC = `
attribute vec2 aCorner;
attribute vec3 aPosition;
attribute vec3 aSpeed;
attribute float aTime;
attribute float aSize;
attribute float aOpac;

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
uniform float uNow;

varying float vToffset;
varying float vOpacity;
varying vec2 vCorner;

void main() {
  float t = max(0.0, uNow - aTime) * pow(aOpac, 0.5);
  vToffset = floor(t * 32.0 / 1.0);
  float t2 = 1.0 - exp(-t * 2.0);
  vec2 worldPos = aPosition.xy + aSpeed.xy * t2;

  float pointSize = aSize * max(0.0, 1.0 - t);
  vOpacity = clamp(pointSize, 0.0, 1.0) * aOpac;
  vCorner = aCorner;

  vec2 screenPos = worldPos + aCorner * pointSize * 0.5;
  vec3 transformed = translationMatrix * vec3(screenPos, 1.0);
  gl_Position = vec4((projectionMatrix * transformed).xy, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision mediump float;

varying float vToffset;
varying float vOpacity;
varying vec2 vCorner;
uniform sampler2D uTexture;

void main() {
  vec2 uv = (vCorner * 0.5 + 0.5 + vec2(vToffset, 0.0)) / vec2(32.0, 1.0);
  vec4 c = texture2D(uTexture, uv);
  c.w *= vOpacity;
  gl_FragColor = c;
}
`;

/** Ported from t.prototype.createTexture (starblastStandard.html:5354-5357).
 *  32x1024 canvas: 32 radial-gradient dots (white->transparent-orange),
 *  then a "source-in" linear gradient (orange -> dark red -> gray -> black)
 *  composited on top -- same per-pixel drawing calls, same color stops. */
function createExplosionTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(canvas.width / 32, canvas.height);
  ctx.translate(0.5, 0.5);
  for (let s = 0; s <= 31; s++) {
    const g = ctx.createRadialGradient(s, 0, 0, s, 0, 0.5);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,128,16,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s, 0, 0.5, 0, 2 * Math.PI, true);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-in";
  const grad = ctx.createLinearGradient(0, 0, 32, 0);
  grad.addColorStop(0, "#F82");
  grad.addColorStop(0.2, "#400");
  grad.addColorStop(0.5, "#333");
  grad.addColorStop(1, "#000");
  ctx.fillStyle = grad;
  ctx.fillRect(-0.5, -0.5, 32, 1);
  return canvas;
}

// 4 corners (one per quad vertex); buildIndices() below wires them into
// 2 triangles per particle via an index buffer, so only 4 -- not 6 -- are
// written per particle (fixes an earlier RangeError: offset out of bounds
// from writing 6-corner data into a 4-vertex-per-particle buffer).
const CORNERS = [-1, -1, 1, -1, 1, 1, -1, 1];

/**
 * StarblastExplosions — GPU-buffer explosion particle pool, ported from
 * `this.Explosions` (starblastStandard.html:5292-5358).
 *
 * Usage: one instance lives for the lifetime of the PIXI renderer (see
 * pixi-renderer-v2-integrated.ts), mesh added to worldLayer, tick() called
 * once per frame, explode()/blast() called per gameplay event.
 */
export class StarblastExplosions {
  readonly mesh: PIXI.Mesh<PIXI.Shader>;
  private readonly size: number;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly times: Float32Array;
  private readonly sizes: Float32Array;
  private readonly opacities: Float32Array;
  private readonly corners: Float32Array;
  private readonly geometry: PIXI.Geometry;
  private readonly shader: PIXI.Shader;
  private index = 0;
  private readonly startTime = Date.now();
  private readonly noise = new StarblastNoise(1000 * Math.random());

  constructor(size = 2000) {
    this.size = size;
    // 4 vertices per particle (quad), matching THREE's 1-vertex-per-point
    // buffer laid out per-particle for the CPU-side write pattern below.
    this.positions = new Float32Array(3 * size * 4);
    this.speeds = new Float32Array(3 * size * 4);
    this.times = new Float32Array(size * 4);
    this.sizes = new Float32Array(size * 4);
    this.opacities = new Float32Array(size * 4);
    this.corners = new Float32Array(size * 8);

    for (let i = 0; i < size; i++) {
      this.writeParticle(i, 0, 900, 0, 0, 0, 0, 0, 10, 1);
    }
    for (let i = 0; i < size; i++) {
      this.corners.set(CORNERS, i * 8);
    }

    this.geometry = new PIXI.Geometry()
      .addAttribute("aPosition", this.positions, 3)
      .addAttribute("aSpeed", this.speeds, 3)
      .addAttribute("aTime", this.times, 1)
      .addAttribute("aSize", this.sizes, 1)
      .addAttribute("aOpac", this.opacities, 1)
      .addAttribute("aCorner", this.corners, 2)
      .addIndex(this.buildIndices(size) as unknown as number[]);

    const canvas = createExplosionTexture();
    const texture = PIXI.Texture.from(canvas);
    texture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;

    this.shader = PIXI.Shader.from(VERT_SRC, FRAG_SRC, {
      uTexture: texture,
      uNow: 0,
    });

    const state = PIXI.State.for2d();
    state.blendMode = PIXI.BLEND_MODES.ADD;
    state.depthTest = false;

    this.mesh = new PIXI.Mesh(this.geometry, this.shader, state);
  }

  // Uint16Array unless the vertex count would overflow it: PixiJS v7 only
  // draws a Uint32 index buffer when canUseUInt32ElementIndex is true
  // (WebGL2, or the OES_element_index_uint extension) — on a context
  // without it, GeometrySystem.draw() silently `console.warn`s and never
  // calls gl.drawElements, so the whole mesh draws nothing with no
  // visible error. 4 vertices/particle keeps size=2000 at a 7999 max
  // index, well inside Uint16's 65535 range, so this avoids that
  // wholly-invisible-mesh failure mode instead of relying on the
  // extension being present.
  private buildIndices(size: number): Uint16Array | Uint32Array {
    const maxIndex = size * 4 - 1;
    const idx = maxIndex <= 65535 ? new Uint16Array(size * 6) : new Uint32Array(size * 6);
    for (let i = 0; i < size; i++) {
      const v = i * 4;
      idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
    }
    return idx;
  }

  private writeParticle(
    i: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    time: number,
    size: number,
    opac: number
  ): void {
    for (let c = 0; c < 4; c++) {
      const v = i * 4 + c;
      this.positions[3 * v] = x;
      this.positions[3 * v + 1] = y;
      this.positions[3 * v + 2] = z;
      this.speeds[3 * v] = sx;
      this.speeds[3 * v + 1] = sy;
      this.speeds[3 * v + 2] = sz;
      this.times[v] = time;
      this.sizes[v] = size;
      this.opacities[v] = opac;
    }
  }

  /**
   * Ported from t.prototype.explode (starblastStandard.html:5298-5303).
   * `angle` may be null (undirected burst, e.g. alien death); `power` is
   * clamped to 25 same as source; `z` defaults to 0. `screenHeight`/`zoom`
   * are the source's `this.O0Ol1.height` / `this.O0Ol1.OI1Il.OllIL.zoom`
   * (screen pixel height and camera zoom) — same size formula, values now
   * passed explicitly by the caller (Cosmic Realm's `app.screen.height`
   * and `state.cameraZoom`) instead of being read off a scene object.
   *
   * Dropped verbatim from source: the visibility-distance early-out
   * (`if (Math.abs(cam.x - t) > 32*(2+.1*s) ...) return`) and the
   * `explolight`-gated extra light-particle push, both of which depended
   * on a THREE.PointLight (this.I0I0l) with no PIXI equivalent wired up
   * in Cosmic Realm's renderer -- see file header point 4: the light is
   * out of scope for "laser/hit/death/shake" and was never requested.
   */
  explode(x: number, y: number, angle: number | null, power = 1, z = 0, screenHeight = 1000, zoom = 1): void {
    power = Math.min(25, power);
    const count = Math.min(this.size, Math.round(25 * Math.pow(power, 2)));
    const sizeScale = (0.6 * power * screenHeight) / 1000 / zoom;
    const speedScale = 5 * power;
    const seed = 1000 * Math.random();
    const now = (Date.now() - this.startTime) / 1000;

    for (let h = 0; h <= count; h++) {
      const px = x + 1 * (Math.random() - 0.5);
      const py = y + 1 * (Math.random() - 0.5);
      const a = 2 * Math.random() * Math.PI;
      let mx = Math.cos(a);
      let my = Math.sin(a);
      const speedMag =
        Math.pow(Math.random(), 0.5) * speedScale * Math.pow(this.noise.l0l1O(seed + 3 * mx, 3 * my, 3), 2) * 2;
      mx *= speedMag;
      my *= speedMag;
      const mz = 5 * speedMag * Math.random();
      if (angle !== null) {
        const n = 4 * (Math.random() - 0);
        mx += speedMag * n * Math.cos(angle);
        my += speedMag * n * Math.sin(angle);
      }
      const life = now + (1 + 5 * Math.random()) / 60;
      const size = (10 + 10 * Math.random()) * sizeScale;
      this.writeParticle(this.index, px, py, z, mx, my, mz, life, size, 1);
      this.index = (this.index + 1 + Math.floor(3 * Math.random())) % this.size;
    }
    this.dirty = true;
  }

  /**
   * Ported from t.prototype.blast (starblastStandard.html:5304-5310) --
   * used by projectile-explosion events (rockets/mines), distinct spread
   * pattern from explode() (10% flat-line spikes, 50% narrow cone, 40%
   * noise-driven cone). `screenHeight`/`zoom` — see explode() doc above.
   */
  blast(x: number, y: number, power = 1, z = 0, screenHeight = 1000, zoom = 1): void {
    power = Math.min(25, power);
    const count = Math.min(this.size, Math.round(25 * Math.pow(power, 2)));
    const sizeScale = (0.6 * power * screenHeight) / 1000 / zoom;
    const speedScale = 5 * power;
    const seed = 1000 * Math.random();
    const now = (Date.now() - this.startTime) / 1000;

    for (let o = 0; o <= count; o++) {
      const px = x + 1 * (Math.random() - 0.5);
      const py = y + 1 * (Math.random() - 0.5);
      const a = 2 * Math.random() * Math.PI;
      let cx = Math.cos(a);
      let cy = Math.sin(a);
      const roll = Math.random();
      let speedMag: number;
      let size: number;
      if (roll < 0.1) {
        cy = 0;
        cx = Math.random() < 0.5 ? 1 : -1;
        speedMag = Math.pow(Math.random(), 1) * speedScale * 4;
        size = (10 + 10 * Math.random()) * sizeScale;
      } else if (roll < 0.6) {
        speedMag = Math.pow(Math.random(), 0.01) * speedScale * 2;
        size = (10 + 10 * Math.random()) * sizeScale;
      } else {
        size = (10 + 10 * Math.random()) * sizeScale;
        speedMag =
          Math.pow(Math.random(), 0.5) * speedScale * Math.pow(this.noise.l0l1O(seed + 3 * cx, 3 * cy, 3), 2) * 2;
      }
      cx *= speedMag;
      cy *= speedMag;
      const cz = roll < 0.6 ? 0 : 5 * speedMag * Math.random();
      const life = now + (1 + 5 * Math.random()) / 60;
      this.writeParticle(this.index, px, py, z, cx, cy, cz, life, size, 1);
      this.index = (this.index + 1 + Math.floor(3 * Math.random())) % this.size;
    }
    this.dirty = true;
  }

  private dirty = false;

  /** Ported from t.prototype.OO1l1 (starblastStandard.html:5319-5320) --
   *  advances the shader's time uniform. The THREE.PointLight decay
   *  (`this.I0I0l.intensity *= .98`) is dropped, see explode() doc. */
  tick(): void {
    this.shader.uniforms.uNow = (Date.now() - this.startTime) / 1000;
    if (this.dirty) {
      this.geometry.getBuffer("aPosition").update(this.positions as unknown as number[]);
      this.geometry.getBuffer("aSpeed").update(this.speeds as unknown as number[]);
      this.geometry.getBuffer("aTime").update(this.times as unknown as number[]);
      this.geometry.getBuffer("aSize").update(this.sizes as unknown as number[]);
      this.geometry.getBuffer("aOpac").update(this.opacities as unknown as number[]);
      this.dirty = false;
    }
  }

  destroy(): void {
    this.mesh.destroy({ children: true });
    this.geometry.destroy();
    this.shader.destroy();
  }
}
