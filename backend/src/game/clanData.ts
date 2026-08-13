// Clan Hall domain logic — shared between routes/clan.ts (mutations) and
// game/engine.ts (computeStats, so research bonuses actually apply to
// combat/loot/economy, not just display). Kept in one file so the two never
// drift on tier costs or effect magnitudes.
import { eq } from "drizzle-orm";

export const BASE_MAX_MEMBERS = 30; // + 1 per clan level, per the Kit's own "+1 SLOT PER CLAN LEVEL" copy

// I-09 CREATE A CLAN charter form — mirrors the Kit's own JS constants
// verbatim (CF_SHAPE/CF_SYM/CF_PAL/CF_FOCUS/CF_COST in Cosmic Kit.dc.html
// ~line 7001-7188), so the 5 crest pickers (shape/symbol/outer/inner/symbol
// colour) and admission modes offer exactly what the Kit offers — not a
// reduced guess. Fixed option sets so the server can reject anything the
// client didn't actually offer.
export const CREST_SHAPES: [string, string][] = [
  ["hex", "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)"],
  ["flat", "polygon(26% 0,74% 0,100% 50%,74% 100%,26% 100%,0 50%)"],
  ["shield", "polygon(6% 0,94% 0,100% 62%,50% 100%,0 62%)"],
  ["kite", "polygon(50% 0,100% 50%,50% 100%,0 50%)"],
  ["oct", "polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)"],
  ["cut", "polygon(0 0,72% 0,100% 28%,100% 100%,28% 100%,0 72%)"],
  ["blade", "polygon(50% 0,100% 22%,86% 100%,14% 100%,0 22%)"],
  ["arrow", "polygon(50% 0,100% 34%,82% 100%,18% 100%,0 34%)"],
  ["star", "polygon(50% 0,62% 34%,98% 36%,70% 58%,80% 96%,50% 74%,20% 96%,30% 58%,2% 36%,38% 34%)"],
  ["cross", "polygon(34% 0,66% 0,66% 34%,100% 34%,100% 66%,66% 66%,66% 100%,34% 100%,34% 66%,0 66%,0 34%,34% 34%)"],
  ["disc", "circle(50% at 50% 50%)"],
  ["chev", "polygon(50% 0,100% 30%,100% 100%,50% 72%,0 100%,0 30%)"],
  ["pent", "polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)"],
  ["banner", "polygon(0 0,100% 0,100% 78%,50% 100%,0 78%)"],
  ["spade", "polygon(50% 0,100% 44%,74% 100%,26% 100%,0 44%)"],
  ["gem", "polygon(28% 0,72% 0,100% 34%,50% 100%,0 34%)"],
  ["tri", "polygon(50% 4%,100% 96%,0 96%)"],
  ["rune", "polygon(18% 0,82% 0,100% 22%,82% 100%,18% 100%,0 22%)"],
  ["visor", "polygon(0 18%,100% 18%,100% 62%,50% 100%,0 62%)"],
  ["wedge", "polygon(0 0,100% 0,74% 100%,26% 100%)"],
  ["fang", "polygon(50% 0,100% 30%,100% 70%,50% 100%,0 100%,0 0)"],
  ["prism", "polygon(50% 0,94% 25%,94% 75%,50% 100%,6% 75%,6% 25%)"],
  ["slab", "polygon(12% 0,88% 0,100% 14%,100% 86%,88% 100%,12% 100%,0 86%,0 14%)"],
  ["talon", "polygon(50% 0,100% 18%,88% 72%,50% 100%,12% 72%,0 18%)"],
  ["ward", "polygon(50% 0,100% 20%,100% 60%,50% 100%,0 60%,0 20%)"],
  ["pylon", "polygon(34% 0,66% 0,100% 26%,100% 74%,66% 100%,34% 100%,0 74%,0 26%)"],
  ["comet", "polygon(50% 0,100% 40%,72% 100%,28% 100%,0 40%)"],
  ["orb", "circle(46% at 50% 50%)"],
];
export const CREST_SHAPE_IDS = CREST_SHAPES.map(([k]) => k);

