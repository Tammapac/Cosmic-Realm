// Leaderboard (Cosmic Kit I-13 port). GET /top kept for backward
// compatibility (existing simple sort/limit consumers); GET /board is the
// new full-fidelity endpoint the LeaderboardPanel React component reads —
// podium + ranked list + reward tiers + the requesting player's own
// standing, for one board/season pair at a time.
import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { creditCurrency } from "../game/currency.js";
import {
  LB_BOARDS, MONTHLY_TIERS, ALL_TIME_TIERS, monthlyTierFor, allTimeTierFor, monthlyCycleEndsAt, SEASON_LENGTH_MS,
  refreshLeaderboardBuffCache,
  type BoardId, type SeasonId, type AllTimeBuff,
} from "../game/leaderboardData.js";

const router = Router();

router.get("/top", async (req, res) => {
  try {
    const sort = (req.query.sort as string) || "honor";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const orderCol =
      sort === "level"
        ? schema.leaderboard.level
        : sort === "kills"
          ? schema.leaderboard.totalKills
          : schema.leaderboard.honor;

    const rows = await db
      .select()
      .from(schema.leaderboard)
      .orderBy(desc(orderCol))
      .limit(limit);

    res.json({ leaderboard: rows });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

type RankedPlayer = {
  playerId: number; name: string; faction: string | null; clanTag: string | null; value: number;
};

// Ranks all 100+ players for one board. level/honor/kills read from the
// denormalized leaderboard cache (cheap, low-stakes). credits reads
// players.credits live — it's a spendable server-authoritative balance and
// must never be ranked off a client-trusted cache.
async function rankBoard(board: BoardId): Promise<RankedPlayer[]> {
  if (board === "credits") {
    const rows = await db
      .select({
        playerId: schema.players.id, name: schema.players.name, faction: schema.players.faction,
        value: schema.players.credits, clanTag: schema.clans.tag,
      })
      .from(schema.players)
      .leftJoin(schema.clans, eq(schema.players.clanId, schema.clans.id))
      .orderBy(desc(schema.players.credits))
      .limit(100);
    return rows.map((r) => ({ ...r, clanTag: r.clanTag ?? null }));
  }

  const orderCol = board === "level" ? schema.leaderboard.level : board === "kills" ? schema.leaderboard.totalKills : schema.leaderboard.honor;
  const rows = await db
    .select()
    .from(schema.leaderboard)
    .orderBy(desc(orderCol))
    .limit(100);
  return rows.map((r) => ({
    playerId: r.playerId, name: r.playerName, faction: r.faction, clanTag: r.clanTag,
    value: board === "level" ? r.level : board === "kills" ? r.totalKills : r.honor,
  }));
}

async function getOrCreateSeason(board: BoardId) {
  const [row] = await db.select().from(schema.leaderboardSeason).where(eq(schema.leaderboardSeason.board, board)).limit(1);
  if (row) return row;
  const [created] = await db.insert(schema.leaderboardSeason).values({ board }).returning();
  return created;
}

// Grants/revokes the all-time top-3 buff the instant the ranking changes —
// no background job: this runs lazily on every /board read for `board`,
// same lazy-apply pattern as the Exchange's daily interest accrual. Cheap
// (3 seats) and idempotent (re-comparing an unchanged top-3 is a no-op).
async function resortAllTimeBuffs(board: BoardId, ranked: RankedPlayer[], previousTop3: number[]) {
  const newTop3 = ranked.slice(0, 3).map((p) => p.playerId);
  if (newTop3.length === previousTop3.length && newTop3.every((id, i) => id === previousTop3[i])) return;

  // Revoke: anyone who held a top-3 seat before but isn't in the new one.
  for (const oldId of previousTop3) {
    if (oldId != null && !newTop3.includes(oldId)) {
      await db.update(schema.players).set({ leaderboardAllTimeBuff: {} }).where(eq(schema.players.id, oldId));
      await refreshLeaderboardBuffCache(oldId, {});
    }
  }
  // Grant: the new top-3, each their own tier's buff.
  for (let i = 0; i < newTop3.length; i++) {
    const tier = allTimeTierFor(i + 1);
    if (!tier) continue;
    await db.update(schema.players).set({ leaderboardAllTimeBuff: tier.buff as AllTimeBuff }).where(eq(schema.players.id, newTop3[i]));
    await refreshLeaderboardBuffCache(newTop3[i], tier.buff);
  }

  await db.update(schema.leaderboardSeason).set({ allTimeTop3: newTop3 }).where(eq(schema.leaderboardSeason.board, board));
}

// Closes the monthly cycle the instant it's overdue (lazy, same pattern as
// above) — pays out MCoins to everyone in a reward bracket, then starts a
// fresh cycle. Reads the ranking that's already been computed for this
// request, so the payout reflects exactly what the player is looking at.
async function checkMonthlyPayout(board: BoardId, ranked: RankedPlayer[], seasonRow: { monthlyStartedAt: Date }) {
  const dueAt = seasonRow.monthlyStartedAt.getTime() + SEASON_LENGTH_MS;
  if (Date.now() < dueAt) return;

  for (let i = 0; i < ranked.length; i++) {
    const tier = monthlyTierFor(i + 1);
    if (!tier) break; // ranked is sorted; once we're past rank 100 nothing further qualifies
    await creditCurrency(ranked[i].playerId, "mcoins", tier.mcoins);
  }

  await db.update(schema.leaderboardSeason).set({ monthlyStartedAt: sql`now()` }).where(eq(schema.leaderboardSeason.board, board));
}

// GET /api/leaderboard/board?board=honor&season=monthly
router.get("/board", authMiddleware, async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const board = (req.query.board as BoardId) || "honor";
    const season = (req.query.season as SeasonId) || "monthly";
    if (!LB_BOARDS.some((b) => b.id === board)) { res.status(400).json({ error: "Unknown board" }); return; }

    const boardMeta = LB_BOARDS.find((b) => b.id === board)!;
    let ranked = await rankBoard(board);
    let seasonRow = await getOrCreateSeason(board);

    await resortAllTimeBuffs(board, ranked, (seasonRow.allTimeTop3 as number[]) ?? []);
    await checkMonthlyPayout(board, ranked, seasonRow);
    // Re-read after a possible payout/reset so `resetsAt` and the ranking
    // reflect the fresh cycle rather than the one that just closed.
    seasonRow = await getOrCreateSeason(board);
    ranked = await rankBoard(board);

    const meIdx = ranked.findIndex((p) => p.playerId === playerId);
    const meRank = meIdx >= 0 ? meIdx + 1 : null;

    const prizeFor = (rank: number): string => {
      if (season === "monthly") {
        const tier = monthlyTierFor(rank);
        return tier ? `${tier.mcoins.toLocaleString()} MC` : "";
      }
      const tier = allTimeTierFor(rank);
      return tier ? `+${Math.round((tier.buff.xpMul - 1) * 100)}% & PREMIUM` : "";
    };
    const noteFor = (rank: number): string => {
      if (season === "monthly") {
        const tier = monthlyTierFor(rank);
        return tier ? `paying ${tier.mcoins.toLocaleString()} MCoins` : "outside the hundred · no reward tier";
      }
      const tier = allTimeTierFor(rank);
      return tier ? `paying +${Math.round((tier.buff.xpMul - 1) * 100)}% boosts` : "outside the hundred · no reward tier";
    };

    const podium = ranked.slice(0, 3).map((p, i) => ({
      rank: i + 1, name: p.name, faction: p.faction, clanTag: p.clanTag, value: p.value,
      prize: prizeFor(i + 1),
    }));

    const rows = ranked.slice(3).map((p, i) => ({
      rank: i + 4, name: p.name, faction: p.faction, clanTag: p.clanTag, value: p.value, isMe: p.playerId === playerId,
    }));

    const meValue = ranked[meIdx]?.value ?? null;

    res.json({
      board, season, unit: boardMeta.unit,
      resetsAt: season === "monthly" ? monthlyCycleEndsAt(seasonRow.monthlyStartedAt) : null,
      boards: LB_BOARDS,
      podium, rows,
      you: { rank: meRank, value: meValue, note: meRank != null ? noteFor(meRank) : "outside the hundred · no reward tier" },
      rewards: {
        title: season === "monthly" ? "MONTHLY REWARDS" : "ALL-TIME REWARDS",
        hex: season === "monthly" ? "#e8b94d" : "#b866ff",
        brief: season === "monthly"
          ? "The monthly board wipes at the start of every cycle. Placement pays MCoins the moment the season closes, plus the cosmetics filed for that cycle."
          : "The all-time board never resets. Standing pays a permanent boost that applies while you hold the seat — lose the rank and the boost goes with it.",
        tiers: season === "monthly"
          ? MONTHLY_TIERS.map((t) => ({ rank: t.rank, badge: t.badge, premium: false, items: [`${t.mcoins.toLocaleString()} MCOINS`] }))
          : ALL_TIME_TIERS.map((t) => ({ rank: t.rank, badge: t.badge, premium: t.buff.premium, items: [`+${Math.round((t.buff.xpMul - 1) * 100)}% EXPERIENCE`, `+${Math.round((t.buff.creditsMul - 1) * 100)}% CREDITS`, ...(t.buff.premium ? ["PREMIUM WHILE HELD"] : [])] })),
      },
    });
  } catch (err) {
    console.error("Leaderboard board error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

export default router;
