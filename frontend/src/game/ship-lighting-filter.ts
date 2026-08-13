import * as PIXI from "pixi.js";
import { QualityLevel } from "./ship-visual-config";

const LIGHT_ANGLE = -Math.PI * 0.75;

// ── Fragment shader — directional shading + edge rim + specular ────────
// Uses alpha-gradient edge detection for rim lighting on ship edges
const FRAG_FULL = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform highp vec4 inputSize;

uniform vec2 uLightDir;
uniform float uLightIntensity;
uniform float uShadowStrength;
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform float uRimWidth;
uniform float uSpecPower;
uniform float uSpecIntensity;
uniform float uDamage;
uniform float uBoost;
uniform float uTime;
uniform float uBrightness;

void main() {
    vec4 c = texture2D(uSampler, vTextureCoord);
    if (c.a < 0.01) { discard; }

    vec2 px = inputSize.zw;

    // Apply overall brightness
    c.rgb *= uBrightness;

    // Directional shading (position-based for interior)
    vec2 p = vTextureCoord - 0.5;
    float posDot = dot(p, uLightDir);
    float shade = 1.0 + posDot * uLightIntensity;
    shade = clamp(shade, 1.0 - uShadowStrength, 1.0 + uLightIntensity * 0.35);
    vec3 lit = c.rgb * shade;

    // Edge detection via alpha gradient
    float aL = texture2D(uSampler, vTextureCoord + vec2(-px.x, 0.0)).a;
    float aR = texture2D(uSampler, vTextureCoord + vec2( px.x, 0.0)).a;
    float aU = texture2D(uSampler, vTextureCoord + vec2(0.0, -px.y)).a;
    float aD = texture2D(uSampler, vTextureCoord + vec2(0.0,  px.y)).a;
    float gx = aR - aL;
    float gy = aD - aU;
    float edge = length(vec2(gx, gy));

    // Narrow rim lighting on edges facing the light
    if (edge > 0.02) {
        vec2 en = normalize(vec2(gx, gy));
        float rimDot = max(dot(en, uLightDir), 0.0);
        lit += uRimColor * edge * rimDot * uRimIntensity * 1.4;
    }

    // Wider rim detection for broader edge glow
    float aL2 = texture2D(uSampler, vTextureCoord + vec2(-px.x * uRimWidth, 0.0)).a;
    float aR2 = texture2D(uSampler, vTextureCoord + vec2( px.x * uRimWidth, 0.0)).a;
    float aU2 = texture2D(uSampler, vTextureCoord + vec2(0.0, -px.y * uRimWidth)).a;
    float aD2 = texture2D(uSampler, vTextureCoord + vec2(0.0,  px.y * uRimWidth)).a;
    float nearEdge = 1.0 - min(min(aL2, aR2), min(aU2, aD2));
    if (nearEdge > 0.05) {
        float dx2 = aR2 - aL2;
        float dy2 = aD2 - aU2;
        float len2 = length(vec2(dx2, dy2));
        if (len2 > 0.01) {
            vec2 en2 = normalize(vec2(dx2, dy2));
            float wRim = max(dot(en2, uLightDir), 0.0);
            lit += uRimColor * nearEdge * wRim * uRimIntensity * 0.3;
        }
    }

    // Specular highlight on edges
    if (edge > 0.02) {
        vec3 n = normalize(vec3(gx * 2.0, gy * 2.0, 0.35));
        vec3 l = normalize(vec3(uLightDir, 0.5));
        vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
        float spec = pow(max(dot(n, h), 0.0), uSpecPower);
        lit += vec3(1.0, 0.97, 0.93) * spec * uSpecIntensity * 0.7;
    }

    // Metallic interior sheen
    float bright = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    float metalSpec = pow(max(posDot + 0.5, 0.0), 4.0) * bright * 0.08 * uSpecIntensity;
    lit += vec3(0.9, 0.95, 1.0) * metalSpec;

    // Damage flash
    lit = mix(lit, vec3(1.0, 0.5, 0.3), uDamage * 0.6);

    // Boost glow
    lit += vec3(0.08, 0.16, 0.35) * uBoost * 0.25;

    // Subtle rim pulse
    lit += uRimColor * nearEdge * sin(uTime * 2.0) * 0.005;

    lit = clamp(lit, 0.0, 1.0);
    gl_FragColor = vec4(lit, c.a);
}
`;

// ── MEDIUM quality — no specular, wider samples only ────────────────────
const FRAG_MED = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform highp vec4 inputSize;

uniform vec2 uLightDir;
uniform float uLightIntensity;
uniform float uShadowStrength;
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform float uRimWidth;
uniform float uDamage;
uniform float uBoost;
uniform float uBrightness;

void main() {
    vec4 c = texture2D(uSampler, vTextureCoord);
    if (c.a < 0.01) { discard; }

    vec2 px = inputSize.zw;

    c.rgb *= uBrightness;

    // Directional shading
    vec2 p = vTextureCoord - 0.5;
    float shade = 1.0 + dot(p, uLightDir) * uLightIntensity;
    shade = clamp(shade, 1.0 - uShadowStrength, 1.0 + uLightIntensity * 0.3);
    vec3 lit = c.rgb * shade;

    // Edge rim
    float aL = texture2D(uSampler, vTextureCoord + vec2(-px.x * uRimWidth, 0.0)).a;
    float aR = texture2D(uSampler, vTextureCoord + vec2( px.x * uRimWidth, 0.0)).a;
    float aU = texture2D(uSampler, vTextureCoord + vec2(0.0, -px.y * uRimWidth)).a;
    float aD = texture2D(uSampler, vTextureCoord + vec2(0.0,  px.y * uRimWidth)).a;
    float nearEdge = 1.0 - min(min(aL, aR), min(aU, aD));
    if (nearEdge > 0.05) {
        float dx = aR - aL;
        float dy = aD - aU;
        float len = length(vec2(dx, dy));
        if (len > 0.01) {
            float rimDot = max(dot(normalize(vec2(dx, dy)), uLightDir), 0.0);
            lit += uRimColor * nearEdge * rimDot * uRimIntensity * 0.3;
        }
    }

    lit = mix(lit, vec3(1.0, 0.5, 0.3), uDamage * 0.6);
    lit += vec3(0.08, 0.16, 0.35) * uBoost * 0.2;
    lit = clamp(lit, 0.0, 1.0);
    gl_FragColor = vec4(lit, c.a);
}
`;

