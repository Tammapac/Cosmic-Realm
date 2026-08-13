// Fensterverwaltung. Registry, Hotkeys, Z-Ordnung, Öffnen und Schließen.
//
// Das Spiel spricht nur mit dem Host, nicht mit den Fenstern:
//
//   const host = new PanelHost(app.stage);
//   host.register("inventory", () => mountInventory({ … }), { key: "i" });
//   host.toggle("inventory");
//
// Der Host hält höchstens ein Exemplar je Schlüssel, bringt das angeklickte
// Fenster nach vorn und räumt nach der Schließanimation auf.

import { Container } from "pixi.js";

export type PanelHandle = {
  root: Container;
  update: (dt: number) => void;
  close: () => void;
  destroy: () => void;
  size: { w: number; h: number };
};

export type PanelFactory = () => PanelHandle;

export type RegisterOpts = {
  /** Tastenkürzel, z. B. "i". */
  key?: string;
  /** Startposition; ohne Angabe mittig. */
  at?: { x: number; y: number };
  /** Nur ein Fenster dieser Gruppe gleichzeitig. */
  group?: string;
  /** Beim Öffnen nach vorn holen. Standard true. */
  raise?: boolean;
};

type Entry = {
  key: string;
  make: PanelFactory;
  opts: RegisterOpts;
  live: PanelHandle | null;
  closing: boolean;
};

export class PanelHost {
  private entries = new Map<string, Entry>();
  private order: string[] = [];
  private stage: Container;
  private layer = new Container();
  private viewport = { w: 1920, h: 1080 };
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    // Only claim Escape when one of THESE windows is actually open, so it
    // still reaches the React panels (which own the current Kit port) when
    // nothing here is showing. No preventDefault either — Escape is shared.
    if (e.key === "Escape") { if (this.hasOpen()) this.closeTop(); return; }
    const k = e.key.toLowerCase();
    for (const en of this.entries.values()) {
      if (en.opts.key && en.opts.key.toLowerCase() === k) {
        e.preventDefault();
        this.toggle(en.key);
        return;
      }
    }
  };

  constructor(stage: Container, viewport?: { w: number; h: number }) {
    this.stage = stage;
    this.stage.addChild(this.layer);
    if (viewport) this.viewport = viewport;
    window.addEventListener("keydown", this.onKeyDown);
  }

  /** Bildschirmgröße melden, damit neue Fenster mittig sitzen. */
  resize(w: number, h: number): void { this.viewport = { w, h }; }

  register(key: string, make: PanelFactory, opts: RegisterOpts = {}): void {
    this.entries.set(key, { key, make, opts, live: null, closing: false });
  }

  isOpen(key: string): boolean {
    const e = this.entries.get(key);
    return !!e?.live && !e.closing;
  }

  /** True while any registered window is on screen — including mid-close,
   *  so the close animation stays visible. Keyed on root.visible (the
   *  window's portal clears it the moment its close animation finishes)
   *  rather than just `live`, because update() only tears the panel down on
   *  the NEXT frame after that; keying on `live` alone left this true for
   *  an extra frame-plus and, more importantly, reported true forever if
   *  anything cleared `live` out from under update()'s cleanup check. */
  hasOpen(): boolean {
    for (const e of this.entries.values()) if (e.live && e.live.root.visible) return true;
    return false;
  }

  open(key: string): PanelHandle | null {
    const e = this.entries.get(key);
    if (!e) return null;
    if (e.live && !e.closing) { this.raise(key); return e.live; }

    // Gruppenzwang: andere Fenster derselben Gruppe schließen
    if (e.opts.group) {
      for (const other of this.entries.values()) {
        if (other.key !== key && other.opts.group === e.opts.group && other.live) {
          this.close(other.key);
        }
      }
    }

    const h = e.make();
    e.live = h;
    e.closing = false;
    const at = e.opts.at ?? {
      x: Math.round((this.viewport.w - h.size.w) / 2),
      y: Math.round((this.viewport.h - h.size.h) / 2),
    };
    h.root.x = at.x;
    h.root.y = at.y;
    // Klick bringt nach vorn
    h.root.eventMode = "static";
    h.root.on("pointerdown", () => this.raise(key));
    this.layer.addChild(h.root);
    this.order = this.order.filter((k) => k !== key).concat(key);
    this.applyOrder();
    return h;
  }

  close(key: string): void {
    const e = this.entries.get(key);
    if (!e?.live || e.closing) return;
    e.closing = true;
    e.live.close();
  }

  toggle(key: string): void {
    if (this.isOpen(key)) this.close(key);
    else this.open(key);
  }

  /** Das oberste offene Fenster schließen — Escape. */
  closeTop(): void {
    for (let i = this.order.length - 1; i >= 0; i--) {
      const e = this.entries.get(this.order[i]);
      if (e?.live && !e.closing) { this.close(e.key); return; }
    }
  }

  closeAll(): void {
    for (const e of this.entries.values()) if (e.live) this.close(e.key);
  }

  raise(key: string): void {
    const e = this.entries.get(key);
    if (!e?.live || e.opts.raise === false) return;
    this.order = this.order.filter((k) => k !== key).concat(key);
    this.applyOrder();
  }

  private applyOrder(): void {
    this.order.forEach((k, i) => {
      const e = this.entries.get(k);
      if (e?.live) this.layer.setChildIndex(e.live.root, Math.min(i, this.layer.children.length - 1));
    });
  }

  /** Position eines offenen Fensters setzen. */
  moveTo(key: string, x: number, y: number): void {
    const e = this.entries.get(key);
    if (!e?.live) return;
    e.live.root.x = x;
    e.live.root.y = y;
  }

  update(dt: number): void {
    for (const e of this.entries.values()) {
      if (!e.live) continue;
      e.live.update(dt);
      // Nach der Schließanimation aufräumen: das Portal hat root unsichtbar gemacht
      if (e.closing && !e.live.root.visible) {
        e.live.destroy();
        e.live = null;
        e.closing = false;
        this.order = this.order.filter((k) => k !== e.key);
      }
    }
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    for (const e of this.entries.values()) e.live?.destroy();
    this.entries.clear();
    this.layer.destroy({ children: true });
  }
}
