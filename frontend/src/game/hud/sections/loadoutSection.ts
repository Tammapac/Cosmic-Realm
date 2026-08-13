// loadoutSection.ts — PixiJS-Umbau des Loadout-Screens.
//
// SCHRITT 1  Gerüst + Skalierung (hudLayout, 1366×768, als eine Einheit).
// SCHRITT 2  Store-Bindung (read-only) über loadoutBridge.
// SCHRITT 3  Interaktionsvertrag über loadoutActions (equip/unequip/sell/filter).
// SCHRITT 4  Echte Item-Sprites, Rarity-Glow, Legendär-✦, Pixi-Tooltip-Layer.
// SCHRITT 5  Motion: Boot-Scan (Öffnen), Stagger (Rebuild), Impact-Flash (Equip).
//
// Vertrag: HudSection aus ../hudManager. PixiJS v8 (Graphics .rect().fill(),
// Text({text,style})).

import * as PIXI from "pixi.js";
import type { HudSection } from "../hudManager";
import { DESIGN_W, DESIGN_H, type HudTransform } from "../hudLayout";
import { buildLoadoutSnapshot, onLoadoutChange, type LoadoutSnapshot, type LoadoutSocket, type LoadoutItem, type FilterKey } from "./loadoutBridge";
import { toggleEquipShip, unequipShipSlot, unequipDroneSlot, sellItem, canSell, makeTapRouter } from "./loadoutActions";
import { ShipChamber } from "../components/ship-chamber";
import { ArmorSlot, type Rarity as ArmorRarity, type SlotItem } from "../components/armor-slot";
import { SoundBus, PREFERS_REDUCED_MOTION } from "../sound-events";
import type { ModuleSlot, PetDroneSlot } from "../../types";

const PANEL_W = 1240;
const PANEL_H = 690;
const PANEL_X = Math.round((DESIGN_W - PANEL_W) / 2);
const PANEL_Y = Math.round((DESIGN_H - PANEL_H) / 2);
const PANEL_H_PORTRAIT_MAX = 2200; // Deckel gegen extreme Streckung bei sehr schmalen Viewports

const RAIL_W = 72;
const ASIDE_W = 300;
const HEADER_H = 92;
const PAD = 20;

const COL = {
  panelBot: 0x08060f,
  stroke: 0x2a3350,
  strokeDim: 0x1a2030,
  magenta: 0xb866ff,
  cyan: 0x4ee2ff,
  gold: 0xe8b94d,
  green: 0x5cff8a,
  textDim: 0x9db0c6,
  socketEmpty: 0x141020,
} as const;

const SLOT_COLOR: Record<string, number> = {
  weapon: 0xff5c6c, generator: 0x4ee2ff, module: 0xff5cf0, drone: 0xb866ff,
};
const HIGH_RARITY = new Set(["legendary", "relic", "celestial", "mythic"]);

// Adapter: bestehende LoadoutItem-Rarity-Strings (inkl. relic/celestial/mythic,
// die ArmorSlot nicht kennt) auf die 5 ArmorSlot-Stufen abbilden — nur Render,
// keine Logik-/Datenänderung.
function mapRarity(r: string | null): ArmorRarity {
  if (r === "epic") return "epic";
  if (r === "rare") return "rare";
  if (r === "uncommon") return "uncommon";
  if (HIGH_RARITY.has(r ?? "")) return "legendary";
  return "common";
}
function toSlotItem(item: LoadoutItem): SlotItem {
  return { instanceId: item.instanceId, name: item.name, icon: item.icon || undefined, glyph: item.glyph, rarity: mapRarity(item.rarity), ilvl: item.ilvl, tip: item.tip };
}

const hex = (s: string): number => parseInt(s.replace("#", ""), 16) || 0xb866ff;

// v8: Text nimmt ein Options-Objekt {text, style}
const mkText = (str: string, size: number, fill: number, weight: "400" | "700" = "700", spacing = 2): PIXI.Text =>
  new PIXI.Text({ text: str, style: { fontFamily: "Orbitron, sans-serif", fontSize: size, fontWeight: weight, letterSpacing: spacing, fill } });

type StatRow = { key: keyof LoadoutSnapshot["stats"]; label: string; full: string; glyph: string; fmt: (n: number) => string; group: "ATK" | "DEF" | "MOB" | "UTL"; primary: boolean };
const STATS_ROWS: StatRow[] = [
  { key: "damage", label: "Damage", full: "Damage per hit", glyph: "⚔", fmt: (n) => String(Math.round(n)), group: "ATK", primary: true },
  { key: "fireRate", label: "Fire Rate", full: "Shots per second", glyph: "▸", fmt: (n) => n.toFixed(2) + "/s", group: "ATK", primary: false },
  { key: "critChance", label: "Crit Chance", full: "Critical hit chance", glyph: "✦", fmt: (n) => `${Math.round(n * 100)}%`, group: "ATK", primary: false },
  { key: "hullMax", label: "Hull", full: "Maximum hull points", glyph: "▣", fmt: (n) => String(Math.round(n)), group: "DEF", primary: true },
  { key: "shieldMax", label: "Shield", full: "Maximum shield points", glyph: "◈", fmt: (n) => String(Math.round(n)), group: "DEF", primary: true },
  { key: "shieldRegen", label: "Regen", full: "Shield regeneration per second", glyph: "↻", fmt: (n) => `${n.toFixed(1)}/s`, group: "DEF", primary: false },
  { key: "shieldAbsorb", label: "Absorption", full: "Shield damage absorption", glyph: "◇", fmt: (n) => `${Math.round(n * 100)}%`, group: "DEF", primary: false },
  { key: "speed", label: "Speed", full: "Flight speed", glyph: "➤", fmt: (n) => String(Math.round(n)), group: "MOB", primary: true },
  { key: "damageReduction", label: "Damage Reduction", full: "Damage reduction", glyph: "⛨", fmt: (n) => `${Math.round(n * 100)}%`, group: "UTL", primary: true },
];
const STAT_GROUPS: { id: "ATK" | "DEF" | "MOB" | "UTL"; label: string; accent: number }[] = [
  { id: "ATK", label: "ATTACK", accent: 0xff5c6c },
  { id: "DEF", label: "DEFENSE", accent: 0x4ee2ff },
  { id: "MOB", label: "MOBILITY", accent: 0x5cff8a },
  { id: "UTL", label: "UTILITY", accent: 0xb866ff },
];
// max. Referenzwerte für die StatBar-Füllung (nur Anzeige, keine Berechnung geändert)
const STAT_REF: Record<string, number> = { damage: 4000, fireRate: 5, critChance: 0.5, hullMax: 12000, shieldMax: 8000, shieldRegen: 60, shieldAbsorb: 1, speed: 600, damageReduction: 0.75 };

const texCache = new Map<string, PIXI.Texture>();
const texWaiters = new Map<string, PIXI.Sprite[]>();
/** v8's Texture.from(url) only checks the cache — no implicit fetch like v7.
 *  Registers `sp` to receive the real texture once PIXI.Assets loads it. */
