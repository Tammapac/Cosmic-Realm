# Cosmic Realm — Progression & Economy

## Levels & XP

Kills, missions, bounties and dungeons grant XP. Each level-up:
- fully restores hull & shield,
- grants **1 skill point** (skill tree) and **2 attribute points**
  (pilot dossier),
- raises the module-shop tier cap (tier ≈ level/4, up to T5).

## Honor & Ranks

Honor comes from kills (higher classes give more), bounties and missions.
13 pilot ranks, shown as an insignia beside your name in space and in the
avatar console:

| Rank | Honor | | Rank | Honor |
|---|---|---|---|---|
| Recruit | 0 | | Commander | 80,000 |
| Space Pilot | 500 | | Captain | 200,000 |
| Basic Pilot | 2,000 | | Admiral | 500,000 |
| Pilot | 5,000 | | General | 1,200,000 |
| Chief Pilot | 12,000 | | Marshal | 3,000,000 |
| Lieutenant | 30,000 | | Grand Marshal | 8,000,000 |
| | | | **Legend** | 20,000,000 |

## Skill Tree (station Skills tab / shield button on the avatar console)

Four branches in a DarkOrbit-style talent tree — circular nodes with rank
rings, prerequisites along glowing connectors, 1 point per level, respec
for 2,000 cr (attributes are not reset):

- **Offense** — Power, Rapid Fire, Critical Systems, Volley, Snipe/Execute,
  Phase Pierce…
- **Defense** — Shield Capacitors, Energy Barrier, Fortress Mode, Recharge
  Matrix, Nano-Repair, Reinforced Hull, Reactive Plating, Bulwark Protocol…
- **Utility** — Cargo Frame, Trade Acumen, Deep Scanner, Thruster Tuning,
  Warp Navigator, Scavenger, Drone Commander, Drone Ops…
- **Engineering** — Coolant System, Power Capacitor, Target Computer,
  Warp Core Shunt, Overdrive Module, Singularity Core…

## Pilot Dossier (click your rank, top-left)

- **Attributes** — spend 2 points/level on Firepower (+1% dmg/pt),
  Resilience (+1.5% hull/pt), Shielding (+1.5% shield/pt), Thrust
  (+0.5% speed/pt). Applied server-side and budget-clamped (anti-cheat).
- **Career paths** — three passive professions level from what you do,
  10 tiers each with titles:
  - **Bounty Hunter** ← kills (+10× for boss kills): Recruit → … → Legend
  - **Miner** ← ore mined: Prospector → … → Asteroid King → Legend
  - **Trader** ← credits earned: Peddler → … → Trade Prince → Legend
- **Rankings** — the galactic leaderboard: top pilots by honor, level or
  kills, with clan tags, faction colors and podium medals.

## Milestones

Lifetime feats pay credit rewards in 5 tiers each: Combat Veteran (kills),
Belt Driller (ore), Tycoon (credits earned), Pathfinder (warps), Dread
Hunter (boss kills).

## Quests, Bounties, Missions

- **Bounty Board** (station tab) — repeatable kill contracts across all
  sectors, tier-filtered T1–T9, each showing the target map label (e.g.
  `[2-1]`); up to 5 active; turn in for credits/XP/honor.
- **Daily missions** — rotating dailies (kill sweeps, mining runs, credit
  hustles, sector rounds), rerollable.
- **Mission board** — transport, gathering, delivery (to named stations)
  and exploration contracts, up to high-value runs like Exotic Cargo or
  Universal Explorer (visit all 20 zones).

## Equipment & Loot

Ships carry **weapon / generator / module** slots (count per hull).
Modules drop from enemies and dungeons or are bought at stations. Drops
roll through the ARPG loot system — 7 rarities, affix rolls, item levels
and legendary uniques, all server-minted and audit-protected
(`LOOT_SYSTEM.md`).

The station **Loadout** tab is a DarkOrbit-style equipment screen: rotating
3D ship preview, categorized slot strips, a dense inventory grid with sell
mode and shop toggle, and rich hover **item cards** that compare any item
against what it would replace — green ▲ gains, red ▼ losses per stat.

## Economy

- **Credits** — universal currency; earned from kills, loot, missions,
  trading, milestones.
- **Commodity market** — 20+ resources (Scrap, Plasma Cells, Warp Coils,
  Void Crystals, Dread Cores, Iron, Lumenite, foods/meds/fuels, luxury,
  contraband, precursor tech…). Prices fluctuate over time per station
  with live trend arrows; every station specializes — the market table
  shows the best station to sell each resource. Buy low, haul, sell high.
- **Mining** — asteroid belts are mineable (iron, lumenite…); ore feeds
  the market, missions and factories.
- **Factories / Refinery** — 12 factory stations refine raw ore through
  recipes over real time; factory upgrades add job slots and speed.
- **Cargo** — hull-limited cargo hold (expandable via modules/skills);
  cargo drops on the market with one-click SELL ALL.
- **Consumables & ammo** — station market sells consumables ×1/×5 and
  laser/rocket rounds; services offer repair, drone repair and automation
  toggles (auto-restock / auto-repair / auto-shield).

## Social

- **Clans** — create/join clans (tags shown by names & leaderboard).
- **Chat** — system/global channels with the console chat window.
- **Leaderboard** — persistent server rankings updated on every save.
