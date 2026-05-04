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
let zoom = 2.0;
let gameUIHidden = false;
let domBlocker: HTMLDivElement | null = null;
let dirty = true;
let pulseInterval: ReturnType<typeof setInterval> | null = null;
let dragging = false;
let dragIndex = -1;

// Retained PIXI objects (created once, updated in render)
let bgGraphic: PIXI.Graphics | null = null;
let gridGraphic: PIXI.Graphics | null = null;
let axisGraphic: PIXI.Graphics | null = null;
let crossGraphic: PIXI.Graphics | null = null;
let dotsGraphic: PIXI.Graphics | null = null;
let shipSprite: PIXI.Sprite | null = null;
let infoText: PIXI.Text | null = null;
let helpText: PIXI.Text | null = null;
let labelsContainer: PIXI.Container | null = null;

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
    "[class*=topbar], [class*=TopBar], [class*=hotbar], [class*=Hotbar], " +
    "[class*=minimap], [class*=MiniMap], [class*=quest], [class*=Quest], " +
    "[class*=panel], [class*=Panel], [class*=hud], [class*=HUD]"
  );
  uiElements.forEach((el) => {
    (el as HTMLElement).style.display = gameUIHidden ? "none" : "";
  });
}

/* --- create retained objects (once) --- */
function createRetainedObjects(): void {
  if (!container || !app) return;

  bgGraphic = new PIXI.Graphics();
  container.addChild(bgGraphic);

  gridGraphic = new PIXI.Graphics();
  container.addChild(gridGraphic);

  axisGraphic = new PIXI.Graphics();
  container.addChild(axisGraphic);

  shipSprite = new PIXI.Sprite();
  shipSprite.anchor.set(0.5);
  container.addChild(shipSprite);

  crossGraphic = new PIXI.Graphics();
  container.addChild(crossGraphic);

  dotsGraphic = new PIXI.Graphics();
  container.addChild(dotsGraphic);

  labelsContainer = new PIXI.Container();
  container.addChild(labelsContainer);

  infoText = new PIXI.Text("", {
    fontFamily: "monospace",
    fontSize: 14,
    fill: 0x00ff00,
    align: "left",
  });
  container.addChild(infoText);

  helpText = new PIXI.Text("", {
    fontFamily: "monospace",
    fontSize: 15,
    fill: 0xffffff,
    align: "left",
  });
  helpText.visible = false;
  container.addChild(helpText);

  // Static axis labels (never change)
  const mkLabel = (txt: string, color: number) => {
    const t = new PIXI.Text(txt, { fontFamily: "monospace", fontSize: 11, fill: color });
    container!.addChild(t);
    return t;
  };
  const axLabels = [
    mkLabel("+X", 0xff4444),
    mkLabel("-X", 0xff4444),
    mkLabel("+Y", 0x44ff44),
    mkLabel("-Y", 0x44ff44),
    mkLabel("0,0", 0xffffff),
  ];
  (container as any)._axLabels = axLabels;
}

