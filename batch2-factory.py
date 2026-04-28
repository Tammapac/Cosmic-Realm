#!/usr/bin/env python3
"""Batch 2 Item 5: Factory/refining system - process raw ores into refined goods."""

import re

# ══════════════════════════════════════════════════════════════════════════════
# 1. Add refined resources + refine recipes to types.ts
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Adding refined resources + recipes ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    code = f.read()

# Add new refined ResourceId types
new_res_ids = '''  | "refined-alloy"
  | "crystal-matrix"
  | "fusion-core"
  | "void-steel"
  | "nano-compound"
  | "plasma-cell"'''

if '"refined-alloy"' not in code:
    # Insert after "obsidian"
    old_obsidian = '  | "obsidian";'
    new_obsidian = '  | "obsidian"\n' + new_res_ids + ';'
    if old_obsidian in code:
        code = code.replace(old_obsidian, new_obsidian)
        print("  -> Added 6 refined ResourceId types")

# Add refined RESOURCES entries
refined_resources = '''  // refined materials (factory output)
  "refined-alloy":  { id: "refined-alloy",  name: "Refined Alloy",    basePrice: 120,  glyph: "⬡", color: "#dd8844", description: "High-grade alloy refined from iron and copper. Used in advanced hull plating." },
  "crystal-matrix": { id: "crystal-matrix", name: "Crystal Matrix",   basePrice: 340,  glyph: "✦", color: "#dd88ff", description: "Crystalline lattice structure. Powers advanced shield generators." },
  "fusion-core":    { id: "fusion-core",    name: "Fusion Core",      basePrice: 480,  glyph: "⊛", color: "#88ffaa", description: "Miniaturized fusion reactor. Extremely valuable to military stations." },
  "void-steel":     { id: "void-steel",     name: "Void Steel",       basePrice: 850,  glyph: "◆", color: "#8866cc", description: "Ultra-hard steel forged from void obsidian. The rarest refined material." },
  "nano-compound":  { id: "nano-compound",  name: "Nano-Compound",    basePrice: 220,  glyph: "◎", color: "#66ddcc", description: "Self-assembling nano-material. Medical and engineering applications." },
  "plasma-cell":    { id: "plasma-cell",     name: "Plasma Cell",      basePrice: 180,  glyph: "▣", color: "#ff8866", description: "Concentrated plasma fuel cell. High energy density for starship reactors." },'''

if '"refined-alloy"' not in code.split('RESOURCES')[1] if 'RESOURCES' in code else '':
    # Find the end of RESOURCES (after obsidian entry)
    obsidian_entry = code.find('obsidian:        { id: "obsidian"')
    if obsidian_entry >= 0:
        line_end = code.index('\n', obsidian_entry)
        code = code[:line_end+1] + refined_resources + '\n' + code[line_end+1:]
        print("  -> Added 6 refined RESOURCES entries")

# Add RefineRecipe type and REFINE_RECIPES
refine_recipes = '''
// ── REFINING RECIPES ──────────────────────────────────────────────────────
export type RefineRecipe = {
  id: string;
  name: string;
  inputs: { resourceId: ResourceId; qty: number }[];
  output: { resourceId: ResourceId; qty: number };
  timeSeconds: number;
  minFactoryLevel: number;
};

export const REFINE_RECIPES: RefineRecipe[] = [
  { id: "r-alloy",   name: "Smelt Alloy",       inputs: [{ resourceId: "iron", qty: 8 }, { resourceId: "copper", qty: 4 }],                     output: { resourceId: "refined-alloy", qty: 2 },  timeSeconds: 120, minFactoryLevel: 1 },
  { id: "r-plasma",  name: "Compress Plasma",    inputs: [{ resourceId: "plasma", qty: 5 }, { resourceId: "fuel-cell", qty: 3 }],                output: { resourceId: "plasma-cell", qty: 2 },   timeSeconds: 150, minFactoryLevel: 1 },
  { id: "r-nano",    name: "Synthesize Nano",    inputs: [{ resourceId: "nanite", qty: 4 }, { resourceId: "bio-matter", qty: 3 }],               output: { resourceId: "nano-compound", qty: 2 }, timeSeconds: 180, minFactoryLevel: 2 },
  { id: "r-crystal", name: "Grow Crystal Matrix", inputs: [{ resourceId: "crystal-shard", qty: 3 }, { resourceId: "cobalt", qty: 5 }],           output: { resourceId: "crystal-matrix", qty: 1 }, timeSeconds: 240, minFactoryLevel: 2 },
  { id: "r-fusion",  name: "Forge Fusion Core",  inputs: [{ resourceId: "helium-3", qty: 6 }, { resourceId: "palladium", qty: 2 }],              output: { resourceId: "fusion-core", qty: 1 },   timeSeconds: 300, minFactoryLevel: 3 },
  { id: "r-vsteel",  name: "Forge Void Steel",   inputs: [{ resourceId: "obsidian", qty: 3 }, { resourceId: "iridium", qty: 1 }],                output: { resourceId: "void-steel", qty: 1 },    timeSeconds: 420, minFactoryLevel: 4 },
];

export type RefineJob = {
  recipeId: string;
  startedAt: number;
  completesAt: number;
};

export const FACTORY_UPGRADE_COSTS = [0, 5000, 25000, 80000, 200000];
export const FACTORY_SPEED_BONUS = [1.0, 1.0, 0.85, 0.7, 0.55, 0.4];
'''

