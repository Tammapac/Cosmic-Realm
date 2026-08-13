/**
 * I-03 · Skill Matrix — data, copied VERBATIM from the design export.
 *
 * Source: Downloads/Cosmic Realm UI Upgrade (8).zip
 *   -> design_handoff_hangar_panels_strict_export/
 *      "Skill Matrix Panel (Cosmic Kit extract).dc.html"  (skillVals())
 *
 * Every coordinate, size, clip-path, rank cap, colour and link edge below is the
 * export's own. Do NOT round or "tidy" these: the tree is laid out in a fixed
 * CANVAS space (1240x860) and any change to a coordinate moves a node off its
 * beam. The node rows keep the export's tuple order:
 *
 *   [id, x, y, shape, name, icon, maxRank, description, per-rank effect]
 */

/** Node shapes — size and clip-path per tier, verbatim from SHAPE. */
export const SKILL_SHAPE = {
  n: { size: 46, clip: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", tier: "NODE" },
  e: { size: 60, clip: "polygon(50% 0,82% 18%,100% 50%,82% 82%,50% 100%,18% 82%,0 50%,18% 18%)", tier: "ELITE" },
  k: { size: 78, clip: "polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)", tier: "KEYSTONE" },
} as const;

export type SkillShapeKey = keyof typeof SKILL_SHAPE;

/** [id, x, y, shape, name, icon, maxRank, description, effect] */
export type SkillNodeRow = [string, number, number, SkillShapeKey, string, string, number, string, string];

export interface SkillTree {
  key: string;
  n: string;
  hex: string;
  glyph: string;
  nodes: SkillNodeRow[];
  links: [string, string][];
  start: Record<string, number>;
}

/** Total points the matrix can hold, respec price and the layout canvas —
 *  verbatim: const TOTAL=48, RESPEC_COST=2400, CANVAS={w:1240,h:860}. */
export const SKILL_TOTAL = 48;
export const SKILL_RESPEC_COST = 2400;
export const SKILL_CANVAS = { w: 1240, h: 860 };
export const SKILL_STEEL = "#5b6675";

/** Zoom + pan defaults and limits, verbatim from skillVals/skDown/skViewport. */
export const SKILL_ZOOM_MIN = 0.34;
export const SKILL_ZOOM_MAX = 1.5;
export const SKILL_ZOOM_DEFAULT = 0.5;
export const SKILL_ZOOM_STEP_IN = 1.18;
export const SKILL_ZOOM_STEP_OUT = 0.85;
export const SKILL_WHEEL_IN = 1.1;
export const SKILL_WHEEL_OUT = 0.91;
export const SKILL_PAN_DEFAULT = { x: 17, y: -4 };

/** Icon path prefix — the export's own `const IP`, rewritten from the design
 *  environment's repo-relative path to this project's served path. */
export const SKILL_ICON_PATH = "/assets/ui/items/";

export const SKILL_TREES: SkillTree[] = [
      {key:"off",n:"OFFENSIVE",hex:"#ff4d5e",glyph:"◤",
       nodes:[
        ["o1",620,60,"n","Focused Barrel","laser-t2",3,"Collimates the emitter so the beam holds shape further out.","+6% weapon range"],
        ["o2",440,150,"n","Overcharge","laser-t4",3,"Dumps capacitor reserve into the opening volley.","+9% burst damage"],
        ["o3",800,150,"n","Splinter Rounds","laser-t5",3,"Every fourth shot fragments on impact.","+4% splinter chance"],
        ["o4",280,250,"n","Heat Sink Bypass","mod1-t2",2,"Vents through the hull instead of the sink.","+1.4 s over heat cap"],
        ["o5",520,250,"e","Ion Lance","laser-t8",2,"A charged shot that ignores shielding entirely.","+18% lance damage"],
        ["o6",720,250,"e","Chain Detonator","laser-t6",2,"Kills detonate into nearby hulls.","+40% splash radius"],
        ["o7",960,250,"n","Rapid Cycler","genspeed-t2",3,"Lighter bolts cycle the chamber faster.","+8% fire rate"],
        ["o8",170,350,"n","Coolant Loop","mod1-t2",2,"Recirculates coolant between bursts.","-12% heat build"],
        ["o9",400,350,"n","Piercing Core","mod2-t3",2,"Denser slug carries through plating.","-25% armour on first hit"],
        ["o10",840,350,"n","Fracture Rounds","mod2-t4",2,"Stacking armour shred, up to five stacks.","+1 shred stack"],
        ["o11",1070,350,"n","Twin Feed","laser-t5",3,"Second feed line keeps both barrels hot.","+5% sustained damage"],
        ["o12",300,450,"e","Siege Mode","laser-t9",2,"Anchors the ship for a heavier firing solution.","+22% damage while anchored"],
        ["o13",620,450,"n","Target Lattice","mod0-t3",3,"Predictive tracking on moving hulls.","+7% accuracy"],
        ["o14",940,450,"e","Havoc Protocol","laser-t6",2,"Each kill shortens the next reload.","-0.4 s reload per kill"],
        ["o15",450,560,"n","Rupture Charge","mod2-t4",2,"Charges detonate a second time on armour.","+14% follow-up hit"],
        ["o16",790,560,"n","Weakpoint Scan","mod0-t3",3,"Highlights structural seams mid-fight.","+6% critical chance"],
        ["o17",200,660,"n","Kinetic Bloom","laser-t4",2,"Impact shock spreads through the frame.","+10% hull damage"],
        ["o18",620,660,"e","Nova Cascade","laser-t9",2,"Overloaded shots cascade between targets.","+1 chain target"],
        ["o19",1040,660,"n","Executioner","laser-t6",2,"Finishing blows against crippled hulls.","+18% damage under 30% hull"],
        ["o20",620,790,"k","Singularity Round","laser-t10",1,"Once per engagement the round collapses into a micro-singularity that drags every hull inward.","Unlocks Singularity Round"]],
       links:[["o1","o2"],["o1","o3"],["o2","o4"],["o2","o5"],["o3","o6"],["o3","o7"],
        ["o4","o8"],["o4","o9"],["o5","o9"],["o6","o10"],["o7","o10"],["o7","o11"],
        ["o8","o12"],["o9","o12"],["o9","o13"],["o10","o13"],["o10","o14"],["o11","o14"],
        ["o12","o15"],["o13","o15"],["o13","o16"],["o14","o16"],
        ["o15","o17"],["o15","o18"],["o16","o18"],["o16","o19"],
        ["o17","o20"],["o18","o20"],["o19","o20"]],
       start:{o1:2,o2:1}},
      {key:"def",n:"DEFENCE",hex:"#4ee2ff",glyph:"◇",
       nodes:[
        ["d1",620,50,"n","Plating Weave","genshield-t2",3,"Cross-woven plates spread impact along the frame.","+7% hull integrity"],
        ["d2",430,120,"n","Deflector Bias","genshield-t3",3,"Biases the emitter toward recharge.","+12% shield regen"],
        ["d3",810,120,"n","Reactive Mesh","genshield-t3",3,"Returns part of the blocked hit as heat.","+8% reflected heat"],
        ["d4",270,220,"e","Bulwark Field","genshield-t4",2,"Hard cap on incoming burst per second.","-15% burst ceiling"],
        ["d5",620,200,"n","Hull Lattice","mod0-t3",3,"Structural bracing eases every repair.","-20% repair cost"],
        ["d6",970,220,"e","Kinetic Sink","genshield-t4",2,"Feeds kinetic impacts into the capacitor.","+9% capacitor on hit"],
        ["d7",150,340,"n","Redundant Cells","mod1-t2",2,"Spare cells keep the grid alive.","+1 shield cell"],
        ["d8",430,320,"n","Regen Cells","mod1-t2",2,"Passive hull regeneration out of combat.","+0.4%/s hull regen"],
        ["d9",810,320,"n","Ablative Skin","mod3-t3",2,"First hit after a shield break is halved.","-50% break-through hit"],
        ["d10",1090,340,"n","Static Wash","genshield-t2",3,"Bleeds off charge before it reaches the hull.","+6% energy resist"],
        ["d11",300,450,"e","Anchor Plates","genshield-t4",2,"Locks plating against knockback.","-30% displacement"],
        ["d12",620,420,"n","Field Harmonics","genspeed-t3",3,"Tunes the shield to the incoming waveform.","+5% all resist"],
        ["d13",940,450,"e","Overshield","genshield-t4",2,"Excess regen banks into a thin overshield.","+120 overshield"],
        ["d14",180,570,"n","Damage Control","mod2-t3",2,"Automated crews patch breaches mid-fight.","+1 breach repair"],
        ["d15",450,560,"n","Guardian Link","mod1-t2",2,"Shares part of the shield with the wing.","+8% wing shield"],
        ["d16",790,560,"n","Null Coating","mod3-t3",2,"Dampens scanning and lock-on strength.","-14% enemy lock speed"],
        ["d17",1060,570,"n","Thermal Baffle","mod2-t4",2,"Splits heat across the outer shell.","+9% heat resist"],
        ["d18",430,680,"n","Phase Bastion","genshield-t4",2,"A brief phase-out voids one volley.","+1 voided volley"],
        ["d19",810,680,"n","Last Stand","mod0-t3",2,"Below quarter hull the plating hardens.","+22% resist under 25%"],
        ["d20",620,790,"k","Aegis Prime","genshield-t4",1,"The shield never fully drops — overflow forms a second, thinner layer that regenerates on its own.","Unlocks Aegis Prime"]],
       links:[["d1","d2"],["d1","d3"],["d1","d5"],["d2","d4"],["d3","d6"],
        ["d4","d7"],["d2","d8"],["d3","d9"],["d6","d10"],["d5","d8"],["d5","d9"],
        ["d7","d11"],["d8","d11"],["d8","d12"],["d9","d12"],["d9","d13"],["d10","d13"],
        ["d11","d14"],["d11","d15"],["d12","d15"],["d12","d16"],["d13","d16"],["d13","d17"],
        ["d14","d18"],["d15","d18"],["d16","d19"],["d17","d19"],
        ["d18","d20"],["d19","d20"]],
       start:{d1:1}},
      {key:"uti",n:"UTILITY",hex:"#5cff8a",glyph:"◈",
       nodes:[
        ["u1",140,70,"n","Scanner Boost","mod0-t3",3,"Wider sweep on ore and wreck signatures.","+18% scan radius"],
        ["u2",330,130,"n","Cargo Rigging","mod1-t2",3,"External racking on the hold frame.","+400 m³ capacity"],
        ["u3",560,90,"n","Drone Uplink","genspeed-t2",3,"Trade drones fly one leg faster.","-12% drone travel"],
        ["u4",760,150,"n","Signal Ghost","genspeed-t2",2,"Drops your signature while drifting.","-16% detection"],
        ["u5",980,100,"n","Star Charts","mod0-t3",3,"Deeper route data for the nav computer.","+2 charted routes"],
        ["u6",220,250,"n","Salvage Arm","mod2-t3",2,"Pulls intact modules out of wrecks.","+1 salvage slot"],
        ["u7",470,240,"e","Warp Tuner","genspeed-t3",2,"Tightens the spool-up sequence.","-1.2 s warp spool"],
        ["u8",680,280,"n","Ore Sifter","mod2-t4",3,"Discards slag before it enters the hold.","+7% pure yield"],
        ["u9",900,250,"n","Beacon Net","mod1-t2",2,"Leaves recallable beacons behind you.","+1 beacon"],
        ["u10",1120,220,"e","Void Compass","genspeed-t5",2,"Reveals one anomaly per system.","+1 anomaly ping"],
        ["u11",120,400,"n","Tow Rig","mod2-t3",2,"Hauls derelicts without a speed penalty.","-30% tow drag"],
        ["u12",350,390,"n","Micro Fabricator","mod3-t3",2,"Builds ammo out of silicate dust.","+40 rounds/hour"],
        ["u13",600,420,"e","Ore Refiner","mod2-t4",2,"Refines low-grade ore inside the hold.","+6%/hour refine"],
        ["u14",860,410,"n","Tractor Field","mod1-t2",2,"Scoops loose cargo without stopping.","+35% scoop radius"],
        ["u15",1080,400,"n","Deep Survey","genspeed-t3",3,"Reads mineral density through crust.","+11% survey depth"],
        ["u16",250,540,"n","Auto Loader","mod3-t3",2,"Cargo stows itself while you mine.","-25% stow time"],
        ["u17",520,560,"n","Barter Codes","genspeed-t2",2,"Station clerks quote you better.","+5% sell price"],
        ["u18",780,570,"n","Silent Running","genspeed-t5",2,"Cuts the reactor signature to a whisper.","-22% heat trace"],
        ["u19",1010,560,"e","Rift Sense","genspeed-t5",2,"Feels unstable space before you enter it.","+1 rift warning"],
        ["u20",640,720,"k","Nexus Protocol","genspeed-t5",1,"Every utility bonus feeds one shared pool that the whole wing draws from.","Unlocks Nexus Protocol"]],
       links:[["u1","u2"],["u3","u2"],["u3","u4"],["u5","u4"],["u2","u6"],["u2","u7"],
        ["u3","u7"],["u4","u8"],["u4","u9"],["u5","u10"],
        ["u6","u11"],["u6","u12"],["u7","u12"],["u7","u13"],["u8","u13"],["u8","u14"],["u9","u14"],["u10","u15"],
        ["u11","u16"],["u12","u16"],["u12","u17"],["u13","u17"],["u13","u18"],["u14","u18"],["u15","u19"],["u10","u19"],
        ["u16","u20"],["u17","u20"],["u18","u20"],["u19","u20"]],
       start:{u1:1,u2:1}}];
