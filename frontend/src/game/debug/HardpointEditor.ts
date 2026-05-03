import * as PIXI from "pixi.js";
import {
  Hardpoint,
  HardpointType,
  HardpointLayer,
  ShipHardpointData,
  DirectionData,
  HARDPOINT_TYPES,
  HARDPOINT_LAYERS,
  HARDPOINT_COLORS,
  DIRECTIONS_32,
  DIR_32_COMPASS,
} from "./hardpointTypes";

const ENABLE_HARDPOINT_EDITOR = true;

const ALL_SHIPS = [
  "skimmer", "wasp", "vanguard", "reaver", "obsidian",
  "marauder", "phalanx", "titan", "leviathan", "specter",
  "colossus", "harbinger", "eclipse", "sovereign", "apex",
];

/* --- state --- */
let app: PIXI.Application | null = null;
let container: PIXI.Container | null = null;
let shipId = "skimmer";
let shipIndex = 0;
let dirIndex = 0;
let selectedIndex = 0;
let data: ShipHardpointData | null = null;
let active = false;
let showHelp = false;
let showGrid = true;
let showLabels = true;
let shipSprite: PIXI.Sprite | null = null;
let pulsePhase = 0;
let animFrame = 0;
let zoom = 2.0;
let gameUIHidden = false;
let domBlocker: HTMLDivElement | null = null;

/* --- helpers --- */
function storageKey(): string {
  return `hardpoint-editor:${shipId}`;
}

function save(): void {
  if (!data) return;
  localStorage.setItem(storageKey(), JSON.stringify(data));
}

function load(): ShipHardpointData {
  const raw = localStorage.getItem(storageKey());
  if (raw) {
    try {
      return JSON.parse(raw) as ShipHardpointData;
    } catch { /* fall through */ }
  }
  const dirs: Record<string, DirectionData> = {};
  for (const d of DIRECTIONS_32) {
    dirs[d] = { hardpoints: [] };
  }
  return { shipId, directions: dirs };
}

function currentDir(): string {
  return DIRECTIONS_32[dirIndex];
}

function currentHardpoints(): Hardpoint[] {
  if (!data) return [];
  const dir = data.directions[currentDir()];
  if (!dir) {
    data.directions[currentDir()] = { hardpoints: [] };
  }
  return data.directions[currentDir()].hardpoints;
}

function clampSelection(): void {
  const hp = currentHardpoints();
  if (hp.length === 0) { selectedIndex = 0; return; }
  if (selectedIndex >= hp.length) selectedIndex = hp.length - 1;
  if (selectedIndex < 0) selectedIndex = 0;
}

function spritePathForDir(idx: number): string {
  const num = String(idx + 1).padStart(2, "0");
  const compass = DIR_32_COMPASS[idx];
  return `/ships/${shipId}/ship_${num}_${compass}.png`;
}

function switchShip(newIndex: number): void {
  save();
  shipIndex = ((newIndex % ALL_SHIPS.length) + ALL_SHIPS.length) % ALL_SHIPS.length;
  shipId = ALL_SHIPS[shipIndex];
  data = load();
  dirIndex = 0;
  selectedIndex = 0;
  clampSelection();
}

function toggleGameUI(): void {
  gameUIHidden = !gameUIHidden;
  const uiElements = document.querySelectorAll(
    "[class*=\"topbar\"], [class*=\"TopBar\"], [class*=\"hotbar\"], [class*=\"Hotbar\"], " +
    "[class*=\"minimap\"], [class*=\"MiniMap\"], [class*=\"quest\"], [class*=\"Quest\"], " +
    "[class*=\"panel\"], [class*=\"Panel\"], [class*=\"hud\"], [class*=\"HUD\"]"
  );
  uiElements.forEach((el) => {
    (el as HTMLElement).style.display = gameUIHidden ? "none" : "";
  });
}

