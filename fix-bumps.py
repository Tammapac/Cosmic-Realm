#!/usr/bin/env python3
"""Add bumpMission calls for transport/deliver/gather missions."""

# 1. Add transport/deliver bumps to MarketTab sell in Hangar.tsx
print("═══ Adding mission bumps to Hangar.tsx sell ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# Add bumpMission import if not there
if 'bumpMission' not in hcode[:3000]:
    # Add to store imports
    old_import = 'rerollMissionBoard,'
    if old_import in hcode:
        hcode = hcode.replace(old_import, 'rerollMissionBoard, bumpMission,', 1)
        print("  -> Added bumpMission to store imports")

# Add transport/deliver bump to the sell function
old_sell = '''    pushNotification(`Sold ${take}\\u00d7 ${RESOURCES[rid].name} \\u00b7 +${earn.toLocaleString()}cr`, "good");
    save(); bump();
  };'''

# Hmm that might have unicode escapes. Let me try the actual text
old_sell_v2 = 'removeCargo(rid, take);\n    player.credits += earn;\n    pushNotification(`Sold ${take}'
if old_sell_v2 in hcode:
    # Find the exact sell block and add bumps before save()
    sell_idx = hcode.find(old_sell_v2)
    save_after = hcode.find('save(); bump();\n  };', sell_idx)
    if save_after >= 0:
        bump_code = '    bumpMission("transport", take, undefined, { resourceId: rid });\n    bumpMission("deliver", take, undefined, { resourceId: rid, stationId });\n    bumpMission("earn-credits", earn);\n'
        hcode = hcode[:save_after] + bump_code + hcode[save_after:]
        print("  -> Added transport/deliver/earn-credits bumps to single sell")

# Add to sellAll too
old_sellall_save = '''      player.credits += totalEarn;
      pushNotification(`Sold all cargo'''
if old_sellall_save in hcode:
    sellall_idx = hcode.find(old_sellall_save)
    sellall_save = hcode.find('save(); bump();', sellall_idx)
    if sellall_save >= 0:
        bump_code2 = '      bumpMission("transport", 1, undefined, {});\n      bumpMission("earn-credits", totalEarn);\n      '
        hcode = hcode[:sellall_save] + bump_code2 + hcode[sellall_save:]
        print("  -> Added transport/earn-credits bumps to sellAll")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

# 2. Add gather bumps to loop.ts mining
print("\n═══ Adding gather bumps to loop.ts ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    lcode = f.read()

# First mining location (line ~2211)
old_mine1 = '    bumpMission("mine", got);'
if old_mine1 in lcode and 'bumpMission("gather"' not in lcode:
    # First occurrence - asteroid mining (a.yields is the resource)
    first_idx = lcode.find(old_mine1)
    # Check context to get resource variable
    context_before = lcode[first_idx-200:first_idx]
    if 'a.yields' in context_before:
        new_mine1 = '    bumpMission("mine", got);\n    bumpMission("gather", got, state.player.zone, { resourceId: a.yields });'
        lcode = lcode[:first_idx] + new_mine1 + lcode[first_idx + len(old_mine1):]
        print("  -> Added gather bump to asteroid mining (a.yields)")

    # Second occurrence - different context
    second_idx = lcode.find(old_mine1, first_idx + 100)
    if second_idx >= 0:
        context2 = lcode[second_idx-200:second_idx]
        if 'data.ore.resourceId' in context2:
            new_mine2 = '    bumpMission("mine", got);\n      bumpMission("gather", got, state.player.zone, { resourceId: data.ore.resourceId as string });'
            lcode = lcode[:second_idx] + new_mine2 + lcode[second_idx + len(old_mine1):]
            print("  -> Added gather bump to ore mining (data.ore.resourceId)")
        else:
            new_mine2 = '    bumpMission("mine", got);\n      bumpMission("gather", got, state.player.zone);'
            lcode = lcode[:second_idx] + new_mine2 + lcode[second_idx + len(old_mine1):]
            print("  -> Added gather bump to second mine location")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lcode)

print("\nDONE!")
