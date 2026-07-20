/**
 * Isolated debug scene for the LaserSystem — black background, runs on the
 * one existing PIXI Application (no extra renderer/canvas/DOM), with its
 * own LaserSystem instance and private layers so the game world stays
 * untouched.
 *
 * Toggle:  Ctrl+Alt+L  or  window.__laserDebug()  from the console.
 * Stages (keys):
 *   1 core only          2 glow only        3 trail only
 *   4 core + glow        5 full projectile  6 muzzle flash
 *   7 hit effect
 * P cycles presets, R spawns the red 100x30 debug projectile (and logs the
 * full render diagnostics), Esc closes.
 *
 * Live-world probe (game running, no overlay): window.__laserProbe() adds
 * a solid red 100x30 sprite to the real projectileLayer at the camera
 * position and logs parent/renderer/position/rotation/visible/renderable/
 * alpha/worldTransform/camera/zIndex — for verifying visibility before any
 * visual polish.
 */
import * as PIXI from "pixi.js";
import { LaserSystem, type LaserPreset } from "./laser-system";
import { state } from "./store";

const PRESET_ORDER: LaserPreset[] = ["lightLaser", "heavyLaser", "plasmaBolt", "enemyLaser"];
const STAGE_NAMES = [
  "core only", "glow only", "trail only", "core + glow", "full projectile", "muzzle flash", "hit effect",
] as const;

function redTex(): PIXI.Texture {
  const c = document.createElement("canvas");
  c.width = 100; c.height = 30;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, 100, 30);
  return PIXI.Texture.from(c);
}

function logDiagnostics(tag: string, spr: PIXI.Container, app: PIXI.Application): void {
  spr.updateTransform();
  console.log(`[laser-debug] ${tag}`, {
    parent: spr.parent ? spr.parent.constructor.name : null,
    parentChildren: spr.parent ? spr.parent.children.length : 0,
    renderer: `${app.renderer.constructor.name} ${app.renderer.width}x${app.renderer.height} res=${app.renderer.resolution}`,
    position: { x: spr.x, y: spr.y },
    rotation: spr.rotation,
    visible: spr.visible,
    renderable: spr.renderable,
    alpha: spr.alpha,
    worldTransform: spr.worldTransform.toString(),
    camera: { x: state.player.pos.x, y: state.player.pos.y, zoom: state.cameraZoom },
    zIndex: spr.zIndex,
  });
}

interface DebugState {
  overlay: PIXI.Container;
  bg: PIXI.Graphics;
  info: PIXI.Text;
  system: LaserSystem;
  stage: number;         // 0-6 = the 7 stages
  preset: LaserPreset;
  x: number; y: number;  // simulated projectile position
  vx: number; vy: number;
  fireTimer: number;
  shotCount: number;
  redSprite: PIXI.Sprite | null;
  tick: () => void;
}

let dbg: DebugState | null = null;
let appRef: PIXI.Application | null = null;
let projLayerRef: PIXI.Container | null = null;
let keysBound = false;

const SHOT_ID = "debug-shot";
const SPEED = 620; // px/s across the overlay

function applyStage(): void {
  if (!dbg) return;
  // Stages 1-5 map onto the part mask; 6/7 fire one-shot effects in tick.
  const masks: Record<number, { core: boolean; glow: boolean; trail: boolean; tip: boolean } | null> = {
    0: { core: true, glow: false, trail: false, tip: false },
    1: { core: false, glow: true, trail: false, tip: false },
    2: { core: false, glow: false, trail: true, tip: false },
    3: { core: true, glow: true, trail: false, tip: false },
    4: null, // full projectile
  };
  dbg.system.debugMask = dbg.stage <= 4 ? masks[dbg.stage] ?? null : { core: false, glow: false, trail: false, tip: false };
  dbg.system.refreshMask();
}

