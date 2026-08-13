// C-08 Eingabefeld. Pixi kennt keine Textfelder, deshalb hängt das Modul ein
// unsichtbares DOM-Input in die Seite und spiegelt Text und Cursor auf die
// Canvas — Tastatur, Einfügen, Mobilkeyboard und Vorlesehilfen funktionieren
// dadurch wie gewohnt.
//
// Aufbau: versenkte Wanne mit Rim, optional Lupe, Platzhalter, blinkender
// Cursor, Fokusring in Akzentfarbe.

import { Container, Graphics } from "pixi.js";
import { cut, chamferPath } from "../core/geometry";
import { shade } from "../core/color";
import { value as makeValue, label as makeLabel } from "../core/typography";
import { ACCENT } from "../core/tokens";

export type TextInputOpts = {
  w: number;
  h?: number;
  placeholder?: string;
  value?: string;
  /** Lupe vor dem Text. */
  search?: boolean;
  accent?: string | number;
  maxLength?: number;
  /** Nur Großbuchstaben und Ziffern — Clan-Tag. */
  upper?: boolean;
  /** Mittig statt links, mit weitem Sperrsatz — Tag-Feld. */
  centered?: boolean;
  fontSize?: number;
  aria?: string;
  onInput?: (value: string) => void;
  onEnter?: (value: string) => void;
  onFocus?: (focused: boolean) => void;
};

export class TextInput {
  readonly root = new Container();

  private ring = new Graphics();
  private text;
  private placeholder;
  private caret = new Graphics();
  private el: HTMLInputElement | null = null;
  private val: string;
  private focused = false;
  private t = 0;
  private o: TextInputOpts;
  private h: number;
  private padL: number;

  constructor(o: TextInputOpts) {
    this.o = o;
    this.h = o.h ?? 26;
    this.val = o.value ?? "";
    const c = o.accent ?? ACCENT.action;
    this.padL = o.search ? 22 : 10;

    const g = new Graphics();
    cut(g, 0, 0, o.w, this.h, 6, 0x05080e, 1, "tl-br");
    g.rect(1, 1, o.w - 2, 1).fill({ color: 0x000000, alpha: 0.85 });
    g.rect(1, this.h - 2, o.w - 2, 1).fill({ color: c, alpha: 0.16 });
    g.eventMode = "none";
    this.root.addChild(g, this.ring);

    const fs = o.fontSize ?? (o.centered ? 13 : 10);
    this.text = makeValue(this.val, fs, 0xf2f7ff);
    this.placeholder = makeValue(o.placeholder ?? "", fs, 0x6b7f96);
    if (o.centered) {
      this.text.anchor.x = 0.5;
      this.placeholder.anchor.x = 0.5;
      this.text.x = this.placeholder.x = o.w / 2;
    } else {
      this.text.x = this.placeholder.x = this.padL;
    }
    this.text.y = this.placeholder.y = (this.h - fs * 1.2) / 2;
    this.root.addChild(this.placeholder, this.text);

    if (o.search) {
      const mag = makeLabel("⌕", 10, shade(c, 0.4), 0);
      mag.x = 8;
      mag.y = (this.h - 11) / 2;
      this.root.addChild(mag);
    }

    this.caret.rect(0, 0, 1, fs * 1.2).fill(0xf2f7ff);
    this.caret.visible = false;
    this.caret.eventMode = "none";
    this.root.addChild(this.caret);

    this.root.eventMode = "static";
    this.root.cursor = "text";
    this.root.accessible = true;
    this.root.accessibleTitle = o.aria ?? o.placeholder ?? "Text";
    this.root.on("pointerup", () => this.focus());
    this.root.on("pointerover", () => { g.tint = 0xf0f6ff; });
    this.root.on("pointerout", () => { g.tint = 0xffffff; });

    this.sync();
  }

  private sync(): void {
    this.text.text = this.val;
    this.placeholder.visible = !this.val && !this.focused;
    const fs = this.o.fontSize ?? (this.o.centered ? 13 : 10);
    this.caret.x = this.o.centered
      ? this.o.w / 2 + this.text.width / 2 + 2
      : this.padL + this.text.width + 1;
    this.caret.y = (this.h - fs * 1.2) / 2;
    const c = this.o.accent ?? ACCENT.action;
    this.ring.clear();
    if (this.focused) {
      this.ring.poly(chamferPath(0, 0, this.o.w, this.h, 6, "tl-br"))
        .stroke({ width: 1, color: c, alpha: 0.55 });
      this.ring.rect(1, this.h - 2, this.o.w - 2, 1).fill({ color: c, alpha: 0.6 });
    }
    this.ring.eventMode = "none";
  }

  /** Tastatur annehmen. Legt das versteckte Input an, falls nötig. */
  focus(): void {
    if (this.el) { this.el.focus(); return; }
    const el = document.createElement("input");
    el.type = "text";
    el.value = this.val;
    if (this.o.maxLength) el.maxLength = this.o.maxLength;
    el.setAttribute("aria-label", this.o.aria ?? this.o.placeholder ?? "Text");
    el.autocomplete = "off";
    el.spellcheck = false;
    Object.assign(el.style, {
      position: "fixed", left: "-9999px", top: "0",
      opacity: "0", width: "1px", height: "1px",
    });
    document.body.appendChild(el);
    el.addEventListener("input", () => {
      let v = el.value;
      if (this.o.upper) {
        v = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
        el.value = v;
      }
      this.val = v;
      this.sync();
      this.o.onInput?.(v);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this.o.onEnter?.(this.val); }
      if (e.key === "Escape") el.blur();
    });
    el.addEventListener("blur", () => {
      this.focused = false;
      this.caret.visible = false;
      this.el?.remove();
      this.el = null;
      this.sync();
      this.o.onFocus?.(false);
    });
    this.el = el;
    this.focused = true;
    el.focus();
    this.sync();
    this.o.onFocus?.(true);
  }

  blur(): void { this.el?.blur(); }

  update(dt: number): void {
    this.t += dt;
    this.caret.visible = this.focused && (this.t % 1) < 0.55;
  }

  get value(): string { return this.val; }
  setValue(v: string): void {
    this.val = v;
    if (this.el) this.el.value = v;
    this.sync();
  }

  destroy(): void {
    this.el?.remove();
    this.el = null;
    this.root.destroy({ children: true });
  }
}

export const mount = (o: TextInputOpts): TextInput => new TextInput(o);
export default mount;
