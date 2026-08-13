/**
 * S-03 · Missions Log — data + generator, MIGRATED verbatim from the export:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (LEVEL_MAPS, QTY_SCALE, MISSION_ENEMIES/ORES/TYPES, VARIANT_TIERS,
 *         DAILY_MISSIONS, MISSION_GEN, _missionAllCache)
 *
 * Unlike the other panels, the mission list is NOT authored data — it is
 * generated: 15 level bands x 6 difficulty variants per mission type, with the
 * objective text and briefing built by per-type template functions. Those
 * functions are reproduced here line for line, including the `idx % 2` / `% 3`
 * phrasing variants, because the strings ARE the design here — paraphrasing
 * them would silently change every mission in the game.
 */

export type MissionTypeKey = "kill" | "transport" | "delivery" | "exploration" | "gathering";

export interface MissionType {
  key: MissionTypeKey;
  label: string;
  icon: string;
  hex: string;
}

export const MISSION_TYPES: MissionType[] = [
  { key: "kill",        label: "KILL",        icon: "⚔", hex: "#ff4d5e" },
  { key: "transport",   label: "TRANSPORT",   icon: "▶", hex: "#4ee2ff" },
  { key: "delivery",    label: "DELIVERY",    icon: "◆", hex: "#5cff8a" },
  { key: "exploration", label: "EXPLORATION", icon: "✦", hex: "#b866ff" },
  { key: "gathering",   label: "GATHERING",   icon: "⛏", hex: "#8aa0c0" },
];

/** [minLevel, sector] — one band per entry, 15 total. */
export const LEVEL_MAPS: [number, string][] = [
  [1, "Halcyon Drift"], [2, "Halcyon Drift"], [3, "Halcyon Drift"], [4, "Halcyon Drift"],
  [5, "Halcyon Drift"], [10, "Foundry Belt"], [20, "Cold Reach"], [30, "Tessera Yards"],
  [40, "Ember Fields"], [50, "Warden Post"], [60, "Crimson Lane"], [70, "Black Furrow"],
  [80, "Rift Verge"], [90, "The Sable"], [100, "Outer Dark"],
];

/** Base objective quantity per level band, index-aligned with LEVEL_MAPS. */
export const QTY_SCALE = [3, 5, 7, 9, 12, 15, 35, 60, 90, 130, 175, 220, 270, 320, 380];

export const MISSION_ENEMIES = [
  "Void Drifters", "Void Drifters", "Void Drifters", "Void Drifters", "Void Drifters",
  "Raider Skiffs", "Sentinel Drones", "Scout Wings", "Reaver Packs", "Void Drifters",
  "Raider Skiffs", "Sentinel Drones", "Scout Wings", "Reaver Packs", "Void Warbringers",
];

export const MISSION_ORES = [
  "Silicate Dust", "Silicate Dust", "Silicate Dust", "Silicate Dust", "Silicate Dust",
  "Titanium Ore", "Iridium Ore", "Titanium Ore", "Silicate Dust", "Iridium Ore",
  "Titanium Ore", "Silicate Dust", "Iridium Ore", "Titanium Ore", "Iridium Ore",
];

/** [label, quantity multiplier] — six variants inside every level band. */
export const VARIANT_TIERS: [string, number][] = [
  ["MINOR", 0.45], ["STANDARD", 0.7], ["ADVANCED", 1],
  ["MAJOR", 1.35], ["CRITICAL", 1.75], ["APEX", 2.3],
];

export const UNIQUE_MAPS = [...new Set(LEVEL_MAPS.map((x) => x[1]))];

export interface DailyMission {
  name: string; obj: string; cur: number; max: number;
  credits: number; honor: number; exp: number; icon: string; hex: string;
}

export const DAILY_MISSIONS: DailyMission[] = [
  { name: "DAILY: RESUPPLY",      obj: "Spend 3,000 credits at stations.", cur: 3000, max: 3000, credits: 600, honor: 4, exp: 850,  icon: "$", hex: "#e8b94d" },
  { name: "DAILY: SECTOR ROUNDS", obj: "Warp between sectors 3 times.",    cur: 2,    max: 3,    credits: 700, honor: 6, exp: 1000, icon: "▶", hex: "#4ee2ff" },
  { name: "DAILY: ALPHA SWEEP",   obj: "Kill 8 hostiles in Alpha Sector.", cur: 5,    max: 8,    credits: 700, honor: 7, exp: 1100, icon: "⚔", hex: "#ff4d5e" },
];

export interface GeneratedMission {
  n: number;
  title: string;
  obj: string;
  briefing: string;
}

