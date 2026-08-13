// Sockelraster. Das Rasterfeld des Inventars, der Ausrüstung und der Lagerung.
//
// Versenkte Wanne mit Feinstrichen und wandernder Scanlinie, darin die Sockel im
// gewählten Raster. Auswahl, Hover, Tooltip-Anker und Ziehen zwischen Plätzen
// laufen über eine Stelle, damit alle Rasterflächen im Spiel gleich reagieren.

import { Container, Graphics } from "pixi.js";
import { cut, type Cuts } from "../core/geometry";
import { ItemSocket, type SocketItem } from "./ItemSocket";
import { Scanlines } from "./Scanlines";
import { ACCENT, CHAMFER } from "../core/tokens";

export type HexSocketGridOpts = {
  /** Gesamtbreite der Wanne. */
  w: number;
  cols: number;
  rows: number;
  /** Abstand zwischen den Sockeln. */
  gap?: number;
  /** Innenabstand der Wanne. */
  pad?: number;
  accent?: string | number;
  cuts?: Cuts;
  /** Wandernde Scanlinie über dem Raster. */
  sweep?: boolean;
  /** Ziehen zwischen Plätzen erlauben. */
  draggable?: boolean;
  items?: (SocketItem | null)[];
  onSelect?: (item: SocketItem | null, index: number) => void;
  onHover?: (item: SocketItem | null, index: number, over: boolean) => void;
  onRightClick?: (item: SocketItem | null, index: number) => void;
  /** Nach dem Ziehen: from und to sind Rasterindizes. */
  onMove?: (from: number, to: number) => void;
};

export class HexSocketGrid {
  readonly root = new Container();
  /** Höhe der Wanne — für die Anordnung darunter. */
  readonly height: number;
  /** Kantenlänge eines Sockels. */
  readonly socketSize: number;

  private sockets: ItemSocket[] = [];
  private scan: Scanlines;
  private selected = -1;
  private dragFrom = -1;
  private ghost: ItemSocket | null = null;
  private o: HexSocketGridOpts;
  private inner: Container;

  constructor(o: HexSocketGridOpts) {
    this.o = o;
    const gap = o.gap ?? 8;
    const pad = o.pad ?? 10;
    const accent = o.accent ?? ACCENT.action;
    const cuts = o.cuts ?? "tr-bl";

    const size = Math.floor((o.w - (o.cols - 1) * gap - pad * 2) / o.cols);
    this.socketSize = size;
    const h = o.rows * size + (o.rows - 1) * gap + pad * 2;
    this.height = h;

    // Wanne
    const well = new Graphics();
    cut(well, 0, 0, o.w, h, CHAMFER.card, 0x080611, 1, cuts);
    well.rect(10, 0, o.w - 20, 1).fill({ color: 0x000000, alpha: 0.85 });
    well.rect(10, h - 2, o.w - 20, 2).fill({ color: accent, alpha: 0.2 });
    well.eventMode = "none";
    this.root.addChild(well);

    const clip = new Graphics();
    cut(clip, 0, 0, o.w, h, CHAMFER.card, 0xffffff, 1, cuts);
    this.inner = new Container();
    this.inner.addChild(clip);
    this.inner.mask = clip;
    this.root.addChild(this.inner);

    this.scan = new Scanlines({
      w: o.w, h, kind: "fine", sweep: o.sweep !== false,
      accent: ACCENT.system, period: 5.5,
    });
    this.inner.addChild(this.scan.root);

    const count = o.cols * o.rows;
    for (let i = 0; i < count; i++) {
      const item = o.items?.[i] ?? null;
      const s = new ItemSocket({
        size, item,
        onClick: () => this.select(i),
        onHover: (over, it) => o.onHover?.(it, i, over),
        onRightClick: () => o.onRightClick?.(this.sockets[i].currentItem, i),
      });
      s.root.x = pad + (i % o.cols) * (size + gap);
      s.root.y = pad + Math.floor(i / o.cols) * (size + gap);
      if (o.draggable) this.makeDraggable(s, i);
      this.inner.addChild(s.root);
      this.sockets.push(s);
    }
  }

  private makeDraggable(s: ItemSocket, index: number): void {
    s.root.on("pointerdown", () => {
      if (!s.currentItem) return;
      this.dragFrom = index;
    });
    s.root.on("pointerup", () => {
      if (this.dragFrom >= 0 && this.dragFrom !== index) {
        this.o.onMove?.(this.dragFrom, index);
      }
      this.dragFrom = -1;
    });
    s.root.on("pointerupoutside", () => { this.dragFrom = -1; });
  }

  /** Sockel an einem Index setzen. */
  setItem(index: number, item: SocketItem | null): void {
    this.sockets[index]?.setItem(item);
  }

  /** Ganze Seite neu belegen. */
  setPage(items: (SocketItem | null)[]): void {
    this.sockets.forEach((s, i) => s.setItem(items[i] ?? null));
    if (this.selected >= 0) this.sockets[this.selected]?.setSelected(true);
  }

  select(index: number): void {
    if (this.selected >= 0) this.sockets[this.selected]?.setSelected(false);
    this.selected = index;
    const s = this.sockets[index];
    s?.setSelected(true);
    this.o.onSelect?.(s?.currentItem ?? null, index);
  }

  clearSelection(): void {
    if (this.selected >= 0) this.sockets[this.selected]?.setSelected(false);
    this.selected = -1;
  }

  /** Bildschirmposition eines Sockels — für Tooltip-Anker. */
  socketPosition(index: number): { x: number; y: number } {
    const s = this.sockets[index];
    return s ? { x: s.root.x, y: s.root.y } : { x: 0, y: 0 };
  }

  get selectedIndex(): number { return this.selected; }
  get count(): number { return this.sockets.length; }

  update(dt: number): void {
    this.scan.update(dt);
    for (const s of this.sockets) s.update(dt);
    this.ghost?.update(dt);
  }

  destroy(): void {
    for (const s of this.sockets) s.destroy();
    this.scan.destroy();
    this.root.destroy({ children: true });
  }
}

export const mount = (o: HexSocketGridOpts): HexSocketGrid => new HexSocketGrid(o);
export default mount;