if 'RefineRecipe' not in code:
    # Insert before ASTEROID_BELTS or STATIONS
    insert_point = code.find('export const ASTEROID_BELTS')
    if insert_point < 0:
        insert_point = code.find('export const STATIONS:')
    if insert_point >= 0:
        code = code[:insert_point] + refine_recipes + '\n' + code[insert_point:]
        print("  -> Added RefineRecipe type + 6 recipes + factory upgrade costs")

# Add prices for refined materials to key stations
# Hub stations buy refined goods at premium, mining stations sell raw cheaper
station_price_additions = {
    "helix": '"refined-alloy": 1.4, "plasma-cell": 1.3, "nano-compound": 1.2',
    "veiled": '"crystal-matrix": 1.5, "fusion-core": 1.4, "void-steel": 1.3',
    "ember": '"refined-alloy": 1.3, "nano-compound": 1.5, "plasma-cell": 1.2',
    "echo": '"void-steel": 1.6, "crystal-matrix": 1.3, "fusion-core": 1.2',
    "ironclad": '"refined-alloy": 1.5, "plasma-cell": 1.4, "fusion-core": 1.3',
    "solar-haven": '"crystal-matrix": 1.4, "void-steel": 1.5, "nano-compound": 1.3',
    "rift-base": '"void-steel": 1.8, "fusion-core": 1.6, "crystal-matrix": 1.4',
    "void-heart": '"void-steel": 2.0, "fusion-core": 1.8, "refined-alloy": 1.5',
    "storm-eye": '"refined-alloy": 1.6, "plasma-cell": 1.5, "fusion-core": 1.4',
    "cloud-gate": '"refined-alloy": 1.3, "nano-compound": 1.4, "plasma-cell": 1.2',
    "venus-bastion": '"void-steel": 1.7, "crystal-matrix": 1.5, "fusion-core": 1.6',
}

for sid, prices in station_price_additions.items():
    pattern = f'id: "{sid}",'
    if pattern in code:
        idx = code.index(pattern)
        # Find the prices: { ... } block
        prices_match = re.search(r'prices:\s*\{([^}]+)\}', code[idx:idx+500])
        if prices_match:
            old_prices_content = prices_match.group(1)
            # Check if refined materials already added
            if 'refined-alloy' not in old_prices_content and 'void-steel' not in old_prices_content:
                new_prices_content = old_prices_content.rstrip() + ', ' + prices
                code = code[:idx + prices_match.start(1)] + new_prices_content + code[idx + prices_match.end(1):]
                # Recalculate after replacement since string changed

print("  -> Added refined material prices to hub/military stations")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(code)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Add refining state to store.ts
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding refining state to store.ts ═══")

with open('frontend/src/game/store.ts', 'r') as f:
    scode = f.read()

# Add RefineJob import
if 'RefineJob' not in scode:
    old_import_types = 'ASTEROID_BELTS,'
    new_import_types = 'ASTEROID_BELTS, RefineJob, REFINE_RECIPES, FACTORY_SPEED_BONUS, FACTORY_UPGRADE_COSTS,'
    if old_import_types in scode:
        scode = scode.replace(old_import_types, new_import_types, 1)
        print("  -> Added refining imports")

