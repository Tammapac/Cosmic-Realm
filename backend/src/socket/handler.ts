import { Server, Socket } from "socket.io";
import { DUNGEONS } from "../game/data.js";
import { InstanceManager } from "../game/instance.js";
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
import { GameEngine, computeStats, type GameEvent } from "../game/engine.js";
import { MOVEMENT } from "../../../lib/game-constants.js";

const CULL_RADIUS = 2000;
const FIXED_DT = 1 / MOVEMENT.SERVER_TICK_RATE;

export function setupSocket(io: Server) {
  const engine = new GameEngine();
  const instanceMgr = new InstanceManager();

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

    // Cache player data for stat computation
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
      hull: dbPlayer.hull > 0 ? Math.min(dbPlayer.hull, stats.hullMax) : stats.hullMax,
      hullMax: stats.hullMax,
      shield: dbPlayer.shield,
      shieldMax: stats.shieldMax,
      honor: dbPlayer.honor,
      targetX: null,
      targetY: null,
      speed: stats.speed,
      isLaserFiring: false,
      isRocketFiring: false,
      attackTargetId: null,
      laserAmmoType: "x1",
      rocketAmmoType: "cl1",
      laserFireCd: 0,
      rocketFireCd: 0,
      miningTargetId: null,
      lastHitTick: 0,
      shieldRegen: stats.shieldRegen,
      afterburnUntil: 0,
      isDocked: false,
    };

    socket.join(`zone:${online.zone}`);
    addPlayer(online);

    socket.emit("welcome", {
      playerId: dbPlayer.id,
      tickRate: MOVEMENT.SERVER_TICK_RATE,
      friction: MOVEMENT.FRICTION_PER_60FPS_FRAME,
      frictionRefFps: 60,
    });

    socket.to(`zone:${online.zone}`).emit("player:join", toClientPlayer(online));
    io.emit("online:count", getOnlineCount());

    // Send initial zone asteroids (static, not in per-tick state)
    socket.emit("zone:asteroids", engine.getZoneAsteroids(online.zone));
    socket.emit("zone:enemies", engine.getZoneEnemies(online.zone));
    socket.emit("zone:npcs", engine.getZoneNpcs(online.zone));

    // ── INPUT: MOVE (click target) ────────────────────────────────
    socket.on("input:move", (data: { x: number; y: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.targetX = clamp(data.x, -8000, 8000);
      p.targetY = clamp(data.y, -8000, 8000);
    });

    // ── INPUT: ATTACK (start/stop firing) ─────────────────────────
    socket.on("input:attack", (data: { enemyId: string | null; laser: boolean; rocket: boolean; laserAmmo: string; rocketAmmo: string }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.attackTargetId = data.enemyId;
      p.isLaserFiring = data.laser;
      p.isRocketFiring = data.rocket;
      if (data.laserAmmo) p.laserAmmoType = data.laserAmmo;
      if (data.rocketAmmo) p.rocketAmmoType = data.rocketAmmo;
    });

    // ── INPUT: MINE (start/stop mining) ───────────────────────────
    socket.on("input:mine", (data: { asteroidId: string | null }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.miningTargetId = data.asteroidId;
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
      p.attackTargetId = null;
      p.isLaserFiring = false;
      p.isRocketFiring = false;
      p.miningTargetId = null;

      socket.join(`zone:${data.toZone}`);
      socket.to(`zone:${data.toZone}`).emit("player:join", toClientPlayer(p));

      // Send asteroids for new zone
      socket.emit("zone:asteroids", engine.getZoneAsteroids(data.toZone));
      socket.emit("zone:enemies", engine.getZoneEnemies(data.toZone));
      socket.emit("zone:npcs", engine.getZoneNpcs(data.toZone));
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
      }).catch(() => { });
    });

    // ── STATS UPDATE (syncs player data for engine computation) ─────
    socket.on("dock:enter", () => { console.log("[DOCK] " + (online?.name ?? "?") + " docked");
      if (!online) return;
      online.isDocked = true;
      online.velX = 0;
      online.velY = 0;
    });

    socket.on("dock:leave", () => { console.log("[DOCK] " + (online?.name ?? "?") + " undocked");
      if (!online) return;
      online.isDocked = false;
    });

    socket.on("instance:enter", (data: { dungeonId: string }) => {
      if (!online) return;
      const def = DUNGEONS[data.dungeonId as keyof typeof DUNGEONS];
      if (!def) return;
      if (instanceMgr.isInInstance(online.playerId)) return;
      
      const inst = instanceMgr.createInstance("rift", data.dungeonId, {
        waves: def.waves,
        enemiesPerWave: def.enemiesPerWave,
        enemyTypes: def.enemyTypes,
        enemyHpMul: def.enemyHpMul,
        enemyDmgMul: def.enemyDmgMul,
        color: def.color,
        name: def.name,
      });
      
      instanceMgr.addPlayer(inst.id, online.playerId, online.zone, online.posX, online.posY);
      online.posX = 0;
      online.posY = 0;
      online.velX = 0;
      online.velY = 0;
      online.targetX = null;
      online.targetY = null;
      
      socket.emit("instance:joined", {
        instanceId: inst.id,
        dungeonId: data.dungeonId,
        wave: 1,
        totalWaves: def.waves,
        name: def.name,
        color: def.color,
      });
    });

    socket.on("instance:leave", () => {
      if (!online) return;
      const ret = instanceMgr.removePlayer(online.playerId);
      if (ret) {
        online.posX = ret.x;
        online.posY = ret.y;
        online.velX = 0;
        online.velY = 0;
        online.targetX = null;
        online.targetY = null;
        socket.emit("instance:left", { zone: ret.zone, x: ret.x, y: ret.y });
      }
    });

    socket.on("instance:enemy-hit", (data: { enemyId: string; damage: number; crit: boolean }) => {
      if (!online) return;
      const inst = instanceMgr.getPlayerInstance(online.playerId);
      if (!inst) return;
      const enemy = inst.enemies.get(data.enemyId);
      if (!enemy || enemy.hull <= 0) return;
      enemy.hull -= data.damage;
      const killed = enemy.hull <= 0;
      socket.emit("instance:enemy-hit-ack", {
        enemyId: data.enemyId,
        hp: Math.max(0, enemy.hull),
        hpMax: enemy.hullMax,
        damage: data.damage,
        crit: data.crit,
        killed,
        loot: killed ? enemy.loot : null,
        exp: killed ? enemy.exp : 0,
        credits: killed ? enemy.credits : 0,
        honor: killed ? enemy.honor : 0,
      });
    });


    socket.on("dock:repair", (data: { hull: number; shield: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      if (data.hull > 0) p.hull = Math.min(data.hull, p.hullMax);
      if (data.shield >= 0) p.shield = Math.min(data.shield, p.shieldMax);
    });

    socket.on("stats:update", (data: {
      hull: number; shield: number; level: number;
      shipClass: string; honor: number;
      inventory?: any[]; equipped?: any; skills?: any;
      drones?: any[]; faction?: string;
    }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      // hull/shield are server-authoritative - don't accept client values
      p.level = data.level;
      p.shipClass = data.shipClass;
      p.honor = data.honor;

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

      const newStats = engine.refreshPlayerStats(user.playerId) ?? computeStats(cached || data);
      const oldSpeed = p.speed;
      p.speed = newStats.speed;
      p.hullMax = newStats.hullMax;
      p.shieldMax = newStats.shieldMax;
      p.shieldRegen = newStats.shieldRegen;
      if (data.skills && Object.keys(data.skills).length > 0) {
        console.log(`[STATS] ${user.username} skills updated: SPD ${Math.round(oldSpeed)}->${Math.round(p.speed)}, DMG ${Math.round(newStats.damage)}, RATE ${newStats.fireRate.toFixed(2)}, HUL ${Math.round(p.hullMax)}, SHD ${Math.round(p.shieldMax)}`);
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
      playerPreviousEntities.delete(user.playerId); // Clean up entity tracking
    });
  });

  const TICK_MS = 1000 / MOVEMENT.SERVER_TICK_RATE;
  const CULL_RADIUS_SQ = CULL_RADIUS * CULL_RADIUS;
  let nextTickAt = Date.now() + TICK_MS;
  let tickCounter = 0;

  // Delta/Snapshot system: track previous entity state per player
  type EntitySnapshot = { id: string; x: number; y: number; vx: number; vy: number; version: number; [key: string]: any };
  const playerPreviousEntities = new Map<number, Map<string, EntitySnapshot>>();

  const runTick = () => {
    try {
      const events = engine.tick(FIXED_DT, (zone: string) => getPlayersInZone(zone).filter(p => !instanceMgr.isInInstance(p.playerId)));
      broadcastEvents(io, events);

      // Tick all active instances
      for (const [instId, inst] of instanceMgr.instances) {
        const instPlayers: OnlinePlayer[] = [];
        for (const pid of inst.playerIds) {
          const p = getPlayer(pid);
          if (p) instPlayers.push(p);
        }
        if (instPlayers.length === 0) {
          instanceMgr.instances.delete(instId);
          continue;
        }
        // Process movement for instanced players
        const stopDistSq = 8 * 8;
        const snapDistSq = 2 * 2;
        for (const p of instPlayers) {
          if (p.targetX !== null && p.targetY !== null) {
            const dx = p.targetX - p.posX;
            const dy = p.targetY - p.posY;
            const distSq = dx * dx + dy * dy;
            if (distSq <= stopDistSq) {
              if (distSq <= snapDistSq) { p.posX = p.targetX; p.posY = p.targetY; }
              p.targetX = null; p.targetY = null; p.velX = 0; p.velY = 0;
            } else {
              const d = Math.sqrt(distSq);
              const ang = Math.atan2(dy, dx);
              if (d > 40) p.angle = ang;
              p.velX += Math.cos(ang) * 500 * FIXED_DT;
              p.velY += Math.sin(ang) * 500 * FIXED_DT;
            }
          }
          const v = Math.sqrt(p.velX * p.velX + p.velY * p.velY);
          if (v > p.speed) { p.velX = (p.velX / v) * p.speed; p.velY = (p.velY / v) * p.speed; }
          p.velX *= 0.94; p.velY *= 0.94;
          p.posX += p.velX * FIXED_DT;
          p.posY += p.velY * FIXED_DT;
          if (p.velX * p.velX + p.velY * p.velY < 1) { p.velX = 0; p.velY = 0; }
        }

        const result = instanceMgr.tickInstance(inst, instPlayers, FIXED_DT);

        // Broadcast instance events and state to players
        for (const p of instPlayers) {
          const sock = io.sockets.sockets.get(p.socketId);
          if (!sock) continue;
          for (const ev of result.events) {
            sock.emit("instance:event", ev);
          }
          // Send self position so client can move
          sock.emit("delta", {
            tick: tickCounter,
            self: {
              x: p.posX, y: p.posY, vx: p.velX, vy: p.velY, angle: p.angle,
              hull: p.hull, hullMax: p.hullMax,
              shield: p.shield, shieldMax: p.shieldMax,
              lastProcessedInput: 0,
            },
            addOrUpdate: [],
            removals: [],
          });
          sock.emit("instance:state", {
            wave: inst.wave,
            totalWaves: inst.totalWaves,
            enemies: instanceMgr.serializeEnemies(inst),
            completed: inst.completed,
          });
        }

        if (result.allCleared) {
          // Instance complete - notify players
          for (const p of instPlayers) {
            const sock = io.sockets.sockets.get(p.socketId);
            if (sock) sock.emit("instance:complete", { dungeonId: inst.dungeonId });
          }
        }
      }
      tickCounter++;

      for (const [, playersMap] of getAllZones()) {
        if (playersMap.size === 0) continue;
        const playersArr = Array.from(playersMap.values());

        for (const p of playersArr) {
          if (instanceMgr.isInInstance(p.playerId)) continue;
          const culled = engine.getCulledStateForPlayer(p);

          const nearbyPlayers: any[] = [];
          for (const other of playersArr) {
            if (other.playerId === p.playerId) continue;
            if (other.isDocked) continue;
            if (instanceMgr.isInInstance(other.playerId)) continue;
            const dx = p.posX - other.posX;
            const dy = p.posY - other.posY;
            if (dx * dx + dy * dy < CULL_RADIUS_SQ) {
              nearbyPlayers.push({
                id: other.playerId,
                name: other.name,
                shipClass: other.shipClass,
                level: other.level,
                faction: other.faction,
                honor: other.honor,
                miningTargetId: other.miningTargetId,
                x: other.posX, y: other.posY,
                vx: other.velX, vy: other.velY,
                a: other.angle,
                hp: other.hull, hpMax: other.hullMax, sp: other.shield,
              });
            }
          }

          const sock = io.sockets.sockets.get(p.socketId);
          if (!sock) continue;

          // Build current entity list
          const entities: any[] = [];
          for (const o of nearbyPlayers) {
            entities.push({
              id: `p-${o.id}`, entityType: "player",
              x: o.x, y: o.y, vx: o.vx, vy: o.vy, angle: o.a,
              hp: o.hp, hpMax: o.hpMax, shield: o.sp, version: tickCounter,
              name: o.name, shipClass: o.shipClass, level: o.level, faction: o.faction, honor: o.honor, miningTargetId: o.miningTargetId,
            });
          }
          for (const e of culled.enemies as any[]) {
            entities.push({
              id: e.id, entityType: "enemy",
              x: e.x, y: e.y, vx: e.vx, vy: e.vy, angle: e.a,
              hp: e.hp, hpMax: e.hpMax, version: tickCounter,
              type: e.type, behavior: e.behavior, name: e.name,
              damage: e.damage, speed: e.speed, color: e.color, size: e.size,
              isBoss: e.isBoss, bossPhase: e.bossPhase,
            });
          }
          for (const n of culled.npcs as any[]) {
            entities.push({
              id: n.id, entityType: "npc",
              x: n.x, y: n.y, vx: n.vx, vy: n.vy, angle: n.a,
              hp: n.hp, hpMax: n.hpMax, version: tickCounter,
              name: n.name, color: n.color, size: n.size, state: n.state,
            });
          }

          const selfData = {
            id: p.playerId,
            x: culled.self.x, y: culled.self.y,
            vx: culled.self.vx, vy: culled.self.vy,
            hp: culled.self.hp, hpMax: culled.self.hpMax,
            shield: culled.self.sp, shieldMax: culled.self.spMax,
            lastProcessedInput: 0,
          };

          // Send full snapshot every 30 ticks (1 per second), otherwise send delta
          const shouldSendSnapshot = tickCounter % 30 === 0;

          if (shouldSendSnapshot) {
            // Full snapshot for resync
            sock.emit("snapshot", {
              tick: tickCounter,
              self: selfData,
              entities,
            });

            // Store current state for next delta
            const entityMap = new Map<string, EntitySnapshot>();
            for (const e of entities) {
              entityMap.set(e.id, e);
            }
            playerPreviousEntities.set(p.playerId, entityMap);
          } else {
            // Delta: send only changes
            const previous = playerPreviousEntities.get(p.playerId) || new Map();
            const currentIds = new Set<string>();
            const addOrUpdate: EntitySnapshot[] = [];
            const removals: string[] = [];

            // Check for added/updated entities
            for (const entity of entities) {
              currentIds.add(entity.id);
              const prev = previous.get(entity.id);

              if (!prev) {
                // New entity
                addOrUpdate.push(entity);
              } else {
                // Check if entity changed (position moved >1 unit or health changed)
                const dx = entity.x - prev.x;
                const dy = entity.y - prev.y;
                const moved = dx * dx + dy * dy > 0.5;
                const healthChanged = entity.hp !== prev.hp || entity.shield !== prev.shield;
                const angleChanged = Math.abs(entity.angle - prev.angle) > 0.02;

                if (moved || healthChanged || angleChanged) {
                  addOrUpdate.push(entity);
                }
              }
            }

            // Check for removed entities
            for (const prevId of previous.keys()) {
              if (!currentIds.has(prevId)) {
                removals.push(prevId);
              }
            }

            // ALWAYS send delta (includes self position even if no entity changes)
            sock.emit("delta", {
              tick: tickCounter,
              self: selfData,
              addOrUpdate,
              removals,
            });

            // Update stored state
            const entityMap = new Map<string, EntitySnapshot>();
            for (const e of entities) {
              entityMap.set(e.id, e);
            }
            playerPreviousEntities.set(p.playerId, entityMap);
          }
        }
      }
    } catch (err) {
      console.error("[tick] error:", err);
    }

    nextTickAt += TICK_MS;
    const now = Date.now();
    let delay = nextTickAt - now;
    if (delay < -TICK_MS * 5) {
      nextTickAt = now + TICK_MS;
      delay = TICK_MS;
    } else if (delay < 0) {
      delay = 0;
    }
    setTimeout(runTick, delay);
  };
  setTimeout(runTick, TICK_MS);
}

