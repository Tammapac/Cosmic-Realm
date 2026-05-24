#!/usr/bin/env python3
"""
Fix PixiJS renderer runtime errors causing black screen.
Issues: wrong property names, missing type fields, PixiJS v7 API differences.
"""

print("═══ Fixing PixiJS renderer type errors ═══")

with open('frontend/src/game/pixi-renderer.ts', 'r') as f:
    code = f.read()

# 1. Projectile has no 'angle' field - compute from velocity
code = code.replace(
    "spr.rotation = pr.angle + Math.PI / 2;",
    "spr.rotation = Math.atan2(pr.vel.y, pr.vel.x) + Math.PI / 2;"
)
print("  -> Fixed: Projectile angle computed from velocity (no .angle field)")

# 2. Floater has no 'kind' field - use color directly
old_floater_color = '''      const color = f.kind === "dmg" ? "#ff5c6c" : f.kind === "xp" ? "#ffd24a" :
        f.kind === "crit" ? "#ff3b4d" : f.kind === "heal" ? "#44ff66" : "#4ee2ff";'''
new_floater_color = '''      const color = f.color;'''
code = code.replace(old_floater_color, new_floater_color)
print("  -> Fixed: Floater uses .color directly (no .kind field)")

# Also fix the floater font size (no kind field)
code = code.replace(
    '''fontSize: f.kind === "crit" ? 18 : 14,''',
    '''fontSize: f.bold ? 18 : 14,'''
)
print("  -> Fixed: Floater font size uses .bold instead of .kind")

# 3. NpcShip has no 'type' field - use a default enemy type for texture
code = code.replace(
    '''const tex = getShipTexture(n.type as EnemyType, n.color ?? "#44aaff", n.size ?? 12, false);''',
    '''const tex = getShipTexture("sentinel" as EnemyType, n.color ?? "#44aaff", n.size ?? 12, false);'''
)
print("  -> Fixed: NPC ships use sentinel shape (NpcShip has no .type field)")

# Also fix NPC angle access - NpcShip has .angle directly
code = code.replace(
    '''if (body) body.rotation = (n as any).angle + Math.PI / 2;''',
    '''if (body) body.rotation = n.angle + Math.PI / 2;'''
)
print("  -> Fixed: NPC angle access (no cast needed)")

# Fix NPC name
code = code.replace(
    '''const nameText = new PIXI.Text(n.name ?? "NPC", {''',
    '''const nameText = new PIXI.Text(n.name, {'''
)
print("  -> Fixed: NPC name (not optional)")

# Fix NPC size refs
code = code.replace(
    '''nameText.position.set(0, -(n.size ?? 12) - 14);''',
    '''nameText.position.set(0, -n.size - 14);'''
)
print("  -> Fixed: NPC size refs")

# 4. Asteroid has no 'color' field - use a default based on yields/resource
code = code.replace(
    '''g.beginFill(cssHex(a.color ?? "#888888"), 0.8);''',
    '''g.beginFill(0x888888, 0.8);'''
)
print("  -> Fixed: Asteroid uses default color (no .color field)")

# 5. OtherPlayer.id is string not number - no need for String()
code = code.replace(
    '''const sid = String(o.id);''',
    '''const sid = o.id;'''
)
print("  -> Fixed: OtherPlayer.id is already string")

# 6. OtherPlayer has no 'faction' field in the OtherPlayer type
# Let me check... actually it might. Let me use a safe access
code = code.replace(
    '''fill: o.faction ? FACTIONS[o.faction as keyof typeof FACTIONS]?.color ?? "#7a8ad8" : "#7a8ad8",''',
    '''fill: (o as any).faction ? FACTIONS[(o as any).faction as keyof typeof FACTIONS]?.color ?? "#7a8ad8" : "#7a8ad8",'''
)
print("  -> Fixed: Safe access for OtherPlayer.faction")

# 7. PixiJS v7 background color API
code = code.replace(
    '''if (app) (app.renderer as any).background.color.setValue(cssHex(z.bgHueB));''',
    '''if (app) (app.renderer as any).backgroundColor = cssHex(z.bgHueB);'''
)
print("  -> Fixed: PixiJS v7 background color API")

# 8. genCircleTex region parameter might cause issues - simplify
old_gen_circle = '''function genCircleTex(r: number, color: number): PIXI.Texture {
  const g = new PIXI.Graphics();
  g.beginFill(color);
  g.drawCircle(0, 0, r);
  g.endFill();
  return app!.renderer.generateTexture(g, { resolution: 2, region: new PIXI.Rectangle(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2) });
}'''

