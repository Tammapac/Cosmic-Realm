// Hotbar + flanking circular status displays — Section 1 of the UIEXAMPLE2 HUD.
// Reconstructed in PixiJS Graphics to match the screenshot at 1366×768.
//
// Design-space layout (measured from UIEXAMPLE2, 1366×768 coordinate system):
//   left shield circle : center (385, 695) r 57   (cyan, segmented ring, glow)
//   hotbar frame       : (449, 641) 492×108        (crest, dual bar, 8 slots)
//   right hull  circle : center (1002, 695) r 57   (red)
// Live values (HP/shield fill, %, slot icons, cooldowns) are drawn by update();
// nothing dynamic is baked into the static frame.

import * as PIXI from "pixi.js";
import { HudTransform, toScreen } from "../hudLayout";
import { HudSection } from "../hudManager";
import { state } from "../../store";
import { effectiveStats } from "../../loop";

// ── design-space geometry ────────────────────────────────────────────────────
const HB = { x: 449, y: 641, w: 492, h: 108 };
const SHIELD_C = { cx: 385, cy: 697, r: 57 };
const HULL_C = { cx: 1002, cy: 697, r: 57 };
const N_SLOTS = 8;
const BAR = { x: HB.x + 40, y: HB.y + 22, w: HB.w - 78, h: 15 };
const SLOT = { y: HB.y + 46, size: 44, gap: 6, x0: HB.x + 30 };
const SLOT_PITCH = (HB.w - 60) / N_SLOTS;

// ── palette (from the screenshot) ────────────────────────────────────────────
const C = {
  ink: 0x05070c,
  gunDark: 0x1a2436,
  gunMid: 0x2c3a52,
  gunLite: 0x4a5c78,
  gunHi: 0x8a9ab4,
  gold: 0xf5c451,
  goldDim: 0x9a7326,
  cyan: 0x3fd8ff,
  cyanDim: 0x1c6f8c,
  green: 0x5cff8a,
  red: 0xff4d5e,
  redDim: 0x8a2030,
  slotBg: 0x0e1626,
  navy: 0x0a1220,
};

function hx(g: PIXI.Graphics) { return g; }

/** Draw a chamfered/beveled gunmetal panel (the hotbar housing look). */
function drawHotbarFrame(g: PIXI.Graphics) {
  const { w, h } = HB;
  const cut = 14;
  const pts = [
    cut, 0, w - cut, 0, w, cut, w, h - cut, w - cut, h, cut, h, 0, h - cut, 0, cut,
  ];
  // ink silhouette
  g.beginFill(C.ink); g.drawPolygon(pts); g.endFill();
  // raised bevel (lighter top/left)
  g.beginFill(C.gunLite); g.drawPolygon(pts.map((v, i) => (i % 2 ? v : v))); g.endFill();
  // main face inset
  const inset = 3;
  const ip = [
    cut, inset, w - cut, inset, w - inset, cut, w - inset, h - cut, w - cut, h - inset,
    cut, h - inset, inset, h - cut, inset, cut,
  ];
  g.beginFill(C.gunMid); g.drawPolygon(ip); g.endFill();
  // top crest decoration (raised center block with the "V" chevrons)
  const cxm = w / 2;
  g.beginFill(C.gunLite);
  g.drawPolygon([cxm - 60, -6, cxm + 60, -6, cxm + 74, 12, cxm - 74, 12]);
  g.endFill();
  g.beginFill(C.gunHi);
  g.drawPolygon([cxm - 54, -4, cxm + 54, -4, cxm + 64, 8, cxm - 64, 8]);
  g.endFill();
  // chevron notch
  g.lineStyle(2, C.gunDark);
  g.moveTo(cxm - 14, 10); g.lineTo(cxm, 20); g.lineTo(cxm + 14, 10);
  g.lineStyle(0);
  // cyan center gem on the crest
  g.beginFill(C.cyan, 0.9); g.drawCircle(cxm, 4, 3.5); g.endFill();
  // gold trim line inset from the edge
  g.lineStyle(2, C.goldDim, 0.9);
  g.drawPolygon(ip);
  g.lineStyle(0);
  // corner rivets
  for (const [rx, ry] of [[cut + 3, cut - 2], [w - cut - 3, cut - 2], [cut + 3, h - cut + 2], [w - cut - 3, h - cut + 2]]) {
    g.beginFill(C.gold); g.drawCircle(rx, ry, 2.2); g.endFill();
  }
}

