import { state, bump, useGame, pushNotification, save, stationPrice, addCargo, removeCargo, cargoUsed, cargoCapacity, maxDroneSlots, claimMission, rerollDaily, equipModule, unequipSlot, sellInventoryItem, addInventoryItem, enterDungeon, reconcileShipSlots, buyConsumable, rocketAmmoMax, getRocketWeaponIds, ensureAmmoInitialized, setAutoRestock, setAutoRepairHull, setAutoShieldRecharge, getActiveAmmoType, switchRocketAmmoType, purchaseTypedAmmo, getAmmoCountForType, ROCKET_AMMO_COST_PER } from "../game/store";
import {
  ActiveQuest, CONSUMABLE_DEFS, ConsumableId, DAILY_DUNGEON_BONUS, DRONE_DEFS, DroneKind, DroneMode, DUNGEONS, DungeonId, FACTIONS, MODULE_DEFS, ModuleDef, ModuleSlot, ModuleStats, RARITY_COLOR,
  Quest, QUEST_POOL, RESOURCES, ResourceId, ROCKET_AMMO_TYPE_DEFS, RocketAmmoType, SHIP_CLASSES, SKILL_NODES, STATIONS, ShipClassId, SkillBranch,
  SkillId, ZONES, getDailyFeaturedDungeon,
} from "../game/types";
import type { HangarTab } from "../game/store";
import { effectiveStats } from "../game/loop";
import { buySkillRank, resetSkills } from "../game/store";
import { useState, useMemo } from "react";

const TABS: { id: HangarTab; label: string; glyph: string }[] = [
  { id: "bounties", label: "Bounties", glyph: "★" },
  { id: "missions", label: "Missions", glyph: "▣" },
  { id: "skills",   label: "Skills",   glyph: "✦" },
  { id: "ships",    label: "Shipyard", glyph: "▲" },
  { id: "loadout",  label: "Loadout",  glyph: "⚙" },
  { id: "dungeons", label: "Dungeons", glyph: "▼" },
  { id: "drones",   label: "Drones",   glyph: "✦" },
  { id: "market",   label: "Market",   glyph: "$" },
  { id: "cargo",    label: "Cargo",    glyph: "▤" },
  { id: "repair",   label: "Services", glyph: "✚" },
];

export function Hangar({ stationId }: { stationId: string }) {
  const tab = useGame((s) => s.hangarTab);
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(2, 4, 12, 0.85)" }}>
      <div className="panel relative" style={{ width: "min(1080px, 96vw)", height: "min(680px, 92vh)" }}>
        <div className="scanline" />
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
          <div>
            <div className="text-mute text-[10px] tracking-widest">DOCKED AT · {station.kind.toUpperCase()}</div>
            <div className="text-cyan glow-cyan text-xl font-bold tracking-widest">{station.name.toUpperCase()}</div>
            <div className="text-dim text-[11px] mt-0.5">{station.description}</div>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => {
              state.dockedAt = null;
              state.player.pos.y += 200;
              state.cameraTarget = { ...state.player.pos };
              save();
              bump();
            }}
          >
            ✕ Undock
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto" style={{ borderColor: "var(--border-soft)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className="px-4 py-2.5 text-[11px] tracking-widest uppercase whitespace-nowrap transition-colors"
              style={{
                background: tab === t.id ? "rgba(78, 226, 255, 0.1)" : "transparent",
                color: tab === t.id ? "var(--accent-cyan)" : "var(--text-dim)",
                borderBottom: tab === t.id ? "2px solid var(--accent-cyan)" : "2px solid transparent",
              }}
              onClick={() => { state.hangarTab = t.id; bump(); }}
            >
              {t.glyph} {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto" style={{ height: "calc(100% - 130px)" }}>
          {tab === "bounties" && <BountiesTab />}
          {tab === "missions" && <MissionsTab />}
          {tab === "skills" && <SkillsTab />}
          {tab === "loadout" && <LoadoutTab stationId={stationId} />}
          {tab === "dungeons" && <DungeonsTab />}
          {tab === "ships" && <ShipsTab />}
          {tab === "drones" && <DronesTab />}
          {tab === "market" && <MarketTab stationId={stationId} />}
          {tab === "cargo" && <CargoTab />}
          {tab === "repair" && <RepairTab stationId={stationId} />}
        </div>
      </div>
    </div>
  );
}

// ── BOUNTIES ──────────────────────────────────────────────────────────────
const ZONE_FACTION_META: Record<string, { label: string; color: string; glyph: string }> = {
  earth: { label: "Earth Concord",  color: "#4ee2ff", glyph: "⊕" },
  mars:  { label: "Mars Coalition", color: "#ff7733", glyph: "⊗" },
  venus: { label: "Venus Enclave",  color: "#c96fff", glyph: "⊛" },
};

