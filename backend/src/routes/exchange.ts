// Server-authoritative Financial Exchange (Cosmic Kit E-01 port). All buy/
// sell/loan/repay math happens here against the server's own deterministic
// price walk (exchangeData.ts) and the player's real `credits` balance —
// the client only ever sends a ticker + quantity, never a price or total.
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  FIN_STOCKS, FIN_FAC, FIN_TICKER_INDEX, FIN_AUTO_REPAY_PCT,
  currentHour, currentMinute, currentIsoWeek, currentPrice, finHistory, loanRate, holdingsValue,
  limitForLevel, applyDailyInterest,
  type ExchangeHoldings,
} from "../game/exchangeData.js";

const router = Router();
router.use(authMiddleware);

function fmt2(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Resolves loan count for display/rate purposes — resets when the ISO week
// the player's last loan was taken in no longer matches the current one.
function effectiveLoanCount(player: { exchangeLoanCount: number; exchangeLoanWeek: number }): number {
  return player.exchangeLoanWeek === currentIsoWeek() ? player.exchangeLoanCount : 0;
}

// Loads the player and, if any days were missed since the last check, folds
// that day's compounded interest into exchangeDebt right away and persists
// it — so debt is always accurate the moment it's read, without a
// background cron. Every route below goes through this instead of a plain
// select, so interest can never be skipped by hitting a different endpoint.
async function loadPlayerWithInterest(playerId: number) {
  const [player] = await db.select().from(schema.players).where(eq(schema.players.id, playerId)).limit(1);
  if (!player) return null;

  const loanCount = effectiveLoanCount(player);
  const rate = loanRate(loanCount, player.exchangePremium);
  const { debt, lastInterestDay } = applyDailyInterest(player.exchangeDebt, rate, player.exchangeLastInterestDay);

  if (debt !== player.exchangeDebt || lastInterestDay !== player.exchangeLastInterestDay) {
    await db.update(schema.players)
      .set({ exchangeDebt: debt, exchangeLastInterestDay: lastInterestDay })
      .where(eq(schema.players.id, playerId));
    player.exchangeDebt = debt;
    player.exchangeLastInterestDay = lastInterestDay;
  }
  return player;
}

// GET /api/exchange — full market snapshot + the player's holdings/credit line.
router.get("/", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const player = await loadPlayerWithInterest(playerId);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const nowHour = currentHour();
    const nowMinute = currentMinute();
    const holdings = (player.exchangeHoldings ?? {}) as ExchangeHoldings;
    const loanCount = effectiveLoanCount(player);
    const rate = loanRate(loanCount, player.exchangePremium);
    const debt = player.exchangeDebt;
    const negative = player.credits < 0;
    const limit = limitForLevel(player.level);

    const stocks = FIN_STOCKS.map((row, i) => {
      const [ticker, name, fac] = row;
      const walk = finHistory(row[3], (i + 1) * 7.919, nowHour);
      const price = currentPrice(i, nowHour, nowMinute);
      const first = walk[0];
      const chg = ((price - first) / first) * 100;
      const held = holdings[ticker];
      const step = Math.max(1, Math.floor(walk.length / 12));
      const bars = walk.filter((_, j) => j % step === 0).slice(-12);
      return {
        ticker, name, faction: fac, factionName: FIN_FAC[fac].n, factionHex: FIN_FAC[fac].hex,
        price: fmt2(price), change: chg, spark: bars, history: walk,
        heldQty: held?.qty ?? 0,
      };
    });

    const netWorth = Math.round(player.credits + holdingsValue(holdings, nowHour, nowMinute) - debt);
    const portfolio = Object.keys(holdings).map((ticker) => {
      const idx = FIN_TICKER_INDEX[ticker];
      if (idx == null) return null;
      const row = FIN_STOCKS[idx];
      const price = currentPrice(idx, nowHour, nowMinute);
      const h = holdings[ticker];
      const val = price * h.qty;
      const cost = h.avg * h.qty;
      const pl = val - cost;
      return {
        ticker, name: row[1], faction: row[2], factionHex: FIN_FAC[row[2]].hex,
        qty: h.qty, avg: fmt2(h.avg), price: fmt2(price), value: Math.round(val),
        pl: Math.round(pl), plPct: cost ? (pl / cost) * 100 : 0,
      };
    }).filter(Boolean);

    res.json({
      netWorth, credits: player.credits, negative,
      debt, limit, rate, premium: player.exchangePremium,
      loanCount, autoRepayPct: FIN_AUTO_REPAY_PCT,
      stocks, portfolio,
    });
  } catch (err) {
    console.error("Exchange snapshot error:", err);
    res.status(500).json({ error: "Failed to load exchange" });
  }
});

