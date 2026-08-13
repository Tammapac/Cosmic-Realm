import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

// ── Local development database (opt-in, inert in production) ───────────────
// Set LOCAL_DB=pglite in backend/.env to run against PGlite — Postgres compiled
// to WASM, stored in ./.local-db. No Postgres install, no Docker, no connection
// to the live database. Used to play the game locally without writing to
// production. Everything below is behind the env check and both modules are
// imported dynamically, so a server without LOCAL_DB never loads them and does
// not need @electric-sql/pglite installed at all.
const USE_PGLITE = process.env.LOCAL_DB === "pglite";

let database: unknown;

if (USE_PGLITE) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const client = new PGlite(process.env.LOCAL_DB_PATH || "./.local-db");
  const localDb = drizzlePglite(client, { schema });
  // The schema lives in ./.local-migrations, generated from schema.ts with
  // `drizzle-kit generate`. Applying it on every boot is cheap and idempotent,
  // and keeps the throwaway database in step after a schema change.
  await migrate(localDb, { migrationsFolder: "./.local-migrations" });
  console.log("[db] LOCAL PGlite database ready (no production data involved)");
  database = localDb;
} else {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX || "10"),
  });
  database = drizzle(pool, { schema });

  // players.is_admin is in schema.ts, and Drizzle expands every bare
  // `.select()` into an explicit column list — so on a database that has not
  // run the migration yet, EVERY query on players dies with 42703, login
  // included. Adding the column here keeps schema.ts and the database in step
  // on boot instead of leaving the server in a state where nobody can log in.
  //
  // Additive and idempotent: IF NOT EXISTS, NOT NULL DEFAULT false. No column
  // is dropped, renamed, or retyped, and no existing row changes meaning.
  // Deliberately grants admin to nobody — use the admin console for that.
  await pool.query(
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false",
  );
}

export const db = database as ReturnType<typeof drizzle<typeof schema>>;
export type DB = typeof db;
export { schema };