# Add refiningJobs and factoryLevel to Player type
if 'refiningJobs' not in scode:
    old_player_type = '  showCargo: boolean;'
    new_player_type = '  showCargo: boolean;\n  refiningJobs: RefineJob[];\n  factoryLevel: number;'
    if old_player_type in scode:
        scode = scode.replace(old_player_type, new_player_type, 1)
        print("  -> Added refiningJobs + factoryLevel to state type")

# Add initial values
if 'refiningJobs: []' not in scode:
    old_init = '  showCargo: false,'
    new_init = '  showCargo: false,\n  refiningJobs: [],\n  factoryLevel: 1,'
    if old_init in scode:
        scode = scode.replace(old_init, new_init, 1)
        print("  -> Added refining initial values")

# Add "refinery" to HangarTab type
if '"refinery"' not in scode:
    old_hangar_type = '  | "bounties" | "loadout" | "ships" | "drones" | "market" | "ammo" | "cargo" | "repair" | "skills" | "missions" | "dungeons";'
    new_hangar_type = '  | "bounties" | "loadout" | "ships" | "drones" | "market" | "ammo" | "cargo" | "repair" | "skills" | "missions" | "dungeons" | "refinery";'
    if old_hangar_type in scode:
        scode = scode.replace(old_hangar_type, new_hangar_type)
        print("  -> Added 'refinery' to HangarTab type")

# Add refinery helper functions (exported)
refinery_funcs = '''
// ── REFINERY FUNCTIONS ────────────────────────────────────────────────────
export function startRefineJob(recipeId: string): boolean {
  const recipe = REFINE_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return false;
  if (state.factoryLevel < recipe.minFactoryLevel) return false;
  if (state.refiningJobs.length >= state.factoryLevel + 1) return false;
  for (const inp of recipe.inputs) {
    const cargo = state.player.cargo.find(c => c.resourceId === inp.resourceId);
    if (!cargo || cargo.qty < inp.qty) return false;
  }
  for (const inp of recipe.inputs) {
    removeCargo(inp.resourceId, inp.qty);
  }
  const speedMul = FACTORY_SPEED_BONUS[state.factoryLevel] ?? 1.0;
  const duration = recipe.timeSeconds * speedMul * 1000;
  const now = Date.now();
  state.refiningJobs.push({
    recipeId: recipe.id,
    startedAt: now,
    completesAt: now + duration,
  });
  save();
  bump();
  return true;
}

export function collectRefineJob(index: number): boolean {
  const job = state.refiningJobs[index];
  if (!job) return false;
  if (Date.now() < job.completesAt) return false;
  const recipe = REFINE_RECIPES.find(r => r.id === job.recipeId);
  if (!recipe) return false;
  addCargo(recipe.output.resourceId, recipe.output.qty);
  state.refiningJobs.splice(index, 1);
  save();
  bump();
  return true;
}

export function upgradeFactory(): boolean {
  const nextLevel = state.factoryLevel + 1;
  if (nextLevel > 5) return false;
  const cost = FACTORY_UPGRADE_COSTS[nextLevel - 1] ?? 999999;
  if (state.player.credits < cost) return false;
  state.player.credits -= cost;
  state.factoryLevel = nextLevel;
  save();
  bump();
  return true;
}
'''

if 'startRefineJob' not in scode:
    # Insert before the final export or at end
    export_idx = scode.rfind('\nexport ')
    if export_idx >= 0:
        # Find a good insertion point - before the last batch of exports
        scode = scode + refinery_funcs
        print("  -> Added refinery functions (startRefineJob, collectRefineJob, upgradeFactory)")

# Make sure player save includes refiningJobs and factoryLevel
# Check the save function
if 'refiningJobs' not in scode.split('function save')[1][:500] if 'function save' in scode else '':
    # The save function likely saves the whole player object already
    pass

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(scode)

# ══════════════════════════════════════════════════════════════════════════════
# 3. Add Refinery tab to Hangar.tsx
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding Refinery tab to Hangar ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# Add refinery imports
if 'startRefineJob' not in hcode:
    old_store_imp = 'from "../game/store";'
    if old_store_imp in hcode:
        # Find the import line(s)
        imp_idx = hcode.index(old_store_imp)
        imp_start = hcode.rfind('import {', 0, imp_idx)
        imp_block = hcode[imp_start:imp_idx + len(old_store_imp)]
        # Add new imports before the closing
        hcode = hcode.replace(
            old_store_imp,
            'startRefineJob, collectRefineJob, upgradeFactory, ' + old_store_imp,
            1
        )
        print("  -> Added refinery imports to Hangar")

