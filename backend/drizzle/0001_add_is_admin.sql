-- Adds the staff flag that replaces the hardcoded `playerId === 3` admin
-- checks in socket/handler.ts, and grants the Administrator rank badge.
--
-- Safe to run against live data and safe to run twice:
--   * ADD COLUMN IF NOT EXISTS  -> no error if it already ran
--   * NOT NULL DEFAULT false    -> every existing row becomes a non-admin,
--                                  no row is otherwise touched
--   * no column is dropped, renamed, or retyped
--
-- The UPDATE carries the previous hardcoded admin (player id 3, "Tammapac")
-- over to the new flag. WITHOUT IT THE ONLY ADMIN LOCKS THEMSELVES OUT the
-- moment the server starts reading is_admin instead of the hardcoded id.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

UPDATE players SET is_admin = true WHERE id = 3;

-- Verification (should return exactly the accounts you expect to be staff):
--   SELECT id, name, is_admin FROM players WHERE is_admin = true;
