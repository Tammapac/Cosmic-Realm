import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

let onInstanceJoined: ((data: any) => void) | null = null;
let onInstanceLeft: ((data: any) => void) | null = null;
let onInstanceState: ((data: any) => void) | null = null;
let onInstanceEvent: ((data: any) => void) | null = null;
let onInstanceComplete: ((data: any) => void) | null = null;
let onInstanceEnemyHitAck: ((data: any) => void) | null = null;

// ── TYPES ────────────────────────────────────────────────────────────────

export type WireDrone = {
  id: string;
  kind: string;
  hp: number;
};

export type RemotePlayer = {
  id: number;
  name: string;
  shipClass: string;
  level: number;
  faction: string | null;
  clan: string | null;
  zone: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hull: number;
  hullMax: number;
  shield: number;
  shieldMax: number;
  honor: number;
  // Equipment / visual sync — optional so we tolerate servers that don't send them
  activeAmmoType?: string;
  activeRocketAmmoType?: string;
  equipped?: {
    weapon?: (string | null)[];
    generator?: (string | null)[];
    module?: (string | null)[];
  };
  drones?: WireDrone[];
};

export type WelcomePayload = {
  playerId: number;
  tickRate: number;
  friction: number;
  frictionRefFps: number;
};

export type DeltaEntity = {
  id: string;
  entityType: "player" | "enemy" | "npc" | "asteroid";
  x: number; y: number;
  vx?: number; vy?: number;
  angle?: number;
  hp?: number; hpMax?: number;
  shield?: number; shieldMax?: number;
  version: number;
  // Player-specific
  name?: string;
  shipClass?: string;
  level?: number;
  faction?: string | null;
  honor?: number;
  // Player equipment / visual sync — optional so we tolerate servers that don't send them
  activeAmmoType?: string;
  activeRocketAmmoType?: string;
  equipped?: {
    weapon?: (string | null)[];
    generator?: (string | null)[];
    module?: (string | null)[];
  };
  drones?: WireDrone[];
  // Enemy-specific
  type?: string;
  behavior?: string;
  damage?: number;
  speed?: number;
  color?: string;
  size?: number;
  isBoss?: boolean;
  bossPhase?: number;
  // NPC-specific
  state?: string;
  // Asteroid-specific
  yields?: string;
  // Mining state
  miningTargetId?: string | null;
};

export type DeltaPayload = {
  tick: number;
  self: {
    id: number;
    x: number; y: number;
    vx: number; vy: number;
    hp: number; hpMax: number;
    shield: number; shieldMax: number;
    lastProcessedInput: number;
  };
  addOrUpdate: DeltaEntity[];
  removals: string[];
};

export type SnapshotPayload = {
  tick: number;
  self: {
    id: number;
    x: number; y: number;
    vx: number; vy: number;
    hp: number; hpMax: number;
    shield: number; shieldMax: number;
    lastProcessedInput: number;
  };
  entities: DeltaEntity[];
};

export type ServerEnemy = {
  id: string; type: string; behavior: string; name: string;
  x: number; y: number; vx: number; vy: number; angle: number;
  hull: number; hullMax: number; damage: number; speed: number;
  color: string; size: number; isBoss: boolean; bossPhase: number;
};

export type ServerAsteroid = {
  id: string; x: number; y: number;
  hp: number; hpMax: number; size: number; yields: string;
};

export type ServerNpc = {
  id: string; name: string;
  x: number; y: number; vx: number; vy: number; angle: number;
  hull: number; hullMax: number; speed: number;
  color: string; size: number; state: string;
};

export type CombatEvent = {
  attackerId: number;
  targetId: number;
  weaponKind: string;
  damage: number;
};

export type EnemyHitEvent = {
  enemyId: string;
  damage: number;
  hp: number;
  hpMax: number;
  crit: boolean;
  attackerId: number;
};

export type EnemyDieEvent = {
  enemyId: string;
  killerId: number;
  loot: {
    credits: number; exp: number; honor: number;
    resource?: { resourceId: string; qty: number };
    bonusResource?: { resourceId: string; qty: number };
    bebcell?: number;  // boss-only pet-drone upgrade material
    item?: import("../game/types").ModuleItem;
  };
  pos: { x: number; y: number };
};

