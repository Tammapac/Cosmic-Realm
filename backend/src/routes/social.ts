// Server-authoritative Social (Cosmic Kit I-10 port). Friend list, requests,
// blocks, and direct messages — all real persistence, no client-trusted
// state. Online status/zone comes from the live socket registry
// (socket/state.ts), not the DB, so it reflects who's actually connected
// right now, same source the minimap/party system already reads.
import { Router } from "express";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { getPlayer } from "../socket/state.js";

const router = Router();
router.use(authMiddleware);

async function findPlayerByName(name: string) {
  const [row] = await db.select({ id: schema.players.id, name: schema.players.name })
    .from(schema.players).where(eq(schema.players.name, name)).limit(1);
  return row ?? null;
}

// A friendship is stored as one directed row (requester→target); this reads
// it from either side so "am I friends with / blocked by X" doesn't care
// who originally sent the request.
async function findEdge(a: number, b: number) {
  const [row] = await db.select().from(schema.friendships)
    .where(or(
      and(eq(schema.friendships.requesterId, a), eq(schema.friendships.targetId, b)),
      and(eq(schema.friendships.requesterId, b), eq(schema.friendships.targetId, a)),
    ))
    .limit(1);
  return row ?? null;
}

function presenceOf(playerId: number): { status: "on" | "away" | "off"; zone: string | null } {
  const live = getPlayer(playerId);
  if (!live) return { status: "off", zone: null };
  // No idle/away detection exists yet server-side (would need a last-input
  // timestamp) — anyone connected reads "on" for now; "away" is reserved
  // for when that lands, matching the Kit's 3-state model exactly.
  return { status: "on", zone: live.zone };
}

// GET /api/social — full snapshot: accepted friends, pending (both directions), blocked.
router.get("/", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const rows = await db.select().from(schema.friendships)
      .where(or(eq(schema.friendships.requesterId, playerId), eq(schema.friendships.targetId, playerId)));

    const otherIds = rows.map((r) => (r.requesterId === playerId ? r.targetId : r.requesterId));
    const others = otherIds.length
      ? await db.select({ id: schema.players.id, name: schema.players.name, level: schema.players.level, faction: schema.players.faction })
          .from(schema.players).where(or(...otherIds.map((id) => eq(schema.players.id, id))))
      : [];
    const byId = new Map(others.map((o) => [o.id, o]));

    const friends: any[] = [];
    const incoming: any[] = [];
    const outgoing: any[] = [];
    const blocked: any[] = [];

    for (const r of rows) {
      const otherId = r.requesterId === playerId ? r.targetId : r.requesterId;
      const other = byId.get(otherId);
      if (!other) continue;
      const presence = presenceOf(otherId);
      const entry = { id: other.id, name: other.name, level: other.level, faction: other.faction, ...presence };

      if (r.status === "accepted") friends.push(entry);
      else if (r.status === "blocked") {
        // Only the blocker sees it as "blocked" in their own list — the
        // blocked side just sees the friendship gone (findEdge below still
        // stops them acting on it, e.g. re-requesting or messaging).
        if (r.requesterId === playerId || r.targetId === playerId) blocked.push(entry);
      } else if (r.status === "pending") {
        if (r.requesterId === playerId) outgoing.push(entry);
        else incoming.push(entry);
      }
    }

    res.json({ friends, incoming, outgoing, blocked });
  } catch (err) {
    console.error("Social snapshot error:", err);
    res.status(500).json({ error: "Failed to load social" });
  }
});

// POST /api/social/request { name }
router.post("/request", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const name = String(req.body.name || "").trim();
    if (name.length < 2) { res.status(400).json({ error: "Type the pilot's exact name first" }); return; }

    const target = await findPlayerByName(name);
    if (!target) { res.status(404).json({ error: "No pilot with that exact name" }); return; }
    if (target.id === playerId) { res.status(400).json({ error: "That's you" }); return; }

    const existing = await findEdge(playerId, target.id);
    if (existing) {
      if (existing.status === "accepted") { res.status(409).json({ error: `${target.name} is already on your list` }); return; }
      if (existing.status === "blocked") { res.status(403).json({ error: "Can't send a request here" }); return; }
      if (existing.status === "pending") { res.status(409).json({ error: `Request to ${target.name} already sent` }); return; }
    }

    await db.insert(schema.friendships).values({ requesterId: playerId, targetId: target.id, status: "pending" });
    res.json({ ok: true, name: target.name });
  } catch (err) {
    console.error("Social request error:", err);
    res.status(500).json({ error: "Failed to send request" });
  }
});

// POST /api/social/:friendId/accept — accept an incoming request.
router.post("/:friendId/accept", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const friendId = parseInt(req.params.friendId);
    const edge = await findEdge(playerId, friendId);
    if (!edge || edge.status !== "pending" || edge.targetId !== playerId) {
      res.status(400).json({ error: "No pending request from that pilot" });
      return;
    }
    await db.update(schema.friendships).set({ status: "accepted" }).where(eq(schema.friendships.id, edge.id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Social accept error:", err);
    res.status(500).json({ error: "Failed to accept" });
  }
});

