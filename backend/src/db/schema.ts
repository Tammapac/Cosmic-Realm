import {
  pgTable,
  text,
  serial,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  varchar,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── ACCOUNTS ────────────────────────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 24 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
  banned: boolean("banned").default(false).notNull(),
});

// ── PLAYERS (one per account, the game character) ────────────────────
export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .references(() => accounts.id)
      .notNull()
      .unique(),
    name: varchar("name", { length: 24 }).notNull().unique(),
    // Staff flag. THE authority on who is an administrator — replaces the
    // hardcoded `playerId === 3` checks that used to gate the admin socket
    // handlers, and is what grants the Administrator rank badge. Never
    // settable through the generic admin field editor (see ADMIN_PROTECTED in
    // socket/handler.ts): an admin must not be able to promote another
    // account to admin through the same form that edits credits.
    isAdmin: boolean("is_admin").notNull().default(false),
    shipClass: varchar("ship_class", { length: 32 }).notNull().default("skimmer"),
    level: integer("level").notNull().default(1),
    exp: bigint("exp", { mode: "number" }).notNull().default(0),
    credits: bigint("credits", { mode: "number" }).notNull().default(10000),
    honor: integer("honor").notNull().default(0),
    mcoins: bigint("mcoins", { mode: "number" }).notNull().default(0),
    hull: real("hull").notNull().default(100),
    shield: real("shield").notNull().default(70),
    zone: varchar("zone", { length: 32 }).notNull().default("alpha"),
    posX: real("pos_x").notNull().default(0),
    posY: real("pos_y").notNull().default(0),
    faction: varchar("faction", { length: 16 }),
    clanId: integer("clan_id").references(() => clans.id),
    clanRole: varchar("clan_role", { length: 16 }).notNull().default("member"), // "leader" | "officer" | "member"
    clanContribution: bigint("clan_contribution", { mode: "number" }).notNull().default(0), // lifetime credits+mcoins donated (mcoins weighted 100:1, see clan.ts)
    skillPoints: integer("skill_points").notNull().default(0),
    skills: jsonb("skills").notNull().default({}),
    ownedShips: jsonb("owned_ships").notNull().default(["skimmer"]),
    inventory: jsonb("inventory").notNull().default([]),
    equipped: jsonb("equipped").notNull().default({
      weapon: [null, null, null],
      generator: [null, null, null],
      module: [null, null, null],
    }),
    cargo: jsonb("cargo").notNull().default([]),
    drones: jsonb("drones").notNull().default([]), // legacy — superseded by petDrone
    petDrone: jsonb("pet_drone").notNull().default({
      level: 0, mode: "orbit", hp: 400, hpMax: 400, orbitPhase: 0, fireCd: 0,
      equipped: { weapon: null, module: null, extra: null },
    }),
    bebcell: integer("bebcell").notNull().default(0),
    inventoryExtraPage: boolean("inventory_extra_page").notNull().default(false),
    consumables: jsonb("consumables").notNull().default({}),
    hotbar: jsonb("hotbar").notNull().default([null, null, null, null, null, null, null, null]),
    ammo: jsonb("ammo").notNull().default({}),
    rocketAmmoType: jsonb("rocket_ammo_type").notNull().default({}),
    ammoByType: jsonb("ammo_by_type").notNull().default({}),
    droneAmmo: integer("drone_ammo").notNull().default(100),
    droneAmmoMax: integer("drone_ammo_max").notNull().default(500),
    autoRestock: boolean("auto_restock").notNull().default(false),
    autoRepairHull: boolean("auto_repair_hull").notNull().default(false),
    autoShieldRecharge: boolean("auto_shield_recharge").notNull().default(false),
    activeQuests: jsonb("active_quests").notNull().default([]),
    completedQuests: jsonb("completed_quests").notNull().default([]),
    dailyMissions: jsonb("daily_missions").notNull().default([]),
    lastDailyReset: bigint("last_daily_reset", { mode: "number" }).notNull().default(0),
    milestones: jsonb("milestones").notNull().default({
      totalKills: 0,
      totalMined: 0,
      totalCreditsEarned: 0,
      totalWarps: 0,
      totalDeaths: 0,
      bossKills: 0,
      totalContracts: 0,
      totalSalvaged: 0,
    }),
    dungeonClears: jsonb("dungeon_clears").notNull().default({}),
    dungeonBestTimes: jsonb("dungeon_best_times").notNull().default({}),
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
    totalPlaytime: integer("total_playtime").notNull().default(0),
    // ── Financial Exchange (Kit E-01) ──────────────────────────────────
    // Holdings keyed by ticker: {"TERH":{"qty":120,"avg":108.2},...}. Prices
    // themselves are never stored — they're a deterministic seeded walk off
    // the wall clock (see backend/src/game/exchangeData.ts), recomputed
    // identically server- and client-side, same as the Kit source.
    exchangeHoldings: jsonb("exchange_holdings").notNull().default({}),
    exchangeDebt: bigint("exchange_debt", { mode: "number" }).notNull().default(0),
    exchangeLoanCount: integer("exchange_loan_count").notNull().default(0), // loans taken this ISO week, resets when the week rolls over
    exchangeLoanWeek: integer("exchange_loan_week").notNull().default(0),
    exchangePremium: boolean("exchange_premium").notNull().default(false),
    // Day index (Date.now()/86400000) interest was last applied — lets a
    // lazy read-time accrual (see exchangeData.ts applyDailyInterest) charge
    // exactly once per missed day instead of drifting with server uptime.
    exchangeLastInterestDay: integer("exchange_last_interest_day").notNull().default(0),
    // ── Leaderboard all-time rank buffs (Kit I-13) ─────────────────────
    // Snapshot of the top-3-all-time bonus this player currently holds, if
    // any — {"xpMul":1.15,"creditsMul":1.15,"premium":true} for rank 1, down
    // to rank 3's smaller bonus, or {} when not seated. Applied in
    // computeStats() and revoked immediately (see leaderboardSeason table)
    // the moment a season resort knocks the player out of the top 3, so it
    // can never persist past the rank that earned it.
    leaderboardAllTimeBuff: jsonb("leaderboard_all_time_buff").notNull().default({}),
  },
  (table) => [
    index("players_zone_idx").on(table.zone),
    index("players_clan_idx").on(table.clanId),
    index("players_level_idx").on(table.level),
  ]
);

