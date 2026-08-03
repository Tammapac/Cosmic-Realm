// ── Server-authoritative currency ledger ───────────────────────────────────
// bebcell (boss-drop material) and mcoins (REAL-MONEY currency) are mutated
// ONLY through the two functions below. Nothing else — not the client, not
// the /save route, not stats:update — may write these DB columns; see the
// callers list in each function's comment. An admin editing the DB directly
// (TablePlus etc.) remains the one other legitimate writer, by design: the
// client can never overwrite that edit back, since these columns are no
// longer part of the client-writable save payload (backend/src/routes/player.ts).
//
// Both operations run as single atomic UPDATEs (`SET x = x + $delta`, or for
// spends `WHERE x >= $amount`), so concurrent requests for the same player
// (e.g. two rapid boss kills, or a kill racing an upgrade) can never produce
// a negative balance or lose a credit to a lost-update race.
import { sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export type CurrencyField = "bebcell" | "mcoins";

// Accepts either the module-level `db` or a `tx` handle from
// `db.transaction(tx => ...)` — drizzle gives the transaction callback's
// parameter a structurally different (but query-compatible) type than `db`
// itself, so `DB` alone doesn't satisfy both; this derives the exact
// parameter type `db.transaction` expects, unioned with `typeof db`.
type QueryClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Credit `amount` (must be a positive integer) to a player's balance.
 * Callers: boss-kill loot payout (engine.ts), and — in future — a verified
 * real-money purchase webhook for mcoins. Never call this from anything that
 * merely reflects a client-reported number; `amount` must be server-rolled
 * or otherwise independently derived.
 *
 * `client` defaults to the module-level `db` but accepts a transaction
 * handle (from `db.transaction(tx => ...)`) so a caller can combine this
 * with another write — e.g. drone:upgrade's spend + level-up — as one
 * atomic unit that can't half-apply on a crash.
 */
export async function creditCurrency(
  playerId: number,
  field: CurrencyField,
  amount: number,
  client: QueryClient = db,
): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error(`creditCurrency: invalid amount ${amount} for ${field}`);
  }
  const column = schema.players[field];
  const [row] = await client
    .update(schema.players)
    .set({ [field]: sql`${column} + ${amount}` })
    .where(sql`${schema.players.id} = ${playerId}`)
    .returning({ value: column });
  if (!row) throw new Error(`creditCurrency: player ${playerId} not found`);
  return row.value as number;
}

/**
 * Debit `amount` from a player's balance, atomically, only if the balance is
 * sufficient. Returns the new balance on success, or null if the player
 * couldn't afford it (balance unchanged) — callers must treat null as "spend
 * rejected" and not apply whatever the spend was for (e.g. don't grant a
 * drone upgrade if this returns null).
 * Callers: drone upgrade (socket handler), any future shop purchase.
 * See `creditCurrency` above for the `client` param (transaction support).
 */
export async function spendCurrency(
  playerId: number,
  field: CurrencyField,
  amount: number,
  client: QueryClient = db,
): Promise<number | null> {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error(`spendCurrency: invalid amount ${amount} for ${field}`);
  }
  const column = schema.players[field];
  const [row] = await client
    .update(schema.players)
    .set({ [field]: sql`${column} - ${amount}` })
    .where(sql`${schema.players.id} = ${playerId} AND ${column} >= ${amount}`)
    .returning({ value: column });
  return row ? (row.value as number) : null;
}

/** Read-only balance fetch — for handlers that need to display/report state
 * without mutating it (e.g. hydrating a fresh login). */
export async function getCurrencyBalances(
  playerId: number,
): Promise<{ bebcell: number; mcoins: number } | null> {
  const [row] = await db
    .select({ bebcell: schema.players.bebcell, mcoins: schema.players.mcoins })
    .from(schema.players)
    .where(sql`${schema.players.id} = ${playerId}`)
    .limit(1);
  return row ?? null;
}
