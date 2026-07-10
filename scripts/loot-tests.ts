// ── Loot system test suite ─────────────────────────────────────────────────
// Run: cd backend && npx tsx ../scripts/loot-tests.ts
// Plain assertions, no framework. Exit code 0 = all green.
import {
  AFFIXES, BASE_POOL, ILVL_CAP, LEGENDARIES, LOOT_PROFILES, RARITIES, RARITY_ORDER,
  affixTierForIlvl, mulberry32, resolveAffixStats, rollAffixes, rollDrop, rollItemLevel,
  rollRarity, validateItem,
  type ItemInstance, type Rarity,
} from "../lib/loot/loot.js";
import { MODULE_DEFS } from "../frontend/src/game/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ FAIL ${name}${detail ? " — " + detail : ""}`); }
}
function section(name: string) { console.log(`\n■ ${name}`); }

// ── 1. Base pool integrity ─────────────────────────────────────────────────
section("base pool references real MODULE_DEFS");
for (const b of BASE_POOL) {
  const def = MODULE_DEFS[b.defId];
  check(`defId ${b.defId} exists`, !!def);
  if (def) check(`defId ${b.defId} slot matches`, def.slot === b.slot, `${def.slot} != ${b.slot}`);
}

// ── 2. Affix table sanity ──────────────────────────────────────────────────
section("affix table sanity");
for (const [id, a] of Object.entries(AFFIXES)) {
  check(`${id} has 6 tiers`, a.tiers.length === 6);
  for (let t = 0; t < a.tiers.length; t++) {
    const [lo, hi] = a.tiers[t];
    check(`${id} T${t + 1} lo<=hi`, lo <= hi, `${lo}>${hi}`);
    if (t > 0) check(`${id} T${t + 1} >= T${t}`, a.tiers[t][1] >= a.tiers[t - 1][1]);
  }
}

// ── 3. ilvl limits ─────────────────────────────────────────────────────────
section("ilvl limits");
{
  let ok = true;
  for (let i = 0; i < 5000; i++) {
    const rnd = mulberry32(i * 977 + 1);
    const lvl = rollItemLevel(rnd, 1 + (i % 60), { isBoss: i % 3 === 0, isPirate: i % 5 === 0, zoneTier: 1 + (i % 7) });
    if (lvl < 1 || lvl > ILVL_CAP) { ok = false; break; }
  }
  check("rollItemLevel always within 1..cap", ok);
  // boss floor: never below enemy level
  let floorOk = true;
  for (let i = 0; i < 2000; i++) {
    const rnd = mulberry32(i * 131 + 7);
    const lvl = rollItemLevel(rnd, 40, { isBoss: true, zoneTier: 3 });
    if (lvl < 40) { floorOk = false; break; }
  }
  check("boss drops never below enemy level", floorOk);
}

// ── 4. rarity affix counts ─────────────────────────────────────────────────
section("affix counts per rarity");
for (const r of RARITY_ORDER) {
  const rd = RARITIES[r];
  let ok = true;
  for (let i = 0; i < 800; i++) {
    const rnd = mulberry32(i * 613 + 3);
    const rolls = rollAffixes(rnd, r, 30, i % 2 ? "weapon" : "module");
    if (rolls.length > rd.maxAffixes) { ok = false; break; }
    // pool exhaustion can undershoot minAffixes only if fewer groups exist
    if (rolls.length < Math.min(rd.minAffixes, 4)) { ok = false; break; }
  }
  check(`${r}: count within [${rd.minAffixes}..${rd.maxAffixes}]`, ok);
}

// ── 5. tier caps + value ranges + dup groups ───────────────────────────────
section("tier caps, value ranges, duplicate groups");
{
  let tierOk = true, valOk = true, dupOk = true;
  for (let i = 0; i < 4000; i++) {
    const ilvl = 1 + (i % ILVL_CAP);
    const tierCap = affixTierForIlvl(ilvl) + 1;
    const rnd = mulberry32(i * 31 + 17);
    const rolls = rollAffixes(rnd, "epic", ilvl, "generator");
    const groups = new Set<string>();
    for (const roll of rolls) {
      const a = AFFIXES[roll.id];
      if (roll.tier !== tierCap) tierOk = false;
      const [lo, hi] = a.tiers[roll.tier - 1];
      if (roll.value < lo - 0.51 || roll.value > hi + 0.51) valOk = false;
      if (groups.has(a.group)) dupOk = false;
      groups.add(a.group);
    }
  }
  check("affix tier always == ilvl bracket tier", tierOk);
  check("affix values within tier range", valOk);
  check("no duplicate affix groups", dupOk);
}

// ── 6. boss guarantees ─────────────────────────────────────────────────────
section("boss guarantees");
{
  let always = true, minRare = true;
  for (let i = 0; i < 1500; i++) {
    const item = rollDrop({
      enemyType: "overlord", enemyLevel: 30, isBoss: true, isPirate: false,
      zoneTier: 4, luck: 0, seed: i * 101 + 13, instanceId: `t-${i}`,
    });
    if (!item) { always = false; break; }
    if (RARITY_ORDER.indexOf(item.rarity!) < RARITY_ORDER.indexOf("rare")) { minRare = false; break; }
  }
  check("boss always drops equipment", always);
  check("boss drops are rare or better", minRare);
}

