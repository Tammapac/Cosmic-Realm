// ── Cosmic Realm loot core ─────────────────────────────────────────────────
// Shared, dependency-free, deterministic. Imported by BOTH the backend
// (generation, stat resolution — authoritative) and the frontend (display,
// tooltips, stat resolution for prediction). All tables are data — tune here.

// ── Types ──────────────────────────────────────────────────────────────────
export type Rarity =
  | "common" | "uncommon" | "rare" | "epic" | "legendary" | "relic" | "celestial";

export type RolledAffix = { id: string; tier: number; value: number };

export type ItemInstance = {
  instanceId: string;
  defId: string;
  // optional → legacy {instanceId, defId} items remain valid "clean" items
  ilvl?: number;
  rarity?: Rarity;
  seed?: number;
  affixes?: RolledAffix[];
  legendaryId?: string;
  bind?: "none" | "pickup";
  src?: string;
  ts?: number;
};

export type RarityDef = {
  weight: number;          // base drop weight
  minAffixes: number;
  maxAffixes: number;
  quality: [number, number]; // roll position within tier range
  minIlvl: number;
  salvageMul: number;
  color: string;
  frame: string;           // tooltip frame style key
};

export type ItemSlot = "weapon" | "generator" | "module";

export type AffixDef = {
  id: string;
  label: string;           // tooltip line, {v} placeholder
  namePart: string;        // display-name fragment
  kind: "prefix" | "suffix";
  statKey: string;         // ModuleStats key (fireRate = multiplicative)
  group: string;           // mutually exclusive group
  slots: ItemSlot[];
  weight: number;
  decimals: number;
  percent?: boolean;       // format value ×100 with %
  minIlvl?: number;
  tiers: [number, number][]; // 6 brackets: ilvl 1-10/11-20/21-30/31-40/41-50/51-60
};

// ── RNG (deterministic; seed persisted per item) ───────────────────────────
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Rarity table ───────────────────────────────────────────────────────────
export const RARITY_ORDER: Rarity[] =
  ["common", "uncommon", "rare", "epic", "legendary", "relic", "celestial"];

export const RARITIES: Record<Rarity, RarityDef> = {
  common:    { weight: 58,   minAffixes: 0, maxAffixes: 0, quality: [0.50, 0.80], minIlvl: 1,  salvageMul: 0.30, color: "#8aa0c0", frame: "plain" },
  uncommon:  { weight: 26,   minAffixes: 1, maxAffixes: 2, quality: [0.55, 0.85], minIlvl: 1,  salvageMul: 0.35, color: "#5cff8a", frame: "plain" },
  rare:      { weight: 10.5, minAffixes: 2, maxAffixes: 3, quality: [0.60, 0.90], minIlvl: 5,  salvageMul: 0.40, color: "#4ee2ff", frame: "lined" },
  epic:      { weight: 4,    minAffixes: 3, maxAffixes: 4, quality: [0.65, 0.95], minIlvl: 12, salvageMul: 0.45, color: "#ff5cf0", frame: "lined" },
  legendary: { weight: 1.2,  minAffixes: 2, maxAffixes: 3, quality: [0.70, 1.00], minIlvl: 20, salvageMul: 0.50, color: "#ffd24a", frame: "glow" },
  relic:     { weight: 0.25, minAffixes: 4, maxAffixes: 5, quality: [0.80, 1.00], minIlvl: 34, salvageMul: 0.60, color: "#ff6a3c", frame: "glow" },
  celestial: { weight: 0.04, minAffixes: 5, maxAffixes: 6, quality: [0.90, 1.00], minIlvl: 45, salvageMul: 0.80, color: "#9df2ff", frame: "star" },
};

// ── Item level ─────────────────────────────────────────────────────────────
export const ILVL_CAP = 60;
export const ILVL_BRACKETS = [10, 20, 30, 40, 50, 60];

