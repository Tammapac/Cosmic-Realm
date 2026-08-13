// P-02 Item-Sockel. Der Baustein des Inventars, der Hotbar, der Belohnungen
// und der Ausrüstungsplätze.
//
// Aufbau (CLAUDE.md): 26/74-Hexagon mit sieben genesteten Rimlagen, Rim bei
// 6,25 % der Sockelbreite. Die Rahmenfarbe folgt der Rarität. Auswahl geschieht
// durch cyanes Innenlicht aus der Mitte, nicht durch einen harten Rahmen.
//
// Zustände: normal · hover · pressed · disabled · selected · equipped · locked
// Rarität animiert mit — Celestial Prismenwirbel plus Regenbogenstreifen im
// Shader, Relic kreisender Wirbel mit umlaufendem Funken, Legendary Goldatmen,
// Epic Violettpulsieren. Dazu Glitzerpartikel ab Legendary.

import { Container, Graphics, Sprite } from "pixi.js";
import { hexPath } from "../core/geometry";
import { shade, rgba, num } from "../core/color";
import { radialTexture, gradientTexture } from "../core/textures";
import { makeGlow } from "../core/shadows";
import { value as makeValue, label as makeLabel, glyph as makeGlyph } from "../core/typography";
import { attachStates, type StateHandle, type VisualState } from "../core/states";
import { itemTexture } from "../core/assets";
import { RARITY, RARITY_ANIMATED, SOCKET, ACCENT, type RarityKey } from "../core/tokens";
import { RainbowCycleFilter } from "../core/filters";
import { ParticleField } from "../core/particles";

export type SocketItem = {
  id?: string;
  name: string;
  rarity: RarityKey | string;
  /** Icon-Kürzel aus assets/ui/items, z. B. "laser-t10". */
  icon?: string;
  /** Alternativ eine Glyphe. */
  glyph?: string;
  qty?: number;
  ilvl?: number;
  equipped?: boolean;
  locked?: boolean;
};

export type ItemSocketOpts = {
  size: number;
  item: SocketItem | null;
  selected?: boolean;
  enabled?: boolean;
  /** Rolle des leeren Sockels, z. B. "WEAPON" — wird schwach eingeblendet. */
  role?: string;
  /** Glitzerpartikel ab Legendary. */
  sparkle?: boolean;
  aria?: string;
  onClick?: () => void;
  onRightClick?: () => void;
  onHover?: (over: boolean, item: SocketItem | null) => void;
};

export class ItemSocket {
  readonly root = new Container();

  private shell = new Container();
  private inner = new Container();
  private auraLayer = new Container();
  private fxLayer = new Container();
  private selLight: Sprite | null = null;
  private states: StateHandle;
  private field: ParticleField | null = null;
  private rainbow: RainbowCycleFilter | null = null;
  private anim: { sp: Sprite; kind: string; seed: number }[] = [];
  private item: SocketItem | null;
  private size: number;
  private selected: boolean;
  private t = 0;
  private o: ItemSocketOpts;

  constructor(o: ItemSocketOpts) {
    this.o = o;
    this.size = o.size;
    this.item = o.item;
    this.selected = !!o.selected;

    this.root.addChild(this.auraLayer, this.shell, this.inner, this.fxLayer);

    if (o.sparkle !== false) {
      this.field = new ParticleField({
        accent: this.item ? (RARITY[this.item.rarity as RarityKey] ?? RARITY.common) : ACCENT.steel,
        max: 40,
        density: 0.5,
      });
      this.fxLayer.addChild(this.field.container);
    }

    this.build();

    this.states = attachStates(this.root, {
      accent: this.item ? (RARITY[this.item.rarity as RarityKey] ?? RARITY.common) : ACCENT.steel,
      scaleHover: 1.04,
      scalePress: 0.96,
      lift: 0,
      sink: 0,
      flash: false,
      enabled: o.enabled !== false && !o.item?.locked,
      selected: this.selected,
      size: { w: this.size, h: this.size },
      aria: o.aria ?? (this.item ? `${this.item.name}, ${this.item.rarity}` : (o.role ?? "Empty slot")),
      onClick: o.onClick,
      onRightClick: o.onRightClick,
      onHover: (over) => o.onHover?.(over, this.item),
    });
  }