function tex(url: string, sp: PIXI.Sprite, onLoaded?: () => void): PIXI.Texture {
  let t = texCache.get(url);
  if (t) return t;
  t = PIXI.Cache.has(url) ? (PIXI.Cache.get(url) as PIXI.Texture) : PIXI.Texture.EMPTY;
  texCache.set(url, t);
  if (t === PIXI.Texture.EMPTY) {
    const waiters = texWaiters.get(url) ?? [];
    waiters.push(sp);
    texWaiters.set(url, waiters);
    PIXI.Assets.load(url).then((loaded: PIXI.Texture) => {
      texCache.set(url, loaded);
      const ws = texWaiters.get(url);
      if (ws) { for (const s of ws) if (!s.destroyed) s.texture = loaded; texWaiters.delete(url); }
      onLoaded?.();
    });
  }
  return t;
}

const IS_TOUCH = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

// EIN geteiltes, Canvas-gebackenes Radial-Gradient — keine BlurFilter-Instanz, keine Re-Erzeugung pro Frame/Komponente.
let pointerLightTex: PIXI.Texture | null = null;
function getPointerLightTex(): PIXI.Texture {
  if (pointerLightTex) return pointerLightTex;
  const size = 256;
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.5, "rgba(220,235,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  pointerLightTex = PIXI.Texture.from(c);
  return pointerLightTex;
}

class LoadoutSection implements HudSection {
  container: PIXI.Container;

  private dynamic: PIXI.Container;
  private fx: PIXI.Graphics;
  private tip: PIXI.Container;
  private tipBg: PIXI.Graphics;
  private tipText: PIXI.Text;
  private tipMask = new PIXI.Graphics();
  private tipScanLine = new PIXI.Graphics();
  private tipRevealStart = 0;

  private dirty = true;
  private unsub: () => void;
  private filter: FilterKey = "all";
  private taps = makeTapRouter(300);

  private wasVisible = false;
  private bootStart = 0;
  private mountStart = 0;
  private flashStart = 0;
  private equipSig = "";
  private chamber?: ShipChamber;   // persistente Diagnosekammer (Mitte)
  private armorySlots: ArmorSlot[] = [];  // ArmorSlot-Instanzen der Inventarzellen (für tick)
  private sellConfirm: { instanceId: string; name: string } | null = null; // Sell-Confirm-Modal-State (echte Aktion, keine Demo)
  private compareWith: string | null = null; // instanceId des Items, das mit dem zuletzt gewählten Sockel-Item verglichen wird

  // globale Pointer-Beleuchtung (nur Metall/Bevel-Layer, siehe rebuild→metalMaskShapes)
  private lightLayer = new PIXI.Container();
  private lightSprite = new PIXI.Sprite();
  private lightMask = new PIXI.Graphics();
  private lightTarget = { x: PANEL_W / 2, y: PANEL_H / 2 };
  private lightCurrent = { x: PANEL_W / 2, y: PANEL_H / 2 };
  private lightHoverBoost = 0;
  private touchPulseStart = 0;

  // Portrait-Layout (Handy/Tablet hochkant): eigener Fit-by-Width statt Scale-to-fit-Letterbox,
  // HUD-Header oben verankert, Panel vertikal gestreckt, damit die Inventarleiste tiefer sitzt.
  private portrait = false;
  private panelH = PANEL_H;
  private bgPanel!: PIXI.Graphics;

  // Microinteractions: begrenzte FX-Nebenläufigkeit (max. gleichzeitig aktive Pulse)
  private pulses: { x0: number; y0: number; x1: number; y1: number; start: number }[] = [];
  private readonly MAX_CONCURRENT_FX = 3;
  private prevStatVals = new Map<string, string>();
  private statFlashes = new Map<string, number>(); // key -> startTime
  private bankAnchors: Record<string, { x: number; y: number }> = {};

  constructor() {
    this.container = new PIXI.Container();
    this.container.label = "loadout-overlay"; // v8: .label statt .name
    this.container.eventMode = "static";
    this.container.visible = false;

    this.bgPanel = new PIXI.Graphics();
    this.drawPanelBg();
    this.container.addChild(this.bgPanel);

    this.dynamic = new PIXI.Container();
    this.container.addChild(this.dynamic);

    this.fx = new PIXI.Graphics();
    this.fx.eventMode = "none";
    this.container.addChild(this.fx);

    this.tip = new PIXI.Container();
    this.tip.eventMode = "none";
    this.tip.visible = false;
    this.tipBg = new PIXI.Graphics();
    this.tipText = new PIXI.Text({
      text: "",
      style: { fontFamily: "Chakra Petch, sans-serif", fontSize: 12, fill: 0xe9e2f5, wordWrap: true, wordWrapWidth: 240, lineHeight: 16 },
    });
    this.tipText.position.set(10, 8);
    this.tip.addChild(this.tipBg, this.tipText, this.tipScanLine, this.tipMask);
    this.tip.mask = this.tipMask;
    this.container.addChild(this.tip);

    // Pointer-Licht: additiv, auf Metall/Bevel maskiert, niedrige Grundintensität, folgt verzögert
    if (!IS_TOUCH) {
      this.lightSprite.texture = getPointerLightTex();
      this.lightSprite.anchor.set(0.5);
      this.lightSprite.blendMode = "add";
      this.lightLayer.addChild(this.lightSprite);
      this.lightLayer.mask = this.lightMask;
      this.lightLayer.eventMode = "none";
      this.container.addChild(this.lightLayer, this.lightMask);
      this.container.eventMode = "static";
      this.container.on("globalpointermove", (e: PIXI.FederatedPointerEvent) => {
        const p = this.container.toLocal(e.global);
        this.lightTarget.x = p.x; this.lightTarget.y = p.y;
        this.lightHoverBoost = (e.target && (e.target as unknown) !== this.container) ? 1 : 0;
      });
    } else {
      // Touch: statt Pointer-Licht ein kurzer Tap-Feedback-Puls
      this.lightSprite.texture = getPointerLightTex();
      this.lightSprite.anchor.set(0.5);
      this.lightSprite.blendMode = "add";
      this.lightSprite.alpha = 0;
      this.lightLayer.addChild(this.lightSprite);
      this.lightLayer.mask = this.lightMask;
      this.container.addChild(this.lightLayer, this.lightMask);
      this.container.eventMode = "static";
      this.container.on("pointerdown", (e: PIXI.FederatedPointerEvent) => {
        const p = this.container.toLocal(e.global);
        this.lightTarget.x = this.lightCurrent.x = p.x; this.lightTarget.y = this.lightCurrent.y = p.y;
        this.touchPulseStart = performance.now();
      });
    }

    this.unsub = onLoadoutChange(() => { this.dirty = true; });
  }

  /** Panel-Hintergrund neu zeichnen \u2014 Portrait streckt die H\u00f6he (this.panelH). */
  private drawPanelBg(): void {
    this.bgPanel.clear();
    this.bgPanel.rect(0, 0, PANEL_W, this.panelH).fill({ color: COL.panelBot, alpha: 0.96 });
    this.bgPanel.rect(0.5, 0.5, PANEL_W - 1, this.panelH - 1).stroke({ width: 1, color: COL.stroke, alpha: 0.7 });
  }

