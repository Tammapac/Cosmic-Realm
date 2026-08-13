// cargoData.ts — echte Frachtraum-Daten für export/windows/I-06-cargo-hold.ts.
import { buildCargoSnapshot } from "../cargoBridge";
import { hasPremium } from "../cargoActions";
import { state } from "../../../store";

type Ore = [string, string, string, number, number, number, string];

const GRADE_GLYPH: Record<string, string> = {
  raw: "▪", refined: "◇", rare: "◆", exotic: "❖", relic: "✦",
};

export function buildCargoOpts(): { ores: Ore[]; capacity: number; premium: boolean; docked: boolean } {
  const snap = buildCargoSnapshot();
  const ores: Ore[] = snap.lines.map((l) => [
    l.id, l.name, GRADE_GLYPH[l.grade] ?? "▪", l.qty, l.unitValue, 1,
    `#${l.color.toString(16).padStart(6, "0")}`,
  ]);
  return { ores, capacity: snap.capacity, premium: hasPremium(), docked: !!state.dockedAt };
}