export function affixTierForIlvl(ilvl: number): number {
  for (let i = 0; i < ILVL_BRACKETS.length; i++) {
    if (ilvl <= ILVL_BRACKETS[i]) return i;
  }
  return ILVL_BRACKETS.length - 1;
}

/** Effective enemy level from zone unlock level + roster rank. */
export function enemyLevelFor(zoneUnlock: number, typeRank: number, isBoss: boolean): number {
  return Math.max(1, Math.min(ILVL_CAP, zoneUnlock + typeRank * 2 + (isBoss ? 4 : 0)));
}

export function rollItemLevel(
  rnd: () => number,
  enemyLevel: number,
  opts: { isBoss?: boolean; isPirate?: boolean; zoneTier?: number },
): number {
  let ilvl = enemyLevel + Math.floor(rnd() * 4) - 1; // -1..+2 variance
  if (opts.isPirate) ilvl += 2;
  if (opts.isBoss) ilvl += 4;
  if ((opts.zoneTier ?? 1) >= 6) ilvl += 6;
  // bosses never drop below their intended level
  if (opts.isBoss) ilvl = Math.max(ilvl, enemyLevel);
  return Math.max(1, Math.min(ILVL_CAP, ilvl));
}

// ── Affix table ────────────────────────────────────────────────────────────
const T = (a: [number, number], b: [number, number], c: [number, number], d: [number, number], e: [number, number], f: [number, number]) => [a, b, c, d, e, f] as [number, number][];

