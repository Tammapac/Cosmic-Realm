// loadoutActions.ts — der EINZIGE Interaktions-/Mutations-Pfad des Pixi-Loadouts.
//
// SCHRITT 3: Interaktionsvertrag. Bündelt die fünf erlaubten Store-Aufrufe an
// EINER Stelle (equip/unequip Schiff, equip/unequip Drohne, verkaufen) plus die
// Filter-Umschaltung. KEINE Logik wird dupliziert — alles ruft die bestehenden,
// getesteten Funktionen aus game/store.ts auf (die intern save()+bump() feuern).
//
// Doppelklick/Rechtsklick werden in Pixi selbst getimt bzw. übers rightclick-
// Event abgebildet (kein DOM dblclick/title/contextmenu vorhanden).

import {
  state,
  equipModule,
  unequipInstance,
  unequipSlot,
  sellInventoryItem,
  equipPetSlot,
  unequipPetSlot,
} from "../../store";
import { MODULE_DEFS, PET_DRONE_SLOT_ORDER, type ModuleSlot, type PetDroneSlot } from "../../types";
import type { FilterKey } from "./loadoutBridge";
export type { FilterKey };

/** Ist diese Instanz aktuell am Schiff oder an der Drohne gebunden? */
export function isEquipped(instanceId: string): boolean {
  const p = state.player;
  const onShip =
    p.equipped.weapon.includes(instanceId) ||
    p.equipped.generator.includes(instanceId) ||
    p.equipped.module.includes(instanceId);
  if (onShip) return true;
  const eq = p.petDrone?.equipped;
  return !!eq && PET_DRONE_SLOT_ORDER.some((k) => eq[k] === instanceId);
}

/**
 * Doppelklick auf ein Inventar-Item = Toggle Equip/Unequip am Schiff
 * (spiegelt InventoryPanel.onEquipToggle). Wählt den ersten freien Slot,
 * sonst Index 0. Delegiert an equipModule/unequipInstance.
 */
export function toggleEquipShip(instanceId: string): void {
  const it = state.player.inventory.find((m) => m.instanceId === instanceId);
  const def = it ? MODULE_DEFS[it.defId] : null;
  if (!def) return;
  if (isEquipped(instanceId)) {
    unequipInstance(instanceId);
    return;
  }
  const arr = state.player.equipped[def.slot];
  let idx = arr.findIndex((x) => x === null);
  if (idx < 0) idx = 0;
  equipModule(instanceId, def.slot, idx);
}

/** Klick auf einen belegten Schiff-Sockel = Unequip dieses Slots. */
export function unequipShipSlot(slot: ModuleSlot, index: number): void {
  unequipSlot(slot, index);
}

/** Doppelklick auf ein Item bei ausgewähltem Drohnen-Slot = an die Drohne binden. */
export function equipDroneSlot(slot: PetDroneSlot, instanceId: string): void {
  equipPetSlot(slot, instanceId);
}

/** Klick auf einen belegten Drohnen-Sockel = lösen. */
export function unequipDroneSlot(slot: PetDroneSlot): void {
  unequipPetSlot(slot);
}

/** Verkaufen nur wenn angedockt (wie Hangar/InventoryPanel). */
export function canSell(): boolean {
  return !!state.dockedAt;
}

/** Rechtsklick auf ein Item = verkaufen (nur angedockt). */
export function sellItem(instanceId: string): void {
  if (!canSell()) return;
  sellInventoryItem(instanceId);
}

// ── Doppelklick-Erkennung für Pixi (kein natives dblclick) ──────────────────
/**
 * Wickelt einen pointertap-Handler so, dass zwei Taps < `windowMs` auf DIESELBE
 * id als Doppelklick gelten; ein einzelner Tap feuert onSingle nach Ablauf.
 */
export function makeTapRouter(windowMs = 300) {
  let lastId: string | null = null;
  let lastT = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    tap(id: string, onSingle: (id: string) => void, onDouble: (id: string) => void) {
      const now = performance.now();
      if (lastId === id && now - lastT < windowMs) {
        if (timer) { clearTimeout(timer); timer = null; }
        lastId = null;
        onDouble(id);
        return;
      }
      lastId = id;
      lastT = now;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; lastId = null; onSingle(id); }, windowMs);
    },
    dispose() { if (timer) clearTimeout(timer); },
  };
}