/* --- rendering (updates existing objects, no creation) --- */
function render(): void {
  if (!container || !app || !bgGraphic || !gridGraphic || !axisGraphic || !crossGraphic || !dotsGraphic || !shipSprite || !infoText || !helpText || !labelsContainer) return;

  const w = app.screen.width;
  const h = app.screen.height;
  const cx = w / 2;
  const cy = h / 2;

  // Background
  bgGraphic.clear();
  bgGraphic.beginFill(0x000000, 0.94);
  bgGraphic.drawRect(0, 0, w, h);
  bgGraphic.endFill();

  // Grid
  gridGraphic.clear();
  if (showGrid) {
    gridGraphic.lineStyle(1, 0x222222, 0.5);
    const step = 20 * zoom;
    for (let x = cx % step; x < w; x += step) {
      gridGraphic.moveTo(x, 0); gridGraphic.lineTo(x, h);
    }
    for (let y = cy % step; y < h; y += step) {
      gridGraphic.moveTo(0, y); gridGraphic.lineTo(w, y);
    }
  }

  // Axis lines (X = red horizontal, Y = green vertical, origin = white dot)
  axisGraphic.clear();
  // X axis (red, horizontal through center)
  axisGraphic.lineStyle(2, 0xff4444, 0.7);
  axisGraphic.moveTo(0, cy); axisGraphic.lineTo(w, cy);
  // Y axis (green, vertical through center)
  axisGraphic.lineStyle(2, 0x44ff44, 0.7);
  axisGraphic.moveTo(cx, 0); axisGraphic.lineTo(cx, h);
  // Origin dot (white)
  axisGraphic.lineStyle(0);
  axisGraphic.beginFill(0xffffff, 1);
  axisGraphic.drawCircle(cx, cy, 3);
  axisGraphic.endFill();
  // Axis labels
  axisGraphic.lineStyle(1, 0xff4444, 0.9);
  // +X label (right)
  axisGraphic.lineStyle(0);


  // Position static axis labels
  const axLabels = (container as any)._axLabels;
  if (axLabels) {
    axLabels[0].position.set(cx + 60, cy + 4);
    axLabels[1].position.set(cx - 80, cy + 4);
    axLabels[2].position.set(cx + 4, cy + 60);
    axLabels[3].position.set(cx + 4, cy - 70);
    axLabels[4].position.set(cx + 6, cy - 16);
  }

  // Ship sprite
  const spritePath = spritePathForDir(dirIndex);
  const tex = PIXI.Texture.from(spritePath);
  shipSprite.texture = tex;
  shipSprite.position.set(cx, cy);
  shipSprite.scale.set(zoom);

  // Crosshair (small, at origin)
  crossGraphic.clear();
  crossGraphic.lineStyle(1, 0xffffff, 0.3);
  crossGraphic.moveTo(cx - 15, cy); crossGraphic.lineTo(cx + 15, cy);
  crossGraphic.moveTo(cx, cy - 15); crossGraphic.lineTo(cx, cy + 15);

  // Hardpoint dots
  dotsGraphic.clear();
  const hps = currentHardpoints();
  hps.forEach((hp, i) => {
    const sx = cx + hp.x * zoom;
    const sy = cy + (hp.y - hp.z) * zoom;
    const color = HARDPOINT_COLORS[hp.type] ?? 0xffffff;
    const isSelected = i === selectedIndex;

    if (isSelected) {
      dotsGraphic.lineStyle(1, 0xffffff, 0.8);
      dotsGraphic.drawCircle(sx, sy, 6);
      dotsGraphic.lineStyle(0);
    }

    dotsGraphic.beginFill(color, isSelected ? 1 : 0.8);
    dotsGraphic.drawCircle(sx, sy, isSelected ? 3 : 2);
    dotsGraphic.endFill();
  });

  // Z-axis height indicators (vertical line from ground to elevated position)
  hps.forEach((hp, i) => {
    if (Math.abs(hp.z) < 0.5) return;
    const sx = cx + hp.x * zoom;
    const groundY = cy + hp.y * zoom;
    const elevY = cy + (hp.y - hp.z) * zoom;
    const color = HARDPOINT_COLORS[hp.type] ?? 0xffffff;
    const isSelected = i === selectedIndex;
    // Dashed vertical line from ground to elevated position
    dotsGraphic.lineStyle(1, color, isSelected ? 0.6 : 0.3);
    const dashLen = 3;
    const gap = 3;
    const startY = Math.min(groundY, elevY);
    const endY = Math.max(groundY, elevY);
    let dy = startY;
    while (dy < endY) {
      const segEnd = Math.min(dy + dashLen, endY);
      dotsGraphic.moveTo(sx, dy);
      dotsGraphic.lineTo(sx, segEnd);
      dy = segEnd + gap;
    }
    dotsGraphic.lineStyle(0);
    // Small diamond at ground position
    dotsGraphic.beginFill(color, isSelected ? 0.5 : 0.25);
    dotsGraphic.moveTo(sx, groundY - 2);
    dotsGraphic.lineTo(sx + 2, groundY);
    dotsGraphic.lineTo(sx, groundY + 2);
    dotsGraphic.lineTo(sx - 2, groundY);
    dotsGraphic.closePath();
    dotsGraphic.endFill();
  });

  // Labels (destroy old, create minimal new ones)
  while (labelsContainer.children.length > 0) {
    labelsContainer.children[0].destroy();
  }
  if (showLabels && hps.length > 0) {
    hps.forEach((hp, i) => {
      const sx = cx + hp.x * zoom;
      const sy = cy + (hp.y - hp.z) * zoom;
      const isSelected = i === selectedIndex;
      const zInfo = Math.abs(hp.z) >= 0.5 ? ` z:${Math.round(hp.z)}` : "";
      const label = new PIXI.Text(
        `${hp.id} (${hp.type}) ${Math.round(hp.x)},${Math.round(hp.y)}${zInfo}`,
        { fontFamily: "monospace", fontSize: 9, fill: isSelected ? 0x00ff00 : 0x999999 }
      );
      label.position.set(sx + 8, sy - 6);
      labelsContainer.addChild(label);
    });
  }

  // Axis labels near origin
  const axLabelX = new PIXI.Text("+X", { fontFamily: "monospace", fontSize: 11, fill: 0xff4444 });
  axLabelX.position.set(cx + 60, cy + 4);
  labelsContainer.addChild(axLabelX);
  const axLabelNX = new PIXI.Text("-X", { fontFamily: "monospace", fontSize: 11, fill: 0xff4444 });
  axLabelNX.position.set(cx - 80, cy + 4);
  labelsContainer.addChild(axLabelNX);
  const axLabelY = new PIXI.Text("+Y", { fontFamily: "monospace", fontSize: 11, fill: 0x44ff44 });
  axLabelY.position.set(cx + 4, cy + 60);
  labelsContainer.addChild(axLabelY);
  const axLabelNY = new PIXI.Text("-Y", { fontFamily: "monospace", fontSize: 11, fill: 0x44ff44 });
  axLabelNY.position.set(cx + 4, cy - 70);
  labelsContainer.addChild(axLabelNY);

  const originLabel = new PIXI.Text("0,0,0", { fontFamily: "monospace", fontSize: 10, fill: 0xffffff });
  originLabel.position.set(cx + 6, cy - 16);
  labelsContainer.addChild(originLabel);

  // Info panel (bottom-left)
  const compass = DIR_32_COMPASS[dirIndex];
  const deg = DIRECTIONS_32[dirIndex];
  let infoStr = `Ship: ${shipId} [${shipIndex + 1}/${ALL_SHIPS.length}]\n`;
  infoStr += `Dir: ${deg} (${compass}) [${dirIndex + 1}/32]\n`;
  infoStr += `Zoom: ${zoom.toFixed(1)}x | Points: ${hps.length}\n`;
  if (hps.length > 0 && hps[selectedIndex]) {
    const sel = hps[selectedIndex];
    infoStr += `\n> [${selectedIndex + 1}] ${sel.id}\n`;
    infoStr += `  type: ${sel.type}  layer: ${sel.layer}\n`;
    infoStr += `  x: ${sel.x}  y: ${sel.y}`;
  }
  // List all points
  if (hps.length > 1) {
    infoStr += "\n\nAll points:";
    hps.forEach((hp, i) => {
      const marker = i === selectedIndex ? " >" : "  ";
      infoStr += `\n${marker}[${i+1}] ${hp.id} x:${hp.x} y:${hp.y}`;
    });
  }
  infoText.text = infoStr;
  infoText.position.set(10, h - 180);

  // Help panel
  helpText.visible = showHelp;
  if (showHelp) {
    helpText.text = [
      "=== HARDPOINT EDITOR ===",
      "",
      "F9          Toggle editor",
      "PgUp/PgDn   Switch ship",
      "Left/Right  Direction (Shift=4x)",
      "Tab/S-Tab   Select point",
      "1-9         Select by index",
      "",
      "W/A/S/D     Move (Shift=5, Alt=0.25)",
      "Drag        Move dot with mouse",
      "+/-         Zoom",
      "T/Shift+T   Cycle type",
      "L           Cycle layer",
      "R           Rename",
      "",
      "Insert/S+A  Add point (or dblclick)",
      "Del/Bksp    Delete",
      "M/Shift+M   Mirror x",
      "N/P         Copy to next/prev dir",
      "Shift+N     Copy to next 8 dirs",
      "F           Fill ALL 32 dirs from current",
      "I           Interpolate (set 8 dirs: N,NE,E,SE,S,SW,W,NW)",
      "C           Export JSON",
      "U           Toggle game UI",
      "G/O/H       Grid/Labels/Help",
    ].join("\n");
    helpText.position.set(w - 360, h - 420);
  }
}