export type EnemyAttackEvent = {
  enemyId: string;
  targetId: number;
  damage: number;
  pos: { x: number; y: number };
  targetPos: { x: number; y: number };
};

export type LaserFireEvent = {
  attackerId: number;
  targetId: string;
  damage: number;
  crit: boolean;
};

export type RocketFireEvent = {
  attackerId: number;
  targetId: string;
  damage: number;
  crit: boolean;
  pos: { x: number; y: number };
  targetPos: { x: number; y: number };
};

export type ProjectileSpawnEvent = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  size: number;
  crit: boolean;
  weaponKind: "laser" | "rocket" | "energy" | "plasma";
  homing: boolean;
  fromPlayer: boolean;
  fromPlayerId?: number;
  // Ammo type sent by server so remote clients can resolve the correct color/visual.
  // For lasers: "x1"/"x2"/"x3"/"x4". For rockets: "cl1"/"cl2"/"bm3"/"drock".
  ammoType?: string;
  ttl?: number;
  // Authoritative hardpoint selector so remote clients don't guess which muzzle fired.
  hardpointIndex?: number;
  hardpointRing?: "muzzle" | "weapon";
  shipClass?: string;
  // Enemy the shooter is targeting. Remote clients use this to reproduce the
  // local player's muzzle→target convergence for renderOnly projectiles.
  targetId?: string;
};

type SocketEvents = {
  onWelcome: (payload: WelcomePayload) => void;
  onDelta: (payload: DeltaPayload) => void;
  onSnapshot: (payload: SnapshotPayload) => void;
  onPlayerJoin: (player: { id: number; name: string; shipClass: string; level: number; faction: string | null; honor: number; zone: string; hull: number; hullMax: number; shield: number; shieldMax: number; activeAmmoType?: string; activeRocketAmmoType?: string; equipped?: { weapon?: (string | null)[]; generator?: (string | null)[]; module?: (string | null)[] } | null; drones?: WireDrone[] }) => void;
  onPlayerLeave: (data: { playerId: number }) => void;
  onCombatAttack: (event: CombatEvent) => void;
  onChatMessage: (msg: { from: string; text: string; channel: string; time: number }) => void;
  onOnlineCount: (count: number) => void;
  onZoneEnemies: (enemies: ServerEnemy[]) => void;
  onZoneAsteroids: (asteroids: ServerAsteroid[]) => void;
  onZoneNpcs: (npcs: ServerNpc[]) => void;
  onEnemySpawn: (enemy: ServerEnemy) => void;
  onEnemyDie: (event: EnemyDieEvent) => void;
  onEnemyHit: (event: EnemyHitEvent) => void;
  onEnemyAttack: (event: EnemyAttackEvent) => void;
  onPlayerHit: (data: { damage: number; hp: number; shield: number }) => void;
  onPlayerHitRemote: (data: { playerId: number; damage: number; pos: { x: number; y: number }; killerId: number | null }) => void;
  onPlayerDie: (data: { playerId: number; pos: { x: number; y: number }; killerId: number | null }) => void;
  onAsteroidMine: (data: { asteroidId: string; hp: number; hpMax: number }) => void;
  onAsteroidDestroy: (data: { asteroidId: string; playerId: number; ore: { resourceId: string; qty: number } }) => void;
  onAsteroidRespawn: (asteroid: ServerAsteroid) => void;
  onBossWarn: () => void;
  onNpcSpawn: (npc: ServerNpc) => void;
  onNpcDie: (data: { npcId: string }) => void;
  onProjectileSpawn: (event: ProjectileSpawnEvent) => void;
  onLaserFire: (event: LaserFireEvent) => void;
  onRocketFire: (event: RocketFireEvent) => void;
};

let listeners: Partial<SocketEvents> = {};

