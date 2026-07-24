import { useEffect, useRef, useState } from "react";
import { state, bump, useGame, save, pushNotification, pushChat, abandonDungeon, useConsumable, runDockingServices, loadServerPlayer, collectCargoBox, enterDungeon, stationPrice, completeDungeon, pushEvent, getActiveRocketAmmoType } from "./game/store";
import { startLoop, stopLoop, checkPortal, checkStationDock, effectiveStats, hasRocketWeapon, setEntityTarget, applyKill } from "./game/loop";
import { initPerf, perfBegin, perfEnd, perfFrame } from "./game/perf";
import { render } from "./game/render";
import { initPixiRenderer, destroyPixiRenderer, pixiRender } from "./game/pixi-renderer-v2-integrated";
import { init3DLayer, destroy3DLayer, getLoadingProgress, initStationLayer, renderStationLayer, destroyStationLayer } from "./game/three-ship-layer";
import { destroyStation3DLayer } from "./game/three-station-layer";
import { activeRenderer, ENABLE_NEW_DOCKING_FLOW } from "./game/renderer-config";
import { WorldTargetHud, LogoutFlow } from "./components/TopBar";
import { GameHud } from "./components/hud/GameHud";
import "./styles/hud/hud-tokens.css";
import "./styles/hud/hud-animations.css";
import "./styles/hud/hud-theme.css";
import "./styles/hud/hud-materials.css";
import { Hangar } from "./components/Hangar";
import { SocialPanel, ClanPanel, GalaxyMap } from "./components/SocialPanel";
import { ZoneMapOverlay } from "./components/ZoneMapOverlay";
import { FactionPicker } from "./components/FactionPicker";
import { IdleRewardModal } from "./components/IdleRewardModal";
import { EventBanners } from "./components/EventBanners";
import { GameTooltip } from "./components/GameTooltip";
import { InventoryPanel } from "./components/InventoryPanel";
import { SkillTreePanel } from "./components/SkillTreePanel";
import { PlayerStatsPanel } from "./components/PlayerStatsPanel";
import { BossBar } from "./components/BossBar";
import { QuestTracker } from "./components/QuestTracker";
import SettingsMenu from "./components/SettingsMenu";
import { AdminPanel } from "./components/AdminPanel";
import { DUNGEONS, STATIONS, PORTALS, ZONES, MODULE_DEFS, RESOURCES, SHIP_CLASSES, ENEMY_DEFS, SHIP_SIZE_SCALE, type EnemyType, type DungeonId } from "./game/types";
import { travelToZone, state as gameState } from "./game/store";
import { enemyModelKey, enemySizeScale, shipHullRadius } from "../../lib/hitbox";
import AuthScreen from "./components/AuthScreen";
import { hasToken, getPlayer, clearToken } from "./net/api";
import {
  connectSocket, disconnectSocket, setSocketListeners, sendInput, sendDockEnter,
  setInstanceCallbacks,
  type ServerEnemy, type ServerAsteroid, type ServerNpc, type ProjectileSpawnEvent,
  type EnemyHitEvent, type EnemyDieEvent, type EnemyAttackEvent,
} from "./net/socket";
import {
  onEnemyHit, onEnemyDie, onEnemyAttack, onEnemySpawn, onBossWarn,
  onAsteroidMine, onAsteroidDestroy, onAsteroidRespawn,
  onServerZoneEnemies, onServerZoneAsteroids, onServerZoneNpcs,
  onNpcSpawn, onNpcDie,
  onWelcome, onDelta, onSnapshot, onPlayerHitFromServer, onPlayerHitRemoteFromServer, onPlayerDieFromServer,
  onProjectileSpawnFromServer,
} from "./game/loop";

let _riftConfirmDungeonId: string | null = null;
let _riftConfirmSetState: ((id: string | null) => void) | null = null;