export const CREST_SYMBOLS = ["★", "✦", "☾", "⚔", "⛨", "✧", "☢", "✵", "⌘", "☠", "⚑", "♆", "⌬", "✜", "❂", "⟁", "◈", "⚙", "⚕", "☄", "✹", "⌖", "⏣", "⎔", "⨂", "⩊", "⟠", "⧗", "☗", "⚛", "➶", "♜", "☫", "⌁", "⍟", "⧉", "⚜", "☬", "✠", "♁", "⟴", "⌭", "⎈", "⏧", "✺", "⟡", "♞", "☤", "⚝", "⩩", "⧨", "♅", "⌇", "⏥", "☸", "✥"];

export const CREST_COLORS = [
  "#b866ff", "#4ee2ff", "#5cff8a", "#e8b94d", "#ff4d5e", "#ff5cf0", "#ff8c4d", "#9fb6d4",
  "#7d5cff", "#00d4a8", "#c8ff5c", "#ffd166", "#ff6f91", "#8affff", "#f2f7ff", "#5b6675",
  "#ff2e63", "#00ffc8", "#ffe14d", "#5c8cff", "#d94dff", "#7cff4d", "#ff9ecb", "#2a3140",
  "#c9a227", "#00a3ff", "#a8ff3d", "#ff5722", "#9d4edd", "#38e8b0", "#e6e6fa", "#101722",
];

export const CREST_FOCUS_TAGS = ["SECTOR WAR", "BOUNTY", "MINING", "SALVAGE", "EXPLORATION", "DUNGEONS", "TRADE", "ESCORT"];
export const CREST_CREATE_COST = 250000;

// admit: open|apply|invite (matches the Kit's cfAdmits keys exactly — not
// "closed", which does not exist as a charter-form option in the Kit).
export type ClanAdmission = "open" | "apply" | "invite";
export const CLAN_ADMISSIONS: ClanAdmission[] = ["open", "apply", "invite"];

// Same integer-shift shading the Kit's own shadeHex() does — used to derive
// the crest's band/face gradient stops from a single "outer colour" pick.
export function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255) + Math.round(255 * amt);
  let g = (n >> 8 & 255) + Math.round(255 * amt);
  let b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Donations convert to clan XP. Mcoins are weighted 100:1 against credits
// (mcoins are the real-money currency — see currency.ts) for both XP gain
// and the roster's "contribution" ranking.
export const CREDITS_PER_XP = 50;
export const MCOIN_CREDIT_WEIGHT = 100;

export function donationToXp(creditsAmount: number, mcoinsAmount: number): number {
  return Math.floor((creditsAmount + mcoinsAmount * MCOIN_CREDIT_WEIGHT) / CREDITS_PER_XP);
}

export function donationToContribution(creditsAmount: number, mcoinsAmount: number): number {
  return creditsAmount + mcoinsAmount * MCOIN_CREDIT_WEIGHT;
}