/* --- rendering --- */
function render(): void {
  if (!container || !app) return;
  container.removeChildren();

  const w = app.screen.width;
  const h = app.screen.height;
  const cx = w / 2;
  const cy = h / 2;

  // Background dim (more opaque so ship underneath doesnt distract)
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.92);
  bg.drawRect(0, 0, w, h);
  bg.endFill();
  container.addChild(bg);

  // Grid (scaled with zoom)
  if (showGrid) {
    const grid = new PIXI.Graphics();
    grid.lineStyle(1, 0x333333, 0.4);
    const step = 20 * zoom;
    for (let x = cx % step; x < w; x += step) {
      grid.moveTo(x, 0); grid.lineTo(x, h);
    }
    for (let y = cy % step; y < h; y += step) {
      grid.moveTo(0, y); grid.lineTo(w, y);
    }
    container.addChild(grid);
  }

  // Ship sprite (zoomed)
  const spritePath = spritePathForDir(dirIndex);
  const tex = PIXI.Texture.from(spritePath);
  if (shipSprite) shipSprite.destroy();
  shipSprite = new PIXI.Sprite(tex);
  shipSprite.anchor.set(0.5);
  shipSprite.position.set(cx, cy);
  shipSprite.scale.set(zoom);
  container.addChild(shipSprite);

  // Crosshair
  const cross = new PIXI.Graphics();
  cross.lineStyle(1, 0x00ff00, 0.4);
  cross.moveTo(cx - 40, cy); cross.lineTo(cx + 40, cy);
  cross.moveTo(cx, cy - 40); cross.lineTo(cx, cy + 40);
  container.addChild(cross);

  // Hardpoints
  const hps = currentHardpoints();
  hps.forEach((hp, i) => {
    const sx = cx + hp.x * zoom;
    const sy = cy + (hp.y - hp.z) * zoom;
    const color = HARDPOINT_COLORS[hp.type] ?? 0xffffff;
    const isSelected = i === selectedIndex;
    const dot = new PIXI.Graphics();

    if (isSelected) {
      const pulse = 5 + Math.sin(pulsePhase) * 2;
      dot.lineStyle(2, 0xffffff, 0.9);
      dot.drawCircle(sx, sy, pulse + 4);
    }

    dot.beginFill(color);
    dot.drawCircle(sx, sy, isSelected ? 7 : 5);
    dot.endFill();
    container.addChild(dot);

    // Labels
    if (showLabels) {
      const label = new PIXI.Text(
        `${hp.id}\n${hp.type} [${hp.layer}]\nx:${hp.x} y:${hp.y} z:${hp.z}`,
        {
          fontFamily: "monospace",
          fontSize: 10,
          fill: isSelected ? 0x00ff00 : 0xcccccc,
          align: "left",
        }
      );
      label.position.set(sx + 12, sy - 14);
      container.addChild(label);
    }
  });

  // Info panel (bottom-left, away from game UI)
  const compass = DIR_32_COMPASS[dirIndex];
  const deg = DIRECTIONS_32[dirIndex];
  let infoStr = `Ship: ${shipId} [${shipIndex + 1}/${ALL_SHIPS.length}]  (PgUp/PgDn to switch)\n`;
  infoStr += `Direction: ${deg} (${compass}) [${dirIndex + 1}/32]\n`;
  infoStr += `Zoom: ${zoom.toFixed(1)}x  (+/- to adjust)\n`;
  infoStr += `Hardpoints: ${hps.length}\n`;
  if (hps.length > 0 && hps[selectedIndex]) {
    const sel = hps[selectedIndex];
    infoStr += `\nSelected [${selectedIndex + 1}/${hps.length}]:\n`;
    infoStr += `  id: ${sel.id}\n  type: ${sel.type}\n  layer: ${sel.layer}\n`;
    infoStr += `  x: ${sel.x}  y: ${sel.y}  z: ${sel.z}`;
    if (sel.emitAngleOffset !== undefined) infoStr += `\n  emitAngle: ${sel.emitAngleOffset}`;
  }
  const infoText = new PIXI.Text(infoStr, {
    fontFamily: "monospace",
    fontSize: 14,
    fill: 0x00ff00,
    align: "left",
  });
  infoText.position.set(10, h - 240);
  container.addChild(infoText);

  // Help panel (bottom-right)
  if (showHelp) {
    const helpStr = [
      "=== HARDPOINT EDITOR ===",
      "",
      "F9          Toggle editor",
      "PgUp/PgDn   Switch ship",
      "Left/Right  Prev/next direction",
      "Shift+L/R   Jump 4 directions",
      "Tab/S-Tab   Select hardpoint",
      "1-9         Select by index",
      "",
      "W/A/S/D     Move (Shift=5, Alt=0.25)",
      "Q/E         Z axis",
      "+/-         Zoom in/out",
      "T / Shift+T Cycle type",
      "L           Cycle layer",
      "R           Rename",
      "",
      "Insert/S-A  Add hardpoint",
      "Del/Bksp    Delete selected",
      "M / Shift+M Mirror x",
      "N / P       Copy to next/prev dir",
      "C           Export JSON",
      "V           Import JSON",
      "U           Toggle game UI",
      "G/O/H       Grid/Labels/Help",
    ].join("\n");
    const helpText = new PIXI.Text(helpStr, {
      fontFamily: "monospace",
      fontSize: 15,
      fill: 0xffffff,
      align: "left",
    });
    helpText.position.set(w - 380, h - 500);
    container.addChild(helpText);
  }
}