function GameCanvas() {
  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixiContainerRef = useRef<HTMLDivElement | null>(null);
  const labelOverlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    startLoop();
    return () => stopLoop();
  }, []);

  useEffect(() => {
    if (activeRenderer === "pixi") {
      // PixiJS renderer
      const container = pixiContainerRef.current;
      if (!container) return;
      initPixiRenderer(container, labelOverlayRef.current ?? undefined);

      // Station 3D layer is now bootstrapped inside initPixiRenderer as an
      // offscreen canvas wrapped as a Pixi sprite; no DOM canvas here.

      // Ships Three.js canvas at z=2 (above Pixi)
      const threeCanvas = threeCanvasRef.current;
      if (threeCanvas) {
        init3DLayer(threeCanvas);
        console.log("[App] Three.js ship canvas initialized");
      }

      initPerf();
      let raf = 0;
      const draw = () => {
        perfBegin("render");
        try { pixiRender(); } catch (err) { console.error("[PIXI] Render error:", err); }
        perfEnd("render");
        perfFrame();
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      return () => {
        cancelAnimationFrame(raf);
        destroy3DLayer();
        destroyStation3DLayer();
        destroyPixiRenderer();
      };
    } else {
      // Canvas2D renderer
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;

      let raf = 0;
      const draw = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        render(ctx, w, h);
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(raf);
    }
  }, []);

  const screenToWorld = (e: React.MouseEvent<HTMLCanvasElement | HTMLDivElement>) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const zoom = state.cameraZoom;
    return {
      x: state.player.pos.x + (cx - rect.width / 2) / zoom,
      y: state.player.pos.y + (cy - rect.height / 2) / zoom,
    };
  };

  // Generous enemy picking: the clickable area follows the rendered
  // silhouette radius (+15% and a flat margin) instead of the old tiny
  // size-based circle, and the NEAREST enemy wins so overlapping ships
  // don't steal each other's clicks.
  const pickEnemyAt = (wx: number, wy: number) => {
    let best: (typeof state.enemies)[number] | null = null;
    let bestD = Infinity;
    for (const en of state.enemies) {
      const key = enemyModelKey(en.type, en.id);
      const r = Math.max(
        44,
        (key ? shipHullRadius(key, enemySizeScale(en.size)) : en.size + 14) * 1.15 + 12,
      );
      const d = Math.hypot(en.pos.x - wx, en.pos.y - wy);
      if (d < r && d < bestD) { bestD = d; best = en; }
    }
    return best;
  };

  // Same nearest-within-silhouette pick as enemies, over other players in the
  // current zone. Used for click-to-select (target HUD + future group invite).
  const pickPlayerAt = (wx: number, wy: number) => {
    let best: (typeof state.others)[number] | null = null;
    let bestD = Infinity;
    for (const o of state.others) {
      if (o.zone !== state.player.zone) continue;
      const r = Math.max(44, shipHullRadius(o.shipClass, SHIP_SIZE_SCALE[o.shipClass] ?? 1) * 1.15 + 12);
      const d = Math.hypot(o.pos.x - wx, o.pos.y - wy);
      if (d < r && d < bestD) { bestD = d; best = o; }
    }
    return best;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement | HTMLDivElement>) => {
    if (state.dockedAt) return;
    const { x: wx, y: wy } = screenToWorld(e);

    // Check if clicking on enemy — lock target (stays locked), do NOT auto-attack
    const enemy = pickEnemyAt(wx, wy);
    if (enemy) {
      state.selectedWorldTarget = {
        kind: "enemy",
        id: enemy.id,
        name: enemy.name ?? enemy.type.toUpperCase(),
        detail: `${enemy.type.toUpperCase()} · ${Math.max(0, Math.round(enemy.hull))}/${Math.round(enemy.hullMax)} HP`,
      };
      state.attackTargetId = enemy.id;
      state.miningTargetId = null;
      state.selectedPlayerId = null;
      bump();
      return;
    }

    // Check if clicking on another player — select them (for the target HUD
    // and later group invites). Players are NOT auto-fired at, so this only
    // sets the selection, not attackTargetId.
    const other = pickPlayerAt(wx, wy);
    if (other) {
      state.selectedPlayerId = other.id;
      state.selectedWorldTarget = {
        kind: "player",
        id: other.id,
        name: other.name,
        detail: `${(SHIP_CLASSES[other.shipClass]?.name ?? other.shipClass).toUpperCase()} · LV ${other.level}`,
      };
      state.miningTargetId = null;
      bump();
      return;
    }

    // Check if clicking on asteroid — select but do NOT move ship
    const asteroid = state.asteroids.find((a) => a.zone === state.player.zone && Math.hypot(a.pos.x - wx, a.pos.y - wy) < a.size + 10);
    if (asteroid) {
      state.selectedWorldTarget = {
        kind: "asteroid",
        id: asteroid.id,
        name: `${(RESOURCES[asteroid.yields]?.name ?? "Ore").toUpperCase()} ROCK`,
        detail: `${Math.round(asteroid.hp)}/${Math.round(asteroid.hpMax)} HP`,
      };
      state.miningTargetId = asteroid.id;
      bump();
      return;
    }

    // Check if clicking on cargo box — fly to it to collect
    const cargoBox = state.cargoBoxes.find((cb) => Math.hypot(cb.pos.x - wx, cb.pos.y - wy) < 24);
    if (cargoBox) {
      state.cameraTarget = { x: cargoBox.pos.x, y: cargoBox.pos.y };
      bump();
      return;
    }

    // Check if clicking on dungeon rift — enter if close enough, otherwise fly to it
    for (const d of Object.values(DUNGEONS)) {
      if (d.zone !== state.player.zone) continue;
      if (Math.hypot(d.pos.x - wx, d.pos.y - wy) < 50) {
        const playerDist = Math.hypot(d.pos.x - state.player.pos.x, d.pos.y - state.player.pos.y);
        if (playerDist < 120) {
          _riftConfirmDungeonId = d.id;
          _riftConfirmSetState?.(d.id);
        } else {
          state.cameraTarget = { x: d.pos.x, y: d.pos.y };
          pushNotification(`Fly closer to enter ${d.name}`, "info");
        }
        bump();
        return;
      }
    }

    // WASD mode: free-space clicks shoot (handled in mousedown), never move.
    if (state.controlMode === "wasd") { bump(); return; }

    // Clicked on free space — move ship there, keep target lock
    state.cameraTarget = { x: wx, y: wy };
    state.miningTargetId = null;
    state.selectedPlayerId = null;
    if (state.selectedWorldTarget?.kind === "player") state.selectedWorldTarget = null;

    // Snap to station if clicked nearby
    for (const s of STATIONS) {
      if (s.zone !== state.player.zone) continue;
      if (Math.hypot(s.pos.x - wx, s.pos.y - wy) < 60) {
        state.cameraTarget = { x: s.pos.x, y: s.pos.y };
        break;
      }
    }
    bump();
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement | HTMLDivElement>) => {
    if (state.dockedAt) return;
    const { x: wx, y: wy } = screenToWorld(e);
    const enemy = pickEnemyAt(wx, wy);
    if (enemy) {
      state.selectedWorldTarget = {
        kind: "enemy",
        id: enemy.id,
        name: enemy.name ?? enemy.type.toUpperCase(),
        detail: `${enemy.type.toUpperCase()} · ${Math.max(0, Math.round(enemy.hull))}/${Math.round(enemy.hullMax)} HP`,
      };
      state.attackTargetId = enemy.id;
      state.miningTargetId = null;
      // Double-click starts lasers (and rockets only if equipped)
      state.isLaserFiring = true;
      state.isRocketFiring = hasRocketWeapon();
      state.isAttacking = true;
      bump();
    }
  };

  // Steer cameraTarget toward a remembered screen-space cursor position.
  const steerToHeld = () => {
    const h = heldMouse.current;
    if (!h || state.dockedAt) return;
    state.cameraTarget = {
      x: state.player.pos.x + (h.x - h.w / 2) / state.cameraZoom,
      y: state.player.pos.y + (h.y - h.h / 2) / state.cameraZoom,
    };
  };

  // ── WASD control scheme ────────────────────────────────────────────────
  // Screen-relative thrust: W = up, S = down, A = left, D = right. The
  // cursor only sets where the ship LOOKS (state.aimAngle → input:aim).
  // Movement stays server-authoritative: we only synthesize a cameraTarget
  // ~600 world units in the thrust direction each frame (same channel
  // click-to-move uses). Releasing all keys parks the target on the ship.
  const steerWasd = () => {
    if (state.dockedAt) return;

    // Aim: ship nose follows the cursor (ship = screen center), always —
    // even while standing still.
    const c = lastCursor.current;
    if (c) {
      const dx = c.x - c.w / 2;
      const dy = c.y - c.h / 2;
      if (Math.hypot(dx, dy) > 8) state.aimAngle = Math.atan2(dy, dx);
    }

    const k = wasdKeys.current;
    const vx = (k.d ? 1 : 0) - (k.a ? 1 : 0); // screen x = world x
    const vy = (k.s ? 1 : 0) - (k.w ? 1 : 0); // screen down = world +y
    if (vx === 0 && vy === 0) {
      if (wasdWasThrusting.current) {
        // Park the stop target at the natural COASTING point, not at the
        // current position: the ship still carries velocity and glides past
        // a park-on-the-spot target, and the server then drags it BACKWARD
        // to that point (visible rubber-band on every stop). Braking
        // distance with the 0.94/tick friction at 30Hz ≈ v * 0.55.
        const bd = 0.55;
        state.cameraTarget = {
          x: state.player.pos.x + state.player.vel.x * bd,
          y: state.player.pos.y + state.player.vel.y * bd,
        };
        wasdWasThrusting.current = false;
      }
      return;
    }
    const vl = Math.hypot(vx, vy) || 1;
    state.cameraTarget = {
      x: state.player.pos.x + (vx / vl) * 600,
      y: state.player.pos.y + (vy / vl) * 600,
    };
    wasdWasThrusting.current = true;
  };

  const rememberMouse = (e: React.MouseEvent<HTMLElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    heldMouse.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    };
  };

  // Always-on cursor tracking (WASD mode aims with the free cursor, no
  // button required — unlike heldMouse, which only exists while held).
  const rememberCursor = (e: React.MouseEvent<HTMLElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    lastCursor.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (state.dockedAt) return;

    if (state.controlMode === "wasd") {
      // WASD mode: free-aim combat. LMB = lasers, RMB = rockets — both fire
      // straight down the cursor ray (server mirrors via input:aim), no
      // target lock required. Clicking an enemy still selects it for the
      // target HUD.
      rememberCursor(e);
      const { x: wx, y: wy } = screenToWorld(e as unknown as React.MouseEvent<HTMLDivElement>);
      const enemy = pickEnemyAt(wx, wy);
      if (enemy) {
        state.selectedWorldTarget = {
          kind: "enemy",
          id: enemy.id,
          name: enemy.name ?? enemy.type.toUpperCase(),
          detail: `${enemy.type.toUpperCase()} · ${Math.max(0, Math.round(enemy.hull))}/${Math.round(enemy.hullMax)} HP`,
        };
        state.attackTargetId = enemy.id;
        state.miningTargetId = null;
        state.selectedPlayerId = null;
      }
      if (e.button === 0) {
        state.isLaserFiring = true;
        state.isAttacking = true;
        lmbFiring.current = true;
        window.dispatchEvent(new Event("cr-input-flush"));
      } else if (e.button === 2) {
        // Explicit feedback instead of silently doing nothing — the #1
        // reason rockets "don't launch" is no launcher / empty ammo.
        if (!hasRocketWeapon()) {
          pushNotification("No rocket launcher equipped", "bad");
        } else if ((state.player.rocketAmmo[getActiveRocketAmmoType()] ?? 0) < 1) {
          pushNotification("Rocket ammo empty", "bad");
        } else {
          state.isRocketFiring = true;
          state.isAttacking = true;
          rmbFiring.current = true;
          window.dispatchEvent(new Event("cr-input-flush"));
        }
      }
      bump();
      return;
    }

    if (e.button !== 0) return;
    rememberMouse(e);
    // If the press landed on a pickable target (enemy/player/asteroid/cargo/
    // rift), don't fly — let the click handler select it. Only start steering
    // when the press is on empty space (then holding flies toward the cursor).
    const { x: wx, y: wy } = screenToWorld(e as unknown as React.MouseEvent<HTMLDivElement>);
    const onTarget =
      pickEnemyAt(wx, wy) ||
      pickPlayerAt(wx, wy) ||
      state.asteroids.some((a) => a.zone === state.player.zone && Math.hypot(a.pos.x - wx, a.pos.y - wy) < a.size + 10) ||
      state.cargoBoxes.some((cb) => Math.hypot(cb.pos.x - wx, cb.pos.y - wy) < 24);
    if (onTarget) { heldMouse.current = null; return; }
    steerToHeld();
  };

  const stopLmbFire = () => {
    if (!lmbFiring.current) return;
    lmbFiring.current = false;
    state.isLaserFiring = false;
    if (!rmbFiring.current) state.isAttacking = false;
    bump();
    window.dispatchEvent(new Event("cr-input-flush"));
  };

  const stopRmbFire = () => {
    if (!rmbFiring.current) return;
    rmbFiring.current = false;
    state.isRocketFiring = false;
    if (!lmbFiring.current) state.isAttacking = false;
    bump();
    window.dispatchEvent(new Event("cr-input-flush"));
  };

  const handleMouseUp = (e?: React.MouseEvent<HTMLElement>) => {
    heldMouse.current = null;
    if (!e || e.button === 0) stopLmbFire();
    if (!e || e.button === 2) stopRmbFire();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement | HTMLDivElement>) => {
    rememberCursor(e);
    if (state.controlMode === "wasd") return; // aim only — no click-steering
    if (e.buttons !== 1 || state.dockedAt) { heldMouse.current = null; return; }
    rememberMouse(e);
    steerToHeld();
  };

  // Steering tick: classic mode re-aims toward the held cursor every frame;
  // WASD mode synthesizes the thrust target from keys + cursor direction.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (state.controlMode === "wasd") steerWasd();
      else { state.aimAngle = null; steerToHeld(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onUp = (ev: MouseEvent | FocusEvent) => {
      heldMouse.current = null;
      const btn = (ev as MouseEvent).button;
      if (ev.type === "blur" || btn === 0) stopLmbFire();
      if (ev.type === "blur" || btn === 2) stopRmbFire();
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("blur", onUp);

    // WASD key tracking — layout-independent via e.code, ignores chat inputs.
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };
    const KEYMAP: Record<string, "w" | "a" | "s" | "d"> = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d" };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (!k || isTyping(e.target)) return;
      if (!wasdKeys.current[k]) {
        wasdKeys.current[k] = true;
        // steer FIRST so the flush sends the fresh thrust target, not the
        // previous one (steerWasd otherwise runs on the next RAF).
        if (state.controlMode === "wasd") { steerWasd(); window.dispatchEvent(new Event("cr-input-flush")); }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (k && wasdKeys.current[k]) {
        wasdKeys.current[k] = false;
        if (state.controlMode === "wasd") { steerWasd(); window.dispatchEvent(new Event("cr-input-flush")); }
      }
    };
    const onBlurKeys = () => { wasdKeys.current = { w: false, a: false, s: false, d: false }; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlurKeys);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("blur", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlurKeys);
    };
  }, []);

  // ── Pinch-to-zoom for mobile ──
  const lastPinchDist = useRef<number>(0);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);
  // Hold-to-fly: while the left button is held, keep steering the ship toward
  // the cursor every frame — even when the mouse ISN'T moving (a mousemove
  // event only fires on motion, so a held-but-still mouse used to stop the
  // ship dead). We remember the last cursor screen position + rect and re-aim
  // cameraTarget on a tick until the button is released.
  const heldMouse = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  // WASD control scheme state
  const lastCursor = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const wasdKeys = useRef({ w: false, a: false, s: false, d: false });
  const wasdWasThrusting = useRef(false);
  const lmbFiring = useRef(false);
  const rmbFiring = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current > 0) {
        const scale = dist / lastPinchDist.current;
        const minZoom = Math.min(window.innerWidth, 1200) / 1200;
        state.cameraZoom = Math.max(minZoom * 0.7, Math.min(2.5, state.cameraZoom * scale));
        bump();
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && lastTouchPos.current) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const cx = e.touches[0].clientX - rect.left;
      const cy = e.touches[0].clientY - rect.top;
      state.cameraTarget = {
        x: state.player.pos.x + (cx - rect.width / 2) / state.cameraZoom,
        y: state.player.pos.y + (cy - rect.height / 2) / state.cameraZoom,
      };
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      bump();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) lastPinchDist.current = 0;
    if (e.touches.length === 0) lastTouchPos.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement | HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const minZoom = Math.min(window.innerWidth, 1200) / 1200;
    state.cameraZoom = Math.max(minZoom * 0.7, Math.min(2.5, state.cameraZoom + delta));
    bump();
  };

  return (
    activeRenderer === "pixi" ? (
      <>
        <div
          ref={pixiContainerRef}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: "crosshair", touchAction: "none", zIndex: 0 }}
        />
        <canvas
          ref={threeCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none", zIndex: 1 }}
        />
        <div
          ref={labelOverlayRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none", zIndex: 2, overflow: "hidden" }}
        />
      </>
    ) : (
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: "crosshair", display: "block" }}
      />
    )
  );
}

