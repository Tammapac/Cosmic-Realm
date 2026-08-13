/**
 * ParallaxBackground — data-driven 5-layer DarkOrbit-style parallax maps.
 *
 * Scene data comes from /bg/do/scenes.json, generated offline from the
 * original DarkOrbit map manifests (DarkOrbit_Parallax_Layers pack): per
 * zone the authentic base background, its starfield tile set, and the
 * manifest's planet/lens-flare placements (x/y on the original 2100x1310
 * reference canvas, pFactor, layer). Zones whose manifests carried no
 * decoration got fixed curated compositions baked into scenes.json — the
 * composition is deterministic data either way, never random at runtime.
 *
 * Layers (bottom to top) and parallax factors:
 *   1 farSpace    0.02  base background (cover-fit, NEVER tiled — the
 *                       margin always covers the parallax excursion, so
 *                       no seams and no repetition by construction)
 *   2 midSpace    0.06  starfield tiling (ADD blend — the 50x50 source
 *                       tiles are black-backed, additive blending makes
 *                       black transparent: no black boxes) + planets
 *                       (per-planet factor from the manifest pFactor,
 *                       0.03..0.11)
 *   3 atmosphere  0.12  lens flares (ADD, slow pulse), two tinted
 *                       procedural gas-cloud bands, drifting light motes
 *   4 worldDecor  1.00  world-anchored container inside worldLayer
 *                       (reserved — the pack ships no station/wreck
 *                       sprites; kept so the layer order is defined)
 *   5 foreground  1.12  sparse dark planet silhouettes (danger zones),
 *                       own stage container above worldLayer, camera
 *                       zoom applied, never permanently covering play
 *
 * farSpace/midSpace/atmosphere are screen-space children of the game's
 * bgLayer; worldDecor lives in worldLayer; foreground is a stage sibling
 * above worldLayer. One PIXI Application, no DOM, no CSS. All textures
 * LINEAR-filtered (painted art). Off-viewport planets/flares/silhouettes
 * are culled via `visible`. Sprites are built once per zone and reused —
 * no per-frame allocation, zone switches destroy the old zone's textures.
 */
import * as PIXI from "pixi.js";
import { MAP_RADIUS } from "./types";

export const PARALLAX = {
  far: 0.02,
  // Planets sit BEHIND the starfield, so they must also move SLOWER than
  // it — otherwise the depth reads inverted (a "distant" planet sliding
  // faster than the stars in front of it).
  planetMin: 0.02,
  planetMax: 0.045,
  starfield: 0.06,
  structures: 0.05, // large dark structures/silhouettes, also behind stars
  atmosphere: 0.12,
  world: 1.0,
  foreground: 1.12, // reserved (currently unpopulated)
} as const;

const FAR_SWAY = 22;      // px of slow autonomous sway on the base bg
const CANVAS_W = 2100;    // DO reference canvas
const CANVAS_H = 1310;

interface SceneDef {
  bg: string;
  fill: string; hueA: string; hueB: string;
  starfield: string[];
  planets: { file: string; x: number; y: number; pf: number; layer: number; w: number; h: number }[];
  flares: { x: number; y: number; files: string[] }[];
}

interface AnchoredSprite {
  spr: PIXI.Sprite;
  cx: number; cy: number;   // canvas coords (2100x1310)
  par: number;
  pulse: number;            // 0 = none, else pulse phase
  baseA: number;            // base alpha (pulse modulates around it)
}

let scenesCache: Record<string, SceneDef> | null = null;
let scenesPromise: Promise<Record<string, SceneDef>> | null = null;
function loadScenes(): Promise<Record<string, SceneDef>> {
  if (scenesCache) return Promise.resolve(scenesCache);
  if (!scenesPromise) {
    scenesPromise = fetch("/bg/do/scenes.json?v=3")
      .then((r) => r.json())
      .then((j) => (scenesCache = j));
  }
  return scenesPromise;
}