// XP required to REACH a given level (cumulative), quadratic curve — mirrors
// the shape of the player XP curve elsewhere in this codebase but scaled for
// clan-wide totals (many members donating), not one player's kills.
export function xpForLevel(level: number): number {
  return Math.round(2500 * level * level);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function maxMembersForLevel(level: number): number {
  return BASE_MAX_MEMBERS + Math.max(0, level - 1);
}

// Verbatim from the Kit's own CL_RES array (Cosmic Kit.dc.html ~line 6965):
// [id, name, icon, maxTier, tierBaseCost, unit, perTier, description, hex].
// costOf(r,l) = tierBaseCost*(l+1) — a flat-per-tier cost, not the
// exponential curve the old placeholder projects used.
export type ResearchProjectId = "hull" | "dmg" | "drive" | "cargo" | "salv" | "hon";

export type ResearchProject = {
  id: ResearchProjectId;
  name: string;
  description: string;
  maxTier: number;
  tierBaseCost: number;
  /** "%" (percentage stat) or " units" (flat additive, e.g. cargo). */
  unit: "%" | " units";
  /** Effect magnitude per tier — a %, or flat units when unit===" units". */
  perTier: number;
  hex: string;
};

export const CLAN_RESEARCH: Record<ResearchProjectId, ResearchProject> = {
  hull: {
    id: "hull", name: "Reinforced Plating", maxTier: 5, tierBaseCost: 180_000, unit: "%", perTier: 2.5, hex: "#4ee2ff",
    description: "Rolled alloy plate shipped to every hangar under the tag. Adds hull to each member's ship the moment they undock.",
  },
  dmg: {
    id: "dmg", name: "Focused Emitters", maxTier: 5, tierBaseCost: 240_000, unit: "%", perTier: 2.0, hex: "#ff4d5e",
    description: "Shared targeting firmware pushed to every weapon mount in the clan. Raises damage for anyone flying the banner.",
  },
  drive: {
    id: "drive", name: "Drive Calibration", maxTier: 5, tierBaseCost: 150_000, unit: "%", perTier: 3.0, hex: "#5cff8a",
    description: "Clan-wide engine profile. Shorter warp spool and quicker acceleration on every hull in the roster.",
  },
  cargo: {
    id: "cargo", name: "Hold Expansion", maxTier: 5, tierBaseCost: 120_000, unit: " units", perTier: 40, hex: "#e8b94d",
    description: "Modular hold frames fitted at the clan dock. Every member hauls more ore before a run has to end.",
  },
  salv: {
    id: "salv", name: "Salvage Rights", maxTier: 5, tierBaseCost: 210_000, unit: "%", perTier: 4.0, hex: "#ff5cf0",
    description: "Negotiated wreck claims across the rim. Better salvage yield from anything the clan kills.",
  },
  hon: {
    id: "hon", name: "Banner of Honor", maxTier: 5, tierBaseCost: 300_000, unit: "%", perTier: 5.0, hex: "#b866ff",
    description: "Season banner filed with the faction office. Raises the honor every member earns from contracts.",
  },
};

/** Flat-per-tier cost to fund tier `tier+1` (0-indexed current tier), matching the Kit's costOf(r,l) = base*(l+1). */
export function researchTierCost(id: ResearchProjectId, tier: number): number {
  return CLAN_RESEARCH[id].tierBaseCost * (tier + 1);
}

export type ResearchState = Partial<Record<ResearchProjectId, number>>;

/**
 * Push a clan's current research onto every online member's cached
 * playerData (engine.playerDataCache) so computeStats() and the loot/kill
 * event handlers see the new tier on their very next action — not just
 * after their next reconnect. Call after any mutation to a clan's research
 * or roster (fund/join/leave/kick). No-op for members who aren't currently
 * connected (their cache gets rebuilt fresh from the DB on their next login,
 * see socket/handler.ts's connection handler).
 */
export async function refreshClanResearchCache(clanId: number, db: any, schema: any): Promise<void> {
  const { getEngine } = await import("./engine.js");
  const engine = getEngine();
  if (!engine) return;
  const [clan] = await db.select({ research: schema.clans.research }).from(schema.clans).where(eq(schema.clans.id, clanId)).limit(1);
  const research = clan?.research ?? null;
  const members = await db.select({ id: schema.players.id }).from(schema.players).where(eq(schema.players.clanId, clanId));
  for (const m of members) {
    const cached = engine.playerDataCache.get(m.id);
    if (cached) cached.clanResearch = research;
  }
}

export function researchTier(research: ResearchState | null | undefined, id: ResearchProjectId): number {
  return Math.max(0, Math.min(CLAN_RESEARCH[id].maxTier, research?.[id] ?? 0));
}

/** The live effect magnitude for a project at its current tier — a % (e.g. 6 for tier 3 of a 2%/tier project) or flat units for cargo. */
export function researchEffectMag(research: ResearchState | null | undefined, id: ResearchProjectId): number {
  const proj = CLAN_RESEARCH[id];
  return researchTier(research, id) * proj.perTier;
}

/** Aggregate multipliers/bonuses a clan's research grants its members — 1.0 (or 0 for flat) = no bonus. Applied at computeStats() and the loot/kill event call sites. */
export function clanResearchMultipliers(research: ResearchState | null | undefined) {
  return {
    hullMul: 1 + researchEffectMag(research, "hull") / 100,
    damageMul: 1 + researchEffectMag(research, "dmg") / 100,
    speedMul: 1 + researchEffectMag(research, "drive") / 100,
    cargoFlatBonus: researchEffectMag(research, "cargo"), // flat units, not a %
    salvageMul: 1 + researchEffectMag(research, "salv") / 100,
    honorMul: 1 + researchEffectMag(research, "hon") / 100,
  };
}
