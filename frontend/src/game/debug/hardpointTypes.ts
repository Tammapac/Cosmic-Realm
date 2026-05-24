export type HardpointType = "laser" | "rocket" | "thruster" | "engineGlow" | "hit" | "muzzle" | "shield";
export type HardpointLayer = "belowShip" | "shipLevel" | "aboveShip";

export interface Hardpoint {
  id: string;
  type: HardpointType;
  x: number;
  y: number;
  z: number;
  layer: HardpointLayer;
  emitAngleOffset?: number;
}

export interface DirectionData {
  hardpoints: Hardpoint[];
}

export interface ShipHardpointData {
  shipId: string;
  directions: Record<string, DirectionData>;
}

export const HARDPOINT_TYPES: HardpointType[] = ["laser", "rocket", "thruster", "engineGlow", "hit", "muzzle", "shield"];
export const HARDPOINT_LAYERS: HardpointLayer[] = ["belowShip", "shipLevel", "aboveShip"];

export const HARDPOINT_COLORS: Record<HardpointType, number> = {
  laser: 0xff0000,
  rocket: 0xff8800,
  thruster: 0x00ffff,
  engineGlow: 0x4488ff,
  hit: 0xffff00,
  muzzle: 0xffffff,
  shield: 0xaa00ff,
};

export const DIRECTIONS_32 = [
  "000","011","022","034","045","056","068","079",
  "090","101","112","124","135","146","158","169",
  "180","191","202","214","225","236","248","259",
  "270","281","292","304","315","326","338","349"
];

export const DIR_32_COMPASS = ["N","NbE","NNE","NEbN","NE","NEbE","ENE","EbN","E","EbS","ESE","SEbE","SE","SEbS","SSE","SbE","S","SbW","SSW","SWbS","SW","SWbW","WSW","WbS","W","WbN","WNW","NWbW","NW","NWbN","NNW","NbW"];