  update(t: HudTransform, _dt: number): void {
    // Viewport aus dem hudLayout-Transform ableiten (offsetX/Y = Letterbox bei zentriertem Fit).
    const vw = DESIGN_W * t.scale + 2 * t.offsetX;
    const vh = DESIGN_H * t.scale + 2 * t.offsetY;
    const nowPortrait = vh > vw * 1.15;
    const nowPanelH = nowPortrait ? Math.min(PANEL_H_PORTRAIT_MAX, Math.round(PANEL_W * (vh / vw))) : PANEL_H;
    if (nowPortrait !== this.portrait || Math.abs(nowPanelH - this.panelH) > 4) {
      this.portrait = nowPortrait;
      this.panelH = nowPanelH;
      this.drawPanelBg();
      this.dirty = true; // Layout hängt von panelH ab → bei Größenwechsel neu aufbauen
    }

    if (this.portrait) {
      // Fit-by-Width, oben verankert: HUD-Header rückt nach oben, gestrecktes Panel gibt der
      // Inventarleiste unten mehr Raum, statt in der Mitte mit riesigem Letterbox zu schweben.
      const scale = vw / PANEL_W;
      this.container.scale.set(scale);
      this.container.position.set(t.offsetX - PANEL_X * scale + Math.max(0, (vw - PANEL_W * scale) / 2), 0);
    } else {
      this.container.scale.set(t.scale);
      this.container.position.set(t.offsetX + PANEL_X * t.scale, t.offsetY + PANEL_Y * t.scale);
    }

    if (this.dirty) {
      const snap = buildLoadoutSnapshot(this.filter);
      const nowVisible = snap.visible;
      this.container.visible = nowVisible;
      if (nowVisible) {
        if (!this.wasVisible) this.bootStart = performance.now();
        const sig = snap.banks.map((b) => b.sockets.map((s) => s.instanceId ?? "-").join(",")).join("|");
        if (this.wasVisible && sig !== this.equipSig) this.flashStart = performance.now();
        this.equipSig = sig;
        this.mountStart = performance.now();
        this.rebuild(snap);
      }
      this.wasVisible = nowVisible;
      this.dirty = false;
    }

    if (this.container.visible) { this.tickMotion(); this.chamber?.tick(); this.armorySlots.forEach((s) => s.tick()); this.tickPointerLight(); this.tickTooltipReveal(); }
  }

  /** Pointer-Licht: verzögerter Follow (Lerp), niedrige Basisintensität + Hover-Boost; Touch = kurzer Tap-Puls. */
  private tickPointerLight(): void {
    if (!IS_TOUCH) {
      const followRate = PREFERS_REDUCED_MOTION ? 1 : 0.08; // reduced-motion: kein verzögertes Nachziehen
      this.lightCurrent.x += (this.lightTarget.x - this.lightCurrent.x) * followRate;
      this.lightCurrent.y += (this.lightTarget.y - this.lightCurrent.y) * followRate;
      this.lightSprite.position.set(this.lightCurrent.x, this.lightCurrent.y);
      const baseR = 220, boostR = 60;
      const r = baseR + this.lightHoverBoost * boostR;
      this.lightSprite.width = r * 2; this.lightSprite.height = r * 2;
      const baseA = 0.1, boostA = 0.08;
      this.lightSprite.alpha = baseA + this.lightHoverBoost * boostA;
    } else {
      const el = performance.now() - this.touchPulseStart;
      const dur = 380;
      if (el >= 0 && el < dur) {
        const t = el / dur;
        this.lightSprite.position.set(this.lightCurrent.x, this.lightCurrent.y);
        const r = 40 + t * 140;
        this.lightSprite.width = r * 2; this.lightSprite.height = r * 2;
        this.lightSprite.alpha = (1 - t) * 0.22;
      } else {
        this.lightSprite.alpha = 0;
      }
    }
  }

  // ── Motion (Schritt 5 + Microinteractions) ────────────────────────────────
  private tickMotion(): void {
    const now = performance.now();
    this.fx.clear();

    const m = Math.min(1, (now - this.mountStart) / 280);
    const me = 1 - Math.pow(1 - m, 3);
    this.dynamic.alpha = me;
    this.dynamic.y = (1 - me) * 10;

    const b = (now - this.bootStart) / 900;
    if (b >= 0 && b < 1) {
      const y = b * this.panelH;
      const a = Math.sin(Math.min(1, b) * Math.PI) * 0.35;
      this.fx.rect(0, y - 60, PANEL_W, 60).fill({ color: 0xd8b0ff, alpha: a });
    }

    const f = (now - this.flashStart) / 260;
    if (f >= 0 && f < 1) {
      this.fx.rect(0, 0, PANEL_W, this.panelH).fill({ color: 0xffffff, alpha: (1 - f) * 0.18 });
    }

    // Verbindungspulse Item → Ausrüstungsslot (begrenzte Anzahl gleichzeitig)
    this.pulses = this.pulses.filter((p) => now - p.start < 500);
    for (const p of this.pulses) {
      const t = (now - p.start) / 500;
      if (PREFERS_REDUCED_MOTION) {
        // kein Reisen — kurzer statischer Blitz an Ziel + Quelle statt Bewegung
        if (t < 0.3) { this.fx.circle(p.x1, p.y1, 6).fill({ color: COL.cyan, alpha: 0.5 * (1 - t / 0.3) }); }
        continue;
      }
      const ease = 1 - Math.pow(1 - t, 2);
      const px = p.x0 + (p.x1 - p.x0) * ease, py = p.y0 + (p.y1 - p.y0) * ease;
      this.fx.moveTo(p.x0, p.y0).lineTo(px, py).stroke({ width: 2, color: COL.cyan, alpha: (1 - t) * 0.6 });
      this.fx.circle(px, py, 4).fill({ color: COL.cyan, alpha: (1 - t) * 0.8 });
      if (t > 0.85) this.fx.circle(p.x1, p.y1, 10 * (t - 0.85) / 0.15).stroke({ width: 1.5, color: COL.cyan, alpha: (1 - (t - 0.85) / 0.15) * 0.6 });
    }

    // geringe Parallaxe im Hintergrund (Kammer-Partikel/Chamber-Layer folgt Pointer minimal)
    if (this.chamber && !PREFERS_REDUCED_MOTION) {
      const dx = (this.lightCurrent.x - PANEL_W / 2) / (PANEL_W / 2);
      const dy = (this.lightCurrent.y - this.panelH / 2) / (this.panelH / 2);
      this.chamber.setParallax(dx * 3, dy * 3);
    } else if (this.chamber) {
      this.chamber.setParallax(0, 0);
    }
  }

  /** Löst einen Verbindungspuls Item→Slot aus; ignoriert, wenn FX-Budget ausgeschöpft. */
  private spawnConnectionPulse(x0: number, y0: number, x1: number, y1: number): void {
    if (this.pulses.length >= this.MAX_CONCURRENT_FX) this.pulses.shift();
    this.pulses.push({ x0, y0, x1, y1, start: performance.now() });
  }

