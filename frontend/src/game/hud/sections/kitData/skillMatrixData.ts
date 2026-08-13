// skillMatrixData.ts — echte Punkte/Premium für export/windows/I-07-skill-matrix.ts.
// Die Baumstruktur (Knoten/IDs/Layout) bleibt vorerst die Kit-eigene, da sie
// sich von der bestehenden Skilltree-Struktur des Projekts unterscheidet —
// ein ID-Mapping folgt als eigener Schritt.
import { state } from "../../../store";
import { hasPremium } from "../cargoActions";

export function buildSkillOpts(): { points: number; mcoins: number; premium: boolean; docked: boolean } {
  return {
    points: state.player.skillPoints,
    mcoins: state.player.mcoins,
    premium: hasPremium(),
    docked: !!state.dockedAt,
  };
}