function BountiesTab() {
  const player = useGame((s) => s.player);
  const available = useGame((s) => s.availableQuests);

  // Cross-faction: quests from other factions' zones that the player's level unlocks
  const currentFaction = ZONES[player.zone as keyof typeof ZONES]?.faction ?? "earth";
  const crossFactionQuests = useMemo(() =>
    QUEST_POOL.filter((q) => {
      const z = ZONES[q.zone as keyof typeof ZONES];
      return z && z.faction !== currentFaction && z.unlockLevel <= player.level && !player.completedQuests.includes(q.id);
    }),
    // Using join as dependency so memo invalidates on any quest completion change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentFaction, player.level, player.completedQuests.join(",")]
  );

  const crossByFaction = useMemo(() =>
    crossFactionQuests.reduce<Record<string, Quest[]>>((acc, q) => {
      const f = ZONES[q.zone as keyof typeof ZONES].faction;
      if (!acc[f]) acc[f] = [];
      acc[f].push(q);
      return acc;
    }, {}),
    [crossFactionQuests]
  );

  const accept = (q: Quest) => {
    if (player.activeQuests.find((x) => x.id === q.id)) return;
    if (player.activeQuests.length >= 5) {
      pushNotification("Quest log full (5 max)", "bad");
      return;
    }
    player.activeQuests.push({ ...q, progress: 0, completed: false });
    pushNotification(`Accepted: ${q.title}`, "good");
    save(); bump();
  };

  const turnIn = (q: ActiveQuest) => {
    if (!q.completed) return;
    player.credits += q.rewardCredits;
    player.exp += q.rewardExp;
    player.honor += q.rewardHonor;
    player.completedQuests.push(q.id);
    player.activeQuests = player.activeQuests.filter((x) => x.id !== q.id);
    pushNotification(`+${q.rewardCredits}cr +${q.rewardExp}xp +${q.rewardHonor} honor`, "good");
    save(); bump();
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top row: available bounties (current zone) + active log */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-cyan tracking-widest text-xs mb-3">▶ AVAILABLE BOUNTIES</div>
          <div className="space-y-2">
            {available.length === 0 && (
              <div className="text-mute text-xs italic">No bounties posted in this zone.</div>
            )}
            {available.map((q) => {
              const has = player.activeQuests.find((x) => x.id === q.id);
              const done = player.completedQuests.includes(q.id);
              return (
                <div key={q.id} className="panel p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-amber glow-amber text-sm font-bold">{q.title}</div>
                      <div className="text-dim text-[11px] mt-1 mb-2">{q.description}</div>
                      <div className="flex gap-3 text-[10px] flex-wrap">
                        <span className="text-cyan">⚔ {q.killCount}× {q.killType}</span>
                        <span className="text-amber">+{q.rewardCredits.toLocaleString()}cr</span>
                        <span className="text-magenta">+{q.rewardExp.toLocaleString()}xp</span>
                        <span className="text-green">+{q.rewardHonor} honor</span>
                      </div>
                    </div>
                    <button className="btn btn-primary" disabled={!!has || done} onClick={() => accept(q)}>
                      {done ? "Done" : has ? "Active" : "Accept"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-cyan tracking-widest text-xs mb-3">▶ ACTIVE QUESTS ({player.activeQuests.length}/5)</div>
          <div className="space-y-2">
            {player.activeQuests.length === 0 && (
              <div className="text-mute text-xs italic">No active quests. Take a contract from the board.</div>
            )}
            {player.activeQuests.map((q) => (
              <div key={q.id} className="panel p-3">
                <div className="text-amber glow-amber text-sm font-bold">{q.title}</div>
                <div className="text-dim text-[11px] mt-1 mb-2">
                  {q.progress}/{q.killCount} {q.killType}s eliminated
                </div>
                <div className="bar mb-2">
                  <div className="bar-fill" style={{
                    width: `${(q.progress / q.killCount) * 100}%`,
                    background: "linear-gradient(90deg, #ff5cf066, #ff5cf0)",
                    boxShadow: "0 0 6px #ff5cf0",
                  }} />
                </div>
                <button className="btn btn-amber w-full" disabled={!q.completed} onClick={() => turnIn(q)}>
                  {q.completed ? "Turn In" : "In Progress"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cross-faction contracts */}
      {Object.keys(crossByFaction).length > 0 && (
        <div className="border-t pt-4" style={{ borderColor: "var(--border-soft)" }}>
          <div className="text-cyan tracking-widest text-xs mb-1">▶ CROSS-FACTION CONTRACTS</div>
          <div className="text-mute text-[10px] mb-3">Accept now — progress counts when you arrive in that zone.</div>
          {Object.entries(crossByFaction).map(([faction, quests]) => {
            const meta = ZONE_FACTION_META[faction] ?? ZONE_FACTION_META.earth;
            return (
              <div key={faction} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs tracking-widest font-bold" style={{ color: meta.color }}>
                    {meta.glyph} {meta.label.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quests.map((q) => {
                    const has = player.activeQuests.find((x) => x.id === q.id);
                    const done = player.completedQuests.includes(q.id);
                    const zone = ZONES[q.zone as keyof typeof ZONES];
                    return (
                      <div
                        key={q.id}
                        className="panel p-3"
                        style={{ borderLeft: `2px solid ${meta.color}55` }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] tracking-widest mb-1" style={{ color: meta.color }}>
                              {zone.label} · {zone.name.toUpperCase()}
                            </div>
                            <div className="text-amber text-sm font-bold truncate">{q.title}</div>
                            <div className="text-dim text-[11px] mt-1 mb-2 line-clamp-2">{q.description}</div>
                            <div className="flex gap-2 text-[10px] flex-wrap">
                              <span className="text-cyan">⚔ {q.killCount}× {q.killType}</span>
                              <span className="text-amber">+{q.rewardCredits.toLocaleString()}cr</span>
                              <span className="text-magenta">+{q.rewardExp.toLocaleString()}xp</span>
                            </div>
                          </div>
                          <button className="btn btn-primary shrink-0" disabled={!!has || done} onClick={() => accept(q)}>
                            {done ? "Done" : has ? "Active" : "Accept"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── LOADOUT (modular ship gear) ───────────────────────────────────────────
function statChip(label: string, value: string, color: string) {
  return (
    <span className="text-[9px] tracking-widest px-1" style={{ color, border: `1px solid ${color}55` }}>
      {label}:{value}
    </span>
  );
}

type StatDiffEntry = { label: string; delta: number; formatted: string; isPercent?: boolean };

function computeStatDiff(equipped: ModuleStats, shop: ModuleStats): StatDiffEntry[] {
  const diffs: StatDiffEntry[] = [];
  const num = (a?: number, b?: number) => (b ?? 0) - (a ?? 0);

  const dmg = num(equipped.damage, shop.damage);
  if (dmg !== 0) diffs.push({ label: "DMG", delta: dmg, formatted: `${dmg > 0 ? "+" : ""}${dmg}` });

  if ((equipped.fireRate ?? 1) !== 1 || (shop.fireRate ?? 1) !== 1) {
    const rDelta = (shop.fireRate ?? 1) - (equipped.fireRate ?? 1);
    if (Math.abs(rDelta) > 0.001) diffs.push({ label: "RATE", delta: rDelta, formatted: `${rDelta > 0 ? "+" : ""}${rDelta.toFixed(2)}×` });
  }

  const crit = num(equipped.critChance, shop.critChance);
  if (Math.abs(crit) > 0.0001) diffs.push({ label: "CRIT", delta: crit, formatted: `${crit > 0 ? "+" : ""}${Math.round(crit * 100)}%` });

  const shd = num(equipped.shieldMax, shop.shieldMax);
  if (shd !== 0) diffs.push({ label: "SHD", delta: shd, formatted: `${shd > 0 ? "+" : ""}${shd}` });

  const reg = num(equipped.shieldRegen, shop.shieldRegen);
  if (reg !== 0) diffs.push({ label: "REG", delta: reg, formatted: `${reg > 0 ? "+" : ""}${reg.toFixed(1)}` });

  const hul = num(equipped.hullMax, shop.hullMax);
  if (hul !== 0) diffs.push({ label: "HUL", delta: hul, formatted: `${hul > 0 ? "+" : ""}${hul}` });

  const spd = num(equipped.speed, shop.speed);
  if (spd !== 0) diffs.push({ label: "SPD", delta: spd, formatted: `${spd > 0 ? "+" : ""}${spd}` });

  const dr = num(equipped.damageReduction, shop.damageReduction);
  if (Math.abs(dr) > 0.0001) diffs.push({ label: "DR", delta: dr, formatted: `${dr > 0 ? "+" : ""}${Math.round(dr * 100)}%` });

  const aoe = num(equipped.aoeRadius, shop.aoeRadius);
  if (aoe !== 0) diffs.push({ label: "AOE", delta: aoe, formatted: `${aoe > 0 ? "+" : ""}${aoe}` });

  const ammo = num(equipped.ammoCapacity, shop.ammoCapacity);
  if (ammo !== 0) diffs.push({ label: "AMMO", delta: ammo, formatted: `${ammo > 0 ? "+" : ""}${ammo}` });

  const loot = num(equipped.lootBonus, shop.lootBonus);
  if (loot !== 0) diffs.push({ label: "LOOT", delta: loot, formatted: `${loot > 0 ? "+" : ""}${loot}` });

  return diffs;
}

function normalizedUpgradeScore(equipped: ModuleStats, shop: ModuleStats): number {
  // `base` is the neutral value when the stat is absent (additive stats default 0, multiplicative to 1)
  const n = (a: number | undefined, b: number | undefined, w: number, base = 0) =>
    ((b ?? base) - (a ?? base)) * w;
  return (
    n(equipped.damage,          shop.damage,          0.5)       +
    n(equipped.fireRate,        shop.fireRate,        50,  1)    + // neutral fireRate = 1×
    n(equipped.critChance,      shop.critChance,      200)       +
    n(equipped.shieldMax,       shop.shieldMax,       0.5)       +
    n(equipped.shieldRegen,     shop.shieldRegen,     5)         +
    n(equipped.hullMax,         shop.hullMax,         0.5)       +
    n(equipped.speed,           shop.speed,           1)         +
    n(equipped.damageReduction, shop.damageReduction, 200)       +
    n(equipped.aoeRadius,       shop.aoeRadius,       1)         +
    n(equipped.ammoCapacity,    shop.ammoCapacity,    1)         +
    n(equipped.lootBonus,       shop.lootBonus,       1)
  );
}

function modStatPills(stats: typeof MODULE_DEFS[string]["stats"]) {
  const pills: { k: string; v: string; c: string }[] = [];
  if (stats.damage)          pills.push({ k: "DMG", v: `+${stats.damage}`, c: "#ff5c6c" });
  if (stats.fireRate && stats.fireRate !== 1) pills.push({ k: "RATE", v: `×${stats.fireRate.toFixed(2)}`, c: "#ffd24a" });
  if (stats.critChance)      pills.push({ k: "CRIT", v: `+${Math.round(stats.critChance * 100)}%`, c: "#ff5cf0" });
  if (stats.aoeRadius)       pills.push({ k: "AOE", v: `${stats.aoeRadius}`, c: "#ff8a4e" });
  if (stats.shieldMax)       pills.push({ k: "SHD", v: `+${stats.shieldMax}`, c: "#4ee2ff" });
  if (stats.shieldRegen)     pills.push({ k: "REG", v: `+${stats.shieldRegen}`, c: "#4ee2ff" });
  if (stats.hullMax)         pills.push({ k: "HUL", v: `+${stats.hullMax}`, c: "#5cff8a" });
  if (stats.speed)           pills.push({ k: "SPD", v: `+${stats.speed}`, c: "#aaff5c" });
  if (stats.damageReduction) pills.push({ k: "DR",  v: `${Math.round(stats.damageReduction * 100)}%`, c: "#ff8a4e" });
  if (stats.cargoBonus)      pills.push({ k: "CRG", v: `+${Math.round(stats.cargoBonus * 100)}%`, c: "#c69060" });
  if (stats.lootBonus)       pills.push({ k: "LOOT", v: `+${stats.lootBonus}`, c: "#ffd24a" });
  if (stats.ammoCapacity)    pills.push({ k: "AMMO", v: `+${stats.ammoCapacity}`, c: "#ff8a4e" });
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {pills.map((p, i) => statChip(p.k, p.v, p.c))}
    </div>
  );
}

function RocketAmmoBadge() {
  const [showTip, setShowTip] = useState(false);
  const maxAmmo = rocketAmmoMax();
  return (
    <div className="relative inline-block mt-1">
      <span
        className="text-[9px] tracking-widest cursor-help inline-flex items-center gap-1"
        style={{ color: "#ff8a4e", border: "1px solid #ff8a4e55", padding: "1px 5px" }}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTip((v) => !v); }}
      >
        ⟁ Ammo: {ROCKET_AMMO_COST_PER}cr/round · max {maxAmmo}
      </span>
      {showTip && (
        <div
          className="absolute z-50 bottom-full left-0 mb-1.5 panel p-2 text-[9px] leading-relaxed"
          style={{ width: 200, pointerEvents: "none", color: "var(--text-dim)" }}
        >
          <div className="text-[9px] font-bold tracking-widest mb-1" style={{ color: "#ff8a4e" }}>AMMO SYSTEM</div>
          Rocket weapons fire limited rounds. Restock at any station for <span style={{ color: "#ffd24a" }}>{ROCKET_AMMO_COST_PER}cr per round</span>.
          Current max capacity: <span style={{ color: "#4ee2ff" }}>{maxAmmo} rounds</span>.
          Equip a <span style={{ color: "#ff5cf0" }}>Munitions Bay</span> module to increase capacity.
        </div>
      )}
    </div>
  );
}

function SlotCell({
  slot, index, instanceId, compareWithDef,
}: {
  slot: ModuleSlot; index: number; instanceId: string | null; compareWithDef?: ModuleDef | null;
}) {
  const player = useGame((s) => s.player);
  const item = instanceId ? player.inventory.find((m) => m.instanceId === instanceId) : null;
  const def = item ? MODULE_DEFS[item.defId] : null;
  const color = def ? RARITY_COLOR[def.rarity] : "#36406a";
  const isRocket = def?.weaponKind === "rocket";
  const ammoCount = isRocket && instanceId ? (player.ammo[instanceId] ?? 0) : null;
  const ammoMax = isRocket ? rocketAmmoMax() : 0;
  const ammoLow = ammoCount !== null && ammoCount <= 5;

  const isComparing = !!compareWithDef;
  const diffs = isComparing && def ? computeStatDiff(def.stats, compareWithDef!.stats) : [];
  const borderColor = isComparing ? "#ffd24a" : (def ? color : "var(--border-soft)");
  const bgColor = isComparing ? "#ffd24a0d" : (def ? `${color}10` : "transparent");

  return (
    <div
      className="panel p-2 flex flex-col"
      style={{
        minHeight: 76,
        borderColor,
        background: bgColor,
        outline: isComparing ? "1px solid #ffd24a33" : undefined,
        transition: "border-color 0.15s, outline 0.15s",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[9px] tracking-widest text-mute">{slot.toUpperCase()} #{index + 1}</div>
        {isComparing && (
          <span className="text-[8px] tracking-widest" style={{ color: "#ffd24a" }}>▶ COMPARE</span>
        )}
      </div>
      {def ? (
        <>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span style={{ color: def.color, fontSize: 14 }}>{def.glyph}</span>
            <span className="text-[10px] font-bold tracking-widest" style={{ color }}>{def.name}</span>
          </div>
          <div className="text-mute text-[9px] mt-0.5 leading-tight">{def.description}</div>
          {ammoCount !== null && (
            <>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[9px] tracking-widest" style={{ color: ammoLow ? "#ff5c6c" : "#ff8a4e" }}>
                  ⟁ AMMO: {ammoCount}/{ammoMax}
                </span>
                {ammoLow && ammoCount > 0 && <span className="text-[8px] text-red font-bold">LOW</span>}
                {ammoCount === 0 && <span className="text-[8px] font-bold" style={{ color: "#ff5c6c" }}>EMPTY</span>}
              </div>
              <div className="flex gap-1 mt-1">
                {(["standard", "armor-piercing", "emp"] as RocketAmmoType[]).map((type) => {
                  const tDef = ROCKET_AMMO_TYPE_DEFS[type];
                  const typeCount = getAmmoCountForType(instanceId!, type);
                  const isActiveType = getActiveAmmoType(instanceId!) === type;
                  return (
                    <button
                      key={type}
                      className="text-[8px] px-1 py-0.5 tracking-widest"
                      style={{
                        background: isActiveType ? tDef.color + "25" : "transparent",
                        color: isActiveType ? tDef.color : "#555",
                        border: `1px solid ${isActiveType ? tDef.color + "99" : "#444"}`,
                        cursor: "pointer",
                      }}
                      onClick={(e) => { e.stopPropagation(); switchRocketAmmoType(instanceId!, type); }}
                      title={tDef.name}
                    >
                      {tDef.shortName} {typeCount}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {isComparing && diffs.length > 0 && (
            <div className="mt-1.5 pt-1" style={{ borderTop: "1px dashed #ffd24a33" }}>
              <div className="text-[8px] tracking-widest mb-0.5" style={{ color: "#ffd24a99" }}>IF REPLACED:</div>
              <div className="flex flex-wrap gap-0.5">
                {diffs.map((d, i) => (
                  <span
                    key={i}
                    className="text-[8px] px-1 tracking-widest"
                    style={{
                      color: d.delta > 0 ? "#5cff8a" : "#ff5c6c",
                      border: `1px solid ${d.delta > 0 ? "#5cff8a44" : "#ff5c6c44"}`,
                    }}
                  >
                    {d.label} {d.formatted}
                  </span>
                ))}
              </div>
            </div>
          )}
          {isComparing && diffs.length === 0 && def && (
            <div className="mt-1.5 pt-1" style={{ borderTop: "1px dashed #ffd24a33" }}>
              <div className="text-[8px] tracking-widest" style={{ color: "#ffd24a99" }}>≈ SIMILAR STATS</div>
            </div>
          )}
          <button
            className="btn mt-auto self-start"
            style={{ padding: "2px 6px", fontSize: 9 }}
            onClick={() => unequipSlot(slot, index)}
          >Unequip</button>
        </>
      ) : (
        <div className="text-mute text-[9px] mt-1 italic">
          {isComparing ? "⬡ open slot — shop module fits here" : "— empty slot —"}
        </div>
      )}
    </div>
  );
}

function LoadoutTab({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const station = STATIONS.find((s) => s.id === stationId)!;
  const cls = SHIP_CLASSES[player.shipClass];
  const stats = effectiveStats();
  const [filter, setFilter] = useState<ModuleSlot | "all">("all");
  const [showShop, setShowShop] = useState(false);
  const [hoveredShopDefId, setHoveredShopDefId] = useState<string | null>(null);
  const hoveredShopDef = hoveredShopDefId ? MODULE_DEFS[hoveredShopDefId] ?? null : null;
  const [hoveredInvInstanceId, setHoveredInvInstanceId] = useState<string | null>(null);
  const hoveredInvDef = (() => {
    if (!hoveredInvInstanceId) return null;
    const it = player.inventory.find((m) => m.instanceId === hoveredInvInstanceId);
    return it ? MODULE_DEFS[it.defId] ?? null : null;
  })();

  // Shop offer: 4 random buyable modules, capped to ones unlocked by ship tier-ish
  const shopPool = Object.values(MODULE_DEFS).filter((d) => d.tier <= Math.min(5, Math.max(1, Math.ceil(player.level / 4))));
  const shopOffer = shopPool.slice(0, 8); // simple: show first 8 affordable ones

  // Determine which shop module is the single best upgrade for the player's current build
  const bestUpgradeDefId = useMemo(() => {
    if (!showShop) return null;
    let bestId: string | null = null;
    let bestScore = 0; // must beat 0 to be considered a net upgrade
    for (const def of shopOffer) {
      const equippedIds = player.equipped[def.slot];
      // Score against each equipped slot; keep the best slot comparison
      let slotBestScore = equippedIds.length === 0
        ? normalizedUpgradeScore({}, def.stats)
        : -Infinity;
      for (const instanceId of equippedIds) {
        let equippedStats: ModuleStats = {};
        if (instanceId !== null) {
          const item = player.inventory.find((m) => m.instanceId === instanceId);
          if (item) {
            const equippedDef = MODULE_DEFS[item.defId];
            if (equippedDef) equippedStats = equippedDef.stats;
          }
        }
        slotBestScore = Math.max(slotBestScore, normalizedUpgradeScore(equippedStats, def.stats));
      }
      if (slotBestScore > bestScore) {
        bestScore = slotBestScore;
        bestId = def.id;
      }
    }
    return bestId;
  }, [showShop, shopOffer, player.equipped, player.inventory]);

  const visibleInv = player.inventory.filter((it) => {
    if (filter === "all") return true;
    return MODULE_DEFS[it.defId]?.slot === filter;
  });

  const renderSlotRow = (slot: ModuleSlot, label: string, color: string) => {
    const compareDef =
      showShop && hoveredShopDef?.slot === slot ? hoveredShopDef
      : !showShop && hoveredInvDef?.slot === slot ? hoveredInvDef
      : null;
    return (
      <div>
        <div className="text-[10px] tracking-widest mb-1" style={{ color }}>▶ {label} ({player.equipped[slot].length})</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${player.equipped[slot].length}, minmax(0, 1fr))` }}>
          {player.equipped[slot].map((id, i) => (
            <SlotCell key={`${slot}-${i}`} slot={slot} index={i} instanceId={id} compareWithDef={compareDef} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-3 p-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {/* LEFT — equipped slots + stats summary */}
      <div className="space-y-3">
        <div className="text-cyan tracking-widest text-xs">▶ LOADOUT · {cls.name.toUpperCase()}</div>
        {renderSlotRow("weapon",    "WEAPONS",    "#ff5c6c")}
        {renderSlotRow("generator", "GENERATORS", "#4ee2ff")}
        {renderSlotRow("module",    "MODULES",    "#ff5cf0")}
        <div className="panel p-2">
          <div className="text-[10px] tracking-widest text-cyan mb-1">▶ ACTIVE STATS</div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <Stat label="DMG"  v={Math.round(stats.damage)} />
            <Stat label="RATE" v={+stats.fireRate.toFixed(2)} />
            <Stat label="CRIT" v={`${Math.round(stats.critChance * 100)}%`} />
            <Stat label="HUL"  v={Math.round(stats.hullMax)} />
            <Stat label="SHD"  v={Math.round(stats.shieldMax)} />
            <Stat label="REG"  v={`${stats.shieldRegen.toFixed(1)}/s`} />
            <Stat label="SPD"  v={Math.round(stats.speed)} />
            <Stat label="DR"   v={`${Math.round(stats.damageReduction * 100)}%`} />
            <Stat label="AOE"  v={Math.round(stats.aoeRadius)} />
          </div>
        </div>
      </div>

      {/* RIGHT — inventory + shop toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-cyan tracking-widest text-xs">▶ {showShop ? "MODULE MARKET" : `INVENTORY (${player.inventory.length})`}</div>
            {showShop && <span className="text-[8px] tracking-widest" style={{ color: "#ffd24a88" }}>hover to compare</span>}
            {!showShop && <span className="text-[8px] tracking-widest" style={{ color: "#ffd24a88" }}>hover unequipped to compare</span>}
          </div>
          <div className="flex gap-1">
            <button className="btn" style={{ padding: "2px 6px", fontSize: 9 }} onClick={() => { setShowShop((v) => !v); setHoveredShopDefId(null); setHoveredInvInstanceId(null); }}>
              {showShop ? "Show Inventory" : `Shop @ ${station.name}`}
            </button>
          </div>
        </div>
        {!showShop && (
          <div className="flex gap-1">
            {(["all", "weapon", "generator", "module"] as const).map((f) => (
              <button key={f} className="btn"
                style={{ padding: "2px 6px", fontSize: 9, background: filter === f ? "rgba(78,226,255,0.18)" : undefined }}
                onClick={() => setFilter(f)}>{f.toUpperCase()}</button>
            ))}
          </div>
        )}

        <div
          className="space-y-1.5 overflow-y-auto"
          style={{ maxHeight: 460 }}
          onMouseLeave={() => { setHoveredShopDefId(null); setHoveredInvInstanceId(null); }}
        >
          {showShop ? (
            shopOffer.map((def) => {
              const canAfford = player.credits >= def.price;
              const isHovered = hoveredShopDefId === def.id;
              const isBestUpgrade = bestUpgradeDefId === def.id;
              return (
                <div key={def.id} className="panel p-2 flex items-start gap-2"
                  style={{ borderColor: isBestUpgrade ? "#ffd24a" : isHovered ? "#ffd24a" : RARITY_COLOR[def.rarity], transition: "border-color 0.1s" }}
                  onMouseEnter={() => setHoveredShopDefId(def.id)}>
                  <div className="flex items-center justify-center"
                    style={{ width: 28, height: 28, background: `${def.color}22`, border: `1px solid ${def.color}`, color: def.color, fontSize: 14 }}>
                    {def.glyph}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="text-[11px] font-bold tracking-widest" style={{ color: RARITY_COLOR[def.rarity] }}>{def.name}</div>
                      <span className="text-[8px] uppercase" style={{ color: RARITY_COLOR[def.rarity] }}>· {def.rarity}</span>
                      {isBestUpgrade && (
                        <span
                          className="text-[8px] font-bold tracking-widest px-1.5 py-0.5"
                          style={{ color: "#ffd24a", background: "#ffd24a18", border: "1px solid #ffd24a88", borderRadius: 2 }}
                        >
                          ★ BEST UPGRADE
                        </span>
                      )}
                    </div>
                    <div className="text-mute text-[9px] leading-tight">{def.description}</div>
                    {modStatPills(def.stats)}
                    {def.weaponKind === "rocket" && <RocketAmmoBadge />}
                  </div>
                  <button className="btn btn-primary"
                    style={{ padding: "2px 8px", fontSize: 10 }}
                    disabled={!canAfford}
                    onClick={() => {
                      if (!canAfford) return;
                      state.player.credits -= def.price;
                      addInventoryItem(def.id);
                      pushNotification(`Bought ${def.name}`, "good");
                      save(); bump();
                    }}>
                    {def.price.toLocaleString()}cr
                  </button>
                </div>
              );
            })
          ) : (
            visibleInv.length === 0 ? (
              <div className="text-mute text-xs italic">No modules. Buy from the shop or run a dungeon.</div>
            ) : visibleInv.map((it) => {
              const def = MODULE_DEFS[it.defId];
              const isEquipped =
                player.equipped.weapon.includes(it.instanceId) ||
                player.equipped.generator.includes(it.instanceId) ||
                player.equipped.module.includes(it.instanceId);
              const slotArr = player.equipped[def.slot];
              const targetIdx = slotArr.findIndex((x) => x === null);
              return (
                <div key={it.instanceId} className="panel p-2 flex items-start gap-2"
                  style={{ borderColor: hoveredInvInstanceId === it.instanceId ? "#ffd24a" : RARITY_COLOR[def.rarity], transition: "border-color 0.1s" }}
                  onMouseEnter={() => setHoveredInvInstanceId(!isEquipped ? it.instanceId : null)}>
                  <div className="flex items-center justify-center"
                    style={{ width: 28, height: 28, background: `${def.color}22`, border: `1px solid ${def.color}`, color: def.color, fontSize: 14 }}>
                    {def.glyph}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="text-[11px] font-bold tracking-widest" style={{ color: RARITY_COLOR[def.rarity] }}>{def.name}</div>
                      <span className="text-[8px] uppercase text-mute">· {def.slot}</span>
                      {isEquipped && <span className="text-[8px] uppercase" style={{ color: "#5cff8a" }}>· equipped</span>}
                    </div>
                    <div className="text-mute text-[9px] leading-tight">{def.description}</div>
                    {modStatPills(def.stats)}
                    {def.weaponKind === "rocket" && <RocketAmmoBadge />}
                  </div>
                  <div className="flex flex-col gap-1">
                    {!isEquipped && (
                      <button className="btn btn-primary"
                        style={{ padding: "2px 6px", fontSize: 9 }}
                        disabled={targetIdx < 0}
                        onClick={() => {
                          const slotArr2 = state.player.equipped[def.slot];
                          let idx = slotArr2.findIndex((x) => x === null);
                          if (idx < 0) idx = 0; // overwrite first slot if all full
                          equipModule(it.instanceId, def.slot, idx);
                        }}>
                        {targetIdx >= 0 ? `Equip → #${targetIdx + 1}` : "Replace #1"}
                      </button>
                    )}
                    <button className="btn btn-amber"
                      style={{ padding: "2px 6px", fontSize: 9 }}
                      onClick={() => sellInventoryItem(it.instanceId)}>
                      Sell {Math.floor(def.price * 0.4)}cr
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── DUNGEONS ──────────────────────────────────────────────────────────────
function fmtClearTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function DungeonsTab() {
  const player = useGame((s) => s.player);
  const dungeon = useGame((s) => s.dungeon);
  const featuredId = getDailyFeaturedDungeon();
  // Featured dungeon first, rest in original order
  const allDungeons = Object.values(DUNGEONS);
  const list = [
    ...allDungeons.filter((d) => d.id === featuredId),
    ...allDungeons.filter((d) => d.id !== featuredId),
  ];
  // Display the UTC date to match the canonical featured dungeon rotation (resets at UTC midnight)
  const now = new Date();
  const utcDateStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  const dateLabel = utcDateStr;
  return (
    <div className="p-4 space-y-3">
      <div className="text-cyan tracking-widest text-xs">▶ INSTANCED DUNGEONS</div>
      <div className="text-dim text-[11px]">
        Each dungeon is a wave-based instance. Clear all waves for credits, materials and a guaranteed module drop.
      </div>
      {/* Daily featured banner */}
      <div className="panel p-2.5" style={{ borderColor: "#ffd24a", background: "rgba(255,210,74,0.06)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[14px]">⭐</span>
          <div>
            <div className="text-[11px] font-bold tracking-widest text-amber">DAILY FEATURED RIFT — {dateLabel.toUpperCase()}</div>
            <div className="text-[10px] text-dim mt-0.5">
              <span className="font-bold" style={{ color: DUNGEONS[featuredId].color }}>{DUNGEONS[featuredId].name}</span>
              <span className="text-mute"> · </span>
              <span className="text-amber">{DAILY_DUNGEON_BONUS.label}</span>
            </div>
          </div>
        </div>
      </div>
      {dungeon && (
        <div className="panel p-2" style={{ borderColor: "#ffd24a" }}>
          <div className="text-amber text-[11px] font-bold tracking-widest">⚠ DUNGEON IN PROGRESS — {DUNGEONS[dungeon.id].name.toUpperCase()}</div>
          <div className="text-mute text-[10px]">Wave {dungeon.wave}/{dungeon.totalWaves}. Undock to fight.</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {list.map((d) => {
          const locked = player.level < d.unlockLevel;
          const clears = player.dungeonClears?.[d.id] ?? 0;
          const bestMs = player.dungeonBestTimes?.[d.id];
          const isFeatured = d.id === featuredId;
          const featuredCredits = Math.round(d.rewardCredits * DAILY_DUNGEON_BONUS.creditsMul);
          return (
            <div
              key={d.id}
              className="panel p-2.5"
              style={{
                borderColor: isFeatured ? "#ffd24a" : d.color,
                background: isFeatured ? "rgba(255,210,74,0.05)" : undefined,
              }}
            >
              {isFeatured && (
                <div className="flex items-center gap-1 mb-1.5 -mt-0.5">
                  <span className="text-[10px]">⭐</span>
                  <span className="text-[9px] font-bold tracking-widest text-amber">DAILY FEATURED</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold tracking-widest" style={{ color: isFeatured ? "#ffd24a" : d.color }}>{d.name.toUpperCase()}</div>
                <div className="text-[9px] tracking-widest text-mute">{d.zone.toUpperCase()}</div>
              </div>
              <div className="text-dim text-[10px] mt-0.5">{d.description}</div>
              <div className="grid grid-cols-3 gap-1 text-[9px] mt-2">
                <Stat label="WAVES" v={d.waves} />
                <Stat label="ENEMIES" v={`${d.enemiesPerWave}×`} />
                <Stat label="REQ" v={`Lv ${d.unlockLevel}`} />
              </div>
              {isFeatured ? (
                <div className="mt-1 space-y-0.5">
                  <div className="text-[9px] text-amber line-through opacity-50">+{d.rewardCredits.toLocaleString()}cr · +{d.rewardExp}xp · 1 module</div>
                  <div className="text-[9px] font-bold text-amber">⭐ +{featuredCredits.toLocaleString()}cr · +{d.rewardExp}xp · 2 modules</div>
                </div>
              ) : (
                <div className="text-[9px] text-amber mt-1">+{d.rewardCredits.toLocaleString()}cr · +{d.rewardExp}xp · 1 module</div>
              )}
              <div className="text-[9px] text-mute mt-0.5">
                Materials: {d.rewardMaterials.map((m) => `${m.qty}× ${RESOURCES[m.resourceId].name}`).join(" · ")}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="text-[9px]" style={{ color: clears > 0 ? "#5cff8a" : "#555" }}>
                  ✓ {clears === 0 ? "Never cleared" : `${clears}× cleared`}
                </div>
                {bestMs !== undefined && (
                  <div className="text-[9px] text-amber">⏱ {fmtClearTime(bestMs)}</div>
                )}
              </div>
              <button
                className="btn btn-primary w-full mt-2"
                style={{ padding: "3px 6px", fontSize: 10, ...(isFeatured && !locked && !dungeon ? { background: "#ffd24a", color: "#000" } : {}) }}
                disabled={locked || !!dungeon}
                onClick={() => {
                  state.dockedAt = null;
                  enterDungeon(d.id as DungeonId);
                }}
              >
                {locked ? `Locked · Lv ${d.unlockLevel}` : dungeon ? "In a dungeon" : isFeatured ? "⭐ Launch Featured Run" : "Launch run"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SHIPS ─────────────────────────────────────────────────────────────────
function ShipsTab() {
  const player = useGame((s) => s.player);

  const buy = (id: ShipClassId) => {
    const cls = SHIP_CLASSES[id];
    if (player.ownedShips.includes(id)) {
      player.shipClass = id;
      reconcileShipSlots();
      ensureAmmoInitialized();
      const stats = effectiveStats();
      player.hull = stats.hullMax; player.shield = stats.shieldMax;
      player.drones = player.drones.slice(0, cls.droneSlots);
      pushNotification(`Boarded ${cls.name}`, "good");
      save(); bump();
      return;
    }
    if (player.credits < cls.price) { pushNotification("Not enough credits", "bad"); return; }
    player.credits -= cls.price;
    player.ownedShips.push(id);
    player.shipClass = id;
    reconcileShipSlots();
    ensureAmmoInitialized();
    const stats = effectiveStats();
    player.hull = stats.hullMax; player.shield = stats.shieldMax;
    player.drones = player.drones.slice(0, cls.droneSlots);
    pushNotification(`Acquired ${cls.name}!`, "good");
    save(); bump();
  };

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {(Object.values(SHIP_CLASSES) as { id: ShipClassId; [k: string]: any }[]).map((cls) => {
        const owned = player.ownedShips.includes(cls.id);
        const active = player.shipClass === cls.id;
        return (
          <div key={cls.id} className="panel p-3" style={{ borderColor: active ? cls.color : "var(--border-glow)" }}>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="flex items-center justify-center text-xl font-bold"
                style={{ width: 44, height: 44, background: `${cls.color}22`, border: `1px solid ${cls.color}`, color: cls.color }}
              >
                ▲
              </div>
              <div className="flex-1">
                <div className="font-bold tracking-widest text-sm" style={{ color: cls.color }}>
                  {cls.name.toUpperCase()}
                </div>
                <div className="text-dim text-[10px]">{cls.description}</div>
              </div>
              {active && <div className="text-cyan text-[9px] tracking-widest">[ACTIVE]</div>}
            </div>
            <div className="grid grid-cols-5 gap-1 text-[10px] mb-2">
              <Stat label="HUL" v={cls.hullMax} />
              <Stat label="SHD" v={cls.shieldMax} />
              <Stat label="SPD" v={cls.baseSpeed} />
              <Stat label="DMG" v={cls.baseDamage} />
              <Stat label="DRN" v={cls.droneSlots} />
            </div>
            <button className="btn btn-primary w-full" disabled={active || (!owned && player.credits < cls.price)} onClick={() => buy(cls.id)}>
              {active ? "Currently flying" : owned ? "Switch" : `Buy · ${cls.price.toLocaleString()}cr`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div>
      <div className="text-mute">{label}</div>
      <div className="text-cyan font-bold">{v}</div>
    </div>
  );
}

// ── DRONES ────────────────────────────────────────────────────────────────
function DronesTab() {
  const player = useGame((s) => s.player);
  const cls = SHIP_CLASSES[player.shipClass];
  const totalSlots = maxDroneSlots();
  const slotsLeft = totalSlots - player.drones.length;

  const buy = (kind: DroneKind) => {
    const def = DRONE_DEFS[kind];
    if (player.credits < def.price) { pushNotification("Not enough credits", "bad"); return; }
    if (slotsLeft <= 0) { pushNotification("No drone slots free", "bad"); return; }
    player.credits -= def.price;
    player.drones.push({
      id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      kind,
      mode: "orbit",
      hp: 300 + def.shieldBonus * 2 + def.hullBonus * 2,
      hpMax: 300 + def.shieldBonus * 2 + def.hullBonus * 2,
      orbitPhase: Math.random() * Math.PI * 2,
      fireCd: 0,
    });
    pushNotification(`Deployed ${def.name}`, "good");
    save(); bump();
  };

  const setMode = (id: string, mode: DroneMode) => {
    const d = player.drones.find((x) => x.id === id);
    if (!d) return;
    d.mode = mode;
    pushNotification(`Drone set to ${mode.toUpperCase()}`, "info");
    save(); bump();
  };

  const scrap = (id: string) => {
    const d = player.drones.find((x) => x.id === id);
    if (!d) return;
    const def = DRONE_DEFS[d.kind];
    const refund = Math.floor(def.price * 0.5);
    player.credits += refund;
    player.drones = player.drones.filter((x) => x.id !== id);
    pushNotification(`Scrapped drone +${refund}cr`, "good");
    save(); bump();
  };

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <div>
        <div className="text-cyan tracking-widest text-xs mb-3">
          ▶ DRONE BAY — {player.drones.length}/{totalSlots} SLOTS
        </div>
        <div className="space-y-2">
          {player.drones.length === 0 && (
            <div className="text-mute italic text-xs">No drones deployed.</div>
          )}
          {player.drones.map((d) => {
            const def = DRONE_DEFS[d.kind];
            return (
              <div key={d.id} className="panel p-3 flex items-center gap-3">
                <div
                  className="flex items-center justify-center text-lg"
                  style={{ width: 40, height: 40, background: `${def.color}22`, border: `1px solid ${def.color}`, color: def.color }}
                >
                  ✦
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs" style={{ color: def.color }}>{def.name}</div>
                  <div className="text-dim text-[10px]">
                    {def.damageBonus > 0 && `+${def.damageBonus} dmg `}
                    {def.shieldBonus > 0 && `+${def.shieldBonus} shd `}
                    {def.hullBonus > 0 && `+${def.hullBonus} hp`}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    {(["orbit", "forward", "defensive"] as DroneMode[]).map((m) => (
                      <button
                        key={m}
                        className="btn"
                        style={{
                          padding: "2px 6px", fontSize: 8,
                          background: d.mode === m ? `${def.color}33` : "transparent",
                          borderColor: d.mode === m ? def.color : "var(--border-glow)",
                          color: d.mode === m ? def.color : "var(--text-dim)",
                        }}
                        onClick={() => setMode(d.id, m)}
                      >
                        {m === "orbit" ? "ORB" : m === "forward" ? "FWD" : "DEF"}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-danger" style={{ padding: "2px 6px", fontSize: 9 }} onClick={() => scrap(d.id)}>
                    Scrap
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-mute text-[9px] mt-2 italic">
          Modes: ORBIT (default circle), FORWARD (advance to mid-target), DEFENSIVE (hold close, short range).
        </div>
      </div>

      <div>
        <div className="text-cyan tracking-widest text-xs mb-3">▶ DRONE CATALOG</div>
        <div className="space-y-2">
          {Object.values(DRONE_DEFS).map((def) => (
            <div key={def.id} className="panel p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-xs" style={{ color: def.color }}>{def.name}</div>
                <div className="text-amber text-xs font-bold">{def.price.toLocaleString()}cr</div>
              </div>
              <div className="text-dim text-[10px] mb-2">{def.description}</div>
              <div className="flex gap-3 text-[10px] mb-2">
                {def.damageBonus > 0 && <span className="text-red">+{def.damageBonus} dmg</span>}
                {def.shieldBonus > 0 && <span className="text-cyan">+{def.shieldBonus} shield</span>}
                {def.hullBonus > 0 && <span className="text-green">+{def.hullBonus} hull</span>}
                {def.fireRate > 0 && <span className="text-amber">{def.fireRate.toFixed(1)} shots/s</span>}
              </div>
              <button
                className="btn btn-primary w-full"
                disabled={player.credits < def.price || slotsLeft <= 0}
                onClick={() => buy(def.id)}
              >
                {slotsLeft <= 0 ? "No slots" : `Deploy · ${def.price.toLocaleString()}cr`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MARKET ────────────────────────────────────────────────────────────────
function MarketTab({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const station = STATIONS.find((s) => s.id === stationId)!;
  const cls = SHIP_CLASSES[player.shipClass];
  const tierCap = Math.min(5, Math.max(1, Math.ceil(player.level / 4)));
  const marketWeaponModules = Object.values(MODULE_DEFS).filter((d) => d.slot === "weapon" && d.tier <= tierCap);

  const buy = (rid: ResourceId, qty: number) => {
    const price = stationPrice(stationId, rid);
    const cost = price * qty;
    if (player.credits < cost) { pushNotification("Not enough credits", "bad"); return; }
    if (cargoUsed() + qty > cls.cargoMax) { pushNotification("Cargo bay full", "bad"); return; }
    player.credits -= cost;
    addCargo(rid, qty);
    pushNotification(`Bought ${qty}× ${RESOURCES[rid].name} · -${cost.toLocaleString()}cr`, "good");
    save(); bump();
  };

  const sell = (rid: ResourceId, qty: number) => {
    const have = player.cargo.find((c) => c.resourceId === rid);
    if (!have) return;
    const take = Math.min(have.qty, qty);
    if (take <= 0) return;
    const price = stationPrice(stationId, rid);
    const earn = price * take;
    removeCargo(rid, take);
    player.credits += earn;
    pushNotification(`Sold ${take}× ${RESOURCES[rid].name} · +${earn.toLocaleString()}cr`, "good");
    save(); bump();
  };

  const allRes = Object.values(RESOURCES);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-cyan tracking-widest text-xs">▶ COMMODITY EXCHANGE</div>
          <div className="text-mute text-[10px]">
            Buy low at one station, sell high at another. Different stations specialize in different resources.
          </div>
        </div>
        <div className="text-right">
          <div className="text-mute text-[10px]">CREDITS</div>
          <div className="text-amber font-bold">{player.credits.toLocaleString()}cr</div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 px-2 py-1 text-[9px] tracking-widest text-mute border-b" style={{ borderColor: "var(--border-soft)" }}>
        <div className="col-span-2">RESOURCE</div>
        <div className="text-right">BASE</div>
        <div className="text-right">HERE</div>
        <div className="text-right">±</div>
        <div className="text-right">CARGO</div>
        <div className="text-center">TRADE</div>
      </div>

      <div className="space-y-1 mt-1">
        {allRes.map((r) => {
          const price = stationPrice(stationId, r.id);
          const diff = ((price - r.basePrice) / r.basePrice) * 100;
          const have = player.cargo.find((c) => c.resourceId === r.id)?.qty ?? 0;
          return (
            <div key={r.id} className="grid grid-cols-7 gap-2 items-center px-2 py-1.5 hover:bg-white/5 border-b" style={{ borderColor: "var(--border-soft)" }}>
              <div className="col-span-2 flex items-center gap-2">
                <div
                  className="flex items-center justify-center"
                  style={{ width: 22, height: 22, background: `${r.color}22`, border: `1px solid ${r.color}`, color: r.color, fontSize: 12 }}
                >
                  {r.glyph}
                </div>
                <div>
                  <div className="text-bright text-[11px]">{r.name}</div>
                  <div className="text-mute text-[8px]">{r.description}</div>
                </div>
              </div>
              <div className="text-right text-mute text-[11px] tabular-nums">{r.basePrice}</div>
              <div className="text-right font-bold tabular-nums" style={{ color: diff < 0 ? "#5cff8a" : diff > 0 ? "#ff5c6c" : "var(--text-dim)" }}>
                {price}
              </div>
              <div className="text-right text-[10px] tabular-nums" style={{ color: diff < 0 ? "#5cff8a" : "#ff5c6c" }}>
                {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
              </div>
              <div className="text-right text-cyan text-[11px] tabular-nums">{have}</div>
              <div className="flex gap-1 justify-center">
                <button className="btn" style={{ padding: "2px 6px", fontSize: 9 }} onClick={() => buy(r.id, 1)}>+1</button>
                <button className="btn" style={{ padding: "2px 6px", fontSize: 9 }} onClick={() => buy(r.id, 10)}>+10</button>
                <button className="btn btn-amber" style={{ padding: "2px 6px", fontSize: 9 }} disabled={have <= 0} onClick={() => sell(r.id, 1)}>-1</button>
                <button className="btn btn-amber" style={{ padding: "2px 6px", fontSize: 9 }} disabled={have < 10} onClick={() => sell(r.id, 10)}>-10</button>
                <button className="btn btn-amber" style={{ padding: "2px 6px", fontSize: 9 }} disabled={have <= 0} onClick={() => sell(r.id, have)}>All</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-mute text-[10px] italic">
        Tip: visit Iron Belt Refinery for cheap iron and lumenite. Resell quantum chips at Crimson stations for premium.
      </div>

      {/* Consumables Shop */}
      <div className="mt-5">
        <div className="text-cyan tracking-widest text-xs mb-2">▶ CONSUMABLES SHOP</div>
        <div className="grid grid-cols-1 gap-1">
          {(Object.keys(CONSUMABLE_DEFS) as ConsumableId[]).map((cid) => {
            const def = CONSUMABLE_DEFS[cid];
            const have = player.consumables[cid] ?? 0;
            return (
              <div
                key={cid}
                className="flex items-center gap-3 px-3 py-2 border-b"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <div
                  style={{
                    width: 30, height: 30, fontSize: 18,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${def.color}22`, border: `1px solid ${def.color}`,
                    color: def.color, flexShrink: 0,
                  }}
                >
                  {def.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-bright text-[11px] font-bold">{def.name}</div>
                  <div className="text-mute text-[9px]">{def.description}</div>
                </div>
                <div className="text-cyan text-[11px] tabular-nums whitespace-nowrap">×{have}</div>
                <div className="text-amber text-[11px] tabular-nums whitespace-nowrap">{def.price}cr</div>
                <div className="flex gap-1">
                  <button
                    className="btn btn-primary"
                    style={{ padding: "2px 8px", fontSize: 9 }}
                    disabled={player.credits < def.price}
                    onClick={() => buyConsumable(cid, 1)}
                  >
                    ×1
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "2px 8px", fontSize: 9 }}
                    disabled={player.credits < def.price * 5}
                    onClick={() => buyConsumable(cid, 5)}
                  >
                    ×5
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weapon Modules Shop */}
      <div className="mt-5">
        <div className="text-cyan tracking-widest text-xs mb-2">▶ WEAPON MODULES</div>
        <div className="space-y-1.5">
          {marketWeaponModules.map((def) => {
            const canAfford = player.credits >= def.price;
            return (
              <div key={def.id} className="panel p-2 flex items-start gap-2"
                style={{ borderColor: RARITY_COLOR[def.rarity] }}>
                <div className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 28, height: 28, background: `${def.color}22`, border: `1px solid ${def.color}`, color: def.color, fontSize: 14 }}>
                  {def.glyph}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[11px] font-bold tracking-widest" style={{ color: RARITY_COLOR[def.rarity] }}>{def.name}</div>
                    <span className="text-[8px] uppercase" style={{ color: RARITY_COLOR[def.rarity] }}>· {def.rarity}</span>
                  </div>
                  <div className="text-mute text-[9px] leading-tight">{def.description}</div>
                  {modStatPills(def.stats)}
                  {def.weaponKind === "rocket" && <RocketAmmoBadge />}
                </div>
                <button className="btn btn-primary"
                  style={{ padding: "2px 8px", fontSize: 10 }}
                  disabled={!canAfford}
                  onClick={() => {
                    if (!canAfford) return;
                    state.player.credits -= def.price;
                    addInventoryItem(def.id);
                    pushNotification(`Bought ${def.name}`, "good");
                    save(); bump();
                  }}>
                  {def.price.toLocaleString()}cr
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── CARGO ─────────────────────────────────────────────────────────────────
function CargoTab() {
  const player = useGame((s) => s.player);
  const cls = SHIP_CLASSES[player.shipClass];
  const total = cargoUsed();

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-cyan tracking-widest text-xs">▶ CARGO BAY</div>
          <div className="text-mute text-[11px]">Carrying {total}/{cls.cargoMax} units</div>
        </div>
      </div>
      {player.cargo.length === 0 && (
        <div className="text-mute text-xs italic">Empty. Mine asteroids, defeat enemies, or trade at the market.</div>
      )}
      <div className="space-y-2">
        {player.cargo.map((c) => {
          const r = RESOURCES[c.resourceId];
          return (
            <div key={c.resourceId} className="panel p-3 flex items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, background: `${r.color}22`, border: `1px solid ${r.color}`, color: r.color, fontSize: 16 }}
              >
                {r.glyph}
              </div>
              <div className="flex-1">
                <div style={{ color: r.color }} className="font-bold text-sm">{r.name}</div>
                <div className="text-mute text-[10px]">×{c.qty} · base {r.basePrice}cr/u</div>
              </div>
              <div className="text-amber font-bold tabular-nums">{(c.qty * r.basePrice).toLocaleString()}cr</div>
            </div>
          );
        })}
      </div>
      <div className="text-mute text-[10px] italic mt-3">
        Use the Market tab to sell cargo at the current station's prices.
      </div>
    </div>
  );
}

// ── REPAIR / SERVICES ─────────────────────────────────────────────────────
function RepairTab({ stationId: _stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const stats = effectiveStats();
  const hullDamage = stats.hullMax - player.hull;
  const shieldMissing = stats.shieldMax - player.shield;
  const repairCost = Math.ceil(hullDamage * 2);
  const refillShield = () => {
    player.shield = stats.shieldMax;
    pushNotification("Shields recharged", "good");
    save(); bump();
  };
  const repair = () => {
    if (hullDamage <= 0) { pushNotification("Hull is already pristine", "info"); return; }
    if (player.credits < repairCost) { pushNotification("Not enough credits", "bad"); return; }
    player.credits -= repairCost;
    player.hull = stats.hullMax;
    pushNotification(`Hull repaired · -${repairCost}cr`, "good");
    save(); bump();
  };
  const repairDrones = () => {
    let total = 0;
    for (const d of player.drones) {
      const cost = Math.ceil((d.hpMax - d.hp) * 1.5);
      total += cost;
    }
    if (player.credits < total) { pushNotification("Not enough credits", "bad"); return; }
    player.credits -= total;
    for (const d of player.drones) d.hp = d.hpMax;
    pushNotification(`Drones repaired · -${total}cr`, "good");
    save(); bump();
  };

  const droneRepairCost = player.drones.reduce((a, d) => a + Math.ceil((d.hpMax - d.hp) * 1.5), 0);

  // Ammo restock
  const rocketIds = getRocketWeaponIds();
  const ammoMax = rocketAmmoMax();
  const hasRockets = rocketIds.length > 0;

  return (
    <div className="p-5 space-y-4 max-w-2xl">
      <div className="text-cyan tracking-widest text-xs mb-2">▶ STATION SERVICES</div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-green">✚</div>
        <div className="flex-1">
          <div className="text-green font-bold tracking-widest">HULL REPAIR</div>
          <div className="text-dim text-[11px]">Restore {hullDamage} hull points to full integrity.</div>
        </div>
        <button className="btn btn-primary" disabled={hullDamage <= 0 || player.credits < repairCost} onClick={repair}>
          {hullDamage <= 0 ? "PRISTINE" : `Repair · ${repairCost}cr`}
        </button>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-cyan">⟁</div>
        <div className="flex-1">
          <div className="text-cyan font-bold tracking-widest">SHIELD RECHARGE</div>
          <div className="text-dim text-[11px]">Free at any docked station. Restores {Math.round(shieldMissing)} SP.</div>
        </div>
        <button className="btn btn-primary" disabled={shieldMissing <= 0} onClick={refillShield}>
          {shieldMissing <= 0 ? "FULL" : "Recharge · FREE"}
        </button>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-amber">✦</div>
        <div className="flex-1">
          <div className="text-amber font-bold tracking-widest">DRONE OVERHAUL</div>
          <div className="text-dim text-[11px]">
            Restore all {player.drones.length} drone(s) to full HP.
          </div>
        </div>
        <button className="btn btn-amber" disabled={droneRepairCost <= 0 || player.credits < droneRepairCost} onClick={repairDrones}>
          {droneRepairCost <= 0 ? "ALL OK" : `Repair · ${droneRepairCost}cr`}
        </button>
      </div>

      {/* Tiered Ammo Types */}
      {hasRockets ? (
        <div className="panel p-4">
          <div className="font-bold tracking-widest mb-3" style={{ color: "#ff8a4e" }}>⟁ LASER RESUPPLY · AMMO TYPES</div>
          <div className="text-dim text-[11px] mb-3">
            Each weapon can carry a full load of any ammo type. Click an ammo type to make it active, then purchase to restock it.
          </div>
          {rocketIds.map((id) => {
            const item = player.inventory.find((m) => m.instanceId === id);
            const wDef = item ? MODULE_DEFS[item.defId] : null;
            const activeType = getActiveAmmoType(id);
            return (
              <div key={id} className="mb-4 last:mb-0">
                <div className="text-[10px] tracking-widest mb-2" style={{ color: wDef?.color ?? "#ff8a4e" }}>
                  {wDef?.name ?? "Rocket Launcher"}
                </div>
                <div className="space-y-2">
                  {(["x1", "x2", "x3", "x4"] as RocketAmmoType[]).map((type) => {
                    const tDef = ROCKET_AMMO_TYPE_DEFS[type];
                    const cur = getAmmoCountForType(id, type);
                    const missing = Math.max(0, ammoMax - cur);
                    const cost = missing * tDef.costPerRound;
                    const isActive = activeType === type;
                    const pct = ammoMax > 0 ? cur / ammoMax : 0;
                    return (
                      <div
                        key={type}
                        className="rounded p-2"
                        style={{
                          background: isActive ? tDef.color + "15" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${isActive ? tDef.color + "80" : "rgba(255,255,255,0.08)"}`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest"
                            style={{
                              background: isActive ? tDef.color + "30" : "transparent",
                              color: isActive ? tDef.color : "#666",
                              border: `1px solid ${isActive ? tDef.color : "#444"}`,
                              cursor: "pointer",
                            }}
                            onClick={() => switchRocketAmmoType(id, type)}
                          >
                            {isActive ? "▶ " : ""}{tDef.shortName}
                          </button>
                          <div className="flex-1">
                            <div className="text-[10px] font-bold" style={{ color: tDef.color }}>{tDef.name}</div>
                            <div className="text-dim text-[9px]">{tDef.description}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] tabular-nums" style={{ color: cur === 0 ? "#ff5c6c" : tDef.color }}>
                              {cur}/{ammoMax}
                            </div>
                            <div className="text-dim text-[8px]">{tDef.costPerRound}cr/rd</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div className="h-full" style={{ width: `${pct * 100}%`, background: cur === 0 ? "#ff5c6c" : tDef.color, transition: "width 0.3s" }} />
                          </div>
                      <button
                            className="text-[9px] px-2 py-0.5"
                            style={{
                              borderRadius: 3,
                              border: `1px solid ${missing === 0 ? "#444" : tDef.color}`,
                              color: missing === 0 ? "#555" : tDef.color,
                              background: "transparent",
                              cursor: missing === 0 || player.credits < cost ? "not-allowed" : "pointer",
                              opacity: missing === 0 || player.credits < cost ? 0.5 : 1,
                            }}
                            disabled={missing === 0 || player.credits < cost}
                            onClick={() => purchaseTypedAmmo(id, type)}
                          >
                            {missing === 0 ? "FULL" : `Buy ${missing} · ${cost}cr`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel p-4 flex items-start gap-4">
          <div className="text-3xl" style={{ color: "#ff8a4e" }}>⟁</div>
          <div className="flex-1">
            <div className="font-bold tracking-widest" style={{ color: "#ff8a4e" }}>ROCKET RESUPPLY</div>
            <div className="text-dim text-[11px]">No rocket weapons equipped. Equip a rocket launcher to use this service.</div>
          </div>
        </div>
      )}

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl" style={{ color: "#ff8a4e" }}>⟳</div>
        <div className="flex-1">
          <div className="font-bold tracking-widest" style={{ color: "#ff8a4e" }}>AUTO-RESTOCK AMMO</div>
          <div className="text-dim text-[11px]">
            Automatically top up rocket ammo when docking, if you have enough credits.
          </div>
        </div>
        <button
          className="btn"
          style={{
            padding: "6px 18px",
            borderColor: player.autoRestock ? "#ff8a4e" : "rgba(255,255,255,0.15)",
            color: player.autoRestock ? "#ff8a4e" : "#888",
            background: player.autoRestock ? "rgba(255,138,78,0.12)" : "transparent",
            minWidth: 64,
          }}
          onClick={() => setAutoRestock(!player.autoRestock)}
        >
          {player.autoRestock ? "ON" : "OFF"}
        </button>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-green">⚙</div>
        <div className="flex-1">
          <div className="text-green font-bold tracking-widest">AUTO-REPAIR HULL</div>
          <div className="text-dim text-[11px]">
            Automatically repair hull damage when docking, if you have enough credits (2cr/HP).
          </div>
        </div>
        <button
          className="btn"
          style={{
            padding: "6px 18px",
            borderColor: player.autoRepairHull ? "#5cff8a" : "rgba(255,255,255,0.15)",
            color: player.autoRepairHull ? "#5cff8a" : "#888",
            background: player.autoRepairHull ? "rgba(92,255,138,0.12)" : "transparent",
            minWidth: 64,
          }}
          onClick={() => setAutoRepairHull(!player.autoRepairHull)}
        >
          {player.autoRepairHull ? "ON" : "OFF"}
        </button>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-cyan">↺</div>
        <div className="flex-1">
          <div className="text-cyan font-bold tracking-widest">AUTO-SHIELD RECHARGE</div>
          <div className="text-dim text-[11px]">
            Automatically recharge shields to full when docking. Always free.
          </div>
        </div>
        <button
          className="btn"
          style={{
            padding: "6px 18px",
            borderColor: player.autoShieldRecharge ? "#4ee2ff" : "rgba(255,255,255,0.15)",
            color: player.autoShieldRecharge ? "#4ee2ff" : "#888",
            background: player.autoShieldRecharge ? "rgba(78,226,255,0.12)" : "transparent",
            minWidth: 64,
          }}
          onClick={() => setAutoShieldRecharge(!player.autoShieldRecharge)}
        >
          {player.autoShieldRecharge ? "ON" : "OFF"}
        </button>
      </div>

      <div className="panel p-4">
        <div className="text-cyan tracking-widest text-xs mb-2">▶ INSURANCE & RESPAWN</div>
        <div className="text-dim text-[11px]">
          Death penalty: <span className="text-red font-bold">10% credit loss</span> · Hull and shield refilled · Respawn at last station.
          Carry less cash and bank earnings between bounty runs.
        </div>
      </div>
    </div>
  );
}

// ── SKILLS ────────────────────────────────────────────────────────────────
function SkillsTab() {
  const player = useGame((s) => s.player);
  const branches: { id: SkillBranch; name: string; color: string }[] = [
    { id: "offense",     name: "OFFENSE",     color: "#ff5c6c" },
    { id: "defense",     name: "DEFENSE",     color: "#4ee2ff" },
    { id: "utility",     name: "UTILITY",     color: "#5cff8a" },
    { id: "engineering", name: "ENGINEERING", color: "#ffd24a" },
  ];
  const branchNodes: Record<SkillBranch, SkillNode[]> = {
    offense: SKILL_NODES.filter((n) => n.branch === "offense"),
    defense: SKILL_NODES.filter((n) => n.branch === "defense"),
    utility: SKILL_NODES.filter((n) => n.branch === "utility"),
    engineering: SKILL_NODES.filter((n) => n.branch === "engineering"),
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-cyan tracking-widest text-xs">▶ SKILL TREE</div>
          <div className="text-mute text-[10px] mt-1">Earn 1 skill point per level. Spend below.</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="panel px-3 py-2">
            <div className="text-mute text-[9px] tracking-widest">UNSPENT</div>
            <div className="text-amber font-bold text-lg tabular-nums">{player.skillPoints}</div>
          </div>
          <button
            className="btn btn-danger"
            style={{ padding: "6px 12px", fontSize: 10 }}
            onClick={() => { if (confirm("Reset skills for 2000cr?")) resetSkills(); }}
          >
            RESPEC · 2000cr
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        {branches.map((b) => (
          <div key={b.id} className="panel p-3" style={{ position: "relative", overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                left: 18,
                top: 44,
                bottom: 14,
                width: 2,
                background: `linear-gradient(to bottom, ${b.color}55, ${b.color}11)`,
              }}
            />
            <div className="font-bold tracking-widest text-xs mb-2" style={{ color: b.color }}>
              ◆ {b.name}
            </div>
            <div className="space-y-4">
              {branchNodes[b.id].map((n, idx) => {
                const cur = player.skills[n.id] ?? 0;
                const reqMet = !n.requires || (player.skills[n.requires] ?? 0) > 0;
                const canBuy = cur < n.maxRank && reqMet && player.skillPoints >= n.cost;
                return (
                  <div
                    key={n.id}
                    className="p-2"
                    style={{
                      marginLeft: idx === 0 ? 0 : idx % 2 === 0 ? 20 : 10,
                      background: cur > 0 ? `${b.color}11` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${cur > 0 ? b.color + "66" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 6,
                      position: "relative",
                    }}
                  >
                    {idx > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          left: -12,
                          top: 16,
                          width: 12,
                          height: 2,
                          background: `${b.color}55`,
                        }}
                      />
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-[11px]" style={{ color: cur > 0 ? b.color : "var(--text-dim)" }}>
                        {n.name}
                      </div>
                      <div className="text-[10px] tabular-nums" style={{ color: b.color }}>
                        {cur}/{n.maxRank}
                      </div>
                    </div>
                    <div className="text-dim text-[10px] mb-1">{n.description}</div>
                    {n.requires && (
                      <div className="text-mute text-[9px] mb-1">
                        Requires: {SKILL_NODES.find((x) => x.id === n.requires)?.name}
                      </div>
                    )}
                    <button
                      className="btn"
                      style={{
                        padding: "3px 8px", fontSize: 9, width: "100%",
                        borderColor: canBuy ? b.color : "var(--border-glow)",
                        color: canBuy ? b.color : "var(--text-mute)",
                        background: canBuy ? `${b.color}15` : "transparent",
                      }}
                      disabled={!canBuy}
                      onClick={() => buySkillRank(n.id as SkillId)}
                    >
                      {cur >= n.maxRank ? "MAX" : !reqMet ? "LOCKED" : `Buy · ${n.cost} pt${n.cost > 1 ? "s" : ""}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MISSIONS ──────────────────────────────────────────────────────────────
function MissionsTab() {
  const player = useGame((s) => s.player);
  const next = new Date(player.lastDailyReset + 24 * 3600 * 1000);
  const hrs = Math.max(0, Math.floor((next.getTime() - Date.now()) / 3600000));
  const mins = Math.max(0, Math.floor(((next.getTime() - Date.now()) % 3600000) / 60000));

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-cyan tracking-widest text-xs">▶ DAILY MISSIONS</div>
          <div className="text-mute text-[10px] mt-1">Resets in {hrs}h {mins}m</div>
        </div>
        <button
          className="btn btn-amber"
          style={{ padding: "6px 12px", fontSize: 10 }}
          onClick={rerollDaily}
          disabled={player.credits < 500}
        >
          REROLL · 500cr
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {player.dailyMissions.map((m) => {
          const pct = Math.min(1, m.progress / m.target);
          const claimed = m.claimed;
          const ready = m.completed && !claimed;
          return (
            <div
              key={m.id}
              className="panel p-3"
              style={{
                opacity: claimed ? 0.5 : 1,
                borderColor: ready ? "#5cff8a" : "var(--border-soft)",
              }}
            >
              <div className="font-bold text-[11px] text-cyan mb-1">{m.title}</div>
              <div className="text-dim text-[10px] mb-2">{m.description}</div>
              <div className="text-mute text-[10px] tabular-nums mb-1">
                {m.progress}/{m.target}
              </div>
              <div className="w-full h-1 mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${pct * 100}%`,
                    background: ready ? "#5cff8a" : "var(--accent-cyan)",
                  }}
                />
              </div>
              <div className="text-amber text-[10px] mb-2">
                +{m.rewardCredits}cr · +{m.rewardExp}xp · +{m.rewardHonor}✪
              </div>
              <button
                className="btn btn-primary w-full"
                style={{ padding: "4px 8px", fontSize: 10 }}
                disabled={!ready}
                onClick={() => claimMission(m.id)}
              >
                {claimed ? "CLAIMED" : ready ? "CLAIM" : "IN PROGRESS"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Milestones */}
      <div className="text-cyan tracking-widest text-xs mt-4 mb-2">▶ LIFETIME MILESTONES</div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(player.milestones).map(([k, v]) => (
          <div key={k} className="panel p-2">
            <div className="text-mute text-[9px] tracking-widest uppercase">{k}</div>
            <div className="text-amber font-bold text-sm tabular-nums">{(v as number).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