export const AFFIXES: Record<string, AffixDef> = {
  // OFFENSE (weapons)
  dmg_flat:   { id: "dmg_flat",   label: "+{v} Damage",              namePart: "Vicious",     kind: "prefix", statKey: "damage",         group: "damage",     slots: ["weapon"],            weight: 10, decimals: 0, tiers: T([1,3],[3,6],[5,10],[9,16],[14,24],[20,34]) },
  rof_mult:   { id: "rof_mult",   label: "+{v}% Fire Rate",          namePart: "Overtuned",   kind: "prefix", statKey: "fireRate",       group: "firerate",   slots: ["weapon"],            weight: 7,  decimals: 3, percent: true, tiers: T([0.02,0.04],[0.03,0.06],[0.05,0.08],[0.07,0.11],[0.09,0.15],[0.12,0.20]) },
  crit:       { id: "crit",       label: "+{v}% Critical Chance",    namePart: "Deadeye",     kind: "suffix", statKey: "critChance",     group: "crit",       slots: ["weapon", "module"],  weight: 7,  decimals: 3, percent: true, tiers: T([0.005,0.012],[0.01,0.02],[0.018,0.03],[0.026,0.042],[0.038,0.058],[0.05,0.08]) },
  aoe:        { id: "aoe",        label: "+{v} Blast Radius",        namePart: "Volatile",    kind: "suffix", statKey: "aoeRadius",      group: "aoe",        slots: ["weapon"],            weight: 5,  decimals: 0, minIlvl: 8, tiers: T([1,3],[2,5],[4,8],[6,11],[9,15],[12,20]) },
  ammo_cap:   { id: "ammo_cap",   label: "+{v} Ammo Capacity",       namePart: "Extended",    kind: "suffix", statKey: "ammoCapacity",   group: "ammo",       slots: ["weapon"],            weight: 5,  decimals: 0, tiers: T([20,60],[50,120],[100,200],[170,320],[280,520],[400,800]) },
  // DEFENSE (generators / modules)
  shield_flat:{ id: "shield_flat",label: "+{v} Shield",              namePart: "Warded",      kind: "prefix", statKey: "shieldMax",      group: "shield",     slots: ["generator", "module"], weight: 10, decimals: 0, tiers: T([6,16],[15,34],[30,60],[55,110],[90,180],[150,280]) },
  regen:      { id: "regen",      label: "+{v}/s Shield Regen",      namePart: "Pulsing",     kind: "suffix", statKey: "shieldRegen",    group: "regen",      slots: ["generator"],         weight: 8,  decimals: 1, tiers: T([0.5,1.5],[1.2,2.6],[2.2,4.2],[3.6,6.2],[5.4,9],[8,14]) },
  absorb:     { id: "absorb",     label: "+{v}% Shield Absorb",      namePart: "Deflecting",  kind: "suffix", statKey: "shieldAbsorb",   group: "absorb",     slots: ["generator"],         weight: 5,  decimals: 3, percent: true, minIlvl: 10, tiers: T([0.004,0.01],[0.008,0.016],[0.014,0.024],[0.02,0.034],[0.028,0.048],[0.04,0.07]) },
  hull_flat:  { id: "hull_flat",  label: "+{v} Hull",                namePart: "Reinforced",  kind: "prefix", statKey: "hullMax",        group: "hull",       slots: ["generator", "module"], weight: 10, decimals: 0, tiers: T([8,20],[18,40],[35,75],[65,130],[110,220],[180,340]) },
  dr:         { id: "dr",         label: "+{v}% Damage Reduction",   namePart: "Bulwark",     kind: "suffix", statKey: "damageReduction",group: "dr",         slots: ["module"],            weight: 6,  decimals: 3, percent: true, minIlvl: 12, tiers: T([0.005,0.012],[0.01,0.02],[0.018,0.03],[0.028,0.045],[0.04,0.065],[0.055,0.09]) },
  // UTILITY
  spd:        { id: "spd",        label: "+{v} Speed",               namePart: "Slipstream",  kind: "suffix", statKey: "speed",          group: "speed",      slots: ["generator", "module"], weight: 8,  decimals: 0, tiers: T([3,8],[7,14],[12,22],[18,32],[28,46],[40,65]) },
  cargo:      { id: "cargo",      label: "+{v} Cargo Capacity",      namePart: "Freighter",   kind: "suffix", statKey: "cargoBonus",     group: "cargo",      slots: ["module"],            weight: 5,  decimals: 0, tiers: T([2,5],[4,9],[8,15],[13,24],[20,36],[30,50]) },
  loot:       { id: "loot",       label: "+{v}% Loot Bonus",         namePart: "Plundering",  kind: "suffix", statKey: "lootBonus",      group: "loot",       slots: ["module"],            weight: 4,  decimals: 3, percent: true, minIlvl: 6, tiers: T([0.01,0.03],[0.02,0.045],[0.035,0.065],[0.05,0.09],[0.07,0.13],[0.10,0.18]) },
  mining:     { id: "mining",     label: "+{v}% Mining Yield",       namePart: "Prospector",  kind: "suffix", statKey: "miningBonus",    group: "mining",     slots: ["module"],            weight: 4,  decimals: 3, percent: true, tiers: T([0.02,0.05],[0.04,0.08],[0.07,0.12],[0.10,0.17],[0.14,0.24],[0.20,0.34]) },
  // SMALL SHARED ROLLS (any slot; lets weapons pick up small defense etc.)
  hull_small: { id: "hull_small", label: "+{v} Hull Plating",        namePart: "Plated",      kind: "suffix", statKey: "hullMax",        group: "hull",       slots: ["weapon"],            weight: 4,  decimals: 0, tiers: T([4,10],[9,20],[17,36],[32,64],[55,105],[90,170]) },
  shield_small:{ id: "shield_small", label: "+{v} Shielding",        namePart: "Sheathed",    kind: "suffix", statKey: "shieldMax",      group: "shield",     slots: ["weapon"],            weight: 4,  decimals: 0, tiers: T([3,8],[7,16],[14,30],[26,52],[45,90],[75,140]) },
  dmg_small:  { id: "dmg_small",  label: "+{v} Weapon Link Damage",  namePart: "Linked",      kind: "prefix", statKey: "damage",         group: "damage",     slots: ["generator", "module"], weight: 4, decimals: 0, tiers: T([1,2],[2,3],[3,5],[4,8],[7,12],[10,17]) },
  spd_small:  { id: "spd_small",  label: "+{v} Thrust",              namePart: "Vectored",    kind: "prefix", statKey: "speed",          group: "speed",      slots: ["weapon"],            weight: 3,  decimals: 0, tiers: T([2,4],[3,7],[6,11],[9,16],[14,23],[20,33]) },
};

