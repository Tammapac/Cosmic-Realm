// Filter und Shader. Pixi v8 liefert Blur, Color-Matrix und Alpha mit; die
// vier eigenen Effekte hier sind Fragment-Shader, weil sie sonst pro Frame
// neu gebacken werden müssten.

import {
  BlurFilter, ColorMatrixFilter, AlphaFilter, Filter, GlProgram,
} from "pixi.js";

/* ── Mitgelieferte Filter, auf Kit-Werte eingestellt ──────────────────────── */

/** Weichzeichnung für Glow-Ebenen. */
export const makeBlur = (strength = 4, quality = 3): BlurFilter =>
  new BlurFilter({ strength, quality });

/** Bloom: Helligkeit anheben, dann weichzeichnen. Zwei Filter in Reihe. */
export function makeBloom(strength = 6, boost = 1.35): Filter[] {
  const cm = new ColorMatrixFilter();
  cm.brightness(boost, false);
  return [cm, new BlurFilter({ strength, quality: 4 })];
}

/** Entsättigen für gesperrte Elemente. */
export function makeDisabled(): ColorMatrixFilter {
  const cm = new ColorMatrixFilter();
  cm.desaturate();
  cm.brightness(0.72, true);
  return cm;
}

/** Deckkraft einer ganzen Gruppe. */
export const makeAlpha = (alpha: number): AlphaFilter => new AlphaFilter({ alpha });

/* ── Eigene Shader ────────────────────────────────────────────────────────── */

const VERT = `#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}`;

/**
 * Regenbogen-Zyklus für Celestial: verschiebt den Farbton über die Zeit und
 * legt einen laufenden Prismenstreifen darüber. Ersetzt die CSS-Animation
 * cCelSheen, aber pro Pixel statt als Sprite.
 */
export class RainbowCycleFilter extends Filter {
  constructor(speed = 0.22, strength = 0.55) {
    super({
      glProgram: GlProgram.from({
        vertex: VERT,
        fragment: `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uSpeed;
uniform float uStrength;

vec3 hue(float h) {
  vec3 k = vec3(1.0, 2.0 / 3.0, 1.0 / 3.0);
  vec3 p = abs(fract(vec3(h) + k) * 6.0 - 3.0);
  return clamp(p - 1.0, 0.0, 1.0);
}

void main(void) {
  vec4 src = texture(uTexture, vTextureCoord);
  if (src.a < 0.01) { finalColor = src; return; }
  float band = vTextureCoord.x * 0.7 + vTextureCoord.y * 0.3;
  vec3 rainbow = hue(fract(band * 1.4 + uTime * uSpeed));
  // Prismenstreifen, der schräg durchläuft
  float sweep = fract(band - uTime * uSpeed * 2.2);
  float shine = smoothstep(0.46, 0.5, sweep) * (1.0 - smoothstep(0.5, 0.56, sweep));
  vec3 lit = mix(src.rgb, rainbow, uStrength * 0.55) + rainbow * shine * 0.8;
  finalColor = vec4(lit * src.a, src.a);
}`,
      }),
      resources: {
        rainbowUniforms: {
          uTime: { value: 0, type: "f32" },
          uSpeed: { value: speed, type: "f32" },
          uStrength: { value: strength, type: "f32" },
        },
      },
    });
  }

  /** Pro Frame mit der Laufzeit in Sekunden füttern. */
  set time(v: number) { this.resources.rainbowUniforms.uniforms.uTime = v; }
  get time(): number { return this.resources.rainbowUniforms.uniforms.uTime as number; }
}

/**
 * Glanzstreifen, der schräg über eine Fläche wandert — Knöpfe, Podiumkarten,
 * Wappen. Der Streifen läuft im Shader, kostet also kein zusätzliches Sprite
 * und keine Maske.
 */
