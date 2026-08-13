// armor-slot.ts — wiederverwendbare ArmorSlot-Komponente (PixiJS v8).
//
// Mechanische Fassung + extrudierte Kante + dunkle Vertiefung + Item-Sprite,
// mit Rarity-Material, Upgrade-Level, Stack, Locked-/Cooldown-Maske und den
// Zuständen hover/pressed/selected/disabled. Rarity wird NICHT nur über die
// Randfarbe gezeigt (siehe RARITY_TREATMENT). Drag-&-Drop- und Tooltip-Events
// werden emittiert; die Datenbindung erfolgt über ein schlankes SlotItem.
//
// Animierte Zustände (Epic-Reflex, Legendary-Puls/Partikel, Cooldown) laufen
// über tick(now) — vom Host-Ticker aufrufen. Verändert kein bestehendes UI.
//
// PixiJS v8.

import * as PIXI from "pixi.js";
import ArmorTokens from "../theme/armor-tokens";
import { SoundBus, PREFERS_REDUCED_MOTION } from "../sound-events";

const iconCache = new Map<string, PIXI.Texture>();
const iconWaiters = new Map<string, PIXI.Sprite[]>();
/** v8's Texture.from(url) only checks the cache — no implicit fetch like v7.
 *  Registers `sp` to receive the real texture once PIXI.Assets loads it. */
function iconTex(url: string, sp: PIXI.Sprite, onLoaded?: () => void): PIXI.Texture {
  let t = iconCache.get(url);
  if (t) return t;
  t = PIXI.Cache.has(url) ? (PIXI.Cache.get(url) as PIXI.Texture) : PIXI.Texture.EMPTY;
  iconCache.set(url, t);
  if (t === PIXI.Texture.EMPTY) {
    const waiters = iconWaiters.get(url) ?? [];
    waiters.push(sp);
    iconWaiters.set(url, waiters);
    PIXI.Assets.load(url).then((loaded: PIXI.Texture) => {
      iconCache.set(url, loaded);
      const ws = iconWaiters.get(url);
      if (ws) { for (const s of ws) if (!s.destroyed) s.texture = loaded; iconWaiters.delete(url); }
      onLoaded?.();
    });
  }
  return t;
}

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface SlotItem {
  instanceId: string;
  name: string;
  icon?: string;        // Sprite-URL (sonst Glyph)
  glyph?: string;
  rarity: Rarity;
  ilvl?: number;
  stack?: number;
  tip?: string;
}

export interface ArmorSlotOptions {
  size?: number;             // Kantenlänge (px)
  item?: SlotItem | null;
  locked?: boolean;
  disabled?: boolean;
  selected?: boolean;
  cooldown?: number;         // 0..1 (Rest-Anteil)
  interactive?: boolean;
  draggable?: boolean;
}

const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x9fb0c6, uncommon: 0x63d69a, rare: 0x4fb8ff, epic: 0xb866ff, legendary: 0xe8b94d,
};
// Materialtönung der Fassung je Rarity (nicht nur Rand!)
const RARITY_TINT: Record<Rarity, number> = {
  common: 0x1b2230, uncommon: 0x16281f, rare: 0x122636, epic: 0x231436, legendary: 0x2a2410,
};

export class ArmorSlot extends PIXI.Container {
  readonly size: number;
  private item: SlotItem | null;
  private state = { hover: false, pressed: false, selected: false, disabled: false, locked: false };
  private cooldown = 0;

  // Layer
  private face = new PIXI.Container();       // gesamte Sichtfläche — skaliert beim Pressed nach innen
  private frameG = new PIXI.Graphics();     // Fassung + extrudierte Kante
  private hoverGlow = new PIXI.Graphics();  // innerer Rahmen-Glow (folgt der Fassungskontur, kein Kreis)
  private hoverGlowMask = new PIXI.Graphics();
  private recessG = new PIXI.Graphics();     // dunkle Vertiefung
  private content = new PIXI.Container();     // Item-Sprite + Rarity-Effekte (bewegt sich bei Pressed)
  private energyLine = new PIXI.Graphics();   // Rare/Selected innere Energielinie
  private sheen = new PIXI.Graphics();        // Hover-Glanz + Epic-Reflex (maskiert)
  private sheenMask = new PIXI.Graphics();
  private gold = new PIXI.Graphics();         // Legendary-Gravur
  private particles: PIXI.Graphics[] = [];    // Legendary-Eckpartikel
  private badges = new PIXI.Container();      // ilvl + Stack
  private lockMask = new PIXI.Graphics();
  private cdMask = new PIXI.Graphics();
  private t0 = performance.now();

