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
import { GameEngine, type GameEvent } from "../game/engine.js";

const TICK_RATE = 20;

export function setupSocket(io: Server) {
  const engine = new GameEngine();

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

    socket.join(`zone:${online.zone}`);
    addPlayer(online);

    // Cache player data for stat computation in engine
    engine.cachePlayerData(dbPlayer.id, {
      shipClass: dbPlayer.shipClass,
      inventory: dbPlayer.inventory,
      equipped: dbPlayer.equipped,
      skills: dbPlayer.skills,
      drones: dbPlayer.drones,
      faction: dbPlayer.faction,
      level: dbPlayer.level,
    });

    // Send zone state to new player
    const zonePlayers = getPlayersInZone(online.zone).filter(
      (p) => p.playerId !== online.playerId
    );
    socket.emit("zone:players", zonePlayers.map(toClientPlayer));
    socket.emit("zone:enemies", engine.getZoneEnemies(online.zone));
    socket.emit("zone:asteroids", engine.getZoneAsteroids(online.zone));
    socket.emit("zone:npcs", engine.getZoneNpcs(online.zone));

    socket.to(`zone:${online.zone}`).emit("player:join", toClientPlayer(online));
    io.emit("online:count", getOnlineCount());

    // ── MOVEMENT ────────────────────────────────────────────────────
    socket.on("move", (data: { x: number; y: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.targetX = clamp(data.x, -8000, 8000);
      p.targetY = clamp(data.y, -8000, 8000);
    });

    socket.on("position", (data: { x: number; y: number; vx: number; vy: number; angle: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.posX = clamp(data.x, -8000, 8000);
      p.posY = clamp(data.y, -8000, 8000);
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
      socket.emit("zone:enemies", engine.getZoneEnemies(data.toZone));
      socket.emit("zone:asteroids", engine.getZoneAsteroids(data.toZone));
      socket.emit("zone:npcs", engine.getZoneNpcs(data.toZone));
      socket.to(`zone:${data.toZone}`).emit("player:join", toClientPlayer(p));
    });

    // ── SERVER-AUTHORITATIVE COMBAT ─────────────────────────────────
    socket.on("attack:enemy", (data: { enemyId: string; weaponKind: "laser" | "rocket"; ammoType: string }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      const events = engine.playerAttackEnemy(p.playerId, data.enemyId, p.zone, data.weaponKind, data.ammoType);
      broadcastEvents(io, events);
    });

    // ── SERVER-AUTHORITATIVE MINING ─────────────────────────────────
    socket.on("mine", (data: { asteroidId: string }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      const events = engine.playerMine(p.playerId, data.asteroidId, p.zone, 1 / TICK_RATE);
      broadcastEvents(io, events);
    });

    // ── PVP COMBAT (visual broadcast for now) ───────────────────────
    socket.on("attack", (data: { targetPlayerId: number; damage: number; weaponKind: string }) => {
      const attacker = getPlayer(user.playerId);
      const target = getPlayer(data.targetPlayerId);
      if (!attacker || !target) return;
      if (attacker.zone !== target.zone) return;

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

      await db.insert(schema.chatMessages).values({
        channel: data.channel,
        fromPlayerId: p.playerId,
        fromName: p.name,
        text: data.text,
        zone: p.zone,
      }).catch(() => {});
    });

    // ── STATS UPDATE (syncs player data for engine computation) ─────
    socket.on("stats:update", (data: {
      hull: number; shield: number; level: number;
      shipClass: string; honor: number;
      inventory?: any[]; equipped?: any; skills?: any;
      drones?: any[]; faction?: string;
    }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.hull = data.hull;
      p.shield = data.shield;
      p.level = data.level;
      p.shipClass = data.shipClass;
      p.honor = data.honor;

      // Update engine cache for stat computation
      const cached = engine.playerDataCache.get(user.playerId);
      if (cached) {
        if (data.shipClass) cached.shipClass = data.shipClass;
        if (data.inventory) cached.inventory = data.inventory;
        if (data.equipped) cached.equipped = data.equipped;
        if (data.skills) cached.skills = data.skills;
        if (data.drones) cached.drones = data.drones;
        if (data.faction) cached.faction = data.faction;
        if (data.level) cached.level = data.level;
      }
    });

    // ── DISCONNECT ──────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[IO] ${user.username} disconnected`);
      engine.removePlayerData(user.playerId);
      const zone = removePlayer(user.playerId);
      if (zone) {
        socket.to(`zone:${zone}`).emit("player:leave", { playerId: user.playerId });
      }
      io.emit("online:count", getOnlineCount());
    });
  });

  // ── SERVER TICK ──────────────────────────────────────────────────────
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;

    // Run game engine tick
    const events = engine.tick(dt, (zone: string) => getPlayersInZone(zone));
    broadcastEvents(io, events);

    // Broadcast positions + enemy states per zone
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

      const enemies = engine.getZoneEnemyTick(zoneId);
      const npcs = engine.getZoneNpcTick(zoneId);

      io.to(`zone:${zoneId}`).emit("zone:tick", {
        players: positions,
        enemies,
        npcs,
      });
    }
  }, 1000 / TICK_RATE);
}

// ── EVENT BROADCASTING ─────────────────────────────────────────────────

function broadcastEvents(io: Server, events: GameEvent[]): void {
  for (const ev of events) {
    switch (ev.type) {
      case "enemy:spawn":
        io.to(`zone:${ev.zone}`).emit("enemy:spawn", ev.enemy);
        break;
      case "enemy:die":
        io.to(`zone:${ev.zone}`).emit("enemy:die", {
          enemyId: ev.enemyId,
          killerId: ev.killerId,
          loot: ev.loot,
          pos: ev.pos,
        });
        break;
      case "enemy:hit":
        io.to(`zone:${ev.zone}`).emit("enemy:hit", {
          enemyId: ev.enemyId,
          damage: ev.damage,
          hp: ev.hp,
          hpMax: ev.hpMax,
          crit: ev.crit,
          attackerId: ev.attackerId,
        });
        break;
      case "enemy:attack":
        io.to(`zone:${ev.zone}`).emit("enemy:attack", {
          enemyId: ev.enemyId,
          targetId: ev.targetId,
          damage: ev.damage,
          pos: ev.pos,
          targetPos: ev.targetPos,
        });
        break;
      case "player:damage":
        // Send directly to the affected player's socket
        break;
      case "asteroid:mine":
        io.to(`zone:${ev.zone}`).emit("asteroid:mine", {
          asteroidId: ev.asteroidId,
          hp: ev.hp,
          hpMax: ev.hpMax,
        });
        break;
      case "asteroid:destroy":
        io.to(`zone:${ev.zone}`).emit("asteroid:destroy", {
          asteroidId: ev.asteroidId,
          playerId: ev.playerId,
          ore: ev.ore,
        });
        break;
      case "asteroid:respawn":
        io.to(`zone:${ev.zone}`).emit("asteroid:respawn", ev.asteroid);
        break;
      case "boss:warn":
        io.to(`zone:${ev.zone}`).emit("boss:warn");
        break;
      case "npc:spawn":
        io.to(`zone:${ev.zone}`).emit("npc:spawn", ev.npc);
        break;
      case "npc:die":
        io.to(`zone:${ev.zone}`).emit("npc:die", { npcId: ev.npcId });
        break;
    }
  }
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
