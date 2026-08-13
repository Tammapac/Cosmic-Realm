// Wires the migrated Loadout panel to real game state.
//
// Unlike the Skill Matrix (whose 60-node tree has no counterpart in this game),
// the Loadout export's data model matches this project almost exactly:
//
//   export slots  weapon / generator / module   ->  ModuleSlot, identical
//   drone sockets weapon / module / extra       ->  PetDroneSlot, identical
//   rarity ramp   common…celestial              ->  ModuleItem.rarity, identical
//   item fields   name / rarity / ilvl          ->  MODULE_DEFS + ModuleItem
//
// So this host feeds the panel REAL inventory and equipment, and every action
// calls the project's own mutation — no preview stubs:
//
//   equip    -> equipModule(instanceId, slot, index)
//   unequip  -> unequipSlot(slot, index)
//   sell     -> sellInventoryItem(instanceId)
import {
  useGame, state as gameState, bump, pushNotification,
  equipModule, unequipSlot, sellInventoryItem,
} from "../../game/store";
import {
  MODULE_DEFS, itemSpriteUrl, type ModuleItem, type ModuleSlot,
} from "../../game/types";
import { effectiveStats } from "../../game/loop";
import { cargoCapacity, petDroneSlots } from "../../game/store";
import { Loadout, type LoadoutItem, type LoadoutBank, type LoadoutStatGroup } from "./Loadout";
import { LOADOUT_BANKS, LOADOUT_CAP, LOADOUT_ICON_PATH } from "./Loadout.constants";

/**
 * Item icon.
 *
 * The export derives one from ilvl bands (laser-t2/4/6/8/10 etc.) because its
 * demo items carry no sprite. THIS project already assigns every catalog def a
 * `spriteKey` and resolves it through itemSpriteUrl() — that is the real icon,
 * so it wins. The export's banding is only the fallback for a def without one.
 */
function iconFor(def: { spriteKey?: string }, slot: ModuleSlot, ilvl: number, idx: number): string {
  const real = itemSpriteUrl(def.spriteKey);
  if (real) return real;
  const P = LOADOUT_ICON_PATH;
  if (slot === "weapon") {
    const t = ilvl < 15 ? 2 : ilvl < 25 ? 4 : ilvl < 35 ? 6 : ilvl < 45 ? 8 : 10;
    return `${P}laser-t${t}.png`;
  }
  if (slot === "generator") {
    return P + ["genshield-t2", "genspeed-t3", "genshield-t4", "genspeed-t5"][idx % 4] + ".png";
  }
  return P + ["mod0-t3", "mod1-t2", "mod2-t4", "mod3-t3"][idx % 4] + ".png";
}

/** Glyph per slot, mirroring the export's per-family codes. */
const SLOT_GLYPH: Record<ModuleSlot, string> = {
  weapon: "≡", generator: "⌬", module: "◈",
};

