/**
 * space-material.ts — the SHARED space-metal material + lighting system.
 *
 * One material base + five presets (player / npc / boss / station / portal),
 * all built on the same dark-metal PBR foundation so every object in the game
 * reads as if lit by the SAME world instead of separate cut-out assets.
 *
 * Design goals (from the art brief):
 *   • dark gunmetal / titanium / anthracite hulls, slightly blue metallic
 *   • per-plate roughness + subtle color variation (no uniform grey, no chrome)
 *   • credible surface aging: dirt/oil under panels, soot at engines, fine
 *     wear on edges — placed via stable procedural masks, never per-frame
 *   • directional world lighting: bright lit side, dark shadow side, deep AO
 *     in recesses, gentle rim on edges — NO flat uniform ambient
 *   • only technical energy sources glow (engines, cockpit, windows), the hull
 *     itself never emits
 *
 * Reuse rules: textures are generated ONCE and cached (module-level maps), and
 * presets share those textures — no per-object shader instance, no per-frame
 * randomness. Everything here is renderer-agnostic Three.js; it plugs into the
 * existing ship + station scenes without a new renderer.
 */
import * as THREE from "three";

// ── Palette ────────────────────────────────────────────────────────────────
// Dark, slightly blue metal. Kept out of pure black so panels still catch
// light and env reflections.
export const SPACE_METAL = {
  hull: 0x2a2f38,        // gunmetal anthracite (base)
  hullPlayer: 0x323945,  // player: a touch lighter/cooler = "well kept"
  hullBoss: 0x2c3140,    // boss: cold dark titanium
  hullNpc: 0x242830,     // npc: darker, more worn
  station: 0x30343c,     // station: heavy grey-steel
  rimCool: new THREE.Color(0x88b4ff),  // cool edge/rim tint
  rimWarm: new THREE.Color(0xffe6c0),  // warm key highlight tint
};

// ── Procedural detail textures (generated once, cached) ─────────────────────
const _texCache = new Map<string, THREE.CanvasTexture>();