// ── 7. deterministic generation ────────────────────────────────────────────
section("determinism");
{
  const ctx = { enemyType: "raider", enemyLevel: 12, isBoss: false, isPirate: true, zoneTier: 2, luck: 0.24, seed: 777123, instanceId: "d-1" };
  // pick a seed guaranteed to drop
  let a: ItemInstance | null = null, b: ItemInstance | null = null, seed = ctx.seed;
  for (let s = seed; s < seed + 5000; s++) {
    a = rollDrop({ ...ctx, seed: s });
    if (a) { b = rollDrop({ ...ctx, seed: s }); break; }
  }
  check("found a dropping seed", !!a);
  if (a && b) {
    const norm = (x: ItemInstance) => JSON.stringify({ ...x, ts: 0 });
    check("same seed → identical item", norm(a) === norm(b));
  }
}

// ── 8. legendary rules ─────────────────────────────────────────────────────
section("legendary effects");
{
  let found = 0, slotOk = true, ilvlOk = true;
  for (let i = 0; i < 60000 && found < 25; i++) {
    const item = rollDrop({
      enemyType: "titan", enemyLevel: 45, isBoss: true, isPirate: false,
      zoneTier: 6, luck: 0.5, seed: i * 7 + 3, instanceId: `l-${i}`,
    });
    if (!item?.legendaryId) continue;
    found++;
    const leg = LEGENDARIES[item.legendaryId];
    const def = MODULE_DEFS[item.defId];
    if (!leg.slots.includes(def.slot as any)) slotOk = false;
    if ((item.ilvl ?? 1) < leg.minIlvl) ilvlOk = false;
    const stats = resolveAffixStats(item);
    check(`legendary ${item.legendaryId} contributes stats`, Object.keys(stats).length > 0);
  }
  check("legendaries actually drop", found > 0, `found ${found}`);
  check("legendary slot matches base item slot", slotOk);
  check("legendary respects minIlvl", ilvlOk);
}

// ── 9. validator matrix ────────────────────────────────────────────────────
section("validator matrix");
{
  // build a known-good item
  let good: ItemInstance | null = null;
  for (let s = 1; s < 20000 && !good; s++) {
    const it = rollDrop({ enemyType: "destroyer", enemyLevel: 25, isBoss: true, isPirate: false, zoneTier: 3, luck: 0, seed: s, instanceId: "v-1" });
    if (it && (it.affixes?.length ?? 0) >= 2) good = it;
  }
  check("built a good item", !!good);
  if (good) {
    check("valid item passes", validateItem(good) === null, validateItem(good) ?? "");
    check("legacy clean item passes", validateItem({ instanceId: "x", defId: "wp-pulse-1" }) === null);
    const tamperValue = { ...good, affixes: good.affixes!.map((a, i) => i === 0 ? { ...a, value: a.value * 100 + 500 } : a) };
    check("inflated affix value rejected", validateItem(tamperValue) !== null);
    const tamperTier = { ...good, ilvl: 3, affixes: good.affixes!.map((a) => ({ ...a, tier: 6 })) };
    check("tier above ilvl bracket rejected", validateItem(tamperTier) !== null);
    const extraAffixes = { ...good, rarity: "common" as Rarity };
    check("affixes on common rejected", validateItem(extraAffixes) !== null);
    const dupGroup = { ...good, affixes: [good.affixes![0], { ...good.affixes![0] }] };
    check("duplicate group rejected", validateItem(dupGroup) !== null);
    const unknownAffix = { ...good, affixes: [{ id: "nope", tier: 1, value: 1 }] };
    check("unknown affix rejected", validateItem(unknownAffix) !== null);
    const badRarity = { ...good, rarity: "mythic" as any };
    check("unknown rarity rejected", validateItem(badRarity) !== null);
    const badIlvl = { ...good, ilvl: 999 };
    check("ilvl out of range rejected", validateItem(badIlvl) !== null);
    const badLegendary = { ...good, rarity: "rare" as Rarity, legendaryId: "sunreaver" };
    check("legendary on rare rejected", validateItem(badLegendary) !== null);
    const fakeLegendary = { ...good, legendaryId: "diablo-sword" };
    check("unknown legendary rejected", validateItem(fakeLegendary) !== null);
  }
}

// ── 10. stat resolution parity contract ────────────────────────────────────
section("stat resolution");
{
  const item: ItemInstance = {
    instanceId: "s-1", defId: "wp-pulse-2", ilvl: 22, rarity: "epic", seed: 1,
    affixes: [
      { id: "dmg_flat", tier: 3, value: 8 },
      { id: "rof_mult", tier: 3, value: 0.06 },
      { id: "crit", tier: 3, value: 0.02 },
    ],
  };
  const st = resolveAffixStats(item);
  check("damage additive", st.damage === 8);
  check("fireRate multiplicative (1.06)", Math.abs(st.fireRate - 1.06) < 1e-9);
  check("crit additive", Math.abs(st.critChance - 0.02) < 1e-9);
  check("clean item resolves empty", Object.keys(resolveAffixStats({ instanceId: "c", defId: "wp-pulse-1" })).length === 0);
}

// ── 11. rarity distribution monotonicity ───────────────────────────────────
section("rarity roll behavior");
{
  const rnd = mulberry32(42);
  let lowIlvlHighRarity = false;
  for (let i = 0; i < 3000; i++) {
    const r = rollRarity(rnd, 4, LOOT_PROFILES.standard, 0);
    const def = RARITIES[r];
    if (def.minIlvl > 4) lowIlvlHighRarity = true;
  }
  check("minIlvl gates respected at ilvl 4", !lowIlvlHighRarity);
}

console.log(`\n═══ ${passed} passed, ${failed} failed ═══`);
process.exit(failed > 0 ? 1 : 0);