// ── Base item pool (references the game's MODULE_DEFS ids) ────────────────
// Base tier → ilvl eligibility window. New scheme: lasers span tier 0-10,
// rockets 0-5, gen/module 1-5. Windows spread evenly across the 1-60 ilvl
// range so a given enemy level rolls tier-appropriate bases.
export const BASE_TIER_ILVL: Record<number, [number, number]> = {
  0: [1, 8], 1: [1, 12], 2: [6, 20], 3: [12, 28], 4: [18, 34], 5: [24, 42],
  6: [30, 48], 7: [36, 54], 8: [42, 58], 9: [48, 60], 10: [54, 60],
};

export type BaseEntry = { defId: string; slot: ItemSlot; tier: number };

// Generated to mirror MODULE_DEFS' new tier catalog. Kept in code (not imported
// from the frontend) so backend + client agree without a cross-package import.
export const BASE_POOL: BaseEntry[] = [
  ...Array.from({ length: 11 }, (_, t) => ({ defId: `wp-laser-t${t}`, slot: "weapon" as ItemSlot, tier: t })),
  ...Array.from({ length: 6 }, (_, t) => ({ defId: `wp-rocket-t${t}`, slot: "weapon" as ItemSlot, tier: t })),
  ...Array.from({ length: 6 }, (_, t) => ({ defId: `gn-shield-t${t}`, slot: "generator" as ItemSlot, tier: t })),
  ...Array.from({ length: 6 }, (_, t) => ({ defId: `gn-speed-t${t}`, slot: "generator" as ItemSlot, tier: t })),
  // modules: 9 types x tier 0-4
  ...Array.from({ length: 9 }, (_, ty) =>
    Array.from({ length: 5 }, (_, t) => ({ defId: `md${ty}-t${t}`, slot: "module" as ItemSlot, tier: t }))).flat(),
];

// ── Legendary effects ──────────────────────────────────────────────────────
// Implemented as stat bundles (fireRate multiplicative) so server & client
// resolve them identically with no combat-code special cases.
export type LegendaryDef = {
  id: string;
  name: string;          // replaces the affix-generated display name
  blurb: string;         // flavor line in tooltip
  slots: ItemSlot[];
  minIlvl: number;
  stats: Record<string, number>;
};

export const LEGENDARIES: Record<string, LegendaryDef> = {
  sunreaver:   { id: "sunreaver",   name: "Sunreaver Protocol",   blurb: "Every shot carries a splinter of a dying star.",        slots: ["weapon"],    minIlvl: 20, stats: { damage: 12, critChance: 0.05 } },
  tempest:     { id: "tempest",     name: "Tempest Coil",         blurb: "The barrel never cools. It only sings faster.",         slots: ["weapon"],    minIlvl: 24, stats: { fireRate: 1.12, speed: 15 } },
  starving:    { id: "starving",    name: "The Starving Light",   blurb: "It eats armor and asks for more.",                      slots: ["weapon"],    minIlvl: 30, stats: { damage: 20, aoeRadius: 10 } },
  aegisheart:  { id: "aegisheart",  name: "Aegisheart",           blurb: "A reactor grown around a soldier's last promise.",      slots: ["generator"], minIlvl: 20, stats: { shieldMax: 120, shieldRegen: 4 } },
  nullcradle:  { id: "nullcradle",  name: "Null Cradle",          blurb: "The void holds you gently, for now.",                   slots: ["generator"], minIlvl: 28, stats: { shieldAbsorb: 0.05, shieldMax: 80, speed: 20 } },
  ironchoir:   { id: "ironchoir",   name: "Iron Choir",           blurb: "A thousand plates hum in harmony.",                     slots: ["module"],    minIlvl: 22, stats: { hullMax: 150, damageReduction: 0.04 } },
  wolfsigil:   { id: "wolfsigil",   name: "Wolf Sigil",           blurb: "Marked ships find prey where others find dust.",        slots: ["module"],    minIlvl: 26, stats: { critChance: 0.06, lootBonus: 1 } },
  ghostlattice:{ id: "ghostlattice",name: "Ghost Lattice",        blurb: "Half of you is always somewhere else.",                 slots: ["module"],    minIlvl: 32, stats: { speed: 45, damageReduction: 0.03 } },
};

