import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";

const router = Router();

// Create clan
router.post("/create", async (req, res) => {
  try {
    const { name, tag } = req.body;
    const playerId = (req as any).user.playerId;

    if (!name || !tag) {
      res.status(400).json({ error: "Name and tag required" });
      return;
    }
    if (name.length < 3 || name.length > 24) {
      res.status(400).json({ error: "Clan name must be 3-24 characters" });
      return;
    }
    if (tag.length < 2 || tag.length > 6) {
      res.status(400).json({ error: "Clan tag must be 2-6 characters" });
      return;
    }

    const [player] = await db.select().from(schema.players)
      .where(eq(schema.players.id, playerId)).limit(1);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }
    if (player.clanId) { res.status(400).json({ error: "Already in a clan" }); return; }

    const existingName = await db.select().from(schema.clans)
      .where(eq(schema.clans.name, name)).limit(1);
    if (existingName.length > 0) { res.status(409).json({ error: "Clan name taken" }); return; }

    const existingTag = await db.select().from(schema.clans)
      .where(eq(schema.clans.tag, tag.toUpperCase())).limit(1);
    if (existingTag.length > 0) { res.status(409).json({ error: "Clan tag taken" }); return; }

    const [clan] = await db.insert(schema.clans).values({
      name,
      tag: tag.toUpperCase(),
      leaderId: playerId,
      faction: player.faction,
      memberCount: 1,
    }).returning();

    await db.update(schema.players)
      .set({ clanId: clan.id })
      .where(eq(schema.players.id, playerId));

    // Update leaderboard
    await db.update(schema.leaderboard)
      .set({ clanTag: clan.tag })
      .where(eq(schema.leaderboard.playerId, playerId))
      .catch(() => {});

    res.status(201).json({ clan: { id: clan.id, name: clan.name, tag: clan.tag, leaderId: clan.leaderId, memberCount: 1 } });
  } catch (err: any) {
    console.error("Clan create error:", err);
    res.status(500).json({ error: "Failed to create clan" });
  }
});

// Get clan info
router.get("/:id", async (req, res) => {
  try {
    const clanId = parseInt(req.params.id);
    if (isNaN(clanId)) { res.status(400).json({ error: "Invalid clan ID" }); return; }

    const [clan] = await db.select().from(schema.clans)
      .where(eq(schema.clans.id, clanId)).limit(1);
    if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }

    const members = await db.select({
      id: schema.players.id,
      name: schema.players.name,
      level: schema.players.level,
      honor: schema.players.honor,
      shipClass: schema.players.shipClass,
    }).from(schema.players).where(eq(schema.players.clanId, clanId));

    res.json({ clan: { ...clan, members } });
  } catch (err: any) {
    console.error("Clan get error:", err);
    res.status(500).json({ error: "Failed to get clan" });
  }
});

// Join clan
router.post("/:id/join", async (req, res) => {
  try {
    const clanId = parseInt(req.params.id);
    const playerId = (req as any).user.playerId;

    const [player] = await db.select().from(schema.players)
      .where(eq(schema.players.id, playerId)).limit(1);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }
    if (player.clanId) { res.status(400).json({ error: "Already in a clan" }); return; }

    const [clan] = await db.select().from(schema.clans)
      .where(eq(schema.clans.id, clanId)).limit(1);
    if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }

    await db.update(schema.players)
      .set({ clanId: clan.id })
      .where(eq(schema.players.id, playerId));

    await db.update(schema.clans)
      .set({ memberCount: clan.memberCount + 1 })
      .where(eq(schema.clans.id, clan.id));

    await db.update(schema.leaderboard)
      .set({ clanTag: clan.tag })
      .where(eq(schema.leaderboard.playerId, playerId))
      .catch(() => {});

    res.json({ message: "Joined clan", clan: { id: clan.id, name: clan.name, tag: clan.tag } });
  } catch (err: any) {
    console.error("Clan join error:", err);
    res.status(500).json({ error: "Failed to join clan" });
  }
});

