import {
  Enemy,
  MAP_RADIUS,
  OtherPlayer,
  Particle,
  PORTALS,
  Projectile,
  SHIP_CLASSES,
  STATIONS,
  ShipClassId,
  ZONES,
} from "./types";
import { state } from "./store";

const STAR_LAYERS = [
  { count: 200, speed: 0.1, size: 1, color: "#3a4980" },
  { count: 120, speed: 0.3, size: 1, color: "#7a8ad8" },
  { count: 60, speed: 0.55, size: 2, color: "#e8f0ff" },
];

type Star = { x: number; y: number; size: number; color: string; speed: number };
const stars: Star[][] = STAR_LAYERS.map((layer) => {
  const arr: Star[] = [];
  for (let i = 0; i < layer.count; i++) {
    arr.push({
      x: Math.random() * 4000 - 2000,
      y: Math.random() * 4000 - 2000,
      size: layer.size,
      color: layer.color,
      speed: layer.speed,
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

function drawShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  shipClass: ShipClassId,
  scale = 1,
  glow = true,
): void {
  const cls = SHIP_CLASSES[shipClass];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  if (glow) {
    ctx.shadowColor = cls.color;
    ctx.shadowBlur = 12;
  }
  // pixel-art body — 16-bit feel via blocky shapes
  const s = scale;
  ctx.fillStyle = cls.color;
  // Hull
  if (shipClass === "skimmer") {
    ctx.beginPath();
    ctx.moveTo(0, -10 * s);
    ctx.lineTo(7 * s, 8 * s);
    ctx.lineTo(0, 4 * s);
    ctx.lineTo(-7 * s, 8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0a1230";
    ctx.fillRect(-2 * s, -3 * s, 4 * s, 6 * s);
  } else if (shipClass === "vanguard") {
    ctx.beginPath();
    ctx.moveTo(0, -12 * s);
    ctx.lineTo(10 * s, 6 * s);
    ctx.lineTo(6 * s, 10 * s);
    ctx.lineTo(-6 * s, 10 * s);
    ctx.lineTo(-10 * s, 6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0a2a14";
    ctx.fillRect(-3 * s, -4 * s, 6 * s, 8 * s);
  } else if (shipClass === "obsidian") {
    ctx.beginPath();
    ctx.moveTo(0, -14 * s);
    ctx.lineTo(12 * s, 4 * s);
    ctx.lineTo(8 * s, 12 * s);
    ctx.lineTo(-8 * s, 12 * s);
    ctx.lineTo(-12 * s, 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2a0a30";
    ctx.fillRect(-3 * s, -6 * s, 6 * s, 10 * s);
  } else {
    // titan
    ctx.fillRect(-12 * s, -10 * s, 24 * s, 20 * s);
    ctx.beginPath();
    ctx.moveTo(0, -16 * s);
    ctx.lineTo(12 * s, -10 * s);
    ctx.lineTo(-12 * s, -10 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a2a08";
    ctx.fillRect(-4 * s, -6 * s, 8 * s, 10 * s);
  }
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  ctx.rotate(e.angle + Math.PI / 2);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = e.color;
  const s = e.size / 10;
  if (e.type === "scout") {
    ctx.beginPath();
    ctx.moveTo(0, -10 * s);
    ctx.lineTo(8 * s, 8 * s);
    ctx.lineTo(-8 * s, 8 * s);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === "raider") {
    ctx.fillRect(-8 * s, -6 * s, 16 * s, 12 * s);
    ctx.fillRect(-3 * s, -10 * s, 6 * s, 4 * s);
  } else if (e.type === "destroyer") {
    ctx.beginPath();
    ctx.moveTo(0, -14 * s);
    ctx.lineTo(12 * s, 0);
    ctx.lineTo(6 * s, 12 * s);
    ctx.lineTo(-6 * s, 12 * s);
    ctx.lineTo(-12 * s, 0);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === "voidling") {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = i % 2 === 0 ? 14 * s : 7 * s;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // dread
    ctx.fillRect(-16 * s, -14 * s, 32 * s, 28 * s);
    ctx.fillStyle = "#5a3a08";
    ctx.fillRect(-8 * s, -8 * s, 16 * s, 16 * s);
  }
  ctx.restore();

  // Health bar
  const w = 28;
  const h = 4;
  const pct = e.hull / e.hullMax;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.size - 12, w, h);
  ctx.fillStyle = pct > 0.5 ? "#5cff8a" : pct > 0.25 ? "#ffd24a" : "#ff5c6c";
  ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.size - 12, w * pct, h);
}

function drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile): void {
  ctx.save();
  ctx.shadowColor = pr.color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = pr.color;
  ctx.translate(pr.pos.x, pr.pos.y);
  ctx.rotate(Math.atan2(pr.vel.y, pr.vel.x));
  ctx.fillRect(-6, -1.5, 12, 3);
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, pa: Particle): void {
  const a = Math.max(0, Math.min(1, pa.ttl / pa.maxTtl));
  ctx.globalAlpha = a;
  ctx.fillStyle = pa.color;
  ctx.fillRect(pa.pos.x - pa.size / 2, pa.pos.y - pa.size / 2, pa.size, pa.size);
  ctx.globalAlpha = 1;
}

function drawStation(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  // Outer dock ring
  ctx.shadowColor = "#4ee2ff";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = "#4ee2ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.stroke();
  // Rotating rings
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = "rgba(78, 226, 255, 0.45)";
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 1.4);
  ctx.stroke();
  ctx.rotate(-t * 0.8);
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 1.6);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Core
  ctx.fillStyle = "#0c2050";
  ctx.fillRect(-14, -14, 28, 28);
  ctx.fillStyle = "#4ee2ff";
  ctx.fillRect(-8, -8, 16, 16);
  ctx.fillStyle = "#0a1530";
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();

  ctx.fillStyle = "#e8f0ff";
  ctx.font = "bold 11px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 4;
  ctx.fillText(name, x, y - 64);
  ctx.fillStyle = "#4ee2ff";
  ctx.font = "9px 'Courier New', monospace";
  ctx.fillText("[ DOCK ]", x, y + 70);
  ctx.shadowBlur = 0;
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

  // Distant galaxy clouds (parallax)
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

  // World transform
  ctx.save();
  ctx.translate(w / 2 - cam.x, h / 2 - cam.y);

  // Map boundary
  ctx.strokeStyle = "rgba(78, 226, 255, 0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, MAP_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Stations in current zone
  for (const st of STATIONS) {
    if (st.zone !== state.player.zone) continue;
    drawStation(ctx, st.pos.x, st.pos.y, st.name, state.tick);
  }

  // Portals in current zone
  for (const po of PORTALS) {
    if (po.fromZone !== state.player.zone) continue;
    drawPortal(ctx, po.pos.x, po.pos.y, ZONES[po.toZone].name, state.tick);
  }

  // Other players
  for (const o of state.others) drawOtherPlayer(ctx, o);

  // Enemies
  for (const e of state.enemies) drawEnemy(ctx, e);

  // Projectiles
  for (const pr of state.projectiles) drawProjectile(ctx, pr);

  // Particles
  for (const pa of state.particles) drawParticle(ctx, pa);

  // Player ship
  const p = state.player;
  // Shield ring
  if (p.shield > 0) {
    ctx.strokeStyle = `rgba(78, 226, 255, ${0.3 + 0.3 * Math.sin(state.tick * 4)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawShip(ctx, p.pos.x, p.pos.y, p.angle, p.shipClass, 1, true);

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

  ctx.restore();
}
