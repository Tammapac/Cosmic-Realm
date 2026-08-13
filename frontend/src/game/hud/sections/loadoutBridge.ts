// loadoutBridge.ts — Store→PixiJS-Brücke für den Loadout-Umbau, SCHRITT 2.
//
// Read-only. Übersetzt den globalen Spielzustand (game/store.ts) in einen
// flachen, Pixi-freundlichen Snapshot. KEINE Mutation, KEINE Logikduplikation —
// die Mutationen (equipModule/unequipSlot/sellInventoryItem) folgen in Schritt 3
// und rufen weiterhin die bestehenden Store-Funktionen.
//
// Abo-Mechanik: store.ts exportiert eine plain (nicht-React) Subscription:
//     subscribe(fn): () => void      — fn läuft bei jedem bump()/notify()
//     getSnapshot(): number          — monoton steigende Revisionsnummer
// Damit kann die Pixi-Sektion ohne React auf Änderungen reagieren.

import {
  state,
  subscribe,
  getSnapshot,
} from "../../store";
import { effectiveStats } from "../../loop";
import {
  MODULE_DEFS,
  SHIP_CLASSES,
  PET_DRONE_SLOT_ORDER,
  petDroneSlotCount,
  weaponSpriteUrl,
  type ModuleSlot,
  type ModuleDef,
} from "../../types";
import { lootItemColor, lootTipText } from "../../loot-ui";

export type FilterKey = "all" | ModuleSlot;

export interface LoadoutSocket {
  instanceId: string | null; // null = frei/gesperrt
  def: ModuleDef | null;
  locked: boolean;           // jenseits der aktuellen Kapazität (nur bei Drohne rangabhängig)
  droneSlot?: string;        // "weapon" | "module" | "extra" bei der Pet-Drohne
  icon: string;              // Sprite-URL oder "" (dann Glyph)
  glyph: string;             // Fallback-Glyph
  color: string;             // Akzentfarbe des Def
}

export interface LoadoutBank {
  slot: ModuleSlot | "drone";
  label: string;
  capacity: number;
  filled: number;
  sockets: LoadoutSocket[];
}

export interface LoadoutItem {
  instanceId: string;
  name: string;
  slot: ModuleSlot;
  rarity: string | null;
  color: string;
  ilvl: number;
  tier: number;
  equipped: boolean;
  icon: string;              // Sprite-URL oder ""
  glyph: string;
  legendary: boolean;
  tip: string;               // lootTipText für den Pixi-Tooltip-Layer
}

export interface LoadoutStats {
  damage: number;
  fireRate: number;
  critChance: number;
  hullMax: number;
  shieldMax: number;
  shieldRegen: number;
  speed: number;
  damageReduction: number;
  shieldAbsorb: number;
}

export interface LoadoutSnapshot {
  visible: boolean;          // dockedAt && hangarTab === "loadout"
  shipName: string;
  shipColor: string;
  credits: number;
  honor: number;
  level: number;
  exp: number;
  banks: LoadoutBank[];      // weapon · generator · module · drone
  inventory: LoadoutItem[];  // gefiltert + sortiert (für die Armory)
  inventoryCount: number;
  stats: LoadoutStats;
}

const SLOT_LABEL: Record<ModuleSlot, string> = {
  weapon: "WEAPON",
  generator: "GENERATOR",
  module: "MODULE",
};

function defFor(instanceId: string | null): ModuleDef | null {
  if (!instanceId) return null;
  const it = state.player.inventory.find((m) => m.instanceId === instanceId);
  return it ? MODULE_DEFS[it.defId] ?? null : null;
}

function socketFrom(id: string | null, def: ModuleDef | null, locked: boolean, droneSlot?: string): LoadoutSocket {
  return {
    instanceId: id,
    def,
    locked,
    droneSlot,
    icon: def ? (weaponSpriteUrl(def.id) ?? "") : "",
    glyph: def?.glyph ?? "+",
    color: def?.color ?? "#9db0c6",
  };
}

