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
import { GameEngine, computeStats, registerEngine, type GameEvent } from "../game/engine.js";
import { sanitizeInventory } from "../game/lootService.js";
import { spendCurrency } from "../game/currency.js";
import { playerFields, coerceUpdates } from "../admin/fields.js";
import { MOVEMENT, PET_DRONE_UPGRADE_COST } from "../../../lib/game-constants.js";

const CULL_RADIUS = 2000;
const FIXED_DT = 1 / MOVEMENT.SERVER_TICK_RATE;

export function setupSocket(io: Server) {
  const engine = new GameEngine();
  registerEngine(engine);
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

  const activeSockets = new Map<number, Socket>();

  io.on("connection", async (socket: Socket) => {
    const user: TokenPayload = (socket as any).user;
    console.log(`[IO] ${user.username} connected (player ${user.playerId})`);

    // Kick old session if same player connects again
    const oldSocket = activeSockets.get(user.playerId);
    if (oldSocket && oldSocket.id !== socket.id) {
      console.log(`[IO] ${user.username} duplicate session — kicking old socket ${oldSocket.id}`);
      oldSocket.emit("kicked", { reason: "Another session connected" });
      oldSocket.disconnect(true);
    }
    activeSockets.set(user.playerId, socket);

    const [dbPlayer] = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, user.playerId))
      .limit(1);

    if (!dbPlayer) {
      socket.disconnect();
      return;
    }

    // Clan research (Clan Hall bonuses — see game/clanData.ts) is looked up
    // once here and cached alongside the rest of playerData so computeStats
    // and the loot/kill event handlers (engine.ts) can read it synchronously
    // without a DB round trip per kill. Refreshed on join/leave/research-fund
    // via refreshClanResearchCache below.
    let clanResearch: any = null;
    if (dbPlayer.clanId) {
      const [clanRow] = await db.select({ research: schema.clans.research }).from(schema.clans).where(eq(schema.clans.id, dbPlayer.clanId)).limit(1);
      clanResearch = clanRow?.research ?? null;
    }

    // Cache player data for stat computation
    const playerData = {
      shipClass: dbPlayer.shipClass,
      inventory: dbPlayer.inventory,
      equipped: dbPlayer.equipped,
      skills: dbPlayer.skills,
      drones: dbPlayer.drones,
      petDrone: dbPlayer.petDrone,
      bebcell: dbPlayer.bebcell,
      faction: dbPlayer.faction,
      level: dbPlayer.level,
      clanResearch,
      leaderboardAllTimeBuff: dbPlayer.leaderboardAllTimeBuff,
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
      aimAngle: null,
      speed: stats.speed,
      isLaserFiring: false,
      isRocketFiring: false,
      attackTargetId: null,
      pvpTargetId: null,
      laserAmmoType: "x1",
      rocketAmmoType: "cl1",
      laserFireCd: 0,
      rocketFireCd: 0,
      droneFireCd: 0,
      miningTargetId: null,
      lastHitTick: 0,
      shieldRegen: stats.shieldRegen,
      afterburnUntil: 0,
      isDocked: false,
      drones: (Array.isArray(dbPlayer.drones) ? dbPlayer.drones : []).map((d: any) => ({
        id: String(d.id),
        kind: String(d.kind),
        hp: Number(d.hp ?? d.hpMax ?? 100),
      })),
      nextMuzzlePair: 0,
    };

    socket.join(`zone:${online.zone}`);
    addPlayer(online);

    socket.emit("welcome", {
      playerId: dbPlayer.id,
      // Staff flag, so the client can show/hide admin affordances. This is a
      // CONVENIENCE ONLY — every admin socket handler re-checks the database
      // itself, so a tampered client gains nothing by faking it.
      // `?? false` because the column may not exist yet on databases that have
      // not run the is_admin migration; the admin handlers re-check anyway and
      // fail closed, so defaulting to "not staff" is the safe direction.
      isAdmin: dbPlayer.isAdmin ?? false,
      tickRate: MOVEMENT.SERVER_TICK_RATE,
      friction: MOVEMENT.FRICTION_PER_60FPS_FRAME,
      frictionRefFps: 60,
    });

    socket.to(`zone:${online.zone}`).emit("player:join", toClientPlayer(online, engine.playerDataCache.get(online.playerId)?.equipped ?? null));
    io.emit("online:count", getOnlineCount());

    // Send initial zone asteroids (static, not in per-tick state)
    socket.emit("zone:asteroids", engine.getZoneAsteroids(online.zone));
    socket.emit("zone:enemies", engine.getZoneEnemies(online.zone));
    socket.emit("zone:npcs", engine.getZoneNpcs(online.zone));

    // ── PING: round-trip latency probe for the client's SYSTEM readout
    // (Settings panel). Pure echo — no state read/written — client measures
    // Date.now() - sentAt itself once the ack fires.
    socket.on("ping", (sentAt: number, cb?: (t: number) => void) => {
      cb?.(sentAt);
    });

    // ── INPUT: MOVE (click target) ────────────────────────────────
    socket.on("input:move", (data: { x: number; y: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.targetX = clamp(data.x, -8000, 8000);
      p.targetY = clamp(data.y, -8000, 8000);
    });

    // ── INPUT: AIM (WASD scheme — cursor owns the heading) ─────────
    socket.on("input:aim", (data: { angle: number | null }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.aimAngle = typeof data?.angle === "number" && Number.isFinite(data.angle) ? data.angle : null;
    });

    // ── INPUT: ATTACK (start/stop firing) ─────────────────────────
    socket.on("input:attack", (data: { enemyId: string | null; pvpTargetId?: string | null; laser: boolean; rocket: boolean; laserAmmo: string; rocketAmmo: string }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      p.attackTargetId = data.enemyId;
      p.pvpTargetId = data.pvpTargetId ?? null;
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

      // Admin world-broadcast: same playerId===3 convention the client's
      // /admin command already uses. Lands the message in ALL FOUR
      // channels for EVERY connected client, unlike a normal "system"
      // send (which only reaches whoever is currently viewing that tab
      // client-side, since the client filters by channel). Not exposed
      // through the normal channel selector — only reachable via the
      // dedicated "broadcast" pseudo-channel from the client.
      if (data.channel === "broadcast") {
        if (user.playerId !== 3) return;
        for (const channel of ["local", "party", "clan", "system"]) {
          const msg = { from: "ADMIN", text: data.text, channel, time: Date.now() };
          io.emit("chat:message", msg);
          await db.insert(schema.chatMessages).values({
            channel, fromPlayerId: p.playerId, fromName: "ADMIN", text: data.text, zone: p.zone,
          }).catch(() => { });
        }
        return;
      }

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
      } else if (data.channel === "party" || data.channel === "clan") {
        // Not yet scoped to an actual party/clan roster — broadcast
        // zone-wide like "local" so messages sent on these tabs are at
        // least visible to someone, rather than silently vanishing.
        io.to(`zone:${p.zone}`).emit("chat:message", msg);
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
      console.log("[INSTANCE] " + online.name + " entering instance: " + data.dungeonId);
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
      
      console.log("[INSTANCE] " + online.name + " joined instance " + inst.id + " pos=" + online.posX + "," + online.posY);
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
      drones?: any[]; faction?: string; petDrone?: any;
    }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      // hull/shield are server-authoritative - don't accept client values
      p.level = data.level;
      p.shipClass = data.shipClass;
      // Honor is server-authoritative too, but only DOWNWARD: the friendly-fire
      // penalty (engine.ts, FRIENDLY_KILL_HONOR_PENALTY) is applied server-side,
      // and blindly taking the client's number here would let a traitor undo
      // their Outlaw brand on the next stats tick — the client still owns honor
      // GAINS from kills/missions, so accept a rise, never accept a fall back
      // to a value the server already reduced past.
      if (data.honor > p.honor) p.honor = data.honor;

      const cached = engine.playerDataCache.get(user.playerId);
      if (cached) {
        if (data.shipClass) cached.shipClass = data.shipClass;
        if (data.inventory) {
          cached.inventory = data.inventory;
          // async loot guard: strip forged rolled items from the combat cache
          sanitizeInventory(user.playerId, data.inventory).then((clean) => {
            if (clean.length !== (data.inventory?.length ?? 0)) {
              const c = engine.playerDataCache.get(user.playerId);
              if (c) { c.inventory = clean; engine.refreshPlayerStats(user.playerId); }
            }
          }).catch(() => {});
        }
        if (data.equipped) cached.equipped = data.equipped;
        if (data.skills) cached.skills = data.skills;
        if (data.drones) cached.drones = data.drones;
        // petDrone.level/hp/hpMax are server-authoritative (set only by
        // drone:upgrade above) — never accept them from the client here, or
        // a forged stats:update payload could grant free levels by writing
        // straight into the combat cache. Only equipped/mode (loadout
        // choices, not progression) pass through.
        if (data.petDrone && cached.petDrone) {
          cached.petDrone = {
            ...cached.petDrone,
            equipped: data.petDrone.equipped ?? cached.petDrone.equipped,
            mode: data.petDrone.mode ?? cached.petDrone.mode,
          };
          engine.refreshPlayerStats(user.playerId);
        }
        // bebcell is server-authoritative (currency.ts) — never accept it
        // from the client; the DB row is the only source of truth.
        if (data.faction) cached.faction = data.faction;
        if (data.level) cached.level = data.level;
      }
      if (data.drones) {
        p.drones = data.drones.map((d: any) => ({
          id: String(d.id),
          kind: String(d.kind),
          hp: Number(d.hp ?? d.hpMax ?? 100),
        }));
      }

      const newStats = engine.refreshPlayerStats(user.playerId) ?? computeStats(cached || data);
      const oldSpeed = p.speed;
      p.speed = newStats.speed;
      p.hullMax = newStats.hullMax;
      p.shieldMax = newStats.shieldMax;
      p.shieldRegen = newStats.shieldRegen;
      if (data.skills && Object.keys(data.skills).length > 0) {
        // console.log(`[STATS] ${user.username} skills updated: SPD ${Math.round(oldSpeed)}->${Math.round(p.speed)}, DMG ${Math.round(newStats.damage)}, RATE ${newStats.fireRate.toFixed(2)}, HUL ${Math.round(p.hullMax)}, SHD ${Math.round(p.shieldMax)}`);
      }
    });


    // ── PET DRONE UPGRADE (server-authoritative bebcell spend) ───────
    // Replaces the old client-side `state.player.bebcell -= cost` in
    // store.ts's upgradePetDrone(). The client now only REQUESTS an
    // upgrade; the server reads the player's current level + bebcell
    // balance straight from the DB, validates the cost against the
    // shared PET_DRONE_UPGRADE_COST table (never a client-sent cost),
    // and atomically spends + levels up in one transaction so a crash
    // mid-upgrade can never charge bebcell without granting the level
    // (or vice versa).
    socket.on("drone:upgrade", async (_data: unknown, cb?: (res: { ok: boolean; error?: string; petDrone?: any; bebcell?: number }) => void) => {
      try {
        const result = await db.transaction(async (tx) => {
          const [row] = await tx
            .select({ petDrone: schema.players.petDrone, bebcell: schema.players.bebcell })
            .from(schema.players)
            .where(eq(schema.players.id, user.playerId))
            .limit(1);
          if (!row) return { ok: false as const, error: "Player not found" };

          const pet = (row.petDrone ?? {}) as any;
          const level = Number(pet.level ?? 0);
          if (level >= 6) return { ok: false as const, error: "Drone already at max level" };
          const nextLevel = level + 1;
          const cost = PET_DRONE_UPGRADE_COST[nextLevel as 1 | 2 | 3 | 4 | 5 | 6];

          const newBebcell = await spendCurrency(user.playerId, "bebcell", cost, tx);
          if (newBebcell === null) {
            return { ok: false as const, error: `Need ${cost} Bebcell (have ${row.bebcell})`, bebcell: row.bebcell };
          }

          const newPet = {
            ...pet,
            level: nextLevel,
            hpMax: 400 + nextLevel * 200,
            hp: 400 + nextLevel * 200,
          };
          await tx
            .update(schema.players)
            .set({ petDrone: newPet })
            .where(eq(schema.players.id, user.playerId));

          return { ok: true as const, petDrone: newPet, bebcell: newBebcell };
        });

        if (result.ok) {
          // Keep the in-tick cache + live OnlinePlayer state consistent so
          // combat (server-side drone fire in engine.ts) sees the new level
          // immediately, without waiting for the next stats:update round trip.
          const cached = engine.playerDataCache.get(user.playerId);
          if (cached) { cached.petDrone = result.petDrone; engine.refreshPlayerStats(user.playerId); }
        }
        cb?.(result);
      } catch (err) {
        console.error("[drone:upgrade] error:", err);
        cb?.({ ok: false, error: "Upgrade failed" });
      }
    });

    // ── INVENTORY EXTRA PAGE (server-authoritative mcoins spend) ─────
    // Same shape as drone:upgrade: the client only requests the purchase;
    // the server reads the current flag + mcoins balance from the DB,
    // validates against the fixed cost, and spends + unlocks atomically.
    const INVENTORY_EXTRA_PAGE_COST = 750;
    socket.on("inventory:buyPage", async (_data: unknown, cb?: (res: { ok: boolean; error?: string; mcoins?: number; unlocked?: boolean }) => void) => {
      try {
        const result = await db.transaction(async (tx) => {
          const [row] = await tx
            .select({ inventoryExtraPage: schema.players.inventoryExtraPage, mcoins: schema.players.mcoins })
            .from(schema.players)
            .where(eq(schema.players.id, user.playerId))
            .limit(1);
          if (!row) return { ok: false as const, error: "Player not found" };
          if (row.inventoryExtraPage) return { ok: false as const, error: "Already unlocked", unlocked: true };

          const newMcoins = await spendCurrency(user.playerId, "mcoins", INVENTORY_EXTRA_PAGE_COST, tx);
          if (newMcoins === null) {
            return { ok: false as const, error: `Need ${INVENTORY_EXTRA_PAGE_COST} MC (have ${row.mcoins})`, mcoins: row.mcoins };
          }

          await tx
            .update(schema.players)
            .set({ inventoryExtraPage: true })
            .where(eq(schema.players.id, user.playerId));

          return { ok: true as const, mcoins: newMcoins, unlocked: true };
        });

        if (result.ok) {
          const cached = engine.playerDataCache.get(user.playerId);
          if (cached) (cached as any).inventoryExtraPage = true;
        }
        cb?.(result);
      } catch (err) {
        console.error("[inventory:buyPage] error:", err);
        cb?.({ ok: false, error: "Purchase failed" });
      }
    });

    // ── ADMIN PANEL ─────────────────────────────────────────────────
    // Staff status comes from players.is_admin, never from a hardcoded id.
    // The previous `playerId === 3` gate meant admin was a property of one
    // row number: it could not be granted, could not be revoked, and silently
    // followed whoever happened to occupy id 3.
    //
    // Checked against the database on every call rather than cached at
    // connect time, so revoking admin takes effect immediately instead of
    // lasting until that socket happens to reconnect.
    const requireAdmin = async (cb?: Function): Promise<boolean> => {
      try {
        const [row] = await db
          .select({ isAdmin: schema.players.isAdmin })
          .from(schema.players)
          .where(eq(schema.players.id, user.playerId))
          .limit(1);
        if (!row?.isAdmin) { cb?.({ error: 'Unauthorized' }); return false; }
        return true;
      } catch {
        // Fail CLOSED: a database hiccup must not hand out admin access.
        cb?.({ error: 'Authorization check failed' });
        return false;
      }
    };

    socket.on('admin:list', async (_data: any, cb: Function) => {
      if (!(await requireAdmin(cb))) return;
      try {
        const rows = await db.select({
          id: schema.players.id,
          name: schema.players.name,
          level: schema.players.level,
          credits: schema.players.credits,
          shipClass: schema.players.shipClass,
          honor: schema.players.honor,
        }).from(schema.players).orderBy(schema.players.id);
        cb?.({ players: rows });
      } catch (e) { cb?.({ error: 'DB error' }); }
    });

    socket.on('admin:get', async (data: { playerId: number }, cb: Function) => {
      if (!(await requireAdmin(cb))) return;
      try {
        const [p] = await db.select().from(schema.players)
          .where(eq(schema.players.id, data.playerId)).limit(1);
        if (!p) { cb?.({ error: 'Not found' }); return; }
        // The WHOLE row, not a curated subset. The old version hand-listed
        // ~19 of the 55 columns, so anything outside that list was invisible
        // to the console and therefore uneditable — the opposite of what an
        // admin console is for. Dates are sent as ISO strings so they survive
        // the socket's JSON encoding intact.
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
          out[k] = v instanceof Date ? v.toISOString() : v;
        }
        cb?.({ player: out });
      } catch (e) { cb?.({ error: 'DB error' }); }
    });

    // Column metadata for the console's editor: which fields exist, what type
    // each is, which are protected and why. Sent from the server so the UI is
    // built from the same source of truth the write path validates against —
    // a client-side copy would drift and start offering fields that fail.
    socket.on('admin:fields', async (_data: any, cb: Function) => {
      if (!(await requireAdmin(cb))) return;
      try {
        cb?.({ fields: playerFields() });
      } catch (e: any) {
        cb?.({ error: e?.message ?? 'Field metadata unavailable' });
      }
    });

    // Grant/revoke staff. Deliberately SEPARATE from admin:update, which
    // refuses isAdmin outright: promoting an account is not the same kind of
    // action as editing credits and should not ride along in a bulk field
    // save that an admin might not read closely.
    socket.on('admin:setAdmin', async (data: { playerId: number; isAdmin: boolean }, cb: Function) => {
      if (!(await requireAdmin(cb))) return;
      try {
        const target = Number(data?.playerId);
        const grant = Boolean(data?.isAdmin);
        if (!Number.isInteger(target)) { cb?.({ error: 'Bad player id' }); return; }

        // Refuse self-revoke. An admin removing their own flag would have no
        // way to restore it through the UI, and if they are the last one the
        // server has no admins at all — recoverable only by hand-editing the
        // database.
        if (target === user.playerId && !grant) {
          cb?.({ error: 'Cannot revoke your own admin access' });
          return;
        }

        await db.update(schema.players)
          .set({ isAdmin: grant })
          .where(eq(schema.players.id, target));

        const [row] = await db
          .select({ id: schema.players.id, name: schema.players.name, isAdmin: schema.players.isAdmin })
          .from(schema.players).where(eq(schema.players.id, target)).limit(1);
        if (!row) { cb?.({ error: 'Not found' }); return; }

        console.log(`[admin] ${user.username} (${user.playerId}) set is_admin=${grant} on ${row.name} (${target})`);
        cb?.({ ok: true, player: row });
      } catch (e) { cb?.({ error: 'DB error' }); }
    });

    socket.on('admin:update', async (data: { playerId: number; updates: any }, cb: Function) => {
      if (!(await requireAdmin(cb))) return;
      try {
        // Generic write path. The previous version hand-listed 18 assignments
        // per column and then repeated them for the in-memory copy, so every
        // new field needed edits in two places and anything not listed was
        // simply unwritable. Now the whitelist, the type coercion and the
        // protection rules all come from the schema-derived registry in
        // admin/fields.ts, which cannot fall behind the table.
        let setObj: Record<string, unknown>;
        try {
          setObj = coerceUpdates(data?.updates ?? {});
        } catch (e: any) {
          // Field-level problems are the admin's typo, not a server fault —
          // report them verbatim so the console can point at the field.
          cb?.({ error: e?.message ?? 'Invalid field' });
          return;
        }

        await db.update(schema.players).set(setObj as any)
          .where(eq(schema.players.id, data.playerId));

        // Mirror into the live in-memory player so the change is visible
        // without a relog. Only the fields OnlinePlayer actually carries are
        // copied; the rest live in the engine's cache, refreshed below.
        const online = getPlayer(data.playerId);
        if (online) {
          const LIVE_KEYS = [
            'level', 'shipClass', 'honor', 'hull', 'shield', 'zone', 'faction',
            'credits', 'exp', 'skillPoints', 'skills', 'ownedShips',
            'inventory', 'equipped', 'drones', 'consumables',
          ] as const;
          for (const k of LIVE_KEYS) {
            if (k in setObj) (online as any)[k] = setObj[k];
          }
          if ('honor' in setObj) {
            // Push the new honor to every client in the zone. Without this an
            // admin DEMOTION silently reverts: the target's client still holds
            // the old (higher) honor and sends it on the next stats:update,
            // which the handler accepts because it only refuses decreases —
            // a raise back to the stale value passes straight through.
            io.to(`zone:${online.zone}`).emit("player:honor", {
              playerId: data.playerId, honor: setObj.honor,
            });
          }
          // Anything that feeds computeStats (ship, gear, skills, drones,
          // faction, level) must invalidate the engine's cached stat block,
          // or an admin can hand someone a better ship and their speed and
          // damage stay on the old values until they reconnect.
          const STAT_KEYS = [
            'shipClass', 'inventory', 'equipped', 'skills', 'drones',
            'petDrone', 'bebcell', 'faction', 'level',
          ];
          if (STAT_KEYS.some((k) => k in setObj)) {
            const cached = engine.playerDataCache.get(data.playerId);
            if (cached) {
              for (const k of STAT_KEYS) {
                if (k in setObj) (cached as any)[k] = setObj[k];
              }
              engine.refreshPlayerStats(data.playerId);
            }
          }
        }

        console.log('[ADMIN] ' + user.username + ' updated player ' + data.playerId + ': ' + Object.keys(setObj).join(', '));
        // Force-sync target player's client if they're online
        const targetSocket = activeSockets.get(data.playerId);
        if (targetSocket) {
          targetSocket.emit('admin:sync', setObj);
        }
        cb?.({ ok: true, applied: Object.keys(setObj) });
      } catch (e) { cb?.({ error: 'DB error: ' + (e as Error).message }); }
    });

    // Admin: spawn N enemies of a type into the admin's current zone, near the
    // admin, and broadcast enemy:spawn to EVERYONE in that zone (same pipeline
    // as the auto-spawner). Server uses player.zone authoritatively.
    // async because requireAdmin now checks the database instead of comparing
    // against a hardcoded id.
    socket.on('admin:spawnEnemy', async (data: { type: string; count?: number }, cb: Function) => {
      if (!(await requireAdmin(cb))) return;
      try {
        const p = getPlayer(user.playerId);
        if (!p) { cb?.({ error: 'Player not online' }); return; }
        const zone = p.zone;
        const near = { x: p.posX, y: p.posY };
        const count = Math.min(Math.max(1, Math.floor(data.count ?? 1)), 50);
        let spawned = 0;
        for (let i = 0; i < count; i++) {
          const ce = engine.spawnEnemyOfType(zone, data.type, near);
          if (ce) { io.to(`zone:${zone}`).emit('enemy:spawn', ce); spawned++; }
        }
        if (spawned === 0) { cb?.({ error: 'Unknown type or zone' }); return; }
        console.log(`[ADMIN] ${user.username} spawned ${spawned}x ${data.type} in ${zone}`);
        cb?.({ ok: true, spawned });
      } catch (e) { cb?.({ error: 'Spawn error: ' + (e as Error).message }); }
    });

    // ── DISCONNECT ──────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[IO] ${user.username} disconnected`);
      if (activeSockets.get(user.playerId)?.id === socket.id) {
        activeSockets.delete(user.playerId);
      }
      instanceMgr.removePlayer(user.playerId);
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

  // ── tick-duration instrumentation (perf task): logs engine-vs-broadcast
  // cost + entity counts every 10s so server load at 100+ NPCs is measurable
  // from `pm2 logs`. Pure measurement, no behavior change.
  let _perfEngAcc = 0, _perfEngMax = 0, _perfAllAcc = 0, _perfAllMax = 0, _perfN = 0;

  const runTick = () => {
    const _t0 = performance.now();
    let _tEng = 0;
    try {
      const events = engine.tick(FIXED_DT, (zone: string) => getPlayersInZone(zone).filter(p => !instanceMgr.isInInstance(p.playerId)));
      _tEng = performance.now() - _t0;
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
        if (tickCounter % 100 === 0) console.log('[INSTANCE] tick inst=' + instId + ' players=' + instPlayers.length + ' enemies=' + inst.enemies.size);
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
          if (tickCounter % 3 === 0) {
            sock.emit("instance:state", {
              wave: inst.wave,
              totalWaves: inst.totalWaves,
              enemies: instanceMgr.serializeEnemies(inst),
              completed: inst.completed,
            });
          }
        }

        if (result.allCleared) {
          console.log("[INSTANCE] ALL CLEARED inst=" + instId + " wave=" + inst.wave + "/" + inst.totalWaves + " enemies=" + inst.enemies.size);
          // Instance complete - notify players and clean up mappings
          for (const p of instPlayers) {
            const ret = instanceMgr.removePlayer(p.playerId);
            if (ret) {
              p.posX = ret.x;
              p.posY = ret.y;
              p.velX = 0;
              p.velY = 0;
              p.targetX = null;
              p.targetY = null;
            }
            const sock = io.sockets.sockets.get(p.socketId);
            if (sock) sock.emit("instance:complete", { dungeonId: inst.dungeonId });
          }
          instanceMgr.instances.delete(instId);
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
                laserAmmoType: other.laserAmmoType,
                rocketAmmoType: other.rocketAmmoType,
              });
            }
          }

          const sock = io.sockets.sockets.get(p.socketId);
          if (!sock) continue;

          // Build current entity list
          const entities: any[] = [];
          for (const o of nearbyPlayers) {
            const oCached = engine.playerDataCache.get(o.id);
            const oOnline = getPlayer(o.id);
            entities.push({
              id: `p-${o.id}`, entityType: "player",
              x: o.x, y: o.y, vx: o.vx, vy: o.vy, angle: o.a,
              hp: o.hp, hpMax: o.hpMax, shield: o.sp,
              shieldMax: oOnline?.shieldMax ?? o.hpMax,
              version: tickCounter,
              name: o.name, shipClass: o.shipClass, level: o.level, faction: o.faction, honor: o.honor, miningTargetId: o.miningTargetId,
              activeAmmoType: o.laserAmmoType,
              activeRocketAmmoType: o.rocketAmmoType,
              // Pass the same reference each tick so the change-detector's
              // reference-equality check doesn't false-positive on stable state.
              equipped: oCached?.equipped ?? null,
              drones: oOnline?.drones,
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
                // Physical changes.
                const dx = entity.x - prev.x;
                const dy = entity.y - prev.y;
                const moved = dx * dx + dy * dy > 0.5;
                const healthChanged = entity.hp !== prev.hp || entity.shield !== prev.shield || entity.shieldMax !== prev.shieldMax || entity.hpMax !== prev.hpMax;
                const angleChanged = Math.abs(entity.angle - prev.angle) > 0.02;

                // Visual-only changes must also trigger a delta so remote clients
                // observe faction/name/ship/ammo/loadout/drone changes without
                // waiting for the next 1s snapshot.
                let visualChanged = false;
                if (entity.entityType === "player") {
                  visualChanged =
                    entity.name !== prev.name ||
                    entity.shipClass !== prev.shipClass ||
                    entity.faction !== prev.faction ||
                    entity.level !== prev.level ||
                    entity.honor !== prev.honor ||
                    entity.miningTargetId !== prev.miningTargetId ||
                    entity.activeAmmoType !== prev.activeAmmoType ||
                    entity.activeRocketAmmoType !== prev.activeRocketAmmoType ||
                    entity.equipped !== prev.equipped ||
                    entity.drones !== prev.drones;
                }

                if (moved || healthChanged || angleChanged || visualChanged) {
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

    {
      const _tAll = performance.now() - _t0;
      _perfEngAcc += _tEng; if (_tEng > _perfEngMax) _perfEngMax = _tEng;
      _perfAllAcc += _tAll; if (_tAll > _perfAllMax) _perfAllMax = _tAll;
      if (++_perfN >= 300) {
        let _enemies = 0;
        for (const zs of engine.zones.values()) _enemies += zs.enemies.size;
        console.log(
          `[perf] tick avg ${(_perfAllAcc / _perfN).toFixed(2)}ms max ${_perfAllMax.toFixed(1)}ms ` +
          `(engine avg ${(_perfEngAcc / _perfN).toFixed(2)}ms max ${_perfEngMax.toFixed(1)}ms) ` +
          `enemies ${_enemies} players ${io.engine?.clientsCount ?? "?"}`
        );
        _perfEngAcc = _perfEngMax = _perfAllAcc = _perfAllMax = 0; _perfN = 0;
      }
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
          enemyType: ev.enemyType,
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
          // Victim: authoritative HP update (drives their own hit VFX + death).
          const sock = io.sockets.sockets.get(p.socketId);
          sock?.emit("player:hit", { damage: ev.damage, hp: p.hull, shield: p.shield });
        }
        // Everyone else in the zone: spark/flash the victim's remote ship so
        // the attacker and bystanders actually SEE the hit land.
        io.to(`zone:${ev.zone}`).emit("player:hit:remote", {
          playerId: ev.playerId, damage: ev.damage, pos: ev.pos, killerId: ev.killerId,
        });
        break;
      }
      case "player:die": {
        // Zone-wide so every client plays the death explosion at the death
        // point (the victim respawns server-side; getCulledState re-syncs pos).
        io.to(`zone:${ev.zone}`).emit("player:die", {
          playerId: ev.playerId, pos: ev.pos, killerId: ev.killerId,
        });
        break;
      }
      case "player:honor": {
        // Server-side honor correction (currently: the friendly-fire penalty).
        // Zone-wide, not just to the offender: everyone's OtherPlayer.honor
        // needs to update too, since that is what drives the Outlaw badge and
        // the "attackable by anyone" colouring on remote pilots.
        io.to(`zone:${ev.zone}`).emit("player:honor", {
          playerId: ev.playerId, honor: ev.honor,
        });
        // Persist immediately. Honor normally rides along on the client's
        // stats:update, but that path now refuses decreases, so a penalty that
        // is not written here would vanish on reconnect.
        db.update(schema.players).set({ honor: ev.honor })
          .where(eq(schema.players.id, ev.playerId))
          .catch((e) => console.error("[honor] persist failed", e));
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
              fromPlayerId: ev.fromPlayerId,
              ammoType: ev.ammoType,
              ttl: ev.ttl,
              hardpointIndex: ev.hardpointIndex,
              hardpointRing: ev.hardpointRing,
              shipClass: ev.shipClass,
              targetId: ev.targetId,
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

function toClientPlayer(p: OnlinePlayer, equipped: any = null) {
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
    activeAmmoType: p.laserAmmoType,
    activeRocketAmmoType: p.rocketAmmoType,
    equipped,
    drones: p.drones,
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