type BuildFn = (
  map: string, qty: number, enemy: string, ore: string,
  tier: string, idx: number, nearby?: string[], minN?: number,
) => GeneratedMission;

/**
 * Objective/briefing templates, verbatim from MISSION_GEN. The `idx % n`
 * branches produce the phrasing variety within a band — they are part of the
 * authored content, not incidental.
 */
export const MISSION_GEN: Record<MissionTypeKey, { prefixes?: string[]; build: BuildFn }> = {
  kill: {
    prefixes: ["Patrol Sweep", "Cull Order", "Containment Purge", "Bounty Sweep", "Siege Breaker", "Extermination"],
    build: (map, qty, enemy, _ore, _tier, idx) => {
      const singular = enemy.endsWith("s") ? enemy.slice(0, -1) : enemy;
      const weak = `${singular} Scouts`, elite = `${singular} Elites`;
      const mode = (idx || 0) % 3;
      if (mode === 1) {
        const q1 = Math.max(1, Math.round(qty * 0.65)), q2 = Math.max(1, qty - q1);
        return {
          n: qty, title: enemy,
          obj: `Destroy ${q1} ${weak} and ${q2} ${elite} in ${map}`,
          briefing: `Scouts report a mixed ${enemy.toLowerCase()} formation near ${map} — a screen of scouts backing a smaller cluster of elites. Break both lines: ${q1} scouts, ${q2} elites.`,
        };
      }
      if (mode === 2) {
        const q1 = Math.max(1, Math.round(qty * 0.5));
        const q2 = Math.max(1, Math.round(qty * 0.3));
        const q3 = Math.max(1, qty - q1 - q2);
        return {
          n: qty, title: enemy,
          obj: `Destroy ${q1} ${weak}, ${q2} ${enemy}, and ${q3} ${elite} in ${map}`,
          briefing: `The full ${enemy.toLowerCase()} chain of command has surfaced near ${map} — scouts, regulars, and elites alike. Clear ${q1} scouts, ${q2} regulars, and ${q3} elites to break the chain.`,
        };
      }
      return {
        n: qty, title: enemy,
        obj: `Destroy ${qty} ${enemy} in ${map}`,
        briefing: `Command has traced a ${enemy.toLowerCase()} presence building up around ${map}. Break their formation before it hardens — confirmed kills: ${qty}.`,
      };
    },
  },
  transport: {
    build: (map, qty, enemy, _ore, _tier, idx, nearby, minN) => {
      let n = Math.max(1, Math.round(Math.sqrt(qty) * 1.2));
      if (n <= (minN || 0)) n = (minN || 0) + 1;
      if ((idx || 0) % 2 === 1 && nearby && nearby[1] && nearby[1] !== map) {
        return {
          n, title: "Convoy Escort",
          obj: `Escort ${n} convoy run(s) from ${map} to ${nearby[1]}`,
          briefing: `A supply line is running from ${map} to ${nearby[1]}, and ${enemy.toLowerCase()} activity has been logged along the route. Ride escort for ${n} run(s) and see the convoy through.`,
        };
      }
      return {
        n, title: "Convoy Escort",
        obj: `Escort ${n} convoy run(s) through ${map}`,
        briefing: `A supply convoy is scheduled through ${map} and ${enemy.toLowerCase()} activity has been logged along the route. Ride escort for ${n} run(s) and see the convoy through.`,
      };
    },
  },
  delivery: {
    build: (map, qty, _enemy, _ore, _tier, idx, nearby, minN) => {
      let n = Math.max(2, Math.round(Math.sqrt(qty) * 2.7));
      if (n <= (minN || 0)) n = (minN || 0) + 1;
      if ((idx || 0) % 2 === 1 && nearby && nearby[1] && nearby[1] !== map) {
        return {
          n, title: "Cargo Contract",
          obj: `Deliver ${n} cargo crates from ${map} to ${nearby[1]}`,
          briefing: `${nearby[1]} station is short on hauling capacity. Pick up ${n} crates at ${map} and deliver them dockside before the contract window closes.`,
        };
      }
      return {
        n, title: "Cargo Contract",
        obj: `Deliver ${n} cargo crates to ${map}`,
        briefing: `${map} station is short on hauling capacity. Pick up ${n} crates and deliver them dockside before the contract window closes.`,
      };
    },
  },
  exploration: {
    build: (map, qty, _enemy, _ore, _tier, idx, nearby, minN) => {
      if ((idx || 0) % 2 === 1 && nearby && nearby.length >= 3) {
        let per = Math.max(1, Math.round((Math.sqrt(qty) * 1.3) / nearby.length));
        if (per <= (minN || 0)) per = (minN || 0) + 1;
        return {
          n: per, title: "Deep Scan",
          obj: `Scan ${per} sector(s) each across ${nearby.join(", ")}`,
          briefing: `Long-range sensors picked up unresolved contacts spanning three neighboring sectors. Chart ${per} sector(s) in each of ${nearby.join(", ")} and report anything that shouldn't be there.`,
        };
      }
      let n = Math.max(1, Math.round(Math.sqrt(qty) * 1.3));
      if (n <= (minN || 0)) n = (minN || 0) + 1;
      return {
        n, title: `Deep Scan · ${map}`,
        obj: `Scan ${n} unexplored sector(s) of ${map}`,
        briefing: `Long-range sensors picked up unresolved contacts drifting through ${map}. Chart ${n} sector(s) and report anything that shouldn't be there.`,
      };
    },
  },
  gathering: {
    build: (map, qty, _enemy, ore, _tier, _idx, _nearby, minN) => {
      let n = Math.round(qty * 3);
      if (n <= (minN || 0)) n = (minN || 0) + 1;
      return {
        n, title: `${ore} Extraction`,
        obj: `Mine ${n} ${ore} near ${map}`,
        briefing: `${ore} reserves near ${map} are running the refineries dry. Fill the hold with ${n} units before the price index moves again.`,
      };
    },
  },
};

