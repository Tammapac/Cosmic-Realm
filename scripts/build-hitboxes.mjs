// Extracts 2D silhouette hull polygons (top-down, model units) from every
// ship GLB and writes lib/ship-hulls.ts for shared server+client hit tests.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { writeFileSync } from "node:fs";

const ROOT = "E:/Program Files/Claude Code/Cosmic-Realm";
const MODELS = {
  // player ships (also worn by pirates)
  apex: "/models/Apex_Destroyer.glb",
  colossus: "/models/Colossus_MK_X.glb",
  eclipse: "/models/Eclipse_Destroyer.glb",
  harbinger: "/models/Harbinger_Class.glb",
  leviathan: "/models/Leviathan_Dreadnought.glb",
  marauder: "/models/Marauder.glb",
  obsidian: "/models/Obsidian_Reaver.glb",
  phalanx: "/models/Phallanx_Cruiser.glb",
  reaver: "/models/reaver_mk2.glb",
  skimmer: "/models/Skimmer_MK_1.glb",
  sovereign: "/models/Sovereign_Flagship.glb",
  specter: "/models/Specter_Phasefreame.glb",
  titan: "/models/Titan_Bulwark.glb",
  vanguard: "/models/Vanguard.glb",
  wasp: "/models/Wasp_Interceptor.glb",
  // enemies
  enemy_scout: "/models/enemies/enemy_scout.glb",
  enemy_interceptor: "/models/enemies/enemy_interceptor.glb",
  enemy_raider: "/models/enemies/enemy_raider.glb",
  enemy_corvette: "/models/enemies/enemy_corvette.glb",
  enemy_destroyer: "/models/enemies/enemy_destroyer.glb",
  enemy_sentinel: "/models/enemies/enemy_sentinel.glb",
  enemy_specter: "/models/enemies/enemy_specter.glb",
  enemy_phantom: "/models/enemies/enemy_phantom.glb",
  enemy_wraith: "/models/enemies/enemy_wraith.glb",
  enemy_voidling: "/models/enemies/enemy_voidling.glb",
  enemy_dread: "/models/enemies/enemy_dread.glb",
  enemy_titan: "/models/enemies/enemy_titan.glb",
  enemy_juggernaut: "/models/enemies/enemy_juggernaut.glb",
  enemy_overlord: "/models/enemies/enemy_overlord.glb",
  enemy_leviathan: "/models/enemies/enemy_leviathan.glb",
  enemy_zengas: "/models/enemies/enemy_zengas.glb",
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function mat4MulVec(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ];
}

function convexHull(points) {
  // Andrew monotone chain; points: [x, z]
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function simplifyHull(hull, maxPts) {
  const area3 = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  while (hull.length > maxPts) {
    let bi = 0, best = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const a = hull[(i - 1 + hull.length) % hull.length];
      const b = hull[i];
      const c = hull[(i + 1) % hull.length];
      const loss = area3(a, b, c);
      if (loss < best) { best = loss; bi = i; }
    }
    hull.splice(bi, 1);
  }
  return hull;
}

const out = {};
for (const [key, rel] of Object.entries(MODELS)) {
  const doc = await io.read(ROOT + "/frontend/public" + rel);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const pts2d = [];
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  const walk = (node) => {
    const mesh = node.getMesh();
    if (mesh) {
      const m = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const n = pos.getCount();
        const step = Math.max(1, Math.floor(n / 6000)); // subsample big meshes
        const el = [0, 0, 0];
        for (let i = 0; i < n; i += step) {
          pos.getElement(i, el);
          const w = mat4MulVec(m, el);
          pts2d.push([w[0], w[2]]); // top-down: X, Z
          for (let k = 0; k < 3; k++) { if (w[k] < min[k]) min[k] = w[k]; if (w[k] > max[k]) max[k] = w[k]; }
        }
      }
    }
    node.listChildren().forEach(walk);
  };
  scene.listChildren().forEach(walk);

  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const maxDim = Math.max(...size);
  let hull = convexHull(pts2d);
  hull = simplifyHull(hull, 14);
  const r = Math.max(...hull.map(([x, z]) => Math.hypot(x, z)));
  out[key] = {
    pxPerUnit: +( (85 * 1.1) / maxDim ).toFixed(5),
    r: +r.toFixed(4),
    pts: hull.map(([x, z]) => [+x.toFixed(4), +z.toFixed(4)]),
  };
  console.log(key, "hull", hull.length, "pts, maxDim", maxDim.toFixed(2), "r", r.toFixed(2));
}

const ts = `// AUTO-GENERATED by build-hulls.mjs — top-down silhouette hulls per ship
// model (model units, glTF X/Z plane; nose = -X). Regenerate after replacing
// GLBs. pxPerUnit converts model units -> world units at sizeScale 1
// (matches the renderer: 85 * 1.1 / maxDim).
export type ShipHull = { pxPerUnit: number; r: number; pts: [number, number][] };

export const SHIP_HULLS: Record<string, ShipHull> = ${JSON.stringify(out, null, 1)};
`;
writeFileSync(ROOT + "/lib/ship-hulls.ts", ts);
console.log("written lib/ship-hulls.ts");
