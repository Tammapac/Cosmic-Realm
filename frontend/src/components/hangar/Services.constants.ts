/**
 * S-08 · Station Services — data, MIGRATED verbatim from the design export:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (const STATION_SVC, svcCards/variantTabs/svcInsurance)
 *
 * Insurance renewal prices are DERIVED, not stored — the export computes them
 * from the ship's price each render:
 *   standard = round(shipPrice * .12)
 *   premium  = round(shipPrice * .06)
 *   mcoins   = round(credits / 14)
 * Those ratios are reproduced in the helpers below so the numbers stay in step
 * with whatever ship price the game supplies.
 */

export interface RepairService {
  /** Current condition, 0-100. */
  pct: number;
  cost: number;
}

export interface AmmoService {
  key: string;
  label: string;
  glyph: string;
  cur: number;
  max: number;
  cost: number;
  /** Selectable ammo grades — the export shows these as a tab row per bank. */
  variants: string[];
}

export interface InsuranceState {
  active: boolean;
  tier: "standard" | "premium";
  shipPrice: number;
  cyclesLeft: number;
}

export interface StationServices {
  credits: number;
  mcoins: number;
  hull: RepairService;
  shield: RepairService;
  drone: RepairService;
  ammo: AmmoService[];
  insurance: InsuranceState;
  respawn: { isHome: boolean; fee: number; time: number };
}

export const STATION_SVC: StationServices = {
  credits: 15420,
  mcoins: 640,
  hull:   { pct: 62, cost: 1240 },
  shield: { pct: 40, cost: 860 },
  drone:  { pct: 78, cost: 340 },
  ammo: [
    { key: "laser",   label: "LASER AMMO", glyph: "⚔", cur: 412, max: 750, cost: 620, variants: ["x1", "x2", "x3", "x4"] },
    { key: "rockets", label: "ROCKETS",    glyph: "▲", cur: 16,  max: 20,  cost: 210, variants: ["DL-1", "DL-2", "BM-3", "D-ROCK"] },
  ],
  insurance: { active: true, tier: "premium", shipPrice: 42000, cyclesLeft: 2 },
  respawn: { isHome: true, fee: 120, time: 8 },
};

/** Repair cards, in the export's own order. */
export const SERVICE_CARDS: { key: "hull" | "shield" | "drone"; label: string; glyph: string; hex: string }[] = [
  { key: "hull",   label: "HULL REPAIR",     glyph: "⬢", hex: "#ff8a3d" },
  { key: "shield", label: "SHIELD RECHARGE", glyph: "◈", hex: "#4ee2ff" },
  { key: "drone",  label: "DRONE REPAIR",    glyph: "⌬", hex: "#5cff8a" },
];

/** Insurance renewal cost, derived from the ship price (export's own ratios). */
export const renewCredits = (shipPrice: number, tier: "standard" | "premium") =>
  Math.round(shipPrice * (tier === "premium" ? 0.06 : 0.12));

/** MCoin equivalent of a credit price — the export's fixed 14:1 conversion. */
export const toMcoins = (credits: number) => Math.round(credits / 14);

/** Auto-service toggles, persisted in component state only in the export. */
export const AUTO_TOGGLES: { key: string; label: string; sub: string }[] = [
  { key: "autoRepair", label: "AUTO REPAIR",  sub: "Repair hull on dock" },
  { key: "autoShield", label: "AUTO SHIELD",  sub: "Recharge on dock" },
  { key: "autoAmmo",   label: "AUTO RESUPPLY", sub: "Refill ammo on dock" },
];

export const SERVICES_PANEL_W = 1340;