# Add REFINE_RECIPES, FACTORY_SPEED_BONUS, FACTORY_UPGRADE_COSTS, RefineJob to types import
if 'REFINE_RECIPES' not in hcode:
    old_types_imp = 'from "../game/types";'
    if old_types_imp in hcode:
        imp_idx = hcode.index(old_types_imp)
        imp_start = hcode.rfind('import', 0, imp_idx)
        imp_block = hcode[imp_start:imp_idx + len(old_types_imp)]
        if 'REFINE_RECIPES' not in imp_block:
            hcode = hcode.replace(
                'getDailyFeaturedDungeon,',
                'getDailyFeaturedDungeon, REFINE_RECIPES, FACTORY_SPEED_BONUS, FACTORY_UPGRADE_COSTS,',
                1
            )
            print("  -> Added recipe imports to Hangar types")

# Add Refinery tab to TABS array (only show at mining/factory stations)
old_tabs = '''  { id: "repair",   label: "Services", glyph: "✚" },
];'''
new_tabs = '''  { id: "refinery", label: "Refinery", glyph: "⚒" },
  { id: "repair",   label: "Services", glyph: "✚" },
];'''

if '{ id: "refinery"' not in hcode:
    if old_tabs in hcode:
        hcode = hcode.replace(old_tabs, new_tabs)
        print("  -> Added Refinery tab to TABS")

# Add tab rendering
old_repair_render = '          {tab === "repair" && <RepairTab stationId={stationId} />'
new_repair_render = '          {tab === "refinery" && <RefineryTab stationId={stationId} />}\n          {tab === "repair" && <RepairTab stationId={stationId} />'

if 'RefineryTab' not in hcode:
    if old_repair_render in hcode:
        hcode = hcode.replace(old_repair_render, new_repair_render)
        print("  -> Added RefineryTab rendering")