function Notifications() {
  const items = useGame((s) => s.notifications);
  return (
    <div className="absolute flex flex-col items-end gap-1 pointer-events-none z-40" style={{ bottom: 320, right: 12 }}>
      {items.slice(-4).map((n) => (
        <div
          key={n.id}
          className="panel px-3 py-1.5 text-[14px] font-bold tracking-widest"
          style={{
            opacity: Math.min(1, n.ttl),
            color: n.kind === "good" ? "#5cff8a" : n.kind === "bad" ? "#ff5c6c" : "#4ee2ff",
            borderColor: n.kind === "good" ? "#5cff8a" : n.kind === "bad" ? "#ff5c6c" : "#4ee2ff",
          }}
        >
          {n.text}
        </div>
      ))}
    </div>
  );
}


function RiftConfirmDialog() {
  const [dungeonId, setDungeonId] = useState<string | null>(null);
  useEffect(() => {
    _riftConfirmSetState = setDungeonId;
    return () => { _riftConfirmSetState = null; };
  }, []);
  if (!dungeonId) return null;
  const def = DUNGEONS[dungeonId as DungeonId];
  if (!def) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div className="panel" style={{ width: 380, maxWidth: "92vw", display: "flex", flexDirection: "column" }}>
        <div className="hud-titleband" style={{ letterSpacing: "0.28em" }}>
          <span style={{ flex: 1, color: def.color, textShadow: `0 0 8px ${def.color}66` }}>{def.name}</span>
        </div>
        <div style={{ padding: "14px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.24em", color: "var(--hud-gold)", marginBottom: 8 }}>SOLO MODE</div>
          <div style={{ fontSize: 12, color: "var(--hud-text-dim)", marginBottom: 4, letterSpacing: "0.08em" }}>
            {def.waves} WAVES · {def.enemiesPerWave} ENEMIES PER WAVE
          </div>
          <div className="sci-divider" style={{ height: 1, margin: "10px 0" }} />
          <div style={{ fontSize: 13, color: "var(--hud-text-bright)", letterSpacing: "0.1em" }}>ENTER THIS RIFT?</div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", padding: "0 16px 16px" }}>
          <button className="gbtn" style={{ padding: "8px 24px", fontSize: 12 }} onClick={() => { setDungeonId(null); _riftConfirmDungeonId = null; }}>CANCEL</button>
          <button className="gbtn gbtn-gold" style={{ padding: "8px 24px", fontSize: 12 }} onClick={() => { setDungeonId(null); _riftConfirmDungeonId = null; enterDungeon(dungeonId as DungeonId); }}>▶ ENTER RIFT</button>
        </div>
      </div>
    </div>
  );
}

