// galaxyMapData.ts — echtes Premium-Flag für export/windows/I-03-galaxy-map.ts.
// Die Sektorkarte (ZONES-Tabelle mit IDs wie "1-1") ist Kit-eigen und deckt
// sich nicht mit den echten Zone-IDs des Projekts (alpha/nebula/void/...) —
// "here"/"tracked" bleiben vorerst Kit-Platzhalter, bis ein Sektor-Mapping steht.
import { hasPremium } from "../cargoActions";

export function buildGalaxyOpts(): { premium: boolean } {
  return { premium: hasPremium() };
}