# Add RefineryTab component
refinery_tab = '''

// ── REFINERY ──────────────────────────────────────────────────────────────
function RefineryTab({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const jobs = useGame((s) => s.refiningJobs);
  const factoryLevel = useGame((s) => s.factoryLevel);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const maxSlots = factoryLevel + 1;
  const speedMul = FACTORY_SPEED_BONUS[factoryLevel] ?? 1.0;
  const nextCost = factoryLevel < 5 ? FACTORY_UPGRADE_COSTS[factoryLevel] : null;

  function hasInputs(recipe: typeof REFINE_RECIPES[0]): boolean {
    return recipe.inputs.every(inp => {
      const c = player.cargo.find(ci => ci.resourceId === inp.resourceId);
      return c && c.qty >= inp.qty;
    });
  }

  function fmtTime(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  return (
    <div className="p-4">
      {/* Factory Level Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-cyan tracking-widest text-sm font-bold">REFINERY — LEVEL {factoryLevel}</div>
          <div className="text-mute text-[12px]">
            {jobs.length}/{maxSlots} slots used · Processing speed: {Math.round((1 - speedMul) * 100)}% faster
          </div>
        </div>
        {nextCost !== null && (
          <button
            className="btn btn-primary text-[12px] px-3 py-1.5"
            style={{ opacity: player.credits >= nextCost ? 1 : 0.4 }}
            onClick={() => { if (player.credits >= nextCost) upgradeFactory(); }}
          >
            UPGRADE LV{factoryLevel + 1} — {nextCost.toLocaleString()}cr
          </button>
        )}
        {nextCost === null && (
          <div className="text-amber text-[12px] tracking-widest">MAX LEVEL</div>
        )}
      </div>

      {/* Active Jobs */}
      {jobs.length > 0 && (
        <div className="mb-4">
          <div className="text-mute text-[11px] tracking-widest mb-2">ACTIVE JOBS</div>
          {jobs.map((job, i) => {
            const recipe = REFINE_RECIPES.find(r => r.id === job.recipeId);
            if (!recipe) return null;
            const outRes = (RESOURCES as any)[recipe.output.resourceId];
            const done = now >= job.completesAt;
            const elapsed = now - job.startedAt;
            const total = job.completesAt - job.startedAt;
            const pct = Math.min(100, (elapsed / total) * 100);
            return (
              <div key={i} className="flex items-center gap-3 p-3 mb-2 border" style={{ borderColor: done ? "#5cff8a44" : "var(--border-soft)", background: done ? "#5cff8a08" : "transparent" }}>
                <div style={{ width: 32, height: 32, background: (outRes?.color ?? "#aaa") + "22", border: "1px solid " + (outRes?.color ?? "#aaa"), color: outRes?.color ?? "#aaa", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {outRes?.glyph ?? "?"}
                </div>
                <div className="flex-1">
                  <div className="text-bright text-[13px] font-bold">{recipe.name}</div>
                  <div className="text-mute text-[11px]">
                    {done ? "READY TO COLLECT" : fmtTime(job.completesAt - now) + " remaining"}
                  </div>
                  {!done && (
                    <div style={{ height: 3, background: "#1a2348", marginTop: 4, borderRadius: 2 }}>
                      <div style={{ height: 3, background: "#4ee2ff", width: pct + "%", borderRadius: 2, transition: "width 1s linear" }} />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[12px]" style={{ color: outRes?.color ?? "#aaa" }}>{recipe.output.qty}x {outRes?.name ?? recipe.output.resourceId}</div>
                  {done && (
                    <button
                      className="btn btn-primary text-[11px] px-2 py-1 mt-1"
                      onClick={() => collectRefineJob(i)}
                    >COLLECT</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recipes */}
      <div className="text-mute text-[11px] tracking-widest mb-2">RECIPES</div>
      <div className="grid gap-2">
        {REFINE_RECIPES.map((recipe) => {
          const outRes = (RESOURCES as any)[recipe.output.resourceId];
          const locked = factoryLevel < recipe.minFactoryLevel;
          const canStart = !locked && hasInputs(recipe) && jobs.length < maxSlots;
          const timeSec = Math.round(recipe.timeSeconds * speedMul);

          return (
            <div key={recipe.id} className="p-3 border" style={{ borderColor: locked ? "#333" : "var(--border-soft)", opacity: locked ? 0.5 : 1 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div style={{ width: 28, height: 28, background: (outRes?.color ?? "#aaa") + "22", border: "1px solid " + (outRes?.color ?? "#aaa"), color: outRes?.color ?? "#aaa", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {outRes?.glyph ?? "?"}
                  </div>
                  <div>
                    <div className="text-bright text-[13px] font-bold">{recipe.name}</div>
                    <div className="text-mute text-[11px]">
                      {locked ? `Requires Factory Lv${recipe.minFactoryLevel}` : `${Math.floor(timeSec / 60)}m ${timeSec % 60}s`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[12px]" style={{ color: outRes?.color ?? "#aaa" }}>{recipe.output.qty}x {outRes?.name ?? "?"}</div>
                    <div className="text-amber text-[11px]">~{(recipe.output.qty * (outRes?.basePrice ?? 0)).toLocaleString()}cr base</div>
                  </div>
                  <button
                    className="btn btn-primary text-[11px] px-3 py-1.5"
                    style={{ opacity: canStart ? 1 : 0.3 }}
                    onClick={() => { if (canStart) startRefineJob(recipe.id); }}
                    disabled={!canStart}
                  >
                    {locked ? "LOCKED" : "START"}
                  </button>
                </div>
              </div>
              {/* Inputs */}
              <div className="flex flex-wrap gap-2">
                {recipe.inputs.map((inp, j) => {
                  const inRes = (RESOURCES as any)[inp.resourceId];
                  const have = player.cargo.find(c => c.resourceId === inp.resourceId)?.qty ?? 0;
                  const enough = have >= inp.qty;
                  return (
                    <div key={j} className="flex items-center gap-1 px-2 py-1" style={{ background: enough ? "#5cff8a11" : "#ff5c6c11", border: "1px solid " + (enough ? "#5cff8a33" : "#ff5c6c33"), fontSize: 11 }}>
                      <span style={{ color: inRes?.color ?? "#aaa" }}>{inRes?.glyph ?? "?"}</span>
                      <span className="text-bright">{inp.qty}x {inRes?.name ?? inp.resourceId}</span>
                      <span style={{ color: enough ? "#5cff8a" : "#ff5c6c" }}>({have})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
'''

