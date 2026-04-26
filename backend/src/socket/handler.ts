import { Server, Socket } from "socket.io";
import { verifyToken, TokenPayload } from "../middleware/auth.js";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import {
  OnlinePlayer, PlayerInput,
  addPlayer, removePlayer, movePlayerToZone,
  getPlayersInZone, getPlayer, getOnlineCount, getAllZones,
} from "./state.js";
import { GameEngine, computeStats, TICK_RATE, type GameEvent } from "../game/engine.js";

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

    // Cache player data and compute stats
    const playerData = {
      shipClass: dbPlayer.shipClass,
      inventory: dbPlayer.inventory,
      equipped: dbPlayer.equipped,
      skills: dbPlayer.skills,
      drones: dbPlayer.drones,
      faction: dbPlayer.faction,
      level: dbPlayer.level,
    };
    engine.cachePlayerData(dbPlayer.id, playerData);
    const stats = computeStats(playerData);

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
      hull: dbPlayer.hull > 0 ? dbPlayer.hull : stats.hullMax,
      hullMax: stats.hullMax,
      shield: dbPlayer.shield > 0 ? dbPlayer.shield : stats.shieldMax,
      shieldMax: stats.shieldMax,
      honor: dbPlayer.honor,
      speed: stats.speed,
      shieldRegen: stats.shieldRegen,
      damage: stats.damage,
      fireRate: stats.fireRate,
      critChance: stats.critChance,
      damageReduction: stats.damageReduction,
      shieldAbsorb: stats.shieldAbsorb,
      aoeRadius: stats.aoeRadius,
      lootBonus: stats.lootBonus,

      targetX: null,
      targetY: null,
      inputQueue: [],
      lastProcessedInput: 0,

      isLaserFiring: false,
      isRocketFiring: false,
      attackTargetId: null,
      miningTargetId: null,
      laserAmmoType: "x1",
      rocketAmmoType: "cl1",
      laserFireCd: 0,
      rocketFireCd: 0,

      version: 1,
      visibleEntityVersions: new Map(),

      afterburnUntil: 0,
      lastHitTick: 0,
    };

    socket.join(`zone:${online.zone}`);
    addPlayer(online);

    // Send welcome with server config (for client prediction)
    socket.emit("welcome", {
      playerId: online.playerId,
      tickRate: TICK_RATE,
      friction: 0.96,
      frictionRefFps: 60,
    });

    // Send initial zone state
    socket.emit("zone:enemies", engine.getZoneEnemies(online.zone));
    socket.emit("zone:asteroids", engine.getZoneAsteroids(online.zone));
    socket.emit("zone:npcs", engine.getZoneNpcs(online.zone));

    socket.to(`zone:${online.zone}`).emit("player:join", {
      id: online.playerId, name: online.name,
      shipClass: online.shipClass, level: online.level,
      faction: online.faction, zone: online.zone,
    });
    io.emit("online:count", getOnlineCount());

    // ── INPUT (unified: movement + combat + mining) ───────────────────
    socket.on("input", (data: PlayerInput) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.inputQueue.push({
        seq: Number(data.seq) || 0,
        targetX: data.targetX != null ? clamp(data.targetX, -8000, 8000) : null,
        targetY: data.targetY != null ? clamp(data.targetY, -8000, 8000) : null,
        firing: Boolean(data.firing),
        rocketFiring: Boolean(data.rocketFiring),
        attackTargetId: data.attackTargetId || null,
        miningTargetId: data.miningTargetId || null,
        laserAmmo: data.laserAmmo || "x1",
        rocketAmmo: data.rocketAmmo || "cl1",
      });
    });

    // ── ZONE WARP ─────────────────────────────────────────────────────
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
      p.attackTargetId = null;
      p.isLaserFiring = false;
      p.isRocketFiring = false;
      p.miningTargetId = null;
      p.visibleEntityVersions.clear();

      socket.join(`zone:${data.toZone}`);
      socket.emit("zone:enemies", engine.getZoneEnemies(data.toZone));
      socket.emit("zone:asteroids", engine.getZoneAsteroids(data.toZone));
      socket.emit("zone:npcs", engine.getZoneNpcs(data.toZone));
      socket.to(`zone:${data.toZone}`).emit("player:join", {
        id: p.playerId, name: p.name,
        shipClass: p.shipClass, level: p.level,
        faction: p.faction, zone: data.toZone,
      });
    });

    // ── CHAT ──────────────────────────────────────────────────────────
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

    // ── STATS UPDATE (equipment/skill changes) ────────────────────────
    socket.on("stats:update", (data: {
      hull?: number; shield?: number; level?: number;
      shipClass?: string; honor?: number;
      inventory?: any[]; equipped?: any; skills?: any;
      drones?: any[]; faction?: string;
    }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;

      if (data.hull != null) p.hull = data.hull;
      if (data.shield != null) p.shield = data.shield;
      if (data.level != null) p.level = data.level;
      if (data.shipClass) p.shipClass = data.shipClass;
      if (data.honor != null) p.honor = data.honor;

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

      // Recompute stats
      const newStats = computeStats(cached || data);
      p.speed = newStats.speed;
      p.hullMax = newStats.hullMax;
      p.shieldMax = newStats.shieldMax;
      p.shieldRegen = newStats.shieldRegen;
      p.damage = newStats.damage;
      p.fireRate = newStats.fireRate;
      p.critChance = newStats.critChance;
      p.damageReduction = newStats.damageReduction;
      p.shieldAbsorb = newStats.shieldAbsorb;
      p.aoeRadius = newStats.aoeRadius;
      p.lootBonus = newStats.lootBonus;
    });

    // ��─ PVP COMBAT (visual broadcast) ─────────────────────────────────
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

    // ── DISCONNECT ────────────────────────────────────────────────────
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

  // ── SERVER TICK ───────────────────────────────────────────────────────
  setInterval(() => {
    const dt = 1 / TICK_RATE;
    const result = engine.tick(dt, (zone: string) => getPlayersInZone(zone));

    // Broadcast game events (enemy:hit, enemy:die, etc.)
    broadcastEvents(io, result.events);

    // Send deltas to individual players
    for (const [playerId, delta] of result.deltas) {
      const p = getPlayer(playerId);
      if (!p) continue;
      const sock = io.sockets.sockets.get(p.socketId);
      sock?.emit("delta", delta);
    }

    // Send snapshots to individual players
    for (const [playerId, snapshot] of result.snapshots) {
      const p = getPlayer(playerId);
      if (!p) continue;
      const sock = io.sockets.sockets.get(p.socketId);
      sock?.emit("snapshot", snapshot);
    }
  }, 1000 / TICK_RATE);
}

