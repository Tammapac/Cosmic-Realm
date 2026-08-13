// PanelMaterialFilter — gives a flat filled shape a subtle sci-fi metal read:
// fine grain, faint diagonal brushed streaks, a top-down light gradient and an
// edge vignette. Restrained on purpose (the brief: "fill that is not too
// strong but looks like sci-fi material"). Single WebGL fragment program (v7).
//
// Applied to the panel BODY graphic only, masked by that graphic's alpha, so it
// never bleeds past the chamfered silhouette.
// v8 rewrite: Filter takes a GlProgram + a `resources` UniformGroup map, not
// (vertex, fragment, uniforms). filterArea (v7) has no v8 equivalent — the
// nearest replacement is uInputSize.xy (the filter's own render-target size
// in pixels), which is what this shader actually wanted (pixel-space coords
// for the streak/grain patterns). migrateFragmentFromV7toV8 handles the
// texture2D/varying/gl_FragColor → texture/in/finalColor GLSL1→ES3 rewrite;
// see ship-lighting-filter.ts for the fuller explanation of why that's
// needed (GlProgram always compiles as `#version 300 es`).
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
uniform highp vec4 inputSize;
uniform float uTime;
uniform vec3 uTint;      // base metal tint (navy)

// cheap hash noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main(void){
    vec4 base = texture2D(uSampler, vTextureCoord);
    if (base.a < 0.01){ gl_FragColor = base; return; }

    vec2 px = vTextureCoord / inputSize.zw;

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
  private _u: PIXI.UniformGroup<any>;

  constructor(tint = 0x16233a) {
    const r = ((tint >> 16) & 0xff) / 255;
    const g = ((tint >> 8) & 0xff) / 255;
    const b = (tint & 0xff) / 255;

    const glProgram = new PIXI.GlProgram({
      vertex: FILTER_VERTEX,
      fragment: migrateFragmentFromV7toV8(rawFrag),
      name: "panel-material-filter",
    });
    const materialUniforms = new PIXI.UniformGroup({
      uTime: { value: 0, type: "f32" },
      uTint: { value: [r, g, b], type: "vec3<f32>" },
    });
    super({ glProgram, resources: { materialUniforms } });
    this._u = materialUniforms;
  }
  advance(dt: number): void { this._u.uniforms.uTime = (this._u.uniforms.uTime as number) + dt; }
}
