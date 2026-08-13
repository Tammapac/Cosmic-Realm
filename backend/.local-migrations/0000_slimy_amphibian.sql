CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(24) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login" timestamp,
	"banned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "accounts_username_unique" UNIQUE("username"),
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" varchar(16) NOT NULL,
	"from_player_id" integer,
	"from_name" varchar(24) NOT NULL,
	"text" text NOT NULL,
	"zone" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(24) NOT NULL,
	"tag" varchar(6) NOT NULL,
	"leader_id" integer NOT NULL,
	"faction" varchar(16),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"member_count" integer DEFAULT 1 NOT NULL,
	"motto" varchar(120) DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_level" integer DEFAULT 1 NOT NULL,
	"min_honor" integer DEFAULT 0 NOT NULL,
	"admission" varchar(16) DEFAULT 'open' NOT NULL,
	"crest_shape" varchar(12) DEFAULT 'hex' NOT NULL,
	"crest_symbol" varchar(8) DEFAULT '★' NOT NULL,
	"crest_outer" varchar(9) DEFAULT '#b866ff' NOT NULL,
	"crest_inner" varchar(9) DEFAULT '#4a2d80' NOT NULL,
	"crest_symbol_color" varchar(9) DEFAULT '#f2f7ff' NOT NULL,
	"max_members" integer DEFAULT 30 NOT NULL,
	"treasury_credits" bigint DEFAULT 0 NOT NULL,
	"treasury_mcoins" bigint DEFAULT 0 NOT NULL,
	"xp" bigint DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"research" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "clans_name_unique" UNIQUE("name"),
	CONSTRAINT "clans_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_player_id" integer NOT NULL,
	"to_player_id" integer NOT NULL,
	"text" varchar(500) NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_audit" (
	"instance_id" varchar(64) PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"def_id" varchar(48) NOT NULL,
	"ilvl" integer NOT NULL,
	"rarity" varchar(16) NOT NULL,
	"fingerprint" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"player_name" varchar(24) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"honor" integer DEFAULT 0 NOT NULL,
	"total_kills" integer DEFAULT 0 NOT NULL,
	"faction" varchar(16),
	"clan_tag" varchar(6),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leaderboard_player_id_unique" UNIQUE("player_id")
);
--> statement-breakpoint
CREATE TABLE "leaderboard_season" (
	"board" varchar(16) PRIMARY KEY NOT NULL,
	"monthly_started_at" timestamp DEFAULT now() NOT NULL,
	"all_time_top3" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"name" varchar(24) NOT NULL,
	"ship_class" varchar(32) DEFAULT 'skimmer' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"exp" bigint DEFAULT 0 NOT NULL,
	"credits" bigint DEFAULT 10000 NOT NULL,
	"honor" integer DEFAULT 0 NOT NULL,
	"mcoins" bigint DEFAULT 0 NOT NULL,
	"hull" real DEFAULT 100 NOT NULL,
	"shield" real DEFAULT 70 NOT NULL,
	"zone" varchar(32) DEFAULT 'alpha' NOT NULL,
	"pos_x" real DEFAULT 0 NOT NULL,
	"pos_y" real DEFAULT 0 NOT NULL,
	"faction" varchar(16),
	"clan_id" integer,
	"clan_role" varchar(16) DEFAULT 'member' NOT NULL,
	"clan_contribution" bigint DEFAULT 0 NOT NULL,
	"skill_points" integer DEFAULT 0 NOT NULL,
	"skills" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"owned_ships" jsonb DEFAULT '["skimmer"]'::jsonb NOT NULL,
	"inventory" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipped" jsonb DEFAULT '{"weapon":[null,null,null],"generator":[null,null,null],"module":[null,null,null]}'::jsonb NOT NULL,
	"cargo" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"drones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pet_drone" jsonb DEFAULT '{"level":0,"mode":"orbit","hp":400,"hpMax":400,"orbitPhase":0,"fireCd":0,"equipped":{"weapon":null,"module":null,"extra":null}}'::jsonb NOT NULL,
	"bebcell" integer DEFAULT 0 NOT NULL,
	"inventory_extra_page" boolean DEFAULT false NOT NULL,
	"consumables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hotbar" jsonb DEFAULT '[null,null,null,null,null,null,null,null]'::jsonb NOT NULL,
	"ammo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rocket_ammo_type" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ammo_by_type" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"drone_ammo" integer DEFAULT 100 NOT NULL,
	"drone_ammo_max" integer DEFAULT 500 NOT NULL,
	"auto_restock" boolean DEFAULT false NOT NULL,
	"auto_repair_hull" boolean DEFAULT false NOT NULL,
	"auto_shield_recharge" boolean DEFAULT false NOT NULL,
	"active_quests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_quests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"daily_missions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_daily_reset" bigint DEFAULT 0 NOT NULL,
	"milestones" jsonb DEFAULT '{"totalKills":0,"totalMined":0,"totalCreditsEarned":0,"totalWarps":0,"totalDeaths":0,"bossKills":0,"totalContracts":0,"totalSalvaged":0}'::jsonb NOT NULL,
	"dungeon_clears" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dungeon_best_times" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"total_playtime" integer DEFAULT 0 NOT NULL,
	"exchange_holdings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"exchange_debt" bigint DEFAULT 0 NOT NULL,
	"exchange_loan_count" integer DEFAULT 0 NOT NULL,
	"exchange_loan_week" integer DEFAULT 0 NOT NULL,
	"exchange_premium" boolean DEFAULT false NOT NULL,
	"exchange_last_interest_day" integer DEFAULT 0 NOT NULL,
	"leaderboard_all_time_buff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "players_account_id_unique" UNIQUE("account_id"),
	CONSTRAINT "players_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_from_player_id_players_id_fk" FOREIGN KEY ("from_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_from_player_id_players_id_fk" FOREIGN KEY ("from_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_to_player_id_players_id_fk" FOREIGN KEY ("to_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_players_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_target_id_players_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_clan_id_clans_id_fk" FOREIGN KEY ("clan_id") REFERENCES "public"."clans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_channel_idx" ON "chat_messages" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "chat_zone_idx" ON "chat_messages" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "dm_from_idx" ON "direct_messages" USING btree ("from_player_id");--> statement-breakpoint
CREATE INDEX "dm_to_idx" ON "direct_messages" USING btree ("to_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_idx" ON "friendships" USING btree ("requester_id","target_id");--> statement-breakpoint
CREATE INDEX "friendship_requester_idx" ON "friendships" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "friendship_target_idx" ON "friendships" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "item_audit_owner_idx" ON "item_audit" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "lb_honor_idx" ON "leaderboard" USING btree ("honor");--> statement-breakpoint
CREATE INDEX "lb_level_idx" ON "leaderboard" USING btree ("level");--> statement-breakpoint
CREATE INDEX "lb_kills_idx" ON "leaderboard" USING btree ("total_kills");--> statement-breakpoint
CREATE INDEX "players_zone_idx" ON "players" USING btree ("zone");--> statement-breakpoint
CREATE INDEX "players_clan_idx" ON "players" USING btree ("clan_id");--> statement-breakpoint
CREATE INDEX "players_level_idx" ON "players" USING btree ("level");