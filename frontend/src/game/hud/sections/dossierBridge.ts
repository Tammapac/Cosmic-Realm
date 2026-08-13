// dossierBridge.ts — Snapshot und Mutationen für das Pilot-Dossier.
// Attribute liegen im Player-Store unter attrPoints; Karrieren und Statistik
// lesen aus player.stats, sofern vorhanden, sonst aus den Kit-Vorgaben.

import { state, save, bump } from "../../store";

export type AttrKey = "dmg" | "hp" | "sh" | "spd";

/** Wirkung je Punkt — 1 % Schaden, 1,5 % Hülle, 1,5 % Schild, 0,5 % Speed. */
export const ATTRS: { key: AttrKey; label: string; per: number; hex: number; stat: string }[] = [
  { key: "dmg", label: "DAMAGE", per: 1.0, hex: 0xff4d5e, stat: "weapon output" },
  { key: "hp", label: "HULL POINTS", per: 1.5, hex: 0x5cff8a, stat: "max hull" },
  { key: "sh", label: "MAX SHIELD", per: 1.5, hex: 0x4ee2ff, stat: "shield capacity" },
  { key: "spd", label: "SPEED", per: 0.5, hex: 0xe8b94d, stat: "flight speed" },
];

const BASE: Record<AttrKey, number> = { dmg: 0, hp: 0, sh: 0, spd: 0 };

/** Punkte pro Level; der Pool wächst mit dem Piloten. */
const POINTS_PER_LEVEL = 2;

export interface CareerPath {
  key: string; name: string; glyph: string; hex: string;
  level: number; xp: number; xpMax: number;
  metric: string; metricValue: string; title: string; perk: string;
}

export interface DossierSnapshot {
  name: string;
  clan: string;
  faction: string;
  level: number;
  rankNo: string;
  rankName: string;
  nextRank: string;
  honor: number;
  honorMax: number;
  pool: number;
  spent: Record<AttrKey, number>;
  careers: CareerPath[];
  record: { k: string; v: string; sub: string; hex: string; pct: number }[];
  progression: Record<string, { k: string; v: string; pct: number }[]>;
}

const RANKS = [
  "RECRUIT", "PILOT", "AIRMAN", "ENSIGN", "LIEUTENANT",
  "COMMANDER", "CAPTAIN", "ASCENDANT", "VANGUARD", "SOVEREIGN",
];

function ranksOf(p: Record<string, unknown>): Record<AttrKey, number> {
  const stored = p.attrPoints as Partial<Record<AttrKey, number>> | undefined;
  return { ...BASE, ...(stored ?? {}) };
}

