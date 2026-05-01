import { ShipClassId } from "./types";

export type QualityLevel = "LOW" | "MEDIUM" | "HIGH";
let currentQuality: QualityLevel = "HIGH";
export function setQuality(q: QualityLevel) { currentQuality = q; }
export function getQuality() { return currentQuality; }

export interface EnginePort { x: number; y: number; size: number }
export interface ShipVisualConfig {
  shadow: { offsetX: number; offsetY: number; alpha: number; scaleX: number; scaleY: number };
  rimLight: { color: number; alpha: number; scale: number };
  engines: EnginePort[];
  cockpit: { x: number; y: number; size: number; color: number };
  weaponPoints: { x: number; y: number }[];
  tilt: { skewFactor: number; rotFactor: number; scaleFactor: number };
  hover: { amplitude: number; speed: number };
  parallax: number;
}

const defaults: ShipVisualConfig = {
  shadow: { offsetX: 4, offsetY: 5, alpha: 0.38, scaleX: 1.05, scaleY: 0.95 },
  rimLight: { color: 0x4ee2ff, alpha: 0.22, scale: 1.04 },
  engines: [{ x: 0, y: 18, size: 1 }],
  cockpit: { x: 0, y: -8, size: 0.7, color: 0x88ccff },
  weaponPoints: [{ x: -12, y: -4 }, { x: 12, y: -4 }],
  tilt: { skewFactor: 0.0015, rotFactor: 0.0008, scaleFactor: 0.0002 },
  hover: { amplitude: 1.5, speed: 1.8 },
  parallax: 1.0,
};