  constructor(o: ArmorSlotOptions = {}) {
    super();
    this.size = o.size ?? ArmorTokens.slotSize.armoryCell;
    this.item = o.item ?? null;
    this.state.selected = !!o.selected;
    this.state.disabled = !!o.disabled;
    this.state.locked = !!o.locked;
    this.cooldown = o.cooldown ?? 0;

    this.face.addChild(this.frameG, this.recessG, this.hoverGlow, this.hoverGlowMask, this.content, this.energyLine, this.gold);
    this.face.addChild(this.sheen, this.sheenMask, this.badges, this.lockMask, this.cdMask);
    this.addChild(this.face);
    this.sheen.mask = this.sheenMask;
    this.hoverGlow.mask = this.hoverGlowMask;

    if (o.interactive !== false) this.wireInteraction(!!o.draggable);
    this.redraw();
  }

  // ── öffentliche Setter (Datenbindung / Zustände) ───────────────────────────
  setItem(item: SlotItem | null): void { this.item = item; this.redraw(); }
  setSelected(v: boolean): void { this.state.selected = v; this.redraw(); }
  setDisabled(v: boolean): void { this.state.disabled = v; this.redraw(); }
  setLocked(v: boolean): void { this.state.locked = v; this.redraw(); }
  setCooldown(frac: number): void { this.cooldown = Math.max(0, Math.min(1, frac)); }

  // ── Statisches Neuzeichnen ─────────────────────────────────────────────────
  private redraw(): void {
    const s = this.size;
    const rarity = this.item?.rarity ?? "common";
    const edge = RARITY_COLOR[rarity];
    const cut = ArmorTokens.corner.slot;
    const t = ArmorTokens;

    // innerer Hover-Glow: folgt der Fassungskontur (mehrere konzentrische Rahmen-Strokes,
    // Alpha nach innen abfallend) — kein Kreis, liegt entlang des Rands, bleibt innen.
    this.hoverGlow.clear();
    const glowPasses: [number, number, number][] = [[2, 0.55, 0], [5, 0.3, 2], [9, 0.15, 5]]; // [width, alpha, inset]
    for (const [gw, ga, gi] of glowPasses) {
      this.hoverGlow.roundRect(gi, gi, s - gi * 2, s - gi * 2, Math.max(1, 4 - gi * 0.3)).stroke({ width: gw, color: edge, alpha: ga });
    }
    this.hoverGlow.blendMode = "add";
    this.hoverGlow.alpha = this.state.hover && !this.state.disabled ? 0.4 : 0; // Default korrekt setzen, falls tick() (bei ruhigen Slots) übersprungen wird
    const inset0 = 1;
    this.hoverGlowMask.clear();
    this.hoverGlowMask.roundRect(inset0, inset0, s - inset0 * 2, s - inset0 * 2, 4).fill(0xffffff);

    // extrudierte Kante (unten/rechts) + mechanische Außenfassung
    this.frameG.clear();
    const d = 4;
    this.frameG.poly([cut + d, d, s + d, d, s + d, s + d, d, s + d]).fill({ color: 0x05070d, alpha: 0.9 }); // Tiefenkante
    this.frameG.roundRect(0, 0, s, s, 4).fill({ color: RARITY_TINT[rarity] })
      .stroke({ width: 2, color: edge, alpha: this.state.disabled ? 0.4 : 0.9 });
    // heller Top/Left-Bevel, dunkler Bottom/Right
    this.frameG.moveTo(3, s - 3).lineTo(3, 3).lineTo(s - 3, 3).stroke({ width: 1.5, color: t.color.metal.sheen, alpha: 0.5 });
    this.frameG.moveTo(s - 3, 3).lineTo(s - 3, s - 3).lineTo(3, s - 3).stroke({ width: 1.5, color: 0x05070d, alpha: 0.7 });

    // dunkle innere Vertiefung
    const inset = 8;
    this.recessG.clear();
    this.recessG.roundRect(inset, inset, s - inset * 2, s - inset * 2, 3)
      .fill({ color: 0x05070d, alpha: 0.55 })
      .stroke({ width: 1, color: 0x000000, alpha: 0.6 });

    // Item-Inhalt
    this.content.removeChildren().forEach((c) => c.destroy());
    this.content.position.set(0, 0);
    if (this.item) {
      if (this.item.icon) {
        const sp = new PIXI.Sprite();
        sp.anchor.set(0.5);
        sp.position.set(s / 2, s / 2);
        const fitScale = () => {
          const sc = Math.min((s - 22) / (sp.texture.width || s), (s - 22) / (sp.texture.height || s));
          sp.scale.set(sc > 0 && isFinite(sc) ? sc : 1);
        };
        sp.texture = iconTex(this.item.icon, sp, fitScale);
        fitScale();
        this.content.addChild(sp);
      } else {
        const gl = new PIXI.Text({ text: this.item.glyph ?? "?", style: { fontFamily: "Orbitron, sans-serif", fontSize: s * 0.4, fill: edge } });
        gl.anchor.set(0.5); gl.position.set(s / 2, s / 2);
        this.content.addChild(gl);
      }
    }

    // Rarity-Behandlung (über die Randfarbe hinaus)
    this.energyLine.clear();
    this.gold.clear();
    this.particles.forEach((p) => p.destroy()); this.particles = [];

    // rare+ : innere Energielinie (bei Selected immer aktiv, s. tick)
    const showLine = rarity === "rare" || rarity === "epic" || rarity === "legendary" || this.state.selected;
    if (showLine) {
      this.energyLine.roundRect(inset + 2, inset + 2, s - (inset + 2) * 2, s - (inset + 2) * 2, 2)
        .stroke({ width: 1, color: this.state.selected ? t.color.energy.cyan : edge, alpha: 0.5 });
    }
    // legendary: goldene Gravur + Eckpartikel
    if (rarity === "legendary") {
      this.gold.moveTo(cut, 5).lineTo(s - cut, 5).stroke({ width: 1, color: 0xffe6a0, alpha: 0.7 });
      this.gold.moveTo(5, cut).lineTo(5, s - cut).stroke({ width: 1, color: 0xffe6a0, alpha: 0.4 });
      for (const [px, py] of [[6, 6], [s - 6, 6], [6, s - 6], [s - 6, s - 6]]) {
        const p = new PIXI.Graphics().circle(px, py, 1.6).fill({ color: 0xffe6a0 });
        this.particles.push(p); this.content.addChild(p);
      }
    }

    // Badges: ilvl (unten rechts) + Stack (oben rechts)
    this.badges.removeChildren().forEach((c) => c.destroy());
    if (this.item?.ilvl) this.badges.addChild(mkBadge(String(this.item.ilvl), s - 4, s - 14, "right", 0xe2d2f8));
    if (this.item?.stack && this.item.stack > 1) this.badges.addChild(mkBadge(`×${this.item.stack}`, s - 4, 2, "right", 0xffffff));

    // Locked-Maske (Schraffur + Schloss)
    this.lockMask.clear();
    if (this.state.locked) {
      this.lockMask.roundRect(0, 0, s, s, 4).fill({ color: 0x05070d, alpha: 0.66 });
      for (let i = -s; i < s; i += 8) this.lockMask.moveTo(i, 0).lineTo(i + s, s).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
    }

    // Disabled: Licht/Kontrast reduzieren
    this.alpha = this.state.disabled ? 0.5 : 1;
    (this as any).tint = this.state.disabled ? 0x99a0ad : 0xffffff;

    // Pressed: gesamte Fläche sichtbar nach innen verkleinert (Button sinkt ein)
    this.face.pivot.set(s / 2, s / 2);
    this.face.position.set(s / 2, s / 2);
    const pressScale = this.state.pressed ? 0.9 : 1;
    this.face.scale.set(pressScale);
    this.content.position.set(0, 0);
  }

