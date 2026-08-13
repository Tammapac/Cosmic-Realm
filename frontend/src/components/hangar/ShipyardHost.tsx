import type React from "react";
import { useGame, state as gameState, bump } from "../../game/store";
import { SHIP_CLASSES, type ShipClassId } from "../../game/types";
import { Shipyard } from "./Shipyard";
import { SHIPYARD_HULLS, type ShipyardHull } from "./Shipyard.constants";

/**
 * Wires the migrated S-04 Shipyard to real game state.
 *
 * Split the same way S-01 is: Shipyard.tsx stays the design export's own
 * implementation, everything project-specific lives here — so a future
 * re-export drops straight into the presentational half.
 *
 * The hull list comes from THIS PROJECT's SHIP_CLASSES, not the export's demo
 * array: names, prices and stats have to be the ones the game actually sells.
 * The export's lore block (LENGTH/MASS/CREW/BUILT/MAKER/CLASS) has no
 * counterpart in SHIP_CLASSES, so it is carried over from the export's matching
 * entry by name and falls back to em-dashes for hulls it never covered — the
 * alternative would be inventing ship history, which is content, not migration.
 */

/** Export lore rows, keyed by the ship name they were authored for. */
const LORE_BY_NAME = new Map(SHIPYARD_HULLS.map((h) => [h.name, h.lore]));

const EMPTY_LORE = {
  LENGTH: "—", MASS: "—", CREW: "—", BUILT: "—", MAKER: "—", CLASS: "—",
};

/** Stat caps, derived from the real fleet so the bars always scale to it. */
function computeCaps(hulls: ShipyardHull[]) {
  const max = (pick: (h: ShipyardHull) => number) =>
    Math.max(1, ...hulls.map(pick));
  return {
    HULL: max((h) => h.stats.HULL),
    SHD: max((h) => h.stats.SHD),
    SPD: max((h) => h.stats.SPD),
    DMG: max((h) => h.stats.DMG),
    DRN: max((h) => h.stats.DRN),
    WPN: max((h) => h.stats.WPN),
    GEN: max((h) => h.stats.GEN),
    MOD: max((h) => h.stats.MOD),
  };
}

export interface ShipyardHostProps {
  /** Ship preview renderer, injected by the caller.
   *
   *  Passed in rather than imported: ShipPreview lives in components/Hangar.tsx,
   *  which is also what mounts this host — importing it here would make the two
   *  modules circular. */
  renderPreview?: (shipId: ShipClassId, color: string, size: number) => React.ReactNode;
}

export function ShipyardHost({ renderPreview }: ShipyardHostProps) {
  const player = useGame((s) => s.player);

  // Real fleet -> the export's card shape.
  const hulls: ShipyardHull[] = Object.values(SHIP_CLASSES).map((c) => ({
    name: c.name,
    tagline: c.description,
    price: c.price,
    stats: {
      HULL: c.hullMax,
      SHD: c.shieldMax,
      SPD: c.baseSpeed,
      DMG: c.baseDamage,
      DRN: c.droneSlots,
      WPN: c.slots.weapon,
      GEN: c.slots.generator,
      MOD: c.slots.module,
    },
    lore: LORE_BY_NAME.get(c.name) ?? EMPTY_LORE,
  }));

  const idOf = (hull: ShipyardHull): ShipClassId | null => {
    const found = Object.values(SHIP_CLASSES).find((c) => c.name === hull.name);
    return (found?.id as ShipClassId) ?? null;
  };

  return (
    <Shipyard
      hulls={hulls}
      statCaps={computeCaps(hulls)}
      ownedShips={player.ownedShips ?? []}
      credits={player.credits}
      currentShip={player.shipClass}
      // The export ships an empty <image-slot id="shipyard-hero-N">. This
      // project has real GLB hulls, so the live preview goes in — reusing the
      // hangar's shared-renderer ShipPreview rather than opening another WebGL
      // context per card. 250x250 matches the export's turntable box exactly.
      renderShip={(hull) => {
        const id = idOf(hull);
        if (!id || !renderPreview) return null;
        return renderPreview(id, SHIP_CLASSES[id].color, 250);
      }}
      onBoard={(hull) => {
        const id = idOf(hull);
        if (!id) return;
        // Purchase/ownership rules stay in the game, not the panel: switch to a
        // hull the player owns, otherwise leave it to the existing shipyard
        // flow. PORT_NOTES.md §4 flags "not enough credits" / "not unlocked"
        // as product decisions — this deliberately does not invent them.
        const owned = player.ownedShips?.includes(id);
        if (owned) {
          gameState.player.shipClass = id;
          bump();
        }
      }}
      onClose={() => { gameState.hangarTab = null; bump(); }}
    />
  );
}

export default ShipyardHost;