// POST /api/social/:friendId/decline — decline an incoming request OR cancel one you sent.
router.post("/:friendId/decline", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const friendId = parseInt(req.params.friendId);
    const edge = await findEdge(playerId, friendId);
    if (!edge || edge.status !== "pending") { res.status(400).json({ error: "No pending request" }); return; }
    await db.delete(schema.friendships).where(eq(schema.friendships.id, edge.id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Social decline error:", err);
    res.status(500).json({ error: "Failed to decline" });
  }
});

// POST /api/social/:friendId/remove — remove an accepted friend.
router.post("/:friendId/remove", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const friendId = parseInt(req.params.friendId);
    const edge = await findEdge(playerId, friendId);
    if (!edge || edge.status !== "accepted") { res.status(400).json({ error: "Not on your friends list" }); return; }
    await db.delete(schema.friendships).where(eq(schema.friendships.id, edge.id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Social remove error:", err);
    res.status(500).json({ error: "Failed to remove" });
  }
});

// POST /api/social/:friendId/block — block (from any prior state, or fresh).
router.post("/:friendId/block", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const friendId = parseInt(req.params.friendId);
    if (friendId === playerId) { res.status(400).json({ error: "That's you" }); return; }

    const edge = await findEdge(playerId, friendId);
    if (edge) {
      await db.update(schema.friendships)
        .set({ status: "blocked", requesterId: playerId, targetId: friendId })
        .where(eq(schema.friendships.id, edge.id));
    } else {
      await db.insert(schema.friendships).values({ requesterId: playerId, targetId: friendId, status: "blocked" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Social block error:", err);
    res.status(500).json({ error: "Failed to block" });
  }
});

// POST /api/social/:friendId/unblock
router.post("/:friendId/unblock", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const friendId = parseInt(req.params.friendId);
    const edge = await findEdge(playerId, friendId);
    if (!edge || edge.status !== "blocked" || edge.requesterId !== playerId) {
      res.status(400).json({ error: "Not blocked by you" });
      return;
    }
    await db.delete(schema.friendships).where(eq(schema.friendships.id, edge.id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Social unblock error:", err);
    res.status(500).json({ error: "Failed to unblock" });
  }
});

// GET /api/social/:friendId/messages — DM thread with one pilot (both directions, chronological).
router.get("/:friendId/messages", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const friendId = parseInt(req.params.friendId);

    const rows = await db.select().from(schema.directMessages)
      .where(or(
        and(eq(schema.directMessages.fromPlayerId, playerId), eq(schema.directMessages.toPlayerId, friendId)),
        and(eq(schema.directMessages.fromPlayerId, friendId), eq(schema.directMessages.toPlayerId, playerId)),
      ))
      .orderBy(schema.directMessages.createdAt)
      .limit(200);

    // Mark the other side's messages as read now that we've fetched the thread.
    await db.update(schema.directMessages)
      .set({ readAt: new Date() })
      .where(and(eq(schema.directMessages.fromPlayerId, friendId), eq(schema.directMessages.toPlayerId, playerId)));

    res.json({
      messages: rows.map((m) => ({
        id: m.id, mine: m.fromPlayerId === playerId, text: m.text, createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("Social messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /api/social/:friendId/messages { text }
router.post("/:friendId/messages", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const friendId = parseInt(req.params.friendId);
    const text = String(req.body.text || "").trim().slice(0, 500);
    if (!text) { res.status(400).json({ error: "Message can't be empty" }); return; }

    const edge = await findEdge(playerId, friendId);
    if (edge?.status === "blocked") { res.status(403).json({ error: "Blocked — no messages can be exchanged" }); return; }

    const [msg] = await db.insert(schema.directMessages)
      .values({ fromPlayerId: playerId, toPlayerId: friendId, text })
      .returning();
    res.json({ ok: true, message: { id: msg.id, mine: true, text: msg.text, createdAt: msg.createdAt } });
  } catch (err) {
    console.error("Social send error:", err);
    res.status(500).json({ error: "Failed to send" });
  }
});

// GET /api/social/unread-count — total unread DMs, for the badge dot without opening the panel.
router.get("/unread-count", async (req, res) => {
  try {
    const { playerId } = (req as any).user;
    const rows = await db.select({ id: schema.directMessages.id }).from(schema.directMessages)
      .where(and(eq(schema.directMessages.toPlayerId, playerId), isNull(schema.directMessages.readAt)));
    res.json({ count: rows.length });
  } catch (err) {
    console.error("Social unread error:", err);
    res.status(500).json({ error: "Failed to load unread count" });
  }
});

export default router;