function open(): void {
  if (dbg || !appRef) return;
  const app = appRef;

  const overlay = new PIXI.Container();
  const bg = new PIXI.Graphics();
  const projFront = new PIXI.Container();
  const projBehind = new PIXI.Container();
  const trailLayer = new PIXI.Container();
  const fxLayer = new PIXI.Container();
  overlay.addChild(bg, trailLayer, projBehind, projFront, fxLayer);

  const info = new PIXI.Text("", {
    fontFamily: "Consolas, monospace",
    fontSize: 13,
    fill: 0x7ad8ff,
    lineHeight: 19,
  });
  info.position.set(16, 14);
  overlay.addChild(info);

  const system = new LaserSystem(projFront, projBehind, trailLayer, fxLayer);
  system.allowShake = false;

  const tick = () => {
    if (!dbg) return;
    const dt = Math.min(0.1, app.ticker.deltaMS / 1000);
    const w = app.screen.width, h = app.screen.height;

    if (dbg.stage <= 4) {
      // Simulated projectile flying left -> right, wrapping with a fresh
      // shot each pass (new randomization per shot, like real fire).
      if (!dbg.system.has(SHOT_ID)) {
        dbg.x = w * 0.12; dbg.y = h * 0.5;
        dbg.vx = SPEED; dbg.vy = 0;
        dbg.system.ensure(SHOT_ID, dbg.preset, dbg.x, dbg.y, 0);
        dbg.shotCount++;
      }
      dbg.x += dbg.vx * dt;
      dbg.system.move(SHOT_ID, dbg.x, dbg.y, dbg.vx, dbg.vy);
      if (dbg.x > w * 0.88) dbg.system.kill(SHOT_ID);
    } else {
      dbg.system.kill(SHOT_ID);
      // muzzle / hit stages: re-fire the one-shot effect on a timer
      dbg.fireTimer -= dt;
      if (dbg.fireTimer <= 0) {
        dbg.fireTimer = 0.8;
        if (dbg.stage === 5) dbg.system.muzzle(w / 2, h / 2, 0, dbg.preset);
        else dbg.system.hitAt(w / 2, h / 2, 0, dbg.preset);
      }
    }

    dbg.system.update(dt);
    bg.clear();
    bg.beginFill(0x000000, 1);
    bg.drawRect(0, 0, w, h);
    bg.endFill();
    dbg.info.text =
      `LASER DEBUG   preset: ${dbg.preset}   stage ${dbg.stage + 1}/7: ${STAGE_NAMES[dbg.stage]}\n` +
      `1-7 stage   P next preset   R red 100x30 probe + console log   Esc close\n` +
      STAGE_NAMES.map((n, i) => `${i + 1} ${dbg!.stage === i ? "▶" : " "} ${n}`).join("\n");
  };

  dbg = {
    overlay, bg, info, system,
    stage: 4, preset: "lightLaser",
    x: 0, y: 0, vx: SPEED, vy: 0,
    fireTimer: 0, shotCount: 0,
    redSprite: null,
    tick,
  };

  app.stage.addChild(overlay);
  app.ticker.add(tick);
  applyStage();
}

function close(): void {
  if (!dbg || !appRef) return;
  appRef.ticker.remove(dbg.tick);
  appRef.stage.removeChild(dbg.overlay);
  dbg.system.destroy();
  dbg.overlay.destroy({ children: true });
  dbg = null;
}

function spawnRedProbe(): void {
  if (!dbg || !appRef) return;
  if (dbg.redSprite) {
    dbg.redSprite.parent?.removeChild(dbg.redSprite);
    dbg.redSprite.destroy();
  }
  const spr = new PIXI.Sprite(redTex());
  spr.anchor.set(0.5);
  spr.position.set(appRef.screen.width / 2, appRef.screen.height * 0.75);
  dbg.overlay.addChild(spr);
  dbg.redSprite = spr;
  logDiagnostics("red 100x30 probe (debug overlay)", spr, appRef);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.ctrlKey && e.altKey && e.code === "KeyL") {
    e.preventDefault();
    if (dbg) close(); else open();
    return;
  }
  if (!dbg) return;
  if (e.code === "Escape") { close(); return; }
  if (e.code === "KeyP") {
    dbg.preset = PRESET_ORDER[(PRESET_ORDER.indexOf(dbg.preset) + 1) % PRESET_ORDER.length];
    dbg.system.kill(SHOT_ID);
    return;
  }
  if (e.code === "KeyR") { spawnRedProbe(); return; }
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= 7) {
    dbg.stage = num - 1;
    dbg.fireTimer = 0;
    applyStage();
  }
}

/** Wire the debug scene + live-world probe. Cheap until opened. */
export function initLaserDebug(app: PIXI.Application, projectileLayer: PIXI.Container): void {
  appRef = app;
  projLayerRef = projectileLayer;
  if (!keysBound) {
    window.addEventListener("keydown", onKeyDown);
    keysBound = true;
  }
  (window as any).__laserDebug = () => { if (dbg) close(); else open(); };
  // Live-world visibility probe: red 100x30 sprite in the REAL projectile
  // layer at the camera position, plus full render diagnostics.
  (window as any).__laserProbe = () => {
    if (!appRef || !projLayerRef) return;
    const spr = new PIXI.Sprite(redTex());
    spr.anchor.set(0.5);
    spr.position.set(state.player.pos.x, state.player.pos.y);
    projLayerRef.addChild(spr);
    logDiagnostics("red 100x30 probe (world projectileLayer)", spr, appRef);
    setTimeout(() => { spr.parent?.removeChild(spr); spr.destroy(); }, 5000);
  };
}

export function destroyLaserDebug(): void {
  close();
  if (keysBound) {
    window.removeEventListener("keydown", onKeyDown);
    keysBound = false;
  }
  appRef = null;
  projLayerRef = null;
  delete (window as any).__laserDebug;
  delete (window as any).__laserProbe;
}
