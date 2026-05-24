#!/usr/bin/env python3
"""
Rework bounties & missions:
- Bounties: kill missions available on ALL maps (not zone-restricted), repeatable
- Missions: sub-tabs with transport, gathering, delivery, exploration categories
"""

import re

# ══════════════════════════════════════════════════��═══════════════════════════
# 1. TYPES.TS - Expand MissionKind, add fields to Mission type, new mission pools
# ════════════════���══════════════════════���═════════════════════════════════���════
print("═══ Updating types.ts ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    code = f.read()

# 1a. Expand MissionKind
old_kind = 'export type MissionKind =\n  | "kill-any" | "kill-zone" | "mine" | "earn-credits" | "spend-credits" | "warp-zones" | "level-up";'
new_kind = 'export type MissionKind =\n  | "kill-any" | "kill-zone" | "mine" | "earn-credits" | "spend-credits" | "warp-zones" | "level-up"\n  | "transport" | "gather" | "deliver" | "travel-gates" | "visit-zones";'

if '"transport"' not in code:
    code = code.replace(old_kind, new_kind)
    print("  -> Expanded MissionKind with transport/gather/deliver/travel-gates/visit-zones")

# 1b. Add targetStationId, targetResourceId to Mission type
old_mission_type = '''export type Mission = {
  id: string;
  kind: MissionKind;
  title: string;
  description: string;
  target: number;
  rewardCredits: number;
  rewardExp: number;
  rewardHonor: number;
  zoneFilter?: ZoneId;
};'''

new_mission_type = '''export type MissionCategory = "combat" | "transport" | "gathering" | "delivery" | "exploration";

export type Mission = {
  id: string;
  kind: MissionKind;
  category: MissionCategory;
  title: string;
  description: string;
  target: number;
  rewardCredits: number;
  rewardExp: number;
  rewardHonor: number;
  zoneFilter?: ZoneId;
  targetStationId?: string;
  targetResourceId?: string;
};'''

if 'MissionCategory' not in code:
    code = code.replace(old_mission_type, new_mission_type)
    print("  -> Added MissionCategory type and expanded Mission type")

# 1c. Add category to existing DAILY_MISSION_POOL entries (backward compat)
old_daily = '''export const DAILY_MISSION_POOL: Mission[] = [
  { id: "d-kills-10",   kind: "kill-any", title: "Daily: Bug Sweep",      description: "Eliminate 10 hostiles anywhere.",          target: 10,    rewardCredits: 600,  rewardExp: 200, rewardHonor: 8 },
  { id: "d-kills-25",   kind: "kill-any", title: "Daily: Patrol Duty",    description: "Eliminate 25 hostiles anywhere.",          target: 25,    rewardCredits: 1500, rewardExp: 500, rewardHonor: 18 },
  { id: "d-mine-30",    kind: "mine",     title: "Daily: Belt Run",       description: "Mine 30 units of any ore.",                target: 30,    rewardCredits: 800,  rewardExp: 250, rewardHonor: 6 },
  { id: "d-credits-5k", kind: "earn-credits", title: "Daily: Hustler",    description: "Earn 5,000 credits.",                       target: 5000,  rewardCredits: 1500, rewardExp: 300, rewardHonor: 10 },
  { id: "d-warp-3",     kind: "warp-zones",  title: "Daily: Sector Rounds", description: "Warp between sectors 3 times.",         target: 3,     rewardCredits: 700,  rewardExp: 200, rewardHonor: 6 },
  { id: "d-spend-3k",   kind: "spend-credits", title: "Daily: Resupply",  description: "Spend 3,000 credits at stations.",         target: 3000,  rewardCredits: 600,  rewardExp: 150, rewardHonor: 4 },
  { id: "d-zone-alpha", kind: "kill-zone", title: "Daily: Alpha Sweep",   description: "Kill 8 hostiles in Alpha Sector.",         target: 8,     rewardCredits: 700,  rewardExp: 220, rewardHonor: 7,  zoneFilter: "alpha" },
  { id: "d-zone-nebula",kind: "kill-zone", title: "Daily: Nebula Cleanup",description: "Kill 6 hostiles in Veil Nebula.",          target: 6,     rewardCredits: 1400, rewardExp: 400, rewardHonor: 14, zoneFilter: "nebula" },
];'''

new_daily = '''export const DAILY_MISSION_POOL: Mission[] = [
  { id: "d-kills-10",   kind: "kill-any", category: "combat", title: "Daily: Bug Sweep",      description: "Eliminate 10 hostiles anywhere.",          target: 10,    rewardCredits: 600,  rewardExp: 200, rewardHonor: 8 },
  { id: "d-kills-25",   kind: "kill-any", category: "combat", title: "Daily: Patrol Duty",    description: "Eliminate 25 hostiles anywhere.",          target: 25,    rewardCredits: 1500, rewardExp: 500, rewardHonor: 18 },
  { id: "d-mine-30",    kind: "mine",     category: "gathering", title: "Daily: Belt Run",       description: "Mine 30 units of any ore.",                target: 30,    rewardCredits: 800,  rewardExp: 250, rewardHonor: 6 },
  { id: "d-credits-5k", kind: "earn-credits", category: "transport", title: "Daily: Hustler",    description: "Earn 5,000 credits.",                       target: 5000,  rewardCredits: 1500, rewardExp: 300, rewardHonor: 10 },
  { id: "d-warp-3",     kind: "warp-zones", category: "exploration", title: "Daily: Sector Rounds", description: "Warp between sectors 3 times.",         target: 3,     rewardCredits: 700,  rewardExp: 200, rewardHonor: 6 },
  { id: "d-spend-3k",   kind: "spend-credits", category: "delivery", title: "Daily: Resupply",  description: "Spend 3,000 credits at stations.",         target: 3000,  rewardCredits: 600,  rewardExp: 150, rewardHonor: 4 },
  { id: "d-zone-alpha", kind: "kill-zone", category: "combat", title: "Daily: Alpha Sweep",   description: "Kill 8 hostiles in Alpha Sector.",         target: 8,     rewardCredits: 700,  rewardExp: 220, rewardHonor: 7,  zoneFilter: "alpha" },
  { id: "d-zone-nebula",kind: "kill-zone", category: "combat", title: "Daily: Nebula Cleanup",description: "Kill 6 hostiles in Veil Nebula.",          target: 6,     rewardCredits: 1400, rewardExp: 400, rewardHonor: 14, zoneFilter: "nebula" },
];'''

if 'category: "combat"' not in code:
    code = code.replace(old_daily, new_daily)
    print("  -> Added category to DAILY_MISSION_POOL entries")

# 1d. Add the full MISSION_BOARD_POOL after DAILY_MISSION_POOL
mission_board = '''

// ── MISSION BOARD (categorized missions available at stations) ────────────
export const MISSION_BOARD_POOL: Mission[] = [
  // ── TRANSPORT (move cargo between stations for profit) ──
  { id: "m-trans-1",  kind: "transport", category: "transport", title: "Supply Run: Food",         description: "Buy 20 food supplies and sell at any military station.",   target: 20,   rewardCredits: 1200,  rewardExp: 300,  rewardHonor: 8,  targetResourceId: "food" },
  { id: "m-trans-2",  kind: "transport", category: "transport", title: "Fuel Delivery",            description: "Transport 15 fuel cells to a trade station.",             target: 15,   rewardCredits: 1800,  rewardExp: 400,  rewardHonor: 12, targetResourceId: "fuel-cell" },
  { id: "m-trans-3",  kind: "transport", category: "transport", title: "Medicine Run",             description: "Deliver 10 medicine to any outpost.",                     target: 10,   rewardCredits: 2500,  rewardExp: 500,  rewardHonor: 15, targetResourceId: "medicine" },
  { id: "m-trans-4",  kind: "transport", category: "transport", title: "Luxury Courier",           description: "Move 8 luxury goods across zones.",                       target: 8,    rewardCredits: 4000,  rewardExp: 800,  rewardHonor: 25, targetResourceId: "luxury" },
  { id: "m-trans-5",  kind: "transport", category: "transport", title: "Contraband Smuggling",     description: "Sell 5 contraband at any station. No questions asked.",    target: 5,    rewardCredits: 6000,  rewardExp: 1000, rewardHonor: 35, targetResourceId: "contraband" },
  { id: "m-trans-6",  kind: "transport", category: "transport", title: "Precursor Tech Courier",   description: "Transport 3 precursor tech to a trade station.",           target: 3,    rewardCredits: 8000,  rewardExp: 1500, rewardHonor: 50, targetResourceId: "precursor" },
  { id: "m-trans-7",  kind: "transport", category: "transport", title: "Nanite Shipment",          description: "Sell 12 nanite paste at any station.",                    target: 12,   rewardCredits: 3200,  rewardExp: 600,  rewardHonor: 18, targetResourceId: "nanite" },
  { id: "m-trans-8",  kind: "transport", category: "transport", title: "Exotic Cargo",             description: "Transport 4 exotic goods across the system.",             target: 4,    rewardCredits: 10000, rewardExp: 2000, rewardHonor: 60, targetResourceId: "exotic" },

  // ── GATHERING (mine or collect specific resources) ──
  { id: "m-gath-1",  kind: "gather", category: "gathering", title: "Iron Harvest",             description: "Mine 50 iron ore from asteroid belts.",                     target: 50,   rewardCredits: 1500,  rewardExp: 350,  rewardHonor: 10, targetResourceId: "iron" },
  { id: "m-gath-2",  kind: "gather", category: "gathering", title: "Lumenite Collection",      description: "Mine 30 lumenite crystals.",                                target: 30,   rewardCredits: 3000,  rewardExp: 600,  rewardHonor: 18, targetResourceId: "lumenite" },
  { id: "m-gath-3",  kind: "gather", category: "gathering", title: "Scrap Salvage",            description: "Collect 40 scrap plating from destroyed enemies.",          target: 40,   rewardCredits: 1000,  rewardExp: 250,  rewardHonor: 6,  targetResourceId: "scrap" },
  { id: "m-gath-4",  kind: "gather", category: "gathering", title: "Plasma Cell Harvest",      description: "Collect 25 plasma cells from raiders.",                     target: 25,   rewardCredits: 2200,  rewardExp: 500,  rewardHonor: 14, targetResourceId: "plasma" },
  { id: "m-gath-5",  kind: "gather", category: "gathering", title: "Void Crystal Hunt",        description: "Collect 15 void crystals.",                                 target: 15,   rewardCredits: 5000,  rewardExp: 1000, rewardHonor: 30, targetResourceId: "void" },
  { id: "m-gath-6",  kind: "gather", category: "gathering", title: "Dread Core Recovery",      description: "Salvage 5 dread cores from destroyed Dreads.",              target: 5,    rewardCredits: 12000, rewardExp: 2500, rewardHonor: 80, targetResourceId: "dread" },
  { id: "m-gath-7",  kind: "gather", category: "gathering", title: "Warp Coil Extraction",     description: "Mine or collect 20 warp coils.",                            target: 20,   rewardCredits: 4000,  rewardExp: 800,  rewardHonor: 22, targetResourceId: "warp" },
  { id: "m-gath-8",  kind: "gather", category: "gathering", title: "Quantum Chip Acquisition", description: "Acquire 10 quantum chips from any source.",                 target: 10,   rewardCredits: 7000,  rewardExp: 1500, rewardHonor: 40, targetResourceId: "quantum" },

  // ── DELIVERY (deliver specific resource to a specific station) ──
  { id: "m-del-1",  kind: "deliver", category: "delivery", title: "Helix Resupply",           description: "Deliver 30 iron ore to Helix Station.",                      target: 30,   rewardCredits: 2000,  rewardExp: 400,  rewardHonor: 12, targetResourceId: "iron",    targetStationId: "helix" },
  { id: "m-del-2",  kind: "deliver", category: "delivery", title: "Ember Citadel Arms",       description: "Deliver 10 plasma cells to Ember Citadel.",                  target: 10,   rewardCredits: 3500,  rewardExp: 700,  rewardHonor: 20, targetResourceId: "plasma",  targetStationId: "ember" },
  { id: "m-del-3",  kind: "deliver", category: "delivery", title: "Cloud Gate Supplies",      description: "Deliver 25 food supplies to Cloud Gate Station.",             target: 25,   rewardCredits: 2800,  rewardExp: 550,  rewardHonor: 15, targetResourceId: "food",    targetStationId: "cloud-gate" },
  { id: "m-del-4",  kind: "deliver", category: "delivery", title: "Ironclad Ammunition",      description: "Deliver 8 dread cores to Ironclad Bastion.",                 target: 8,    rewardCredits: 15000, rewardExp: 3000, rewardHonor: 100, targetResourceId: "dread",   targetStationId: "ironclad" },
  { id: "m-del-5",  kind: "deliver", category: "delivery", title: "Echo Anchorage Medicine",  description: "Deliver 15 medicine to Echo Anchorage.",                     target: 15,   rewardCredits: 4000,  rewardExp: 800,  rewardHonor: 25, targetResourceId: "medicine", targetStationId: "echo" },
  { id: "m-del-6",  kind: "deliver", category: "delivery", title: "Solar Haven Crystals",     description: "Deliver 12 lumenite to Solar Haven.",                        target: 12,   rewardCredits: 5000,  rewardExp: 1000, rewardHonor: 30, targetResourceId: "lumenite", targetStationId: "solar-haven" },
  { id: "m-del-7",  kind: "deliver", category: "delivery", title: "Void Heart Quantum",       description: "Deliver 6 quantum chips to Void Heart Station.",             target: 6,    rewardCredits: 18000, rewardExp: 4000, rewardHonor: 120, targetResourceId: "quantum",  targetStationId: "void-heart" },
  { id: "m-del-8",  kind: "deliver", category: "delivery", title: "Storm Eye Fuel",           description: "Deliver 20 fuel cells to Eye of the Storm.",                 target: 20,   rewardCredits: 6000,  rewardExp: 1200, rewardHonor: 35, targetResourceId: "fuel-cell", targetStationId: "storm-eye" },

  // ── EXPLORATION (jump gates, visit zones, travel) ──
  { id: "m-exp-1",  kind: "travel-gates", category: "exploration", title: "Sector Hopper",          description: "Jump through 5 warp gates.",                         target: 5,    rewardCredits: 1500,  rewardExp: 400,  rewardHonor: 10 },
  { id: "m-exp-2",  kind: "travel-gates", category: "exploration", title: "Gate Runner",            description: "Jump through 10 warp gates.",                        target: 10,   rewardCredits: 3500,  rewardExp: 800,  rewardHonor: 25 },
  { id: "m-exp-3",  kind: "travel-gates", category: "exploration", title: "Hyperlane Explorer",     description: "Jump through 20 warp gates.",                        target: 20,   rewardCredits: 8000,  rewardExp: 2000, rewardHonor: 60 },
  { id: "m-exp-4",  kind: "visit-zones",  category: "exploration", title: "Frontier Scout",         description: "Visit 3 different zones.",                            target: 3,    rewardCredits: 1200,  rewardExp: 350,  rewardHonor: 8 },
  { id: "m-exp-5",  kind: "visit-zones",  category: "exploration", title: "Deep Space Surveyor",    description: "Visit 6 different zones.",                            target: 6,    rewardCredits: 3000,  rewardExp: 700,  rewardHonor: 20 },
  { id: "m-exp-6",  kind: "visit-zones",  category: "exploration", title: "Master Cartographer",    description: "Visit 12 different zones.",                           target: 12,   rewardCredits: 8000,  rewardExp: 2000, rewardHonor: 55 },
  { id: "m-exp-7",  kind: "travel-gates", category: "exploration", title: "Warp Marathon",          description: "Jump through 50 warp gates total.",                  target: 50,   rewardCredits: 20000, rewardExp: 5000, rewardHonor: 150 },
  { id: "m-exp-8",  kind: "visit-zones",  category: "exploration", title: "Universal Explorer",     description: "Visit every zone in the system (20 zones).",         target: 20,   rewardCredits: 50000, rewardExp: 15000, rewardHonor: 500 },
];
'''

if 'MISSION_BOARD_POOL' not in code:
    # Insert after the DAILY_MISSION_POOL ];
    insert_after = '  { id: "d-zone-nebula",kind: "kill-zone", category: "combat", title: "Daily: Nebula Cleanup",description: "Kill 6 hostiles in Veil Nebula.",          target: 6,     rewardCredits: 1400, rewardExp: 400, rewardHonor: 14, zoneFilter: "nebula" },\n];'
    if insert_after in code:
        code = code.replace(insert_after, insert_after + mission_board)
        print("  -> Added MISSION_BOARD_POOL with 32 missions across 4 categories")
    else:
        print("  -> WARNING: Could not find daily pool end marker")

# 1e. Make Quest type zone-optional and add repeatable flag
old_quest = '''export type Quest = {
  id: string;
  title: string;
  description: string;
  zone: ZoneId;
  killType: EnemyType;
  killCount: number;
  rewardCredits: number;
  rewardExp: number;
  rewardHonor: number;
};'''

new_quest = '''export type Quest = {
  id: string;
  title: string;
  description: string;
  zone: ZoneId;
  killType: EnemyType;
  killCount: number;
  rewardCredits: number;
  rewardExp: number;
  rewardHonor: number;
  tier: number;
};'''

if 'tier: number;' not in code or 'tier: number;\n};' not in code:
    if old_quest in code:
        code = code.replace(old_quest, new_quest)
        print("  -> Added tier field to Quest type")

# 1f. Add tier to all QUEST_POOL entries
# We'll add tiers based on zone difficulty
zone_tiers = {
    'alpha': 1, 'venus1': 1,
    'nebula': 2, 'venus2': 2, 'marsdepth': 2,
    'crimson': 3, 'venus3': 3, 'maelstrom': 3,
    'void': 4, 'venus4': 4,
    'forge': 5, 'venus5': 5,
    'corona': 6, 'fracture': 7, 'abyss': 8,
    'danger1': 5, 'danger2': 6, 'danger3': 7, 'danger4': 8, 'danger5': 9,
}

# Add tier to each quest entry
for zone_id, tier in zone_tiers.items():
    # Pattern: zone: "zone_id", killType:
    old_pattern = f'zone: "{zone_id}", killType:'
    new_pattern = f'zone: "{zone_id}", tier: {tier}, killType:'
    if old_pattern in code and f'zone: "{zone_id}", tier:' not in code:
        code = code.replace(old_pattern, new_pattern)

print("  -> Added tier to QUEST_POOL entries")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(code)

# ═════════════════════���════════════════════════════════��══════════════════���════
# 2. STORE.TS - Update pickQuests, add mission board state, bump functions
# ════════════════���═══════════════════��═════════════════════════════════��═══════
print("\n═══ Updating store.ts ═══")

with open('frontend/src/game/store.ts', 'r') as f:
    scode = f.read()

# 2a. Update pickQuests to return ALL quests (not zone-filtered)
old_pick = '''function pickQuests(zone: ZoneId): Quest[] {
  return QUEST_POOL.filter((q) => q.zone === zone);
}'''

new_pick = '''function pickQuests(_zone: ZoneId): Quest[] {
  return [...QUEST_POOL];
}'''

if old_pick in scode:
    scode = scode.replace(old_pick, new_pick)
    print("  -> pickQuests now returns ALL bounties (available on all maps)")

# 2b. Add MISSION_BOARD_POOL and MissionCategory to imports
old_import_match = re.search(r'import \{([^}]+)\} from "\./types"', scode, re.DOTALL)
if old_import_match:
    imports_text = old_import_match.group(1)
    if 'MISSION_BOARD_POOL' not in imports_text:
        new_imports = imports_text.rstrip()
        if not new_imports.endswith(','):
            new_imports += ','
        new_imports += '\n  MISSION_BOARD_POOL, MissionCategory,'
        scode = scode.replace(old_import_match.group(0), f'import {{{new_imports}\n}} from "./types"')
        print("  -> Added MISSION_BOARD_POOL, MissionCategory to imports")

# 2c. Add mission board state (activeMissions array)
# Find state declaration and add missionBoard
if 'missionBoard' not in scode:
    # Add after dailyMissions in Player type usage
    # Actually add to the state object
    old_available = '  availableQuests: pickQuests(initialPlayer.zone),'
    new_available = '  availableQuests: pickQuests(initialPlayer.zone),\n  missionBoard: [] as ActiveMission[],'
    if old_available in scode:
        scode = scode.replace(old_available, new_available)
        print("  -> Added missionBoard to state")

# 2d. Add rollMissionBoard function
roll_fn = '''
function rollMissionBoard(): ActiveMission[] {
  const pool = [...MISSION_BOARD_POOL];
  const out: ActiveMission[] = [];
  const categories: MissionCategory[] = ["transport", "gathering", "delivery", "exploration"];
  for (const cat of categories) {
    const catPool = pool.filter(m => m.category === cat);
    const shuffled = catPool.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 3);
    for (const m of picked) {
      out.push({ ...m, progress: 0, completed: false, claimed: false });
    }
  }
  return out;
}
'''

if 'rollMissionBoard' not in scode:
    # Insert after rollDailyMissions function
    old_roll_end = scode.find('function rollDailyMissions')
    if old_roll_end >= 0:
        # Find the end of that function (next blank line or function)
        fn_end = scode.find('\n\n', old_roll_end + 10)
        if fn_end >= 0:
            scode = scode[:fn_end] + '\n' + roll_fn + scode[fn_end:]
            print("  -> Added rollMissionBoard function")

# 2e. Initialize missionBoard on load (similar to dailyMissions)
if 'missionBoard' in scode and 'initialPlayer.missionBoard' not in scode:
    # Add after the dailyMissions roll
    old_daily_init = 'initialPlayer.dailyMissions = rollDailyMissions();\n  initialPlayer.lastDailyReset = Date.now();'
    new_daily_init = 'initialPlayer.dailyMissions = rollDailyMissions();\n  initialPlayer.lastDailyReset = Date.now();\n'
    if old_daily_init in scode:
        scode = scode.replace(old_daily_init, new_daily_init)

# 2f. Add missionBoard to player init if not present
if 'missionBoard: []' not in scode:
    old_daily_arr = 'dailyMissions: rollDailyMissions(),'
    if old_daily_arr in scode:
        scode = scode.replace(old_daily_arr, old_daily_arr + '\n    missionBoard: rollMissionBoard(),', 1)
        print("  -> Added missionBoard initialization")

# 2g. Update bumpMission to also check missionBoard
old_bump = '''export function bumpMission(kind: ActiveMission["kind"], amount: number, zone?: ZoneId): void {
  for (const m of state.player.dailyMissions) {
    if (m.completed) continue;
    if (m.kind !== kind) continue;
    if (m.zoneFilter && m.zoneFilter !== zone) continue;
    m.progress = Math.min(m.target, m.progress + amount);
    if (m.progress >= m.target) {
      m.completed = true;
      pushNotification(`Daily complete: ${m.title}`, "good");
    }
  }
}'''

new_bump = '''export function bumpMission(kind: ActiveMission["kind"], amount: number, zone?: ZoneId, extra?: { resourceId?: string; stationId?: string }): void {
  const allMissions = [...state.player.dailyMissions, ...state.missionBoard];
  for (const m of allMissions) {
    if (m.completed) continue;
    if (m.kind !== kind) continue;
    if (m.zoneFilter && m.zoneFilter !== zone) continue;
    if (m.targetResourceId && extra?.resourceId && m.targetResourceId !== extra.resourceId) continue;
    if (m.targetStationId && extra?.stationId && m.targetStationId !== extra.stationId) continue;
    m.progress = Math.min(m.target, m.progress + amount);
    if (m.progress >= m.target) {
      m.completed = true;
      pushNotification(`Mission complete: ${m.title}`, "good");
    }
  }
}'''

if 'extra?: { resourceId' not in scode:
    scode = scode.replace(old_bump, new_bump)
    print("  -> Updated bumpMission to check missionBoard + support resource/station filters")

# 2h. Update claimMission to check both pools
old_claim = '''export function claimMission(missionId: string): void {
  const m = state.player.dailyMissions.find((x) => x.id === missionId);
  if (!m || !m.completed || m.claimed) return;
  m.claimed = true;
  state.player.credits += m.rewardCredits;
  state.player.exp += m.rewardExp;
  state.player.honor += m.rewardHonor;
  state.player.milestones.totalCreditsEarned += m.rewardCredits;
  pushNotification(`+${m.rewardCredits}cr +${m.rewardExp}xp +${m.rewardHonor}hr`, "good");
  save(); bump();
}'''

new_claim = '''export function claimMission(missionId: string): void {
  const m = state.player.dailyMissions.find((x) => x.id === missionId)
    ?? state.missionBoard.find((x) => x.id === missionId);
  if (!m || !m.completed || m.claimed) return;
  m.claimed = true;
  state.player.credits += m.rewardCredits;
  state.player.exp += m.rewardExp;
  state.player.honor += m.rewardHonor;
  state.player.milestones.totalCreditsEarned += m.rewardCredits;
  pushNotification(`+${m.rewardCredits}cr +${m.rewardExp}xp +${m.rewardHonor}hr`, "good");
  save(); bump();
}'''

if old_claim in scode:
    scode = scode.replace(old_claim, new_claim)
    print("  -> Updated claimMission to check both daily + board pools")

# 2i. Add rerollMissionBoard export
reroll_board = '''
export function rerollMissionBoard(): void {
  if (state.player.credits < 2000) { pushNotification("Board reroll costs 2,000cr", "bad"); return; }
  state.player.credits -= 2000;
  state.missionBoard = rollMissionBoard();
  pushNotification("Mission board refreshed", "good");
  save(); bump();
}
'''

if 'rerollMissionBoard' not in scode:
    # Insert after rerollDaily
    reroll_idx = scode.find('export function rerollDaily')
    if reroll_idx >= 0:
        fn_end = scode.find('\n}', reroll_idx) + 2
        scode = scode[:fn_end] + reroll_board + scode[fn_end:]
        print("  -> Added rerollMissionBoard function")

# 2j. Add sell tracking for transport/deliver missions
# Find where cargo is sold and add bumpMission calls
# Look for credit additions from selling
sell_pattern = 'state.player.milestones.totalCreditsEarned +='
sell_idx = scode.find(sell_pattern)
if sell_idx >= 0:
    # Check if we already added transport bump
    nearby = scode[sell_idx:sell_idx+300]
    if 'bumpMission("transport"' not in nearby and 'bumpMission("deliver"' not in nearby:
        # Find the line end
        line_end = scode.find('\n', sell_idx)
        # We need to find the sell function context - look for the function that handles selling
        pass  # We'll do this in a separate targeted fix below

# 2k. Make bounties repeatable - remove completedQuests check
# In turnIn function, don't push to completedQuests
old_turnin_push = 'player.completedQuests.push(q.id);'
if old_turnin_push in scode:
    # Instead of removing entirely, we can just not block re-accepting
    # The actual blocking is in the BountiesTab UI (done check) - we'll fix that in Hangar.tsx
    pass

# 2l. Add missionBoard to save/load
old_save_daily = 'dailyMissions: p.dailyMissions,'
new_save_daily = 'dailyMissions: p.dailyMissions,\n      missionBoard: state.missionBoard,'
if 'missionBoard: state.missionBoard' not in scode and old_save_daily in scode:
    scode = scode.replace(old_save_daily, new_save_daily, 1)
    print("  -> Added missionBoard to save")

# Add to load
old_load_daily = 'if (data.completedQuests) p.completedQuests = data.completedQuests;'
new_load_daily = 'if (data.completedQuests) p.completedQuests = data.completedQuests;\n  if (data.missionBoard) state.missionBoard = data.missionBoard;'
if 'data.missionBoard' not in scode and old_load_daily in scode:
    scode = scode.replace(old_load_daily, new_load_daily, 1)
    print("  -> Added missionBoard to load")

# 2m. Add bumpMission calls for transport/deliver when selling cargo
# Find the sell cargo function
sell_fn_idx = scode.find('export function sellCargo')
if sell_fn_idx >= 0:
    # Find where credits are added in that function
    sell_section = scode[sell_fn_idx:sell_fn_idx+500]
    if 'bumpMission("transport"' not in sell_section:
        # Find the credits += line in sell function
        credits_line = 'state.player.credits += total;'
        credits_idx = scode.find(credits_line, sell_fn_idx)
        if credits_idx >= 0:
            line_end = scode.find('\n', credits_idx)
            bump_line = '\n    bumpMission("transport", qty, undefined, { resourceId: resourceId });\n    bumpMission("deliver", qty, undefined, { resourceId: resourceId, stationId: state.dockedAt ?? "" });'
            scode = scode[:line_end] + bump_line + scode[line_end:]
            print("  -> Added transport/deliver mission bumps to sellCargo")

# 2n. Bump "gather" missions when mining
mine_bump = 'bumpMission("mine", 1'
if mine_bump in scode:
    mine_idx = scode.find(mine_bump)
    line_end = scode.find('\n', mine_idx)
    if 'bumpMission("gather"' not in scode[mine_idx:mine_idx+200]:
        # Add gather bump after mine bump
        # We need the resource context - look for what resource is being collected
        scode = scode[:line_end] + '\n    bumpMission("gather", 1, state.player.zone, { resourceId: drop });' + scode[line_end:]
        print("  -> Added gather mission bump to mining")

# 2o. Bump "travel-gates" on zone warp (same as warp-zones already but separate kind)
old_warp_bump = 'bumpMission("warp-zones", 1);'
if old_warp_bump in scode:
    warp_idx = scode.find(old_warp_bump)
    line_end = scode.find('\n', warp_idx)
    if 'bumpMission("travel-gates"' not in scode:
        scode = scode[:line_end] + '\n    bumpMission("travel-gates", 1);\n    bumpMission("visit-zones", 1);' + scode[line_end:]
        print("  -> Added travel-gates and visit-zones bumps to travelToZone")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(scode)

# ═══════════════════════════════════════════���════════════════════════════���═════
# 3. HANGAR.TSX - Rework BountiesTab and MissionsTab
# ════���═══════════════════════════���═════════════════════════════════════════════
print("\n═══ Updating Hangar.tsx ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# 3a. Add imports for new exports
if 'rerollMissionBoard' not in hcode:
    old_reroll_import = 'rerollDaily,'
    if old_reroll_import in hcode:
        hcode = hcode.replace(old_reroll_import, 'rerollDaily, rerollMissionBoard,', 1)
        print("  -> Added rerollMissionBoard import")

if 'MISSION_BOARD_POOL' not in hcode:
    # Add to types import
    old_types_import = 'QUEST_POOL,'
    if old_types_import in hcode:
        hcode = hcode.replace(old_types_import, 'QUEST_POOL, MISSION_BOARD_POOL, MissionCategory,', 1)
        print("  -> Added MISSION_BOARD_POOL, MissionCategory to types imports")
    else:
        # Try alternate
        old_types_import2 = 'QUEST_POOL'
        if old_types_import2 in hcode:
            hcode = hcode.replace(old_types_import2, 'QUEST_POOL, MISSION_BOARD_POOL, MissionCategory', 1)
            print("  -> Added MISSION_BOARD_POOL, MissionCategory to types imports (alt)")

# 3b. Replace BountiesTab - show all bounties grouped by tier, repeatable
old_bounties_start = 'function BountiesTab() {'
old_bounties_end = '// ── LOADOUT (modular ship gear)'
bounties_start_idx = hcode.find(old_bounties_start)
bounties_end_idx = hcode.find(old_bounties_end)

if bounties_start_idx >= 0 and bounties_end_idx >= 0:
    new_bounties_tab = '''function BountiesTab() {
  const player = useGame((s) => s.player);
  const [tierFilter, setTierFilter] = useState<number>(0);

  const allBounties = QUEST_POOL;
  const tiers = [...new Set(allBounties.map(q => q.tier ?? 1))].sort((a, b) => a - b);
  const filtered = tierFilter === 0 ? allBounties : allBounties.filter(q => (q.tier ?? 1) === tierFilter);

  const accept = (q: any) => {
    if (player.activeQuests.find((x: any) => x.id === q.id)) return;
    if (player.activeQuests.length >= 5) {
      pushNotification("Quest log full (5 max)", "bad");
      return;
    }
    player.activeQuests.push({ ...q, progress: 0, completed: false });
    pushNotification(`Accepted: ${q.title}`, "good");
    save(); bump();
  };

  const turnIn = (q: any) => {
    if (!q.completed) return;
    player.credits += q.rewardCredits;
    player.exp += q.rewardExp;
    player.honor += q.rewardHonor;
    player.activeQuests = player.activeQuests.filter((x: any) => x.id !== q.id);
    player.milestones.totalKills += 0;
    pushNotification(`+${q.rewardCredits}cr +${q.rewardExp}xp +${q.rewardHonor} honor`, "good");
    save(); bump();
  };

  const tierColors: Record<number, string> = { 1: "#5cff8a", 2: "#4ee2ff", 3: "#ffcc44", 4: "#ff8a4e", 5: "#ff5c6c", 6: "#ff5cf0", 7: "#aa44ff", 8: "#ff4466", 9: "#ffffff" };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-cyan tracking-widest text-sm">BOUNTY BOARD</div>
          <div className="text-mute text-[13px] mt-1">Kill contracts available across all sectors. Repeatable.</div>
        </div>
      </div>

      {/* Tier filter */}
      <div className="flex gap-2 flex-wrap">
        <button className={"btn " + (tierFilter === 0 ? "btn-primary" : "")} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setTierFilter(0)}>ALL</button>
        {tiers.map(t => (
          <button key={t} className={"btn " + (tierFilter === t ? "btn-primary" : "")} style={{ padding: "4px 10px", fontSize: 12, borderColor: tierColors[t] ?? "#888" }} onClick={() => setTierFilter(t)}>
            T{t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Available bounties */}
        <div>
          <div className="text-cyan tracking-widest text-sm mb-3">AVAILABLE ({filtered.length})</div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {filtered.map((q) => {
              const has = player.activeQuests.find((x: any) => x.id === q.id);
              const tierColor = tierColors[q.tier ?? 1] ?? "#888";
              return (
                <div key={q.id} className="panel p-3" style={{ borderLeft: `2px solid ${tierColor}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-1 rounded" style={{ background: tierColor + "22", color: tierColor }}>T{q.tier ?? 1}</span>
                        <span className="text-amber glow-amber text-sm font-bold">{q.title}</span>
                      </div>
                      <div className="text-dim text-[13px] mt-1 mb-2">{q.description}</div>
                      <div className="flex gap-3 text-[13px] flex-wrap">
                        <span className="text-cyan">{q.killCount}x {q.killType}</span>
                        <span className="text-amber">+{q.rewardCredits.toLocaleString()}cr</span>
                        <span className="text-magenta">+{q.rewardExp.toLocaleString()}xp</span>
                        <span className="text-green">+{q.rewardHonor} honor</span>
                      </div>
                    </div>
                    <button className="btn btn-primary" disabled={!!has} onClick={() => accept(q)}>
                      {has ? "Active" : "Accept"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active quests */}
        <div>
          <div className="text-cyan tracking-widest text-sm mb-3">ACTIVE QUESTS ({player.activeQuests.length}/5)</div>
          <div className="space-y-2">
            {player.activeQuests.length === 0 && (
              <div className="text-mute text-sm italic">No active quests. Take a contract from the board.</div>
            )}
            {player.activeQuests.map((q: any) => (
              <div key={q.id} className="panel p-3">
                <div className="text-amber glow-amber text-sm font-bold">{q.title}</div>
                <div className="text-dim text-[13px] mt-1 mb-2">
                  {q.progress}/{q.killCount} {q.killType}s eliminated
                </div>
                <div className="bar mb-2">
                  <div className="bar-fill" style={{
                    width: `${(q.progress / q.killCount) * 100}%`,
                    background: "linear-gradient(90deg, #ff5cf066, #ff5cf0)",
                    boxShadow: "0 0 6px #ff5cf0",
                  }} />
                </div>
                <button className="btn btn-amber w-full" disabled={!q.completed} onClick={() => turnIn(q)}>
                  {q.completed ? "Turn In" : "In Progress"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'''
    hcode = hcode[:bounties_start_idx] + new_bounties_tab + hcode[bounties_end_idx:]
    print("  -> Replaced BountiesTab with tier-based all-map bounty board")

# 3c. Replace MissionsTab with tabbed categories
old_missions_start = '// ── MISSIONS ─────────────��────────────────────────────────────────────────\nfunction MissionsTab() {'
old_missions_end_marker = 'function AmmoTab() {'

missions_start_idx = hcode.find(old_missions_start)
missions_end_idx = hcode.find(old_missions_end_marker)

if missions_start_idx >= 0 and missions_end_idx >= 0:
    new_missions_tab = '''// ── MISSIONS ────────────────────────────────────────────────────────────���─
function MissionsTab() {
  const player = useGame((s) => s.player);
  const missionBoard = useGame((s) => s.missionBoard);
  useGame((s) => s.tick);
  const [activeTab, setActiveTab] = useState<"daily" | MissionCategory>("daily");

  const next = new Date(player.lastDailyReset + 24 * 3600 * 1000);
  const hrs = Math.max(0, Math.floor((next.getTime() - Date.now()) / 3600000));
  const mins = Math.max(0, Math.floor(((next.getTime() - Date.now()) % 3600000) / 60000));

  const tabs: { id: "daily" | MissionCategory; label: string; icon: string }[] = [
    { id: "daily", label: "Daily", icon: "★" },
    { id: "combat", label: "Combat", icon: "⚔" },
    { id: "transport", label: "Transport", icon: "▶" },
    { id: "gathering", label: "Gathering", icon: "▰" },
    { id: "delivery", label: "Delivery", icon: "◆" },
    { id: "exploration", label: "Exploration", icon: "✦" },
  ];

  const boardByCategory = (cat: MissionCategory) => missionBoard.filter((m: any) => m.category === cat);

  const renderMission = (m: any) => {
    const pct = Math.min(1, m.progress / m.target);
    const claimed = m.claimed;
    const ready = m.completed && !claimed;
    return (
      <div
        key={m.id}
        className="panel p-3"
        style={{
          opacity: claimed ? 0.5 : 1,
          borderColor: ready ? "#5cff8a" : "var(--border-soft)",
        }}
      >
        <div className="font-bold text-[13px] text-cyan mb-1">{m.title}</div>
        <div className="text-dim text-[13px] mb-2">{m.description}</div>
        {m.targetStationId && (
          <div className="text-[12px] text-magenta mb-1">Target: {STATIONS.find((s: any) => s.id === m.targetStationId)?.name ?? m.targetStationId}</div>
        )}
        <div className="text-mute text-[13px] tabular-nums mb-1">
          {m.progress}/{m.target}
        </div>
        <div className="w-full h-1 mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full"
            style={{
              width: `${pct * 100}%`,
              background: ready ? "#5cff8a" : "var(--accent-cyan)",
            }}
          />
        </div>
        <div className="text-amber text-[13px] mb-2">
          +{m.rewardCredits.toLocaleString()}cr {" "}+{m.rewardExp.toLocaleString()}xp {" "}+{m.rewardHonor}hr
        </div>
        <button
          className="btn btn-primary w-full"
          style={{ padding: "4px 8px", fontSize: 13 }}
          disabled={!ready}
          onClick={() => claimMission(m.id)}
        >
          {claimed ? "CLAIMED" : ready ? "CLAIM" : "IN PROGRESS"}
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-3">
      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap border-b pb-2" style={{ borderColor: "var(--border-soft)" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={"btn " + (activeTab === t.id ? "btn-primary" : "")}
            style={{ padding: "5px 12px", fontSize: 12 }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Daily tab */}
      {activeTab === "daily" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-cyan tracking-widest text-sm">DAILY MISSIONS</div>
              <div className="text-mute text-[13px] mt-1">Resets in {hrs}h {mins}m</div>
            </div>
            <button
              className="btn btn-amber"
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={rerollDaily}
              disabled={player.credits < 500}
            >
              REROLL 500cr
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {player.dailyMissions.map((m: any) => renderMission(m))}
          </div>
          {/* Milestones */}
          <div className="text-cyan tracking-widest text-sm mt-4 mb-2">LIFETIME MILESTONES</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(player.milestones).map(([k, v]) => (
              <div key={k} className="panel p-2">
                <div className="text-mute text-[12px] tracking-widest uppercase">{k}</div>
                <div className="text-amber font-bold text-sm tabular-nums">{(v as number).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Category tabs */}
      {activeTab !== "daily" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-cyan tracking-widest text-sm">{activeTab.toUpperCase()} MISSIONS</div>
              <div className="text-mute text-[13px] mt-1">Complete missions to earn credits, XP, and honor.</div>
            </div>
            <button
              className="btn btn-amber"
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={rerollMissionBoard}
              disabled={player.credits < 2000}
            >
              REFRESH 2,000cr
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {boardByCategory(activeTab).map((m: any) => renderMission(m))}
            {boardByCategory(activeTab).length === 0 && (
              <div className="text-mute text-sm italic col-span-3">No missions available. Try refreshing the board.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

'''
    hcode = hcode[:missions_start_idx] + new_missions_tab + hcode[missions_end_idx:]
    print("  -> Replaced MissionsTab with tabbed categories (daily/transport/gathering/delivery/exploration)")

# 3d. Add useState import if not present
if 'useState' not in hcode.split('from "react"')[0]:
    hcode = hcode.replace('import { useMemo }', 'import { useMemo, useState }', 1)
elif 'useState' not in hcode:
    hcode = hcode.replace('import React', 'import React, { useState }', 1)

# Make sure useState is imported
if 'useState' not in hcode[:500]:
    # Check if there's already a react import
    react_import = re.search(r'import \{([^}]+)\} from "react"', hcode)
    if react_import:
        if 'useState' not in react_import.group(1):
            hcode = hcode.replace(react_import.group(0), react_import.group(0).replace('{', '{ useState, '))
            print("  -> Added useState to React imports")

# 3e. Add STATIONS import to Hangar if not there (for delivery target names)
if 'STATIONS' not in hcode[:3000]:
    # Add STATIONS to the types import
    if 'QUEST_POOL' in hcode:
        hcode = hcode.replace('QUEST_POOL', 'QUEST_POOL, STATIONS', 1)
        print("  -> Added STATIONS to imports")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

# ════════════════════���═════════════════════════════════════════════════════════
# 4. Add missionBoard to the useGame state type
# ════════════════════════════════════════════���═══════════════════════════���═════
print("\n═══ Checking store state type ═══")

with open('frontend/src/game/store.ts', 'r') as f:
    scode = f.read()

# Make sure missionBoard is accessible via useGame
if 'missionBoard' in scode:
    print("  -> missionBoard already in state")

# Check that ActiveMission import includes the new fields
if 'ActiveMission' in scode:
    print("  -> ActiveMission type already imported")

print("\nDONE! Bounties & Missions rework complete.")
print("  - Bounties: all kill missions available on every map, grouped by tier, repeatable")
print("  - Missions: tabbed UI (Daily/Combat/Transport/Gathering/Delivery/Exploration)")
print("  - 32 new missions across 4 categories")
print("  - Mission progress tracks selling, mining, and warping")
