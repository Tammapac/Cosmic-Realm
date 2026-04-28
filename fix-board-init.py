#!/usr/bin/env python3
"""Fix missionBoard initialization - roll fresh if empty/not loaded."""

with open('frontend/src/game/store.ts', 'r') as f:
    code = f.read()

# 1. Change missionBoard init to roll fresh instead of empty
old_init = '  missionBoard: [] as ActiveMission[],'
new_init = '  missionBoard: rollMissionBoard(),'
if old_init in code:
    code = code.replace(old_init, new_init)
    print("  -> missionBoard now rolls fresh on init")

# 2. Make sure load overrides it if saved data exists
# Already done: if (data.missionBoard) state.missionBoard = data.missionBoard;
if 'data.missionBoard' in code:
    print("  -> Load already restores missionBoard from save")

# 3. Check sellCargo has the bump calls
if 'bumpMission("transport"' in code:
    print("  -> sellCargo already has transport/deliver bumps")
else:
    # Find sellCargo function and add bumps
    sell_idx = code.find('export function sellCargo')
    if sell_idx >= 0:
        # Find the credits addition
        credits_add = code.find('state.player.credits += total;', sell_idx)
        if credits_add < 0:
            credits_add = code.find('p.credits += total;', sell_idx)
        if credits_add >= 0:
            line_end = code.find('\n', credits_add)
            bump_code = '\n    bumpMission("transport", qty, undefined, { resourceId });\n    bumpMission("deliver", qty, undefined, { resourceId, stationId: state.dockedAt ?? "" });'
            code = code[:line_end] + bump_code + code[line_end:]
            print("  -> Added transport/deliver mission bumps to sell")
        else:
            print("  -> WARNING: Could not find credits addition in sellCargo")

# 4. Check mining bump has gather
if 'bumpMission("gather"' in code:
    print("  -> Mining already bumps gather missions")
else:
    # Find mining loot code
    mine_bump_idx = code.find('bumpMission("mine", 1')
    if mine_bump_idx >= 0:
        line_end = code.find('\n', mine_bump_idx)
        # Find the resource variable name nearby
        # Look for what resource was collected - search backward for 'drop' or 'resourceId'
        context = code[mine_bump_idx-200:mine_bump_idx]
        if 'drop' in context:
            code = code[:line_end] + '\n    bumpMission("gather", 1, state.player.zone, { resourceId: drop });' + code[line_end:]
            print("  -> Added gather bump after mine bump (using 'drop' variable)")
        elif 'loot' in context:
            code = code[:line_end] + '\n    bumpMission("gather", 1, state.player.zone);' + code[line_end:]
            print("  -> Added gather bump after mine bump (generic)")
        else:
            code = code[:line_end] + '\n    bumpMission("gather", 1, state.player.zone);' + code[line_end:]
            print("  -> Added gather bump after mine bump")

# 5. Make sure the useGame selector exposes missionBoard
# Check if there's a selector pattern
if 'missionBoard' in code:
    print("  -> missionBoard is in state object (accessible via useGame)")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(code)

print("DONE!")