// ── ITEM AUDIT (server-minted loot registry, anti-dup/anti-forge) ──────
export const itemAudit = pgTable(
  "item_audit",
  {
    instanceId: varchar("instance_id", { length: 64 }).primaryKey(),
    ownerId: integer("owner_id").notNull(),
    defId: varchar("def_id", { length: 48 }).notNull(),
    ilvl: integer("ilvl").notNull(),
    rarity: varchar("rarity", { length: 16 }).notNull(),
    fingerprint: text("fingerprint").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("item_audit_owner_idx").on(table.ownerId)]
);

// ── CLANS ───────────────────────────────────────────────────────────────
export const clans = pgTable("clans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 24 }).notNull().unique(),
  tag: varchar("tag", { length: 6 }).notNull().unique(),
  leaderId: integer("leader_id").notNull(),
  faction: varchar("faction", { length: 16 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  memberCount: integer("member_count").notNull().default(1),
  motto: varchar("motto", { length: 120 }).notNull().default(""),
  tags: jsonb("tags").notNull().default([]), // e.g. ["PVP","MINING"] — recruiting focus chips
  minLevel: integer("min_level").notNull().default(1),
  minHonor: integer("min_honor").notNull().default(0),
  admission: varchar("admission", { length: 16 }).notNull().default("open"), // "open" | "apply" | "invite" — see clan.ts /apply, clanData.ts CLAN_ADMISSIONS
  // Crest customization from the I-09 charter form — matches the Kit's own
  // cfShape/cfSym/cfHex(outer)/cfInner/cfSymHex fields exactly (game/clanData.ts
  // CREST_SHAPES/CREST_SYMBOLS/CREST_COLORS). Band/face gradients are derived
  // from crestOuter via shadeHex() at render time, not stored separately.
  crestShape: varchar("crest_shape", { length: 12 }).notNull().default("hex"),
  crestSymbol: varchar("crest_symbol", { length: 8 }).notNull().default("★"),
  crestOuter: varchar("crest_outer", { length: 9 }).notNull().default("#b866ff"),
  crestInner: varchar("crest_inner", { length: 9 }).notNull().default("#4a2d80"),
  crestSymbolColor: varchar("crest_symbol_color", { length: 9 }).notNull().default("#f2f7ff"),
  maxMembers: integer("max_members").notNull().default(30), // BASE_MAX_MEMBERS + level, see clan.ts
  treasuryCredits: bigint("treasury_credits", { mode: "number" }).notNull().default(0),
  treasuryMcoins: bigint("treasury_mcoins", { mode: "number" }).notNull().default(0),
  xp: bigint("xp", { mode: "number" }).notNull().default(0), // lifetime donation-derived XP, see clan.ts xpForLevel
  level: integer("level").notNull().default(1),
  // Per-project tier progress, e.g. {"loot":2,"xp":0,"cargo":1,...} — see
  // CLAN_RESEARCH in clan.ts for the fixed 6-project definitions/costs.
  research: jsonb("research").notNull().default({}),
});

// ── CHAT MESSAGES (persistent history) ──────────────────────────────
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    channel: varchar("channel", { length: 16 }).notNull(),
    fromPlayerId: integer("from_player_id").references(() => players.id),
    fromName: varchar("from_name", { length: 24 }).notNull(),
    text: text("text").notNull(),
    zone: varchar("zone", { length: 32 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_channel_idx").on(table.channel),
    index("chat_zone_idx").on(table.zone),
  ]
);

// ── LEADERBOARD (denormalized for fast reads) ───────────────────────
// Ranking source per board (Kit I-13 LB_BOARDS): level/honor/kills read from
// this denormalized cache (client-reported, low-stakes — matches the
// existing save-route trust level for these fields); the CREDITS board
// instead reads players.credits live at query time (routes/leaderboard.ts),
// since credits are a spendable, server-authoritative balance that must
// never be ranked off a client-trusted cache.
export const leaderboard = pgTable(
  "leaderboard",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .references(() => players.id)
      .notNull()
      .unique(),
    playerName: varchar("player_name", { length: 24 }).notNull(),
    level: integer("level").notNull().default(1),
    honor: integer("honor").notNull().default(0),
    totalKills: integer("total_kills").notNull().default(0),
    faction: varchar("faction", { length: 16 }),
    clanTag: varchar("clan_tag", { length: 6 }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("lb_honor_idx").on(table.honor),
    index("lb_level_idx").on(table.level),
    index("lb_kills_idx").on(table.totalKills),
  ]
);

// ── LEADERBOARD SEASON STATE (monthly reset + all-time buff holders) ───
// One row per board ("level"|"honor"|"kills"|"credits"), tracks when the
// current monthly cycle started (for the "CYCLE ENDS IN" countdown and the
// reset job) and who currently holds each of the top-3 all-time seats, so
// their permanent buff (see ALL_TIME_BUFFS in leaderboardData.ts) can be
// revoked the instant they lose the rank rather than lingering.
export const leaderboardSeason = pgTable("leaderboard_season", {
  board: varchar("board", { length: 16 }).primaryKey(), // "level" | "honor" | "kills" | "credits"
  monthlyStartedAt: timestamp("monthly_started_at").defaultNow().notNull(),
  allTimeTop3: jsonb("all_time_top3").notNull().default([]), // [playerId, playerId, playerId] — index 0 = rank 1
});

// ── FRIENDSHIPS (Kit I-10 SOCIAL) ────────────────────────────────────────
// One row per requester→target edge, not a symmetric pair — this is what
// lets "pending" distinguish an outgoing request from an incoming one
// without a second table: requesterId's row is "outgoing" from their view,
// "incoming" from targetId's view, same row. Accepting flips status to
// "accepted" (now listed as a friend by both). Blocking is unilateral: the
// blocker's row (in either direction) becomes "blocked" and the target
// can no longer message them or send a new request — see routes/social.ts.
export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id").references(() => players.id).notNull(),
    targetId: integer("target_id").references(() => players.id).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"), // "pending" | "accepted" | "blocked"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("friendship_pair_idx").on(table.requesterId, table.targetId),
    index("friendship_requester_idx").on(table.requesterId),
    index("friendship_target_idx").on(table.targetId),
  ]
);

// ── DIRECT MESSAGES (Kit I-10 SOCIAL DM thread) ─────────────────────────
export const directMessages = pgTable(
  "direct_messages",
  {
    id: serial("id").primaryKey(),
    fromPlayerId: integer("from_player_id").references(() => players.id).notNull(),
    toPlayerId: integer("to_player_id").references(() => players.id).notNull(),
    text: varchar("text", { length: 500 }).notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("dm_from_idx").on(table.fromPlayerId),
    index("dm_to_idx").on(table.toPlayerId),
  ]
);
