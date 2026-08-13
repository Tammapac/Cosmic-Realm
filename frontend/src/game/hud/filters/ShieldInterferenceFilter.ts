// ShieldInterferenceFilter — a PixiJS v7 WebGL Filter that overlays a moving
// interference/refraction pattern on the shield bar's fill, so the shield reads
// as a live energy field rather than a painted bar. Single GLSL fragment
// program (v7 is WebGL-only; no WebGPU path needed).
//
// It samples the sprite it is applied to and adds diagonal energy bands + a
// subtle horizontal ripple that scroll over time, masked to the sprite's own
// alpha so it never bleeds past the fill.
// v8 rewrite: Filter takes a GlProgram + a `resources` UniformGroup map, not
// (vertex, fragment, uniforms) — see ship-lighting-filter.ts for the fuller
// explanation (same migrateFragmentFromV7toV8 + standard filter-quad vertex
// shader pattern; this filter's fragment shader itself is unchanged).
import * as PIXI from "pixi.js";
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

const rawFrag = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uIntensity;   // 0..1 overall strength
uniform vec3  uEnergy;      // band colour (cyan by default)

void main(void) {
    vec4 base = texture2D(uSampler, vTextureCoord);
    if (base.a < 0.01) { gl_FragColor = base; return; }

    // diagonal scrolling bands
    float band = sin((vTextureCoord.x * 22.0 + vTextureCoord.y * 6.0) - uTime * 3.0);
    band = smoothstep(0.6, 1.0, band);

    // slow horizontal interference ripple
    float ripple = sin(vTextureCoord.x * 40.0 - uTime * 2.0) * 0.5 + 0.5;
    ripple *= sin(vTextureCoord.y * 8.0 + uTime * 1.3) * 0.5 + 0.5;

    float e = (band * 0.7 + ripple * 0.3) * uIntensity;
    vec3 col = base.rgb + uEnergy * e * base.a;

    gl_FragColor = vec4(col, base.a);
}
`;

export class ShieldInterferenceFilter extends PIXI.Filter {
  private _u: PIXI.UniformGroup<any>;

  constructor(energy = 0x4ee2ff, intensity = 0.6) {
    const r = ((energy >> 16) & 0xff) / 255;
    const g = ((energy >> 8) & 0xff) / 255;
    const b = (energy & 0xff) / 255;

    const glProgram = new PIXI.GlProgram({
      vertex: FILTER_VERTEX,
      fragment: migrateFragmentFromV7toV8(rawFrag),
      name: "shield-interference-filter",
    });
    const shieldUniforms = new PIXI.UniformGroup({
      uTime: { value: 0, type: "f32" },
      uIntensity: { value: intensity, type: "f32" },
      uEnergy: { value: [r, g, b], type: "vec3<f32>" },
    });
    super({ glProgram, resources: { shieldUniforms } });
    this._u = shieldUniforms;
  }

  /** Advance the animation. Call each frame with dt in seconds. */
  advance(dt: number): void {
    this._u.uniforms.uTime = (this._u.uniforms.uTime as number) + dt;
  }

  set intensity(v: number) {
    this._u.uniforms.uIntensity = v;
  }
}