export interface Mission {
  id: string;
  typeHex: string;
  typeIcon: string;
  level: number;
  map: string;
  tier: string;
  title: string;
  obj: string;
  briefing: string;
  credits: string;
  honor: number;
  exp: string;
  locked: boolean;
}

/**
 * Builds the full mission list for one type. Verbatim port of the export's
 * `_missionAllCache` IIFE.
 *
 * The jitter is deterministic on purpose — `sin(seed * 12.9898) * 43758.5453`
 * is the standard GPU hash-noise trick, so the same band always produces the
 * same quantities across reloads. Do NOT swap it for Math.random(): the list
 * would reshuffle on every render.
 *
 * `lastQty` / `lastN` enforce a strictly increasing objective size across the
 * six variants, so MINOR never asks for more than APEX after jitter.
 */
export function buildMissions(typeKey: MissionTypeKey, playerLevel: number): Mission[] {
  const t = MISSION_TYPES.find((mt) => mt.key === typeKey);
  if (!t) return [];
  const gen = MISSION_GEN[t.key];
  const list: Mission[] = [];

  LEVEL_MAPS.forEach(([mapLv, map], i) => {
    const qtyBase = QTY_SCALE[i], enemy = MISSION_ENEMIES[i], ore = MISSION_ORES[i];
    const nextLv = LEVEL_MAPS[i + 1] ? LEVEL_MAPS[i + 1][0] : null;
    const span = nextLv ? nextLv - mapLv : 0;
    const umIdx = Math.max(0, Math.min(UNIQUE_MAPS.indexOf(map), UNIQUE_MAPS.length - 3));
    const nearby = UNIQUE_MAPS.slice(umIdx, umIdx + 3);
    let lastQty = 0, lastN = 0;

    VARIANT_TIERS.forEach((tier, j) => {
      const seed = i * 37 + j * 101 + t.key.charCodeAt(0) * 7;
      const rnd = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
      const jitter = 0.7 + rnd * 0.75;
      let qty = Math.max(1, Math.round(qtyBase * tier[1] * jitter));
      if (qty <= lastQty) qty = lastQty + 1;
      lastQty = qty;

      const label = `LV ${span >= 10
        ? Math.round(mapLv + 1 + (j * (span - 2)) / (VARIANT_TIERS.length - 1))
        : mapLv}`;
      const built = gen.build(map, qty, enemy, ore, label, j, nearby, lastN);
      if (built.n !== undefined) lastN = built.n;

      const perUnit =
        t.key === "kill" ? 22 :
        t.key === "gathering" ? 1.8 :
        t.key === "transport" ? 180 :
        t.key === "delivery" ? 140 : 260;
      const credits = Math.round(qty * perUnit);
      const honor = Math.max(1, Math.round(credits * 0.028));
      const exp = Math.max(20, Math.round(credits * 0.55));

      list.push({
        id: `${t.key}-${i}-${tier[0]}`,
        typeHex: t.hex, typeIcon: t.icon,
        level: mapLv, map, tier: label,
        title: built.title, obj: built.obj, briefing: built.briefing,
        credits: credits.toLocaleString("en-US"),
        honor,
        exp: exp.toLocaleString("en-US"),
        locked: mapLv > playerLevel,
      });
    });
  });

  return list;
}

export const MISSION_PANEL_W = 1340;
/** Six tabs: DAILY + the five mission types. */
export const MISSION_TAB_PCT = 100 / 6;
