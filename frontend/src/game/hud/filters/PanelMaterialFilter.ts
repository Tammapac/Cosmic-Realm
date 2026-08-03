// PanelMaterialFilter — gives a flat filled shape a subtle sci-fi metal read:
// fine grain, faint diagonal brushed streaks, a top-down light gradient and an
// edge vignette. Restrained on purpose (the brief: "fill that is not too
// strong but looks like sci-fi material"). Single WebGL fragment program (v7).
//
// Applied to the panel BODY graphic only, masked by that graphic's alpha, so it
// never bleeds past the chamfered silhouette.
import * as PIXI from "pixi.js";

const frag = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 filterArea;
uniform float uTime;
uniform vec3 uTint;      // base metal tint (navy)

// cheap hash noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main(void){
    vec4 base = texture2D(uSampler, vTextureCoord);
    if (base.a < 0.01){ gl_FragColor = base; return; }

    vec2 px = vTextureCoord * filterArea.xy;

    // 1. top-down light gradient — brighter, more contrast top→bottom
    float grad = 1.0 - vTextureCoord.y;
    float light = 1.05 + grad * 0.55;

    // 2. diagonal brushed-metal streaks (a touch stronger)
    float streak = sin((px.x + px.y) * 0.18) * 0.5 + 0.5;
    streak = 0.95 + streak * 0.09;

    // 3. fine surface grain
    float g = hash(floor(px * 1.5));
    float grain = 0.96 + g * 0.07;

    // 4. edge vignette (darker toward the borders)
    vec2 d = abs(vTextureCoord - 0.5) * 2.0;
    float vig = 1.0 - pow(max(d.x, d.y), 3.0) * 0.30;

    vec3 col = uTint * light * streak * grain * vig;
    // keep the incoming alpha (the chamfer mask)
    gl_FragColor = vec4(col, base.a);
}
`;

export class PanelMaterialFilter extends PIXI.Filter {
  constructor(tint = 0x16233a) {
    const r = ((tint >> 16) & 0xff) / 255;
    const g = ((tint >> 8) & 0xff) / 255;
    const b = (tint & 0xff) / 255;
    super(undefined, frag, { uTime: 0, uTint: [r, g, b] });
  }
  advance(dt: number): void { this.uniforms.uTime += dt; }
}
