// I-05 Inventory. Referenzfenster: zeigt, wie ein Panel aus den Bausteinen
// zusammengesetzt wird.
//
// 24 Sockel im Raster 8 × 3 in der Rasterwanne mit wandernder Scanlinie, sechs
// Kategoriereiter mit Edge-Glow-Wechsel, Suche, Raritätsschwelle, Seiten-
// blätterung. Rechts die Akte des gewählten Stücks mit Tooltip-Werten, EQUIP und
// dem roten THROW OUT mit Bestätigungsdialog.

import { Container, Graphics } from "pixi.js";
import {
  WindowShell, Tabs, TextInput, HexSocketGrid, Button, Tooltip, ConfirmDialog,
  ItemSocket, type SocketItem,
} from "../components";
import { label, value, strong, body } from "../core/typography";
import { hexPath } from "../core/geometry";
import { shade, rgba } from "../core/color";
import { radialTexture } from "../core/textures";
import { ACCENT, RARITY, RARITY_ORDER, SIZE, type RarityKey } from "../core/tokens";
import { ITEMS, ITEM_CATEGORIES } from "../data/items";
import type { Item, WindowHandle, WindowOpts } from "./types";

const COLS = 8, ROWS = 3, PAGE = COLS * ROWS;

export type InventoryOpts = WindowOpts & {
  items?: Item[];
  category?: string;
  /** Wird gerufen, wenn ein Stück an- oder abgelegt wird. */
  onEquip?: (item: Item, equipped: boolean) => void;
  /** Wird gerufen, wenn ein Stück entsorgt wird. */
  onDiscard?: (item: Item) => void;
};