// Leave clan
router.post("/leave", async (req, res) => {
  try {
    const playerId = (req as any).user.playerId;

    const [player] = await db.select().from(schema.players)
      .where(eq(schema.players.id, playerId)).limit(1);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }
    if (!player.clanId) { res.status(400).json({ error: "Not in a clan" }); return; }

    const [clan] = await db.select().from(schema.clans)
      .where(eq(schema.clans.id, player.clanId)).limit(1);
    if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }

    if (clan.leaderId === playerId) {
      // Leader leaving — transfer or disband
      const otherMembers = await db.select({ id: schema.players.id })
        .from(schema.players)
        .where(and(eq(schema.players.clanId, clan.id)));

      const others = otherMembers.filter(m => m.id !== playerId);
      if (others.length > 0) {
        // Transfer to first other member
        await db.update(schema.clans)
          .set({ leaderId: others[0].id, memberCount: Math.max(1, clan.memberCount - 1) })
          .where(eq(schema.clans.id, clan.id));
      } else {
        // Disband
        await db.delete(schema.clans).where(eq(schema.clans.id, clan.id));
      }
    } else {
      await db.update(schema.clans)
        .set({ memberCount: Math.max(1, clan.memberCount - 1) })
        .where(eq(schema.clans.id, clan.id));
    }

    await db.update(schema.players)
      .set({ clanId: null })
      .where(eq(schema.players.id, playerId));

    await db.update(schema.leaderboard)
      .set({ clanTag: null })
      .where(eq(schema.leaderboard.playerId, playerId))
      .catch(() => {});

    res.json({ message: "Left clan" });
  } catch (err: any) {
    console.error("Clan leave error:", err);
    res.status(500).json({ error: "Failed to leave clan" });
  }
});

// Kick member (leader only)
router.post("/:id/kick", async (req, res) => {
  try {
    const clanId = parseInt(req.params.id);
    const playerId = (req as any).user.playerId;
    const { targetPlayerId } = req.body;

    if (!targetPlayerId) { res.status(400).json({ error: "Target player ID required" }); return; }

    const [clan] = await db.select().from(schema.clans)
      .where(eq(schema.clans.id, clanId)).limit(1);
    if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
    if (clan.leaderId !== playerId) { res.status(403).json({ error: "Only the clan leader can kick members" }); return; }
    if (targetPlayerId === playerId) { res.status(400).json({ error: "Cannot kick yourself" }); return; }

    const [target] = await db.select().from(schema.players)
      .where(eq(schema.players.id, targetPlayerId)).limit(1);
    if (!target || target.clanId !== clanId) { res.status(404).json({ error: "Player not in this clan" }); return; }

    await db.update(schema.players)
      .set({ clanId: null })
      .where(eq(schema.players.id, targetPlayerId));

    await db.update(schema.clans)
      .set({ memberCount: Math.max(1, clan.memberCount - 1) })
      .where(eq(schema.clans.id, clanId));

    await db.update(schema.leaderboard)
      .set({ clanTag: null })
      .where(eq(schema.leaderboard.playerId, targetPlayerId))
      .catch(() => {});

    res.json({ message: "Player kicked" });
  } catch (err: any) {
    console.error("Clan kick error:", err);
    res.status(500).json({ error: "Failed to kick player" });
  }
});

// Promote to leader (leader only)
router.post("/:id/promote", async (req, res) => {
  try {
    const clanId = parseInt(req.params.id);
    const playerId = (req as any).user.playerId;
    const { targetPlayerId } = req.body;

    if (!targetPlayerId) { res.status(400).json({ error: "Target player ID required" }); return; }

    const [clan] = await db.select().from(schema.clans)
      .where(eq(schema.clans.id, clanId)).limit(1);
    if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
    if (clan.leaderId !== playerId) { res.status(403).json({ error: "Only the clan leader can promote" }); return; }

    const [target] = await db.select().from(schema.players)
      .where(eq(schema.players.id, targetPlayerId)).limit(1);
    if (!target || target.clanId !== clanId) { res.status(404).json({ error: "Player not in this clan" }); return; }

    await db.update(schema.clans)
      .set({ leaderId: targetPlayerId })
      .where(eq(schema.clans.id, clanId));

    res.json({ message: "New leader promoted" });
  } catch (err: any) {
    console.error("Clan promote error:", err);
    res.status(500).json({ error: "Failed to promote" });
  }
});

// Search clans
router.get("/", async (req, res) => {
  try {
    const clans = await db.select().from(schema.clans).limit(50);
    res.json({ clans: clans.map(c => ({ id: c.id, name: c.name, tag: c.tag, faction: c.faction, memberCount: c.memberCount })) });
  } catch (err: any) {
    console.error("Clan list error:", err);
    res.status(500).json({ error: "Failed to list clans" });
  }
});

export default router;