// ── LOW quality — just directional shading, no edge sampling ────────────
const FRAG_LOW = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec2 uLightDir;
uniform float uLightIntensity;
uniform float uShadowStrength;
uniform float uDamage;
uniform float uBrightness;

void main() {
    vec4 c = texture2D(uSampler, vTextureCoord);
    if (c.a < 0.01) { discard; }
    c.rgb *= uBrightness;
    vec2 p = vTextureCoord - 0.5;
    float shade = 1.0 + dot(p, uLightDir) * uLightIntensity;
    shade = clamp(shade, 1.0 - uShadowStrength, 1.0 + uLightIntensity * 0.3);
    vec3 lit = c.rgb * shade;
    lit = mix(lit, vec3(1.0, 0.5, 0.3), uDamage * 0.5);
    gl_FragColor = vec4(lit, c.a);
}
`;

// ── ShipLightingFilter ─────────────────────────────────────────────────
// v8 rewrite: Filter no longer takes (vertex, fragment, uniforms) — it wants
// a GlProgram (compiled GLSL) + a `resources` map of UniformGroups, and there
// is no default vertex shader auto-supplied, so the standard filter-quad
// vertex shader is inlined below. The fragment shaders above are still
// GLSL ES 1.0 (texture2D/varying/gl_FragColor) since they were written for
// v7; migrateFragmentFromV7toV8 is pixi's own helper for exactly this
// translation (GlProgram compiles everything as `#version 300 es`, so an
// un-migrated ES1 fragment would fail to compile against it).
import { migrateFragmentFromV7toV8 } from "pixi.js";

const FILTER_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

export class ShipLightingFilter extends PIXI.Filter {
  private _quality: QualityLevel;
  private _lightingUniforms: PIXI.UniformGroup<any>;

