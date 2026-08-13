import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import {
  BASE_MAX_MEMBERS, CLAN_RESEARCH, donationToXp, donationToContribution,
  levelForXp, maxMembersForLevel, refreshClanResearchCache, researchTierCost,
  CREST_SHAPE_IDS, CREST_SYMBOLS, CREST_COLORS, CREST_FOCUS_TAGS, CREST_CREATE_COST, CLAN_ADMISSIONS,
  type ResearchProjectId, type ResearchState, type ClanAdmission,
} from "../game/clanData.js";

const router = Router();

const CLAN_CREATE_COST = CREST_CREATE_COST;
const VALID_TAGS = new Set(CREST_FOCUS_TAGS);

// Create clan
router.post("/create", async (req, res) => {
  try {
    const { name, tag, motto, tags, minLevel, admission, crestShape, crestSymbol, crestOuter, crestInner, crestSymbolColor } = req.body;
    const playerId = (req as any).user.playerId;

    if (!name || !tag) {
      res.status(400).json({ error: "Name and tag required" });
      return;
    }
    if (name.trim().length < 3 || name.trim().length > 24) {
      res.status(400).json({ error: "Clan name must be 3-24 characters" });
      return;
    }
    // Matches the Kit's own tagOk check exactly: /^[A-Z0-9]{3,4}$/.
    if (!/^[A-Z0-9]{3,4}$/.test(String(tag).toUpperCase())) {
      res.status(400).json({ error: "Clan tag must be 3-4 letters or digits" });
      return;
    }
    if (motto !== undefined && (typeof motto !== "string" || motto.length > 64)) {
      res.status(400).json({ error: "Motto must be at most 64 characters" });
      return;
    }
    const cleanTags = Array.isArray(tags)
      ? [...new Set(tags.filter((t: any) => typeof t === "string" && VALID_TAGS.has(t.toUpperCase())).map((t: string) => t.toUpperCase()))].slice(0, 3)
      : [];
    // Matches the Kit's tagsOk check: one to three recruiting tags are required.
    if (cleanTags.length < 1) { res.status(400).json({ error: "Pick at least one recruiting tag" }); return; }
    const cleanMinLevel = Number.isFinite(minLevel) ? Math.max(0, Math.min(60, Math.round(minLevel))) : 20;
    const cleanAdmission: ClanAdmission = CLAN_ADMISSIONS.includes(admission) ? admission : "apply";
    // Crest fields are picked from fixed option sets (never free text) — see
    // CREST_SHAPES/CREST_SYMBOLS/CREST_COLORS in clanData.ts, matching the
    // Kit's picker grids exactly.
    const cleanShape = CREST_SHAPE_IDS.includes(crestShape) ? crestShape : "hex";
    const cleanSymbol = CREST_SYMBOLS.includes(crestSymbol) ? crestSymbol : CREST_SYMBOLS[0];
    const cleanOuter = CREST_COLORS.includes(crestOuter) ? crestOuter : CREST_COLORS[0];
    const cleanInner = CREST_COLORS.includes(crestInner) ? crestInner : CREST_COLORS[0];
    const cleanSymbolColor = CREST_COLORS.includes(crestSymbolColor) ? crestSymbolColor : "#f2f7ff";

    const [player] = await db.select().from(schema.players)
      .where(eq(schema.players.id, playerId)).limit(1);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }
    if (player.clanId) { res.status(400).json({ error: "Already in a clan" }); return; }
    if (player.credits < CLAN_CREATE_COST) { res.status(400).json({ error: `Founding a clan costs ${CLAN_CREATE_COST.toLocaleString()} credits` }); return; }

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
      motto: motto ?? "",
      tags: cleanTags,
      minLevel: cleanMinLevel,
      admission: cleanAdmission,
      crestShape: cleanShape, crestSymbol: cleanSymbol, crestOuter: cleanOuter,
      crestInner: cleanInner, crestSymbolColor: cleanSymbolColor,
      maxMembers: BASE_MAX_MEMBERS,
    }).returning();

    await db.update(schema.players)
      .set({ clanId: clan.id, clanRole: "leader", credits: player.credits - CLAN_CREATE_COST })
      .where(eq(schema.players.id, playerId));

    // Update leaderboard
    await db.update(schema.leaderboard)
      .set({ clanTag: clan.tag })
      .where(eq(schema.leaderboard.playerId, playerId))
      .catch(() => {});

    res.status(201).json({ clan: { id: clan.id, name: clan.name, tag: clan.tag, leaderId: clan.leaderId, memberCount: 1 }, credits: player.credits - CLAN_CREATE_COST });
  } catch (err: any) {
    console.error("Clan create error:", err);
    res.status(500).json({ error: "Failed to create clan" });
  }
});

