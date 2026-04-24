import { Server, Socket } from "socket.io";
import { verifyToken, TokenPayload } from "../middleware/auth.js";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import {
  OnlinePlayer,
  addPlayer,
  removePlayer,
  movePlayerToZone,
  getPlayersInZone,
  getPlayer,
  getOnlineCount,
  getAllZones,
} from "./state.js";

const TICK_RATE = 20; // 20 Hz server tick (DarkOrbit uses ~10-20 Hz)
const SAVE_INTERVAL = 30_000; // auto-save every 30s

export function setupSocket(io: Server) {
  // Auth middleware - verify JWT before allowing connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const payload = verifyToken(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const user: TokenPayload = (socket as any).user;
    console.log(`[IO] ${user.username} connected (player ${user.playerId})`);

    // Load player data from DB
    const [dbPlayer] = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, user.playerId))
      .limit(1);

    if (!dbPlayer) {
      socket.disconnect();
      return;
    }

    const online: OnlinePlayer = {
      socketId: socket.id,
      playerId: dbPlayer.id,
      name: dbPlayer.name,
      shipClass: dbPlayer.shipClass,
      level: dbPlayer.level,
      faction: dbPlayer.faction,
      clan: null,
      zone: dbPlayer.zone,
      posX: dbPlayer.posX,
      posY: dbPlayer.posY,
      velX: 0,
      velY: 0,
      angle: 0,
      hull: dbPlayer.hull,
      hullMax: 100,
      shield: dbPlayer.shield,
      shieldMax: 70,
      honor: dbPlayer.honor,
      targetX: null,
      targetY: null,
    };

    // Join the zone room
    socket.join(`zone:${online.zone}`);
    addPlayer(online);

    // Tell the connecting player about everyone else in their zone
    const zonePlayers = getPlayersInZone(online.zone).filter(
      (p) => p.playerId !== online.playerId
    );
    socket.emit("zone:players", zonePlayers.map(toClientPlayer));

    // Tell everyone else in the zone about the new player
    socket.to(`zone:${online.zone}`).emit("player:join", toClientPlayer(online));

    // Send online count
    io.emit("online:count", getOnlineCount());

    // ── MOVEMENT (DarkOrbit click-to-move style) ────────────────────
    socket.on("move", (data: { x: number; y: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.targetX = clamp(data.x, -4000, 4000);
      p.targetY = clamp(data.y, -4000, 4000);
    });

    socket.on("position", (data: { x: number; y: number; vx: number; vy: number; angle: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.posX = clamp(data.x, -4000, 4000);
      p.posY = clamp(data.y, -4000, 4000);
      p.velX = data.vx;
      p.velY = data.vy;
      p.angle = data.angle;
    });

    // ── ZONE WARP ───────────────────────────────────────────────────
    socket.on("warp", (data: { toZone: string; x: number; y: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;

      const oldZone = p.zone;
      socket.leave(`zone:${oldZone}`);
      socket.to(`zone:${oldZone}`).emit("player:leave", { playerId: p.playerId });

      movePlayerToZone(p.playerId, oldZone, data.toZone);
      p.posX = data.x;
      p.posY = data.y;
      p.velX = 0;
      p.velY = 0;
      p.targetX = null;
      p.targetY = null;

      socket.join(`zone:${data.toZone}`);

      const newZonePlayers = getPlayersInZone(data.toZone).filter(
        (op) => op.playerId !== p.playerId
      );
      socket.emit("zone:players", newZonePlayers.map(toClientPlayer));
      socket.to(`zone:${data.toZone}`).emit("player:join", toClientPlayer(p));
    });

    // ── COMBAT (laser fire, damage) ─────────────────────────────────
    socket.on("attack", (data: { targetPlayerId: number; damage: number; weaponKind: string }) => {
      const attacker = getPlayer(user.playerId);
      const target = getPlayer(data.targetPlayerId);
      if (!attacker || !target) return;
      if (attacker.zone !== target.zone) return;

      // Broadcast the attack visual to the zone
      io.to(`zone:${attacker.zone}`).emit("combat:attack", {
        attackerId: attacker.playerId,
        targetId: target.playerId,
        weaponKind: data.weaponKind,
        damage: data.damage,
      });
    });

    // ── CHAT ────────────────────────────────────────────────────────
    socket.on("chat", async (data: { channel: string; text: string }) => {
      if (!data.text || data.text.length > 200) return;
      const p = getPlayer(user.playerId);
      if (!p) return;

      const msg = {
        from: p.name,
        text: data.text,
        channel: data.channel,
        time: Date.now(),
      };

      if (data.channel === "local") {
        io.to(`zone:${p.zone}`).emit("chat:message", msg);
      } else if (data.channel === "system") {
        io.emit("chat:message", msg);
      }

      // Persist to DB
      await db.insert(schema.chatMessages).values({
        channel: data.channel,
        fromPlayerId: p.playerId,
        fromName: p.name,
        text: data.text,
        zone: p.zone,
      }).catch(() => {});
    });

    // ── STATS UPDATE (hull/shield changes from PvE) ─────────────────
    socket.on("stats:update", (data: { hull: number; shield: number; level: number; shipClass: string; honor: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.hull = data.hull;
      p.shield = data.shield;
      p.level = data.level;
      p.shipClass = data.shipClass;
      p.honor = data.honor;
    });

    // ── DISCONNECT ──────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[IO] ${user.username} disconnected`);
      const zone = removePlayer(user.playerId);
      if (zone) {
        socket.to(`zone:${zone}`).emit("player:leave", { playerId: user.playerId });
      }
      io.emit("online:count", getOnlineCount());
    });
  });

  // ── SERVER TICK: broadcast positions to all zones ─────────────────
  setInterval(() => {
    for (const [zoneId, players] of getAllZones()) {
      if (players.size === 0) continue;
      const positions = Array.from(players.values()).map((p) => ({
        id: p.playerId,
        x: p.posX,
        y: p.posY,
        vx: p.velX,
        vy: p.velY,
        a: p.angle,
        hp: p.hull,
        sp: p.shield,
      }));
      io.to(`zone:${zoneId}`).emit("zone:tick", positions);
    }
  }, 1000 / TICK_RATE);
}

function toClientPlayer(p: OnlinePlayer) {
  return {
    id: p.playerId,
    name: p.name,
    shipClass: p.shipClass,
    level: p.level,
    faction: p.faction,
    clan: p.clan,
    zone: p.zone,
    x: p.posX,
    y: p.posY,
    vx: p.velX,
    vy: p.velY,
    angle: p.angle,
    hull: p.hull,
    hullMax: p.hullMax,
    shield: p.shield,
    shieldMax: p.shieldMax,
    honor: p.honor,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