/* --- render on demand --- */
function scheduleRender(): void {
  dirty = true;
}

function tick(): void {
  if (!active || !app) return;
  if (dirty) {
    dirty = false;
    render();
    app.renderer.render(app.stage);
  }
}

function startRenderLoop(): void {
  stopRenderLoop();
  dirty = true;
  pulseInterval = setInterval(tick, 33);
}

function stopRenderLoop(): void {
  if (pulseInterval) { clearInterval(pulseInterval); pulseInterval = null; }
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
            scheduleRender();
          }
        } catch (err) {
          console.error("Failed to parse clipboard JSON:", err);
        }
      }).catch(() => {});
      break;
    case "n":
    case "N": {
      if (e.shiftKey) {
        // Shift+N = copy to next 8 directions
        for (let i = 1; i <= 8; i++) {
          const idx = (dirIndex + i) % 32;
          if (data) data.directions[DIRECTIONS_32[idx]] = { hardpoints: JSON.parse(JSON.stringify(hps)) };
        }
        save();
      } else {
        const nextIdx = (dirIndex + 1) % 32;
        const nextDir = DIRECTIONS_32[nextIdx];
        if (data) {
          data.directions[nextDir] = { hardpoints: JSON.parse(JSON.stringify(hps)) };
          save();
        }
      }
      break;
    }
    case "f":
    case "F": {
      if (data && confirm("Fill ALL 32 directions with current hardpoints?")) {
        for (const d of DIRECTIONS_32) {
          data.directions[d] = { hardpoints: JSON.parse(JSON.stringify(hps)) };
        }
        save();
      }
      break;
    }
    case "i":
    case "I": {
      interpolateAllDirections();
      break;
    }
    case "p":
    case "P": {
      const prevIdx = (dirIndex - 1 + 32) % 32;
      const prevDir = DIRECTIONS_32[prevIdx];
      if (data) {
        data.directions[prevDir] = { hardpoints: JSON.parse(JSON.stringify(hps)) };
        save();
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
  scheduleRender();
}


function interpolateAllDirections(): void {
  if (!data) return;
  // 8 keyframes: N, NE, E, SE, S, SW, W, NW (every 4th frame)
  const keyFrames = [0, 4, 8, 12, 16, 20, 24, 28];
  const keyDirs = keyFrames.map(i => DIRECTIONS_32[i]);
  
  // Find which keyframes have data
  const filledKeys: number[] = [];
  for (let k = 0; k < keyFrames.length; k++) {
    const d = data.directions[keyDirs[k]];
    if (d && d.hardpoints.length > 0) filledKeys.push(k);
  }
  
  if (filledKeys.length < 2) {
    alert("Place hardpoints in at least 2 of the 8 key directions:\nN(1), NE(5), E(9), SE(13), S(17), SW(21), W(25), NW(29)");
    return;
  }
  
  // Detect which hardpoint types are in the keyframes
  const interpTypes = new Set<string>();
  for (const k of filledKeys) {
    for (const hp of data.directions[keyDirs[k]].hardpoints) {
      interpTypes.add(hp.type);
    }
  }

  // Linear interpolation between consecutive filled keyframes (wrapping around)
  // Only interpolates types found in keyframes, preserves all other types
  for (let ki = 0; ki < filledKeys.length; ki++) {
    const startKey = filledKeys[ki];
    const endKey = filledKeys[(ki + 1) % filledKeys.length];
    const startFrame = keyFrames[startKey];
    const endFrame = keyFrames[endKey];
    const startAll = data.directions[keyDirs[startKey]].hardpoints;
    const endAll = data.directions[keyDirs[endKey]].hardpoints;
    const startHps = startAll.filter(hp => interpTypes.has(hp.type));
    const endHps = endAll.filter(hp => interpTypes.has(hp.type));
    const pairCount = Math.min(startHps.length, endHps.length);

    const gap = endFrame > startFrame ? endFrame - startFrame : (32 - startFrame + endFrame);

    for (let i = 1; i < gap; i++) {
      const frameIdx = (startFrame + i) % 32;
      const dir = DIRECTIONS_32[frameIdx];
      const t = i / gap;

      // Preserve existing hardpoints of OTHER types in this direction
      const existing = data.directions[dir]?.hardpoints ?? [];
      const preserved = existing.filter(hp => !interpTypes.has(hp.type));

      const interpolated: Hardpoint[] = [...preserved];
      for (let h = 0; h < pairCount; h++) {
        interpolated.push({
          id: startHps[h].id,
          type: startHps[h].type,
          layer: startHps[h].layer,
          x: Math.round(startHps[h].x + (endHps[h].x - startHps[h].x) * t),
          y: Math.round(startHps[h].y + (endHps[h].y - startHps[h].y) * t),
          z: Math.round(startHps[h].z + (endHps[h].z - startHps[h].z) * t),
        });
      }
      const nearest = t < 0.5 ? startHps : endHps;
      for (let h = pairCount; h < nearest.length; h++) {
        interpolated.push({ ...nearest[h] });
      }
      data.directions[dir] = { hardpoints: interpolated };
    }
  }

  save();
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


/* --- mouse/pointer drag handlers --- */
function screenToHardpoint(mx: number, my: number, hz: number): { x: number; y: number } {
  if (!app) return { x: 0, y: 0 };
  const cx = app.screen.width / 2;
  const cy = app.screen.height / 2;
  const x = Math.round((mx - cx) / zoom);
  const y = Math.round((my - cy) / zoom + hz);
  return { x, y };
}

function findDotAt(mx: number, my: number): number {
  if (!app) return -1;
  const cx = app.screen.width / 2;
  const cy = app.screen.height / 2;
  const hps = currentHardpoints();
  let closest = -1;
  let closestDist = 12; // max pick radius in pixels
  for (let i = 0; i < hps.length; i++) {
    const hp = hps[i];
    const sx = cx + hp.x * zoom;
    const sy = cy + (hp.y - hp.z) * zoom;
    const dist = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  }
  return closest;
}

function onPointerDown(e: PointerEvent): void {
  if (!active) return;
  const idx = findDotAt(e.clientX, e.clientY);
  if (idx >= 0) {
    selectedIndex = idx;
    dragging = true;
    dragIndex = idx;
    scheduleRender();
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!active || !dragging || dragIndex < 0) return;
  const hps = currentHardpoints();
  if (!hps[dragIndex]) return;
  const hp = hps[dragIndex];
  const pos = screenToHardpoint(e.clientX, e.clientY, hp.z);
  hp.x = pos.x;
  hp.y = pos.y;
  scheduleRender();
}

function onPointerUp(_e: PointerEvent): void {
  if (dragging) {
    dragging = false;
    dragIndex = -1;
    save();
  }
}

function onDblClick(e: MouseEvent): void {
  if (!active || !app) return;
  // Double-click adds a new hardpoint at that position
  if (!data) return;
  const hps = currentHardpoints();
  const cx = app.screen.width / 2;
  const cy = app.screen.height / 2;
  const x = Math.round((e.clientX - cx) / zoom);
  const y = Math.round((e.clientY - cy) / zoom);
  const newHp: Hardpoint = {
    id: `${shipId}_${hps.length + 1}`,
    type: "laser",
    x,
    y,
    z: 0,
    layer: "shipLevel",
  };
  hps.push(newHp);
  selectedIndex = hps.length - 1;
  save();
  scheduleRender();
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
  container.visible = false;
  app.stage.addChild(container);

  createRetainedObjects();

  domBlocker = document.createElement("div");
  domBlocker.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;display:none;cursor:crosshair;";
  document.body.appendChild(domBlocker);

  window.addEventListener("keydown", onKeyDown, true);

  domBlocker.addEventListener("pointerdown", onPointerDown);
  domBlocker.addEventListener("pointermove", onPointerMove);
  domBlocker.addEventListener("pointerup", onPointerUp);
  domBlocker.addEventListener("dblclick", onDblClick);
}

export function destroyHardpointEditor(): void {
  if (container && app) {
    app.stage.removeChild(container);
    container.destroy({ children: true });
    container = null;
  }
  stopRenderLoop();
  if (domBlocker) {
    domBlocker.removeEventListener("pointerdown", onPointerDown);
    domBlocker.removeEventListener("pointermove", onPointerMove);
    domBlocker.removeEventListener("pointerup", onPointerUp);
    domBlocker.removeEventListener("dblclick", onDblClick);
    domBlocker.remove();
    domBlocker = null;
  }
  window.removeEventListener("keydown", onKeyDown, true);
  active = false;
  app = null;
  data = null;
  bgGraphic = null; gridGraphic = null; axisGraphic = null;
  crossGraphic = null; dotsGraphic = null; shipSprite = null;
  infoText = null; helpText = null; labelsContainer = null;
}

export function toggleHardpointEditor(): void {
  if (!container || !app) return;
  active = !active;
  container.visible = active;
  if (domBlocker) domBlocker.style.display = active ? "block" : "none";
  if (active) {
    app.ticker.stop();
    data = load();
    clampSelection();
    startRenderLoop();
  } else {
    save();
    stopRenderLoop();
    app.ticker.start();
    if (gameUIHidden) toggleGameUI();
  }
}
