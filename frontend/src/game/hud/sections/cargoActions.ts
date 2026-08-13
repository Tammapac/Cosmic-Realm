// cargoActions.ts — einziger Mutationspfad des Cargo-Fensters. Ruft nur
// bestehende Store-Funktionen; keine eigene Spiellogik.

import { state, removeCargo, stationPrice, save, bump } from "../../store";
import { RESOURCES } from "../../types";
import { buildCargoSnapshot } from "./cargoBridge";

/** Premium-Status. Solange das Konto-Flag fehlt, ist der Zugang gesperrt. */
export function hasPremium(): boolean {
  const p = state.player as unknown as { premium?: boolean; premiumUntil?: number };
  if (typeof p.premium === "boolean") return p.premium;
  if (typeof p.premiumUntil === "number") return p.premiumUntil > Date.now();
  return false;
}

export function canSellHere(): boolean { return !!state.dockedAt; }

/** Alles im Hold zum Stationspreis verkaufen (nur angedockt). */
export function sellAllOre(): number {
  const station = state.dockedAt;
  if (!station) return 0;
  const lines = [...(state.player.cargo ?? [])];
  let earned = 0;
  for (const line of lines) {
    const unit = stationPrice(station, line.resourceId);
    const sold = removeCargo(line.resourceId, line.qty);
    earned += Math.round(unit * sold);
  }
  state.player.credits += earned;
  save();
  bump();
  return earned;
}

/**
 * Handelsdrohne losschicken: verkauft den Hold unterwegs zum Stationspreis
 * abzüglich Drohnengebühr. Nur mit Premium.
 */
export function launchTradeDrone(fee = 0.12): number {
  if (!hasPremium()) return 0;
  const snap = buildCargoSnapshot();
  if (!snap.lines.length) return 0;
  let earned = 0;
  for (const line of snap.lines) {
    const unit = line.unitValue || (RESOURCES[line.id]?.basePrice ?? 0);
    const sold = removeCargo(line.id, line.qty);
    earned += Math.round(unit * sold * (1 - fee));
  }
  state.player.credits += earned;
  save();
  bump();
  return earned;
}