/** Static parts of a circular status display (ring, segments, glow ring, badge). */
function drawStatusRing(g: PIXI.Graphics, r: number, accent: number, accentDim: number) {
  // outer gunmetal ring
  g.lineStyle(6, C.gunMid); g.drawCircle(0, 0, r);
  g.lineStyle(3, C.gunHi, 0.8); g.drawCircle(0, 0, r - 3);
  // segmented mechanical ring (short ticks around)
  const segs = 32;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const inR = r - 10, outR = r - 4;
    g.lineStyle(2, i % 4 === 0 ? accent : C.gunLite, i % 4 === 0 ? 0.9 : 0.5);
    g.moveTo(Math.cos(a) * inR, Math.sin(a) * inR);
    g.lineTo(Math.cos(a) * outR, Math.sin(a) * outR);
  }
  // inner accent energy ring
  g.lineStyle(3, accent, 0.95); g.drawCircle(0, 0, r - 14);
  g.lineStyle(0);
  // dark inner disc (value area)
  g.beginFill(C.navy, 0.92); g.drawCircle(0, 0, r - 17); g.endFill();
  // top shield-badge nub
  g.beginFill(C.gunLite); g.drawPolygon([-9, -r - 2, 9, -r - 2, 6, -r + 8, -6, -r + 8]); g.endFill();
  g.beginFill(accent, 0.8); g.drawCircle(0, -r + 2, 3); g.endFill();
  // side rivets (left/right)
  for (const sx of [-1, 1]) { g.beginFill(C.gold); g.drawCircle(sx * (r - 2), 0, 2.5); g.endFill(); }
}

export class HotbarSection implements HudSection {
  container: PIXI.Container;
  private frameG: PIXI.Graphics;
  private barG: PIXI.Graphics;
  private slotsG: PIXI.Graphics;
  private shieldRingG: PIXI.Graphics;
  private hullRingG: PIXI.Graphics;
  private shieldFillG: PIXI.Graphics;
  private hullFillG: PIXI.Graphics;
  private shieldText: PIXI.Text;
  private shieldLabel: PIXI.Text;
  private hullText: PIXI.Text;
  private hullLabel: PIXI.Text;
  private numLabels: PIXI.Text[] = [];
  private lastScale = -1;

  constructor() {
    this.container = new PIXI.Container();
    this.container.name = "hotbar-section";

    // static frame
    this.frameG = new PIXI.Graphics();
    drawHotbarFrame(this.frameG);
    this.container.addChild(this.frameG);

    // dynamic bar (HP green + shield cyan)
    this.barG = new PIXI.Graphics();
    this.container.addChild(this.barG);

    // slots (static cells + dynamic content drawn together each frame is fine,
    // but the cell frames are static → draw once)
    this.slotsG = new PIXI.Graphics();
    this.container.addChild(this.slotsG);

    // number labels 1..8
    for (let i = 0; i < N_SLOTS; i++) {
      const t = new PIXI.Text(String(i + 1), { fontFamily: "var(--font-display), monospace", fontSize: 12, fill: 0xbfd0e8 });
      t.anchor.set(0.5, 0);
      this.numLabels.push(t);
      this.container.addChild(t);
    }

    // circular displays
    this.shieldRingG = new PIXI.Graphics(); drawStatusRing(this.shieldRingG, SHIELD_C.r, C.cyan, C.cyanDim);
    this.hullRingG = new PIXI.Graphics(); drawStatusRing(this.hullRingG, HULL_C.r, C.red, C.redDim);
    this.shieldFillG = new PIXI.Graphics();
    this.hullFillG = new PIXI.Graphics();
    this.container.addChild(this.shieldRingG, this.shieldFillG, this.hullRingG, this.hullFillG);

    const mk = (color: number, size: number) => new PIXI.Text("", { fontFamily: "var(--font-display), sans-serif", fontSize: size, fontWeight: "bold", fill: color, dropShadow: true, dropShadowColor: 0x000000, dropShadowBlur: 3, dropShadowDistance: 1 });
    this.shieldText = mk(C.cyan, 22); this.shieldText.anchor.set(0.5);
    this.shieldLabel = mk(C.cyan, 10); this.shieldLabel.anchor.set(0.5); this.shieldLabel.text = "SHIELD";
    this.hullText = mk(C.red, 22); this.hullText.anchor.set(0.5);
    this.hullLabel = mk(C.red, 10); this.hullLabel.anchor.set(0.5); this.hullLabel.text = "HULL";
    this.container.addChild(this.shieldText, this.shieldLabel, this.hullText, this.hullLabel);

    this.drawSlotCells();
  }

  private drawSlotCells() {
    const g = this.slotsG; g.clear();
    for (let i = 0; i < N_SLOTS; i++) {
      const x = SLOT.x0 - HB.x + i * SLOT_PITCH;
      const y = SLOT.y - HB.y;
      const s = SLOT.size;
      // beveled cell
      g.beginFill(C.ink); g.drawRoundedRect(x - 1, y - 1, s + 2, s + 2, 5); g.endFill();
      g.beginFill(C.gunLite); g.drawRoundedRect(x, y, s, s, 4); g.endFill();
      g.beginFill(C.slotBg); g.drawRoundedRect(x + 2, y + 2, s - 4, s - 4, 3); g.endFill();
      g.lineStyle(1, C.goldDim, 0.7); g.drawRoundedRect(x + 1.5, y + 1.5, s - 3, s - 3, 3); g.lineStyle(0);
      // corner rivets
      for (const [rx, ry] of [[x + 4, y + 4], [x + s - 4, y + 4], [x + 4, y + s - 4], [x + s - 4, y + s - 4]]) {
        g.beginFill(C.goldDim); g.drawCircle(rx, ry, 1.3); g.endFill();
      }
    }
  }

