import { Router } from "express";
import { desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";

const router = Router();

router.get("/top", async (req, res) => {
  try {
    const sort = (req.query.sort as string) || "honor";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const orderCol =
      sort === "level"
        ? schema.leaderboard.level
        : sort === "kills"
          ? schema.leaderboard.totalKills
          : schema.leaderboard.honor;

    const rows = await db
      .select()
      .from(schema.leaderboard)
      .orderBy(desc(orderCol))
      .limit(limit);

    res.json({ leaderboard: rows });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

export default router;