function DungeonHud() {
  const dungeon = useGame((s) => s.dungeon);
  if (!dungeon) return null;
  const def = DUNGEONS[dungeon.id];
  return (
    <>
      {/* corner tint to signal instance mode */}
      <div className="absolute inset-0 pointer-events-none z-[5]" style={{
        boxShadow: `inset 0 0 220px ${def.color}33`,
      }} />
      <div className="absolute z-30 pointer-events-auto" style={{ top: 64, left: "50%", transform: "translateX(-50%)" }}>
        <div className="panel px-3 py-1.5 flex items-center gap-3" style={{ borderColor: def.color, boxShadow: `0 0 14px ${def.color}55` }}>
          <div className="text-[10px] tracking-[0.25em] font-bold" style={{ color: def.color }}>▼ {def.name.toUpperCase()}</div>
          <div className="text-[10px] text-mute tabular-nums">WAVE {dungeon.wave}/{dungeon.totalWaves}</div>
          <div className="text-[10px] text-amber tabular-nums">ENEMIES: {state.enemies.length}</div>
          <button className="gbtn gbtn-red" style={{ padding: "1px 6px", fontSize: 9 }} onClick={abandonDungeon}>
            Abandon
          </button>
        </div>
      </div>
    </>
  );
}

function DockPrompt() {
  const player = useGame((s) => s.player);
  useGame((s) => s.tick);

  const station = STATIONS.find(
    (s) => s.zone === player.zone && Math.hypot(s.pos.x - player.pos.x, s.pos.y - player.pos.y) < 300
  );
  const portal = PORTALS.find(
    (po) => po.fromZone === player.zone && Math.hypot(po.pos.x - player.pos.x, po.pos.y - player.pos.y) < 70
  );

  if (!station && !portal) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40">
      {station && !state.dockedAt && (
        <button
          className="gbtn gbtn-gold text-base px-8 py-3"
          style={{ animation: "pulse-glow 2s ease-in-out infinite", whiteSpace: "nowrap", minWidth: "fit-content" }}
          onClick={() => {
            state.dockedAt = station.id; sendDockEnter();
            state.hangarTab = station.kind === "factory" ? "refinery" : "bounties";
            state.player.vel = { x: 0, y: 0 };
            pushNotification(`Docking with ${station.name}`, "good");
            save(); bump();
            const stats = effectiveStats();
            runDockingServices(stats.hullMax, stats.shieldMax);
          }}
        >
          [SPACE] DOCK AT {station.name.toUpperCase()}
        </button>
      )}
      {portal && (
        <button
          className="gbtn px-6 py-3"
          style={{ borderColor: "#ff5cf0", color: "#ff5cf0", animation: "pulse-glow 2s ease-in-out infinite" }}
          onClick={() => {
            const z = ZONES[portal.toZone];
            if (player.level < z.unlockLevel) {
              pushNotification(`Need level ${z.unlockLevel} to enter ${z.name}`, "bad");
              return;
            }
            travelToZone(portal.toZone);
          }}
        >
          ▶ WARP TO {ZONES[portal.toZone].name.toUpperCase()}
        </button>
      )}
    </div>
  );
}


function Title() {
  return (
    <div className="absolute bottom-3 left-3 z-30 pointer-events-none">
      <div className="text-cyan glow-cyan text-[10px] tracking-[0.3em]">COSMIC REALM</div>
      <div className="text-mute text-[9px] tracking-widest">
        v 2.0 · CLICK to move · MINIMAP click warps · SPACE docks · SHOOT asteroids to mine
      </div>
    </div>
  );
}

