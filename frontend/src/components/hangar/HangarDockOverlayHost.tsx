// Wires the migrated S-01 Hangar Dock Overlay to real game state.
//
// Split deliberately: HangarDockOverlay.tsx is the design handoff's own
// implementation and stays untouched; everything project-specific — store
// reads, tab mapping, undock flow — lives here. That keeps a future re-export
// of the design a drop-in replacement for the presentational half.
import { useGame, state as gameState, bump, cargoCapacity, type HangarTab } from "../../game/store";
import { STATIONS, FACTIONS, SHIP_CLASSES, ZONES } from "../../game/types";
import { effectiveStats } from "../../game/loop";
import { requestUndock, forceUndock } from "../../game/scene/DockingController";
import { ENABLE_NEW_DOCKING_FLOW } from "../../game/renderer-config";
import { HangarDockOverlay } from "./HangarDockOverlay";
import { ShipPreview } from "../Hangar";
import type { StatRow } from "./HangarDockOverlay.types";
import { DEFAULT_DOCK_TABS, DEFAULT_SERVICES } from "./HangarDockOverlay.constants";

// The design's 8 dock tabs mapped onto this project's HangarTab union. The
// labels and order are the design's; the values are ours. "SHIPYARD" is our
// "ships" and "SERVICES" is our "repair" — same destination, different name.
const TAB_ORDER: HangarTab[] = [
  "bounties", "missions", "skills", "ships", "loadout", "drones", "market", "repair",
];

// Services map onto the same tabs, so a service row opens the section that
// actually performs it.
const SERVICE_TABS: HangarTab[] = ["repair", "loadout", "market", "market"];

const num = (n: number) => Math.round(n).toLocaleString("en-US");

export function HangarDockOverlayHost() {
  const player = useGame((s) => s.player);
  const dockedAt = useGame((s) => s.dockedAt);
  const hangarTab = useGame((s) => s.hangarTab);

  if (!dockedAt) return null;
  const station = STATIONS.find((s) => s.id === dockedAt);
  if (!station) return null;

  const stats = effectiveStats();
  const cls = SHIP_CLASSES[player.shipClass];
  const zone = ZONES[station.zone];
  const owner = FACTIONS[station.controlledBy];
  const cargoUsed = player.cargo.reduce((a, c) => a + c.qty, 0);
  // cargoCapacity() applies the ut-cargo skill; cls.cargoMax is the base only.
  const cargoMax = cargoCapacity();
  const hullPct = stats.hullMax > 0 ? Math.round((player.hull / stats.hullMax) * 100) : 0;

  // Colour choices follow the design's own stat rows: cyan for navigation,
  // amber for value, green for good, red for danger.
  const stationStats: StatRow[] = [
    { label: "SECTOR", value: zone?.name ?? station.zone, hex: "#4ee2ff", glow: "rgba(78,226,255,.6)" },
    { label: "SYSTEM", value: zone?.label ?? "—", hex: "#4ee2ff", glow: "rgba(78,226,255,.6)" },
    { label: "STATION TYPE", value: station.kind.toUpperCase(), hex: "#e8b94d", glow: "rgba(232,185,77,.6)" },
    { label: "CREDITS", value: num(player.credits), hex: "#e8b94d", glow: "rgba(232,185,77,.6)" },
    { label: "HONOR", value: num(player.honor), hex: "#b866ff", glow: "rgba(184,102,255,.6)" },
    { label: "CARGO HOLD", value: `${num(cargoUsed)} / ${num(cargoMax)}`, hex: "#9fe0ff", glow: "rgba(159,224,255,.6)" },
    { label: "HULL INTEGRITY", value: `${hullPct}%`, hex: hullPct >= 80 ? "#5cff8a" : hullPct >= 40 ? "#e8b94d" : "#ff4d5e", glow: "rgba(92,255,138,.6)" },
    { label: "THREAT", value: (zone?.enemyTier ?? 0) >= 4 ? "HOSTILE" : (zone?.enemyTier ?? 0) >= 2 ? "CONTESTED" : "SECURE", hex: (zone?.enemyTier ?? 0) >= 4 ? "#ff4d5e" : (zone?.enemyTier ?? 0) >= 2 ? "#e8b94d" : "#5cff8a", glow: "rgba(255,77,94,.6)" },
  ];

  const shipStats: StatRow[] = [
    { label: "SHIELD", value: num(stats.shieldMax), hex: "#4ee2ff", glow: "rgba(78,226,255,.6)" },
    { label: "HULL", value: num(stats.hullMax), hex: "#e2f0ff", glow: "rgba(220,240,255,.4)" },
    { label: "DAMAGE", value: `${num(stats.damage)} dps`, hex: "#ff4d5e", glow: "rgba(255,77,94,.6)" },
    { label: "CARGO", value: `${num(cargoMax)} t`, hex: "#9fe0ff", glow: "rgba(159,224,255,.6)" },
    { label: "SPEED", value: `${num(stats.speed)} m/s`, hex: "#5cff8a", glow: "rgba(92,255,138,.6)" },
    { label: "HULL DAMAGE", value: `${Math.max(0, 100 - hullPct)}%`, hex: "#ff8a94", glow: "rgba(255,77,94,.6)" },
    { label: "LEVEL", value: String(player.level), hex: "#e8b94d", glow: "rgba(232,185,77,.6)" },
  ];

  const activeIndex = Math.max(0, TAB_ORDER.indexOf(hangarTab));
  const setTab = (tab: HangarTab) => { gameState.hangarTab = tab; bump(); };

  return (
    <HangarDockOverlay
      stationName={station.name.toUpperCase()}
      stationTag={`DOCKED · ${station.kind.toUpperCase()}`}
      stationCode={zone?.label ?? station.id.toUpperCase()}
      factionIconSrc={`/assets/ui/factions/${owner?.tag?.toLowerCase() ?? "eic"}.png`}
      ownerLabel={owner?.name.toUpperCase() ?? "UNCLAIMED"}
      stationStats={stationStats}
      shipName={player.name.toUpperCase()}
      shipClassLabel={cls.name.toUpperCase()}
      shipStats={shipStats}
      // The design leaves this an empty image slot ("hangar-ship-silhouette",
      // listed under missingAssets in export-manifest.json). This project has
      // real GLB hulls, so the live preview goes in instead — reusing the
      // hangar's shared-renderer ShipPreview rather than adding a second WebGL
      // context.
      //
      // Rendered at the viewport's exact 234x88 (width x height) with
      // view="side": a fixed broadside, no auto-spin. Passing `height` matters
      // — a square canvas here overflowed the 88px box and the hull was drawn
      // in the clipped area. modelFill is a fraction of the frame; with the
      // orthographic side camera it is exact, so 0.85 leaves a real ~7%
      // margin on every hull instead of only on the shallow ones.
      shipViewport={<ShipPreview shipId={player.shipClass} color={cls.color} size={234} height={88} view="side" modelFill={0.85} />}
      onShipLoadout={() => setTab("loadout")}
      services={DEFAULT_SERVICES}
      onServiceSelect={(i) => setTab(SERVICE_TABS[i] ?? "repair")}
      dockTabs={DEFAULT_DOCK_TABS}
      activeDockTab={activeIndex}
      onDockTabSelect={(i) => setTab(TAB_ORDER[i] ?? "bounties")}
      onUndock={() => {
        if (ENABLE_NEW_DOCKING_FLOW) { requestUndock(); return; }
        try { requestUndock(); } catch { forceUndock("overlay undock"); }
      }}
      undockSubtext="All systems nominal"
    />
  );
}

export default HangarDockOverlayHost;