export function buildDossierSnapshot(): DossierSnapshot {
  const p = state.player as unknown as Record<string, unknown>;
  const level = (p.level as number) ?? 1;
  const honor = (p.honor as number) ?? 0;
  const spent = ranksOf(p);
  const used = Object.values(spent).reduce((a, b) => a + b, 0);
  const rankIdx = Math.min(RANKS.length - 1, Math.floor(level / 7));
  const stats = (p.stats as Record<string, number>) ?? {};

  const kills = stats.npcKills ?? 0;
  const pvp = stats.playerKills ?? 0;
  const deaths = stats.deaths ?? 0;
  const contracts = stats.missionsDone ?? 0;
  const ore = stats.oreRefined ?? 0;
  const turnover = stats.creditsEarned ?? 0;
  const wrecks = stats.wrecksStripped ?? 0;
  const sectors = stats.sectorsCharted ?? 0;

  const path = (key: string, name: string, glyph: string, hexc: string, xp: number, metric: string, metricValue: string, perk: string): CareerPath => {
    const lvl = Math.max(1, Math.floor(Math.sqrt(xp / 60)));
    const span = (lvl + 1) * (lvl + 1) * 60;
    return {
      key, name, glyph, hex: hexc, level: lvl,
      xp: Math.round(xp % span), xpMax: Math.max(1, Math.round(span)),
      metric, metricValue,
      title: lvl >= 40 ? "MASTER" : lvl >= 30 ? "EXPERT" : lvl >= 20 ? "JOURNEYMAN" : "ADEPT",
      perk,
    };
  };

  const fmt = (n: number): string => n.toLocaleString("en-US");
  const short = (n: number): string =>
    n >= 1e6 ? (n / 1e6).toFixed(1) + " M" : n >= 1e3 ? fmt(Math.round(n)) : String(Math.round(n));

  return {
    name: (p.name as string) ?? "PILOT",
    clan: (p.clanTag as string) ? `${p.clanName ?? "CLAN"} ⟨${p.clanTag}⟩` : "NO CLAN",
    faction: (p.faction as string) ?? "EIC",
    level,
    rankNo: String(rankIdx).padStart(2, "0"),
    rankName: RANKS[rankIdx],
    nextRank: `RANK ${String(rankIdx + 1).padStart(2, "0")}`,
    honor,
    honorMax: Math.max(1000, (rankIdx + 1) * 20000),
    pool: level * POINTS_PER_LEVEL - used,
    spent,
    careers: [
      path("combat", "COMBAT", "✦", "#ff4d5e", kills * 6 + pvp * 40, "Ships destroyed", fmt(kills), "Critical chance against hostiles."),
      path("mining", "MINING", "◈", "#e8b94d", ore * 0.4, "Ore refined", short(ore) + " units", "Yield from rare asteroid seams."),
      path("trade", "TRADE", "⬢", "#5cff8a", turnover * 0.004, "Credits turned over", short(turnover), "Station fees cut across the rim."),
      path("contracts", "CONTRACTS", "▣", "#b866ff", contracts * 90, "Contracts cleared", fmt(contracts), "Extra reward roll on event contracts."),
      path("explore", "EXPLORATION", "◇", "#4ee2ff", sectors * 220, "Sectors charted", fmt(sectors), "Warp spool faster in unmapped space."),
      path("salvage", "SALVAGE", "⬡", "#ff5cf0", wrecks * 14, "Wrecks stripped", fmt(wrecks), "Relic salvage chance on capital wrecks."),
    ],
    record: [
      { k: "PLAYER KILLS", v: fmt(pvp), sub: `best streak ${stats.bestStreak ?? 0}`, hex: "#ff4d5e", pct: Math.min(100, pvp / 5) },
      { k: "NPC KILLS", v: fmt(kills), sub: `${fmt(stats.seasonKills ?? 0)} this season`, hex: "#ff8c4d", pct: Math.min(100, kills / 50) },
      { k: "CONTRACTS", v: fmt(contracts), sub: `${fmt(stats.eventMissions ?? 0)} event tier`, hex: "#b866ff", pct: Math.min(100, contracts / 14) },
      { k: "DEATHS", v: fmt(deaths), sub: deaths ? `${(kills / deaths).toFixed(2)} K/D` : "no losses", hex: "#9fb6d4", pct: Math.min(100, deaths / 5) },
      { k: "BOUNTIES", v: fmt(stats.bounties ?? 0), sub: `paid out ${short(stats.bountyCredits ?? 0)}`, hex: "#e8b94d", pct: Math.min(100, (stats.bounties ?? 0) / 5) },
      { k: "VOID RUNS", v: fmt(stats.voidRuns ?? 0), sub: `${fmt(stats.relics ?? 0)} relics pulled`, hex: "#ff5cf0", pct: Math.min(100, (stats.voidRuns ?? 0) / 3) },
    ],
    progression: {
      combat: [
        { k: "Ships destroyed", v: fmt(kills), pct: Math.min(100, kills / 50) },
        { k: "Players destroyed", v: fmt(pvp), pct: Math.min(100, pvp / 5) },
        { k: "Best killstreak", v: fmt(stats.bestStreak ?? 0), pct: Math.min(100, (stats.bestStreak ?? 0) * 3) },
        { k: "Losses", v: fmt(deaths), pct: Math.min(100, deaths / 5) },
      ],
      mining: [
        { k: "Ore refined", v: short(ore) + " units", pct: Math.min(100, ore / 20000) },
        { k: "Rare seams cracked", v: fmt(stats.rareSeams ?? 0), pct: Math.min(100, (stats.rareSeams ?? 0) / 8) },
        { k: "Best haul", v: fmt(stats.bestHaul ?? 0), pct: Math.min(100, (stats.bestHaul ?? 0) / 200) },
        { k: "Drones lost", v: fmt(stats.dronesLost ?? 0), pct: Math.min(100, (stats.dronesLost ?? 0) * 2) },
      ],
      trade: [
        { k: "Credits turned over", v: short(turnover), pct: Math.min(100, turnover / 500000) },
        { k: "Best single sale", v: short(stats.bestSale ?? 0), pct: Math.min(100, (stats.bestSale ?? 0) / 30000) },
        { k: "Routes run", v: fmt(stats.routesRun ?? 0), pct: Math.min(100, (stats.routesRun ?? 0) / 20) },
        { k: "Drone shipments", v: fmt(stats.droneRuns ?? 0), pct: Math.min(100, (stats.droneRuns ?? 0) / 8) },
      ],
      contracts: [
        { k: "Contracts cleared", v: fmt(contracts), pct: Math.min(100, contracts / 14) },
        { k: "Event contracts", v: fmt(stats.eventMissions ?? 0), pct: Math.min(100, (stats.eventMissions ?? 0) * 2) },
        { k: "Bounties collected", v: fmt(stats.bounties ?? 0), pct: Math.min(100, (stats.bounties ?? 0) / 5) },
        { k: "Failed", v: fmt(stats.missionsFailed ?? 0), pct: Math.min(100, (stats.missionsFailed ?? 0) * 2) },
      ],
      explore: [
        { k: "Sectors charted", v: fmt(sectors), pct: Math.min(100, sectors) },
        { k: "Void portals entered", v: fmt(stats.voidRuns ?? 0), pct: Math.min(100, (stats.voidRuns ?? 0) / 3) },
        { k: "Anomalies logged", v: fmt(stats.anomalies ?? 0), pct: Math.min(100, (stats.anomalies ?? 0) * 2) },
        { k: "Deep jumps", v: fmt(stats.warps ?? 0), pct: Math.min(100, (stats.warps ?? 0) / 15) },
      ],
      salvage: [
        { k: "Wrecks stripped", v: fmt(wrecks), pct: Math.min(100, wrecks / 40) },
        { k: "Relics recovered", v: fmt(stats.relics ?? 0), pct: Math.min(100, (stats.relics ?? 0) * 3) },
        { k: "Capital wrecks", v: fmt(stats.capitalWrecks ?? 0), pct: Math.min(100, (stats.capitalWrecks ?? 0) * 2) },
        { k: "Salvage sold", v: short(stats.salvageCredits ?? 0), pct: Math.min(100, (stats.salvageCredits ?? 0) / 100000) },
      ],
    },
  };
}

/** Verteilte Punkte festschreiben. */
export function commitAttributes(draft: Partial<Record<AttrKey, number>>): void {
  const p = state.player as unknown as Record<string, unknown>;
  const cur = ranksOf(p);
  const next: Record<AttrKey, number> = { ...cur };
  for (const a of ATTRS) next[a.key] = (next[a.key] ?? 0) + (draft[a.key] ?? 0);
  p.attrPoints = next;
  save();
  bump();
}

/** Alle Punkte zurück in den Pool. */
export function respecAttributes(): void {
  const p = state.player as unknown as Record<string, unknown>;
  p.attrPoints = { ...BASE };
  save();
  bump();
}

/** Wirksame Boni — für die Kampfrechnung: applyAttrBonus(base, "dmg"). */
export function attrBonus(key: AttrKey): number {
  const p = state.player as unknown as Record<string, unknown>;
  const a = ATTRS.find((x) => x.key === key)!;
  return (ranksOf(p)[key] ?? 0) * a.per / 100;
}
