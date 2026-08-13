// zoneMapData.ts — echte Zonen-Kontakte für export/windows/I-04-zone-map.ts.
// Weltkoordinaten (state.player.zone-relativ, ±MAP_RADIUS) auf die Kit-eigene
// 1080×700-Kartenfläche projiziert, analog zu ZoneMapOverlay.tsx.
import { state } from "../../../store";
import { STATIONS, PORTALS, MAP_RADIUS } from "../../../types";

type Contact = [string, string, string, number, number, string, string];

const W = 1080, H = 700, PAD = 60;
const SCALE = (Math.min(W, H) / 2 - PAD) / MAP_RADIUS;
const cx = W / 2, cy = H / 2;
const px = (x: number) => cx + x * SCALE;
const py = (y: number) => cy + y * SCALE;

export function buildZoneMapOpts(): { zone: string; contacts: Contact[] } {
  const zoneId = state.player.zone;
  const contacts: Contact[] = [];

  for (const s of STATIONS.filter((s) => s.zone === zoneId)) {
    contacts.push([
      s.id, s.kind === "factory" ? "factory" : "station", s.name,
      px(s.pos.x), py(s.pos.y), s.kind === "factory" ? "ONLINE" : "DOCK OPEN",
      s.kind === "factory" ? "Refinery — processes ore on a shift clock." : "Station hub — repairs, refit, market and contracts.",
    ]);
  }
  for (const p of PORTALS.filter((p) => p.fromZone === zoneId)) {
    contacts.push([
      p.id, "portal", `Gate to ${p.toZone}`,
      px(p.pos.x), py(p.pos.y), "GATE",
      `Lane portal into ${p.toZone}.`,
    ]);
  }
  for (const e of state.enemies.filter((e) => e.hull > 0)) {
    contacts.push([
      e.id, "enemy", (e.name ?? e.type).toUpperCase(),
      px(e.pos.x), py(e.pos.y), e.isBoss ? "BOSS" : "HOSTILE",
      e.isBoss ? "Boss-tier hostile." : "Hostile contact.",
    ]);
  }
  for (const o of state.others ?? []) {
    contacts.push([
      o.id, "party", o.name,
      px(o.pos.x), py(o.pos.y), `LV ${o.level}`,
      "Nearby pilot.",
    ]);
  }

  return { zone: zoneId, contacts };
}