  // ── Animation (Host-Ticker ruft tick(now)) ─────────────────────────────────
  tick(now = performance.now()): void {
    const rarity = this.item?.rarity ?? "common";
    // gemessen: die meisten Slots (common/uncommon/rare, nicht hover/selected, kein Cooldown)
    // haben pro Frame NICHTS Animierbares — clear()+redraw trotzdem jedes Frame ist reine
    // verschwendete Graphics-Neuberechnung. Früh raus, wenn nichts zu tun ist.
    const animates = this.state.hover || this.state.selected || this.cooldown > 0 ||
      rarity === "epic" || rarity === "legendary";
    if (!animates) return;

    const s = this.size;
    const el = now - this.t0;
    const reduced = PREFERS_REDUCED_MOTION;

    // Cooldown-Maske (radialer Wisch)
    this.cdMask.clear();
    if (this.cooldown > 0) {
      const a0 = -Math.PI / 2;
      const a1 = a0 + Math.PI * 2 * this.cooldown;
      this.cdMask.moveTo(s / 2, s / 2).arc(s / 2, s / 2, s, a0, a1).lineTo(s / 2, s / 2)
        .fill({ color: 0x05070d, alpha: 0.6 });
    }

    // Hover-Glanz + Epic-Reflex \u00fcber die gesamte Slotfl\u00e4che (bei reduced-motion statisch, kein Sweep)
    this.hoverGlow.alpha = this.state.hover && !this.state.disabled ? 0.4 : 0;
    this.sheenMask.clear();
    this.sheenMask.roundRect(3, 3, s - 6, s - 6, 3).fill(0xffffff);
    this.sheen.clear();
    if (!reduced) {
      let sheenX: number | null = null;
      if (this.state.hover && !this.state.disabled) sheenX = ((el % 500) / 500) * (s * 1.4) - s * 0.2;          // kurzer Reflex
      else if (rarity === "epic" && !this.state.disabled) sheenX = ((el % 2600) / 2600) * (s * 1.4) - s * 0.2;   // langsamer Dauerreflex
      if (sheenX !== null) {
        this.sheen.poly([sheenX, 0, sheenX + 16, 0, sheenX - 16, s, sheenX - 32, s])
          .fill({ color: 0xffffff, alpha: 0.16 });
      }
    } else if (this.state.hover && !this.state.disabled) {
      this.sheen.rect(0, 0, s, s).fill({ color: 0xffffff, alpha: 0.06 }); // statischer Glanz statt Sweep
    }

    // Legendary: langsam pulsierende Energie + Partikelflimmern (bei reduced-motion konstant)
    if (rarity === "legendary" && !this.state.disabled) {
      const pulse = reduced ? 0.6 : 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(el / 700));
      this.gold.alpha = pulse;
      this.particles.forEach((p, i) => { p.alpha = reduced ? 0.6 : 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(el / 500 + i)); });
    }

    // Selected: Energielinie pulsiert (bei reduced-motion konstant sichtbar)
    if (this.state.selected) {
      this.energyLine.alpha = reduced ? 0.9 : 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(el / 400));
    } else {
      this.energyLine.alpha = 1;
    }
  }

  // ── Interaktion + Events ────────────────────────────────────────────────────
  private wireInteraction(draggable: boolean): void {
    this.eventMode = "static";
    this.cursor = "pointer";
    const guard = () => this.state.disabled || this.state.locked;

    this.on("pointerover", (e) => { if (guard()) return; this.state.hover = true; SoundBus.emit("hover"); this.emit("slot:tooltip", { item: this.item, tip: this.item?.tip, event: e, show: true }); });
    this.on("pointerout", (e) => { this.state.hover = false; this.state.pressed = false; this.redraw(); this.emit("slot:tooltip", { show: false, event: e }); });
    this.on("pointermove", (e) => this.emit("slot:tooltipmove", { event: e }));
    this.on("pointerdown", (e) => { if (guard()) return; this.state.pressed = true; this.redraw(); SoundBus.emit("press"); if (draggable) this.emit("slot:dragstart", { item: this.item, event: e }); });
    this.on("pointerup", (e) => { if (guard()) return; this.state.pressed = false; this.redraw(); SoundBus.emit("select"); this.emit("slot:activate", { item: this.item, event: e, worldPos: this.getGlobalPosition() }); });
    this.on("pointerupoutside", () => { this.state.pressed = false; this.redraw(); });
    this.on("rightclick", (e) => { if (guard()) return; (e as any).preventDefault?.(); this.emit("slot:context", { item: this.item, event: e }); });
    if (draggable) {
      this.on("pointerupoutside", (e) => this.emit("slot:dragend", { item: this.item, event: e }));
      this.on("globalpointermove", (e) => { if (this.state.pressed) this.emit("slot:drag", { item: this.item, event: e }); });
    }
  }

  /** Listener explizit entfernen, damit destroy() keine toten Referenzen hält. */
  destroy(options?: Parameters<PIXI.Container["destroy"]>[0]): void {
    this.removeAllListeners();
    super.destroy(options);
  }
}

function mkBadge(text: string, x: number, y: number, align: "left" | "right", fill: number): PIXI.Text {
  const t = new PIXI.Text({ text, style: { fontFamily: "Chakra Petch, sans-serif", fontSize: 9, fontWeight: "700", fill, stroke: { color: 0x000000, width: 3 } } });
  t.anchor.set(align === "right" ? 1 : 0, 0);
  t.position.set(x, y);
  return t;
}

// gleichmäßiger, weicher Radial-Glow (Canvas-gebacken) — dieselbe Form für jede Rarity/Icon,
// nur die Tint-Farbe folgt der Randfarbe des Items.
const glowCache = new Map<number, PIXI.Texture>();
function glowTexture(color: number): PIXI.Texture {
  let t = glowCache.get(color);
  if (t) return t;
  const size = 128;
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  const hex = `#${color.toString(16).padStart(6, "0")}`;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, hex); g.addColorStop(0.4, hex); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.9; ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  t = PIXI.Texture.from(c);
  glowCache.set(color, t);
  return t;
}

export function createArmorSlot(o: ArmorSlotOptions = {}): ArmorSlot {
  return new ArmorSlot(o);
}