// ── EVENT BROADCASTING ─────────────────────────────────────────────────

function broadcastEvents(io: Server, events: GameEvent[]): void {
  for (const ev of events) {
    switch (ev.type) {
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
      case "player:hit": {
        const p = getPlayer(ev.playerId);
        if (p) {
          const sock = io.sockets.sockets.get(p.socketId);
          sock?.emit("player:hit", { damage: ev.damage, hp: p.hull, shield: p.shield });
        }
        break;
      }
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
      case "boss:warn":
        io.to(`zone:${ev.zone}`).emit("boss:warn");
        break;
      case "enemy:spawn":
        io.to(`zone:${ev.zone}`).emit("enemy:spawn", ev.enemy);
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
      case "asteroid:respawn":
        io.to(`zone:${ev.zone}`).emit("asteroid:respawn", ev.asteroid);
        break;
      case "npc:spawn":
        io.to(`zone:${ev.zone}`).emit("npc:spawn", ev.npc);
        break;
      case "npc:die":
        io.to(`zone:${ev.zone}`).emit("npc:die", { npcId: ev.npcId });
        break;
      case "projectile:spawn": {
        const source = getPlayer(ev.fromPlayerId);
        if (source) {
          const sock = io.sockets.sockets.get(source.socketId);
          if (sock) {
            sock.to(`zone:${ev.zone}`).emit("projectile:spawn", {
              x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy,
              damage: ev.damage, color: ev.color, size: ev.size,
              crit: ev.crit, weaponKind: ev.weaponKind, homing: ev.homing,
              fromPlayer: true,
            });
          }
        } else {
          // NPC or system projectile (no associated player)
          const isNpc = ev.fromPlayerId === 0;
          io.to(`zone:${ev.zone}`).emit("projectile:spawn", {
            x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy,
            damage: ev.damage, color: ev.color, size: ev.size,
            crit: ev.crit, weaponKind: ev.weaponKind, homing: ev.homing,
            fromPlayer: isNpc,
            fromNpc: isNpc,
          });
        }
        break;
      }
      default:
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
