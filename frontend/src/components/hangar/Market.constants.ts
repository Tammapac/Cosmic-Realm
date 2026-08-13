import type { RarityKey } from "./rarity";

/**
 * S-07 · Market — data, MIGRATED verbatim from the design export:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (const MARKET_ITEMS, marketRows/marketSel)
 *
 * The export packs each commodity positionally as
 *   [cat, rarity, name, base, price, trend, stock, stockMax, spark[], held]
 * Unpacked to named fields; values untouched.
 *
 * `base` vs `price` is what drives the P&L column and the "% vs base" readout —
 * base is the reference price, price is the current one. Sell price is derived,
 * not stored: Math.round(price * 0.88), the export's own spread.
 */

export type MarketCategory = "RAW" | "REFINED" | "COMPONENT" | "RELIC";

export interface MarketItem {
  cat: MarketCategory;
  rarity: RarityKey;
  name: string;
  /** Reference price the P&L is measured against. */
  base: number;
  /** Current buy price. */
  price: number;
  /** +1 rising, -1 falling. */
  trend: 1 | -1;
  stock: number;
  stockMax: number;
  /** 10-cycle price history, drawn as the sparkline. */
  spark: number[];
  /** Units the player currently holds — gates SELL. */
  held: number;
}

export const MARKET_ITEMS: MarketItem[] = [
  { cat: "RAW",       rarity: "common",    name: "Titanium Ore",    base: 22,  price: 19,   trend: -1, stock: 620000, stockMax: 700000,  spark: [62, 58, 64, 55, 50, 47, 44, 40, 38, 34], held: 40 },
  { cat: "RAW",       rarity: "common",    name: "Iridium Ore",     base: 68,  price: 84,   trend: 1,  stock: 180000, stockMax: 200000,  spark: [30, 34, 33, 40, 46, 52, 58, 63, 70, 78], held: 12 },
  { cat: "RAW",       rarity: "common",    name: "Silicate Dust",   base: 6,   price: 5,    trend: -1, stock: 950000, stockMax: 1000000, spark: [70, 66, 68, 60, 58, 54, 50, 46, 42, 38], held: 0 },
  { cat: "REFINED",   rarity: "rare",      name: "Titanium Alloy",  base: 96,  price: 112,  trend: 1,  stock: 4800,   stockMax: 6000,    spark: [40, 44, 42, 48, 54, 58, 62, 68, 74, 80], held: 6 },
  { cat: "REFINED",   rarity: "rare",      name: "Polymer Resin",   base: 40,  price: 34,   trend: -1, stock: 9200,   stockMax: 10000,   spark: [66, 62, 64, 58, 54, 50, 46, 42, 40, 36], held: 0 },
  { cat: "COMPONENT", rarity: "epic",      name: "Nav Chip",        base: 210, price: 256,  trend: 1,  stock: 1400,   stockMax: 2000,    spark: [36, 40, 38, 46, 52, 58, 64, 70, 76, 84], held: 3 },
  { cat: "COMPONENT", rarity: "epic",      name: "Fusion Coil",     base: 175, price: 149,  trend: -1, stock: 2300,   stockMax: 3000,    spark: [64, 60, 62, 55, 50, 46, 42, 38, 36, 32], held: 0 },
  { cat: "COMPONENT", rarity: "epic",      name: "Shield Emitter",  base: 340, price: 415,  trend: 1,  stock: 640,    stockMax: 1000,    spark: [34, 38, 36, 44, 50, 58, 66, 74, 80, 88], held: 1 },
  { cat: "RELIC",     rarity: "legendary", name: "Ancient Beacon",  base: 620, price: 540,  trend: -1, stock: 280,    stockMax: 500,     spark: [68, 64, 66, 58, 52, 48, 44, 40, 36, 32], held: 0 },
  { cat: "RELIC",     rarity: "celestial", name: "Voidcore Shard",  base: 420, price: 1180, trend: 1,  stock: 180,    stockMax: 300,     spark: [20, 24, 22, 32, 42, 54, 64, 74, 84, 96], held: 0 },
];

export const MARKET_CATEGORIES = ["ALL", "RAW", "REFINED", "COMPONENT", "RELIC"] as const;
export type MarketCatTab = (typeof MARKET_CATEGORIES)[number];

/** Category glyphs, from the export's inline ternary. */
export const CAT_GLYPH: Record<MarketCategory, string> = {
  RAW: "◆", REFINED: "▪", COMPONENT: "⬡", RELIC: "✦",
};

/** Dealer spread: the station buys back at 88% of the asking price. */
export const SELL_RATIO = 0.88;

/** Stock below this fraction of capacity is flagged low. */
export const LOW_STOCK = 0.15;

/** Quick-quantity buttons under the stepper. */
export const QTY_PRESETS = [1, 10, 50];

export const MARKET_PANEL_W = 1340;
export const MARKET_TAB_PCT = 100 / MARKET_CATEGORIES.length;