function seeded(seed: number): () => number {
  // Mulberry32 — deterministic so a given object always ages identically.
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Panel + wear ROUGHNESS-AO map. Packs plate-to-plate roughness variation,
 * panel seams (darker recesses = higher roughness + AO), bolts, maintenance
 * hatches, and fine edge scratches into one greyscale texture used as BOTH a
 * roughnessMap and (via a second sampler) an aoMap-like darkening. Brighter =
 * rougher/dirtier; the base plates stay large and calm so silhouettes read.
 */
function detailRoughAoTex(seed: number, variant: "hull" | "station"): THREE.CanvasTexture {
  const key = `rao-${variant}-${seed}`;
  const hit = _texCache.get(key);
  if (hit) return hit;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const rnd = seeded(seed);

  // Base roughness — mid-grey (roughness ~0.5), plates vary a little around it.
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, S, S);

  // Large armor plates: a few big rectangles with slightly different roughness,
  // some duller, some glossier, a couple darker "replaced" plates. Subtle.
  const plateCount = variant === "station" ? 10 : 6;
  const grid = variant === "station" ? 4 : 3;
  const cell = S / grid;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      if (rnd() < 0.25) continue; // leave big calm areas
      const pad = 6 + rnd() * 10;
      const x = gx * cell + pad, y = gy * cell + pad;
      const w = cell - pad * 2, h = cell - pad * 2;
      // roughness offset per plate: mostly ±0.12, rare glossy/dull outliers
      let g = 128 + (rnd() - 0.5) * 60;
      if (rnd() < 0.14) g = 90 + rnd() * 20;   // glossier repaired plate
      if (rnd() < 0.10) g = 165 + rnd() * 20;  // duller old plate
      ctx.fillStyle = `rgb(${g | 0},${g | 0},${g | 0})`;
      ctx.fillRect(x, y, w, h);
    }
  }
  void plateCount;

  // Panel SEAMS — dark grooves (recessed = strong AO). Bolder + a bright
  // beveled highlight edge so the seam catches light on one side and shadows
  // on the other (reads as a real recessed channel, not a painted line).
  const seams = variant === "station" ? 7 : 5;
  for (let i = 1; i < seams; i++) {
    const off = (i / seams) * S + (rnd() - 0.5) * 12;
    ctx.strokeStyle = "rgba(30,30,30,0.9)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(off, 0); ctx.lineTo(off, S); ctx.stroke();
    ctx.strokeStyle = "rgba(150,150,150,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(off + 2, 0); ctx.lineTo(off + 2, S); ctx.stroke();
    const off2 = (i / seams) * S + (rnd() - 0.5) * 12;
    ctx.strokeStyle = "rgba(30,30,30,0.9)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, off2); ctx.lineTo(S, off2); ctx.stroke();
    ctx.strokeStyle = "rgba(150,150,150,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, off2 + 2); ctx.lineTo(S, off2 + 2); ctx.stroke();
  }

  // Bolts / rivets — darker + slightly bigger so they read as recessed points.
  ctx.fillStyle = "rgba(28,28,28,0.85)";
  const bolts = variant === "station" ? 140 : 70;
  for (let i = 0; i < bolts; i++) {
    const x = rnd() * S, y = rnd() * S;
    ctx.beginPath(); ctx.arc(x, y, 2 + rnd() * 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // Maintenance hatches — small recessed rectangles (rougher + darker).
  const hatches = variant === "station" ? 8 : 3;
  for (let i = 0; i < hatches; i++) {
    const w = 22 + rnd() * 30, h = 16 + rnd() * 22;
    const x = rnd() * (S - w), y = rnd() * (S - h);
    ctx.fillStyle = "rgba(70,70,70,0.5)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(45,45,45,0.7)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }

  // Fine scratches / edge wear — short bright strokes (glossier bare metal
  // where paint chipped). Sparse; big plates stay clean.
  ctx.strokeStyle = "rgba(180,180,180,0.35)";
  ctx.lineWidth = 1;
  const scratches = 40;
  for (let i = 0; i < scratches; i++) {
    const x = rnd() * S, y = rnd() * S;
    const a = rnd() * Math.PI, len = 6 + rnd() * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace; // data map, not color
  _texCache.set(key, tex);
  return tex;
}

/**
 * DIRT / OIL / SOOT overlay, used as an emissive-less darkening via a second
 * material's map-tint is impractical, so this returns a texture meant to be
 * multiplied into the base color through `.map` mixing OR used as an aoMap.
 * White = clean, dark = grime. Grime is placed LOGICALLY: streaks under
 * hatches, soot pooled at one side (engine end), grease along seams — not
 * uniform noise.
 */
function dirtTex(seed: number, heavy: boolean): THREE.CanvasTexture {
  const key = `dirt-${heavy ? "h" : "l"}-${seed}`;
  const hit = _texCache.get(key);
  if (hit) return hit;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const rnd = seeded(seed ^ 0x9e3779b9);

  ctx.fillStyle = "#ffffff"; // clean
  ctx.fillRect(0, 0, S, S);

  const streaks = heavy ? 26 : 12;
  // Downward oil/grease streaks from a few hatch points (gravity-less but reads
  // as fluid creep along the hull). Vertical bias.
  for (let i = 0; i < streaks; i++) {
    const x = rnd() * S;
    const y = rnd() * S * 0.6;
    const len = 30 + rnd() * (heavy ? 160 : 90);
    const w = 3 + rnd() * 6;
    const g = ctx.createLinearGradient(x, y, x, y + len);
    const a = (heavy ? 0.32 : 0.2) * (0.6 + rnd() * 0.4);
    g.addColorStop(0, `rgba(40,36,30,${a})`);
    g.addColorStop(1, "rgba(40,36,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y, w, len);
  }

  // Soot pool at one end (engine/exhaust side) — a soft dark radial.
  const sootX = rnd() < 0.5 ? S * 0.12 : S * 0.88;
  const sg = ctx.createRadialGradient(sootX, S * 0.5, 0, sootX, S * 0.5, S * 0.45);
  sg.addColorStop(0, `rgba(20,18,16,${heavy ? 0.5 : 0.32})`);
  sg.addColorStop(1, "rgba(20,18,16,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, S, S);

  // Grease darkening along a couple of seams.
  ctx.strokeStyle = `rgba(35,32,28,${heavy ? 0.4 : 0.25})`;
  ctx.lineWidth = 4;
  for (let i = 0; i < (heavy ? 4 : 2); i++) {
    const off = rnd() * S;
    ctx.beginPath(); ctx.moveTo(0, off); ctx.lineTo(S, off + (rnd() - 0.5) * 40); ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  _texCache.set(key, tex);
  return tex;
}

/** Detail NORMAL map — fine plate bevels + scratches for micro surface relief.
 *  Flat-ish (mostly 128,128,255) with gentle embossed seams so light catches
 *  panel edges. Shared across all objects (tiled), so it's one texture. */
function detailNormalTex(): THREE.CanvasTexture {
  const key = "detail-normal";
  const hit = _texCache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const rnd = seeded(1337);
  ctx.fillStyle = "#8080ff"; // flat normal
  ctx.fillRect(0, 0, S, S);
  // Embossed seams: a dark+light pair perpendicular to the seam = a groove.
  for (let i = 0; i < 6; i++) {
    const y = (i / 6) * S + rnd() * 8;
    ctx.strokeStyle = "rgba(80,80,255,1)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    ctx.strokeStyle = "rgba(160,160,255,1)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(S, y + 2); ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const x = (i / 6) * S + rnd() * 8;
    ctx.strokeStyle = "rgba(90,90,255,1)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  _texCache.set(key, tex);
  return tex;
}

/**
 * ENERGY-CRACK emissive map: branching glowing fractures over a black hull.
 * Black = no glow (the hull stays dark, non-emissive), bright = a crack that
 * bloom will pick up. Used as an emissiveMap; the emissive color (e.g. green)
 * is set on the material. Stable per seed, generated once, cached.
 */
function energyCrackTex(seed: number): THREE.CanvasTexture {
  const key = `crack-${seed}`;
  const hit = _texCache.get(key);
  if (hit) return hit;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const rnd = seeded(seed ^ 0x1a2b3c4d);

  ctx.fillStyle = "#000000"; // no glow anywhere by default
  ctx.fillRect(0, 0, S, S);

  ctx.lineCap = "round";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 6;

  // A handful of main fractures, each branching into thinner offshoots. Drawn
  // white (color comes from the material's emissive); a soft halo via shadow.
  const drawCrack = (x: number, y: number, ang: number, len: number, wid: number, depth: number) => {
    let cx = x, cy = y, a = ang;
    const steps = Math.max(3, Math.floor(len / 14));
    for (let i = 0; i < steps; i++) {
      const nx = cx + Math.cos(a) * (len / steps);
      const ny = cy + Math.sin(a) * (len / steps);
      // bright hot core
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - i / steps * 0.4)})`;
      ctx.lineWidth = wid;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();
      cx = nx; cy = ny;
      a += (rnd() - 0.5) * 0.9; // jitter → jagged fracture
      // occasional branch
      if (depth > 0 && rnd() < 0.3) {
        drawCrack(cx, cy, a + (rnd() - 0.5) * 1.8, len * 0.5, Math.max(1, wid * 0.6), depth - 1);
      }
    }
  };

  const mains = 4;
  for (let i = 0; i < mains; i++) {
    const x = rnd() * S, y = rnd() * S;
    drawCrack(x, y, rnd() * Math.PI * 2, 120 + rnd() * 140, 3 + rnd() * 2, 2);
  }
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(key, tex);
  return tex;
}

// ── Material presets ────────────────────────────────────────────────────────

export type SpaceRole = "player" | "npc" | "boss" | "station" | "portal";

export interface SpaceMaterialOpts {
  seed?: number;           // stable per-object aging seed
  hullColor?: number;      // override base color (faction/rarity tint)
  keepMap?: THREE.Texture | null; // preserve the GLB's authored albedo if good
  // Glowing energy cracks (e.g. the Leviathan): an emissive fracture map in
  // this color, tagged for a slow pulse by the render loop. Hull still dark.
  energyCracks?: { color: number; intensity?: number };
}

/**
 * Build (or upgrade) a MeshStandardMaterial into the shared space-metal look
 * for a given role. Applies detail roughness/AO, dirt darkening, a shared
 * detail normal, per-role metalness/roughness, and env reflection strength.
 * The hull NEVER emits — emissive stays 0 here; glow is added separately only
 * to real light sources (engines/windows) by the caller.
 */
export function applySpaceMaterial(
  mat: THREE.MeshStandardMaterial,
  role: SpaceRole,
  opts: SpaceMaterialOpts = {},
): void {
  const seed = opts.seed ?? 12345;
  const heavy = role === "npc" || role === "station";
  const variant = role === "station" ? "station" : "hull";

  // Base color: dark metal, role-tuned. Keep the authored map if present (so
  // panel art rides through) but darken/desaturate its tint toward the palette.
  const baseHex =
    opts.hullColor ??
    (role === "player" ? SPACE_METAL.hullPlayer :
     role === "boss" ? SPACE_METAL.hullBoss :
     role === "station" ? SPACE_METAL.station :
     role === "npc" ? SPACE_METAL.hullNpc : SPACE_METAL.hull);

  // How much to darken the authored albedo toward dark metal. NPCs are pulled
  // down hardest (they read "too bright" with their raw Blender textures), boss
  // a little, player kept closest to authored (well-kept ship), station mid.
  const albedoMul =
    role === "npc" ? 0.55 :
    role === "boss" ? 0.72 :
    role === "station" ? 0.7 :
    role === "player" ? 0.85 : 0.8;
  if (mat.map) {
    // Keep authored albedo detail but multiply it down + tint toward the dark
    // metal palette so nothing reads bright/flat.
    mat.color = new THREE.Color(baseHex).lerp(new THREE.Color(0xffffff), 0.35).multiplyScalar(albedoMul + 0.25);
  } else {
    mat.color = new THREE.Color(baseHex);
  }

  // Detail maps (stable per seed). CRITICAL: without an explicit .repeat the
  // 512px detail map is stretched ONCE across the whole hull → invisible mush.
  // Tile it several times so plates/seams/bolts actually read at ship scale.
  const rao = detailRoughAoTex(seed, variant);
  const tile = role === "station" ? 3 : 2;
  rao.repeat.set(tile, tile);
  rao.needsUpdate = true;
  mat.roughnessMap = rao;
  mat.aoMap = rao;                 // reuse: dark seams/bolts read as occlusion
  // Strong AO so recesses/seams go genuinely dark (was too weak to see).
  mat.aoMapIntensity = role === "station" ? 1.6 : 1.35;

  // Detail normal — tiled + a much stronger scale so seams/bevels catch the
  // key light and the hull stops reading as a flat sticker.
  const nrm = detailNormalTex();
  nrm.repeat.set(tile * 1.5, tile * 1.5);
  nrm.needsUpdate = true;
  mat.normalMap = nrm;
  mat.normalScale = new THREE.Vector2(0.9, 0.9);

  void dirtTex(seed, heavy);

  // Per-role PBR: dark metal, not chrome, not plastic. Player = cleaner/glossier
  // on exposed faces, NPC = rougher/duller, boss = cold hard metal, station =
  // heavy matte-ish but still metallic (NOT the old rough≥0.88 flat grey).
  switch (role) {
    case "player":
      mat.metalness = 0.72; mat.roughness = 0.42; mat.envMapIntensity = 1.15; break;
    case "boss":
      mat.metalness = 0.78; mat.roughness = 0.40; mat.envMapIntensity = 1.1; break;
    case "npc":
      mat.metalness = 0.62; mat.roughness = 0.58; mat.envMapIntensity = 0.85; break;
    case "station":
      mat.metalness = 0.55; mat.roughness = 0.60; mat.envMapIntensity = 0.9; break;
    case "portal":
      mat.metalness = 0.5; mat.roughness = 0.5; mat.envMapIntensity = 1.0; break;
  }

  // Hull never glows — UNLESS energy cracks are requested. The base hull stays
  // dark (emissive color multiplies the emissiveMap, which is black except on
  // the cracks), so only the fractures light up.
  if (opts.energyCracks) {
    mat.emissive = new THREE.Color(opts.energyCracks.color);
    mat.emissiveMap = energyCrackTex(seed);
    const baseI = opts.energyCracks.intensity ?? 1.6;
    mat.emissiveIntensity = baseI;
    // Tag for the render loop's slow pulse (see three-ship-layer pulse pass).
    mat.userData.pulseEmissive = { base: baseI, amp: baseI * 0.45, speed: 1.6 };
  } else {
    if (mat.emissive) mat.emissive.setHex(0x000000);
    mat.emissiveIntensity = 0;
  }

  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
  mat.needsUpdate = true;
}

// ── Shared lighting rig ─────────────────────────────────────────────────────
// Directional world light: one clear warm key from the upper-right, a cooler
// fill for edge definition, and a very low cool ambient so shadow sides go
// deep. Added to whatever scene is passed. Returns handles for debug tuning.
export interface SpaceLightRig {
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  rim: THREE.DirectionalLight;
}

export function addSpaceLightRig(scene: THREE.Scene, opts?: { shadows?: boolean }): SpaceLightRig {
  const ambient = new THREE.AmbientLight(0x2a3048, 0.16); // deep, cool, low
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff2e0, 2.1);  // warm sun, upper-right
  key.position.set(120, 320, -90);
  if (opts?.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -900; key.shadow.camera.right = 900;
    key.shadow.camera.top = 900; key.shadow.camera.bottom = -900;
    key.shadow.camera.near = 1; key.shadow.camera.far = 1600;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
  }
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x5c86d6, 0.42); // cool fill, opposite
  fill.position.set(-90, 140, 110);
  scene.add(fill);

  // Rim: a low grazing cool light from behind/below to catch top edges (a
  // cheap stand-in for fresnel; the shared detail normal reacts to it).
  const rim = new THREE.DirectionalLight(0x9ec2ff, 0.5);
  rim.position.set(-30, -60, 200);
  scene.add(rim);

  return { key, fill, ambient, rim };
}

/** Dispose cached textures (debug scene teardown / HMR). */
export function disposeSpaceMaterialCache(): void {
  for (const t of _texCache.values()) t.dispose();
  _texCache.clear();
}
