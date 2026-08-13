// ── Financial Exchange (Cosmic Kit E-01) ────────────────────────────────────
// Ported 1:1 from the Cosmic Kit source (Cosmic Kit.dc.html, "E-01 · FINANCIAL
// EXCHANGE" section — HTML template ~line 943, FIN_STOCKS/finHistory ~line
// 5083, financeVals() state builder ~line 6824). Stock list, seeded price-walk
// formula, credit-line limit/rate/escalation, and auto-repay percentage are
// all taken verbatim from that source — nothing here is guessed.
//
// Prices are never stored: they're a deterministic seeded random walk off the
// real wall-clock hour, so both server and any client that ever re-derives
// them (there is none right now — only this server computes them) get
// identical numbers for the same hour without needing a price-history table.

export type FactionKey = "eic" | "mmo" | "vru" | "rim";

export const FIN_FAC: Record<FactionKey, { n: string; hex: string }> = {
  eic: { n: "EARTH CONCORD", hex: "#4ea3ff" },
  mmo: { n: "MARTIAN OFFICE", hex: "#ff8b3d" },
  vru: { n: "VENUSIAN UNION", hex: "#5cff8a" },
  rim: { n: "RIM INDEPENDENT", hex: "#c3d2e8" },
};

// [ticker, name, faction, basePrice, heldPctFloat]
export const FIN_STOCKS: [string, string, FactionKey, number, number][] = [
  ["TERH", "Terra Heavy Industries", "eic", 128.40, 3.2],
  ["CCSY", "Concord Shipyards", "eic", 84.10, 1.8],
  ["HLCY", "Halcyon Logistics", "eic", 45.90, 0.9],
  ["GAIA", "Gaia Agritech", "eic", 67.30, 1.2],
  ["GEOS", "Geostation Robotics", "eic", 189.60, 2.4],
  ["MOMC", "Mars Orbital Mining", "mmo", 212.75, 6.4],
  ["RSND", "Red Sand Refiners", "mmo", 33.20, 2.1],
  ["OLFG", "Olympus Forge Co", "mmo", 96.50, 1.4],
  ["DUST", "Dustbelt Transit", "mmo", 28.15, 1.0],
  ["PYRO", "Pyroclast Energy", "mmo", 143.90, 3.6],
  ["VNBT", "Venusian Biotech", "vru", 61.05, 0.7],
  ["CLRE", "Cloudreach Energy", "vru", 154.30, 5.9],
  ["AERU", "Aerostat Union", "vru", 22.40, 1.1],
  ["MIST", "Mistveil Chemicals", "vru", 78.85, 1.6],
  ["SKYD", "Skydock Ventures", "vru", 112.20, 2.0],
  ["VSLV", "Void Salvage Corp", "rim", 18.65, 8.8],
  ["NWDY", "Nullwake Dynamics", "rim", 302.10, 0.4],
  ["FRFT", "Frontier Freight", "rim", 55.75, 1.6],
  ["BLKM", "Blackmarket Holdings", "rim", 9.40, 12.5],
  ["RELC", "Relic Traders Guild", "rim", 264.75, 0.9],
  ["ORBT", "Orbital Freightways", "eic", 1.85, 0.3],
  ["CNCD", "Concord Holdings", "eic", 4210.00, 0.2],
  ["REGO", "Regolith Exports", "mmo", 0.62, 15.2],
  ["IRSM", "Ironsand Metallurgy", "mmo", 875.40, 1.0],
  ["MHAB", "Mars Habitat Corp", "mmo", 47.65, 1.3],
  ["ACDR", "Acid Rain Distillers", "vru", 0.35, 22.0],
  ["ORCH", "Orchid Skyfarms", "vru", 38.90, 1.7],
  ["TITN", "Titan Vapor Works", "vru", 1620.75, 0.5],
  ["SCRP", "Scraphaul Traders", "rim", 0.18, 28.4],
  ["OBLK", "Obsidian Bulwark", "rim", 6840.00, 0.1],
  ["GHST", "Ghostline Couriers", "rim", 2.95, 4.2],
  ["WRCK", "Wreckfield Salvage", "rim", 0.48, 9.6],
  ["ECLP", "Eclipse Bullion", "rim", 3125.60, 0.3],
  ["DRIF", "Driftmark Holdings", "rim", 12.10, 2.8],
];

export const FIN_TICKER_INDEX: Record<string, number> = Object.fromEntries(
  FIN_STOCKS.map((s, i) => [s[0], i]),
);