const CONFIGS: Record<ShipClassId, Partial<ShipVisualConfig>> = {
  skimmer: {
    rimLight: { color: 0x7ad8ff, alpha: 0.20, scale: 1.04 },
    engines: [{ x: -5, y: 14, size: 0.6 }, { x: 5, y: 14, size: 0.6 }],
    cockpit: { x: 0, y: -6, size: 0.5, color: 0x7ad8ff },
    weaponPoints: [{ x: -8, y: -5 }, { x: 8, y: -5 }],
  },
  wasp: {
    rimLight: { color: 0xffe25c, alpha: 0.22, scale: 1.04 },
    engines: [{ x: -4, y: 12, size: 0.7 }, { x: 4, y: 12, size: 0.7 }],
    cockpit: { x: 0, y: -7, size: 0.5, color: 0xffe25c },
    weaponPoints: [{ x: -7, y: -6 }, { x: 7, y: -6 }],
    tilt: { skewFactor: 0.002, rotFactor: 0.001, scaleFactor: 0.00025 },
  },
  vanguard: {
    rimLight: { color: 0x5cff8a, alpha: 0.18, scale: 1.035 },
    engines: [{ x: -7, y: 16, size: 0.8 }, { x: 7, y: 16, size: 0.8 }],
    cockpit: { x: 0, y: -8, size: 0.6, color: 0x5cff8a },
    weaponPoints: [{ x: -10, y: -6 }, { x: 10, y: -6 }],
  },
  reaver: {
    rimLight: { color: 0xff8a4e, alpha: 0.22, scale: 1.04 },
    engines: [{ x: -8, y: 14, size: 0.8 }, { x: 8, y: 14, size: 0.8 }],
    cockpit: { x: 0, y: -6, size: 0.6, color: 0x44ff88 },
    weaponPoints: [{ x: -12, y: -3 }, { x: 12, y: -3 }, { x: -6, y: -8 }, { x: 6, y: -8 }],
  },
  obsidian: {
    rimLight: { color: 0x4ee2ff, alpha: 0.20, scale: 1.035 },
    engines: [{ x: -6, y: 14, size: 0.8 }, { x: 6, y: 14, size: 0.8 }],
    cockpit: { x: 0, y: -7, size: 0.6, color: 0x4ee2ff },
    weaponPoints: [{ x: -10, y: -4 }, { x: 10, y: -4 }],
  },
  marauder: {
    rimLight: { color: 0xaaff5c, alpha: 0.18, scale: 1.035 },
    engines: [{ x: -10, y: 18, size: 0.9 }, { x: 10, y: 18, size: 0.9 }],
    cockpit: { x: 0, y: -8, size: 0.7, color: 0xaaff5c },
    weaponPoints: [{ x: -14, y: -4 }, { x: 14, y: -4 }],
  },
  phalanx: {
    rimLight: { color: 0xff4466, alpha: 0.22, scale: 1.04 },
    engines: [{ x: -12, y: 20, size: 1.0 }, { x: 12, y: 20, size: 1.0 }, { x: 0, y: 22, size: 0.7 }],
    cockpit: { x: 0, y: -10, size: 0.7, color: 0xff4466 },
    weaponPoints: [{ x: -16, y: -5 }, { x: 16, y: -5 }, { x: -8, y: -8 }, { x: 8, y: -8 }],
  },
  titan: {
    shadow: { offsetX: 4, offsetY: 5, alpha: 0.30, scaleX: 1.05, scaleY: 0.95 },
    rimLight: { color: 0x4ee2ff, alpha: 0.20, scale: 1.03 },
    engines: [{ x: -14, y: 22, size: 1.1 }, { x: 14, y: 22, size: 1.1 }, { x: -6, y: 24, size: 0.8 }, { x: 6, y: 24, size: 0.8 }],
    cockpit: { x: 0, y: -10, size: 0.8, color: 0x4ee2ff },
    weaponPoints: [{ x: -18, y: -4 }, { x: 18, y: -4 }, { x: -10, y: -8 }, { x: 10, y: -8 }],
    tilt: { skewFactor: 0.001, rotFactor: 0.0006, scaleFactor: 0.00015 },
  },
  leviathan: {
    shadow: { offsetX: 5, offsetY: 6, alpha: 0.32, scaleX: 1.05, scaleY: 0.94 },
    rimLight: { color: 0xff5c6c, alpha: 0.20, scale: 1.03 },
    engines: [{ x: -16, y: 24, size: 1.2 }, { x: 16, y: 24, size: 1.2 }, { x: -8, y: 26, size: 0.9 }, { x: 8, y: 26, size: 0.9 }],
    cockpit: { x: 0, y: -12, size: 0.9, color: 0x88ccff },
    weaponPoints: [{ x: -20, y: -5 }, { x: 20, y: -5 }, { x: -12, y: -10 }, { x: 12, y: -10 }],
    tilt: { skewFactor: 0.0008, rotFactor: 0.0005, scaleFactor: 0.00012 },
  },
  specter: {
    rimLight: { color: 0xb06cff, alpha: 0.24, scale: 1.04 },
    engines: [{ x: -10, y: 18, size: 1.0 }, { x: 10, y: 18, size: 1.0 }, { x: 0, y: 16, size: 0.6 }],
    cockpit: { x: 0, y: -10, size: 0.7, color: 0xb06cff },
    weaponPoints: [{ x: -14, y: -6 }, { x: 14, y: -6 }, { x: -20, y: -2 }, { x: 20, y: -2 }],
  },
  colossus: {
    shadow: { offsetX: 5, offsetY: 7, alpha: 0.30, scaleX: 1.06, scaleY: 0.94 },
    rimLight: { color: 0xffe25c, alpha: 0.22, scale: 1.03 },
    engines: [{ x: -18, y: 28, size: 1.3 }, { x: 18, y: 28, size: 1.3 }, { x: -8, y: 30, size: 1.0 }, { x: 8, y: 30, size: 1.0 }],
    cockpit: { x: 0, y: -14, size: 1.0, color: 0x44ffaa },
    weaponPoints: [{ x: -22, y: -6 }, { x: 22, y: -6 }, { x: -14, y: -12 }, { x: 14, y: -12 }],
    tilt: { skewFactor: 0.0006, rotFactor: 0.0004, scaleFactor: 0.0001 },
  },
  harbinger: {
    shadow: { offsetX: 5, offsetY: 6, alpha: 0.28, scaleX: 1.05, scaleY: 0.95 },
    rimLight: { color: 0x44ffaa, alpha: 0.22, scale: 1.035 },
    engines: [{ x: -14, y: 26, size: 1.2 }, { x: 14, y: 26, size: 1.2 }, { x: -6, y: 28, size: 0.9 }, { x: 6, y: 28, size: 0.9 }],
    cockpit: { x: 0, y: -12, size: 0.9, color: 0x44ffaa },
    weaponPoints: [{ x: -20, y: -8 }, { x: 20, y: -8 }, { x: -12, y: -14 }, { x: 12, y: -14 }],
    tilt: { skewFactor: 0.0008, rotFactor: 0.0005, scaleFactor: 0.00012 },
  },
  eclipse: {
    shadow: { offsetX: 6, offsetY: 7, alpha: 0.32, scaleX: 1.06, scaleY: 0.93 },
    rimLight: { color: 0xff8800, alpha: 0.22, scale: 1.03 },
    engines: [{ x: -20, y: 30, size: 1.4 }, { x: 20, y: 30, size: 1.4 }, { x: -10, y: 32, size: 1.0 }, { x: 10, y: 32, size: 1.0 }],
    cockpit: { x: 0, y: -14, size: 1.0, color: 0xff8800 },
    weaponPoints: [{ x: -24, y: -6 }, { x: 24, y: -6 }, { x: -16, y: -12 }, { x: 16, y: -12 }],
    tilt: { skewFactor: 0.0005, rotFactor: 0.0003, scaleFactor: 0.00008 },
  },
  sovereign: {
    shadow: { offsetX: 6, offsetY: 8, alpha: 0.35, scaleX: 1.06, scaleY: 0.93 },
    rimLight: { color: 0xcc88ff, alpha: 0.24, scale: 1.03 },
    engines: [
      { x: -22, y: 34, size: 1.5 }, { x: 22, y: 34, size: 1.5 },
      { x: -10, y: 36, size: 1.1 }, { x: 10, y: 36, size: 1.1 },
      { x: 0, y: 38, size: 0.8 },
    ],
    cockpit: { x: 0, y: -16, size: 1.1, color: 0x44ffaa },
    weaponPoints: [{ x: -26, y: -6 }, { x: 26, y: -6 }, { x: -16, y: -14 }, { x: 16, y: -14 }],
    tilt: { skewFactor: 0.0004, rotFactor: 0.0003, scaleFactor: 0.00006 },
  },
  apex: {
    shadow: { offsetX: 7, offsetY: 9, alpha: 0.35, scaleX: 1.07, scaleY: 0.92 },
    rimLight: { color: 0xffffff, alpha: 0.20, scale: 1.03 },
    engines: [
      { x: -26, y: 38, size: 1.6 }, { x: 26, y: 38, size: 1.6 },
      { x: -14, y: 40, size: 1.2 }, { x: 14, y: 40, size: 1.2 },
      { x: -4, y: 42, size: 0.9 }, { x: 4, y: 42, size: 0.9 },
    ],
    cockpit: { x: 0, y: -18, size: 1.2, color: 0x88ccff },
    weaponPoints: [{ x: -30, y: -8 }, { x: 30, y: -8 }, { x: -18, y: -16 }, { x: 18, y: -16 }],
    tilt: { skewFactor: 0.0003, rotFactor: 0.0002, scaleFactor: 0.00005 },
  },
};

export function getShipVisualConfig(shipClass: ShipClassId): ShipVisualConfig {
  const overrides = CONFIGS[shipClass] || {};
  return {
    shadow: { ...defaults.shadow, ...overrides.shadow },
    rimLight: { ...defaults.rimLight, ...overrides.rimLight },
    engines: overrides.engines || defaults.engines,
    cockpit: { ...defaults.cockpit, ...overrides.cockpit },
    weaponPoints: overrides.weaponPoints || defaults.weaponPoints,
    tilt: { ...defaults.tilt, ...overrides.tilt },
    hover: { ...defaults.hover, ...overrides.hover },
    parallax: overrides.parallax ?? defaults.parallax,
  };
}