  // ── Aufbau (Schritte 2–4) ────────────────────────────────────────────────
  private rebuild(s: LoadoutSnapshot): void {
    this.dynamic.removeChildren().forEach((c) => c.destroy());
    this.armorySlots = [];
    this.hideTip();

    const title = mkText(`LOADOUT · ${s.shipName.toUpperCase()}`, 22, 0xfbf6ff, "700", 3);
    title.position.set(PAD, PAD + 4);
    const dock = mkText(`ANGEDOCKT · STATION HUB    LVL ${s.level} · EXP ${s.exp}`, 10, COL.textDim, "700", 3);
    dock.position.set(PAD, PAD + 34);
    const credits = mkText(`CREDITS ${s.credits.toLocaleString()}`, 14, COL.gold, "700", 1);
    credits.position.set(PANEL_W - PAD - credits.width, PAD + 6);
    const honor = mkText(`EHRE ${s.honor.toLocaleString()}`, 14, COL.cyan, "700", 1);
    honor.position.set(PANEL_W - PAD - honor.width, PAD + 30);
    this.dynamic.addChild(title, dock, credits, honor);

    const bodyY = HEADER_H + PAD;
    const midX = RAIL_W + PAD;
    const midW = PANEL_W - RAIL_W - ASIDE_W - PAD * 3;
    const asideX = PANEL_W - ASIDE_W - PAD;

    this.dynamic.addChild(this.frame(0, HEADER_H, RAIL_W, this.panelH - HEADER_H, COL.strokeDim));
    this.renderSideNav(0, HEADER_H, RAIL_W, this.panelH - HEADER_H);

    const chamberH = 300;
    const third = Math.round((midW - 16) / 3);
    this.renderBankColumn(midX, bodyY, third, chamberH, [s.banks[0], s.banks[1]]);
    // zentrale Diagnosekammer (persistent, animiert) an Stelle der flachen Box
    const chX = midX + third + 8, chW = midW - third * 2 - 16;
    if (!this.chamber) { this.chamber = new ShipChamber(chW, chamberH); this.container.addChildAt(this.chamber, 2); }
    else this.chamber.build(chW, chamberH);
    this.chamber.position.set(chX, bodyY);
    this.renderBankColumn(midX + midW - third, bodyY, third, chamberH, [s.banks[2], s.banks[3]]);

    const dockY = bodyY + chamberH + 14;
    this.dynamic.addChild(this.frame(midX, dockY, midW, 52, COL.strokeDim));
    this.renderDockActions(midX, dockY, midW, 52);

    // Modul 1+2: gemeinsames ArmorPanel für Filter + Inventar, ein Rahmen, ein Divider dazwischen
    const groupY = dockY + 66;
    const groupH = this.panelH - PAD - groupY;
    this.dynamic.addChild(this.armorGroupFrame(midX, groupY, midW, groupH));

    const tabs: { key: FilterKey; label: string }[] = [
      { key: "all", label: "ALLE" }, { key: "weapon", label: "WAFFEN" },
      { key: "generator", label: "GENERATOREN" }, { key: "module", label: "MODULE" },
    ];
    const tabW = Math.floor(midW / tabs.length);
    const tabBarH = 34;
    tabs.forEach((tab, i) => {
      const active = this.filter === tab.key;
      const tx = midX + i * tabW;
      const tg = new PIXI.Graphics();
      // ruhig: keine Dauerbox je Tab, nur beim aktiven Tab eine schmale Unterlinie (semantischer Akzent)
      if (active) tg.rect(tx + 10, groupY + tabBarH - 2, tabW - 20, 2).fill({ color: COL.magenta, alpha: 0.9 });
      tg.rect(tx, groupY, tabW, tabBarH).fill({ color: 0xffffff, alpha: 0.001 }); // Hit-Area
      tg.eventMode = "static";
      tg.cursor = "pointer";
      tg.on("pointertap", () => { this.filter = tab.key; this.dirty = true; });
      const tl = mkText(tab.label, 10, active ? 0xffffff : COL.textDim, "700", 2);
      tl.position.set(tx + 10, groupY + 11);
      this.dynamic.addChild(tg, tl);
    });
    // gemeinsamer Divider zwischen Filter- und Inventarbereich
    this.dynamic.addChild(new PIXI.Graphics().rect(midX + 8, groupY + tabBarH, midW - 16, 1).fill({ color: COL.strokeDim, alpha: 0.9 }));

    const armoryY = groupY + tabBarH + 16;
    const armoryH = groupY + groupH - armoryY - 8;
    const invLbl = mkText(`INVENTAR (${s.inventory.length})`, 10, COL.textDim, "700", 3);
    invLbl.position.set(midX + 10, armoryY);
    this.dynamic.addChild(invLbl);
    this.renderArmory(midX + 10, armoryY + 20, midW - 20, armoryH - 20, s);

    const statsH = this.renderStats(asideX, bodyY, ASIDE_W, s);

    // Pointer-Licht-Maske: schmale Bänder entlang der Metall-/Bevel-Kanten der Panels (kein Inhalt/Text)
    this.buildLightMask([
      [0, HEADER_H, RAIL_W, this.panelH - HEADER_H],
      [midX, dockY, midW, 52],
      [midX, groupY, midW, groupH],
      [chX, bodyY, chW, chamberH],
      [asideX, bodyY, ASIDE_W, statsH],
    ]);
    if (this.sellConfirm) this.renderSellConfirm(this.sellConfirm);
    if (this.compareWith) this.renderCompareModal(this.compareWith, s);
  }