function seededRng(label: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < label.length; i++) { h ^= label.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

// Seamless soft gas-cloud tile (shared, generated once).
let nebulaTexCache: PIXI.Texture | null = null;
function nebulaTex(): PIXI.Texture {
  if (nebulaTexCache) return nebulaTexCache;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const rnd = seededRng("do-nebula");
  for (let i = 0; i < 30; i++) {
    const bx = rnd() * S, by = rnd() * S;
    const r = S * (0.10 + rnd() * 0.22);
    const a = 0.05 + rnd() * 0.09;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const g = ctx.createRadialGradient(bx + ox * S, by + oy * S, 0, bx + ox * S, by + oy * S, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.6, `rgba(255,255,255,${a * 0.45})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
  }
  nebulaTexCache = PIXI.Texture.from(c);
  (nebulaTexCache.source as PIXI.TextureSource).scaleMode = "linear";
  (nebulaTexCache.source as PIXI.TextureSource).wrapMode = "repeat";
  return nebulaTexCache;
}

// Small soft glow for motes (shared).
let moteTexCache: PIXI.Texture | null = null;
function moteTex(): PIXI.Texture {
  if (moteTexCache) return moteTexCache;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  moteTexCache = PIXI.Texture.from(c);
  (moteTexCache.source as PIXI.TextureSource).scaleMode = "linear";
  return moteTexCache;
}

/** Composite one 400x400 starfield texture from a zone's 50x50 tile set:
 *  8x8 grid, deterministic shuffle — tileable edges stay tileable, but the
 *  repeat period grows from 50px to 400px, so no visible short-cycle
 *  pattern. Black stays black; the TilingSprite renders with ADD blend. */
function buildStarfieldTexture(label: string, tiles: PIXI.Texture[]): PIXI.Texture {
  const CELL = 50, N = 8;
  const rt = document.createElement("canvas");
  rt.width = rt.height = CELL * N;
  const ctx = rt.getContext("2d")!;
  const rnd = seededRng("sf-" + label);
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const t = tiles[Math.floor(rnd() * tiles.length)];
      const src = (t.source as any)?.resource as CanvasImageSource | undefined;
      if (src) ctx.drawImage(src, t.frame.x, t.frame.y, CELL, CELL, gx * CELL, gy * CELL, CELL, CELL);
    }
  }
  const tex = PIXI.Texture.from(rt);
  (tex.source as PIXI.TextureSource).scaleMode = "linear";
  (tex.source as PIXI.TextureSource).wrapMode = "repeat";
  return tex;
}

// v8's Texture.fromURL was removed (Texture.from(url) now only checks the
// cache, per atlas.ts's makeNineSlice comment) — PIXI.Assets.load is the v8
// replacement, with scaleMode applied to the loaded texture's source after
// the fact instead of as a load option.
function loadLinearTexture(url: string): Promise<PIXI.Texture> {
  return PIXI.Assets.load(url).then((tex: PIXI.Texture) => {
    (tex.source as PIXI.TextureSource).scaleMode = "linear";
    return tex;
  });
}

export interface ParallaxStats {
  sprites: number;
  culled: number;
  textures: number;
  zone: string;
}

export type ParallaxLayerId = "far" | "mid" | "atmo" | "world" | "fg";

export class ParallaxBackground {
  /** Screen-space host for layers 1-3 — child of the game's bgLayer. */
  readonly host = new PIXI.Container();
  /** Layer 4 — world coordinates, insert at index 0 of worldLayer. */
  readonly worldDecor = new PIXI.Container();
  /** Layer 5 — stage sibling above worldLayer (zoom applied here). */
  readonly foreground = new PIXI.Container();

  private far = new PIXI.Container();
  private planetLayer = new PIXI.Container(); // planets: above the base bg, BELOW the stars
  private mid = new PIXI.Container();
  private atmo = new PIXI.Container();

  private zone = "";
  private buildToken = 0;

  private fillSpr: PIXI.Sprite | null = null;
  private bgSpr: PIXI.Sprite | null = null;
  private sfTile: PIXI.TilingSprite | null = null;
  private nebA: PIXI.TilingSprite | null = null;
  private nebB: PIXI.TilingSprite | null = null;
  private planets: AnchoredSprite[] = [];
  private flares: AnchoredSprite[] = [];
  private motes: { spr: PIXI.Sprite; u: number; v: number; s: number; ph: number }[] = [];
  private zoneTextures: PIXI.Texture[] = []; // destroyed on zone switch

  private driftX = 0;
  private driftY = 0;
  private lastCull = 0;

  /** Debug isolation — null shows everything. */
  mask: Set<ParallaxLayerId> | null = null;

  readonly stats: ParallaxStats = { sprites: 0, culled: 0, textures: 0, zone: "" };

  constructor() {
    // Deterministic stacking regardless of async texture load order:
    // fill+bg → planets → starfield → atmosphere. Planets sit in their own
    // container BELOW the starfield so stars always twinkle in front of
    // them instead of being swallowed by a planet disc.
    this.host.addChild(this.far, this.planetLayer, this.mid, this.atmo);
  }

  get activeZone(): string { return this.zone; }

  /** Palette of the current zone (for systems that tint to the map). */
  palette: { fill: string; hueA: string; hueB: string } = { fill: "#05060a", hueA: "#5e81ae", hueB: "#71508a" };

  loadZone(label: string): void {
    if (this.zone === label) return;
    this.zone = label;
    this.stats.zone = label;
    const token = ++this.buildToken;
    this.clearZone();
    loadScenes().then((scenes) => {
      if (token !== this.buildToken) return;
      const def = scenes[label] ?? scenes["1-1"];
      if (!def) return;
      this.palette = { fill: def.fill, hueA: def.hueA, hueB: def.hueB };
      this.buildZone(label, def, token);
    });
  }

  private clearZone(): void {
    for (const c of [this.far, this.planetLayer, this.mid, this.atmo, this.worldDecor, this.foreground]) {
      c.removeChildren().forEach((ch) => ch.destroy());
    }
    for (const t of this.zoneTextures) t.destroy(true);
    this.zoneTextures = [];
    this.fillSpr = this.bgSpr = null;
    this.sfTile = this.nebA = this.nebB = null;
    this.planets = []; this.flares = []; this.motes = [];
    this.driftX = 0; this.driftY = 0;
  }

  private buildZone(label: string, def: SceneDef, token: number): void {
    const rnd = seededRng("px-" + label);

    // ── layer 1: far space — fill + base background ────────────────────
    const fc = document.createElement("canvas"); fc.width = fc.height = 1;
    const fx = fc.getContext("2d")!;
    fx.fillStyle = def.fill; fx.fillRect(0, 0, 1, 1);
    const fillTex = PIXI.Texture.from(fc);
    this.zoneTextures.push(fillTex);
    this.fillSpr = new PIXI.Sprite(fillTex);
    this.far.addChild(this.fillSpr);

    loadLinearTexture(`/bg/do/${def.bg}?v=3`)
      .then((tex: PIXI.Texture) => {
        if (token !== this.buildToken) { tex.destroy(true); return; }
        this.zoneTextures.push(tex);
        this.bgSpr = new PIXI.Sprite(tex);
        this.bgSpr.anchor.set(0.5);
        this.far.addChild(this.bgSpr);
      })
      .catch(() => {});

    // ── layer 2: mid space — starfield + planets ───────────────────────
    if (def.starfield.length > 0) {
      Promise.all(def.starfield.map((f) =>
        loadLinearTexture(`/bg/do/${f}?v=3`).catch(() => null)
      )).then((texs: (PIXI.Texture | null)[]) => {
        if (token !== this.buildToken) return;
        const valid = texs.filter((t): t is PIXI.Texture => !!t);
        if (valid.length === 0) return;
        const sfTex = buildStarfieldTexture(label, valid);
        this.zoneTextures.push(sfTex);
        this.sfTile = new PIXI.TilingSprite(sfTex, 100, 100);
        this.sfTile.blendMode = "add"; // black-backed tiles -> black vanishes
        this.sfTile.alpha = 0.75;
        this.mid.addChildAt(this.sfTile, 0);
      });
    }

    for (const p of def.planets) {
      loadLinearTexture(`/bg/do/${p.file}?v=3`)
        .then((tex: PIXI.Texture) => {
          if (token !== this.buildToken) { tex.destroy(true); return; }
          this.zoneTextures.push(tex);
          const spr = new PIXI.Sprite(tex);
          spr.anchor.set(0.5);
          // keep planets background-sized: cap the longest side at 680px
          const s = Math.min(1, 680 / Math.max(p.w, p.h));
          spr.scale.set(s);
          this.planetLayer.addChild(spr);
          // pf 1..10 -> 0.022..0.045, always below the starfield's 0.06 so
          // relative depth stays consistent (farther = slower).
          const par = Math.max(PARALLAX.planetMin, Math.min(PARALLAX.planetMax, p.pf / 250 + 0.018));
          this.planets.push({ spr, cx: p.x, cy: p.y, par, pulse: 0, baseA: 1 });
        })
        .catch(() => {});
    }

    // ── layer 3: atmosphere — gas bands, lens flares, motes ────────────
    const nt = nebulaTex();
    this.nebB = new PIXI.TilingSprite(nt, 100, 100);
    this.nebB.tint = new PIXI.Color(def.hueB).toNumber();
    this.nebB.blendMode = "screen";
    this.nebB.alpha = 0.15;
    this.nebB.tileScale.set(1.7);
    this.atmo.addChild(this.nebB);
    this.nebA = new PIXI.TilingSprite(nt, 100, 100);
    this.nebA.tint = new PIXI.Color(def.hueA).toNumber();
    this.nebA.blendMode = "screen";
    this.nebA.alpha = 0.2;
    this.nebA.tileScale.set(1.1);
    this.atmo.addChild(this.nebA);

    for (const f of def.flares) {
      f.files.forEach((file, i) => {
        loadLinearTexture(`/bg/do/${file}?v=3`)
          .then((tex: PIXI.Texture) => {
            if (token !== this.buildToken) { tex.destroy(true); return; }
            this.zoneTextures.push(tex);
            const spr = new PIXI.Sprite(tex);
            spr.anchor.set(0.5);
            spr.blendMode = "add";
            const baseA = i === 0 ? 0.85 : 0.5;
            spr.alpha = baseA;
            this.atmo.addChild(spr);
            this.flares.push({ spr, cx: f.x, cy: f.y, par: PARALLAX.atmosphere, pulse: rnd() * Math.PI * 2, baseA });
          })
          .catch(() => {});
      });
    }

    const moteTint = new PIXI.Color(def.hueA).toNumber();
    for (let i = 0; i < 18; i++) {
      const spr = new PIXI.Sprite(moteTex());
      spr.anchor.set(0.5);
      spr.blendMode = "add";
      spr.tint = moteTint;
      spr.alpha = 0.05 + rnd() * 0.09;
      spr.scale.set(0.3 + rnd() * 0.8);
      this.atmo.addChild(spr);
      this.motes.push({ spr, u: rnd(), v: rnd(), s: 0.4 + rnd() * 0.8, ph: rnd() * Math.PI * 2 });
    }

    // ── dark structure silhouettes (danger zones) — like the planets they
    // sit BEHIND the starfield and drift slowly (0.05), reading as huge
    // distant structures instead of fast foreground objects. The
    // foreground container (1.12) stays reserved but unpopulated.
    if (label.startsWith("4-") && def.planets.length > 0) {
      const picks = def.planets.slice(0, 2);
      picks.forEach((p, i) => {
        loadLinearTexture(`/bg/do/${p.file}?v=3`)
          .then((tex: PIXI.Texture) => {
            if (token !== this.buildToken) { tex.destroy(true); return; }
            this.zoneTextures.push(tex);
            const spr = new PIXI.Sprite(tex);
            spr.anchor.set(0.5);
            spr.tint = 0x0b0e16;         // silhouette, not a repeated planet
            spr.alpha = 0.45;
            const s = Math.min(1.2, 780 / Math.max(p.w, p.h));
            spr.scale.set(s);
            this.planetLayer.addChild(spr);
            // canvas anchors near opposite corners, away from the center
            const cx = i === 0 ? 260 : 1860;
            const cy = i === 0 ? 1130 : 200;
            this.planets.push({ spr, cx, cy, par: PARALLAX.structures, pulse: 0, baseA: 0.45 });
          })
          .catch(() => {});
      });
    }
  }

  /**
   * Per-frame update. `shakeX/shakeY` are the camera-shake pixel offsets
   * already applied to worldLayer, so the foreground shakes in sync.
   */
  update(w: number, h: number, cam: { x: number; y: number }, zoom: number, tick: number, shakeX = 0, shakeY = 0): void {
    const m = this.mask;
    this.far.visible = !m || m.has("far");
    this.mid.visible = !m || m.has("mid");
    this.planetLayer.visible = !m || m.has("mid"); // planets belong to the mid-space toggle
    this.atmo.visible = !m || m.has("atmo");
    this.worldDecor.visible = !m || m.has("world");
    this.foreground.visible = !m || m.has("fg");

    this.driftX += 0.08;
    this.driftY += 0.04;
    const t = tick;
    let culled = 0;

    if (this.fillSpr) { this.fillSpr.width = w; this.fillSpr.height = h; }

    // Base bg: cover-fit with parallax margin — edge can never appear.
    if (this.bgSpr && this.bgSpr.texture.width > 1) {
      const margin = MAP_RADIUS * PARALLAX.far + FAR_SWAY;
      const iw = this.bgSpr.texture.width, ih = this.bgSpr.texture.height;
      const scale = Math.max((w + 2 * margin) / iw, (h + 2 * margin) / ih);
      this.bgSpr.scale.set(scale);
      this.bgSpr.x = w / 2 - cam.x * PARALLAX.far + Math.sin(t * 0.021) * FAR_SWAY;
      this.bgSpr.y = h / 2 - cam.y * PARALLAX.far + Math.cos(t * 0.017) * FAR_SWAY;
    }

    if (this.sfTile) {
      this.sfTile.width = w; this.sfTile.height = h;
      this.sfTile.tilePosition.x = -cam.x * PARALLAX.starfield + this.driftX * 0.35;
      this.sfTile.tilePosition.y = -cam.y * PARALLAX.starfield + this.driftY * 0.35;
    }

    // Anchored screen-space items (planets/flares): the 2100x1310 canvas is
    // cover-fit onto the screen, the item drifts by -cam*par around its
    // composition anchor. Culled outside the viewport (+margin).
    const cs = Math.max(w / CANVAS_W, h / CANVAS_H);
    const cull = (a: AnchoredSprite, pulseAlpha: number | null) => {
      const sx = (a.cx - CANVAS_W / 2) * cs + w / 2 - cam.x * a.par + this.driftX * a.par * 2;
      const sy = (a.cy - CANVAS_H / 2) * cs + h / 2 - cam.y * a.par + this.driftY * a.par * 2;
      const M = Math.max(a.spr.width, a.spr.height) / 2 + 60;
      if (sx < -M || sx > w + M || sy < -M || sy > h + M) {
        a.spr.visible = false; culled++;
        return;
      }
      a.spr.visible = true;
      a.spr.x = sx; a.spr.y = sy;
      if (pulseAlpha != null) a.spr.alpha = pulseAlpha;
    };
    for (const p of this.planets) cull(p, null);
    for (const f of this.flares) cull(f, f.baseA * (0.85 + 0.15 * Math.sin(t * 0.8 + f.pulse)));

    if (this.nebA) {
      this.nebA.width = w; this.nebA.height = h;
      this.nebA.tilePosition.x = -cam.x * 0.10 + this.driftX * 0.3;
      this.nebA.tilePosition.y = -cam.y * 0.10 + this.driftY * 0.3;
      this.nebA.alpha = 0.2 + 0.05 * Math.sin(t * 0.16);
    }
    if (this.nebB) {
      this.nebB.width = w; this.nebB.height = h;
      this.nebB.tilePosition.x = -cam.x * 0.16 - this.driftX * 0.42;
      this.nebB.tilePosition.y = -cam.y * 0.16 + this.driftY * 0.5;
      this.nebB.alpha = 0.15 + 0.04 * Math.sin(t * 0.23 + 1.7);
    }

    const M2 = 40, mw = w + M2 * 2, mh = h + M2 * 2;
    for (const mo of this.motes) {
      const dx = -cam.x * 0.4 + this.driftX * mo.s * 2.2;
      const dy = -cam.y * 0.4 + this.driftY * mo.s * 2.6;
      mo.spr.x = ((mo.u * mw + dx) % mw + mw) % mw - M2;
      mo.spr.y = ((mo.v * mh + dy) % mh + mh) % mh - M2;
      mo.spr.alpha = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * mo.s + mo.ph));
    }

    // Foreground (reserved, currently unpopulated): zoomed like the world,
    // pivot moves 12% faster than the camera.
    this.foreground.scale.set(zoom);
    this.foreground.position.set(w / 2 + shakeX, h / 2 + shakeY);
    this.foreground.pivot.set(cam.x * PARALLAX.foreground, cam.y * PARALLAX.foreground);

    this.stats.culled = culled;
    this.stats.sprites =
      this.far.children.length + this.planetLayer.children.length + this.mid.children.length + this.atmo.children.length +
      this.worldDecor.children.length + this.foreground.children.length;
    this.stats.textures = this.zoneTextures.length;
  }

  destroy(): void {
    this.buildToken++;
    this.clearZone();
    this.host.destroy({ children: true });
    this.worldDecor.destroy({ children: true });
    this.foreground.destroy({ children: true });
  }
}