export const FIN_LIMIT_BASE = 150_000;
export const FIN_LIMIT_PER_LEVEL = 5_000; // higher pilot level unlocks a bigger credit line
export const FIN_RATE = 4.5; // % per cycle, standard (no loans this week)
export const FIN_RATE_STEP = 1.5; // % added per loan taken this week
export const FIN_RATE_MAX = 18;
export const FIN_AUTO_REPAY_PCT = 0.15; // fraction of every payout withheld until debt clears
export const FIN_HIST = 24; // hours of price history kept for the chart

/** Credit limit scales with pilot level — higher level, bigger line. */
export function limitForLevel(level: number): number {
  return FIN_LIMIT_BASE + Math.max(0, level - 1) * FIN_LIMIT_PER_LEVEL;
}

// Same LCG-ish seeded PRNG as the Kit (Math.sin trick) — must match exactly
// so replaying the same seed always yields the same walk.
function finSeededRand(seed: number): number {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

export function finHistory(base: number, seed: number, nowHour: number): number[] {
  const pts: number[] = [];
  let p = base;
  for (let h = nowHour - FIN_HIST + 1; h <= nowHour; h++) {
    const r = finSeededRand(seed * 13.371 + h * 0.9113);
    p = Math.max(0.4, p * (1 + (r - 0.5) * 0.07));
    pts.push(p);
  }
  return pts;
}

export function currentHour(): number {
  return Math.floor(Date.now() / 3_600_000);
}

export function currentIsoWeek(): number {
  return Math.floor(Date.now() / (3_600_000 * 24 * 7));
}

export function currentDay(): number {
  return Math.floor(Date.now() / 86_400_000);
}

/**
 * Compounds one day of interest onto `debt` for every day missed since
 * `lastInterestDay` (lazy accrual — applied whenever the player's exchange
 * state is next read/written, not on a background timer), at `rate`% per
 * day. Returns the new debt and the day index to persist as
 * `lastInterestDay`; a debt of 0 never accrues and just fast-forwards the
 * day marker so a player who never borrows doesn't pay for days they
 * missed the moment they first take a loan.
 */
export function applyDailyInterest(debt: number, rate: number, lastInterestDay: number, today = currentDay()): { debt: number; lastInterestDay: number } {
  if (lastInterestDay <= 0) return { debt, lastInterestDay: today };
  const missedDays = today - lastInterestDay;
  if (missedDays <= 0) return { debt, lastInterestDay };
  if (debt <= 0) return { debt, lastInterestDay: today };
  const grown = debt * Math.pow(1 + rate / 100, missedDays);
  return { debt: Math.round(grown), lastInterestDay: today };
}

export function currentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/**
 * Jitters the current hourly close by a small seeded amount per minute, so
 * the tradeable price actually moves inside each hour instead of sitting
 * still for 60 minutes at a time — the 24h chart still plots the coarser
 * hourly walk (finHistory) unchanged, this only affects the live tick.
 * Same seeded-random shape as finHistory's own walk step, scaled down
 * (±1.2% instead of ±3.5%) so it reads as noise around the hourly close,
 * not a second independent random walk.
 */
function minuteJitter(base: number, seed: number, nowMinute = currentMinute()): number {
  const r = finSeededRand(seed * 5.113 + nowMinute * 1.271);
  return Math.max(0.4, base * (1 + (r - 0.5) * 0.024));
}

/** Live tradeable price for one ticker index — hourly walk close, jittered per minute. */
export function currentPrice(idx: number, nowHour = currentHour(), nowMinute = currentMinute()): number {
  const row = FIN_STOCKS[idx];
  const walk = finHistory(row[3], (idx + 1) * 7.919, nowHour);
  return minuteJitter(walk[walk.length - 1], (idx + 1) * 7.919, nowMinute);
}

export type ExchangeHoldings = Record<string, { qty: number; avg: number }>;

/** Escalating weekly interest rate — matches financeVals()'s `rate` calc exactly. */
export function loanRate(loanCount: number, premium: boolean): number {
  if (premium) return 0;
  return Math.min(FIN_RATE + loanCount * FIN_RATE_STEP, FIN_RATE_MAX);
}

/** Net worth = credits (i.e. player.credits) + mark-to-market holdings − debt. */
export function holdingsValue(holdings: ExchangeHoldings, nowHour = currentHour(), nowMinute = currentMinute()): number {
  let total = 0;
  for (const ticker of Object.keys(holdings)) {
    const idx = FIN_TICKER_INDEX[ticker];
    if (idx == null) continue;
    total += currentPrice(idx, nowHour, nowMinute) * holdings[ticker].qty;
  }
  return total;
}
