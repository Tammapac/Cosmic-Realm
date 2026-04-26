import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

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
};

export type TickData = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  hp: number;
  sp: number;
};

export type EnemyTickData = {
  id: string; x: number; y: number;
  vx: number; vy: number; a: number;
  hp: number; hpMax: number;
  type: string; size: number; color: string;
  isBoss?: boolean; bossPhase?: number;
  aggro: boolean;
};

export type NpcTickData = {
  id: string; x: number; y: number;
  vx: number; vy: number; a: number;
  hp: number; hpMax: number;
  state: string; color: string; size: number;
  name: string;
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

export type ZoneTickPayload = {
  players: TickData[];
  enemies: EnemyTickData[];
  npcs: NpcTickData[];
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
  loot: { credits: number; exp: number; honor: number; resource?: { resourceId: string; qty: number } };
  pos: { x: number; y: number };
};

export type EnemyAttackEvent = {
  enemyId: string;
  targetId: number;
  damage: number;
  pos: { x: number; y: number };
  targetPos: { x: number; y: number };
};

type SocketEvents = {
  onPlayersInZone: (players: RemotePlayer[]) => void;
  onPlayerJoin: (player: RemotePlayer) => void;
  onPlayerLeave: (data: { playerId: number }) => void;
  onZoneTick: (payload: ZoneTickPayload) => void;
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
  onAsteroidMine: (data: { asteroidId: string; hp: number; hpMax: number }) => void;
  onAsteroidDestroy: (data: { asteroidId: string; playerId: number; ore: { resourceId: string; qty: number } }) => void;
  onAsteroidRespawn: (asteroid: ServerAsteroid) => void;
  onBossWarn: () => void;
  onNpcSpawn: (npc: ServerNpc) => void;
  onNpcDie: (data: { npcId: string }) => void;
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

  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket!.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  socket.on("zone:players", (players: RemotePlayer[]) => {
    listeners.onPlayersInZone?.(players);
  });

  socket.on("player:join", (player: RemotePlayer) => {
    listeners.onPlayerJoin?.(player);
  });

  socket.on("player:leave", (data: { playerId: number }) => {
    listeners.onPlayerLeave?.(data);
  });

  socket.on("zone:tick", (payload: ZoneTickPayload) => {
    listeners.onZoneTick?.(payload);
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

  // Server-authoritative game events
  socket.on("zone:enemies", (enemies: ServerEnemy[]) => {
    listeners.onZoneEnemies?.(enemies);
  });

  socket.on("zone:asteroids", (asteroids: ServerAsteroid[]) => {
    listeners.onZoneAsteroids?.(asteroids);
  });

  socket.on("zone:npcs", (npcs: ServerNpc[]) => {
    listeners.onZoneNpcs?.(npcs);
  });

  socket.on("enemy:spawn", (enemy: ServerEnemy) => {
    listeners.onEnemySpawn?.(enemy);
  });

  socket.on("enemy:die", (event: EnemyDieEvent) => {
    listeners.onEnemyDie?.(event);
  });

  socket.on("enemy:hit", (event: EnemyHitEvent) => {
    listeners.onEnemyHit?.(event);
  });

  socket.on("enemy:attack", (event: EnemyAttackEvent) => {
    listeners.onEnemyAttack?.(event);
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

  socket.on("npc:spawn", (npc: ServerNpc) => {
    listeners.onNpcSpawn?.(npc);
  });

  socket.on("npc:die", (data: { npcId: string }) => {
    listeners.onNpcDie?.(data);
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function setSocketListeners(l: Partial<SocketEvents>) {
  listeners = l;
}

// ── Outgoing events ───────────────────────────────────────────────────

export function sendPosition(x: number, y: number, vx: number, vy: number, angle: number) {
  socket?.emit("position", { x, y, vx, vy, angle });
}

export function sendMove(x: number, y: number) {
  socket?.emit("move", { x, y });
}

export function sendWarp(toZone: string, x: number, y: number) {
  socket?.emit("warp", { toZone, x, y });
}

export function sendAttack(targetPlayerId: number, damage: number, weaponKind: string) {
  socket?.emit("attack", { targetPlayerId, damage, weaponKind });
}

export function sendAttackEnemy(enemyId: string, weaponKind: "laser" | "rocket", ammoType: string) {
  socket?.emit("attack:enemy", { enemyId, weaponKind, ammoType });
}

export function sendMine(asteroidId: string) {
  socket?.emit("mine", { asteroidId });
}

export function sendChat(channel: string, text: string) {
  socket?.emit("chat", { channel, text });
}

export function sendStatsUpdate(data: {
  hull: number; shield: number; level: number; shipClass: string; honor: number;
  inventory?: any[]; equipped?: any; skills?: any; drones?: any[]; faction?: string;
}) {
  socket?.emit("stats:update", data);
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}
