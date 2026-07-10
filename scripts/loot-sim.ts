// ── Loot distribution simulator ────────────────────────────────────────────
// Run: cd backend && npx tsx ../scripts/loot-sim.ts
// Rolls 50k kills per scenario and prints drop-rate / rarity / ilvl / affix
// distribution tables for balancing.
import {
  RARITY_ORDER, rollDrop, type ItemInstance,
} from "../lib/loot/loot.js";
import { MODULE_DEFS } from "../frontend/src/game/types";

const N = 50_000;

type Scenario = {
  name: string;
  enemyType: string; enemyLevel: number;
  isBoss: boolean; isPirate: boolean; zoneTier: number; luck: number;
};

const SCENARIOS: Scenario[] = [
  { name: "T1 scout (lvl 1, no luck)",        enemyType: "scout",     enemyLevel: 1,  isBoss: false, isPirate: false, zoneTier: 1, luck: 0 },
  { name: "T2 raider (lvl 10)",               enemyType: "raider",    enemyLevel: 10, isBoss: false, isPirate: false, zoneTier: 2, luck: 0 },
  { name: "T3 destroyer (lvl 22)",            enemyType: "destroyer", enemyLevel: 22, isBoss: false, isPirate: false, zoneTier: 3, luck: 0.12 },
  { name: "T3 pirate (lvl 20)",               enemyType: "raider",    enemyLevel: 20, isBoss: false, isPirate: true,  zoneTier: 3, luck: 0 },
  { name: "T4 sentinel (lvl 30)",             enemyType: "sentinel",  enemyLevel: 30, isBoss: false, isPirate: false, zoneTier: 4, luck: 0.24 },
  { name: "T5 titan (lvl 40, heavy)",         enemyType: "titan",     enemyLevel: 40, isBoss: false, isPirate: false, zoneTier: 5, luck: 0.24 },
  { name: "T4 BOSS overlord (lvl 32)",        enemyType: "overlord",  enemyLevel: 32, isBoss: true,  isPirate: false, zoneTier: 4, luck: 0 },
  { name: "T6+ world elite leviathan (l50)",  enemyType: "leviathan", enemyLevel: 50, isBoss: false, isPirate: false, zoneTier: 6, luck: 0.36 },
  { name: "T6 BOSS leviathan (lvl 55, luck)", enemyType: "leviathan", enemyLevel: 55, isBoss: true,  isPirate: false, zoneTier: 6, luck: 0.5 },
];

function pct(n: number, d: number): string {
  return d === 0 ? "-" : ((n / d) * 100).toFixed(2).padStart(6) + "%";
}

let seedBase = 1;
for (const sc of SCENARIOS) {
  const byRarity: Record<string, number> = {};
  const bySlot: Record<string, number> = {};
  const ilvls: number[] = [];
  let drops = 0, legendaries = 0, affixTotal = 0;

  for (let i = 0; i < N; i++) {
    const item = rollDrop({
      enemyType: sc.enemyType, enemyLevel: sc.enemyLevel,
      isBoss: sc.isBoss, isPirate: sc.isPirate, zoneTier: sc.zoneTier,
      luck: sc.luck, seed: (seedBase + i * 2654435761) >>> 0, instanceId: `sim-${i}`,
    });
    if (!item) continue;
    drops++;
    byRarity[item.rarity!] = (byRarity[item.rarity!] ?? 0) + 1;
    const def = MODULE_DEFS[item.defId];
    bySlot[def?.slot ?? "?"] = (bySlot[def?.slot ?? "?"] ?? 0) + 1;
    ilvls.push(item.ilvl ?? 0);
    affixTotal += item.affixes?.length ?? 0;
    if (item.legendaryId) legendaries++;
  }
  seedBase += N * 7 + 911;

  ilvls.sort((a, b) => a - b);
  const q = (p: number) => ilvls.length ? ilvls[Math.min(ilvls.length - 1, Math.floor(p * ilvls.length))] : 0;

  console.log(`\n═══ ${sc.name} ═══`);
  console.log(`  kills ${N.toLocaleString()} → drops ${drops.toLocaleString()} (${pct(drops, N).trim()})`);
  if (drops === 0) continue;
  console.log(`  rarity: ` + RARITY_ORDER
    .filter((r) => byRarity[r])
    .map((r) => `${r} ${pct(byRarity[r], drops).trim()}`)
    .join(" · "));
  console.log(`  slots:  ` + Object.entries(bySlot).map(([s, n]) => `${s} ${pct(n, drops).trim()}`).join(" · "));
  console.log(`  ilvl:   min ${ilvls[0]} · p25 ${q(0.25)} · median ${q(0.5)} · p75 ${q(0.75)} · max ${ilvls[ilvls.length - 1]}`);
  console.log(`  affixes/item avg ${(affixTotal / drops).toFixed(2)} · legendary effects ${legendaries} (${pct(legendaries, drops).trim()} of drops)`);
}

console.log("\ndone.");