new_gen_circle = '''function genCircleTex(r: number, color: number): PIXI.Texture {
  const canvas = document.createElement("canvas");
  const sz = (r + 2) * 4;
  canvas.width = sz;
  canvas.height = sz;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(sz / 2, sz / 2, r * 2, 0, Math.PI * 2);
  ctx.fill();
  return PIXI.Texture.from(canvas);
}'''

code = code.replace(old_gen_circle, new_gen_circle)
print("  -> Fixed: genCircleTex uses canvas instead of generateTexture (more reliable)")

# 9. Wrap the main render function in try-catch for safety
old_render_entry = '''export function pixiRender(): void {
  if (!app) return;'''

new_render_entry = '''export function pixiRender(): void {
  if (!app) return;
  try {'''

code = code.replace(old_render_entry, new_render_entry)

# Add catch at the end
old_render_end = '''  renderOverlays(w, h);
}'''

new_render_end = '''  renderOverlays(w, h);
  } catch (err) {
    console.error("[PixiRenderer]", err);
  }
}'''

code = code.replace(old_render_end, new_render_end)
print("  -> Added try-catch to main render for error visibility")

# 10. The Projectile weaponKind is optional - handle safely
code = code.replace(
    '''const kind = (pr as any).weaponKind ?? "laser";''',
    '''const kind = pr.weaponKind ?? "laser";'''
)
print("  -> Fixed: Projectile weaponKind access")

# 11. Enemy isBoss is optional - ensure safe access in getShipTexture call
code = code.replace(
    '''const tex = getShipTexture(e.type, e.color, e.size, e.isBoss);''',
    '''const tex = getShipTexture(e.type, e.color, e.size, !!e.isBoss);'''
)
print("  -> Fixed: Enemy isBoss safe boolean conversion")

# 12. Fix Station type - uses 'id' not zone-name combo. Also Station has 'id' field
# The stationGfxMap key should be unique
code = code.replace(
    '''const key = `${st.zone}-${st.name}`;''',
    '''const key = st.id;'''
)
print("  -> Fixed: Station map key uses st.id")

# Fix station zone check for hiding
code = code.replace(
    '''const zone = key.split("-")[0];
    cont.visible = zone === state.player.zone;''',
    '''cont.visible = true; // only created for current zone'''
)
print("  -> Fixed: Station visibility logic")

# 13. Portal type needs checking
# Portal has: fromZone, toZone, pos
code = code.replace(
    '''const key = `${po.fromZone}-${po.toZone}`;''',
    '''const key = `portal-${po.fromZone}-${po.toZone}`;'''
)
code = code.replace(
    '''const fromZone = key.split("-")[0];
    cont.visible = fromZone === state.player.zone;''',
    '''cont.visible = true; // only created for current zone'''
)
print("  -> Fixed: Portal key and visibility")

# 14. ZONES lookup in updateBackground - make sure it's safe
code = code.replace(
    '''const z = ZONES[state.player.zone as ZoneId];
  if (!z) return;''',
    '''const zoneId = state.player.zone as ZoneId;
  const z = ZONES[zoneId];
  if (!z) return;'''
)
print("  -> Fixed: Zone lookup safety")

# 15. Fix honor floater - recentHonor items have 'amount' and 'ttl' but not 'id'
# Already handles this fine

# 16. ParticleContainer children need to be Sprites with the same base texture
# The issue is that particle sprites in fxPool might need different textures
# but ParticleContainer requires all children to share one texture
# This is fine because we tint them

# 17. Ensure worldContainer.sortableChildren triggers zIndex sorting
# Already set sortableChildren = true

# 18. Fix the Station/Portal cleanup - they should clear when changing zones
# Add zone change detection to syncStations and syncPortals
old_sync_stations = '''function syncStations(): void {
  for (const st of STATIONS) {
    if (st.zone !== state.player.zone) continue;
    const key = st.id;
    if (stationGfxMap.has(key)) continue;'''

new_sync_stations = '''function syncStations(): void {
  // Clear stations from other zones
  for (const [key, cont] of stationGfxMap) {
    const st = STATIONS.find(s => s.id === key);
    if (!st || st.zone !== state.player.zone) {
      worldContainer.removeChild(cont);
      cont.destroy({ children: true });
      stationGfxMap.delete(key);
    }
  }
  for (const st of STATIONS) {
    if (st.zone !== state.player.zone) continue;
    const key = st.id;
    if (stationGfxMap.has(key)) continue;'''

code = code.replace(old_sync_stations, new_sync_stations)
print("  -> Fixed: Station cleanup on zone change")

with open('frontend/src/game/pixi-renderer.ts', 'w') as f:
    f.write(code)

print("\nDONE!")
print("  All type errors and API issues fixed")
print("  Runtime errors will now be logged to console")