  /** Modul-Vergleich (Referenz "1C"): reale Items aus s.inventory/s.banks — kein Fake-Datensatz.
   *  Vergleicht das per Shift-Klick gewählte Inventaritem gegen das aktuell im selben Slot ausgerüstete. */
  private renderCompareModal(instanceId: string, s: LoadoutSnapshot): void {
    const candidate = s.inventory.find((it) => it.instanceId === instanceId);
    if (!candidate) { this.compareWith = null; return; }
    const bank = s.banks.find((b) => b.slot === candidate.slot);
    const equippedSocket = bank?.sockets.find((sk) => sk.instanceId);
    const equippedName = equippedSocket?.def?.name ?? "— (freier Slot)";
    const equippedIlvl = (equippedSocket?.def as any)?.ilvl ?? null;

    const w = 460, h = 200, x = (PANEL_W - w) / 2, y = (this.panelH - h) / 2;
    const backdrop = new PIXI.Graphics().rect(0, 0, PANEL_W, this.panelH).fill({ color: 0x000000, alpha: 0.55 });
    backdrop.eventMode = "static";
    const closeModal = () => { this.compareWith = null; this.dirty = true; };
    backdrop.on("pointertap", closeModal);
    this.dynamic.addChild(backdrop);

    const panel = new PIXI.Graphics();
    panel.rect(x, y, w, h).fill({ color: 0x0a0712, alpha: 0.97 }).stroke({ width: 1.5, color: COL.cyan, alpha: 0.7 });
    panel.rect(x, y, w, 44).fill({ color: COL.cyan, alpha: 0.12 });
    panel.eventMode = "static";
    this.dynamic.addChild(panel);
    const title = mkText("MODUL-VERGLEICH", 13, 0xc9ecff, "700", 2);
    title.position.set(x + 18, y + 15);
    this.dynamic.addChild(title);

    const colW = (w - 36 - 40) / 2;
    const leftX = x + 18, rightX = x + 18 + colW + 40;
    const rowY = y + 58;
    const leftLbl = mkText("AUSGERÜSTET", 9.5, COL.gold, "700", 1.5);
    leftLbl.position.set(leftX, rowY);
    const leftName = mkText(equippedName, 13, 0xf4edff, "700", 0.5);
    leftName.position.set(leftX, rowY + 16);
    const arrow = mkText("→", 18, COL.magenta, "700", 0);
    arrow.position.set(x + w / 2 - 8, rowY + 12);
    const rightLbl = mkText(candidate.legendary ? "NEU · LEGENDARY" : "NEU", 9.5, 0xff6a3c, "700", 1.5);
    rightLbl.position.set(rightX, rowY);
    const rightName = mkText(candidate.name, 13, 0xf4edff, "700", 0.5);
    rightName.position.set(rightX, rowY + 16);
    this.dynamic.addChild(leftLbl, leftName, arrow, rightLbl, rightName);

    // reales, einziges vorhandenes Vergleichsfeld: Itemlevel (mehr Felder liefert LoadoutItem aktuell nicht)
    const ilvlDelta = equippedIlvl != null ? candidate.ilvl - equippedIlvl : null;
    const leftIlvl = mkText(`ILVL ${equippedIlvl ?? "—"}`, 12, 0xd6c4f4, "400", 0.5);
    leftIlvl.position.set(leftX, rowY + 40);
    const deltaColor = ilvlDelta == null ? 0xd6c4f4 : ilvlDelta > 0 ? COL.green : ilvlDelta < 0 ? 0xff4d5e : 0xd6c4f4;
    const deltaTxt = ilvlDelta == null ? "" : ilvlDelta > 0 ? ` +${ilvlDelta}` : ilvlDelta < 0 ? ` ${ilvlDelta}` : " ±0";
    const rightIlvl = new PIXI.Text({
      text: `ILVL ${candidate.ilvl}${deltaTxt}`,
      style: { fontFamily: "Chakra Petch, sans-serif", fontSize: 12, fill: deltaColor },
    });
    rightIlvl.position.set(rightX, rowY + 40);
    this.dynamic.addChild(leftIlvl, rightIlvl);

    const closeBtn = new PIXI.Graphics().rect(x + w - 46, y + 10, 26, 26).fill({ color: 0x0c0814, alpha: 0.9 }).stroke({ width: 1, color: 0xffffff, alpha: 0.18 });
    closeBtn.eventMode = "static"; closeBtn.cursor = "pointer";
    closeBtn.on("pointertap", closeModal);
    const closeX = mkText("✕", 12, 0xe6d6fa, "700", 0);
    closeX.anchor.set(0.5); closeX.position.set(x + w - 33, y + 23);
    this.dynamic.addChild(closeBtn, closeX);
  }

  /** Sell-Confirm-Modal (Referenz "1C"): ECHTE Aktion — ruft dieselbe sellItem()/canSell()
   *  wie zuvor der Rechtsklick, nur jetzt mit Bestätigungsschritt statt Sofort-Verkauf. */
  private renderSellConfirm(sc: { instanceId: string; name: string }): void {
    const w = 420, h = 190, x = (PANEL_W - w) / 2, y = (this.panelH - h) / 2;
    const backdrop = new PIXI.Graphics().rect(0, 0, PANEL_W, this.panelH).fill({ color: 0x000000, alpha: 0.55 });
    backdrop.eventMode = "static";
    this.dynamic.addChild(backdrop);
    const panel = new PIXI.Graphics();
    panel.rect(x, y, w, h).fill({ color: 0x0a0712, alpha: 0.97 }).stroke({ width: 1.5, color: COL.magenta, alpha: 0.7 });
    panel.rect(x, y, w, 44).fill({ color: COL.magenta, alpha: 0.14 });
    panel.eventMode = "static"; // Klicks im Panel sollen nicht den Backdrop schließen
    this.dynamic.addChild(panel);
    const title = mkText("VERKAUF BESTÄTIGEN", 13, 0xecd6ff, "700", 2);
    title.position.set(x + 18, y + 15);
    const body = new PIXI.Text({
      text: `Du verkaufst ${sc.name}. Der Vorgang lässt sich nicht rückgängig machen.`,
      style: { fontFamily: "Chakra Petch, sans-serif", fontSize: 13, fill: 0xdeceF8, wordWrap: true, wordWrapWidth: w - 36, lineHeight: 18 },
    });
    body.position.set(x + 18, y + 58);
    this.dynamic.addChild(title, body);

    const closeModal = () => { this.sellConfirm = null; this.dirty = true; };
    backdrop.on("pointertap", closeModal);

    const btnY = y + h - 46, btnW = (w - 18 * 2 - 10) / 2;
    const cancelBtn = new PIXI.Graphics().rect(x + 18, btnY, btnW, 34).fill({ color: 0x140e1e, alpha: 0.9 }).stroke({ width: 1, color: 0xffffff, alpha: 0.14 });
    cancelBtn.eventMode = "static"; cancelBtn.cursor = "pointer";
    cancelBtn.on("pointertap", closeModal);
    const cancelLbl = mkText("ABBRECHEN", 11, 0xdeceF8, "700", 1.5);
    cancelLbl.position.set(x + 18 + btnW / 2 - cancelLbl.width / 2, btnY + 11);

    const canSellNow = canSell();
    const sellBtn = new PIXI.Graphics();
    sellBtn.rect(x + 18 + btnW + 10, btnY, btnW, 34)
      .fill({ color: 0xd22848, alpha: canSellNow ? 0.6 : 0.15 })
      .stroke({ width: 1, color: 0xff4d5e, alpha: canSellNow ? 0.8 : 0.3 });
    sellBtn.eventMode = canSellNow ? "static" : "none"; sellBtn.cursor = "pointer";
    sellBtn.on("pointertap", () => { sellItem(sc.instanceId); closeModal(); }); // ruft die reale, bereits verdrahtete Aktion
    const sellLbl = mkText(canSellNow ? "VERKAUFEN" : "NICHT ANGEDOCKT", 11, 0xffe4ea, "700", 1.5);
    sellLbl.position.set(x + 18 + btnW + 10 + btnW / 2 - sellLbl.width / 2, btnY + 11);

    this.dynamic.addChild(cancelBtn, cancelLbl, sellBtn, sellLbl);
  }

  /** Bänder entlang der Panel-Umrisse (12px) — Pointer-Licht scheint nur hier, nicht auf Text/Inhalt. */
  private buildLightMask(rects: [number, number, number, number][]): void {
    this.lightMask.clear();
    const band = 12;
    for (const [x, y, w, h] of rects) {
      this.lightMask.rect(x - band / 2, y - band / 2, w + band, band).fill(0xffffff);
      this.lightMask.rect(x - band / 2, y + h - band / 2, w + band, band).fill(0xffffff);
      this.lightMask.rect(x - band / 2, y - band / 2, band, h + band).fill(0xffffff);
      this.lightMask.rect(x + w - band / 2, y - band / 2, band, h + band).fill(0xffffff);
    }
  }

