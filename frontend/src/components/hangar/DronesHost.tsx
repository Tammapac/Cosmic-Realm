// Wires the migrated S-06 Drones panel to real game state.
//
// The panel reads its stat block from Drones.constants.ts and exposes no prop
// to replace it, so the numbers shown are still the export's until that half
// gains a `drone` prop. What IS wired here are the three ACTIONS, which were
// previously dead — clicking UPGRADE, BUY AMMO or EQUIP did nothing at all:
//
//   onUpgrade  -> upgradePetDrone()        (real cost + level, server-backed)
//   onBuyAmmo  -> purchaseDroneAmmoAmount()(tops the drone pool back to full)
//   onEquip    -> equipPetSlot()           (binds an inventory item to a slot)
import {
  useGame, state as gameState, bump, pushNotification,
  upgradePetDrone, petDroneNextCost, purchaseDroneAmmoAmount,
  equipPetSlot, petSlotUnlocked,
} from "../../game/store";
import { DronesPanel } from "./DronesPanel";
import type { DroneItem, DroneSlotKey } from "./Drones.constants";

/** The export's three banks map onto this project's pet-drone slots. */
const SLOT_OF: Record<DroneSlotKey, "weapon" | "module" | "extra"> = {
  weapon: "weapon",
  module: "module",
  aux: "extra",
};

export function DronesHost() {
  const player = useGame((s) => s.player);
  const pet = player.petDrone;

  const upgrade = () => {
    const cost = petDroneNextCost();
    if (cost == null) { pushNotification("Drone is fully upgraded", "info"); return; }
    if (player.credits < cost) {
      pushNotification(`Upgrade costs ${cost.toLocaleString()}cr`, "bad");
      return;
    }
    void upgradePetDrone();
  };

  const buyAmmo = () => {
    const missing = Math.max(0, (player.droneAmmoMax ?? 0) - (player.droneAmmo ?? 0));
    if (missing <= 0) { pushNotification("Drone ammo already full", "info"); return; }
    purchaseDroneAmmoAmount(missing);
  };

  const equip = (item: DroneItem) => {
    if (!pet || pet.level <= 0) {
      pushNotification("No drone deployed", "bad");
      return;
    }
    // The export's item carries its bank in `cat`; map that to a real slot.
    const slot = SLOT_OF[(item as any).cat as DroneSlotKey] ?? "weapon";
    if (!petSlotUnlocked(slot as any)) {
      pushNotification("Slot not unlocked yet", "bad");
      return;
    }
    // The panel's demo items have no inventory instanceId, so nothing real can
    // be bound. Say that instead of silently doing nothing.
    const instanceId = (item as any).instanceId;
    if (!instanceId) {
      pushNotification("This is a preview item — equip from Loadout", "info");
      return;
    }
    equipPetSlot(slot as any, instanceId);
  };

  return (
    <DronesPanel
      onEquip={equip}
      onUpgrade={upgrade}
      onBuyAmmo={buyAmmo}
      onClose={() => { gameState.hangarTab = null; bump(); }}
    />
  );
}

export default DronesHost;
