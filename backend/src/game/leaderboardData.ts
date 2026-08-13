// ── Leaderboard (Cosmic Kit I-13) ───────────────────────────────────────────
// Ported 1:1 from the Cosmic Kit source (Cosmic Kit.dc.html, "I-13 ·
// LEADERBOARD" section — HTML template ~line 4706, LB_BOARDS/LB_REW ~line
// 7857, state builder ~line 5674). 4 boards, 2 seasons (monthly reset /
// all-time), real reward tiers — monthly pays MCoins once the cycle closes,
// all-time grants a permanent buff while the seat is held.

export type BoardId = "level" | "honor" | "kills" | "credits";
export type SeasonId = "monthly" | "alltime";

export const LB_BOARDS: { id: BoardId; label: string; hex: string; unit: string }[] = [
  { id: "level", label: "LEVEL", hex: "#4ee2ff", unit: "LEVEL" },
  { id: "honor", label: "HONOR", hex: "#ff5cf0", unit: "HONOR" },
  { id: "kills", label: "KILLS", hex: "#ff4d5e", unit: "KILLS" },
  { id: "credits", label: "CREDITS", hex: "#e8b94d", unit: "CREDITS" },
];

// Monthly payout in MCoins, by rank tier — index matches the tier bracket
// below. `badge` is the Kit's own short glyph for the reward-card icon
// (LB_REW tiers array: ["RANK 1","1st",[...],true] — element 1).
export const MONTHLY_TIERS: { rank: string; badge: string; range: [number, number]; mcoins: number }[] = [
  { rank: "RANK 1", badge: "1st", range: [1, 1], mcoins: 25_000 },
  { rank: "RANK 2", badge: "2nd", range: [2, 2], mcoins: 15_000 },
  { rank: "RANK 3", badge: "3rd", range: [3, 3], mcoins: 10_000 },
  { rank: "RANK 4 – 10", badge: "4-10", range: [4, 10], mcoins: 4_000 },
  { rank: "RANK 11 – 50", badge: "11+", range: [11, 50], mcoins: 1_500 },
  { rank: "RANK 51 – 100", badge: "51+", range: [51, 100], mcoins: 500 },
];

// All-time permanent buff, by rank tier — only ranks 1-3 grant "PREMIUM
// WHILE HELD"; ranks 4+ grant the percentage boosts only. Revoked the
// instant the player drops out of that bracket (see resortAllTime()).
export type AllTimeBuff = { xpMul: number; creditsMul: number; premium: boolean };
export const ALL_TIME_TIERS: { rank: string; badge: string; range: [number, number]; buff: AllTimeBuff }[] = [
  { rank: "RANK 1", badge: "1st", range: [1, 1], buff: { xpMul: 1.15, creditsMul: 1.15, premium: true } },
  { rank: "RANK 2", badge: "2nd", range: [2, 2], buff: { xpMul: 1.12, creditsMul: 1.12, premium: true } },
  { rank: "RANK 3", badge: "3rd", range: [3, 3], buff: { xpMul: 1.10, creditsMul: 1.10, premium: true } },
  { rank: "RANK 4 – 10", badge: "4-10", range: [4, 10], buff: { xpMul: 1.06, creditsMul: 1.06, premium: false } },
  { rank: "RANK 11 – 50", badge: "11+", range: [11, 50], buff: { xpMul: 1.03, creditsMul: 1.03, premium: false } },
  { rank: "RANK 51 – 100", badge: "51+", range: [51, 100], buff: { xpMul: 1.01, creditsMul: 1, premium: false } },
];

/** Reads a player's cached leaderboard buff (any bracket, not just top-3) as loot multipliers — 1.0 = no bonus. Applied at the same 4 loot-payout sites as clanResearchMultipliers. */
export function leaderboardBuffMultipliers(buff: Partial<AllTimeBuff> | null | undefined) {
  return {
    xpMul: buff?.xpMul ?? 1,
    creditsMul: buff?.creditsMul ?? 1,
  };
}

export function monthlyTierFor(rank: number) {
  return MONTHLY_TIERS.find((t) => rank >= t.range[0] && rank <= t.range[1]) ?? null;
}
export function allTimeTierFor(rank: number) {
  return ALL_TIME_TIERS.find((t) => rank >= t.range[0] && rank <= t.range[1]) ?? null;
}

export const SEASON_LENGTH_MS = 30 * 24 * 3_600_000; // 30-day monthly cycle

export function monthlyCycleEndsAt(startedAt: Date): number {
  return startedAt.getTime() + SEASON_LENGTH_MS;
}

/**
 * Push a player's just-changed all-time buff onto their cached playerData
 * (engine.playerDataCache) so the loot/kill event handlers — which read
 * leaderboardAllTimeBuff live off that cache, same as clanResearch — apply
 * it on their very next kill instead of waiting for a reconnect. No-op for
 * players who aren't currently connected (rebuilt fresh from the DB on
 * their next login, see socket/handler.ts).
 */
export async function refreshLeaderboardBuffCache(playerId: number, buff: AllTimeBuff | {}): Promise<void> {
  const { getEngine } = await import("./engine.js");
  const engine = getEngine();
  if (!engine) return;
  const cached = engine.playerDataCache.get(playerId);
  if (cached) cached.leaderboardAllTimeBuff = buff;
}