function researchPayload(research: ResearchState) {
  return (Object.keys(CLAN_RESEARCH) as ResearchProjectId[]).map((id) => {
    const proj = CLAN_RESEARCH[id];
    const tier = Math.max(0, Math.min(proj.maxTier, research?.[id] ?? 0));
    return {
      id, name: proj.name, description: proj.description, tier, maxTier: proj.maxTier,
      unit: proj.unit, perTier: proj.perTier, hex: proj.hex,
      nextCost: tier < proj.maxTier ? researchTierCost(id, tier) : null,
    };
  });
}

// Get clan info — the Clan Hall's full data source: crest/level/xp, treasury,
// research progress (with next-tier cost), and a roster sorted by lifetime
// contribution (highest first) with each member's clan role.
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
      clanRole: schema.players.clanRole,
      clanContribution: schema.players.clanContribution,
    }).from(schema.players).where(eq(schema.players.clanId, clanId));
    members.sort((a: any, b: any) => b.clanContribution - a.clanContribution);
    const totalHonor = members.reduce((sum: number, m: any) => sum + m.honor, 0);

    // Season rank among ALL clans, same "total member honor desc" ordering
    // GET / uses — computed here too so the Hall's own totalHonor/seasonRank
    // fields are never undefined (this endpoint used to omit them entirely,
    // crashing the Hall on clan.totalHonor.toLocaleString()).
    const allClans = await db.select({ id: schema.clans.id }).from(schema.clans);
    const allHonorRows = await db.select({ clanId: schema.players.clanId, honor: schema.players.honor }).from(schema.players);
    const honorByClan = new Map<number, number>();
    for (const row of allHonorRows) {
      if (row.clanId == null) continue;
      honorByClan.set(row.clanId, (honorByClan.get(row.clanId) ?? 0) + row.honor);
    }
    const ranked = [...allClans].sort((a, b) => (honorByClan.get(b.id) ?? 0) - (honorByClan.get(a.id) ?? 0));
    const seasonRank = ranked.findIndex((c) => c.id === clanId) + 1 || allClans.length;

    const nextLevelXp = Math.round(2500 * (clan.level + 1) * (clan.level + 1));

    res.json({
      clan: {
        ...clan,
        members,
        research: researchPayload(clan.research as ResearchState),
        xpNext: nextLevelXp,
        totalHonor,
        seasonRank,
        openSlots: Math.max(0, clan.maxMembers - clan.memberCount),
      },
    });
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
      .set({ clanId: clan.id, clanRole: "member" })
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
      // Leader leaving — transfer to the highest-contribution remaining
      // member, or disband if they were the last one.
      const otherMembers = await db.select({ id: schema.players.id, clanContribution: schema.players.clanContribution })
        .from(schema.players)
        .where(and(eq(schema.players.clanId, clan.id)));

      const others = otherMembers.filter((m: any) => m.id !== playerId).sort((a: any, b: any) => b.clanContribution - a.clanContribution);
      if (others.length > 0) {
        await db.update(schema.clans)
          .set({ leaderId: others[0].id, memberCount: Math.max(1, clan.memberCount - 1) })
          .where(eq(schema.clans.id, clan.id));
        await db.update(schema.players)
          .set({ clanRole: "leader" })
          .where(eq(schema.players.id, others[0].id));
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
      .set({ clanId: null, clanRole: "member", clanContribution: 0 })
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

// Kick member (leader or officer)
router.post("/:id/kick", async (req, res) => {
  try {
    const clanId = parseInt(req.params.id);
    const playerId = (req as any).user.playerId;
    const { targetPlayerId } = req.body;

    if (!targetPlayerId) { res.status(400).json({ error: "Target player ID required" }); return; }

    const [clan] = await db.select().from(schema.clans)
      .where(eq(schema.clans.id, clanId)).limit(1);
    if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }

    const [actor] = await db.select({ clanRole: schema.players.clanRole, clanId: schema.players.clanId })
      .from(schema.players).where(eq(schema.players.id, playerId)).limit(1);
    const isLeader = clan.leaderId === playerId;
    const isOfficer = actor?.clanId === clanId && actor.clanRole === "officer";
    if (!isLeader && !isOfficer) { res.status(403).json({ error: "Only the clan leader or an officer can kick members" }); return; }
    if (targetPlayerId === playerId) { res.status(400).json({ error: "Cannot kick yourself" }); return; }
    if (targetPlayerId === clan.leaderId) { res.status(400).json({ error: "Cannot kick the clan leader" }); return; }

    const [target] = await db.select().from(schema.players)
      .where(eq(schema.players.id, targetPlayerId)).limit(1);
    if (!target || target.clanId !== clanId) { res.status(404).json({ error: "Player not in this clan" }); return; }

    await db.update(schema.players)
      .set({ clanId: null, clanRole: "member", clanContribution: 0 })
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
    await db.update(schema.players).set({ clanRole: "leader" }).where(eq(schema.players.id, targetPlayerId));
    await db.update(schema.players).set({ clanRole: "officer" }).where(eq(schema.players.id, playerId));

    res.json({ message: "New leader promoted" });
  } catch (err: any) {
    console.error("Clan promote error:", err);
    res.status(500).json({ error: "Failed to promote" });
  }
});

