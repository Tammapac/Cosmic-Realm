import {
  Asteroid, DRONE_DEFS, Drone, DUNGEONS, Enemy, FACTIONS, Floater, MAP_RADIUS, OtherPlayer, Particle,
  PORTALS, Projectile, SHIP_CLASSES, STATIONS, ShipClassId, Station, ZONES,
} from "./types";
import { state } from "./store";

// ── STAR FIELDS ────────────────────────────────────────────────────────────
const STAR_LAYERS = [
  { count: 220, speed: 0.1, size: 1, color: "#3a4980" },
  { count: 130, speed: 0.3, size: 1, color: "#7a8ad8" },
  { count: 65,  speed: 0.55, size: 2, color: "#e8f0ff" },
];
type Star = { x: number; y: number; size: number; color: string; speed: number };
const stars: Star[][] = STAR_LAYERS.map((layer) => {
  const arr: Star[] = [];
  for (let i = 0; i < layer.count; i++) {
    arr.push({
      x: Math.random() * 4000 - 2000,
      y: Math.random() * 4000 - 2000,
      size: layer.size, color: layer.color, speed: layer.speed,
    });
  }
  return arr;
});

let nebulaSeed: { x: number; y: number; r: number; c: string }[] = [];
function regenNebula(zone: keyof typeof ZONES): void {
  nebulaSeed = [];
  const z = ZONES[zone];
  for (let i = 0; i < 18; i++) {
    nebulaSeed.push({
      x: (Math.random() - 0.5) * 6000,
      y: (Math.random() - 0.5) * 6000,
      r: 300 + Math.random() * 600,
      c: i % 2 === 0 ? z.bgHueA : z.bgHueB,
    });
  }
}
regenNebula(state.player.zone);
let lastZone = state.player.zone;

// ── PIXEL HELPERS ─────────────────────────────────────────────────────────
function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ── 16-bit SHIP SPRITES ──────────────────────────────────────────────────
function drawShip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angle: number, shipClass: ShipClassId,
  scale = 1, glow = true,
): void {
  const cls = SHIP_CLASSES[shipClass];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  if (glow) {
    ctx.shadowColor = cls.color;
    ctx.shadowBlur = 12;
  }
  const c = cls.color;
  const a = cls.accent;
  const hi = "#ffffff";
  const dk = shadeHex(c, -0.45);
  drawShipPixels(ctx, shipClass, c, a, hi, dk, scale);
  ctx.restore();
}