  private build(): void {
    this.shell.removeChildren();
    this.inner.removeChildren();
    this.auraLayer.removeChildren();
    this.anim.length = 0;
    this.rainbow = null;

    const size = this.size;
    const it = this.item;
    const rar = it ? (RARITY[it.rarity as RarityKey] ?? RARITY.common) : 0x2a3444;
    const r = size * SOCKET.rimFraction;

    // Sieben genestete Rimlagen
    const g = new Graphics();
    for (const [mult, tone] of SOCKET.ladder) {
      const inset = r * mult;
      g.poly(hexPath(inset, inset, size - inset * 2, size - inset * 2))
        .fill(shade(rar, it ? tone : tone - 0.18));
    }
    g.eventMode = "none";
    this.shell.addChild(g);

    // Innenraum, auf die Hexagonform beschnitten
    const clip = new Graphics();
    clip.poly(hexPath(r * 3, r * 3, size - r * 6, size - r * 6)).fill(0xffffff);
    this.inner.addChild(clip);
    this.inner.mask = clip;

    const wash = new Sprite(radialTexture([
      [0, rgba(rar, it ? 0.4 : 0.1)],
      [0.72, "rgba(4,7,13,0)"],
    ]));
    wash.width = wash.height = size;
    wash.eventMode = "none";
    this.inner.addChild(wash);

    // senkrechte Feinstriche
    const fine = new Graphics();
    for (let x = 0; x < size; x += 3) {
      fine.rect(x, 0, 1, size).fill({ color: 0xaa8cdc, alpha: 0.05 });
    }
    fine.eventMode = "none";
    this.inner.addChild(fine);

    if (!it) {
      if (this.o.role) {
        const rl = makeLabel(this.o.role, size * 0.13, shade(rar, 0.2), 1.4);
        rl.anchor.set(0.5);
        rl.x = size / 2; rl.y = size / 2;
        rl.alpha = 0.5;
        this.inner.addChild(rl);
      }
      this.addSelectionLight();
      return;
    }

    // Icon oder Glyphe
    if (it.icon) {
      const sp = new Sprite(itemTexture(it.icon));
      sp.width = sp.height = size * 0.52;
      sp.x = size * 0.24; sp.y = size * 0.24;
      sp.eventMode = "none";
      this.inner.addChild(sp);
    } else if (it.glyph) {
      const t = makeGlyph(it.glyph, size * 0.36, shade(rar, 0.6));
      t.anchor.set(0.5);
      t.x = size / 2; t.y = size / 2;
      this.inner.addChild(t);
    }

    // Raritätsanimation
    const key = it.rarity as RarityKey;
    if (RARITY_ANIMATED[key]) {
      if (key === "celestial") {
        // Prismenwirbel: drei versetzte Farbfelder
        const cols = ["rgba(157,242,255,.5)", "rgba(255,160,255,.45)", "rgba(160,255,214,.45)"];
        cols.forEach((col, i) => {
          const sp = new Sprite(radialTexture([[0, col], [1, "rgba(0,0,0,0)"]]));
          sp.width = sp.height = size * 1.4;
          sp.anchor.set(0.5);
          sp.x = sp.y = size / 2;
          sp.blendMode = "add";
          sp.eventMode = "none";
          this.inner.addChild(sp);
          this.anim.push({ sp, kind: "swirl", seed: i * 2.1 });
        });
        // Regenbogenstreifen im Shader statt als Sprite
        this.rainbow = new RainbowCycleFilter(0.22, 0.5);
        this.inner.filters = [this.rainbow];
      } else if (key === "relic") {
        const aura = new Sprite(radialTexture([[0, rgba(rar, 0.55)], [1, rgba(rar, 0)]]));
        aura.width = aura.height = size * 1.2;
        aura.x = aura.y = -size * 0.1;
        aura.blendMode = "add";
        aura.alpha = 0.45;
        aura.eventMode = "none";
        this.auraLayer.addChild(aura);
        this.anim.push({ sp: aura, kind: "spin", seed: 0 });
        // umlaufender Funke
        const orb = new Sprite(radialTexture([
          [0, "rgba(255,220,255,.95)"], [1, rgba(rar, 0)],
        ]));
        orb.width = orb.height = size * 0.2;
        orb.anchor.set(0.5);
        orb.blendMode = "add";
        orb.eventMode = "none";
        this.inner.addChild(orb);
        this.anim.push({ sp: orb, kind: "orbit", seed: 0 });
      } else {
        // legendary, epic: ruhiges Atmen
        const aura = new Sprite(radialTexture([[0, rgba(rar, 0.5)], [1, rgba(rar, 0)]]));
        aura.width = aura.height = size * 1.15;
        aura.x = aura.y = -size * 0.075;
        aura.blendMode = "add";
        aura.alpha = key === "legendary" ? 0.42 : 0.3;
        aura.eventMode = "none";
        this.auraLayer.addChild(aura);
        this.anim.push({ sp: aura, kind: "breathe", seed: key === "legendary" ? 0 : 1 });
      }
    }

    // Stapelzahl: klein, hell, mittig unten
    if (it.qty && it.qty > 1) {
      const q = makeValue(num(it.qty), size * 0.17, 0xf2f7ff);
      q.anchor.set(0.5, 1);
      q.x = size / 2;
      q.y = size - r * 3.2;
      this.shell.addChild(q);
    }
    // Ausrüstungsmarke oben links
    if (it.equipped) {
      const e = makeLabel("E", size * 0.15, ACCENT.confirm, 0);
      e.x = size * 0.14; e.y = size * 0.14;
      this.shell.addChild(e);
      const eg = makeGlow(ACCENT.confirm, size * 0.4, size * 0.4, 0.5);
      eg.x = size * 0.05; eg.y = size * 0.05;
      this.shell.addChildAt(eg, 0);
    }
    // Schlossmarke oben rechts
    if (it.locked) {
      const l = makeGlyph("⌧", size * 0.18, 0x8aa0c0);
      l.anchor.set(1, 0);
      l.x = size * 0.86; l.y = size * 0.14;
      this.shell.addChild(l);
    }
    // Itemlevel unten links
    if (it.ilvl) {
      const iv = makeValue(String(it.ilvl), size * 0.13, shade(rar, 0.35));
      iv.x = size * 0.16;
      iv.y = size - r * 3.4;
      this.shell.addChild(iv);
    }

    this.addSelectionLight();
  }