function DockingSummary() {
  const summary = useGame((s) => s.dockingSummary);

  useEffect(() => {
    if (!summary) return;
    const dismiss = () => { state.dockingSummary = null; bump(); };
    const timer = setTimeout(dismiss, 6000);
    document.addEventListener("click", dismiss, { once: true });
    return () => { clearTimeout(timer); document.removeEventListener("click", dismiss); };
  }, [summary]);

  if (!summary) return null;

  const totalCost = summary.reduce((acc, e) => acc + e.cost, 0);
  const iconFor = (kind: string) => {
    if (kind === "repair") return "⬡";
    if (kind === "shield") return "◈";
    if (kind === "ammo") return "▸";
    return "✕";
  };
  const colorFor = (kind: string) => {
    if (kind === "repair") return "#4ade80";
    if (kind === "shield") return "#60a5fa";
    if (kind === "ammo") return "#facc15";
    return "#f87171";
  };

  return (
    <div
      className="absolute top-16 left-1/2 -translate-x-1/2 z-50"
      style={{ animation: "fadeInDown 0.3s ease" }}
    >
      <div
        className="panel cursor-pointer select-none"
        style={{ minWidth: 260 }}
      >
        <div className="hud-titleband" style={{ marginBottom: 4 }}>◉ DOCKING REPORT</div>
        <div className="flex flex-col gap-2" style={{ padding: "8px 16px 0" }}>
          {summary.map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-[12px]">
              <div className="flex items-center gap-2">
                <span style={{ color: colorFor(entry.kind) }}>{iconFor(entry.kind)}</span>
                <span style={{ color: entry.kind === "failed" ? "#f87171" : "#c8d8f0" }}>{entry.label}</span>
              </div>
              {entry.cost > 0 && (
                <span style={{ color: "#facc15" }} className="shrink-0">-{entry.cost}cr</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "0 16px 12px" }}>
          {totalCost > 0 && (
            <>
              <div className="mt-3 mb-2" style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(78,226,255,0.4),transparent)" }} />
              <div className="flex justify-between text-[12px]">
                <span style={{ color: "#7a9cbf" }}>Total spent</span>
                <span style={{ color: "#facc15" }}>-{totalCost}cr</span>
              </div>
            </>
          )}
          <div className="text-[9px] tracking-widest mt-3" style={{ color: "#3a5a7a" }}>CLICK TO DISMISS</div>
        </div>
      </div>
    </div>
  );
}

