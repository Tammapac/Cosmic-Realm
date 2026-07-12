// Align new enemy GLBs to the orientation of the last confirmed-good set.
// For each model: compute a world-space XZ shape signature (extent + centroid
// skew per axis) for old and new, find the Y-rotation delta (0/90/180/270)
// that best maps new→old, bake it into the new file's root nodes, verify.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const OLD = "C:/Users/tamma/AppData/Local/Temp/claude/E--Program-Files-Claude-Code/d39092ba-0c5d-4f54-b0d7-5aae1687f5ce/scratchpad/known_good/";
const NEW = "E:/Program Files/Claude Code/Cosmic-Realm/frontend/public/models/enemies/";
const MODELS = ["scout","interceptor","raider","corvette","destroyer","sentinel","specter","phantom","wraith","voidling","dread","titan","juggernaut","overlord","leviathan","zengas"];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function m4v(m, v) {
  return [
    m[0]*v[0] + m[4]*v[1] + m[8]*v[2] + m[12],
    m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13],
    m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14],
  ];
}

async function signature(path) {
  const doc = await io.read(path);
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  let n = 0, sx = 0, sz = 0;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  const walk = (node) => {
    const mesh = node.getMesh();
    if (mesh) {
      const m = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        const cnt = pos.getCount();
        const step = Math.max(1, Math.floor(cnt / 8000));
        const el = [0, 0, 0];
        for (let i = 0; i < cnt; i += step) {
          pos.getElement(i, el);
          const w = m4v(m, el);
          n++; sx += w[0]; sz += w[2];
          if (w[0] < minX) minX = w[0]; if (w[0] > maxX) maxX = w[0];
          if (w[2] < minZ) minZ = w[2]; if (w[2] > maxZ) maxZ = w[2];
        }
      }
    }
    node.listChildren().forEach(walk);
  };
  scene.listChildren().forEach(walk);
  const ex = maxX - minX, ez = maxZ - minZ;
  const cx = (maxX + minX) / 2, cz = (maxZ + minZ) / 2;
  return { ex, ez, skx: (sx / n - cx) / ex, skz: (sz / n - cz) / ez, doc };
}

function rotSig(sig, deg) {
  // rotate the signature's frame by deg about +Y: x' = x c + z s ; z' = -x s + z c
  if (deg === 0) return { ex: sig.ex, ez: sig.ez, skx: sig.skx, skz: sig.skz };
  if (deg === 90) return { ex: sig.ez, ez: sig.ex, skx: sig.skz, skz: -sig.skx };
  if (deg === 180) return { ex: sig.ex, ez: sig.ez, skx: -sig.skx, skz: -sig.skz };
  return { ex: sig.ez, ez: sig.ex, skx: -sig.skz, skz: sig.skx }; // 270
}

const S = Math.SQRT1_2;
const Q = { 90: [0, S, 0, S], 180: [0, 1, 0, 0], 270: [0, -S, 0, S] };
const qMul = (a, b) => [
  a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
  a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
  a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
  a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2],
];

for (const name of MODELS) {
  const oldSig = await signature(OLD + "enemy_" + name + ".glb");
  const newPath = NEW + "enemy_" + name + ".glb";
  const newSig = await signature(newPath);
  let best = 0, bestErr = 1e9;
  for (const deg of [0, 90, 180, 270]) {
    const r = rotSig(newSig, deg);
    const err =
      Math.abs(r.ex - oldSig.ex) / Math.max(oldSig.ex, 0.01) +
      Math.abs(r.ez - oldSig.ez) / Math.max(oldSig.ez, 0.01) +
      Math.abs(r.skx - oldSig.skx) * 6 +
      Math.abs(r.skz - oldSig.skz) * 6;
    if (err < bestErr) { bestErr = err; best = deg; }
  }
  if (best !== 0) {
    const scene = newSig.doc.getRoot().getDefaultScene() ?? newSig.doc.getRoot().listScenes()[0];
    for (const node of scene.listChildren()) {
      node.setRotation(qMul(Q[best], node.getRotation()));
      const t = node.getTranslation();
      // rotate translation too (they're ~0, but keep exact)
      const c = { 90: [0, 1], 180: [-1, 0], 270: [0, -1] }[best];
      node.setTranslation([t[0] * c[0] + t[2] * c[1], t[1], -t[0] * c[1] + t[2] * c[0]]);
    }
    await io.write(newPath, newSig.doc);
  }
  console.log(name.padEnd(12), "delta", String(best).padStart(3) + "°", "err", bestErr.toFixed(3));
}
console.log("ALIGN DONE");
