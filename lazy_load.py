import re, sys

path = '/root/Cosmic-Realm/frontend/src/game/pixi-renderer-v2-integrated.ts'
content = open(path).read()

# Replace preloadRotationSprites with lazy version
old = 'function preloadRotationSprites(): void {\n  for (const [id, cfg] of Object.entries(ROTATION_SPRITES)) {\n    if (!cfg || rotationFrameTextures.has(id) || rotationFrameLoading.has(id)) continue;\n    rotationFrameLoading.add(id);\n    const frames: (PIXI.Texture | null)[] = new Array(cfg.frames).fill(null);\n    let loaded = 0;\n    for (let i = 0; i < cfg.frames; i++) {\n      const img = new Image();\n      img.crossOrigin = "anonymous";\n      const idx = i;\n      img.onload = () => {\n        frames[idx] = PIXI.Texture.from(img, { scaleMode: PIXI.SCALE_MODES.LINEAR });\n        loaded++;\n        if (loaded === cfg.frames) {\n          rotationFrameTextures.set(id, frames as PIXI.Texture[]);\n          rotationFrameLoading.delete(id);\n          texCache.forEach((_, k) => { if (k.startsWith("ship-" + id + "-")) texCache.delete(k); });\n          lastPlayerShipClass = "" as ShipClassId;\n          for (const [, data] of otherPlayerSprites) {\n            (data as any)._lastShipClass = "";\n          }\n        }\n      };\n      img.onerror = () => { loaded++; if (loaded === cfg.frames) rotationFrameLoading.delete(id); };\n      img.src = cfg.path + cfg.files[i];\n    }\n  }\n}'

new = 'function preloadRotationSprites(): void {\n  const playerShip = state.player?.shipClass || "skimmer";\n  loadShipSprites(playerShip);\n}\n\nfunction loadShipSprites(id: string): void {\n  const cfg = ROTATION_SPRITES[id];\n  if (!cfg || rotationFrameTextures.has(id) || rotationFrameLoading.has(id)) return;\n  rotationFrameLoading.add(id);\n  const frames: (PIXI.Texture | null)[] = new Array(cfg.frames).fill(null);\n  let loaded = 0;\n  for (let i = 0; i < cfg.frames; i++) {\n    const img = new Image();\n    img.crossOrigin = "anonymous";\n    const idx = i;\n    img.onload = () => {\n      frames[idx] = PIXI.Texture.from(img, { scaleMode: PIXI.SCALE_MODES.LINEAR });\n      loaded++;\n      if (loaded === cfg.frames) {\n        rotationFrameTextures.set(id, frames as PIXI.Texture[]);\n        rotationFrameLoading.delete(id);\n        texCache.forEach((_, k) => { if (k.startsWith("ship-" + id + "-")) texCache.delete(k); });\n        lastPlayerShipClass = "" as ShipClassId;\n        for (const [, data] of otherPlayerSprites) {\n          (data as any)._lastShipClass = "";\n        }\n      }\n    };\n    img.onerror = () => { loaded++; if (loaded === cfg.frames) rotationFrameLoading.delete(id); };\n    img.src = cfg.path + cfg.files[i];\n  }\n}'

if old in content:
    content = content.replace(old, new)
    print("OK: replaced preload with lazy version")
else:
    print("ERROR: could not find old preload")
    sys.exit(1)

# Add lazy load trigger in getDirectionalTex
old2 = '  const frames = rotationFrameTextures.get(shipClass);\n  if (!frames) {\n    return { tex: getShipTex(shipClass, scale), isDirectional: false };\n  }'

new2 = '  const frames = rotationFrameTextures.get(shipClass);\n  if (!frames) {\n    loadShipSprites(shipClass);\n    return { tex: getShipTex(shipClass, scale), isDirectional: false };\n  }'

if old2 in content:
    content = content.replace(old2, new2)
    print("OK: added lazy load trigger")
else:
    print("ERROR: could not find getDirectionalTex pattern")
    sys.exit(1)

open(path, 'w').write(content)
print("DONE")
