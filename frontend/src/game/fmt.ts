// ── Number display formatting ──────────────────────────────────────────────
// Single source of truth for how numbers are shown to the player. Caps every
// value to at most 2 decimals and trims trailing zeros (so 3 stays "3",
// 1.5 stays "1.5", 3.33333 becomes "3.33", 0.15000001 becomes "0.15").

/** At most 2 decimals, trailing zeros trimmed. Use for any stat/number shown. */
export function fmtStat(n: number): string {
  if (n == null || Number.isNaN(n)) return "0";
  // round to 2 decimals, then drop trailing zeros via Number()
  const r = Math.round(n * 100) / 100;
  return String(r);
}

/** Percentage from a 0..1 fraction, rounded to a whole percent. */
export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