  /** gemeinsames, ruhiges ArmorPanel für Filter+Inventar: Extrusion + Bevel, konsistent zum Stats-Panel.
   *  Statisch pro Größe → als Textur gecacht statt bei jedem rebuild() (Equip/Sell/Filter) neu tesselliert. */
  private armorGroupFrame(x: number, y: number, w: number, h: number): PIXI.Container {
    const c = new PIXI.Container();
    const cc = 14;
    const px = [x + cc, y, x + w - cc, y, x + w, y + cc, x + w, y + h - cc, x + w - cc, y + h, x + cc, y + h, x, y + h - cc, x, y + cc];
    c.addChild(new PIXI.Graphics().poly(px.map((n, i) => n + (i % 2 ? 4 : 3))).fill({ color: 0x030209, alpha: 0.9 }));
    const g = new PIXI.Graphics();
    g.poly(px).fill({ color: 0x0a0712, alpha: 0.9 }).stroke({ width: 1, color: COL.strokeDim, alpha: 0.8 });
    g.moveTo(x, y + h - cc).lineTo(x, y + cc).lineTo(x + cc, y).lineTo(x + w - cc, y).stroke({ width: 1, color: 0x8fb0d0, alpha: 0.22 });
    g.moveTo(x + w, y + cc).lineTo(x + w, y + h - cc).lineTo(x + w - cc, y + h).lineTo(x + cc, y + h).stroke({ width: 1, color: 0x000000, alpha: 0.55 });
    c.addChild(g);
    c.cacheAsTexture(true); // statisch — einmal rastern, danach nur noch ein Sprite-Blit
    return c;
  }

  /** Linke Icon-Navigation (Referenz "1C"): Raute-Buttons, aktueller Screen hervorgehoben.
   *  Aus dem Projekt sind hier nur Screen-Wechsel-Ziele vorgesehen, keine Item-Daten — daher
   *  ein eigenes, schlankes Rendering statt ArmorSlot (das ist für Items mit Rarity ausgelegt). */
  private renderSideNav(x: number, y: number, w: number, h: number): void {
    const items: { code: string; label: string; active: boolean }[] = [
      { code: "⚙", label: "Loadout", active: true },
      { code: "★", label: "Bounties", active: false },
      { code: "▣", label: "Missions", active: false },
      { code: "✦", label: "Skills", active: false },
      { code: "▲", label: "Shipyard", active: false },
      { code: "$", label: "Market", active: false },
    ];
    const size = 44, gap = 12, cx = x + w / 2;
    let cy = y + 20;
    for (const it of items) {
      const c = new PIXI.Container();
      c.position.set(cx, cy);
      c.rotation = Math.PI / 4;
      const g = new PIXI.Graphics();
      g.rect(-size / 2, -size / 2, size, size)
        .fill({ color: it.active ? COL.magenta : 0x1a1128, alpha: it.active ? 0.32 : 0.85 })
        .stroke({ width: 1, color: it.active ? COL.magenta : COL.strokeDim, alpha: it.active ? 0.9 : 0.6 });
      c.addChild(g);
      const label = mkText(it.code, 14, it.active ? 0xf6ecff : COL.textDim, "700", 0);
      label.anchor.set(0.5); label.rotation = -Math.PI / 4; c.addChild(label);
      c.eventMode = "static"; c.cursor = "pointer";
      this.dynamic.addChild(c);
      cy += size + gap;
    }
  }

  /** Dock-Aktionsleiste (Referenz "1C"): Stations-Aktionen. Keine Datenquelle im Projekt für
   *  Services/Refinery/Market/Shipyard — nur UNDOCK ist real verdrahtbar (Screen schließen ist
   *  außerhalb dieser Section); restliche Buttons sind Platzhalter-Ziele wie in der Referenz. */
  private renderDockActions(x: number, y: number, w: number, h: number): void {
    const actions = [
      { icon: "✚", label: "SERVICES" }, { icon: "⚒", label: "REFINERY" },
      { icon: "$", label: "MARKET" }, { icon: "▲", label: "SHIPYARD" }, { icon: "✕", label: "UNDOCK" },
    ];
    const cw = w / actions.length;
    actions.forEach((a, i) => {
      const ax = x + i * cw;
      const active = a.label === "UNDOCK";
      const g = new PIXI.Graphics();
      if (active) g.rect(ax + 4, y + 4, cw - 8, h - 8).fill({ color: COL.green, alpha: 0.1 });
      g.eventMode = "static"; g.cursor = "pointer";
      g.rect(ax, y, cw, h).fill({ color: 0xffffff, alpha: 0.001 });
      const icon = mkText(a.icon, 15, active ? COL.green : 0xd6ecf8, "700", 0);
      icon.anchor.set(0.5, 0); icon.position.set(ax + cw / 2, y + 8);
      const lbl = mkText(a.label, 9, active ? COL.green : COL.textDim, "700", 1.5);
      lbl.anchor.set(0.5, 0); lbl.position.set(ax + cw / 2, y + 28);
      this.dynamic.addChild(g, icon, lbl);
    });
  }

  /** Eine Spalte aus Modul-Bänken (je Label + Belegungszähler + Socket-Grid). */
  private renderBankColumn(x: number, y: number, w: number, h: number, banks: LoadoutSnapshot["banks"]): void {
    let cy = y;
    const each = Math.floor((h - 12) / banks.length);
    for (const bank of banks) {
      const accent = SLOT_COLOR[bank.slot] ?? COL.magenta;
      const head = mkText(bank.label, 9.5, 0xe2d2f8, "700", 3);
      head.position.set(x, cy);
      const cnt = mkText(`${bank.filled}/${bank.capacity}`, 9.5, COL.textDim, "700", 1);
      cnt.position.set(x + w - cnt.width, cy);
      this.dynamic.addChild(head, cnt);

      const cols = 5, gap = 4;
      const cell = Math.floor((w - gap * (cols - 1)) / cols);
      const gridY = cy + 16;
      this.bankAnchors[bank.slot] = { x: x + w / 2, y: gridY + cell / 2 };
      bank.sockets.forEach((sk, i) => {
        const gx = x + (i % cols) * (cell + gap);
        const gy = gridY + Math.floor(i / cols) * (cell + gap);
        this.dynamic.addChild(this.socketCell(sk, gx, gy, cell, accent, bank.slot, i));
      });
      cy += each;
    }
  }