  update(t: HudTransform, _dt: number) {
    const es = effectiveStats();
    const player = state.player;
    const shieldPct = Math.max(0, Math.min(100, (player.shield / Math.max(1, es.shieldMax)) * 100));
    const hullPct = Math.max(0, Math.min(100, (player.hull / Math.max(1, es.hullMax)) * 100));
    const hpPct = Math.max(0, Math.min(100, (player.hull / Math.max(1, es.hullMax)) * 100));

    // position + scale the frame container
    const p = toScreen(t, HB.x, HB.y);
    this.frameG.position.set(p.x, p.y);
    this.frameG.scale.set(t.scale);
    this.barG.position.copyFrom(this.frameG.position); this.barG.scale.set(t.scale);
    this.slotsG.position.copyFrom(this.frameG.position); this.slotsG.scale.set(t.scale);

    // ── HP/shield dual bar (green left = hull, cyan right = shield) ──
    const g = this.barG; g.clear();
    const bx = BAR.x - HB.x, by = BAR.y - HB.y;
    // trough
    g.beginFill(C.ink, 0.9); g.drawRoundedRect(bx - 2, by - 2, BAR.w + 4, BAR.h + 4, 3); g.endFill();
    // gold + endcap (left) and lightning (right) markers
    g.lineStyle(2, C.gold); g.moveTo(bx - 10, by + BAR.h / 2); g.lineTo(bx - 4, by + BAR.h / 2);
    g.moveTo(bx - 7, by + BAR.h / 2 - 3); g.lineTo(bx - 7, by + BAR.h / 2 + 3); g.lineStyle(0);
    // segmented fill helper
    const drawSeg = (x0: number, wTotal: number, pct: number, color: number) => {
      const fw = (wTotal * pct) / 100;
      const seg = 5, gap = 2;
      for (let sx = 0; sx < fw; sx += seg + gap) {
        g.beginFill(color, 0.95);
        g.drawRect(x0 + sx, by, Math.min(seg, fw - sx), BAR.h);
        g.endFill();
      }
    };
    const half = BAR.w / 2;
    drawSeg(bx, half, hpPct, C.green);        // left half = hull/HP (green)
    drawSeg(bx + half, half, shieldPct, C.cyan); // right half = shield (cyan)

    // ── number labels ──
    for (let i = 0; i < N_SLOTS; i++) {
      const dx = SLOT.x0 + i * SLOT_PITCH + SLOT.size / 2;
      const dy = SLOT.y + SLOT.size + 6;
      const sp = toScreen(t, dx, dy);
      this.numLabels[i].position.set(sp.x, sp.y);
      this.numLabels[i].scale.set(t.scale);
    }

    // ── circular displays ──
    const place = (g2: PIXI.Graphics, c: { cx: number; cy: number }) => {
      const sp = toScreen(t, c.cx, c.cy); g2.position.set(sp.x, sp.y); g2.scale.set(t.scale);
    };
    place(this.shieldRingG, SHIELD_C); place(this.hullRingG, HULL_C);

    // fill arcs (accent) over the ring interior
    const drawArc = (fg: PIXI.Graphics, c: { cx: number; cy: number; r: number }, pct: number, color: number) => {
      fg.clear();
      const sp = toScreen(t, c.cx, c.cy); fg.position.set(sp.x, sp.y); fg.scale.set(t.scale);
      const rr = c.r - 14;
      const a0 = -Math.PI / 2;
      const a1 = a0 + (Math.PI * 2 * pct) / 100;
      fg.lineStyle(4, color, 1);
      fg.arc(0, 0, rr, a0, a1);
    };
    drawArc(this.shieldFillG, SHIELD_C, shieldPct, C.cyan);
    drawArc(this.hullFillG, HULL_C, hullPct, C.red);

    // center text
    const setT = (txt: PIXI.Text, c: { cx: number; cy: number }, dy: number, s: number) => {
      const sp = toScreen(t, c.cx, c.cy + dy); txt.position.set(sp.x, sp.y); txt.scale.set(t.scale * s);
    };
    this.shieldText.text = `${Math.round(shieldPct)}%`; setT(this.shieldText, SHIELD_C, -8, 1);
    setT(this.shieldLabel, SHIELD_C, 14, 1);
    this.hullText.text = `${Math.round(hullPct)}%`; setT(this.hullText, HULL_C, -8, 1);
    setT(this.hullLabel, HULL_C, 14, 1);

    this.lastScale = t.scale;
  }

  destroy() { this.container.destroy({ children: true }); }
}
