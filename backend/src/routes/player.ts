import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { sanitizeInventory } from "../game/lootService.js";

const router = Router();
router.use(authMiddleware);

router.get("/me", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const [player] = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, playerId))
      .limit(1);

    if (!player) {
      res.status(404).json({ error: "Player not found" });
      return;
    }

    res.json({ player: toClient(player) });
  } catch (err) {
    console.error("Get player error:", err);
    res.status(500).json({ error: "Failed to load player" });
  }
});

router.post("/save", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const data = req.body;

    // Server-authoritative loot guard: strip forged/duped/mutated rolled items
    const cleanInventory = await sanitizeInventory(playerId, data.inventory ?? []);
    const validIds = new Set(cleanInventory.map((i: any) => i.instanceId));
    const cleanEquipped = data.equipped && typeof data.equipped === "object"
      ? Object.fromEntries(
          Object.entries(data.equipped).map(([slot, arr]) => [
            slot,
            Array.isArray(arr) ? arr.map((id: any) => (id == null || validIds.has(id) ? id : null)) : arr,
          ])
        )
      : data.equipped;

    // bebcell/mcoins are server-authoritative currencies (mcoins is real-money)
    // and are deliberately NOT written from the client body here — see
    // backend/src/game/currency.ts. Whatever the client sent for these fields
    // is ignored; the DB value (mutated only via creditCurrency/spendCurrency,
    // or by an admin editing the DB directly) is the sole source of truth and
    // is echoed back in the response below so the client stays in sync.
    await db
      .update(schema.players)
      .set({
        shipClass: data.shipClass,
        level: data.level,
        exp: data.exp,
        credits: data.credits,
        honor: data.honor,
        hull: sanitizeFloat(data.hull),
        shield: sanitizeFloat(data.shield),
        zone: data.zone,
        posX: sanitizeFloat(data.pos?.x ?? 0),
        posY: sanitizeFloat(data.pos?.y ?? 0),
        faction: data.faction,
        skillPoints: data.skillPoints,
        skills: data.skills,
        ownedShips: data.ownedShips,
        inventory: cleanInventory,
        equipped: cleanEquipped,
        cargo: data.cargo,
        drones: data.drones,
        petDrone: data.petDrone,
        consumables: data.consumables,
        hotbar: data.hotbar,
        ammo: data.ammo,
        rocketAmmoType: data.rocketAmmoType,
        ammoByType: data.ammoByType,
        droneAmmo: data.droneAmmo,
        droneAmmoMax: data.droneAmmoMax,
        autoRestock: data.autoRestock,
        autoRepairHull: data.autoRepairHull,
        autoShieldRecharge: data.autoShieldRecharge,
        activeQuests: data.activeQuests,
        completedQuests: data.completedQuests,
        dailyMissions: data.dailyMissions,
        lastDailyReset: data.lastDailyReset,
        milestones: data.milestones,
        dungeonClears: data.dungeonClears,
        dungeonBestTimes: data.dungeonBestTimes,
        lastSeen: new Date(),
      })
      .where(eq(schema.players.id, playerId));

    await db
      .update(schema.leaderboard)
      .set({
        level: data.level,
        honor: data.honor,
        totalKills: data.milestones?.totalKills ?? 0,
        faction: data.faction,
        updatedAt: new Date(),
      })
      .where(eq(schema.leaderboard.playerId, playerId));

    // Echo the server-authoritative currency balances back so the client can
    // reconcile its display — this is the only path that keeps it in sync
    // now that bebcell/mcoins are never accepted from the save body.
    const [current] = await db
      .select({ bebcell: schema.players.bebcell, mcoins: schema.players.mcoins })
      .from(schema.players)
      .where(eq(schema.players.id, playerId))
      .limit(1);

    res.json({ ok: true, bebcell: current?.bebcell ?? 0, mcoins: current?.mcoins ?? 0 });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: "Save failed" });
  }
});

function sanitizeFloat(v: number): number {
  if (!isFinite(v) || Math.abs(v) < 1e-38) return 0;
  return v;
}

function toClient(p: any) {
  return {
    id: p.id,
    name: p.name,
    shipClass: p.shipClass,
    level: p.level,
    exp: p.exp,
    credits: p.credits,
    honor: p.honor,
    mcoins: p.mcoins,
    hull: p.hull,
    shield: p.shield,
    zone: p.zone,
    pos: { x: p.posX, y: p.posY },
    faction: p.faction,
    skillPoints: p.skillPoints,
    skills: p.skills,
    ownedShips: p.ownedShips,
    inventory: p.inventory,
    equipped: p.equipped,
    cargo: p.cargo,
    drones: p.drones,
    petDrone: p.petDrone,
    bebcell: p.bebcell,
    consumables: p.consumables,
    hotbar: p.hotbar,
    ammo: p.ammo,
    rocketAmmoType: p.rocketAmmoType,
    ammoByType: p.ammoByType,
    droneAmmo: p.droneAmmo,
    droneAmmoMax: p.droneAmmoMax,
    autoRestock: p.autoRestock,
    autoRepairHull: p.autoRepairHull,
    autoShieldRecharge: p.autoShieldRecharge,
    activeQuests: p.activeQuests,
    completedQuests: p.completedQuests,
    dailyMissions: p.dailyMissions,
    lastDailyReset: p.lastDailyReset,
    milestones: p.milestones,
    dungeonClears: p.dungeonClears,
    dungeonBestTimes: p.dungeonBestTimes,
    clan: null,
    party: [],
    vel: { x: 0, y: 0 },
    angle: 0,
    lastSeen: Date.now(),
  };
}

export default router;
