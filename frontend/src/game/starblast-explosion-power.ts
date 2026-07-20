/**
 * explosionPower lookup table for Cosmic Realm's enemy types, derived from
 * Starblast's `O01OO` explosion-strength spec on ALIEN_TYPES
 * (starblastStandard.html:8990-9193) and the per-level array-indexing rule
 * in `t.prototype.getSpec` (starblastStandard.html:23828-23830):
 *
 *   getSpec(t) { e = this.type[t]; return Array.isArray(e) ? e[min(level, e.length-1)] : e }
 *
 * Every value below is copied verbatim from one of Starblast's own O01OO
 * arrays -- none are invented. Cosmic Realm has no "alien level" concept
 * (ENEMY_DEFS has no `level` field; enemies are one fixed type each, not a
 * leveled variant of a shared type like Starblast's Chicken/Crab/etc), so
 * per the task instructions ("ordne die Werte anhand von Größe, Level und
 * Bossstatus zu") the 15 Cosmic Realm EnemyTypes are ranked by `size`
 * (types.ts ENEMY_DEFS, the closest analogue to Starblast's per-level
 * `scale` progression) and mapped in ascending order onto Starblast's own
 * O01OO values, concatenated across all 11 alien types and sorted
 * ascending to form one ordered pool:
 *
 *   Caterpillar (scalar):        4
 *   Fork L0-L2:                  4, 5, 6
 *   Candlestick L0-L2:           4, 3, 2      -> sorted: 2, 3, 4
 *   Pointu (scalar):             4
 *   Crab L0-L2:                  4, 6, 8
 *   Chicken L0-L3:                4, 6, 8, 15
 *   Piranha L0-L3:                4, 4.5, 5, 10
 *   Saucer L0-L2:                 4, 8, 12
 *   Fortress L0-L1:               8, 10
 *   Hirsute L0-L1:                 8, 13
 *   Boss L0-L1:                    15, 25
 *
 * Full ascending pool (all values, duplicates kept):
 *   2, 3, 4, 4, 4, 4, 4, 4, 4, 4.5, 5, 5, 6, 6, 6, 8, 8, 8, 8, 8, 10, 10,
 *   12, 13, 15, 15, 25
 *
 * The 15 Cosmic Realm enemy types are sorted by `size` (ENEMY_DEFS) and
 * assigned 15 evenly-spaced samples from that pool (smallest size -> pool
 * front, largest -> pool tail), so weaker/smaller ships keep Starblast's
 * "weak alien" range and the largest/toughest ships land on Starblast's
 * "Fortress/Hirsute/Boss" range -- same ranking Starblast itself uses
 * (bigger scale/shield level -> bigger O01OO).
 */
import type { Enemy, EnemyType } from "./types";

const O01OO_POOL_ASCENDING = [
  2, 3, 4, 4, 4, 4, 4, 4, 4, 4.5, 5, 5, 6, 6, 6, 8, 8, 8, 8, 8, 10, 10, 12, 13, 15, 15, 25,
];

// EnemyType sorted ascending by ENEMY_DEFS[type].size (10 -> 40).
const ENEMY_TYPES_BY_SIZE: EnemyType[] = [
  "scout", // 10
  "interceptor", // 11
  "specter", // 12
  "wraith", // 12
  "raider", // 13
  "voidling", // 14
  "phantom", // 14
  "corvette", // 15
  "sentinel", // 16
  "destroyer", // 18
  "dread", // 24
  "titan", // 30
  "juggernaut", // 32
  "overlord", // 35
  "leviathan", // 40
];

function buildExplosionPowerTable(): Record<EnemyType, number> {
  const n = ENEMY_TYPES_BY_SIZE.length;
  const table = {} as Record<EnemyType, number>;
  for (let i = 0; i < n; i++) {
    // Evenly-spaced sample index into the ascending pool, same rank order.
    const poolIndex = Math.round((i / (n - 1)) * (O01OO_POOL_ASCENDING.length - 1));
    table[ENEMY_TYPES_BY_SIZE[i]] = O01OO_POOL_ASCENDING[poolIndex];
  }
  return table;
}

/** EnemyType -> explosionPower (Starblast's O01OO), ranked by ENEMY_DEFS
 *  size and sampled from Starblast's own O01OO value pool -- see module
 *  header for the derivation. */
export const EXPLOSION_POWER_BY_TYPE: Record<EnemyType, number> = buildExplosionPowerTable();

/** Starblast's own top-tier value (ALIEN_TYPES "Boss", O01OO: [15, 25],
 *  final/max level). Used for any Cosmic Realm enemy flagged isBoss,
 *  regardless of base type, so a boss-tagged scout still gets a
 *  boss-scale explosion -- matching the task's "Bossstatus" ranking
 *  criterion. 25 is O01OO's own maximum value (Boss level 1), not an
 *  invented number. */
const BOSS_EXPLOSION_POWER = 25;

/** Resolves the explosionPower for a specific enemy instance: isBoss
 *  overrides to Starblast's own Boss-tier value, otherwise the type's
 *  size-ranked value from EXPLOSION_POWER_BY_TYPE. */
export function explosionPowerFor(enemy: Pick<Enemy, "type" | "isBoss">): number {
  if (enemy.isBoss) return BOSS_EXPLOSION_POWER;
  return EXPLOSION_POWER_BY_TYPE[enemy.type] ?? 4;
}