  private socketCell(sk: LoadoutSocket, gx: number, gy: number, cell: number, accent: number, slot: string, index: number): PIXI.Container {
    const c = new PIXI.Container();
    c.position.set(gx, gy);
    const filled = !!sk.instanceId;
    const col = filled ? hex(sk.color) : accent;

    const g = new PIXI.Graphics();
    g.rect(0, 0, cell, cell)
      .fill({ color: filled ? col : COL.socketEmpty, alpha: filled ? 0.2 : 0.35 })
      .stroke({ width: 1, color: sk.locked ? COL.strokeDim : col, alpha: sk.locked ? 0.5 : filled ? 1 : 0.5 });
    c.addChild(g);

    if (filled) {
      if (sk.icon) {
        const sp = new PIXI.Sprite();
        sp.anchor.set(0.5);
        sp.position.set(cell / 2, cell / 2);
        const fitScale = () => {
          const scale = Math.min((cell - 6) / (sp.texture.width || cell), (cell - 6) / (sp.texture.height || cell));
          sp.scale.set(scale > 0 && isFinite(scale) ? scale : 1);
        };
        sp.texture = tex(sk.icon, sp, fitScale);
        fitScale();
        c.addChild(sp);
      } else {
        const gl = mkText(sk.glyph, cell * 0.5, col, "700", 0);
        gl.anchor.set(0.5);
        gl.position.set(cell / 2, cell / 2);
        c.addChild(gl);
      }
      c.eventMode = "static";
      c.cursor = "pointer";
      if (slot === "drone" && sk.droneSlot) {
        const ds = sk.droneSlot as PetDroneSlot;
        c.on("pointertap", () => unequipDroneSlot(ds));
      } else {
        const ms = slot as ModuleSlot;
        c.on("pointertap", () => unequipShipSlot(ms, index));
      }
    }
    return c;
  }

  /** Render-Layer der Inventarslots = ArmorSlot (Datenbindung/Interaktion unverändert, nur Optik). */
  private renderArmory(x: number, y: number, w: number, h: number, s: LoadoutSnapshot): void {
    const cols = 8, gap = 8;
    const cell = Math.floor((w - gap * (cols - 1)) / cols);
    const rows = Math.max(1, Math.floor((h + gap) / (cell + gap)));
    s.inventory.slice(0, cols * rows).forEach((item, i) => {
      const gx = x + (i % cols) * (cell + gap);
      const gy = y + Math.floor(i / cols) * (cell + gap);
      this.dynamic.addChild(this.armorySlotCell(item, gx, gy, cell));
    });
  }

  private armorySlotCell(item: LoadoutItem, gx: number, gy: number, cell: number): PIXI.Container {
    const wrap = new PIXI.Container();
    wrap.position.set(gx, gy);

    const slot = new ArmorSlot({ size: cell, item: toSlotItem(item), interactive: true, draggable: false });
    wrap.addChild(slot);
    this.armorySlots.push(slot);

    // erhaltene Zusatz-Indikatoren, die ArmorSlot selbst nicht zeichnet:
    // "E" (equipped) und der ✦-Stern für item.legendary (unabhängig von Rarity-Tier)
    if (item.equipped) {
      const e = mkText("E", 9, COL.green, "700", 0);
      e.position.set(3, 2);
      wrap.addChild(e);
    }
    if (item.legendary) {
      const star = mkText("✦", 11, COL.gold, "700", 0);
      star.position.set(cell - 14, 2);
      wrap.addChild(star);
    }

    // bestehende Interaktion 1:1 über ArmorSlots Event-Vertrag verdrahtet
    slot.on("slot:activate", (ev: { worldPos?: { x: number; y: number }; shiftKey?: boolean }) => {
      // Shift-Klick auf ein nicht ausgerüstetes Item = Vergleich gegen das aktuell ausgerüstete Item desselben Slots (reale Daten, kein Fake)
      if (ev?.shiftKey && !item.equipped) {
        this.compareWith = item.instanceId;
        this.dirty = true;
        return;
      }
      this.taps.tap(item.instanceId, () => {}, (id) => {
        const before = item.equipped;
        toggleEquipShip(id);
        const anchor = this.bankAnchors[item.slot];
        if (!before && anchor && ev.worldPos) {
          const p = this.container.toLocal(ev.worldPos as PIXI.PointData);
          this.spawnConnectionPulse(p.x, p.y, anchor.x, anchor.y);
          SoundBus.emit("equip");
        }
      });
    });
    slot.on("slot:context", () => { this.sellConfirm = { instanceId: item.instanceId, name: item.name }; this.dirty = true; });
    slot.on("slot:tooltip", (ev: { show: boolean; event: PIXI.FederatedPointerEvent }) => {
      if (ev.show) this.showTip(item.tip, ev.event); else this.hideTip();
    });
    slot.on("slot:tooltipmove", (ev: { event: PIXI.FederatedPointerEvent }) => this.moveTip(ev.event));

    return wrap;
  }

  private renderStats(x: number, y: number, w: number, s: LoadoutSnapshot): number {
    const iw = w - 24, cc = 16;
    const colGap = 8, colW = (iw - colGap) / 2;
    // Height planning: header(16) per group, primary full-width(20), secondary 2-col(18) + 4 gap
    const PRI_H = 20, SEC_H = 18, HEAD_H = 16, GAP = 4;
    let planH = 44;
    for (const grp of STAT_GROUPS) {
      const rows = STATS_ROWS.filter((r) => r.group === grp.id);
      if (!rows.length) continue;
      const pri = rows.filter((r) => r.primary).length, sec = rows.filter((r) => !r.primary).length;
      planH += HEAD_H + pri * PRI_H + Math.ceil(sec / 2) * SEC_H + GAP;
    }
    const H = planH + 6;

    // Armor-Rahmen mit Extrusion + Recess (Materialtiefe)
    const px = [x + cc, y, x + w - cc, y, x + w, y + cc, x + w, y + H - cc, x + w - cc, y + H, x + cc, y + H, x, y + H - cc, x, y + cc];
    this.dynamic.addChild(new PIXI.Graphics().poly(px.map((n, i) => n + (i % 2 ? 5 : 3))).fill({ color: 0x030209, alpha: 0.92 }));
    const pnl = new PIXI.Graphics();
    pnl.poly(px).fill({ color: 0x0a0712, alpha: 0.96 }).stroke({ width: 1.5, color: COL.cyan, alpha: 0.6 });
    pnl.poly([x + 7, y + 34, x + w - 7, y + 34, x + w - 7, y + H - 7, x + 7, y + H - 7]).fill({ color: 0x05060c, alpha: 0.55 }).stroke({ width: 1, color: 0x000000, alpha: 0.5 });
    pnl.moveTo(x + 8, y + H - 8).lineTo(x + 8, y + 35).lineTo(x + w - 8, y + 35).stroke({ width: 1, color: 0x000000, alpha: 0.7 });
    pnl.moveTo(x, y + H - cc).lineTo(x, y + cc).lineTo(x + cc, y).lineTo(x + w - cc, y).stroke({ width: 1, color: 0x8fb0d0, alpha: 0.3 });
    pnl.moveTo(x + w, y + cc).lineTo(x + w, y + H - cc).lineTo(x + w - cc, y + H).lineTo(x + cc, y + H).stroke({ width: 1, color: 0x000000, alpha: 0.65 });
    pnl.poly([x + cc, y, x + w - cc, y, x + w, y + cc, x + w, y + 30, x, y + 30, x, y + cc]).fill({ color: COL.cyan, alpha: 0.1 });
    pnl.rect(x, y + cc, 4, 30 - cc).fill({ color: COL.cyan, alpha: 0.9 });
    pnl.moveTo(x, y + 30).lineTo(x + w, y + 30).stroke({ width: 1, color: COL.cyan, alpha: 0.4 });
    this.dynamic.addChild(pnl);
    const title = mkText("TACTICAL READOUT", 11, 0xd6f0ff, "700", 3);
    title.position.set(x + 14, y + 9);
    this.dynamic.addChild(title);

    let cy = y + 44;
    for (const grp of STAT_GROUPS) {
      const rows = STATS_ROWS.filter((r) => r.group === grp.id);
      if (!rows.length) continue;
      const gh = new PIXI.Graphics();
      gh.rect(x + 12, cy + 2, 3, 10).fill({ color: grp.accent, alpha: 0.9 });
      gh.moveTo(x + 22 + 90, cy + 7).lineTo(x + 12 + iw, cy + 7).stroke({ width: 1, color: grp.accent, alpha: 0.18 });
      this.dynamic.addChild(gh);
      const gl = mkText(grp.label, 9.5, grp.accent, "700", 2);
      gl.position.set(x + 22, cy); this.dynamic.addChild(gl);
      cy += HEAD_H;

      // Primary: full width, icon+word+value, directly readable
      for (const row of rows.filter((r) => r.primary)) {
        const val = row.fmt(s.stats[row.key]);
        this.statCell(x + 12, cy, iw, PRI_H, row, val, grp.accent, true);
        cy += PRI_H;
      }
      // Secondary: 2 columns side by side, compact
      const secRows = rows.filter((r) => !r.primary);
      secRows.forEach((row, i) => {
        const val = row.fmt(s.stats[row.key]);
        const cx = x + 12 + (i % 2) * (colW + colGap);
        this.statCell(cx, cy, colW, SEC_H, row, val, grp.accent, false);
        if (i % 2 === 1 || i === secRows.length - 1) cy += SEC_H;
      });
      cy += GAP;
    }
    return H;
  }

