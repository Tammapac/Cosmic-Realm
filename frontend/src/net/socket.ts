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

export type CombatEvent = {
  attackerId: number;
  targetId: number;
  weaponKind: string;
  damage: number;
};

type SocketEvents = {
  onPlayersInZone: (players: RemotePlayer[]) => void;
  onPlayerJoin: (player: RemotePlayer) => void;
  onPlayerLeave: (data: { playerId: number }) => void;
  onZoneTick: (positions: TickData[]) => void;
  onCombatAttack: (event: CombatEvent) => void;
  onChatMessage: (msg: { from: string; text: string; channel: string; time: number }) => void;
  onOnlineCount: (count: number) => void;
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

  socket.on("zone:tick", (positions: TickData[]) => {
    listeners.onZoneTick?.(positions);
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

export function sendChat(channel: string, text: string) {
  socket?.emit("chat", { channel, text });
}

export function sendStatsUpdate(hull: number, shield: number, level: number, shipClass: string, honor: number) {
  socket?.emit("stats:update", { hull, shield, level, shipClass, honor });
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}