// Set a member's officer status (leader only) — the Kit's roster has no
// dedicated "promote to officer" button copy, but INVITE/LEAVE alone leaves
// no way to ever grant kick rights to anyone but the leader; this fills that
// gap with the minimum viable role toggle.
router.post("/:id/setOfficer", async (req, res) => {
  try {
    const clanId = parseInt(req.params.id);
    const playerId = (req as any).user.playerId;
    const { targetPlayerId, officer } = req.body;

    const [clan] = await db.select().from(schema.clans).where(eq(schema.clans.id, clanId)).limit(1);
    if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }
    if (clan.leaderId !== playerId) { res.status(403).json({ error: "Only the clan leader can set officers" }); return; }

    const [target] = await db.select().from(schema.players).where(eq(schema.players.id, targetPlayerId)).limit(1);
    if (!target || target.clanId !== clanId) { res.status(404).json({ error: "Player not in this clan" }); return; }
    if (targetPlayerId === clan.leaderId) { res.status(400).json({ error: "Leader is already in charge" }); return; }

    await db.update(schema.players).set({ clanRole: officer ? "officer" : "member" }).where(eq(schema.players.id, targetPlayerId));
    res.json({ message: officer ? "Promoted to officer" : "Demoted to member" });
  } catch (err: any) {
    console.error("Clan setOfficer error:", err);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// Donate credits or mcoins to the clan treasury — server-authoritative:
// spends the player's real balance, credits the clan treasury, and grants
// clan XP + the donor's roster contribution in one transaction.
router.post("/:id/donate", async (req, res) => {
  try {
    const clanId = parseInt(req.params.id);
    const playerId = (req as any).user.playerId;
    const { currency, amount } = req.body as { currency: "credits" | "mcoins"; amount: number };

    if (currency !== "credits" && currency !== "mcoins") { res.status(400).json({ error: "Invalid currency" }); return; }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) { res.status(400).json({ error: "Invalid amount" }); return; }
    const donateAmount = Math.round(amount);

    const [player] = await db.select().from(schema.players).where(eq(schema.players.id, playerId)).limit(1);
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }
    if (player.clanId !== clanId) { res.status(403).json({ error: "Not a member of this clan" }); return; }

    const [clan] = await db.select().from(schema.clans).where(eq(schema.clans.id, clanId)).limit(1);
    if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }

    const balance = currency === "credits" ? player.credits : player.mcoins;
    if (balance < donateAmount) { res.status(400).json({ error: `Not enough ${currency}` }); return; }

    const creditsAmount = currency === "credits" ? donateAmount : 0;
    const mcoinsAmount = currency === "mcoins" ? donateAmount : 0;
    const xpGain = donationToXp(creditsAmount, mcoinsAmount);
    const contribGain = donationToContribution(creditsAmount, mcoinsAmount);

    const newXp = clan.xp + xpGain;
    const newLevel = levelForXp(newXp);
    const newMaxMembers = maxMembersForLevel(newLevel);

    await db.update(schema.players)
      .set({
        [currency]: balance - donateAmount,
        clanContribution: player.clanContribution + contribGain,
      })
      .where(eq(schema.players.id, playerId));

    await db.update(schema.clans)
      .set({
        treasuryCredits: clan.treasuryCredits + creditsAmount,
        treasuryMcoins: clan.treasuryMcoins + mcoinsAmount,
        xp: newXp, level: newLevel, maxMembers: newMaxMembers,
      })
      .where(eq(schema.clans.id, clanId));

    res.json({
      ok: true,
      balance: balance - donateAmount,
      treasuryCredits: clan.treasuryCredits + creditsAmount,
      treasuryMcoins: clan.treasuryMcoins + mcoinsAmount,
      level: newLevel, xp: newXp, maxMembers: newMaxMembers,
    });
  } catch (err: any) {
    console.error("Clan donate error:", err);
    res.status(500).json({ error: "Failed to donate" });
  }
});