  constructor(quality: QualityLevel = "HIGH") {
    const rawFrag = quality === "HIGH" ? FRAG_FULL : quality === "MEDIUM" ? FRAG_MED : FRAG_LOW;
    const glProgram = new PIXI.GlProgram({
      vertex: FILTER_VERTEX,
      fragment: migrateFragmentFromV7toV8(rawFrag),
      name: "ship-lighting-filter",
    });

    const lightingUniforms = new PIXI.UniformGroup({
      uLightDir: { value: [0.0, -1.0], type: "vec2<f32>" },
      uLightIntensity: { value: 0.8, type: "f32" },
      uShadowStrength: { value: 0.5, type: "f32" },
      uRimColor: { value: [0.55, 0.75, 1.0], type: "vec3<f32>" },
      uRimIntensity: { value: 0.7, type: "f32" },
      uRimWidth: { value: 3.0, type: "f32" },
      uSpecPower: { value: 16.0, type: "f32" },
      uSpecIntensity: { value: 0.5, type: "f32" },
      uDamage: { value: 0.0, type: "f32" },
      uBoost: { value: 0.0, type: "f32" },
      uTime: { value: 0.0, type: "f32" },
      uBrightness: { value: 1.0, type: "f32" },
    });

    super({
      glProgram,
      resources: { lightingUniforms },
      padding: 0,
    });
    this._lightingUniforms = lightingUniforms;
    this._quality = quality;
  }

  update(shipRotation: number, tick: number, speed: number, damage: number): void {
    const localAngle = LIGHT_ANGLE - shipRotation;
    this._lightingUniforms.uniforms.uLightDir = [Math.cos(localAngle), Math.sin(localAngle)];
    if (this._quality !== "LOW") {
      this._lightingUniforms.uniforms.uTime = tick;
      this._lightingUniforms.uniforms.uBoost = Math.min(1, speed / 200);
    }
    this._lightingUniforms.uniforms.uDamage = damage;
  }

  setDamage(d: number): void { this._lightingUniforms.uniforms.uDamage = Math.max(0, Math.min(1, d)); }
  setBoost(b: number): void { if (this._quality !== "LOW") this._lightingUniforms.uniforms.uBoost = b; }

  configure(opts: {
    lightIntensity?: number;
    shadowStrength?: number;
    rimColor?: [number, number, number];
    rimIntensity?: number;
    rimWidth?: number;
    specPower?: number;
    specIntensity?: number;
    brightness?: number;
  }): void {
    const u = this._lightingUniforms.uniforms;
    if (opts.lightIntensity !== undefined) u.uLightIntensity = opts.lightIntensity;
    if (opts.shadowStrength !== undefined) u.uShadowStrength = opts.shadowStrength;
    if (opts.rimColor !== undefined) u.uRimColor = opts.rimColor;
    if (opts.rimIntensity !== undefined) u.uRimIntensity = opts.rimIntensity;
    if (opts.rimWidth !== undefined) u.uRimWidth = opts.rimWidth;
    if (opts.specPower !== undefined) u.uSpecPower = opts.specPower;
    if (opts.specIntensity !== undefined) u.uSpecIntensity = opts.specIntensity;
    if (opts.brightness !== undefined) u.uBrightness = opts.brightness;
  }

  get quality(): QualityLevel { return this._quality; }
}

// ── ShipLightingSystem — filter pool + caching ─────────────────────────
const filterCache = new Map<string, ShipLightingFilter>();

export const ShipLightingSystem = {
  getFilter(quality: QualityLevel, shipClass?: string): ShipLightingFilter {
    const key = `${quality}-${shipClass || "default"}`;
    let f = filterCache.get(key);
    if (!f) {
      f = new ShipLightingFilter(quality);
      filterCache.set(key, f);
    }
    return f;
  },

  getEnemyFilter(quality: QualityLevel): ShipLightingFilter {
    const key = `enemy-${quality}`;
    let f = filterCache.get(key);
    if (!f) {
      f = new ShipLightingFilter(quality === "HIGH" ? "MEDIUM" : "LOW");
      f.configure({ rimIntensity: 0.6, lightIntensity: 0.4 });
      filterCache.set(key, f);
    }
    return f;
  },

  clearCache(): void {
    for (const f of filterCache.values()) f.destroy();
    filterCache.clear();
  },
};
