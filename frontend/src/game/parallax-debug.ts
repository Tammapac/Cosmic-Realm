/**
 * Isolated parallax test map — black background, own ParallaxBackground
 * instance with a synthetic auto-panning camera, on the one existing PIXI
 * Application. The game world stays untouched.
 *
 * Toggle:  Ctrl+Alt+M  or  window.__parallaxDebug()
 * Keys:    1 far space only     2 mid space only    3 atmosphere only
 *          4 world decoration   5 foreground only   C all layers
 *          P next zone          Space pause camera  Esc close
 * Stats:   parallax factors, sprite count, FPS, loaded textures,
 *          culled objects, camera position, zoom.
 */
import * as PIXI from "pixi.js";
import { ParallaxBackground, PARALLAX, type ParallaxLayerId } from "./parallax-background";
import { MAP_RADIUS } from "./types";

const ZONE_ORDER = [
  "1-1","1-2","1-3","1-4","1-5",
  "2-1","2-2","2-3","2-4","2-5",
  "3-1","3-2","3-3","3-4","3-5",
  "4-1","4-2","4-3","4-4","4-5",
];
const LAYER_KEYS: Record<string, ParallaxLayerId> = { "1": "far", "2": "mid", "3": "atmo", "4": "world", "5": "fg" };
const LAYER_LABELS: Record<ParallaxLayerId, string> = {
  far: `far space (${PARALLAX.far})`,
  mid: `mid space (${PARALLAX.starfield} / planets ${PARALLAX.planetMin}-${PARALLAX.planetMax})`,
  atmo: `atmosphere (${PARALLAX.atmosphere})`,
  world: `world decoration (${PARALLAX.world})`,
  fg: `foreground (${PARALLAX.foreground})`,
};

interface DbgState {
  overlay: PIXI.Container;
  bg: PIXI.Graphics;
  info: PIXI.Text;
  px: ParallaxBackground;
  zoneIdx: number;
  camAngle: number;
  paused: boolean;
  fps: number; frames: number; lastFpsAt: number;
  tick: () => void;
}

let dbg: DbgState | null = null;
let appRef: PIXI.Application | null = null;
let keysBound = false;

function open(): void {
  if (dbg || !appRef) return;
  const app = appRef;
  const overlay = new PIXI.Container();
  const bg = new PIXI.Graphics();
  overlay.addChild(bg);

  const px = new ParallaxBackground();
  overlay.addChild(px.host);
  overlay.addChild(px.worldDecor);
  overlay.addChild(px.foreground);

  const info = new PIXI.Text("", {
    fontFamily: "Consolas, monospace", fontSize: 13, fill: 0xffd9a0, lineHeight: 19,
  });
  info.position.set(16, 14);
  overlay.addChild(info);

  const tick = () => {
    if (!dbg) return;
    const dt = Math.min(0.1, app.ticker.deltaMS / 1000);
    const w = app.screen.width, h = app.screen.height;
    // synthetic camera: slow ellipse across the world + gentle zoom breathing
    if (!dbg.paused) dbg.camAngle += dt * 0.12;
    const cam = {
      x: Math.cos(dbg.camAngle) * MAP_RADIUS * 0.7,
      y: Math.sin(dbg.camAngle * 0.8) * MAP_RADIUS * 0.7,
    };
    const zoom = 1 + 0.12 * Math.sin(dbg.camAngle * 1.7);
    dbg.px.update(w, h, cam, zoom, performance.now() / 1000);

    bg.clear(); bg.beginFill(0x000000, 1); bg.drawRect(0, 0, w, h); bg.endFill();

    dbg.frames++;
    const now = performance.now();
    if (now - dbg.lastFpsAt > 500) {
      dbg.fps = Math.round(dbg.frames * 1000 / (now - dbg.lastFpsAt));
      dbg.frames = 0; dbg.lastFpsAt = now;
    }
    const m = dbg.px.mask;
    const mode = m ? [...m].map((l) => LAYER_LABELS[l]).join(" + ") : "all layers";
    dbg.info.text =
      `PARALLAX TEST   zone: ${dbg.px.activeZone}   mode: ${mode}\n` +
      `1-5 solo layer   C combined   P next zone   Space ${dbg.paused ? "resume" : "pause"} camera   Esc close\n\n` +
      Object.values(LAYER_LABELS).map((l, i) => `${i + 1}  ${l}`).join("\n") + "\n\n" +
      `fps ${dbg.fps}   sprites ${dbg.px.stats.sprites}   culled ${dbg.px.stats.culled}   zone-textures ${dbg.px.stats.textures}\n` +
      `cam ${Math.round(cam.x)}, ${Math.round(cam.y)}   zoom ${zoom.toFixed(2)}`;
  };

  dbg = {
    overlay, bg, info, px,
    zoneIdx: 0, camAngle: 0, paused: false,
    fps: 0, frames: 0, lastFpsAt: performance.now(),
    tick,
  };
  px.loadZone(ZONE_ORDER[0]);
  app.stage.addChild(overlay);
  app.ticker.add(tick);
}

function close(): void {
  if (!dbg || !appRef) return;
  appRef.ticker.remove(dbg.tick);
  appRef.stage.removeChild(dbg.overlay);
  dbg.px.destroy();
  dbg.overlay.destroy({ children: true });
  dbg = null;
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.ctrlKey && e.altKey && e.code === "KeyM") {
    e.preventDefault();
    if (dbg) close(); else open();
    return;
  }
  if (!dbg) return;
  if (e.code === "Escape") { close(); return; }
  if (e.code === "KeyC") { dbg.px.mask = null; return; }
  if (e.code === "KeyP") {
    dbg.zoneIdx = (dbg.zoneIdx + 1) % ZONE_ORDER.length;
    dbg.px.loadZone(ZONE_ORDER[dbg.zoneIdx]);
    return;
  }
  if (e.code === "Space") { dbg.paused = !dbg.paused; e.preventDefault(); return; }
  const layer = LAYER_KEYS[e.key];
  if (layer) dbg.px.mask = new Set([layer]);
}

export function initParallaxDebug(app: PIXI.Application): void {
  appRef = app;
  if (!keysBound) {
    window.addEventListener("keydown", onKeyDown);
    keysBound = true;
  }
  (window as any).__parallaxDebug = () => { if (dbg) close(); else open(); };
}

export function destroyParallaxDebug(): void {
  close();
  if (keysBound) {
    window.removeEventListener("keydown", onKeyDown);
    keysBound = false;
  }
  appRef = null;
  delete (window as any).__parallaxDebug;
}