export function mountInventory(o: InventoryOpts = {}): WindowHandle {
  const items = o.items ? [...o.items] : [...ITEMS];
  const W = 1020, H = 592;

  const shell = new WindowShell({
    w: W, h: H, accent: ACCENT.action,
    title: "Inventory",
    note: "24 sockets per page · rarity filter · search",
    onClosed: o.onClosed,
    autoplay: o.autoplay,
  });

  let category = o.category ?? "all";
  let rarityMin = 0;
  let query = "";
  let selectedId: string | null = items[0]?.id ?? null;
  let page = 0;

  const SIDE_W = 300;
  const gridW = shell.bodyW - SIDE_W - 18;

  /* Kopfbereich: Reiter, Suche, Raritätsschwelle */
  const headLayer = new Container();
  const gridLayer = new Container();
  const sideLayer = new Container();
  const overLayer = new Container();
  gridLayer.y = 74;
  sideLayer.x = shell.bodyW - SIDE_W;
  shell.body.addChild(headLayer, gridLayer, sideLayer, overLayer);

  const tabs = new Tabs({
    items: ITEM_CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
    accent: ACCENT.action,
    totalW: gridW,
    h: 26,
    active: category,
    onChange: (k) => { category = k; page = 0; refresh(); },
  });
  headLayer.addChild(tabs.root);

  const search = new TextInput({
    w: 196, placeholder: "Search an item", search: true,
    accent: ACCENT.action,
    onInput: (v) => { query = v; page = 0; refresh(); },
  });
  search.root.y = 36;
  headLayer.addChild(search.root);

  // Raritätsschwelle als Hexagon-Reihe
  const rarityRow = new Container();
  rarityRow.x = 206;
  rarityRow.y = 40;
  headLayer.addChild(rarityRow);
  RARITY_ORDER.forEach((key, i) => {
    const c = RARITY[key];
    const b = new Container();
    const g = new Graphics();
    g.poly(hexPath(0, 0, 18, 18)).fill(shade(c, 0.3));
    g.poly(hexPath(2, 2, 14, 14)).fill(shade(c, -0.2));
    b.addChild(g);
    b.x = i * 22;
    b.eventMode = "static";
    b.cursor = "pointer";
    b.on("pointerup", () => { rarityMin = rarityMin === i ? 0 : i; page = 0; refresh(); });
    b.on("pointerover", () => { b.scale.set(1.12); });
    b.on("pointerout", () => { b.scale.set(1); });
    b.accessible = true;
    b.accessibleTitle = `Filter ${key} and above`;
    rarityRow.addChild(b);
  });

  const countText = value("", SIZE.label, 0xc9b2e8);
  countText.anchor.x = 1;
  countText.x = gridW;
  countText.y = 43;
  headLayer.addChild(countText);

  /* Rasterwanne */
  const grid = new HexSocketGrid({
    w: gridW, cols: COLS, rows: ROWS, gap: 8, pad: 10,
    accent: ACCENT.action, sweep: true, draggable: true,
    onSelect: (it) => {
      selectedId = (it as (SocketItem & { id?: string }))?.id ?? null;
      renderSide();
    },
    onHover: (it, i, over) => { if (over && it) showTooltip(it as Item, i); else hideTooltip(); },
    onMove: (from, to) => {
      const list = filtered();
      const a = list[page * PAGE + from], b = list[page * PAGE + to];
      if (!a) return;
      const ia = items.indexOf(a), ib = b ? items.indexOf(b) : -1;
      if (ib >= 0) { items[ia] = b; items[ib] = a; }
      refresh();
    },
  });
  gridLayer.addChild(grid.root);

  /* Blätterleiste */
  const navY = grid.height + 8;
  const prev = new Button({
    w: 30, h: 22, label: "‹", tone: "action", fontSize: 10,
    aria: "Previous page", onClick: () => { page = Math.max(0, page - 1); refresh(); },
  });
  prev.root.y = navY;
  const next = new Button({
    w: 30, h: 22, label: "›", tone: "action", fontSize: 10,
    aria: "Next page", onClick: () => { page++; refresh(); },
  });
  next.root.x = 34;
  next.root.y = navY;
  const pageText = value("", SIZE.label, 0xc9b2e8);
  pageText.x = 74;
  pageText.y = navY + 5;
  gridLayer.addChild(prev.root, next.root, pageText);

  /* Akte rechts */
  let bigSocket: ItemSocket | null = null;
  let equipBtn: Button | null = null;
  let dropBtn: Button | null = null;
  let tooltip: Tooltip | null = null;
  let dialog: ConfirmDialog | null = null;

  const filtered = (): Item[] => {
    const q = query.trim().toLowerCase();
    return items.filter((it) =>
      (category === "all" || it.kind === category)
      && RARITY_ORDER.indexOf(it.rarity) >= rarityMin
      && (!q || it.name.toLowerCase().includes(q)));
  };

  const selected = (): Item | null => items.find((x) => x.id === selectedId) ?? null;

  const showTooltip = (it: Item, index: number): void => {
    hideTooltip();
    tooltip = new Tooltip({
      w: 264, title: it.name, rarity: it.rarity, icon: it.icon,
      desc: it.desc, subtitle: it.slot,
      rows: (it.stats ?? []).map(([k, v]) => ({ k, v })),
      footer: it.ilvl ? `ITEM LEVEL ${it.ilvl}` : undefined,
    });
    const pos = grid.socketPosition(index);
    tooltip.root.x = Math.min(pos.x + grid.socketSize + 12, gridW - 264);
    tooltip.root.y = 74 + pos.y;
    overLayer.addChild(tooltip.root);
  };
  const hideTooltip = (): void => { tooltip?.destroy(); tooltip = null; };

  const renderSide = (): void => {
    bigSocket?.destroy();
    equipBtn?.destroy();
    dropBtn?.destroy();
    bigSocket = null; equipBtn = null; dropBtn = null;
    sideLayer.removeChildren();

    const it = selected();
    const c = it ? RARITY[it.rarity] : 0x2a3444;

    const card = new Graphics();
    card.poly([0, 0, SIDE_W - 14, 0, SIDE_W, 14, SIDE_W, shell.bodyH,
      14, shell.bodyH, 0, shell.bodyH - 14]).fill(shade(c, -0.8));
    card.rect(14, 0, SIDE_W - 28, 1).fill({ color: shade(c, 0.8), alpha: 0.35 });
    card.rect(10, shell.bodyH - 2, SIDE_W - 20, 2).fill({ color: c, alpha: 0.4 });
    card.eventMode = "none";
    sideLayer.addChild(card);

    const wash = new Graphics();
    wash.rect(0, 0, SIDE_W, 180).fill({ color: c, alpha: 0.04 });
    wash.eventMode = "none";
    sideLayer.addChild(wash);
    void radialTexture; void rgba;

    if (!it) {
      const empty = value("No item selected.", SIZE.label, 0x6b7f96);
      empty.x = 18; empty.y = 20;
      sideLayer.addChild(empty);
      return;
    }

    bigSocket = new ItemSocket({
      size: 78,
      item: { name: it.name, rarity: it.rarity, icon: it.icon, equipped: it.equipped },
      sparkle: true,
    });
    bigSocket.root.x = 16;
    bigSocket.root.y = 16;
    sideLayer.addChild(bigSocket.root);

    const nm = strong(it.name, SIZE.title, 0xf2f7ff, SIDE_W - 116);
    nm.x = 104; nm.y = 20;
    sideLayer.addChild(nm);
    const rr = label(it.rarity.toUpperCase(), 7, c, 2.6);
    rr.x = 104; rr.y = 22 + nm.height;
    sideLayer.addChild(rr);
    const sl = value(`${it.slot ?? ""} · ILVL ${it.ilvl ?? "—"}`, SIZE.label, 0xbad2ec);
    sl.x = 104; sl.y = 36 + nm.height;
    sideLayer.addChild(sl);
    if (it.equipped) {
      const eq = label("EQUIPPED", 6, ACCENT.confirm, 2);
      eq.x = 104; eq.y = 50 + nm.height;
      sideLayer.addChild(eq);
    }

    const div = new Graphics();
    div.rect(16, 106, SIDE_W - 32, 1).fill({ color: 0x000000, alpha: 0.6 });
    div.rect(16, 107, SIDE_W - 32, 1).fill({ color: c, alpha: 0.16 });
    div.eventMode = "none";
    sideLayer.addChild(div);

    const d = body(it.desc ?? "", SIZE.body, 0xd8e6f6, SIDE_W - 32);
    d.x = 16; d.y = 118;
    sideLayer.addChild(d);

    let y = 126 + d.height;
    for (const [k, v] of it.stats ?? []) {
      const g = new Graphics();
      g.rect(16, y, SIDE_W - 32, 20).fill(0x060a10);
      g.rect(16, y, SIDE_W - 32, 1).fill({ color: 0x000000, alpha: 0.8 });
      g.rect(16, y + 19, SIDE_W - 32, 1).fill({ color: c, alpha: 0.14 });
      g.poly([24, y + 7.5, 27.5, y + 4, 31, y + 7.5, 27.5, y + 11]).fill(c);
      g.eventMode = "none";
      sideLayer.addChild(g);
      const kk = value(k, SIZE.label, 0xbad2ec);
      kk.x = 38; kk.y = y + 5;
      const vv = value(v, 9.5, 0xdbe9fb);
      vv.anchor.x = 1; vv.x = SIDE_W - 24; vv.y = y + 5;
      sideLayer.addChild(kk, vv);
      y += 22;
    }

    equipBtn = new Button({
      w: SIDE_W - 32, h: 32,
      label: it.equipped ? "UNEQUIP" : "EQUIP",
      tone: it.equipped ? "steel" : "confirm",
      onClick: () => {
        it.equipped = !it.equipped;
        o.onEquip?.(it, !!it.equipped);
        refresh();
      },
    });
    equipBtn.root.x = 16;
    equipBtn.root.y = shell.bodyH - 92;

    dropBtn = new Button({
      w: SIDE_W - 32, h: 32, label: "THROW OUT", tone: "destruction",
      onClick: () => openDiscard(it),
    });
    dropBtn.root.x = 16;
    dropBtn.root.y = shell.bodyH - 54;
    sideLayer.addChild(equipBtn.root, dropBtn.root);
  };

  const openDiscard = (it: Item): void => {
    if (dialog) return;
    dialog = new ConfirmDialog({
      title: "Throw out",
      text: `${it.name} leaves the hold for good. Nothing comes back from the void — the slot clears the moment you confirm.`,
      confirmLabel: "THROW OUT",
      onConfirm: () => {
        const i = items.indexOf(it);
        if (i >= 0) items.splice(i, 1);
        if (selectedId === it.id) selectedId = items[0]?.id ?? null;
        o.onDiscard?.(it);
        closeDialog();
        refresh();
      },
      onCancel: closeDialog,
    });
    dialog.root.x = (shell.bodyW - dialog.size.w) / 2;
    dialog.root.y = 90;
    overLayer.addChild(dialog.root);
  };
  const closeDialog = (): void => { dialog?.destroy(); dialog = null; };

  const refresh = (): void => {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    page = Math.min(page, pages - 1);
    const start = page * PAGE;
    grid.setPage(Array.from({ length: PAGE }, (_, i) => {
      const it = list[start + i];
      return it ? { id: it.id, name: it.name, rarity: it.rarity, icon: it.icon,
        qty: it.qty, ilvl: it.ilvl, equipped: it.equipped, locked: it.locked } : null;
    }));
    countText.text = `${list.length} / ${items.length} ITEMS`;
    pageText.text = `PAGE ${page + 1} / ${pages}`;
    prev.setEnabled(page > 0);
    next.setEnabled(page < pages - 1);
    renderSide();
  };

  refresh();

  return {
    root: shell.root,
    size: { w: W, h: H },
    close: () => shell.close(),
    update(dt: number): void {
      shell.update(dt);
      tabs.update(dt);
      search.update(dt);
      grid.update(dt);
      prev.update(dt);
      next.update(dt);
      bigSocket?.update(dt);
      equipBtn?.update(dt);
      dropBtn?.update(dt);
      tooltip?.update(dt);
      dialog?.update(dt);
    },
    destroy(): void {
      closeDialog();
      hideTooltip();
      tabs.destroy();
      search.destroy();
      grid.destroy();
      prev.destroy();
      next.destroy();
      bigSocket?.destroy();
      equipBtn?.destroy();
      dropBtn?.destroy();
      shell.destroy();
    },
  };
}

export default mountInventory;