// POST /api/exchange/trade { ticker, side: "buy"|"sell", qty }
router.post("/trade", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const { ticker, side, qty } = req.body;

    if (typeof ticker !== "string" || (side !== "buy" && side !== "sell")) {
      res.status(400).json({ error: "Invalid trade request" });
      return;
    }
    const quantity = Math.floor(Number(qty));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ error: "Quantity must be a positive integer" });
      return;
    }
    const idx = FIN_TICKER_INDEX[ticker];
    if (idx == null) { res.status(400).json({ error: "Unknown ticker" }); return; }

    const player = await loadPlayerWithInterest(playerId);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const price = currentPrice(idx);
    const holdings = { ...(player.exchangeHoldings ?? {}) } as ExchangeHoldings;
    const held = holdings[ticker] ?? { qty: 0, avg: 0 };

    if (side === "buy") {
      if (player.credits < 0) { res.status(400).json({ error: "Account negative — repay debt first" }); return; }
      const total = price * quantity;
      if (total > player.credits) { res.status(400).json({ error: "Insufficient credits" }); return; }

      const newQty = held.qty + quantity;
      holdings[ticker] = { qty: newQty, avg: (held.avg * held.qty + total) / newQty };
      const newCredits = player.credits - Math.round(total);
      await db.update(schema.players)
        .set({ exchangeHoldings: holdings, credits: newCredits })
        .where(eq(schema.players.id, playerId));
      res.json({ ok: true, ticker, side, qty: quantity, total: Math.round(total), credits: newCredits });
      return;
    }

    // sell
    if (!held.qty) { res.status(400).json({ error: "No shares held" }); return; }
    const sellQty = Math.min(quantity, held.qty);
    const proceeds = price * sellQty;
    const remain = held.qty - sellQty;
    if (remain <= 0) delete holdings[ticker];
    else holdings[ticker] = { qty: remain, avg: held.avg };

    const newCredits = player.credits + Math.round(proceeds);
    await db.update(schema.players)
      .set({ exchangeHoldings: holdings, credits: newCredits })
      .where(eq(schema.players.id, playerId));
    res.json({ ok: true, ticker, side, qty: sellQty, total: Math.round(proceeds), credits: newCredits });
  } catch (err) {
    console.error("Exchange trade error:", err);
    res.status(500).json({ error: "Trade failed" });
  }
});

// POST /api/exchange/loan { amount }
router.post("/loan", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const amount = Math.floor(Number(req.body.amount));
    if (!Number.isFinite(amount) || amount <= 0) { res.status(400).json({ error: "Invalid loan amount" }); return; }

    const player = await loadPlayerWithInterest(playerId);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    if (player.exchangeDebt + amount > limitForLevel(player.level)) {
      res.status(400).json({ error: "Exceeds credit limit" });
      return;
    }

    const week = currentIsoWeek();
    const loanCount = effectiveLoanCount(player) + 1;
    const newDebt = player.exchangeDebt + amount;
    const newCredits = player.credits + amount;

    await db.update(schema.players)
      .set({ exchangeDebt: newDebt, credits: newCredits, exchangeLoanCount: loanCount, exchangeLoanWeek: week })
      .where(eq(schema.players.id, playerId));

    res.json({ ok: true, debt: newDebt, credits: newCredits, rate: loanRate(loanCount, player.exchangePremium) });
  } catch (err) {
    console.error("Exchange loan error:", err);
    res.status(500).json({ error: "Loan failed" });
  }
});

// POST /api/exchange/repay — pays down debt from available credits (up to the full balance).
router.post("/repay", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const player = await loadPlayerWithInterest(playerId);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const pay = Math.min(player.exchangeDebt, Math.max(0, player.credits));
    if (pay <= 0) {
      res.status(400).json({ error: player.exchangeDebt <= 0 ? "No debt owed" : "No credits available" });
      return;
    }

    const newDebt = player.exchangeDebt - pay;
    const newCredits = player.credits - pay;
    await db.update(schema.players)
      .set({ exchangeDebt: newDebt, credits: newCredits })
      .where(eq(schema.players.id, playerId));

    res.json({ ok: true, paid: pay, debt: newDebt, credits: newCredits });
  } catch (err) {
    console.error("Exchange repay error:", err);
    res.status(500).json({ error: "Repay failed" });
  }
});

// POST /api/exchange/premium/toggle — waives credit-line interest entirely while active.
router.post("/premium/toggle", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const player = await loadPlayerWithInterest(playerId);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const premium = !player.exchangePremium;
    await db.update(schema.players).set({ exchangePremium: premium }).where(eq(schema.players.id, playerId));
    res.json({ ok: true, premium });
  } catch (err) {
    console.error("Exchange premium toggle error:", err);
    res.status(500).json({ error: "Toggle failed" });
  }
});

export default router;