export function rollLegendaryId(rnd: () => number, slot: ItemSlot, ilvl: number): string | undefined {
  const pool = Object.values(LEGENDARIES).filter((l) => l.slots.includes(slot) && ilvl >= l.minIlvl);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(rnd() * pool.length)].id;
}

// ── Loot profiles (enemy type → drop behavior) ─────────────────────────────
export type LootProfile = {
  equipChance: number;               // chance an equipment item drops at all
  rarityBonus: number;               // multiplies weights of rare+ tiers
  guaranteedMinRarity?: Rarity;      // bosses
  slotWeights?: Partial<Record<ItemSlot, number>>;
};

// Drop volume DRASTICALLY reduced from the old values (trash 0.04→0.010,
// standard 0.055→0.015, boss 1.0→0.35, etc.). Equipment is now a rare event
// for normal mobs; even bosses don't guarantee a drop.
export const LOOT_PROFILES: Record<string, LootProfile> = {
  trash:    { equipChance: 0.010, rarityBonus: 1.0 },
  standard: { equipChance: 0.015, rarityBonus: 1.15 },
  veteran:  { equipChance: 0.022, rarityBonus: 1.35 },
  heavy:    { equipChance: 0.035, rarityBonus: 1.6 },
  pirate:   { equipChance: 0.028, rarityBonus: 1.4 },
  boss:     { equipChance: 0.35,  rarityBonus: 2.2, guaranteedMinRarity: "rare" },
  worldElite: { equipChance: 0.05, rarityBonus: 1.9 },
};

export function profileForEnemy(type: string, isBoss: boolean, isPirate: boolean, zoneTier: number): LootProfile {
  if (isBoss) return LOOT_PROFILES.boss;
  if (isPirate) return LOOT_PROFILES.pirate;
  if (zoneTier >= 6) return LOOT_PROFILES.worldElite;
  if (type === "titan" || type === "juggernaut" || type === "dread" || type === "overlord" || type === "leviathan") return LOOT_PROFILES.heavy;
  if (type === "destroyer" || type === "sentinel" || type === "wraith" || type === "specter" || type === "phantom") return LOOT_PROFILES.veteran;
  if (type === "raider" || type === "corvette" || type === "voidling") return LOOT_PROFILES.standard;
  return LOOT_PROFILES.trash;
}

// ── Generation ─────────────────────────────────────────────────────────────
export type DropContext = {
  enemyType: string;
  enemyLevel: number;
  isBoss: boolean;
  isPirate: boolean;
  zoneTier: number;
  luck: number;        // killer lootBonus (0..~0.5)
  seed: number;
  instanceId: string;  // server-minted
};