function shadeHex(hex: string, amt: number): string {
  // hex #rrggbb, amt in [-1,1]
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * (amt < 0 ? v : (255 - v)))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function drawShipPixels(
  ctx: CanvasRenderingContext2D, id: ShipClassId,
  c: string, a: string, hi: string, dk: string, s: number,
): void {
  // origin: ship nose pointing UP (Y-) in local coords
  // Polygon fill helper
  function poly(color: string, pts: [number, number][]): void {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * s, pts[i][1] * s);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Ellipse helper
  function ell(color: string, cx: number, cy: number, rx: number, ry: number): void {
    ctx.beginPath();
    ctx.ellipse(cx * s, cy * s, Math.max(0.5, Math.abs(rx * s)), Math.max(0.5, Math.abs(ry * s)), 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Stroked line helper (for panel detail)
  function seg(color: string, x1: number, y1: number, x2: number, y2: number, w = 0.7): void {
    ctx.beginPath();
    ctx.moveTo(x1 * s, y1 * s);
    ctx.lineTo(x2 * s, y2 * s);
    ctx.strokeStyle = color;
    ctx.lineWidth = w * s;
    ctx.stroke();
  }

  switch (id) {
    case "skimmer": {
      // F-16 Falcon style: cranked delta wing, slim fuselage, single engine
      // Wings: large delta with cranked leading edge
      poly(c,  [[-2,-4],[-12,2],[-10,8],[-3,7]]);        // L main wing
      poly(c,  [[ 2,-4],[ 12,2],[ 10,8],[ 3,7]]);        // R main wing
      poly(dk, [[-5, 2],[-10,8],[-3, 7]]);               // L wing shadow
      poly(dk, [[ 5, 2],[ 10,8],[ 3, 7]]);               // R wing shadow
      // Tail stabilisers
      poly(dk, [[-2, 6],[-6,11],[-3,12],[-2, 9]]);       // L stabiliser
      poly(dk, [[ 2, 6],[ 6,11],[ 3,12],[ 2, 9]]);       // R stabiliser
      // Fuselage: slim cylinder shape pointed at nose
      poly(c,  [[0,-14],[2,-9],[2.5,5],[1.5,10],[0,12],[-1.5,10],[-2.5,5],[-2,-9]]);
      // Intake bulge each side
      poly(a,  [[-2.5,-3],[-5,-1],[-4,4],[-2,4]]);       // L intake
      poly(a,  [[ 2.5,-3],[ 5,-1],[ 4,4],[ 2,4]]);       // R intake
      // Cockpit canopy
      poly(a,  [[-1.5,-12],[1.5,-12],[2,-7],[-2,-7]]);
      ell(hi,  0,-10, 1, 2);                              // glass
      // Nose spike
      poly(c,  [[-0.5,-14],[0.5,-14],[0,-17]]);
      // Engine nozzle
      ell(a,   0, 11, 2, 1.2);
      ell("#4ee2ff", 0, 12.5, 1.2, 0.8);                 // exhaust glow
      // Panel line
      seg(dk,  0,-9, 0, 9, 0.5);
      break;
    }
    case "wasp": {
      // F-22 Raptor: trapezoidal wings, canards, twin engine nozzles
      // Main trapezoidal wings
      poly(c,  [[-2,-5],[-13,1],[-11,7],[-2, 4]]);       // L wing
      poly(c,  [[ 2,-5],[ 13,1],[ 11,7],[ 2, 4]]);       // R wing
      poly(dk, [[-6, 1],[-11,7],[-2, 4]]);               // L shadow
      poly(dk, [[ 6, 1],[ 11,7],[ 2, 4]]);               // R shadow
      // Canards (small front fins)
      poly(c,  [[-1.5,-9],[-6,-7],[-5,-5],[-1.5,-6]]);  // L canard
      poly(c,  [[ 1.5,-9],[ 6,-7],[ 5,-5],[ 1.5,-6]]); // R canard
      // Tail fins (canted outward)
      poly(dk, [[-2,5],[-5,10],[-3,11],[-2, 8]]);        // L fin
      poly(dk, [[ 2,5],[ 5,10],[ 3,11],[ 2, 8]]);        // R fin
      // Fuselage: very slim
      poly(c,  [[0,-16],[1.5,-10],[2,4],[1,10],[0,12],[-1,10],[-2,4],[-1.5,-10]]);
      // Cockpit
      poly(a,  [[-1.5,-14],[1.5,-14],[2,-9],[-2,-9]]);
      ell(hi,  0,-12, 1, 2);
      // Nose spike
      poly(c,  [[-0.5,-16],[0.5,-16],[0,-19]]);
      // Twin engines
      ell(a,   -2, 11, 1.8, 1.2);
      ell(a,    2, 11, 1.8, 1.2);
      ell("#ffd24a", -2, 12.5, 1, 0.7);
      ell("#ffd24a",  2, 12.5, 1, 0.7);
      // Weapon hardpoints on wings
      poly(dk, [[-8,1],[-7,1],[-7,4],[-8,4]]);
      poly(dk, [[ 7,1],[ 8,1],[ 8,4],[ 7,4]]);
      break;
    }
    case "vanguard": {
      // X-wing style: swept wings + 4 engine nacelles on wingtips
      // Main swept wings
      poly(c,  [[-3,-3],[-15,4],[-12,9],[-3, 6]]);       // L wing
      poly(c,  [[ 3,-3],[ 15,4],[ 12,9],[ 3, 6]]);       // R wing
      poly(dk, [[-7, 3],[-12,9],[-3, 6]]);               // L shadow
      poly(dk, [[ 7, 3],[ 12,9],[ 3, 6]]);               // R shadow
      // Rear stabilisers
      poly(c,  [[-3, 7],[-7,12],[-5,13],[-3,10]]);       // L stab
      poly(c,  [[ 3, 7],[ 7,12],[ 5,13],[ 3,10]]);       // R stab
      // Fuselage: medium width
      poly(c,  [[0,-15],[3,-9],[4,3],[3,10],[0,13],[-3,10],[-4,3],[-3,-9]]);
      // Cockpit
      poly(a,  [[-2,-13],[2,-13],[3,-8],[-3,-8]]);
      ell(hi,  0,-11, 1.2, 2);
      // Nose spike
      poly(c,  [[-0.8,-15],[0.8,-15],[0,-18]]);
      // 4 engine nacelles on wingtips
      ell(a,  -12.5, 7.5, 2.2, 1.2);                    // L outer nacelle
      ell(a,   12.5, 7.5, 2.2, 1.2);                    // R outer nacelle
      ell(a,   -3.5, 12,  1.6, 1);                      // L inner
      ell(a,    3.5, 12,  1.6, 1);                      // R inner
      ell("#5cff8a", -12.5, 9,  1.3, 0.8);
      ell("#5cff8a",  12.5, 9,  1.3, 0.8);
      ell("#5cff8a",  -3.5, 13.5, 1, 0.6);
      ell("#5cff8a",   3.5, 13.5, 1, 0.6);
      // Panel lines
      seg(dk, -3,-9,-3, 9, 0.5);
      seg(dk,  3,-9, 3, 9, 0.5);
      break;
    }
    case "reaver": {
      // Su-47 Berkut: forward-swept wings, twin guns, aggressive hunter
      // Forward-swept wings (sweep FORWARD from root to tip)
      poly(c,  [[-2, 1],[-13,-5],[-11, 2],[-2, 6]]);    // L fwd-sweep wing
      poly(c,  [[ 2, 1],[ 13,-5],[ 11, 2],[ 2, 6]]);    // R fwd-sweep wing
      poly(dk, [[-6, 0],[-11, 2],[-2, 6]]);              // L shadow
      poly(dk, [[ 6, 0],[ 11, 2],[ 2, 6]]);              // R shadow
      // Rear delta stabilisers
      poly(c,  [[-3, 6],[-9,11],[-6,13],[-3,10]]);       // L rear fin
      poly(c,  [[ 3, 6],[ 9,11],[ 6,13],[ 3,10]]);       // R rear fin
      // Fuselage
      poly(c,  [[0,-16],[2.5,-10],[3.5,3],[2,11],[0,13],[-2,11],[-3.5,3],[-2.5,-10]]);
      // Cockpit
      poly(a,  [[-2,-14],[2,-14],[3,-9],[-3,-9]]);
      ell(hi,  0,-12, 1.2, 2);
      // Twin gun barrels (forward under fuselage)
      poly(dk, [[-2.5,-16],[-1.5,-16],[-1.5,-9],[-2.5,-9]]);  // L gun
      poly(dk, [[ 1.5,-16],[ 2.5,-16],[ 2.5,-9],[ 1.5,-9]]); // R gun
      // Nose
      poly(c,  [[-0.8,-16],[0.8,-16],[0,-19]]);
      // Twin engines
      ell(a,   -2.5, 12, 2, 1.3);
      ell(a,    2.5, 12, 2, 1.3);
      ell("#ff5c6c", -2.5, 13.5, 1.2, 0.8);
      ell("#ff5c6c",  2.5, 13.5, 1.2, 0.8);
      // Engine intakes (side, bulge)
      poly(a,  [[-3.5,-5],[-6,-3],[-5.5, 4],[-3, 4]]);  // L intake
      poly(a,  [[ 3.5,-5],[ 6,-3],[ 5.5, 4],[ 3, 4]]); // R intake
      break;
    }
    case "obsidian": {
      // B-2 Spirit stealth: pure flying wing, angular, no fuselage bump
      // Full flying wing — flat angular shape
      poly(c,  [
        [ 0,-10],[ 7,-7],[17, 3],[14, 7],[7, 9],
        [ 0, 12],[-7, 9],[-14, 7],[-17, 3],[-7,-7],
      ]);
      // Raised center spine
      poly(a,  [[-3,-8],[3,-8],[5, 2],[3, 9],[-3, 9],[-5, 2]]);
      // Cockpit strip
      poly(hi, [[-2,-8],[2,-8],[2,-5],[-2,-5]]);
      // Wing undersurface shadow panels
      poly(dk, [[ 0, 7],[14, 7],[7, 9],[ 0,12]]);
      poly(dk, [[ 0, 7],[-14, 7],[-7, 9],[ 0,12]]);
      // Sawtooth trailing edge (stealth)
      poly(c,  [[ 0,10],[4,12],[0,14]]);
      poly(c,  [[ 0,10],[-4,12],[0,14]]);
      // Triple engine exhausts at rear
      ell(a,   -5,  9, 1.8, 1.1);
      ell(a,    0, 10, 1.8, 1.1);
      ell(a,    5,  9, 1.8, 1.1);
      ell("#ff5cf0", -5,10.8, 1.1, 0.7);
      ell("#ff5cf0",  0,11.8, 1.1, 0.7);
      ell("#ff5cf0",  5,10.8, 1.1, 0.7);
      // Panel edge lines
      seg(dk, -17, 3, -7,-7, 0.5);
      seg(dk,  17, 3,  7,-7, 0.5);
      break;
    }
    case "marauder": {
      // A-10 Warthog style: straight wings, twin turbofan pods, quad weapons
      // Straight shoulder wings (high-mounted)
      poly(c,  [[-4,-4],[-16,0],[-14, 6],[-4, 4]]);     // L wing
      poly(c,  [[ 4,-4],[ 16,0],[ 14, 6],[ 4, 4]]);     // R wing
      poly(dk, [[-8, 2],[-14, 6],[-4, 4]]);             // L shadow
      poly(dk, [[ 8, 2],[ 14, 6],[ 4, 4]]);             // R shadow
      // Small rear stabilisers
      poly(dk, [[-3, 9],[-7,14],[-4,15],[-3,12]]);
      poly(dk, [[ 3, 9],[ 7,14],[ 4,15],[ 3,12]]);
      // Boxy fuselage
      poly(c,  [[-4,-14],[4,-14],[5, 7],[4,14],[0,15],[-4,14],[-5, 7]]);
      // Wide cockpit (A-10 has big bubble canopy)
      poly(a,  [[-3,-14],[3,-14],[4,-8],[-4,-8]]);
      poly(hi, [[-2,-13],[2,-13],[3,-9],[-3,-9]]);
      // Twin engine pods mounted on rear fuselage sides (like A-10)
      poly(a,  [[-6,-2],[-8,-2],[-8, 8],[-6, 8]]);      // L engine pod
      poly(a,  [[ 6,-2],[ 8,-2],[ 8, 8],[ 6, 8]]);      // R engine pod
      ell("#aaff5c", -7, 9, 1.8, 1.2);                  // L exhaust
      ell("#aaff5c",  7, 9, 1.8, 1.2);                  // R exhaust
      // Center cannon (GAU-8 style)
      poly(dk, [[-1,-14],[1,-14],[1,-19],[-1,-19]]);
      // Wing weapon hardpoints
      poly(dk, [[-12,0],[-11,0],[-11, 5],[-12, 5]]);
      poly(dk, [[ 11,0],[ 12,0],[ 12, 5],[ 11, 5]]);
      poly(dk, [[-9, 0],[-8, 0],[-8, 4],[-9, 4]]);
      poly(dk, [[ 8, 0],[ 9, 0],[ 9, 4],[ 8, 4]]);
      // Center tail engine
      ell(a,   0, 14, 2.5, 1.5);
      ell("#aaff5c", 0, 15.5, 1.5, 1);
      break;
    }
    case "phalanx": {
      // Space carrier: wide flat deck, island superstructure, quad engines
      // Wide carrier hull
      poly(c,  [
        [ 0,-14],[ 8,-11],[ 18,-2],[ 18, 8],
        [ 8, 12],[ 0, 14],[-8, 12],[-18, 8],
        [-18,-2],[-8,-11],
      ]);
      // Deck shadow on aft halves
      poly(dk, [[ 0, 8],[18, 8],[8,12],[0,14]]);
      poly(dk, [[ 0, 8],[-18, 8],[-8,12],[0,14]]);
      // Island superstructure (command bridge — offset to starboard)
      poly(a,  [[-4,-12],[4,-12],[5, 4],[4, 9],[-4, 9],[-5, 4]]);
      poly(hi, [[-3,-11],[3,-11],[3,-7],[-3,-7]]);       // bridge glass
      // Antenna mast
      poly(c,  [[-0.5,-12],[0.5,-12],[0,-15]]);
      // Hangar bays (cyan openings on both sides)
      poly("#4ee2ff", [[-18, 1],[-16, 1],[-16, 7],[-18, 7]]);
      poly("#4ee2ff", [[ 16, 1],[ 18, 1],[ 18, 7],[ 16, 7]]);
      poly("#4ee2ff", [[-12, 2],[-10, 2],[-10, 6],[-12, 6]]);
      poly("#4ee2ff", [[ 10, 2],[ 12, 2],[ 12, 6],[ 10, 6]]);
      // Flight deck markings
      seg(dk, -6,-10, 6,-10, 0.6);
      seg(dk, -10, 2, 10, 2, 0.6);
      // Quad engine nacelles at stern
      ell(a,  -10, 12, 2.5, 1.5);
      ell(a,   -4, 13, 2.5, 1.5);
      ell(a,    4, 13, 2.5, 1.5);
      ell(a,   10, 12, 2.5, 1.5);
      ell("#4ee2ff", -10,13.8, 1.5, 0.9);
      ell("#4ee2ff",  -4,14.8, 1.5, 0.9);
      ell("#4ee2ff",   4,14.8, 1.5, 0.9);
      ell("#4ee2ff",  10,13.8, 1.5, 0.9);
      break;
    }
    case "titan": {
      // Star Destroyer style: massive axe-head wedge, layered armour, many turrets
      // Main wedge hull
      poly(c,  [
        [ 0,-18],[10,-13],[15,-4],[16, 6],
        [14, 14],[ 0, 18],[-14,14],[-16, 6],
        [-15,-4],[-10,-13],
      ]);
      // Upper hull armour plate (raised centre)
      poly(a,  [[-6,-15],[6,-15],[9, 4],[6,13],[-6,13],[-9, 4]]);
      // Command bridge glass
      poly(hi, [[-3,-14],[3,-14],[3,-10],[-3,-10]]);
      // Antenna spire
      poly(c,  [[-0.5,-18],[0.5,-18],[0,-21]]);
      // Aft hull shadow
      poly(dk, [[ 0,11],[14,14],[ 0,18],[-14,14]]);
      // Outer armour strakes
      poly(dk, [[ 9,-10],[15,-4],[16, 6],[12, 6],[11,-4],[9,-10]]);
      poly(dk, [[-9,-10],[-15,-4],[-16, 6],[-12, 6],[-11,-4],[-9,-10]]);
      // Turret emplacements (4 + 2 prow guns)
      poly(dk, [[-15, 0],[-12, 0],[-12, 5],[-15, 5]]);  // L outer turret
      poly(dk, [[ 12, 0],[ 15, 0],[ 15, 5],[ 12, 5]]);  // R outer turret
      poly(dk, [[-10,-7],[ -7,-7],[ -7,-2],[-10,-2]]);  // L inner turret
      poly(dk, [[  7,-7],[10,-7],[10,-2],[  7,-2]]);     // R inner turret
      poly(dk, [[-2,-18],[-1,-18],[-1,-13],[-2,-13]]);   // L prow gun
      poly(dk, [[ 1,-18],[ 2,-18],[ 2,-13],[ 1,-13]]);   // R prow gun
      // Quad engine banks
      ell(a,  -10, 16, 2.8, 1.6);
      ell(a,   -4, 17, 2.8, 1.6);
      ell(a,    4, 17, 2.8, 1.6);
      ell(a,   10, 16, 2.8, 1.6);
      ell("#ffd24a", -10,18, 1.6, 1);
      ell("#ffd24a",  -4,19, 1.6, 1);
      ell("#ffd24a",   4,19, 1.6, 1);
      ell("#ffd24a",  10,18, 1.6, 1);
      // Hull panel lines
      seg(dk,  0,-15, 0, 13, 0.5);
      seg(dk, -9,-10, 9,-10, 0.5);
      seg(dk, -14, 5, 14,  5, 0.5);
      break;
    }
    case "leviathan": {
      // Mega dreadnought: widest ship, 6 engines, command tower, 5 turrets
      poly(c,  [
        [ 0,-20],[8,-16],[14,-8],[18, 0],[18, 8],
        [12, 15],[0, 20],[-12,15],[-18, 8],[-18, 0],
        [-14,-8],[-8,-16],
      ]);
      poly(a,  [[-6,-17],[6,-17],[10, 4],[6,14],[-6,14],[-10, 4]]);
      poly(hi, [[-3,-16],[3,-16],[3,-11],[-3,-11]]);
      poly(c,  [[-0.5,-20],[0.5,-20],[0,-23]]);          // antenna
      poly(dk, [[0,12],[12,15],[0,20],[-12,15]]);        // aft shadow
      poly(dk, [[-5,-11],[5,-11],[6,-7],[-6,-7]]);       // forward deck
      // 5 turrets
      poly(dk, [[-17,-1],[-14,-1],[-14,5],[-17,5]]);
      poly(dk, [[ 14,-1],[ 17,-1],[ 17,5],[ 14,5]]);
      poly(dk, [[-12,-9],[-9,-9],[-9,-4],[-12,-4]]);
      poly(dk, [[  9,-9],[ 12,-9],[ 12,-4],[  9,-4]]);
      poly(dk, [[-3,-17],[-1,-17],[-1,-12],[-3,-12]]);
      poly(dk, [[ 1,-17],[ 3,-17],[ 3,-12],[ 1,-12]]);
      // 6 engine nacelles
      ell(a,  -12, 17, 2.5, 1.4);
      ell(a,   -6, 18, 2.5, 1.4);
      ell(a,    0, 19, 2.5, 1.4);
      ell(a,    6, 18, 2.5, 1.4);
      ell(a,   12, 17, 2.5, 1.4);
      ell("#ff5c6c", -12,19, 1.4, 0.9);
      ell("#ff5c6c",  -6,20, 1.4, 0.9);
      ell("#ff5c6c",   0,21, 1.4, 0.9);
      ell("#ff5c6c",   6,20, 1.4, 0.9);
      ell("#ff5c6c",  12,19, 1.4, 0.9);
      seg(dk, 0,-16, 0, 15, 0.5);
      seg(dk,-14, 5, 14, 5, 0.5);
      break;
    }
    case "specter": {
      // Phase ship: multi-layer swept wings, phase core, ghost silhouette
      // Outer ghosted wing layer
      poly(c,  [[-2,-4],[-14,-1],[-12, 6],[-2, 5]]);    // L outer
      poly(c,  [[ 2,-4],[ 14,-1],[ 12, 6],[ 2, 5]]);    // R outer
      // Mid wing layer (phase tinted)
      poly("#b06cff", [[-2,-2],[-10, 1],[-8, 7],[-2, 5]]); // L mid
      poly("#b06cff", [[ 2,-2],[ 10, 1],[ 8, 7],[ 2, 5]]); // R mid
      // Rear stabilisers
      poly(dk, [[-2, 6],[-6,11],[-3,12],[-2, 9]]);
      poly(dk, [[ 2, 6],[ 6,11],[ 3,12],[ 2, 9]]);
      // Fuselage
      poly(c,  [[0,-15],[1.8,-9],[2.5, 4],[1.5,10],[0,12],[-1.5,10],[-2.5,4],[-1.8,-9]]);
      // Phase core orb
      ell("#b06cff", 0, -2, 2.5, 2.5);
      ell("#ffffff",  0, -2, 1,   1);
      // Cockpit
      poly(a,  [[-1.5,-13],[1.5,-13],[2,-8],[-2,-8]]);
      ell(hi,  0,-11, 1, 2);
      // Phase needle nose
      poly("#b06cff", [[-0.8,-15],[0.8,-15],[0,-19]]);
      // Wing tip phase glow dots
      ell("#b06cff", -14,-0.5, 1.5, 1);
      ell("#b06cff",  14,-0.5, 1.5, 1);
      ell("#b06cff", -10, 0.5, 1.2, 0.8);
      ell("#b06cff",  10, 0.5, 1.2, 0.8);
      // Twin phase engines
      ell(a,   -2.5, 11, 1.8, 1.1);
      ell(a,    2.5, 11, 1.8, 1.1);
      ell("#b06cff", -2.5,12.5, 1, 0.7);
      ell("#b06cff",  2.5,12.5, 1, 0.7);
      break;
    }
  }
}

// ── ENEMY SPRITES ─────────────────────────────────────────────────────────
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  ctx.rotate(e.angle + Math.PI / 2);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = e.isBoss ? 18 : 8;
  if (e.isBoss) {
    // Telegraph circle
    ctx.save();
    ctx.rotate(-(e.angle + Math.PI / 2));
    ctx.strokeStyle = `rgba(255,138,78,${0.4 + 0.3 * Math.sin(state.tick * 5)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.size + 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const c = e.color;
  const dk = shadeHex(c, -0.5);
  const hi = "#ffffff";
  const s = e.size / 10;
  const t = state.tick;
  const pulse = 1 + Math.sin(t * 3.5 + e.size * 0.7) * 0.07;

  if (e.type === "scout") {
    const variant = (e.id.charCodeAt(0) + e.id.charCodeAt(e.id.length - 1)) % 3;
    if (variant === 0) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -11 * s * pulse);
      ctx.lineTo(2.5 * s, -2 * s);
      ctx.lineTo(3 * s, 7 * s);
      ctx.lineTo(0, 9 * s);
      ctx.lineTo(-3 * s, 7 * s);
      ctx.lineTo(-2.5 * s, -2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2 * s, 2 * s);
      ctx.lineTo(12 * s, -2 * s);
      ctx.lineTo(9 * s, 5 * s);
      ctx.lineTo(3 * s, 5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2 * s, 2 * s);
      ctx.lineTo(-12 * s, -2 * s);
      ctx.lineTo(-9 * s, 5 * s);
      ctx.lineTo(-3 * s, 5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(1.5 * s, 7 * s);
      ctx.lineTo(4 * s, 13 * s);
      ctx.lineTo(0, 11 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-1.5 * s, 7 * s);
      ctx.lineTo(-4 * s, 13 * s);
      ctx.lineTo(0, 11 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(0, -4 * s, 1.2 * s, 1.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 1) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -10 * s * pulse);
      ctx.lineTo(5 * s, -1 * s);
      ctx.lineTo(2.5 * s, 9 * s);
      ctx.lineTo(-2.5 * s, 9 * s);
      ctx.lineTo(-5 * s, -1 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -8 * s);
      ctx.lineTo(7 * s, 1 * s);
      ctx.lineTo(0, 3 * s);
      ctx.lineTo(-7 * s, 1 * s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hi;
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(-3 * s, 1 * s); ctx.lineTo(-10 * s, -4 * s);
      ctx.moveTo(3 * s, 1 * s); ctx.lineTo(10 * s, -4 * s);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(0, -2 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -12 * s * pulse);
      ctx.lineTo(4 * s, -4 * s);
      ctx.lineTo(6 * s, 4 * s);
      ctx.lineTo(0, 11 * s);
      ctx.lineTo(-6 * s, 4 * s);
      ctx.lineTo(-4 * s, -4 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -6 * s);
      ctx.lineTo(8 * s, -1 * s);
      ctx.lineTo(0, 2 * s);
      ctx.lineTo(-8 * s, -1 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(0, -3 * s, 1 * s, 2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (e.type === "raider") {
    const variant = (e.id.charCodeAt(0) + e.id.charCodeAt(e.id.length - 1)) % 3;
    if (variant === 0) {
      const swing = Math.sin(t * 4 + e.size) * s * 0.4;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -7 * s * pulse);
      ctx.quadraticCurveTo(14 * s, -5 * s, 13 * s, 2 * s);
      ctx.quadraticCurveTo(8 * s, 6 * s, 0, 5 * s);
      ctx.quadraticCurveTo(-8 * s, 6 * s, -13 * s, 2 * s);
      ctx.quadraticCurveTo(-14 * s, -5 * s, 0, -7 * s);
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -7 * s);
      ctx.lineTo(2.5 * s, -13 * s + swing);
      ctx.lineTo(-2.5 * s, -13 * s + swing);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.ellipse(9 * s, 3 * s, 3.5 * s, 2 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-9 * s, 3 * s, 3.5 * s, 2 * s, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6 + e.size);
      ctx.beginPath();
      ctx.ellipse(9 * s, 5.5 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-9 * s, 5.5 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.rect(-5 * s, -8.5 * s, 10 * s, 1.2 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -3 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 1) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -6 * s * pulse);
      ctx.quadraticCurveTo(16 * s, -4 * s, 14 * s, 4 * s);
      ctx.quadraticCurveTo(8 * s, 10 * s, 0, 7 * s);
      ctx.quadraticCurveTo(-8 * s, 10 * s, -14 * s, 4 * s);
      ctx.quadraticCurveTo(-16 * s, -4 * s, 0, -6 * s);
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -8 * s);
      ctx.lineTo(0, -16 * s);
      ctx.lineTo(4 * s, -10 * s);
      ctx.lineTo(0, -8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.rect(-11 * s, 1 * s, 22 * s, 3 * s);
      ctx.fill();
      ctx.strokeStyle = hi;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(-11 * s, 2.5 * s); ctx.lineTo(-16 * s, 1 * s);
      ctx.moveTo(11 * s, 2.5 * s); ctx.lineTo(16 * s, 1 * s);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(0, -1.5 * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -8 * s * pulse);
      ctx.lineTo(10 * s, -4 * s);
      ctx.lineTo(15 * s, 2 * s);
      ctx.lineTo(10 * s, 7 * s);
      ctx.lineTo(0, 4 * s);
      ctx.lineTo(-10 * s, 7 * s);
      ctx.lineTo(-15 * s, 2 * s);
      ctx.lineTo(-10 * s, -4 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -8 * s);
      ctx.lineTo(4 * s, -14 * s);
      ctx.lineTo(0, -11 * s);
      ctx.lineTo(-4 * s, -14 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(0, -1 * s, 2 * s, 1.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (e.type === "destroyer") {
    const variant = (e.id.charCodeAt(0) + e.id.charCodeAt(e.id.length - 1)) % 3;
    if (variant === 0) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -14 * s * pulse);
      ctx.lineTo(10 * s, -9 * s);
      ctx.lineTo(13 * s, 2 * s);
      ctx.lineTo(7 * s, 11 * s);
      ctx.lineTo(-7 * s, 11 * s);
      ctx.lineTo(-13 * s, 2 * s);
      ctx.lineTo(-10 * s, -9 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(10 * s, -9 * s);
      ctx.lineTo(18 * s, -6 * s);
      ctx.lineTo(16 * s, 2 * s);
      ctx.lineTo(13 * s, 2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10 * s, -9 * s);
      ctx.lineTo(-18 * s, -6 * s);
      ctx.lineTo(-16 * s, 2 * s);
      ctx.lineTo(-13 * s, 2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(16 * s, -6 * s);
      ctx.lineTo(21 * s, -10 * s);
      ctx.lineTo(20 * s, -3 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-16 * s, -6 * s);
      ctx.lineTo(-21 * s, -10 * s);
      ctx.lineTo(-20 * s, -3 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.ellipse(0, -2 * s, 4 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(0, -4 * s, 2 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, -4 * s, 0.8 * s, 1.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 1) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -12 * s * pulse);
      ctx.lineTo(12 * s, -6 * s);
      ctx.lineTo(15 * s, 1 * s);
      ctx.lineTo(12 * s, 10 * s);
      ctx.lineTo(0, 13 * s);
      ctx.lineTo(-12 * s, 10 * s);
      ctx.lineTo(-15 * s, 1 * s);
      ctx.lineTo(-12 * s, -6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.ellipse(0, -1 * s, 5 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.rect(-17 * s, -1 * s, 8 * s, 4 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.rect(9 * s, -1 * s, 8 * s, 4 * s);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(0, -3 * s, 1.6 * s, 2.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -10 * s * pulse);
      ctx.quadraticCurveTo(15 * s, -10 * s, 18 * s, -1 * s);
      ctx.quadraticCurveTo(15 * s, 9 * s, 0, 7 * s);
      ctx.quadraticCurveTo(-15 * s, 9 * s, -18 * s, -1 * s);
      ctx.quadraticCurveTo(-15 * s, -10 * s, 0, -10 * s);
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.lineTo(0, -17 * s);
      ctx.lineTo(5 * s, -13 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 1 * s, 7 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(0, -2 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (e.type === "voidling") {
    const variant = (e.id.charCodeAt(0) + e.id.charCodeAt(e.id.length - 1)) % 3;
    if (variant === 0) {
      const wave = Math.sin(t * 3 + e.size);
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(0, -2 * s, 9 * s * pulse, Math.PI, 0);
      ctx.quadraticCurveTo(9 * s, 4 * s, 5 * s, 6 * s);
      ctx.quadraticCurveTo(0, 8 * s, -5 * s, 6 * s);
      ctx.quadraticCurveTo(-9 * s, 4 * s, -9 * s, -2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = hi;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(0, -3 * s, 5.5 * s, Math.PI, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(0, -2 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, -2 * s, 1.4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(0, -2 * s, 0.6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      const tenX = [-6, -3.5, -1, 1, 3.5, 6];
      for (let i = 0; i < tenX.length; i++) {
        const ox = tenX[i] * s;
        const wv = Math.sin(t * 4 + i * 1.1) * 3 * s;
        ctx.beginPath();
        ctx.moveTo(ox, 6 * s);
        ctx.quadraticCurveTo(ox + wv, 11 * s, ox + wv * 0.5, 16 * s);
        ctx.stroke();
      }
    } else if (variant === 1) {
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -8 * s * pulse);
      ctx.quadraticCurveTo(12 * s, -6 * s, 11 * s, 4 * s);
      ctx.quadraticCurveTo(6 * s, 12 * s, 0, 10 * s);
      ctx.quadraticCurveTo(-6 * s, 12 * s, -11 * s, 4 * s);
      ctx.quadraticCurveTo(-12 * s, -6 * s, 0, -8 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = hi;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(0, -2 * s, 6 * s, Math.PI, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(0, -1.5 * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(0, -1.5 * s, 0.8 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 4; i++) {
        const ox = (i - 1.5) * 4 * s;
        const wv = Math.sin(t * 3.5 + i) * 2 * s;
        ctx.beginPath();
        ctx.moveTo(ox, 7 * s);
        ctx.quadraticCurveTo(ox + wv, 12 * s, ox + wv * 0.5, 18 * s);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(0, -2 * s, 10 * s * pulse, Math.PI, 0);
      ctx.quadraticCurveTo(10 * s, 5 * s, 7 * s, 9 * s);
      ctx.quadraticCurveTo(0, 13 * s, -7 * s, 9 * s);
      ctx.quadraticCurveTo(-10 * s, 5 * s, -10 * s, -2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.arc(0, -1 * s, 5 * s, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(0, -2 * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.1;
      const tenX = [-8, -4, 0, 4, 8];
      for (let i = 0; i < tenX.length; i++) {
        const ox = tenX[i] * s;
        const wv = Math.sin(t * 5 + i * 0.7) * 2.5 * s;
        ctx.beginPath();
        ctx.moveTo(ox, 7 * s);
        ctx.quadraticCurveTo(ox + wv, 13 * s, ox + wv * 0.6, 19 * s);
        ctx.stroke();
      }
    }

  } else {
    const variant = (e.id.charCodeAt(0) + e.id.charCodeAt(e.id.length - 1)) % 3;
    if (variant === 0) {
      const breathe = 1 + Math.sin(t * 2 + e.size * 0.3) * 0.04;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -18 * s * breathe);
      ctx.quadraticCurveTo(8 * s, -16 * s, 10 * s, -8 * s);
      ctx.lineTo(12 * s, 2 * s);
      ctx.lineTo(9 * s, 14 * s);
      ctx.lineTo(0, 17 * s);
      ctx.lineTo(-9 * s, 14 * s);
      ctx.lineTo(-12 * s, 2 * s);
      ctx.lineTo(-10 * s, -8 * s);
      ctx.quadraticCurveTo(-8 * s, -16 * s, 0, -18 * s);
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(10 * s, -8 * s);
      ctx.lineTo(20 * s, -12 * s);
      ctx.lineTo(22 * s, 4 * s);
      ctx.lineTo(12 * s, 6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10 * s, -8 * s);
      ctx.lineTo(-20 * s, -12 * s);
      ctx.lineTo(-22 * s, 4 * s);
      ctx.lineTo(-12 * s, 6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shadeHex(c, -0.25);
      ctx.beginPath();
      ctx.moveTo(12 * s, -3 * s);
      ctx.lineTo(26 * s, -5 * s);
      ctx.lineTo(24 * s, 2 * s);
      ctx.lineTo(12 * s, 2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-12 * s, -3 * s);
      ctx.lineTo(-26 * s, -5 * s);
      ctx.lineTo(-24 * s, 2 * s);
      ctx.lineTo(-12 * s, 2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(7 * s, 12 * s);
      ctx.lineTo(14 * s, 20 * s);
      ctx.lineTo(2 * s, 17 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-7 * s, 12 * s);
      ctx.lineTo(-14 * s, 20 * s);
      ctx.lineTo(-2 * s, 17 * s);
      ctx.closePath();
      ctx.fill();
      const reactorGlow = 0.7 + 0.3 * Math.sin(t * 5);
      ctx.fillStyle = "#ffcc44";
      ctx.globalAlpha = reactorGlow;
      ctx.beginPath();
      ctx.ellipse(0, -4 * s, 4.5 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(0, -5 * s, 2.5 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.rect(-3 * s, -12 * s, 6 * s, 1.5 * s);
      ctx.fill();
    } else if (variant === 1) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -16 * s * pulse);
      ctx.quadraticCurveTo(10 * s, -15 * s, 14 * s, -5 * s);
      ctx.lineTo(18 * s, 3 * s);
      ctx.lineTo(12 * s, 12 * s);
      ctx.lineTo(0, 15 * s);
      ctx.lineTo(-12 * s, 12 * s);
      ctx.lineTo(-18 * s, 3 * s);
      ctx.lineTo(-14 * s, -5 * s);
      ctx.quadraticCurveTo(-10 * s, -15 * s, 0, -16 * s);
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -14 * s);
      ctx.lineTo(5 * s, -22 * s);
      ctx.lineTo(0, -19 * s);
      ctx.lineTo(-5 * s, -22 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(13 * s, 1 * s);
      ctx.lineTo(24 * s, 0);
      ctx.lineTo(22 * s, 7 * s);
      ctx.lineTo(13 * s, 5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-13 * s, 1 * s);
      ctx.lineTo(-24 * s, 0);
      ctx.lineTo(-22 * s, 7 * s);
      ctx.lineTo(-13 * s, 5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(0, -3 * s, 3 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -15 * s * pulse);
      ctx.lineTo(11 * s, -10 * s);
      ctx.lineTo(16 * s, 0);
      ctx.lineTo(11 * s, 11 * s);
      ctx.lineTo(0, 16 * s);
      ctx.lineTo(-11 * s, 11 * s);
      ctx.lineTo(-16 * s, 0);
      ctx.lineTo(-11 * s, -10 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(0, -11 * s);
      ctx.lineTo(6 * s, -18 * s);
      ctx.lineTo(0, -15 * s);
      ctx.lineTo(-6 * s, -18 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.rect(-20 * s, -2 * s, 7 * s, 4 * s);
      ctx.fill();
      ctx.beginPath();
      ctx.rect(13 * s, -2 * s, 7 * s, 4 * s);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.arc(0, -4 * s, 2.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // hit flash overlay
  if (e.hitFlash !== undefined && e.hitFlash > 0) {
    ctx.globalAlpha = Math.min(0.55, e.hitFlash * 0.55);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // health bar above
  const barW = e.isBoss ? 64 : 28;
  drawHealthBar(ctx, e.pos.x, e.pos.y - e.size - 10, barW, e.hull / e.hullMax);
  if (e.isBoss) {
    ctx.fillStyle = "#ff8a4e";
    ctx.font = "bold 9px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText("◆ DREADNOUGHT ◆", e.pos.x, e.pos.y - e.size - 18);
    ctx.shadowBlur = 0;
  } else if (e.name) {
    ctx.fillStyle = e.color;
    ctx.font = "bold 8px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 3;
    ctx.fillText(e.name, e.pos.x, e.pos.y - e.size - 16);
    ctx.shadowBlur = 0;
  }
  // combo indicator
  if (e.combo && e.combo.stacks > 1) {
    ctx.fillStyle = "#ff5cf0";
    ctx.font = "bold 9px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff5cf0";
    ctx.shadowBlur = 4;
    ctx.fillText(`COMBO x${e.combo.stacks}`, e.pos.x, e.pos.y + e.size + 16);
    ctx.shadowBlur = 0;
  }
}

// Mini health/shield bars above ship
function drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, pct: number): void {
  const h = 3;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = pct > 0.5 ? "#5cff8a" : pct > 0.25 ? "#ffd24a" : "#ff5c6c";
  ctx.fillRect(x - w / 2, y, Math.max(0, w * pct), h);
}

function drawHullShieldBars(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  hullPct: number, shieldPct: number,
): void {
  const w = 36;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x - w / 2, y, w, 3);
  ctx.fillStyle = hullPct > 0.5 ? "#5cff8a" : hullPct > 0.25 ? "#ffd24a" : "#ff5c6c";
  ctx.fillRect(x - w / 2, y, Math.max(0, w * hullPct), 3);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x - w / 2, y + 4, w, 2);
  ctx.fillStyle = "#4ee2ff";
  ctx.fillRect(x - w / 2, y + 4, Math.max(0, w * shieldPct), 2);
}

// ── PROJECTILES ───────────────────────────────────────────────────────────
function drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile): void {
  ctx.save();
  ctx.shadowColor = pr.color;
  ctx.shadowBlur = 12;
  ctx.translate(pr.pos.x, pr.pos.y);
  ctx.rotate(Math.atan2(pr.vel.y, pr.vel.x));
  // glowing core
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-3, -1, 6, 2);
  ctx.fillStyle = pr.color;
  ctx.fillRect(-7, -pr.size / 2, 14, pr.size);
  ctx.fillStyle = pr.color;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(-10, -pr.size / 2 - 1, 20, pr.size + 2);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── PARTICLES ─────────────────────────────────────────────────────────────
function drawParticle(ctx: CanvasRenderingContext2D, pa: Particle): void {
  const a = Math.max(0, Math.min(1, pa.ttl / pa.maxTtl));
  if (pa.kind === "ring") {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = pa.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = pa.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    const r = (1 - a) * 16 + 4;
    ctx.arc(pa.pos.x, pa.pos.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (pa.kind === "trail") {
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = pa.color;
    const s = pa.size * a;
    ctx.fillRect(pa.pos.x - s / 2, pa.pos.y - s / 2, s, s);
    ctx.globalAlpha = 1;
    return;
  }
  if (pa.kind === "flash") {
    const t = 1 - a;  // 0 = just spawned, 1 = about to die
    const r = pa.size * (0.2 + t * 0.8);  // blooms outward over lifetime
    ctx.save();
    ctx.globalAlpha = a * a;  // quadratic fast fade
    const grd = ctx.createRadialGradient(pa.pos.x, pa.pos.y, 0, pa.pos.x, pa.pos.y, r);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.3, pa.color);
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(pa.pos.x, pa.pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (pa.kind === "fireball") {
    const t = 1 - a;
    const r = pa.size * (0.3 + t * 0.85);
    ctx.save();
    ctx.globalAlpha = a * 0.85;
    const grd = ctx.createRadialGradient(pa.pos.x, pa.pos.y, 0, pa.pos.x, pa.pos.y, r);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.15, "#ffffa0");
    grd.addColorStop(0.4, pa.color);
    grd.addColorStop(0.75, "#330000");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(pa.pos.x, pa.pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (pa.kind === "smoke") {
    const t = 1 - a;
    const r = pa.size * (0.4 + t * 0.9);
    ctx.save();
    ctx.globalAlpha = a * 0.45;
    ctx.fillStyle = pa.color;
    ctx.beginPath();
    ctx.arc(pa.pos.x, pa.pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (pa.kind === "debris") {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(pa.pos.x, pa.pos.y);
    ctx.rotate(pa.rot ?? 0);
    ctx.fillStyle = pa.color;
    ctx.shadowColor = pa.color;
    ctx.shadowBlur = 5;
    const s = pa.size * (0.4 + a * 0.6);
    ctx.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
    ctx.fillRect(-s * 0.4, -s, s * 0.8, s * 0.9);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = a;
  ctx.fillStyle = pa.color;
  ctx.fillRect(pa.pos.x - pa.size / 2, pa.pos.y - pa.size / 2, pa.size, pa.size);
  ctx.globalAlpha = 1;
}

// ── STATIONS ──────────────────────────────────────────────────────────────
const STATION_GLYPH: Record<string, string> = {
  hub: "✦", trade: "$", mining: "▰", military: "⚔", outpost: "□",
};
const STATION_COLOR: Record<string, string> = {
  hub: "#4ee2ff", trade: "#5cff8a", mining: "#ffd24a", military: "#ff5c6c", outpost: "#7ad8ff",
};

function drawStation(
  ctx: CanvasRenderingContext2D, x: number, y: number, name: string,
  kind: string, t: number, station?: Station,
): void {
  const accent = STATION_COLOR[kind] || "#4ee2ff";
  const factionColor = station ? FACTIONS[station.controlledBy].color : null;
  if (factionColor) {
    // outer faction ring
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = factionColor;
    ctx.shadowBlur = 24;
    ctx.strokeStyle = `${factionColor}aa`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);

  // outer landing ring (faint always)
  ctx.shadowColor = accent;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.stroke();

  // rotating struts
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = `${accent}88`;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 1.4);
  ctx.stroke();
  ctx.rotate(-t * 0.8);
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 1.6);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // station body — varies by kind
  if (kind === "hub") {
    px(ctx, -16, -16, 32, 32, "#0c2050");
    px(ctx, -10, -10, 20, 20, accent);
    px(ctx, -6, -6, 12, 12, "#0a1530");
    px(ctx, -2, -2, 4, 4, accent);
  } else if (kind === "trade") {
    // trade: hex-like cluster
    px(ctx, -14, -8, 28, 16, "#0c2050");
    px(ctx, -10, -6, 20, 12, accent);
    px(ctx, -4, -4, 8, 8, "#102a40");
    px(ctx, -8, -10, 4, 4, accent);
    px(ctx,  4, -10, 4, 4, accent);
    px(ctx, -8,  6, 4, 4, accent);
    px(ctx,  4,  6, 4, 4, accent);
  } else if (kind === "mining") {
    // refinery rectangles
    px(ctx, -16, -10, 32, 6, "#604010");
    px(ctx, -12, -4, 24, 14, accent);
    px(ctx, -4, 0, 8, 6, "#0a1530");
    px(ctx, -14, 8, 6, 4, "#604010");
    px(ctx,  8, 8, 6, 4, "#604010");
  } else if (kind === "military") {
    // fortress
    px(ctx, -14, -14, 28, 28, "#3a0810");
    px(ctx, -10, -10, 20, 20, accent);
    px(ctx, -6, -6, 12, 12, "#1a0410");
    px(ctx, -2, -2, 4, 4, "#ffffff");
    px(ctx, -16, -2, 4, 4, accent);
    px(ctx,  12, -2, 4, 4, accent);
    px(ctx, -2, -16, 4, 4, accent);
    px(ctx, -2,  12, 4, 4, accent);
  } else {
    // outpost
    px(ctx, -10, -10, 20, 20, "#0c2050");
    px(ctx, -6, -6, 12, 12, accent);
    px(ctx, -2, -2, 4, 4, "#0a1530");
  }

  ctx.restore();

  // labels
  ctx.fillStyle = "#e8f0ff";
  ctx.font = "bold 11px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 4;
  ctx.fillText(name, x, y - 64);
  ctx.fillStyle = accent;
  ctx.font = "9px 'Courier New', monospace";
  ctx.fillText(`${STATION_GLYPH[kind] || "□"} ${kind.toUpperCase()}`, x, y - 52);
  ctx.fillText("[ DOCK ]", x, y + 70);
  if (station) {
    const fc = FACTIONS[station.controlledBy];
    ctx.fillStyle = fc.color;
    ctx.font = "8px 'Courier New', monospace";
    ctx.fillText(`◆ ${fc.name.toUpperCase()}`, x, y + 82);
  }
  ctx.shadowBlur = 0;
}

// ── FLOATERS ──────────────────────────────────────────────────────────────
function drawFloater(ctx: CanvasRenderingContext2D, f: Floater): void {
  const a = Math.max(0, Math.min(1, f.ttl / f.maxTtl));
  const sz = Math.round(11 * f.scale);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `${f.bold ? "bold " : ""}${sz}px 'Courier New', monospace`;
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#000";
  ctx.fillText(f.text, f.pos.x + 1, f.pos.y + 1);
  ctx.shadowBlur = 0;
  ctx.fillStyle = f.color;
  ctx.fillText(f.text, f.pos.x, f.pos.y);
  ctx.restore();
}

function drawRift(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, name: string, t: number, active: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  const r = 36;
  // outer halo
  for (let i = 4; i > 0; i--) {
    ctx.strokeStyle = `${color}${active ? "44" : "22"}`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r + i * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // swirling triangles
  const arms = 5;
  for (let i = 0; i < arms; i++) {
    const a = (t * 1.4) + (Math.PI * 2 * i) / arms;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // core
  ctx.fillStyle = `${color}aa`;
  ctx.beginPath();
  ctx.arc(0, 0, 18 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  // label
  ctx.font = "bold 10px 'Courier New', monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText("▼ " + name.toUpperCase(), 0, -r - 14);
  ctx.font = "8px 'Courier New', monospace";
  ctx.fillStyle = "#aab";
  ctx.fillText(active ? "ACTIVE" : "DUNGEON RIFT", 0, r + 18);
  ctx.restore();
}

function drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, toName: string, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t);
  for (let i = 0; i < 3; i++) {
    ctx.shadowColor = "#ff5cf0";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = `rgba(255, 92, 240, ${0.7 - i * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + i * 8, 0, Math.PI * 1.4);
    ctx.stroke();
  }
  ctx.rotate(-t * 2.3);
  ctx.strokeStyle = "rgba(78, 226, 255, 0.6)";
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 1.7);
  ctx.stroke();
  ctx.fillStyle = "#1a0530";
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#ff5cf0";
  ctx.font = "bold 10px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 4;
  ctx.fillText(`▶ ${toName}`, x, y - 50);
  ctx.shadowBlur = 0;
}

// ── ASTEROIDS ─────────────────────────────────────────────────────────────
function drawAsteroid(ctx: CanvasRenderingContext2D, a: Asteroid): void {
  ctx.save();
  ctx.translate(a.pos.x, a.pos.y);
  ctx.rotate(a.rotation);
  const isLumen = a.yields === "lumenite";
  const c = isLumen ? "#7ad8ff" : "#a8784a";
  const dk = isLumen ? "#3a78a8" : "#604028";
  const lt = isLumen ? "#cdeaff" : "#d8a888";
  const s = a.size / 18;
  px(ctx, -10*s, -8*s, 20*s, 16*s, c);
  px(ctx, -8*s, -10*s, 14*s, 4*s, c);
  px(ctx, -6*s, 8*s, 14*s, 4*s, c);
  px(ctx, -12*s, -4*s, 4*s, 8*s, dk);
  px(ctx,  10*s, -4*s, 4*s, 8*s, dk);
  px(ctx, -4*s, -4*s, 6*s, 6*s, lt);
  if (isLumen) {
    px(ctx, -2*s, -2*s, 2*s, 2*s, "#ffffff");
    px(ctx, 2*s, 2*s, 2*s, 2*s, "#ffffff");
  } else {
    px(ctx, -2*s, -2*s, 2*s, 2*s, dk);
    px(ctx, 4*s, 2*s, 2*s, 2*s, dk);
  }
  ctx.restore();

  if (a.hp < a.hpMax) {
    drawHealthBar(ctx, a.pos.x, a.pos.y - a.size - 8, 24, a.hp / a.hpMax);
  }
}

// ── DRONES ────────────────────────────────────────────────────────────────
function drawDrone(ctx: CanvasRenderingContext2D, d: Drone): void {
  const anchor = (d as Drone & { anchor?: { x: number; y: number } }).anchor;
  if (!anchor) return;
  const def = DRONE_DEFS[d.kind];
  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.shadowColor = def.color;
  ctx.shadowBlur = 8;
  // small chevron drone
  px(ctx, -1, -4, 2, 2, def.color);
  px(ctx, -3, -2, 6, 2, def.color);
  px(ctx, -4, 0, 8, 2, def.color);
  px(ctx, -3, 2, 6, 2, shadeHex(def.color, -0.4));
  px(ctx, -1, -1, 2, 1, "#ffffff");
  ctx.restore();

  if (d.hp < d.hpMax) {
    drawHealthBar(ctx, anchor.x, anchor.y - 10, 18, d.hp / d.hpMax);
  }
}

// ── OTHER PLAYERS ─────────────────────────────────────────────────────────
function drawOtherPlayer(ctx: CanvasRenderingContext2D, o: OtherPlayer): void {
  drawShip(ctx, o.pos.x, o.pos.y, o.angle, o.shipClass, 0.85);
  ctx.fillStyle = o.inParty ? "#5cff8a" : "#8a9ac8";
  ctx.font = "9px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 3;
  ctx.fillText(`${o.name} [${o.level}]`, o.pos.x, o.pos.y - 22);
  if (o.clan) {
    ctx.fillStyle = "#4ee2ff";
    ctx.font = "8px 'Courier New', monospace";
    ctx.fillText(`<${o.clan}>`, o.pos.x, o.pos.y - 32);
  }
  ctx.shadowBlur = 0;
}

// ── MAIN RENDER ───────────────────────────────────────────────────────────
export function render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (lastZone !== state.player.zone) {
    regenNebula(state.player.zone);
    lastZone = state.player.zone;
  }
  const z = ZONES[state.player.zone];
  const cam = state.player.pos;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, z.bgHueA);
  grad.addColorStop(1, z.bgHueB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Distant nebulae
  for (const n of nebulaSeed) {
    const sx = w / 2 + (n.x - cam.x * 0.05);
    const sy = h / 2 + (n.y - cam.y * 0.05);
    if (sx < -n.r || sx > w + n.r || sy < -n.r || sy > h + n.r) continue;
    const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, n.r);
    rg.addColorStop(0, n.c + "55");
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(sx, sy, n.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stars (parallax)
  for (let li = 0; li < stars.length; li++) {
    const layer = stars[li];
    const sp = STAR_LAYERS[li].speed;
    for (const s of layer) {
      const sx = ((s.x - cam.x * sp) % w + w * 1.5) % w;
      const sy = ((s.y - cam.y * sp) % h + h * 1.5) % h;
      ctx.fillStyle = s.color;
      ctx.fillRect(sx, sy, s.size, s.size);
    }
  }

  // World transform (with camera shake)
  ctx.save();
  let sx = 0, sy = 0;
  if (state.cameraShake > 0) {
    // Max offset: boss=±8 px, large nearby=±2.6 px, small nearby=±1.3 px
    const m = state.cameraShake * 16;
    sx = (Math.random() - 0.5) * m;
    sy = (Math.random() - 0.5) * m;
  }
  ctx.translate(w / 2 - cam.x + sx, h / 2 - cam.y + sy);

  // Map boundary
  ctx.strokeStyle = "rgba(78, 226, 255, 0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, MAP_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Trail particles draw FIRST (behind ship)
  for (const pa of state.particles) {
    if (pa.kind === "trail" || pa.kind === "engine") drawParticle(ctx, pa);
  }

  // Asteroids
  for (const a of state.asteroids) {
    if (a.zone !== state.player.zone) continue;
    drawAsteroid(ctx, a);
  }

  // Stations
  for (const st of STATIONS) {
    if (st.zone !== state.player.zone) continue;
    drawStation(ctx, st.pos.x, st.pos.y, st.name, st.kind, state.tick, st);
  }

  // Portals
  for (const po of PORTALS) {
    if (po.fromZone !== state.player.zone) continue;
    drawPortal(ctx, po.pos.x, po.pos.y, ZONES[po.toZone].name, state.tick);
  }

  // Dungeon rifts
  for (const d of Object.values(DUNGEONS)) {
    if (d.zone !== state.player.zone) continue;
    drawRift(ctx, d.pos.x, d.pos.y, d.color, d.name, state.tick, state.dungeon?.id === d.id);
  }

  // Other players
  for (const o of state.others) drawOtherPlayer(ctx, o);

  // Enemies
  for (const e of state.enemies) drawEnemy(ctx, e);

  // Projectiles
  for (const pr of state.projectiles) drawProjectile(ctx, pr);

  // Other particles (sparks, rings)
  for (const pa of state.particles) {
    if (pa.kind !== "trail" && pa.kind !== "engine") drawParticle(ctx, pa);
  }

  // Player drones
  for (const d of state.player.drones) drawDrone(ctx, d);

  // Mining laser beam (player → target asteroid)
  if (state.miningTargetId) {
    const ta = state.asteroids.find((a) => a.id === state.miningTargetId);
    if (ta) {
      const pp = state.player.pos;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(state.tick * 18));
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#44ffcc";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 14;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      // Inner hot core
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.globalAlpha = pulse * 0.7;
      ctx.beginPath();
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      state.miningTargetId = null;  // asteroid gone, clear
    }
  }

  // Player ship
  const p = state.player;
  // shield ring when shield > 0
  if (p.shield > 0) {
    ctx.strokeStyle = `rgba(78, 226, 255, ${0.3 + 0.3 * Math.sin(state.tick * 4)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (state.playerRespawnTimer <= 0) {
    drawShip(ctx, p.pos.x, p.pos.y, p.angle, p.shipClass, 1, true);
    // mini hull/shield bars over player ship
    const cls = SHIP_CLASSES[p.shipClass];
    // include drone bonuses
    let hullMax = cls.hullMax, shieldMax = cls.shieldMax;
    for (const dr of p.drones) {
      hullMax += DRONE_DEFS[dr.kind].hullBonus;
      shieldMax += DRONE_DEFS[dr.kind].shieldBonus;
    }
    drawHullShieldBars(
      ctx, p.pos.x, p.pos.y - 26,
      Math.max(0, p.hull / hullMax),
      Math.max(0, p.shield / shieldMax),
    );
  }

  // Move target indicator
  const dx = state.cameraTarget.x - p.pos.x;
  const dy = state.cameraTarget.y - p.pos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 20) {
    const t = state.cameraTarget;
    ctx.strokeStyle = "rgba(78, 226, 255, 0.6)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(t.x - 14, t.y);
    ctx.lineTo(t.x + 14, t.y);
    ctx.moveTo(t.x, t.y - 14);
    ctx.lineTo(t.x, t.y + 14);
    ctx.stroke();
  }

  // Floating honor numbers near player
  ctx.font = "bold 10px 'Courier New', monospace";
  ctx.textAlign = "center";
  let hi = 0;
  for (const honor of state.recentHonor) {
    const a = honor.ttl / 1.4;
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ff5cf0";
    ctx.shadowColor = "#ff5cf0";
    ctx.shadowBlur = 6;
    ctx.fillText(`+${honor.amount} ✪`, p.pos.x, p.pos.y - 50 - hi * 12 - (1 - a) * 24);
    hi++;
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Floaters (damage/xp/credits text)
  for (const f of state.floaters) drawFloater(ctx, f);

  ctx.restore();

  // ── Player death flash overlay (screen space) ───────────────────────
  if (state.playerDeathFlash > 0) {
    const t = state.playerDeathFlash / 0.6;
    ctx.save();
    ctx.globalAlpha = t * 0.72;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = t * 0.55;
    ctx.fillStyle = "#ff1a1a";
    ctx.fillRect(0, 0, w, h);
    if (t > 0.5) {
      ctx.globalAlpha = (t - 0.5) * 2 * t;
      ctx.fillStyle = `rgba(255, 80, 30, ${(t - 0.5) * 2})`;
      ctx.font = `bold 42px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#ff3300";
      ctx.shadowBlur = 40;
      ctx.fillStyle = `rgba(255, 255, 255, ${(t - 0.5) * 2 * 0.9})`;
      ctx.fillText("SHIP DESTROYED", w / 2, h / 2);
    }
    ctx.restore();
  }

  // ── Level-up flourish overlay (screen space) ────────────────────────
  if (state.levelUpFlash > 0) {
    const t = state.levelUpFlash / 1.6;
    ctx.save();
    // shockwave ring centered on player
    const cx = w / 2 + sx;
    const cy = h / 2 + sy;
    const ringR = (1 - t) * 280;
    ctx.globalAlpha = t;
    ctx.strokeStyle = "#ffd24a";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#ffd24a";
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#ff5cf0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    // banner
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#000";
    ctx.fillStyle = `rgba(255, 210, 74, ${t})`;
    ctx.font = `bold ${Math.round(34 + (1 - t) * 14)}px 'Courier New', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("LEVEL UP", cx, cy - 80);
    ctx.fillStyle = `rgba(255, 92, 240, ${t})`;
    ctx.font = "bold 12px 'Courier New', monospace";
    ctx.fillText(`+1 SKILL POINT`, cx, cy - 56);
    ctx.restore();
  }
}
