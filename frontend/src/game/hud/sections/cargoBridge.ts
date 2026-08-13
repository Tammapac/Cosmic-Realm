// cargoBridge.ts — read-only Snapshot des Frachtraums für das Cargo-Fenster.
// Liest ausschließlich bestehende Store-Funktionen: player.cargo, RESOURCES,
// cargoUsed(), cargoCapacity(), stationPrice(). Keine Mutation.

import { state, subscribe, getSnapshot, cargoUsed, cargoCapacity, stationPrice } from "../../store";
import { RESOURCES } from "../../types";
import type { ResourceId } from "../../types";

export interface CargoLine {
  id: ResourceId;
  name: string;
  /** Anzeigename der Güteklasse — aus dem Grundpreis abgeleitet. */
  grade: string;
  qty: number;
  unitValue: number;
  color: number;
}

export interface CargoSnapshot {
  lines: CargoLine[];
  used: number;
  capacity: number;
  totalValue: number;
  docked: boolean;
  credits: number;
}

const GRADE_COLOR: [number, string, number][] = [
  // [Preisschwelle, Label, Farbe]
  [0, "raw", 0x8aa0c0],
  [12, "refined", 0x5cff8a],
  [40, "rare", 0x4ee2ff],
  [120, "exotic", 0xb866ff],
  [400, "relic", 0xff5cf0],
];

function grade(price: number): { label: string; color: number } {
  let g = GRADE_COLOR[0];
  for (const row of GRADE_COLOR) if (price >= row[0]) g = row;
  return { label: g[1], color: g[2] };
}

export function buildCargoSnapshot(): CargoSnapshot {
  const p = state.player;
  const station = state.dockedAt;
  const lines: CargoLine[] = (p.cargo ?? []).map((c) => {
    const def = RESOURCES[c.resourceId];
    const unit = station ? stationPrice(station, c.resourceId) : (def?.basePrice ?? 0);
    const g = grade(def?.basePrice ?? 0);
    return {
      id: c.resourceId,
      name: def?.name ?? String(c.resourceId),
      grade: g.label,
      qty: c.qty,
      unitValue: Math.round(unit),
      color: g.color,
    };
  });
  return {
    lines,
    used: cargoUsed(),
    capacity: cargoCapacity(),
    totalValue: lines.reduce((a, l) => a + l.qty * l.unitValue, 0),
    docked: !!station,
    credits: p.credits,
  };
}

/** Abo ohne React — meldet jede Store-Änderung. */
export function onCargoChange(cb: (rev: number) => void): () => void {
  let last = getSnapshot();
  return subscribe(() => {
    const now = getSnapshot();
    if (now !== last) { last = now; cb(now as unknown as number); }
  });
}
