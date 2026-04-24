import { Router } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { signToken } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { username, email, password, pilotName } = req.body;

    if (!username || !email || !password || !pilotName) {
      res.status(400).json({ error: "All fields required" });
      return;
    }
    if (username.length < 3 || username.length > 24) {
      res.status(400).json({ error: "Username must be 3-24 characters" });
      return;
    }
    if (pilotName.length < 2 || pilotName.length > 24) {
      res.status(400).json({ error: "Pilot name must be 2-24 characters" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.username, username))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Username taken" });
      return;
    }

    const existingEmail = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.email, email))
      .limit(1);
    if (existingEmail.length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const existingPilot = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.name, pilotName))
      .limit(1);
    if (existingPilot.length > 0) {
      res.status(409).json({ error: "Pilot name taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [account] = await db
      .insert(schema.accounts)
      .values({ username, email, passwordHash })
      .returning();

    const [player] = await db
      .insert(schema.players)
      .values({
        accountId: account.id,
        name: pilotName,
      })
      .returning();

    await db.insert(schema.leaderboard).values({
      playerId: player.id,
      playerName: player.name,
    });

    const token = signToken({
      accountId: account.id,
      playerId: player.id,
      username: account.username,
    });

    res.status(201).json({ token, player: sanitizePlayer(player) });
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    const [account] = await db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.username, username))
      .limit(1);

    if (!account) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (account.banned) {
      res.status(403).json({ error: "Account banned" });
      return;
    }

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const [player] = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.accountId, account.id))
      .limit(1);

    if (!player) {
      res.status(500).json({ error: "No character found" });
      return;
    }

    await db
      .update(schema.accounts)
      .set({ lastLogin: new Date() })
      .where(eq(schema.accounts.id, account.id));

    const token = signToken({
      accountId: account.id,
      playerId: player.id,
      username: account.username,
    });

    res.json({ token, player: sanitizePlayer(player) });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

function sanitizePlayer(p: any) {
  const { id, name, shipClass, level, exp, credits, honor, hull, shield, zone,
    posX, posY, faction, skillPoints, skills, ownedShips, inventory, equipped,
    cargo, drones, consumables, hotbar, ammo, rocketAmmoType, ammoByType,
    autoRestock, autoRepairHull, autoShieldRecharge, activeQuests, completedQuests,
    dailyMissions, lastDailyReset, milestones, dungeonClears, dungeonBestTimes } = p;
  return {
    id, name, shipClass, level, exp, credits, honor, hull, shield, zone,
    pos: { x: posX, y: posY }, faction, skillPoints, skills, ownedShips,
    inventory, equipped, cargo, drones, consumables, hotbar, ammo,
    rocketAmmoType, ammoByType, autoRestock, autoRepairHull, autoShieldRecharge,
    activeQuests, completedQuests, dailyMissions, lastDailyReset, milestones,
    dungeonClears, dungeonBestTimes,
  };
}

export default router;