/** Baut eine reguläre Ausrüstungsbank aus player.equipped[slot] + Kapazität. */
function buildBank(slot: ModuleSlot): LoadoutBank {
  const cls = SHIP_CLASSES[state.player.shipClass];
  const capacity = cls.slots[slot];
  const arr = state.player.equipped[slot] ?? [];
  const sockets: LoadoutSocket[] = [];
  for (let i = 0; i < capacity; i++) {
    const id = arr[i] ?? null;
    sockets.push(socketFrom(id, defFor(id), false));
  }
  return {
    slot,
    label: SLOT_LABEL[slot],
    capacity,
    filled: arr.filter(Boolean).length,
    sockets,
  };
}

/** Pet-Drohnen-Bank: feste Slot-Ordnung, rangabhängig freigeschaltet. */
function buildDroneBank(): LoadoutBank {
  const pet = state.player.petDrone;
  const unlocked = petDroneSlotCount(pet?.level ?? 0);
  const eq: Record<string, string | null> = (pet?.equipped ?? {}) as any;
  const sockets: LoadoutSocket[] = PET_DRONE_SLOT_ORDER.map((ds, i) => {
    const id = eq[ds] ?? null;
    return socketFrom(id, defFor(id), i >= unlocked, ds);
  });
  return {
    slot: "drone",
    label: "PET-DROHNE",
    capacity: PET_DRONE_SLOT_ORDER.length,
    filled: sockets.filter((s) => s.instanceId).length,
    sockets,
  };
}

function isBound(instanceId: string): boolean {
  const p = state.player;
  if (
    p.equipped.weapon.includes(instanceId) ||
    p.equipped.generator.includes(instanceId) ||
    p.equipped.module.includes(instanceId)
  ) return true;
  const eq = p.petDrone?.equipped;
  return !!eq && PET_DRONE_SLOT_ORDER.some((k) => (eq as any)[k] === instanceId);
}

/** Aktuellen Zustand als flachen Snapshot lesen (read-only). */
export function buildLoadoutSnapshot(filter: FilterKey = "all"): LoadoutSnapshot {
  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];
  const s = effectiveStats();

  const inventory: LoadoutItem[] = p.inventory
    .filter((it) => {
      const def = MODULE_DEFS[it.defId];
      if (!def) return false;
      return filter === "all" || def.slot === filter;
    })
    .map((it) => {
      const def = MODULE_DEFS[it.defId]!;
      return {
        instanceId: it.instanceId,
        name: def.name,
        slot: def.slot,
        rarity: (it as any).rarity ?? def.rarity ?? null,
        color: lootItemColor(it as any, def) ?? def.color,
        ilvl: (it as any).ilvl ?? 1,
        tier: def.tier ?? 0,
        equipped: isBound(it.instanceId),
        icon: weaponSpriteUrl(def.id) ?? "",
        glyph: def.glyph ?? "?",
        legendary: !!(it as any).legendaryId,
        tip: lootTipText(it as any, {}),
      };
    })
    .sort((a, b) => (b.ilvl - a.ilvl) || (b.tier - a.tier));

  return {
    visible: !!state.dockedAt && state.hangarTab === "loadout",
    shipName: cls.name,
    shipColor: cls.color,
    credits: p.credits,
    honor: p.honor,
    level: p.level,
    exp: p.exp,
    banks: [buildBank("weapon"), buildBank("generator"), buildBank("module"), buildDroneBank()],
    inventory,
    inventoryCount: p.inventory.length,
    stats: {
      damage: s.damage,
      fireRate: s.fireRate,
      critChance: s.critChance,
      hullMax: s.hullMax,
      shieldMax: s.shieldMax,
      shieldRegen: s.shieldRegen,
      speed: s.speed,
      damageReduction: s.damageReduction,
      shieldAbsorb: (s as any).shieldAbsorb ?? 0,
    },
  };
}

/**
 * Change-getriebenes Abo: ruft onChange bei jedem bump() (Revision ändert sich).
 * Gibt eine Unsubscribe-Funktion zurück. Der Consumer entscheidet, ob er den
 * Snapshot neu baut — so bleibt buildLoadoutSnapshot() der einzige Lese-Pfad.
 */
export function onLoadoutChange(onChange: (rev: number) => void): () => void {
  let last = getSnapshot();
  const unsub = subscribe(() => {
    const rev = getSnapshot();
    if (rev !== last) {
      last = rev;
      onChange(rev);
    }
  });
  return unsub;
}

export { getSnapshot as loadoutRevision };