// ── EVENT BROADCASTING ──────────────────────────────────────────────────

function broadcastEvents(io: Server, events: GameEvent[]): void {
  for (const ev of events) {
    switch (ev.type) {
      case "enemy:spawn":
        io.to(`zone:${ev.zone}`).emit("enemy:spawn", ev.enemy);
        break;
      case "enemy:die":
        io.to(`zone:${ev.zone}`).emit("enemy:die", {
          enemyId: ev.enemyId, killerId: ev.killerId,
          loot: ev.loot, pos: ev.pos,
        });
        break;
      case "enemy:hit":
        io.to(`zone:${ev.zone}`).emit("enemy:hit", {
          enemyId: ev.enemyId, damage: ev.damage,
          hp: ev.hp, hpMax: ev.hpMax, crit: ev.crit,
          attackerId: ev.attackerId,
        });
        break;
      case "enemy:attack":
        io.to(`zone:${ev.zone}`).emit("enemy:attack", {
          enemyId: ev.enemyId, targetId: ev.targetId,
          damage: ev.damage, pos: ev.pos, targetPos: ev.targetPos,
        });
        break;
      case "player:damage": {
        const p = getPlayer(ev.playerId);
        if (p) {
          const sock = io.sockets.sockets.get(p.socketId);
          sock?.emit("player:hit", { damage: ev.damage, hp: p.hull, shield: p.shield });
        }
        break;
      }
      case "asteroid:mine":
        io.to(`zone:${ev.zone}`).emit("asteroid:mine", {
          asteroidId: ev.asteroidId, hp: ev.hp, hpMax: ev.hpMax,
        });
        break;
      case "asteroid:destroy":
        io.to(`zone:${ev.zone}`).emit("asteroid:destroy", {
          asteroidId: ev.asteroidId, playerId: ev.playerId, ore: ev.ore,
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
      case "laser:fire":
        io.to(`zone:${ev.zone}`).emit("laser:fire", {
          attackerId: ev.attackerId, targetId: ev.targetId,
          damage: ev.damage, crit: ev.crit,
        });
        break;
      case "rocket:fire":
        io.to(`zone:${ev.zone}`).emit("rocket:fire", {
          attackerId: ev.attackerId, targetId: ev.targetId,
          damage: ev.damage, crit: ev.crit,
          pos: ev.pos, targetPos: ev.targetPos,
        });
        break;
    }
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