export function LoadoutHost() {
  const player = useGame((s) => s.player);

  /** Map a real inventory entry onto the panel's item shape. */
  const toItem = (m: ModuleItem, idx: number): LoadoutItem | null => {
    const def = MODULE_DEFS[m.defId];
    if (!def) return null;
    const slot = def.slot;
    const ilvl = m.ilvl ?? def.tier ?? 1;
    const equippedIndex = player.equipped[slot]?.indexOf(m.instanceId) ?? -1;
    return {
      instanceId: m.instanceId,
      slot,
      name: def.name,
      rarity: m.rarity ?? def.rarity ?? "common",
      ilvl,
      glyph: def.glyph ?? SLOT_GLYPH[slot],
      icon: iconFor(def, slot, ilvl, idx),
      equipped: equippedIndex >= 0,
      equippedIndex,
      description: def.description,
    };
  };

  const items: LoadoutItem[] = player.inventory
    .map(toItem)
    .filter((x): x is LoadoutItem => x !== null);

  /** Socket banks — real capacity from the ship, real contents from equipped. */
  const banks: LoadoutBank[] = LOADOUT_BANKS.map(([slot, label, color, glyph]) => {
    const equippedIds = player.equipped[slot] ?? [];
    // The ship's own slot count is authoritative; the export's CAP is the
    // fallback when a class does not declare one.
    const cap = equippedIds.length || LOADOUT_CAP[slot];
    const sockets = Array.from({ length: cap }, (_, i) => {
      const id = equippedIds[i];
      const it = id ? items.find((x) => x.instanceId === id) : undefined;
      return it ?? null;
    });
    return {
      slot, label, color, glyph,
      count: `${sockets.filter(Boolean).length} / ${cap}`,
      sockets,
    };
  });

  const equip = (item: LoadoutItem) => {
    const arr = player.equipped[item.slot] ?? [];
    // First free socket, or the first one if the bank is full.
    const free = arr.findIndex((x) => x == null);
    const index = free >= 0 ? free : 0;
    if (arr.length === 0) { pushNotification("Ship has no slot for this", "bad"); return; }
    equipModule(item.instanceId, item.slot, index);
  };

  const unequip = (slot: ModuleSlot, index: number) => {
    unequipSlot(slot, index);
    pushNotification("Unequipped", "good");
  };

  const sell = (item: LoadoutItem) => {
    if (item.equipped) { pushNotification("Unequip it first", "bad"); return; }
    sellInventoryItem(item.instanceId);
  };

  // Tactical readout — the export's five STAT_GROUPS_DEF blocks, filled with
  // this game's real numbers instead of its demo values.
  const st = effectiveStats();
  const eq = (slot: ModuleSlot) => (player.equipped[slot] ?? []).filter(Boolean).length;
  const cap = (slot: ModuleSlot) => (player.equipped[slot] ?? []).length;
  const statGroups: LoadoutStatGroup[] = [
    { label: "ATTACK", color: "#ff5c6c", rows: [
      { glyph: "⚔", label: "Damage", value: Math.round(st.damage).toLocaleString("en-US") },
      { glyph: "▸", label: "Fire Rate", value: "×" + st.fireRate.toFixed(2) },
      { glyph: "✦", label: "Crit Chance", value: (st.critChance * 100).toFixed(1) + "%" },
    ] },
    { label: "DEFENSE", color: "#4ee2ff", rows: [
      { glyph: "▣", label: "Hull", value: Math.round(st.hullMax).toLocaleString("en-US") },
      { glyph: "◈", label: "Shield", value: Math.round(st.shieldMax).toLocaleString("en-US") },
      { glyph: "↻", label: "Regen", value: st.shieldRegen.toFixed(1) + "/s" },
      { glyph: "◇", label: "Absorption", value: Math.round(st.shieldAbsorb * 100) + "%" },
    ] },
    { label: "MOBILITY", color: "#5cff8a", rows: [
      { glyph: "➤", label: "Speed", value: Math.round(st.speed).toLocaleString("en-US") },
      { glyph: "⛶", label: "Cargo", value: cargoCapacity().toLocaleString("en-US") + " t" },
    ] },
    { label: "UTILITY", color: "#b866ff", rows: [
      { glyph: "⛨", label: "Damage Reduction", value: st.damageReduction > 0 ? Math.round(st.damageReduction * 100) + "%" : "—" },
    ] },
    { label: "LOADOUT CAPACITY", color: "#e8b94d", rows: [
      { glyph: "≡", label: "Weapon Slots", value: eq("weapon") + " / " + cap("weapon") },
      { glyph: "⌬", label: "Generator Slots", value: eq("generator") + " / " + cap("generator") },
      { glyph: "◈", label: "Module Slots", value: eq("module") + " / " + cap("module") },
      { glyph: "✦", label: "Drone Slots", value: "0 / " + petDroneSlots() },
    ] },
  ];

  return (
    <Loadout
      items={items}
      banks={banks}
      statGroups={statGroups}
      credits={player.credits}
      shipName={player.name.toUpperCase()}
      onEquip={equip}
      onUnequip={unequip}
      onSell={sell}
      onClose={() => { gameState.hangarTab = null; bump(); }}
    />
  );
}

export default LoadoutHost;