function CargoOverlay() {
  const showCargo = useGame((s) => s.showCargo);
  const player = useGame((s) => s.player);
  if (!showCargo) return null;

  const used = player.cargo.reduce((a: number, c: any) => a + c.qty, 0);
  const cls = SHIP_CLASSES[player.shipClass];
  const maxCargo = cls.cargoMax;

  return (
    <div
      className="fixed z-50"
      style={{ top: 92, right: 20, width: 360, pointerEvents: "auto" }}
    >
      <div className="panel panel-framed" style={{ position: "relative", maxHeight: "calc(100vh - 180px)", display: "flex", flexDirection: "column", boxShadow: "0 8px 30px rgba(0,0,0,0.75)" }}>
        {/* title in the window's amber glass band */}
        <div
          style={{
            position: "absolute", top: -37, left: "10%", right: "10%", height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800,
            letterSpacing: "0.28em", color: "#3a2000",
            textShadow: "0 1px 0 rgba(255,255,255,0.25)", userSelect: "none",
          }}
        >
          CARGO HOLD
        </div>
        <button
          className="gbtn gbtn-red"
          title="Close (J)"
          style={{ position: "absolute", top: -38, right: -14, padding: "2px 8px", fontSize: 11 }}
          onClick={() => { state.showCargo = false; bump(); }}
        >
          ✕
        </button>
        <div className="flex items-center justify-between px-2 pb-2 border-b" style={{ borderColor: "var(--border-soft)" }}>
          <div className="text-mute text-[12px] tracking-widest">{used}/{maxCargo} UNITS</div>
          <div className="text-amber font-bold text-[14px]">{player.cargo.reduce((s: number, c: any) => s + ((RESOURCES as any)[c.resourceId]?.basePrice ?? 0) * c.qty, 0).toLocaleString()}cr</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {player.cargo.length === 0 ? (
            <div className="text-mute text-sm italic text-center py-6">
              Cargo bay empty
            </div>
          ) : player.cargo.map((c: any) => {
            const r = (RESOURCES as any)[c.resourceId];
            if (!r) return null;
            return (
              <div key={c.resourceId} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 border-b" style={{ borderColor: "var(--border-soft)" }}>
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 28, height: 28, background: r.color + "22", border: "1px solid " + r.color, color: r.color, fontSize: 14 }}
                >{r.glyph}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-bright text-[12px] font-bold truncate">{r.name}</div>
                </div>
                <div className="text-cyan text-[13px] font-bold tabular-nums">x{c.qty}</div>
                <div className="text-amber text-[12px] tabular-nums" style={{ minWidth: 50, textAlign: "right" }}>{(c.qty * r.basePrice).toLocaleString()}cr</div>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t text-mute text-[11px] tracking-widest" style={{ borderColor: "var(--border-soft)" }}>
          {used > 0 ? "DOCK TO SELL" : "MINE OR TRADE"}
        </div>
      </div>
    </div>
  );
}


function LoadingScreen({ onReady }: { onReady: () => void }) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let elapsed = 0;
    // Minimum on-screen time so fast connections don't flash the loader,
    // plus a hard cap so the loader can NEVER get stuck (only the player
    // ship is preloaded; the other GLB models load lazily on demand, so
    // waiting for "all models" here would hang forever).
    const MIN_MS = 4000;
    const MAX_MS = 12000;
    const interval = setInterval(() => {
      elapsed += 100;
      const p = getLoadingProgress();
      // The bar follows a smooth time ramp to ~95%; the player ship being
      // ready lets it complete once the minimum time has passed.
      const timePct = Math.min(95, Math.round((elapsed / MIN_MS) * 95));
      const done = (p.playerReady && elapsed >= MIN_MS) || elapsed >= MAX_MS;
      setProgress(done ? 100 : timePct);

      if (done) {
        clearInterval(interval);
        setFadeOut(true);
        setTimeout(onReady, 800);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [onReady]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      // Stretch the loading art edge-to-edge (fills the whole screen, no
      // letterbox bars). 3:2 -> viewport aspect is a mild stretch only.
      background: "#04070e url(/assets/ui/loading-bg.jpg?v=1) no-repeat center center",
      backgroundSize: "100% 100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-end",
      transition: "opacity 0.7s ease-out",
      opacity: fadeOut ? 0 : 1,
      pointerEvents: fadeOut ? "none" : "auto",
    }}>
      {/* bottom scrim so the title + bar stay readable over the art */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(2,4,10,0.55) 78%, rgba(2,4,10,0.85) 100%)", pointerEvents: "none" }} />
      <style>{`
        @keyframes pulse { 0%, 100% { text-shadow: 0 0 10px rgba(78,226,255,0.3); } 50% { text-shadow: 0 0 25px rgba(78,226,255,0.55), 0 0 50px rgba(78,226,255,0.3); } }
      `}</style>
      <div style={{
        position: "relative", zIndex: 1,
        fontSize: 34, letterSpacing: 12, color: "#4ee2ff",
        fontFamily: "var(--font-display, 'Courier New', monospace)", fontWeight: "bold",
        animation: "pulse 3s ease-in-out infinite",
        marginBottom: 30, textAlign: "center",
      }}>
        COSMIC REALM
      </div>
      {/* Progress bar on the PNG GUI top loading-bar frame. Fill insets
          match the art's TRUE black channel (a thin slit: rows 23-28 of 54
          → T42.6/B48.1%) so the amber never touches the metal frame. */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "min(480px, 80vw)",
        aspectRatio: "567 / 54",
        backgroundImage: "url(/assets/ui/loading-bar.png?v=2)",
        backgroundSize: "100% 100%",
        filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.7))",
      }}>
        <div style={{
          position: "absolute", left: "4.6%", right: "2.4%", top: "42.6%", bottom: "48.1%",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${progress}%`, height: "100%",
            background: "linear-gradient(180deg, #baf3ff 0%, #4ee2ff 55%, #1f7a99 100%)",
            boxShadow: "0 0 8px rgba(78,226,255,0.65)",
            transition: "width 0.3s ease-out",
          }} />
        </div>
      </div>
      <div style={{
        position: "relative", zIndex: 1,
        marginTop: 14, marginBottom: "7vh", fontSize: 12, letterSpacing: 4,
        color: "rgba(78,226,255,0.75)", fontFamily: "var(--font-display, 'Courier New', monospace)",
      }}>
        LOADING SYSTEMS... {progress}%
      </div>
    </div>
  );
}

function GameApp() {
  // ── Isolated docking flow (Milestone 1) — flag-gated, no-op when disabled ──
  // Registers the scene manager states and a window.__docking debug handle so
  // SPACE ⇄ HANGAR can be switched from the console for testing. Touches nothing
  // else. When ENABLE_NEW_DOCKING_FLOW is false this effect returns immediately.
  useEffect(() => {
    if (!ENABLE_NEW_DOCKING_FLOW) return;
    let cancelled = false;
    (async () => {
      const { sceneManager, GameState } = await import("./game/scene/GameSceneManager");
      if (cancelled) return;
      // Register minimal handlers that only log for now (no visual changes yet).
      for (const s of Object.values(GameState)) {
        sceneManager.register(s as any, {
          enter: (ctx, prev) => console.log(`[docking] enter ${s} (from ${prev})`, ctx),
          exit: (next) => console.log(`[docking] exit ${s} → ${next}`),
        });
      }
      sceneManager.forceState(GameState.SPACE);
      (window as any).__docking = {
        state: () => sceneManager.state,
        toSpace: () => sceneManager.transitionTo(GameState.SPACE, { reason: "debug" }),
        dock: (id = "helix") => sceneManager.transitionTo(GameState.DOCKING, { stationId: id, reason: "debug" }),
        toHangarLoading: (id = "helix") => sceneManager.transitionTo(GameState.HANGAR_LOADING, { stationId: id }),
        toHangar: (id = "helix") => sceneManager.transitionTo(GameState.HANGAR, { stationId: id }),
        undock: () => sceneManager.transitionTo(GameState.UNDOCKING, { reason: "debug" }),
        manager: sceneManager,
        GameState,
      };
      console.log("[docking] Milestone 1 ready. Use window.__docking.dock() / .toHangar() / .undock() / .state()");
    })();
    return () => { cancelled = true; };
  }, []);

  // Wire socket listeners to game state
  useEffect(() => {
    setSocketListeners({
      onWelcome: (payload) => onWelcome(payload),
      onDelta: (payload) => onDelta(payload),
      onSnapshot: (payload) => onSnapshot(payload),
      onPlayerJoin: (p) => {
        const sid = String(p.id);
        if (state.others.find((o) => o.id === sid)) return;
        state.others.push({
          id: sid,
          name: p.name,
          shipClass: p.shipClass as any,
          level: p.level,
          clan: null,
          zone: p.zone as any,
          pos: { x: 0, y: 0 },
          vel: { x: 0, y: 0 },
          angle: 0,
          inParty: false,
          faction: p.faction ?? null,
          honor: p.honor ?? 0,
          miningTargetId: null,
          hull: p.hull ?? 100,
          hullMax: p.hullMax ?? 100,
          shield: p.shield ?? 0,
          shieldMax: p.shieldMax ?? 100,
          activeAmmoType: p.activeAmmoType,
          activeRocketAmmoType: p.activeRocketAmmoType,
          equipped: p.equipped ?? undefined,
          drones: (p.drones ?? []).map((d) => ({
            id: d.id,
            kind: d.kind as any,
            hp: d.hp,
            orbitPhase: 0,
          })),
        });
        bump();
      },
      onPlayerLeave: (data) => {
        const sid = String(data.playerId);
        state.others = state.others.filter((o) => o.id !== sid);
        bump();
      },
      onChatMessage: (msg) => {
        pushChat(msg.channel as any, msg.from, msg.text);
      },
      onOnlineCount: (_count) => {},
      onZoneEnemies: (enemies: ServerEnemy[]) => onServerZoneEnemies(enemies),
      onZoneAsteroids: (asteroids: ServerAsteroid[]) => onServerZoneAsteroids(asteroids),
      onZoneNpcs: (npcs: ServerNpc[]) => onServerZoneNpcs(npcs),
      onEnemySpawn: (enemy: ServerEnemy) => onEnemySpawn(enemy),
      onEnemyDie: (event: EnemyDieEvent) => onEnemyDie(event),
      onEnemyHit: (event: EnemyHitEvent) => onEnemyHit(event),
      onEnemyAttack: (event: EnemyAttackEvent) => onEnemyAttack(event),
      onPlayerHit: (data) => onPlayerHitFromServer(data),
      onPlayerHitRemote: (data) => onPlayerHitRemoteFromServer(data),
      onPlayerDie: (data) => onPlayerDieFromServer(data),
      onAsteroidMine: (data) => onAsteroidMine(data),
      onAsteroidDestroy: (data) => onAsteroidDestroy(data),
      onAsteroidRespawn: (asteroid: ServerAsteroid) => onAsteroidRespawn(asteroid),
      onBossWarn: () => onBossWarn(),
      onNpcSpawn: (npc: ServerNpc) => onNpcSpawn(npc),
      onNpcDie: (data) => onNpcDie(data),
      onProjectileSpawn: (event: ProjectileSpawnEvent) => onProjectileSpawnFromServer(event),
    });
    return () => setSocketListeners({});
  }, []);

  useEffect(() => {
    setInstanceCallbacks({
      onState: (data: any) => {
        if (!state.dungeon) return;
        const { enemies: serverEnemies, wave, totalWaves } = data;
        if (!serverEnemies) return;
        if (wave != null) state.dungeon.wave = wave;
        if (totalWaves != null) state.dungeon.totalWaves = totalWaves;
        for (const se of serverEnemies) {
          const existing = state.enemies.find(e => e.id === se.id);
          if (existing) {
            setEntityTarget(existing.id, se.x, se.y, se.vx ?? 0, se.vy ?? 0);
            existing.hull = se.hp;
            existing.hullMax = se.hpMax;
            existing.angle = se.angle ?? existing.angle;
          } else {
            const def = ENEMY_DEFS[se.type as EnemyType];
            state.enemies.push({
              id: se.id, type: se.type as EnemyType,
              behavior: se.behavior ?? def?.behavior ?? "chase",
              pos: { x: se.x, y: se.y },
              vel: { x: se.vx ?? 0, y: se.vy ?? 0 },
              angle: se.angle ?? 0,
              hull: se.hp, hullMax: se.hpMax,
              damage: se.damage ?? def?.damage ?? 10,
              speed: se.speed ?? def?.speed ?? 60,
              fireCd: 1,
              exp: se.exp ?? def?.exp ?? 0,
              credits: se.credits ?? def?.credits ?? 0,
              honor: se.honor ?? def?.honor ?? 0,
              color: se.color ?? def?.color ?? "#ff4444",
              size: se.size ?? def?.size ?? 20,
              loot: se.loot ?? def?.loot ?? null,
              isBoss: false, bossPhase: 0,
              aggro: true, hitFlash: 0,
              combo: null, stunUntil: 0,
              serverPos: { x: se.x, y: se.y },
              spawnPos: { x: se.x, y: se.y },
            });
          }
        }
        const serverIds = new Set(serverEnemies.map((se: any) => se.id));
        state.enemies = state.enemies.filter(e => serverIds.has(e.id));
      },
      onEvent: (data: any) => {
        if (data.type === "wave:clear") {
          pushNotification("Wave cleared!", "success");
          if (data.data?.final) {
            pushEvent({ title: "ALL WAVES CLEAR", body: "Rift subdued.", ttl: 4, kind: "global", color: "#4ee2ff" });
          }
        } else if (data.type === "wave:start") {
          const w = data.data?.wave ?? "?";
          const tw = data.data?.totalWaves ?? "?";
          pushNotification("Wave " + w + " / " + tw + " incoming!", "warning");
          pushEvent({ title: "WAVE " + w + " / " + tw, body: "Hostiles re-engaging.", ttl: 3.5, kind: "info", color: "#ff5c6c" });
        } else if (data.type === "enemy:fire") {
          const d = data.data;
          if (d) {
            // bullet-hell orb fan for instance enemies
            for (let bi = -1; bi <= 1; bi++) {
              state.projectiles.push({
                id: "ip-" + Math.random().toString(36).slice(2, 8),
                pos: { x: d.x, y: d.y },
                vel: { x: Math.cos(d.angle + bi * 0.2) * 210, y: Math.sin(d.angle + bi * 0.2) * 210 },
                damage: d.damage,
                color: d.color ?? "#ff4444",
                fromPlayer: false,
                size: 5, ttl: 3.2,
                weaponKind: "orb" as any,
              });
            }
          }
        }
      },
      onComplete: (_data: any) => {
        console.warn("[INSTANCE] onComplete fired!", _data, "dungeon:", state.dungeon?.wave, "/", state.dungeon?.totalWaves);
        completeDungeon();
        pushNotification("Instance complete! Returning to world.", "success");
      },
      onEnemyHitAck: (data: any) => {
        const e = state.enemies.find(en => en.id === data.enemyId);
        if (!e) return;
        e.hull = data.hp;
        e.hullMax = data.hpMax;
        if (data.killed) {
          applyKill(e, data.crit);
        }
      },
    });
    return () => setInstanceCallbacks({});
  }, []);

  useEffect(() => {
    const last = {
      targetX: Number.NaN,
      targetY: Number.NaN,
      firing: false,
      rocketFiring: false,
      attackTargetId: null as string | null,
      miningTargetId: null as string | null,
      laserAmmo: "",
      rocketAmmo: "",
      aimAngle: null as number | null,
      sentAt: 0,
    };
    const HEARTBEAT_MS = 1000;
    const MOVE_EPSILON = 1.5;

    const sendNow = () => {
      const cur = {
        targetX: state.cameraTarget.x,
        targetY: state.cameraTarget.y,
        firing: state.isLaserFiring,
        rocketFiring: state.isRocketFiring,
        attackTargetId: state.attackTargetId,
        pvpTargetId: state.selectedPlayerId,
        miningTargetId: state.miningTargetId,
        laserAmmo: state.player.activeAmmoType ?? "x1",
        rocketAmmo: state.player.activeRocketAmmoType ?? "cl1",
        aimAngle: state.aimAngle,
      };
      const now = performance.now();
      const moved =
        Math.abs(cur.targetX - last.targetX) > MOVE_EPSILON ||
        Math.abs(cur.targetY - last.targetY) > MOVE_EPSILON;
      const aimChanged =
        (cur.aimAngle === null) !== (last.aimAngle === null) ||
        (cur.aimAngle !== null && last.aimAngle !== null && Math.abs(cur.aimAngle - last.aimAngle) > 0.02);
      const combatChanged =
        cur.firing !== last.firing ||
        cur.rocketFiring !== last.rocketFiring ||
        cur.attackTargetId !== last.attackTargetId ||
        cur.pvpTargetId !== last.pvpTargetId ||
        cur.laserAmmo !== last.laserAmmo ||
        cur.rocketAmmo !== last.rocketAmmo;
      const miningChanged = cur.miningTargetId !== last.miningTargetId;
      const heartbeat = now - last.sentAt > HEARTBEAT_MS;

      if (!moved && !combatChanged && !miningChanged && !aimChanged && !heartbeat) return;

      sendInput(cur);
      Object.assign(last, cur, { sentAt: now });
    };
    const id = setInterval(sendNow, 50);
    // Input edges (WASD press/release, fire buttons) flush IMMEDIATELY
    // instead of waiting up to 50ms for the next interval tick — shaves the
    // largest client-side chunk off the start/stop reaction time.
    window.addEventListener("cr-input-flush", sendNow);
    return () => { clearInterval(id); window.removeEventListener("cr-input-flush", sendNow); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLCanvasElement).tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (state.dockedAt) return;
        const sid = checkStationDock();
        if (sid) {
          state.dockedAt = sid; sendDockEnter();
          { const _st = STATIONS.find(s => s.id === sid); if (_st?.kind === "factory") state.hangarTab = "refinery"; else state.hangarTab = "bounties"; }
          state.player.vel = { x: 0, y: 0 };
          pushNotification("Docking...", "good");
          save(); bump();
          const stats = effectiveStats();
          runDockingServices(stats.hullMax, stats.shieldMax);
        }
      } else if (e.key === "m" || e.key === "M") {
        state.showFullZoneMap = !state.showFullZoneMap; bump();
      } else if (e.key === "+" || e.key === "=") {
        state.minimapScale = Math.min(3, state.minimapScale + 0.25); bump();
      } else if (e.key === "-" || e.key === "_") {
        state.minimapScale = Math.max(0.5, state.minimapScale - 0.25); bump();
      } else if (e.key === "c" || e.key === "C") {
        state.showClan = !state.showClan; bump();
      } else if (e.key === "h" || e.key === "H") {
        state.showSocial = !state.showSocial; bump();
      } else if (e.key === "j" || e.key === "J") {
        state.showCargo = !state.showCargo; bump();
      } else if (e.key === "i" || e.key === "I") {
        state.showInventory = !state.showInventory; bump();
      } else if (e.key === "Escape") {
        if (state.showSettings) {
          state.showSettings = false;
        } else if (state.showMap || state.showClan || state.showAmmoSelector || state.showRocketAmmoSelector || state.showFullZoneMap || state.showInventory || state.showSkillTree || state.showPlayerStats) {
          state.showMap = false;
          state.showClan = false;
          state.showAmmoSelector = false;
          state.showRocketAmmoSelector = false;
          state.showFullZoneMap = false;
          state.showInventory = false;
          state.showSkillTree = false;
          state.showPlayerStats = false;
        } else {
          state.showSettings = true;
        }
        bump();
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (!state.dockedAt) {
          const p = state.player;
          const enemies = state.enemies.filter(en => en.hull > 0);
          if (enemies.length > 0) {
            enemies.sort((a, b) => {
              const da = Math.hypot(a.pos.x - p.pos.x, a.pos.y - p.pos.y);
              const db = Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
              return da - db;
            });
            const currentIdx = state.attackTargetId
              ? enemies.findIndex(en => en.id === state.attackTargetId)
              : -1;
            const nextIdx = (currentIdx + 1) % enemies.length;
            const target = enemies[nextIdx];
            state.attackTargetId = target.id;
            state.selectedWorldTarget = {
              kind: "enemy",
              id: target.id,
              name: target.type.toUpperCase() + (target.isBoss ? " (BOSS)" : ""),
              detail: `HP ${Math.round(target.hull)}/${Math.round(target.hullMax)}`,
            };
            state.isLaserFiring = true;
            state.isAttacking = true;
            state.miningTargetId = null;
          } else {
            // No enemies - try targeting nearest asteroid
            const asteroids = state.asteroids.filter((a: any) => a.zone === p.zone && a.hp > 0);
            if (asteroids.length > 0) {
              asteroids.sort((a: any, b: any) => {
                const da = Math.hypot(a.pos.x - p.pos.x, a.pos.y - p.pos.y);
                const db = Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
                return da - db;
              });
              const ast = asteroids[0];
              state.miningTargetId = ast.id;
              state.selectedWorldTarget = {
                kind: "asteroid",
                id: ast.id,
                name: ast.yields === "lumenite" ? "LUMENITE ROCK" : "ORE ROCK",
                detail: ast.yields.toUpperCase() + " · " + Math.round(ast.hp) + "/" + Math.round(ast.hpMax) + " HP",
              };
              state.isLaserFiring = false;
              state.isAttacking = false;
            }
          }
        }
        bump();
      } else if (e.key === "1") {
        if (!state.dockedAt) {
          // Fire at an enemy OR at a selected player (PvP).
          if (state.selectedWorldTarget?.kind === "enemy" || state.selectedWorldTarget?.kind === "player") {
            state.isLaserFiring = !state.isLaserFiring;
            state.isAttacking = state.isLaserFiring || state.isRocketFiring;
            bump();
          }
        }
      } else if (e.key === "2") {
        if (!state.dockedAt) {
          if (state.selectedWorldTarget?.kind === "enemy" || state.selectedWorldTarget?.kind === "player") {
            state.isRocketFiring = !state.isRocketFiring;
            state.isAttacking = state.isLaserFiring || state.isRocketFiring;
            bump();
          }
        }
      } else if (e.key >= "3" && e.key <= "9") {
        if (!state.dockedAt) {
          useConsumable(parseInt(e.key) - 3);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-check portal collision
  useEffect(() => {
    const id = setInterval(() => {
      if (state.dockedAt) return;
      checkPortal();
    }, 200);
    return () => clearInterval(id);
  }, []);

  const docked = useGame((s) => s.dockedAt);
  const showSocial = useGame((s) => s.showSocial);
  const showAdmin = useGame((s) => s.showAdmin);
  const showSettings = useGame((s) => s.showSettings);

  const currentUiScale = useGame((s) => {
    if (s.uiScale != null) return s.uiScale;
    const saved = localStorage.getItem("sf-ui-scale");
    if (saved) return parseFloat(saved);
    const w = window.innerWidth;
    if (w < 600) return 0.55;
    if (w < 900) return 0.7;
    return 1;
  });

  const [assetsReady, setAssetsReady] = useState(false);
  const handleAssetsReady = useRef(() => setAssetsReady(true)).current;

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#02040c" }}>
      {!assetsReady && <LoadingScreen onReady={handleAssetsReady} />}
      <GameCanvas />
      <div style={{
        // Only apply the scale transform when actually scaling (<1). At 1:1 a
        // `transform` still creates a containing block that DISABLES the
        // backdrop-filter of HUD windows (they could no longer blur the game
        // canvas behind them, which sits outside this wrapper). Omitting the
        // transform at scale 1 lets the frosted-glass panels blur the map.
        ...(currentUiScale !== 1
          ? { transform: `scale(${currentUiScale})`, transformOrigin: "top left", width: `${100 / (currentUiScale || 1)}%`, height: `${100 / (currentUiScale || 1)}%` }
          : { width: "100%", height: "100%" }),
        position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 10,
      }}>
      <div style={{ pointerEvents: "auto" }}>
      <GameHud />
      <WorldTargetHud />
      <LogoutFlow />
      <Notifications />
      <RiftConfirmDialog />
      <DungeonHud />
      <QuestTracker />
      {showSocial && <SocialPanel />}
      <ClanPanel />
      <GalaxyMap />
      <ZoneMapOverlay />
      <EventBanners />
      <GameTooltip />
      <Title />
      {docked && <Hangar stationId={docked} />}
      <DockingSummary />
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 74,
          transform: "translateX(-50%)",
          zIndex: 51,
          pointerEvents: "auto",
        }}
      >
        <DockPrompt />
      </div>
      <CargoOverlay />
      <InventoryPanel />
      <SkillTreePanel />
      <PlayerStatsPanel />
      <BossBar />
      <IdleRewardModal />
      <FactionPicker />
      </div>
      </div>
      {showSettings && <SettingsMenu onClose={() => { state.showSettings = false; bump(); }} />}
      {showAdmin && <AdminPanel onClose={() => { state.showAdmin = false; bump(); }} />}
      <div className="crt-overlay" />
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    getPlayer()
      .then((data) => {
        loadServerPlayer(data.player);
        connectSocket(localStorage.getItem("cosmic-token")!);
        setAuthed(true);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", background: "#020408", color: "#4ee2ff",
        fontSize: 14, letterSpacing: 4,
      }}>
        CONNECTING...
      </div>
    );
  }

  if (!authed) {
    return (
      <AuthScreen
        onAuth={(playerData) => {
          loadServerPlayer(playerData);
          connectSocket(localStorage.getItem("cosmic-token")!);
          setAuthed(true);
        }}
      />
    );
  }

  return <GameApp />;
}