  /** simple stat listing: icon + word label + value, no bar. */
  private statCell(x: number, y: number, w: number, h: number, row: StatRow, val: string, accent: number, primary: boolean): void {
    const cell = new PIXI.Container();
    cell.position.set(x, y);

    const glyph = mkText(row.glyph, primary ? 13 : 10, accent, "700", 0);
    glyph.position.set(0, primary ? 1 : 0);
    const lbl = mkText(row.label, primary ? 11 : 9, 0xd7dde8, "700", 0.5);
    lbl.position.set(primary ? 18 : 14, primary ? 1 : 0);
    const value = mkText(val, primary ? 16 : 11, primary ? 0xffffff : 0xc7d0de, "700", 0.5);
    value.anchor.set(1, 0); value.position.set(w, 0);
    cell.addChild(glyph, lbl, value);

    // sanftes Aufleuchten bei tatsächlicher Wertänderung (nicht bei jedem Rebuild)
    const prev = this.prevStatVals.get(row.key);
    if (prev !== undefined && prev !== val) this.statFlashes.set(row.key, performance.now());
    this.prevStatVals.set(row.key, val);
    const flashStart = this.statFlashes.get(row.key);
    if (flashStart !== undefined) {
      const el = performance.now() - flashStart;
      const dur = PREFERS_REDUCED_MOTION ? 260 : 700;
      if (el < dur) {
        const a = PREFERS_REDUCED_MOTION ? 0.5 : (1 - el / dur) * 0.5;
        const glow = new PIXI.Graphics().rect(-2, -2, w + 4, h).fill({ color: COL.cyan, alpha: a });
        cell.addChildAt(glow, 0);
      } else {
        this.statFlashes.delete(row.key);
      }
    }

    // Details via Pixi tooltip on hover
    cell.eventMode = "static";
    const hit = new PIXI.Graphics().rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.001 });
    cell.addChildAt(hit, 0);
    cell.on("pointerover", (e: PIXI.FederatedPointerEvent) => this.showTip(`${row.full}\n${val}`, e));
    cell.on("pointermove", (e: PIXI.FederatedPointerEvent) => this.moveTip(e));
    cell.on("pointerout", () => this.hideTip());

    this.dynamic.addChild(cell);
  }

  // ── Tooltip-Layer (Schritt 4 + Scan-Reveal) ─────────────────────────────────
  private showTip(text: string, e: PIXI.FederatedPointerEvent): void {
    if (!text) return;
    this.tipText.text = text;
    const w = Math.min(260, this.tipText.width + 20);
    const h = this.tipText.height + 16;
    this.tipBg.clear();
    this.tipBg.rect(0, 0, w, h)
      .fill({ color: 0x0a0712, alpha: 0.96 })
      .stroke({ width: 1, color: COL.magenta, alpha: 0.5 });
    this.tip.visible = true;
    this.tipRevealStart = performance.now();
    this.moveTip(e);
  }
  /** kurzer Scan-Reveal: Maske w\u00e4chst von 0 auf volle Breite (bei reduced-motion sofort voll sichtbar). */
  private tickTooltipReveal(): void {
    if (!this.tip.visible) return;
    const w = this.tipBg.width, h = this.tipBg.height;
    const dur = 130;
    const t = PREFERS_REDUCED_MOTION ? 1 : Math.min(1, (performance.now() - this.tipRevealStart) / dur);
    const ease = 1 - Math.pow(1 - t, 2);
    this.tipMask.clear();
    this.tipMask.rect(0, 0, w * ease, h).fill(0xffffff);
    if (t < 1 && !PREFERS_REDUCED_MOTION) {
      this.tipScanLine.clear();
      this.tipScanLine.rect(w * ease - 1.5, 0, 2, h).fill({ color: COL.cyan, alpha: 0.8 * (1 - t) });
    } else {
      this.tipScanLine.clear();
    }
  }
  private moveTip(e: PIXI.FederatedPointerEvent): void {
    if (!this.tip.visible) return;
    const p = this.container.toLocal(e.global);
    let px = p.x + 16, py = p.y + 16;
    const w = this.tipBg.width, h = this.tipBg.height;
    if (px + w > PANEL_W) px = p.x - w - 16;
    if (py + h > this.panelH) py = p.y - h - 16;
    this.tip.position.set(Math.max(0, px), Math.max(0, py));
  }
  private hideTip(): void { this.tip.visible = false; }

  private frame(x: number, y: number, w: number, h: number, stroke: number): PIXI.Graphics {
    const g = new PIXI.Graphics();
    g.rect(x, y, w, h).fill({ color: 0x000000, alpha: 0.16 }).stroke({ width: 1, color: stroke, alpha: 1 });
    return g;
  }

  destroy(): void {
    this.unsub();
    this.taps.dispose();
    this.armorySlots = [];
    this.container.removeAllListeners(); // globalpointermove/pointerdown der Pointer-Beleuchtung
    this.container.destroy({ children: true });
  }
}

export function createLoadoutSection(): LoadoutSection {
  return new LoadoutSection();
}

export type { LoadoutSection };

// ── MOUNT (in ../hudManager.ts) ─────────────────────────────────────────────
// import { createLoadoutSection } from "./sections/loadoutSection";
// ... in mountHud():  sections = [ createLoadoutSection() ];