export function connectSocket(token: string) {
  if (socket?.connected) return;

  socket = io(window.location.origin, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  // Expose socket globally for DevTools debugging
  (window as any).__debugSocket = socket;

  socket.on("connect", () => {
    console.log("[socket] connected", {
      id: socket!.id,
      transport: socket!.io.engine.transport.name,
    });
  });

  socket.io.engine.on("upgrade", () => {
    console.log("[socket] upgraded", {
      transport: socket!.io.engine.transport.name,
    });
  });

  // Admin force-sync: server updated our player data
  socket.on("admin:sync", async (updates: any) => {
    const store = await import("../game/store");
    const loop = await import("../game/loop");
    const p = store.state.player;
    for (const [k, v] of Object.entries(updates)) {
      if (k in p) (p as any)[k] = v;
    }
    // Apply hull/shield directly to live game engine so it takes effect immediately
    if (updates.hull !== undefined) p.hull = Math.min(updates.hull, p.hullMax);
    if (updates.shield !== undefined) p.shield = Math.min(updates.shield, loop.effectiveStats().shieldMax);
    store.bump();
    store.save();
    console.log("[ADMIN] Received force-sync:", updates);
  });

  socket.on("kicked", (data: { reason: string }) => {
    console.warn("[socket] kicked:", data.reason);
    alert("Session taken over: " + data.reason + ". This tab will reload.");
    window.location.reload();
  });

  socket.on("disconnect", (reason) => {
    console.warn("[socket] disconnected", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("[socket] connect_error", err.message);
  });

  // Server authority events
  socket.on("welcome", (payload: WelcomePayload) => {
    listeners.onWelcome?.(payload);
  });

  let _deltaCount = 0;
  let _snapshotCount = 0;

  // Diagnostic logs on the socket hot path can stall the main thread
  // when DevTools is open (each log serializes objects and updates DevTools UI).
  // Gate behind window.__DEBUG_SOCKET so gameplay stays hitch-free by default.
  const _debugSocket = () => (window as any).__DEBUG_SOCKET === true;

  socket.on("delta", (payload: DeltaPayload) => {
    _deltaCount++;
    if (_debugSocket() && _deltaCount % 60 === 0) {
      console.log("[socket] delta #" + _deltaCount, {
        tick: payload.tick,
        updates: payload.addOrUpdate.length,
        removals: payload.removals.length,
        selfPos: { x: Math.round(payload.self.x), y: Math.round(payload.self.y) },
      });
    }
    listeners.onDelta?.(payload);
  });

  socket.on("snapshot", (payload: SnapshotPayload) => {
    _snapshotCount++;
    if (_debugSocket()) {
      console.log("[socket] snapshot #" + _snapshotCount, {
        tick: payload.tick,
        entities: payload.entities.length,
        selfPos: { x: Math.round(payload.self.x), y: Math.round(payload.self.y) },
      });
    }
    listeners.onSnapshot?.(payload);
  });

  // Player events
  socket.on("player:join", (player) => {
    listeners.onPlayerJoin?.(player);
  });

  socket.on("player:leave", (data: { playerId: number }) => {
    listeners.onPlayerLeave?.(data);
  });

  socket.on("combat:attack", (event: CombatEvent) => {
    listeners.onCombatAttack?.(event);
  });

  socket.on("chat:message", (msg) => {
    listeners.onChatMessage?.(msg);
  });

  socket.on("online:count", (count: number) => {
    listeners.onOnlineCount?.(count);
  });

  // Zone state (initial load + warp)
  socket.on("zone:enemies", (enemies: ServerEnemy[]) => {
    listeners.onZoneEnemies?.(enemies);
  });

  socket.on("zone:asteroids", (asteroids: ServerAsteroid[]) => {
    listeners.onZoneAsteroids?.(asteroids);
  });

  socket.on("zone:npcs", (npcs: ServerNpc[]) => {
    listeners.onZoneNpcs?.(npcs);
  });

  // Game events
  socket.on("enemy:spawn", (enemy: ServerEnemy) => {
    if (_debugSocket()) console.log("[socket] enemy:spawn", { id: enemy.id, type: enemy.type, name: enemy.name });
    listeners.onEnemySpawn?.(enemy);
  });

  socket.on("enemy:die", (event: EnemyDieEvent) => {
    if (_debugSocket()) console.log("[socket] enemy:die", { id: event.enemyId, killer: event.killerId });
    listeners.onEnemyDie?.(event);
  });

  socket.on("enemy:hit", (event: EnemyHitEvent) => {
    listeners.onEnemyHit?.(event);
  });

  socket.on("enemy:attack", (event: EnemyAttackEvent) => {
    listeners.onEnemyAttack?.(event);
  });

  socket.on("player:hit", (data: { damage: number; hp: number; shield: number }) => {
    listeners.onPlayerHit?.(data);
  });

  socket.on("player:hit:remote", (data: { playerId: number; damage: number; pos: { x: number; y: number }; killerId: number | null }) => {
    listeners.onPlayerHitRemote?.(data);
  });

  socket.on("player:die", (data: { playerId: number; pos: { x: number; y: number }; killerId: number | null }) => {
    listeners.onPlayerDie?.(data);
  });

  socket.on("asteroid:mine", (data: { asteroidId: string; hp: number; hpMax: number }) => {
    listeners.onAsteroidMine?.(data);
  });

  socket.on("asteroid:destroy", (data: { asteroidId: string; playerId: number; ore: { resourceId: string; qty: number } }) => {
    listeners.onAsteroidDestroy?.(data);
  });

  socket.on("asteroid:respawn", (asteroid: ServerAsteroid) => {
    listeners.onAsteroidRespawn?.(asteroid);
  });

  socket.on("boss:warn", () => {
    listeners.onBossWarn?.();
  });


  socket.on("instance:joined", (data: any) => {
    onInstanceJoined?.(data);
  });

  socket.on("instance:left", (data: any) => {
    onInstanceLeft?.(data);
  });

  socket.on("instance:state", (data: any) => {
    onInstanceState?.(data);
  });

  socket.on("instance:event", (data: any) => {
    onInstanceEvent?.(data);
  });

  socket.on("instance:complete", (data: any) => {
    onInstanceComplete?.(data);
  });

  socket.on("instance:enemy-hit-ack", (data: any) => {
    onInstanceEnemyHitAck?.(data);
  });

  socket.on("npc:spawn", (npc: ServerNpc) => {
    listeners.onNpcSpawn?.(npc);
  });

  socket.on("npc:die", (data: { npcId: string }) => {
    listeners.onNpcDie?.(data);
  });

  let _projectileCount = 0;

  socket.on("projectile:spawn", (event: ProjectileSpawnEvent) => {
    _projectileCount++;
    if (_debugSocket() && _projectileCount % 20 === 0) {
      console.log("[socket] projectile:spawn #" + _projectileCount, {
        weaponKind: event.weaponKind,
        fromPlayer: event.fromPlayer,
        homing: event.homing,
      });
    }
    listeners.onProjectileSpawn?.(event);
  });

  socket.on("laser:fire", (event: LaserFireEvent) => {
    listeners.onLaserFire?.(event);
  });

  socket.on("rocket:fire", (event: RocketFireEvent) => {
    listeners.onRocketFire?.(event);
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function setSocketListeners(l: Partial<SocketEvents>) {
  listeners = l;
}

// ── Outgoing events ──────────────────────────────────────────────────────

let _inputSeq = 0;

export function sendInput(data: {
  targetX: number | null;
  targetY: number | null;
  firing: boolean;
  rocketFiring: boolean;
  attackTargetId: string | null;
  pvpTargetId?: string | null;
  miningTargetId: string | null;
  laserAmmo: string;
  rocketAmmo: string;
  /** WASD mode: heading (rad) the ship should face regardless of movement;
   *  null/undefined = classic (nose follows movement/target). */
  aimAngle?: number | null;
}): number {
  const seq = ++_inputSeq;
  if (typeof data.targetX === "number" && Number.isFinite(data.targetX) && typeof data.targetY === "number" && Number.isFinite(data.targetY)) {
    socket?.emit("input:move", {
      x: data.targetX,
      y: data.targetY,
    });
  }
  socket?.emit("input:aim", { angle: typeof data.aimAngle === "number" && Number.isFinite(data.aimAngle) ? data.aimAngle : null });
  socket?.emit("input:attack", {
    enemyId: data.attackTargetId,
    pvpTargetId: data.pvpTargetId ?? null,
    laser: data.firing,
    rocket: data.rocketFiring,
    laserAmmo: data.laserAmmo,
    rocketAmmo: data.rocketAmmo,
  });
  socket?.emit("input:mine", {
    asteroidId: data.miningTargetId,
  });
  return seq;
}

export function sendWarp(toZone: string, x: number, y: number) {
  socket?.emit("warp", { toZone, x, y });
}

export function sendAttack(targetPlayerId: number, damage: number, weaponKind: string) {
  socket?.emit("attack", { targetPlayerId, damage, weaponKind });
}

export function sendChat(channel: string, text: string) {
  socket?.emit("chat", { channel, text });
}

export function sendStatsUpdate(data: {
  hull?: number; shield?: number; level?: number; shipClass?: string; honor?: number;
  inventory?: any[]; equipped?: any; skills?: any; drones?: any[]; faction?: string;
  petDrone?: any; bebcell?: number; mcoins?: number;
}) {
  socket?.emit("stats:update", data);
}

export function sendDockEnter() {
  socket?.emit("dock:enter");
}

export function sendDockLeave() {
  socket?.emit("dock:leave");
}

export function sendDockRepair(hull: number, shield: number) {
  socket?.emit("dock:repair", { hull, shield });
}

/** Server-authoritative pet-drone level-up request. The server validates the
 *  bebcell cost against its own balance/table and replies with the actual
 *  resulting petDrone + bebcell — the caller must apply THOSE, not assume the
 *  request succeeded just because it was sent. Resolves to an error result
 *  (never rejects) if the socket is disconnected or the server says no. */
export function sendDroneUpgrade(): Promise<{ ok: boolean; error?: string; petDrone?: any; bebcell?: number }> {
  return new Promise((resolve) => {
    if (!socket) { resolve({ ok: false, error: "Not connected" }); return; }
    socket.emit("drone:upgrade", {}, (res: { ok: boolean; error?: string; petDrone?: any; bebcell?: number }) => {
      resolve(res ?? { ok: false, error: "No response" });
    });
  });
}

export function sendInstanceEnter(dungeonId: string) {
  socket?.emit("instance:enter", { dungeonId });
}

export function sendInstanceLeave() {
  socket?.emit("instance:leave");
}

export function sendInstanceEnemyHit(enemyId: string, damage: number, crit: boolean) {
  socket?.emit("instance:enemy-hit", { enemyId, damage, crit });
}

export function setInstanceCallbacks(cbs: {
  onJoined?: (data: any) => void;
  onLeft?: (data: any) => void;
  onState?: (data: any) => void;
  onEvent?: (data: any) => void;
  onComplete?: (data: any) => void;
  onEnemyHitAck?: (data: any) => void;
}) {
  onInstanceJoined = cbs.onJoined ?? null;
  onInstanceLeft = cbs.onLeft ?? null;
  onInstanceState = cbs.onState ?? null;
  onInstanceEvent = cbs.onEvent ?? null;
  onInstanceComplete = cbs.onComplete ?? null;
  onInstanceEnemyHitAck = cbs.onEnemyHitAck ?? null;
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}

export function getInputSeq(): number {
  return _inputSeq;
}


// ── ADMIN ───────────────────────────────────────────────────────────
export function adminListPlayers(cb: (data: any) => void) {
  socket?.emit("admin:list", {}, cb);
}

export function adminGetPlayer(playerId: number, cb: (data: any) => void) {
  socket?.emit("admin:get", { playerId }, cb);
}

export function adminUpdatePlayer(playerId: number, updates: any, cb: (data: any) => void) {
  socket?.emit("admin:update", { playerId, updates }, cb);
}

// Spawn `count` enemies of `type` into the admin's current zone (server picks
// the zone from the admin's player, so it can't be spoofed). Broadcast to all.
export function adminSpawnEnemy(type: string, count: number, cb: (data: any) => void) {
  socket?.emit("admin:spawnEnemy", { type, count }, cb);
}
// Console/benchmark hook — server enforces admin auth, this only exposes the emit.
if (typeof window !== "undefined") (window as any).__ADMIN_SPAWN = adminSpawnEnemy;
