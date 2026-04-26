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
    shipClass: varchar("ship_class", { length: 32 }).notNull().default("skimmer"),
    level: integer("level").notNull().default(1),
    exp: bigint("exp", { mode: "number" }).notNull().default(0),
    credits: bigint("credits", { mode: "number" }).notNull().default(10000),
    honor: integer("honor").notNull().default(0),
    hull: real("hull").notNull().default(100),
    shield: real("shield").notNull().default(70),
    zone: varchar("zone", { length: 32 }).notNull().default("alpha"),
    posX: real("pos_x").notNull().default(0),
    posY: real("pos_y").notNull().default(0),
    faction: varchar("faction", { length: 16 }),
    clanId: integer("clan_id").references(() => clans.id),
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
    drones: jsonb("drones").notNull().default([]),
    consumables: jsonb("consumables").notNull().default({}),
    hotbar: jsonb("hotbar").notNull().default([null, null, null, null, null, null, null, null]),
    ammo: jsonb("ammo").notNull().default({}),
    rocketAmmoType: jsonb("rocket_ammo_type").notNull().default({}),
    ammoByType: jsonb("ammo_by_type").notNull().default({}),
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
    }),
    dungeonClears: jsonb("dungeon_clears").notNull().default({}),
    dungeonBestTimes: jsonb("dungeon_best_times").notNull().default({}),
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
    totalPlaytime: integer("total_playtime").notNull().default(0),
  },
  (table) => [
    index("players_zone_idx").on(table.zone),
    index("players_clan_idx").on(table.clanId),
    index("players_level_idx").on(table.level),
  ]
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
