import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

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

    await db
      .update(schema.players)
      .set({
        shipClass: data.shipClass,
        level: data.level,
        exp: data.exp,
        credits: data.credits,
        honor: data.honor,
        hull: data.hull,
        shield: data.shield,
        zone: data.zone,
        posX: data.pos?.x ?? 0,
        posY: data.pos?.y ?? 0,
        faction: data.faction,
        skillPoints: data.skillPoints,
        skills: data.skills,
        ownedShips: data.ownedShips,
        inventory: data.inventory,
        equipped: data.equipped,
        cargo: data.cargo,
        drones: data.drones,
        consumables: data.consumables,
        hotbar: data.hotbar,
        ammo: data.ammo,
        rocketAmmoType: data.rocketAmmoType,
        ammoByType: data.ammoByType,
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

    res.json({ ok: true });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: "Save failed" });
  }
});

function toClient(p: any) {
  return {
    id: p.id,
    name: p.name,
    shipClass: p.shipClass,
    level: p.level,
    exp: p.exp,
    credits: p.credits,
    honor: p.honor,
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
    consumables: p.consumables,
    hotbar: p.hotbar,
    ammo: p.ammo,
    rocketAmmoType: p.rocketAmmoType,
    ammoByType: p.ammoByType,
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