export class ShineSweepFilter extends Filter {
  constructor(width = 0.16, speed = 0.28, tint: [number, number, number] = [1, 1, 1]) {
    super({
      glProgram: GlProgram.from({
        vertex: VERT,
        fragment: `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uWidth;
uniform float uSpeed;
uniform vec3 uTint;

void main(void) {
  vec4 src = texture(uTexture, vTextureCoord);
  if (src.a < 0.01) { finalColor = src; return; }
  float diag = vTextureCoord.x * 0.82 + vTextureCoord.y * 0.18;
  float p = fract(diag - uTime * uSpeed);
  float band = smoothstep(0.5 - uWidth, 0.5, p) * (1.0 - smoothstep(0.5, 0.5 + uWidth, p));
  finalColor = vec4(src.rgb + uTint * band * 0.5 * src.a, src.a);
}`,
      }),
      resources: {
        shineUniforms: {
          uTime: { value: 0, type: "f32" },
          uWidth: { value: width, type: "f32" },
          uSpeed: { value: speed, type: "f32" },
          uTint: { value: new Float32Array(tint), type: "vec3<f32>" },
        },
      },
    });
  }

  set time(v: number) { this.resources.shineUniforms.uniforms.uTime = v; }
}

/**
 * Hologramm-Störung: waagerechte Zeilen, leichtes Zittern und ein wandernder
 * Ausriss. Für Vorschauflächen und Kartenscopes.
 */
export class HologramFilter extends Filter {
  constructor(lineCount = 220, jitter = 0.0016, scanSpeed = 0.35) {
    super({
      glProgram: GlProgram.from({
        vertex: VERT,
        fragment: `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uLines;
uniform float uJitter;
uniform float uScanSpeed;

float rand(float n) { return fract(sin(n * 43758.5453) * 12345.6789); }

void main(void) {
  vec2 uv = vTextureCoord;
  // waagerechtes Zittern, zeilenweise
  float row = floor(uv.y * uLines);
  uv.x += (rand(row + floor(uTime * 12.0)) - 0.5) * uJitter;
  vec4 src = texture(uTexture, uv);
  // Zeilenraster
  float lines = 0.86 + 0.14 * step(0.5, fract(uv.y * uLines));
  // wandernder Ausriss
  float scan = fract(uv.y - uTime * uScanSpeed);
  float tear = smoothstep(0.98, 1.0, scan) * 0.35;
  finalColor = vec4(src.rgb * lines + vec3(0.35, 0.85, 1.0) * tear * src.a, src.a);
}`,
      }),
      resources: {
        holoUniforms: {
          uTime: { value: 0, type: "f32" },
          uLines: { value: lineCount, type: "f32" },
          uJitter: { value: jitter, type: "f32" },
          uScanSpeed: { value: scanSpeed, type: "f32" },
        },
      },
    });
  }

  set time(v: number) { this.resources.holoUniforms.uniforms.uTime = v; }
}

/**
 * Energieverzerrung: sanftes Wellen entlang der Y-Achse. Für Plasmaröhren und
 * den Kern von Lichtstrahlen.
 */
export class EnergyDistortFilter extends Filter {
  constructor(amount = 0.004, frequency = 26, speed = 1.6) {
    super({
      glProgram: GlProgram.from({
        vertex: VERT,
        fragment: `#version 300 es
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uAmount;
uniform float uFreq;
uniform float uSpeed;

void main(void) {
  vec2 uv = vTextureCoord;
  uv.y += sin(uv.x * uFreq + uTime * uSpeed) * uAmount;
  finalColor = texture(uTexture, uv);
}`,
      }),
      resources: {
        distortUniforms: {
          uTime: { value: 0, type: "f32" },
          uAmount: { value: amount, type: "f32" },
          uFreq: { value: frequency, type: "f32" },
          uSpeed: { value: speed, type: "f32" },
        },
      },
    });
  }

  set time(v: number) { this.resources.distortUniforms.uniforms.uTime = v; }
}

/** Alle zeitabhängigen Filter einer Szene in einem Aufruf weiterstellen. */
export class FilterClock {
  private list: { time: number }[] = [];
  private t = 0;

  add<T extends { time: number }>(f: T): T { this.list.push(f); return f; }

  update(dt: number): void {
    this.t += dt;
    for (const f of this.list) f.time = this.t;
  }

  clear(): void { this.list.length = 0; }
}
