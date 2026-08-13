// Wires the migrated S-08 Station Services panel to real game state.
//
// Same split as ShipyardHost: StationServices.tsx stays the design export's own
// implementation, everything project-specific lives here.
//
// The repair maths are NOT reinvented — they are the existing RepairTab's rules
// verbatim (Hangar.tsx §RepairTab): hull 2cr per missing point, drone 1.5cr per
// missing point, shield recharge free. Same costs, same notifications, same
// sendDockRepair calls, so the two paths cannot drift.
import {
  useGame, state as gameState, bump, save, pushNotification,
  purchaseAmmoAmount, purchaseRocketAmmo, rocketAmmoMax, rocketMissileMax,
  getAmmoCount, getRocketAmmoCount,
} from "../../game/store";
import { effectiveStats } from "../../game/loop";
import { sendDockRepair } from "../../net/socket";
import {
  SHIP_CLASSES, STATIONS,
  ROCKET_AMMO_TYPE_DEFS, ROCKET_MISSILE_TYPE_DEFS,
  type RocketAmmoType, type RocketMissileType,
} from "../../game/types";

/** Ammo variant labels shown in the panel's grade tabs.
 *
 *  Laser types are x1..x4 in BOTH the export and this project, so those are
 *  verbatim. For rockets the export writes "DL-1/DL-2/BM-3/D-ROCK" but this
 *  project's own types are CL-1/CL-2/BM-3/D-ROCK — the real shortNames are used
 *  so the tabs select actual ammo rather than labels that match nothing. */
const LASER_VARIANTS: RocketAmmoType[] = ["x1", "x2", "x3", "x4"];
const ROCKET_TYPES: RocketMissileType[] = ["cl1", "cl2", "bm3", "drock"];
const ROCKET_VARIANTS = ROCKET_TYPES.map((t) => ROCKET_MISSILE_TYPE_DEFS[t].shortName);
import { StationServices } from "./StationServices";
import { STATION_SVC, type StationServices as ServicesData } from "./Services.constants";

const pct = (cur: number, max: number) =>
  max > 0 ? Math.max(0, Math.min(100, Math.round((cur / max) * 100))) : 0;

export function StationServicesHost({ stationId }: { stationId?: string }) {
  const player = useGame((s) => s.player);
  const stats = effectiveStats();
  const stationName = STATIONS.find((s) => s.id === stationId)?.name ?? "Station Services";

  const hullDamage = Math.max(0, stats.hullMax - player.hull);
  const shieldMissing = Math.max(0, stats.shieldMax - player.shield);
  const pet = player.petDrone;
  const droneMissing = pet && pet.level > 0 ? Math.max(0, pet.hpMax - pet.hp) : 0;

  const data: ServicesData = {
    credits: player.credits,
    // No mcoin balance exists on the player yet; the export's premium column
    // reads it. Kept at the export's value rather than inventing a currency.
    mcoins: STATION_SVC.mcoins,
    hull:   { pct: pct(player.hull, stats.hullMax),     cost: Math.ceil(hullDamage * 2) },
    shield: { pct: pct(player.shield, stats.shieldMax), cost: 0 },
    drone:  {
      pct: pet && pet.level > 0 ? pct(pet.hp, pet.hpMax) : 100,
      cost: Math.ceil(droneMissing * 1.5),
    },
    // Ammo banks are REAL: the export's variant labels map onto this project's
    // own ammo types (laser x1..x4 verbatim; the rocket labels are the display
    // names of cl1/cl2/bm3/drock). Counts, caps and prices come from the store.
    ammo: [
      {
        ...STATION_SVC.ammo[0],
        cur: getAmmoCount(player.activeAmmoType),
        max: rocketAmmoMax(),
        cost: Math.max(0, rocketAmmoMax() - getAmmoCount(player.activeAmmoType))
          * (ROCKET_AMMO_TYPE_DEFS[player.activeAmmoType]?.costPerRound ?? 6),
        variants: LASER_VARIANTS,
      },
      {
        ...STATION_SVC.ammo[1],
        cur: getRocketAmmoCount(player.activeRocketAmmoType),
        max: rocketMissileMax(),
        cost: Math.max(0, rocketMissileMax() - getRocketAmmoCount(player.activeRocketAmmoType))
          * (ROCKET_MISSILE_TYPE_DEFS[player.activeRocketAmmoType]?.costPerRound ?? 20),
        variants: ROCKET_VARIANTS,
      },
    ],
    insurance: {
      ...STATION_SVC.insurance,
      shipPrice: SHIP_CLASSES[player.shipClass]?.price ?? STATION_SVC.insurance.shipPrice,
    },
    respawn: STATION_SVC.respawn,
  };

  const repair = (key: "hull" | "shield" | "drone") => {
    if (key === "shield") {
      if (shieldMissing <= 0) { pushNotification("Shields already full", "info"); return; }
      player.shield = stats.shieldMax;
      sendDockRepair(player.hull, stats.shieldMax);
      pushNotification("Shields recharged", "good");
      save(); bump();
      return;
    }
    if (key === "hull") {
      const cost = Math.ceil(hullDamage * 2);
      if (hullDamage <= 0) { pushNotification("Hull is already pristine", "info"); return; }
      if (player.credits < cost) { pushNotification("Not enough credits", "bad"); return; }
      player.credits -= cost;
      player.hull = stats.hullMax;
      sendDockRepair(stats.hullMax, player.shield);
      pushNotification(`Hull repaired · -${cost}cr`, "good");
      save(); bump();
      return;
    }
    const cost = Math.ceil(droneMissing * 1.5);
    if (cost <= 0 || !pet) return;
    if (player.credits < cost) { pushNotification("Not enough credits", "bad"); return; }
    player.credits -= cost;
    pet.hp = pet.hpMax;
    pushNotification(`Drone repaired · -${cost}cr`, "good");
    save(); bump();
  };

  /** Top the selected bank back to full, using the project's own purchase
   *  functions (they handle cost, credit check, clamping and save()). */
  const refill = (ammoKey: string, variant: string) => {
    if (ammoKey === "laser") {
      const type = (LASER_VARIANTS.includes(variant as RocketAmmoType)
        ? variant : player.activeAmmoType) as RocketAmmoType;
      const missing = Math.max(0, rocketAmmoMax() - getAmmoCount(type));
      if (missing <= 0) { pushNotification("Laser ammo already full", "info"); return; }
      purchaseAmmoAmount(type, missing);
      return;
    }
    // Rockets: the tab shows shortNames, so map back to the type key.
    const type = (ROCKET_TYPES.find((t) => ROCKET_MISSILE_TYPE_DEFS[t].shortName === variant)
      ?? player.activeRocketAmmoType) as RocketMissileType;
    const missing = Math.max(0, rocketMissileMax() - getRocketAmmoCount(type));
    if (missing <= 0) { pushNotification("Rockets already full", "info"); return; }
    purchaseRocketAmmo(type, missing);
  };

  return (
    <StationServices
      data={data}
      stationName={stationName}
      onRepair={repair}
      onRefill={refill}
      // Insurance has no counterpart in this project's model yet — say so
      // rather than taking credits for something the game does not track.
      onRenewInsurance={() =>
        pushNotification("Ship insurance is not implemented yet", "info")}
      onClose={() => { gameState.hangarTab = null; bump(); }}
    />
  );
}

export default StationServicesHost;
