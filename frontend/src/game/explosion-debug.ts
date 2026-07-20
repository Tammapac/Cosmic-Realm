/**
 * Isolated debug view for the ExplosionSystem.
 *
 * Fullscreen black overlay on top of the existing PIXI Application
 * (no second renderer, no DOM canvas): its own ExplosionSystem instance
 * renders into three private containers inside the overlay, so the world
 * layers and every other game system stay untouched. Camera shake is
 * suppressed in here (system.allowShake = false).
 *
 * Toggle:  Ctrl+Alt+X  or  window.__fxDebug()  from the console.
 * Keys:    1-9, 0  show a single layer in isolation
 *          C    combined (all layers)
 *          H    directional ship-hit impact (angle rotates per spawn)
 *          P    cycle preset (smallHit / enemyExplosion / bossExplosion)
 *          Space or click  re-spawn at pointer / center
 *          Esc  close
 */
import * as PIXI from "pixi.js";
import { ExplosionSystem, EXPLOSION_LAYERS, type ExplosionLayer, type ExplosionPreset } from "./explosion-system";

const PRESET_ORDER: ExplosionPreset[] = ["smallHit", "enemyExplosion", "bossExplosion"];
const RESPAWN_INTERVAL = 1.7; // s — keeps looping so timing can be studied

interface DebugState {
  overlay: PIXI.Container;
  bg: PIXI.Graphics;
  info: PIXI.Text;
  system: ExplosionSystem;
  mode: "combined" | "shipHit" | ExplosionLayer;
  preset: ExplosionPreset;
  respawnTimer: number;
  spawnX: number;
  spawnY: number;
  hitAngle: number;
  tick: () => void;
}

let dbg: DebugState | null = null;
let appRef: PIXI.Application | null = null;
let keysBound = false;

function open(): void {
  if (dbg || !appRef) return;
  const app = appRef;

  const overlay = new PIXI.Container();
  const bg = new PIXI.Graphics();
  const behind = new PIXI.Container();
  const mid = new PIXI.Container();
  const front = new PIXI.Container();
  overlay.addChild(bg, behind, mid, front);

  const info = new PIXI.Text("", {
    fontFamily: "Consolas, monospace",
    fontSize: 13,
    fill: 0x9fc2ff,
    lineHeight: 19,
  });
  info.position.set(16, 14);
  overlay.addChild(info);

  const system = new ExplosionSystem(behind, mid, front);
  system.allowShake = false;

  overlay.eventMode = "static";
  overlay.on("pointerdown", (e: PIXI.FederatedPointerEvent) => {
    if (!dbg) return;
    dbg.spawnX = e.global.x;
    dbg.spawnY = e.global.y;
    dbg.respawnTimer = 0;
  });

  const tick = () => {
    if (!dbg) return;
    const dt = Math.min(0.1, app.ticker.deltaMS / 1000);
    dbg.respawnTimer -= dt;
    if (dbg.respawnTimer <= 0) {
      dbg.respawnTimer = RESPAWN_INTERVAL;
      if (dbg.mode === "combined") {
        dbg.system.spawn(dbg.preset, dbg.spawnX, dbg.spawnY, { shake: false });
      } else if (dbg.mode === "shipHit") {
        dbg.system.spawnShipHit(dbg.spawnX, dbg.spawnY, dbg.hitAngle);
        dbg.hitAngle += Math.PI / 4; // rotate so every direction is shown
      } else {
        dbg.system.spawnLayerOnly(dbg.mode, dbg.preset, dbg.spawnX, dbg.spawnY);
      }
    }
    dbg.system.update(dt);
    redrawBg();
    updateInfo();
  };

  dbg = {
    overlay, bg, info, system,
    mode: "combined",
    preset: "enemyExplosion",
    respawnTimer: 0,
    spawnX: app.screen.width / 2,
    spawnY: app.screen.height / 2,
    hitAngle: 0,
    tick,
  };

  redrawBg();
  app.stage.addChild(overlay); // topmost — covers world + HUD layers
  app.ticker.add(tick);
}

function close(): void {
  if (!dbg || !appRef) return;
  appRef.ticker.remove(dbg.tick);
  appRef.stage.removeChild(dbg.overlay);
  dbg.system.destroy();
  dbg.overlay.destroy({ children: true });
  dbg = null;
}

function redrawBg(): void {
  if (!dbg || !appRef) return;
  const { bg } = dbg;
  bg.clear();
  bg.beginFill(0x000000, 1);
  bg.drawRect(0, 0, appRef.screen.width, appRef.screen.height);
  bg.endFill();
}

function updateInfo(): void {
  if (!dbg) return;
  const layerLines = EXPLOSION_LAYERS
    .map((l, i) => `${(i + 1) % 10} ${dbg!.mode === l ? "▶" : " "} ${l}`)
    .join("\n");
  dbg.info.text =
    `EXPLOSION DEBUG   preset: ${dbg.preset}   active: ${dbg.system.active}\n` +
    `C ${dbg.mode === "combined" ? "▶" : " "} combined     H ${dbg.mode === "shipHit" ? "▶" : " "} ship-hit     P next preset     click/space respawn     Esc close\n\n` +
    layerLines;
}

function onKeyDown(e: KeyboardEvent): void {
  // Toggle works everywhere; other keys only while open.
  if (e.ctrlKey && e.altKey && e.code === "KeyX") {
    e.preventDefault();
    if (dbg) close(); else open();
    return;
  }
  if (!dbg) return;
  if (e.code === "Escape") { close(); return; }
  if (e.code === "KeyC") { dbg.mode = "combined"; dbg.respawnTimer = 0; return; }
  if (e.code === "KeyH") { dbg.mode = "shipHit"; dbg.respawnTimer = 0; return; }
  if (e.code === "KeyP") {
    dbg.preset = PRESET_ORDER[(PRESET_ORDER.indexOf(dbg.preset) + 1) % PRESET_ORDER.length];
    dbg.respawnTimer = 0;
    return;
  }
  if (e.code === "Space") { dbg.respawnTimer = 0; e.preventDefault(); return; }
  // Digits 1-9 select layers 1-9; 0 selects the 10th.
  const num = e.key === "0" ? 10 : parseInt(e.key, 10);
  if (num >= 1 && num <= EXPLOSION_LAYERS.length) {
    dbg.mode = EXPLOSION_LAYERS[num - 1];
    dbg.respawnTimer = 0;
  }
}

/** Wire the debug view to the game's PIXI Application. Cheap: one key
 *  listener + one console hook; nothing is created until opened. */
export function initExplosionDebug(app: PIXI.Application): void {
  appRef = app;
  if (!keysBound) {
    window.addEventListener("keydown", onKeyDown);
    keysBound = true;
  }
  (window as any).__fxDebug = () => { if (dbg) close(); else open(); };
}

/** Tear down listeners + overlay (renderer destroy path). */
export function destroyExplosionDebug(): void {
  close();
  if (keysBound) {
    window.removeEventListener("keydown", onKeyDown);
    keysBound = false;
  }
  appRef = null;
  delete (window as any).__fxDebug;
}
