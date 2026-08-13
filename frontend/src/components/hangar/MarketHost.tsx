// Wires the migrated S-07 Market panel to real game state.
//
// Same split as ShipyardHost/HangarDockOverlayHost: MarketPanel.tsx stays the
// design export's own implementation, everything project-specific lives here.
import {
  useGame, state as gameState, bump, save, pushNotification,
  cargoUsed, cargoCapacity, stationPrice, priceDirection,
  addCargo, removeCargo, bumpMission,
} from "../../game/store";
import { RESOURCES, STATIONS, ZONES, type ResourceId } from "../../game/types";
import { MarketPanel } from "./MarketPanel";
import { MARKET_ITEMS, type MarketItem, type MarketCategory } from "./Market.constants";
import type { RarityKey } from "./rarity";

/**
 * Map this project's resources onto the export's card shape.
 *
 * The export's MarketItem carries four fields the game has no counterpart for —
 * `base` (a reference price for the P&L readout), `spark` (a 10-cycle history
 * sparkline), `stockMax`, and a rarity band. The game's price model is
 * stationPrice()/priceDirection() over RESOURCES, with no per-station stock and
 * no stored history. Rather than invent numbers, the fields that DO map are
 * taken live and the rest fall back to the export's own values for a resource of
 * the same name, or to neutral values.
 */
const DEMO_BY_NAME = new Map(MARKET_ITEMS.map((m) => [m.name.toLowerCase(), m]));

/**
 * Category + rarity band, derived from basePrice.
 *
 * Resource (game/types.ts) has no category or rarity field — only id, name,
 * basePrice, glyph, color, description. The export's panel groups by category
 * tabs and colours by rarity, so both have to come from somewhere. Price is the
 * one ordering the game already defines, and it tracks how exotic a resource is
 * (scrap 12 … dread core 420), so the bands follow it.
 */
function bandOf(basePrice: number): { cat: MarketCategory; rarity: RarityKey } {
  if (basePrice >= 300) return { cat: "RELIC", rarity: "legendary" };
  if (basePrice >= 120) return { cat: "COMPONENT", rarity: "epic" };
  if (basePrice >= 50) return { cat: "REFINED", rarity: "rare" };
  return { cat: "RAW", rarity: "common" };
}

export function MarketHost({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);

  const items: MarketItem[] = Object.values(RESOURCES).map((r) => {
    const demo = DEMO_BY_NAME.get(r.name.toLowerCase());
    const band = bandOf(r.basePrice);
    const price = stationPrice(stationId, r.id);
    const dir = priceDirection(stationId, r.id);
    const held = player.cargo.find((c) => c.resourceId === r.id)?.qty ?? 0;
    return {
      cat: band.cat,
      rarity: band.rarity,
      name: r.name,
      // Base price is the catalog value; the station price floats around it, so
      // this is exactly the reference the export's P&L wants.
      base: r.basePrice,
      price,
      trend: (dir === "down" ? -1 : 1) as 1 | -1,
      // No per-station stock model exists. Show the bar full rather than
      // fabricating scarcity that would read as a game mechanic.
      stock: demo?.stock ?? 1000,
      stockMax: demo?.stockMax ?? 1000,
      spark: demo?.spark ?? [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
      held,
    };
  });

  // The export's header is the docked station's identity, not a generic title.
  const station = STATIONS.find((s) => s.id === stationId);
  const zone = station ? ZONES[station.zone] : undefined;

  /** Resolve a panel row back to a real ResourceId (rows are built from
   *  RESOURCES in order, but match on name so a reorder cannot desync them). */
  const idOf = (name: string): ResourceId | null =>
    (Object.values(RESOURCES).find((r) => r.name === name)?.id as ResourceId) ?? null;

  // buy / sell / sellAll — the existing MarketTab's rules VERBATIM, including
  // the bumpMission() calls, so trading through this panel advances transport,
  // delivery and earn-credits missions exactly as the old tab does.
  const buy = (item: MarketItem, n: number) => {
    const rid = idOf(item.name);
    if (!rid) return;
    const price = stationPrice(stationId, rid);
    const cost = price * n;
    if (player.credits < cost) { pushNotification("Not enough credits", "bad"); return; }
    if (cargoUsed() + n > cargoCapacity()) { pushNotification("Cargo bay full", "bad"); return; }
    player.credits -= cost;
    addCargo(rid, n);
    pushNotification(`Bought ${n}× ${RESOURCES[rid].name} · -${cost.toLocaleString()}cr`, "good");
    save(); bump();
  };

  const sell = (item: MarketItem, n: number) => {
    const rid = idOf(item.name);
    if (!rid) return;
    const have = player.cargo.find((c) => c.resourceId === rid);
    if (!have) { pushNotification("None in cargo", "bad"); return; }
    const take = Math.min(have.qty, n);
    if (take <= 0) return;
    const price = stationPrice(stationId, rid);
    const earn = price * take;
    removeCargo(rid, take);
    player.credits += earn;
    pushNotification(`Sold ${take}× ${RESOURCES[rid].name} · +${earn.toLocaleString()}cr`, "good");
    bumpMission("transport", take, undefined, { resourceId: rid });
    bumpMission("deliver", take, undefined, { resourceId: rid, stationId });
    bumpMission("earn-credits", earn);
    save(); bump();
  };

  const sellAll = () => {
    let totalEarn = 0;
    for (const c of [...player.cargo]) {
      const price = stationPrice(stationId, c.resourceId);
      totalEarn += price * c.qty;
      removeCargo(c.resourceId, c.qty);
    }
    if (totalEarn > 0) {
      player.credits += totalEarn;
      pushNotification(`Sold all cargo · +${totalEarn.toLocaleString()}cr`, "good");
      bumpMission("transport", 1, undefined, {});
      bumpMission("earn-credits", totalEarn);
      save(); bump();
    } else {
      pushNotification("Nothing to sell", "bad");
    }
  };

  return (
    <MarketPanel
      items={items}
      stationName={(station?.name ?? "TRADE STATION").toUpperCase()}
      stationSector={zone?.label ?? station?.zone ?? "—"}
      cargoUsed={cargoUsed()}
      cargoCap={cargoCapacity()}
      credits={player.credits}
      onBuy={buy}
      onSell={sell}
      onSellAll={sellAll}
      onClose={() => { gameState.hangarTab = null; bump(); }}
    />
  );
}

export default MarketHost;
