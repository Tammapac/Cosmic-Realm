// dossierData.ts — echte Rang-/Attributdaten für export/windows/I-12-pilot-dossier.ts.
// Career-Pfade und Service-Record bleiben vorerst Kit-Platzhalter — DossierOpts
// deckt nur Rang/Honor/Attribute ab, nicht die reicheren Career-Daten aus
// dossierBridge.buildDossierSnapshot().
import { buildDossierSnapshot } from "../dossierBridge";

export function buildDossierOpts(): {
  name: string; faction: string; rank: number; rankName: string;
  honor: number; honorNext: number; spare: number;
  spent: Record<string, number>;
} {
  const snap = buildDossierSnapshot();
  return {
    name: snap.name,
    faction: snap.faction,
    rank: Number(snap.rankNo),
    rankName: snap.rankName,
    honor: snap.honor,
    honorNext: snap.honorMax,
    spare: snap.pool,
    spent: snap.spent,
  };
}