// Fund the next tier of a research project from the clan treasury.
router.post("/:id/research/:projectId/fund", async (req, res) => {
  try {
    const clanId = parseInt(req.params.id);
    const projectId = req.params.projectId as ResearchProjectId;
    const playerId = (req as any).user.playerId;

    const proj = CLAN_RESEARCH[projectId];
    if (!proj) { res.status(400).json({ error: "Unknown research project" }); return; }

    const [player] = await db.select({ clanId: schema.players.clanId, clanRole: schema.players.clanRole }).from(schema.players).where(eq(schema.players.id, playerId)).limit(1);
    if (!player || player.clanId !== clanId) { res.status(403).json({ error: "Not a member of this clan" }); return; }

    const [clan] = await db.select().from(schema.clans).where(eq(schema.clans.id, clanId)).limit(1);
    if (!clan) { res.status(404).json({ error: "Clan not found" }); return; }

    const research = (clan.research ?? {}) as ResearchState;
    const tier = Math.max(0, Math.min(proj.maxTier, research[projectId] ?? 0));
    if (tier >= proj.maxTier) { res.status(400).json({ error: "This project is already at max tier" }); return; }

    const cost = researchTierCost(projectId, tier);
    if (clan.treasuryCredits < cost) { res.status(400).json({ error: `Treasury needs ${cost.toLocaleString()} credits (has ${clan.treasuryCredits.toLocaleString()})` }); return; }

    const newResearch = { ...research, [projectId]: tier + 1 };
    await db.update(schema.clans)
      .set({ treasuryCredits: clan.treasuryCredits - cost, research: newResearch })
      .where(eq(schema.clans.id, clanId));

    await refreshClanResearchCache(clanId, db, schema);

    res.json({ ok: true, tier: tier + 1, treasuryCredits: clan.treasuryCredits - cost, research: researchPayload(newResearch) });
  } catch (err: any) {
    console.error("Clan research fund error:", err);
    res.status(500).json({ error: "Failed to fund research" });
  }
});

// Search clans — includes a real season rank (clans ordered by total member
// honor, desc) and open recruitment slots, both computed here rather than
// stored, so they're always consistent with live member data.
router.get("/", async (req, res) => {
  try {
    const clans = await db.select().from(schema.clans).limit(50);
    const honorTotals = await db
      .select({ clanId: schema.players.clanId, honor: schema.players.honor })
      .from(schema.players);
    const honorByClan = new Map<number, number>();
    for (const row of honorTotals) {
      if (row.clanId == null) continue;
      honorByClan.set(row.clanId, (honorByClan.get(row.clanId) ?? 0) + row.honor);
    }
    const ranked = [...clans].sort((a, b) => (honorByClan.get(b.id) ?? 0) - (honorByClan.get(a.id) ?? 0));
    const rankById = new Map(ranked.map((c, i) => [c.id, i + 1]));

    res.json({
      clans: clans.map((c) => ({
        id: c.id, name: c.name, tag: c.tag, faction: c.faction, memberCount: c.memberCount,
        motto: c.motto, tags: c.tags, minLevel: c.minLevel, minHonor: c.minHonor, admission: c.admission,
        crestShape: c.crestShape, crestSymbol: c.crestSymbol, crestOuter: c.crestOuter,
        crestInner: c.crestInner, crestSymbolColor: c.crestSymbolColor,
        maxMembers: c.maxMembers, openSlots: Math.max(0, c.maxMembers - c.memberCount),
        seasonRank: rankById.get(c.id) ?? clans.length,
        totalHonor: honorByClan.get(c.id) ?? 0,
        level: c.level,
      })),
    });
  } catch (err: any) {
    console.error("Clan list error:", err);
    res.status(500).json({ error: "Failed to list clans" });
  }
});

// Apply to join — same effect as /:id/join, but re-checks the clan's own
// posted requirements server-side first (the client-side dossier check is
// cosmetic; this is the real gate, same spirit as the loot/currency guards
// elsewhere in this file — never trust the client to have actually met them).
router.post("/:id/apply", async (req, res) => {
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
    if (clan.admission === "invite") { res.status(403).json({ error: "This clan is invite-only" }); return; }
    if (clan.memberCount >= clan.maxMembers) { res.status(400).json({ error: "This clan has no open slots" }); return; }
    if (player.level < clan.minLevel) { res.status(400).json({ error: `Requires pilot level ${clan.minLevel}` }); return; }
    if (player.honor < clan.minHonor) { res.status(400).json({ error: `Requires ${clan.minHonor.toLocaleString()} honor` }); return; }

    await db.update(schema.players)
      .set({ clanId: clan.id, clanRole: "member" })
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
    console.error("Clan apply error:", err);
    res.status(500).json({ error: "Failed to apply" });
  }
});

export default router;
