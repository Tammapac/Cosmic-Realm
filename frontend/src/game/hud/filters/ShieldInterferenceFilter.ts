// ShieldInterferenceFilter — a PixiJS v7 WebGL Filter that overlays a moving
// interference/refraction pattern on the shield bar's fill, so the shield reads
// as a live energy field rather than a painted bar. Single GLSL fragment
// program (v7 is WebGL-only; no WebGPU path needed).
//
// It samples the sprite it is applied to and adds diagonal energy bands + a
// subtle horizontal ripple that scroll over time, masked to the sprite's own
// alpha so it never bleeds past the fill.
import * as PIXI from "pixi.js";

const frag = `
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
  constructor(energy = 0x4ee2ff, intensity = 0.6) {
    const r = ((energy >> 16) & 0xff) / 255;
    const g = ((energy >> 8) & 0xff) / 255;
    const b = (energy & 0xff) / 255;
    super(undefined, frag, {
      uTime: 0,
      uIntensity: intensity,
      uEnergy: [r, g, b],
    });
  }

  /** Advance the animation. Call each frame with dt in seconds. */
  advance(dt: number): void {
    this.uniforms.uTime += dt;
  }

  set intensity(v: number) {
    this.uniforms.uIntensity = v;
  }
}