# Insert RefineryTab before RepairTab
if 'function RefineryTab' not in hcode:
    repair_idx = hcode.find('\nfunction RepairTab')
    if repair_idx < 0:
        repair_idx = hcode.rfind('\nfunction ')
    if repair_idx >= 0:
        hcode = hcode[:repair_idx] + refinery_tab + hcode[repair_idx:]
        print("  -> Added RefineryTab component")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

# ══════════════════════════════════════════════════════════════════════════════
# 4. Add refined resources to backend data.ts
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding refined resources to backend ═══")

with open('backend/src/game/data.ts', 'r') as f:
    bcode = f.read()

# Add refined ResourceId types
if '"refined-alloy"' not in bcode:
    old_bres = '  | "obsidian";'
    new_bres = '''  | "obsidian"
  | "refined-alloy"
  | "crystal-matrix"
  | "fusion-core"
  | "void-steel"
  | "nano-compound"
  | "plasma-cell";'''
    if old_bres in bcode:
        bcode = bcode.replace(old_bres, new_bres)
        print("  -> Added refined ResourceId types to backend")

# Add refined RESOURCES entries to backend
backend_refined = '''  // refined materials
  "refined-alloy":  { id: "refined-alloy",  name: "Refined Alloy",    basePrice: 120,  glyph: "H", color: "#dd8844", description: "High-grade alloy." },
  "crystal-matrix": { id: "crystal-matrix", name: "Crystal Matrix",   basePrice: 340,  glyph: "*", color: "#dd88ff", description: "Crystalline lattice." },
  "fusion-core":    { id: "fusion-core",    name: "Fusion Core",      basePrice: 480,  glyph: "O", color: "#88ffaa", description: "Miniaturized fusion reactor." },
  "void-steel":     { id: "void-steel",     name: "Void Steel",       basePrice: 850,  glyph: "D", color: "#8866cc", description: "Ultra-hard void-forged steel." },
  "nano-compound":  { id: "nano-compound",  name: "Nano-Compound",    basePrice: 220,  glyph: "o", color: "#66ddcc", description: "Self-assembling nano-material." },
  "plasma-cell":    { id: "plasma-cell",     name: "Plasma Cell",      basePrice: 180,  glyph: "#", color: "#ff8866", description: "Concentrated plasma fuel cell." },'''

if '"refined-alloy"' not in bcode.split('RESOURCES')[1] if 'RESOURCES' in bcode else '':
    # Find obsidian entry in backend RESOURCES
    obs_entry = bcode.find('obsidian:')
    if obs_entry >= 0:
        line_end = bcode.index('\n', obs_entry)
        bcode = bcode[:line_end+1] + backend_refined + '\n' + bcode[line_end+1:]
        print("  -> Added refined RESOURCES entries to backend")

# Add refined material prices to backend stations
# Find key stations and add prices (same as frontend)
for sid, prices_str in station_price_additions.items():
    pattern = f'id: "{sid}",'
    if pattern in bcode:
        idx = bcode.index(pattern)
        prices_match = re.search(r'prices:\s*\{([^}]+)\}', bcode[idx:idx+500])
        if prices_match:
            old_p = prices_match.group(1)
            if 'refined-alloy' not in old_p and 'void-steel' not in old_p:
                new_p = old_p.rstrip() + ', ' + prices_str
                bcode = bcode[:idx + prices_match.start(1)] + new_p + bcode[idx + prices_match.end(1):]

print("  -> Added refined material prices to backend stations")

with open('backend/src/game/data.ts', 'w') as f:
    f.write(bcode)

print("\n" + "=" * 60)
print("DONE! Factory/Refining system deployed")
print("=" * 60)
print("\nNew refined materials (sell at hub stations for profit):")
print("  - Refined Alloy (120cr)  <- 8 iron + 4 copper")
print("  - Plasma Cell (180cr)    <- 5 plasma + 3 fuel cell")
print("  - Nano-Compound (220cr)  <- 4 nanite + 3 bio-matter")
print("  - Crystal Matrix (340cr) <- 3 crystal shard + 5 cobalt")
print("  - Fusion Core (480cr)    <- 6 helium-3 + 2 palladium")
print("  - Void Steel (850cr)     <- 3 obsidian + 1 iridium")
print("\nFactory system:")
print("  - Start at Level 1 (2 slots, base speed)")
print("  - Upgrade to Level 5 (6 slots, 60% faster)")
print("  - Higher recipes need higher factory levels")
print("  - Processing takes 2-7 minutes (reduced by upgrades)")