function pickWeighted<Tk>(rnd: () => number, entries: [Tk, number][]): Tk {
  let total = 0;
  for (const [, w] of entries) total += w;
  let roll = rnd() * total;
  for (const [k, w] of entries) {
    roll -= w;
    if (roll <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export function rollRarity(rnd: () => number, ilvl: number, profile: LootProfile, luck: number): Rarity {
  const entries: [Rarity, number][] = [];
  for (const r of RARITY_ORDER) {
    const def = RARITIES[r];
    if (ilvl < def.minIlvl) continue;
    let w = def.weight;
    if (r !== "common" && r !== "uncommon") w *= profile.rarityBonus * (1 + luck);
    entries.push([r, w]);
  }
  let rarity = pickWeighted(rnd, entries);
  const floor = profile.guaranteedMinRarity;
  if (floor && RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(floor)) rarity = floor;
  return rarity;
}

export function rollAffixes(rnd: () => number, rarity: Rarity, ilvl: number, slot: ItemSlot): RolledAffix[] {
  const rdef = RARITIES[rarity];
  const count = rdef.minAffixes + Math.floor(rnd() * (rdef.maxAffixes - rdef.minAffixes + 1));
  if (count <= 0) return [];
  const tier = affixTierForIlvl(ilvl);
  const usedGroups = new Set<string>();
  const out: RolledAffix[] = [];
  for (let n = 0; n < count; n++) {
    const pool: [string, number][] = [];
    for (const [id, a] of Object.entries(AFFIXES)) {
      if (!a.slots.includes(slot)) continue;
      if (usedGroups.has(a.group)) continue;
      if (a.minIlvl && ilvl < a.minIlvl) continue;
      pool.push([id, a.weight]);
    }
    if (pool.length === 0) break;
    const id = pickWeighted(rnd, pool);
    const a = AFFIXES[id];
    usedGroups.add(a.group);
    const [lo, hi] = a.tiers[tier];
    const [qLo, qHi] = rdef.quality;
    const q = qLo + rnd() * (qHi - qLo);
    const raw = lo + (hi - lo) * q;
    const value = Number(raw.toFixed(a.decimals));
    out.push({ id, tier: tier + 1, value });
  }
  return out;
}

/** Full drop roll: returns a generated item or null (no equipment drop). */
export function rollDrop(ctx: DropContext): ItemInstance | null {
  const rnd = mulberry32(ctx.seed);
  const profile = profileForEnemy(ctx.enemyType, ctx.isBoss, ctx.isPirate, ctx.zoneTier);
  const chance = Math.min(1, profile.equipChance * (1 + ctx.luck));
  if (rnd() > chance) return null;

  const ilvl = rollItemLevel(rnd, ctx.enemyLevel, { isBoss: ctx.isBoss, isPirate: ctx.isPirate, zoneTier: ctx.zoneTier });
  const rarity = rollRarity(rnd, ilvl, profile, ctx.luck);

  // base pick: slot then eligible bases by ilvl window
  const slot = pickWeighted<ItemSlot>(rnd, [["weapon", 40], ["generator", 30], ["module", 30]]);
  let bases = BASE_POOL.filter((b) => {
    if (b.slot !== slot) return false;
    const [lo, hi] = BASE_TIER_ILVL[b.tier];
    return ilvl >= lo && ilvl <= hi;
  });
  if (bases.length === 0) bases = BASE_POOL.filter((b) => b.slot === slot);
  const base = bases[Math.floor(rnd() * bases.length)];

  const affixes = rollAffixes(rnd, rarity, ilvl, slot);
  const legendaryId =
    rarity === "legendary" || rarity === "relic" || rarity === "celestial"
      ? rollLegendaryId(rnd, slot, ilvl)
      : undefined;

  return {
    instanceId: ctx.instanceId,
    defId: base.defId,
    ilvl,
    rarity,
    seed: ctx.seed,
    affixes,
    legendaryId,
    bind: "none",
    src: `${ctx.isBoss ? "boss:" : ""}${ctx.enemyType}@t${ctx.zoneTier}`,
    ts: Date.now(),
  };
}

// ── Stat resolution (shared: identical on server & client) ─────────────────
/** Aggregated affix stats for one item. fireRate returned as a MULTIPLIER. */
export function resolveAffixStats(item: ItemInstance): Record<string, number> {
  const out: Record<string, number> = {};
  if (item.affixes) {
    for (const roll of item.affixes) {
      const a = AFFIXES[roll.id];
      if (!a) continue;
      if (a.statKey === "fireRate") {
        out.fireRate = (out.fireRate ?? 1) * (1 + roll.value);
      } else {
        out[a.statKey] = (out[a.statKey] ?? 0) + roll.value;
      }
    }
  }
  const leg = item.legendaryId ? LEGENDARIES[item.legendaryId] : undefined;
  if (leg) {
    for (const [k, v] of Object.entries(leg.stats)) {
      if (k === "fireRate") out.fireRate = (out.fireRate ?? 1) * v;
      else out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

// ── Display helpers ────────────────────────────────────────────────────────
export function rarityColor(r: Rarity | undefined, fallback: string): string {
  return r ? (RARITIES[r]?.color ?? fallback) : fallback;
}

export function affixLine(roll: RolledAffix): string {
  const a = AFFIXES[roll.id];
  if (!a) return "";
  const v = a.percent ? Math.round(roll.value * 1000) / 10 : roll.value;
  return a.label.replace("{v}", String(v)) + `  [T${roll.tier}]`;
}

/** Generated display name: Prefix + base + suffix, per rolled affixes. */
export function itemDisplayName(item: ItemInstance, baseName: string): string {
  const leg = item.legendaryId ? LEGENDARIES[item.legendaryId] : undefined;
  if (leg) return leg.name;
  if (!item.affixes || item.affixes.length === 0) return baseName;
  const prefix = item.affixes.map((r) => AFFIXES[r.id]).find((a) => a?.kind === "prefix");
  const suffix = item.affixes.map((r) => AFFIXES[r.id]).find((a) => a?.kind === "suffix");
  let name = baseName;
  if (prefix) name = `${prefix.namePart} ${name}`;
  if (suffix) name = `${name} ${suffixWord(suffix.namePart)}`;
  return name;
}
function suffixWord(part: string): string {
  return `of the ${part}`;
}

export function sellValue(item: ItemInstance, basePrice: number): number {
  const r = item.rarity ? RARITIES[item.rarity] : null;
  const affixCount = item.affixes?.length ?? 0;
  const ilvlMul = 1 + ((item.ilvl ?? 1) / ILVL_CAP);
  return Math.floor(basePrice * 0.4 * ilvlMul * (1 + affixCount * 0.15) * (r ? 1 + r.salvageMul : 1));
}

// ── Validation (server-authoritative guard; also used by tests) ────────────
export function validateItem(item: ItemInstance): string | null {
  if (!item || typeof item.instanceId !== "string" || typeof item.defId !== "string") return "malformed";
  if (item.ilvl !== undefined && (item.ilvl < 1 || item.ilvl > ILVL_CAP)) return "ilvl out of range";
  if (item.rarity !== undefined && !RARITIES[item.rarity]) return "unknown rarity";
  if (item.legendaryId !== undefined) {
    const leg = LEGENDARIES[item.legendaryId];
    if (!leg) return "unknown legendary " + item.legendaryId;
    if (!item.rarity || RARITY_ORDER.indexOf(item.rarity) < RARITY_ORDER.indexOf("legendary")) return "legendary effect on low rarity";
    if ((item.ilvl ?? 1) < leg.minIlvl) return "legendary below min ilvl";
  }
  if (item.affixes) {
    if (item.rarity === undefined) return "affixes without rarity";
    const rdef = RARITIES[item.rarity];
    if (item.affixes.length > rdef.maxAffixes) return "too many affixes for rarity";
    const groups = new Set<string>();
    const tierCap = affixTierForIlvl(item.ilvl ?? 1) + 1;
    for (const roll of item.affixes) {
      const a = AFFIXES[roll.id];
      if (!a) return "unknown affix " + roll.id;
      if (groups.has(a.group)) return "duplicate affix group " + a.group;
      groups.add(a.group);
      if (roll.tier > tierCap) return "affix tier above ilvl bracket";
      const [lo, hi] = a.tiers[roll.tier - 1] ?? [0, 0];
      // allow rounding wiggle
      if (roll.value < lo - Math.abs(lo) * 0.01 - 0.51 || roll.value > hi * 1.01 + 0.51) return "affix value out of tier range";
    }
  }
  return null;
}