  /** Auswahl: cyanes Innenlicht, pulsiert 1,6 s. */
  private addSelectionLight(): void {
    this.selLight = new Sprite(radialTexture([
      [0, rgba(ACCENT.system, 0.55)],
      [0.6, rgba(ACCENT.system, 0.14)],
      [1, rgba(ACCENT.system, 0)],
    ]));
    this.selLight.width = this.selLight.height = this.size * 0.9;
    this.selLight.x = this.selLight.y = this.size * 0.05;
    this.selLight.blendMode = "add";
    this.selLight.visible = this.selected;
    this.selLight.eventMode = "none";
    this.inner.addChild(this.selLight);
  }

  update(dt: number): void {
    this.t += dt;
    this.states.update(dt);
    this.field?.update(dt);
    if (this.rainbow) this.rainbow.time = this.t;

    if (this.selLight && this.selected) {
      this.selLight.alpha = 0.75 + Math.sin(this.t * 2.6) * 0.25;
    }

    for (const a of this.anim) {
      switch (a.kind) {
        case "swirl":
          a.sp.rotation = this.t * (0.28 + a.seed * 0.06) + a.seed;
          a.sp.alpha = 0.4 + Math.sin(this.t * 1.1 + a.seed) * 0.22;
          break;
        case "spin":
          a.sp.rotation = this.t * 0.5;
          a.sp.alpha = 0.35 + Math.sin(this.t * 2.6) * 0.2;
          break;
        case "orbit": {
          const r = this.size * 0.3;
          a.sp.x = this.size / 2 + Math.cos(this.t * 1.5) * r;
          a.sp.y = this.size / 2 + Math.sin(this.t * 1.5) * r;
          a.sp.alpha = 0.6 + Math.sin(this.t * 3.2) * 0.3;
          break;
        }
        case "breathe":
          a.sp.alpha = (a.seed ? 0.24 : 0.34) + Math.sin(this.t * 1.55) * 0.13;
          break;
      }
    }

    // Glitzer ab Legendary
    if (this.field && this.item) {
      const key = this.item.rarity as RarityKey;
      if (key === "legendary" || key === "relic" || key === "celestial") {
        const rate = key === "celestial" ? 22 : key === "relic" ? 16 : 9;
        this.field.emit("sparkle", dt, () => [
          this.size * 0.2 + Math.random() * this.size * 0.6,
          this.size * 0.25 + Math.random() * this.size * 0.5,
        ], rate);
      }
    }
  }

  setSelected(on: boolean): void {
    this.selected = on;
    this.states.setSelected(on);
    if (this.selLight) this.selLight.visible = on;
  }

  setItem(item: SocketItem | null): void {
    this.item = item;
    this.selected = false;
    this.build();
    this.states.setEnabled(!item?.locked);
  }

  setEnabled(on: boolean): void { this.states.setEnabled(on); }
  get state(): VisualState { return this.states.state; }
  get currentItem(): SocketItem | null { return this.item; }

  destroy(): void {
    this.states.destroy();
    this.field?.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: ItemSocketOpts): ItemSocket => new ItemSocket(o);
export default mount;