/* --- animation loop --- */
function tick(): void {
  if (!active) return;
  pulsePhase += 0.08;
  render();
  animFrame = requestAnimationFrame(tick);
}

/* --- keyboard handler --- */
function getStep(e: KeyboardEvent): number {
  if (e.shiftKey) return 5;
  if (e.altKey) return 0.25;
  return 1;
}

function onKeyDown(e: KeyboardEvent): void {
  if (!active && e.key !== "F9") return;

  if (e.key === "F9") {
    toggleHardpointEditor();
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (!active) return;
  e.preventDefault();
  e.stopPropagation();

  const hps = currentHardpoints();
  const step = getStep(e);

  switch (e.key) {
    case "ArrowLeft":
      if (e.shiftKey) dirIndex = (dirIndex - 4 + 32) % 32;
      else dirIndex = (dirIndex - 1 + 32) % 32;
      clampSelection();
      break;
    case "ArrowRight":
      if (e.shiftKey) dirIndex = (dirIndex + 4) % 32;
      else dirIndex = (dirIndex + 1) % 32;
      clampSelection();
      break;
    case "PageUp":
      switchShip(shipIndex - 1);
      break;
    case "PageDown":
      switchShip(shipIndex + 1);
      break;
    case "Tab":
      if (hps.length > 0) {
        if (e.shiftKey) selectedIndex = (selectedIndex - 1 + hps.length) % hps.length;
        else selectedIndex = (selectedIndex + 1) % hps.length;
      }
      break;
    case "1": case "2": case "3": case "4": case "5":
    case "6": case "7": case "8": case "9": {
      const idx = parseInt(e.key) - 1;
      if (idx < hps.length) selectedIndex = idx;
      break;
    }
    case "+":
    case "=":
      zoom = Math.min(8, zoom + 0.5);
      break;
    case "-":
    case "_":
      zoom = Math.max(0.5, zoom - 0.5);
      break;
    case "Insert":
      addHardpoint();
      break;
    case "A":
      if (e.shiftKey) addHardpoint();
      break;
    case "Delete":
    case "Backspace":
      if (hps.length > 0) {
        hps.splice(selectedIndex, 1);
        clampSelection();
        save();
      }
      break;
    case "w":
    case "W":
      if (hps[selectedIndex]) { hps[selectedIndex].y -= step; save(); }
      break;
    case "s":
    case "S":
      if (hps[selectedIndex]) { hps[selectedIndex].y += step; save(); }
      break;
    case "a":
      if (hps[selectedIndex]) { hps[selectedIndex].x -= step; save(); }
      break;
    case "d":
      if (hps[selectedIndex]) { hps[selectedIndex].x += step; save(); }
      break;
    case "q":
    case "Q":
      if (hps[selectedIndex]) { hps[selectedIndex].z -= step; save(); }
      break;
    case "e":
    case "E":
      if (hps[selectedIndex]) { hps[selectedIndex].z += step; save(); }
      break;
    case "t":
    case "T":
      if (hps[selectedIndex]) {
        const idx = HARDPOINT_TYPES.indexOf(hps[selectedIndex].type);
        if (e.shiftKey) {
          hps[selectedIndex].type = HARDPOINT_TYPES[(idx - 1 + HARDPOINT_TYPES.length) % HARDPOINT_TYPES.length];
        } else {
          hps[selectedIndex].type = HARDPOINT_TYPES[(idx + 1) % HARDPOINT_TYPES.length];
        }
        save();
      }
      break;
    case "l":
      if (hps[selectedIndex]) {
        const idx = HARDPOINT_LAYERS.indexOf(hps[selectedIndex].layer);
        hps[selectedIndex].layer = HARDPOINT_LAYERS[(idx + 1) % HARDPOINT_LAYERS.length];
        save();
      }
      break;
    case "r":
    case "R": {
      if (hps[selectedIndex]) {
        const newId = prompt("Enter new hardpoint ID:", hps[selectedIndex].id);
        if (newId !== null && newId.trim() !== "") {
          hps[selectedIndex].id = newId.trim();
          save();
        }
      }
      break;
    }
    case "u":
    case "U":
      toggleGameUI();
      break;
    case "c":
    case "C":
      if (data) {
        const json = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(json).catch(() => {});
        console.log("=== HARDPOINT DATA ===");
        console.log(json);
      }
      break;
    case "v":
    case "V":
      navigator.clipboard.readText().then((text) => {
        try {
          const imported = JSON.parse(text) as ShipHardpointData;
          if (imported.shipId && imported.directions) {
            data = imported;
            shipId = imported.shipId;
            const idx = ALL_SHIPS.indexOf(shipId);
            if (idx >= 0) shipIndex = idx;
            clampSelection();
            save();
            console.log("Hardpoint data imported successfully");
          }
        } catch (err) {
          console.error("Failed to parse clipboard JSON:", err);
        }
      }).catch(() => {});
      break;
    case "n":
    case "N": {
      const nextIdx = (dirIndex + 1) % 32;
      const nextDir = DIRECTIONS_32[nextIdx];
      if (data) {
        data.directions[nextDir] = { hardpoints: JSON.parse(JSON.stringify(hps)) };
        save();
        console.log(`Copied hardpoints to direction ${nextDir}`);
      }
      break;
    }
    case "p":
    case "P": {
      const prevIdx = (dirIndex - 1 + 32) % 32;
      const prevDir = DIRECTIONS_32[prevIdx];
      if (data) {
        data.directions[prevDir] = { hardpoints: JSON.parse(JSON.stringify(hps)) };
        save();
        console.log(`Copied hardpoints to direction ${prevDir}`);
      }
      break;
    }
    case "m":
      if (e.shiftKey) {
        hps.forEach((hp) => { hp.x = -hp.x; });
      } else {
        if (hps[selectedIndex]) { hps[selectedIndex].x = -hps[selectedIndex].x; }
      }
      save();
      break;
    case "x":
    case "X":
      if (e.shiftKey) {
        if (confirm("Clear ALL directions?")) {
          if (data) {
            for (const d of DIRECTIONS_32) {
              data.directions[d] = { hardpoints: [] };
            }
            selectedIndex = 0;
            save();
          }
        }
      } else {
        if (confirm(`Clear direction ${currentDir()}?`)) {
          if (data) {
            data.directions[currentDir()] = { hardpoints: [] };
            selectedIndex = 0;
            save();
          }
        }
      }
      break;
    case "h":
      showHelp = !showHelp;
      break;
    case "g":
      showGrid = !showGrid;
      break;
    case "o":
      showLabels = !showLabels;
      break;
  }
}

function addHardpoint(): void {
  if (!data) return;
  const hps = currentHardpoints();
  const newHp: Hardpoint = {
    id: `${shipId}_${hps.length + 1}`,
    type: "laser",
    x: 0,
    y: -40,
    z: 0,
    layer: "shipLevel",
  };
  hps.push(newHp);
  selectedIndex = hps.length - 1;
  save();
}

/* --- public API --- */
export function isEditorActive(): boolean {
  return active;
}

export function initHardpointEditor(pixiApp: PIXI.Application, initialShipId: string): void {
  if (!ENABLE_HARDPOINT_EDITOR) return;

  app = pixiApp;
  shipId = initialShipId;
  const idx = ALL_SHIPS.indexOf(shipId);
  if (idx >= 0) shipIndex = idx;
  data = load();
  dirIndex = 0;
  selectedIndex = 0;

  container = new PIXI.Container();
  container.zIndex = 999999;
  container.visible = false;
  app.stage.addChild(container);
  app.stage.sortableChildren = true;

  window.addEventListener("keydown", onKeyDown, true);

  // DOM overlay to block React pointer events when editor is open
  domBlocker = document.createElement("div");
  domBlocker.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;display:none;cursor:crosshair;";
  document.body.appendChild(domBlocker);

  console.log(`[HardpointEditor] Initialized for ship: ${shipId}`);
}

export function destroyHardpointEditor(): void {
  if (container && app) {
    app.stage.removeChild(container);
    container.destroy({ children: true });
    container = null;
  }
  if (animFrame) cancelAnimationFrame(animFrame);
  if (domBlocker) { domBlocker.remove(); domBlocker = null; }
  window.removeEventListener("keydown", onKeyDown, true);
  active = false;
  app = null;
  data = null;
  console.log("[HardpointEditor] Destroyed");
}

export function toggleHardpointEditor(): void {
  if (!container) return;
  active = !active;
  container.visible = active;
  if (domBlocker) domBlocker.style.display = active ? "block" : "none";
  if (active) {
    data = load();
    clampSelection();
    tick();
    console.log("[HardpointEditor] Activated");
  } else {
    save();
    if (animFrame) cancelAnimationFrame(animFrame);
    // Restore game UI if it was hidden
    if (gameUIHidden) {
      toggleGameUI();
    }
    console.log("[HardpointEditor] Deactivated");
  }
}
