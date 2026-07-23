Item icon sprites (one PNG per family+tier). Transparent PNG, ~256px, any
size (contained/centered in the UI slot). Drop files here with these exact
names — they wire up automatically via itemSpriteUrl():

  LASERS (11):  laser-t0.png laser-t1.png ... laser-t10.png
  ROCKETS (6):  rocket-t0.png rocket-t1.png ... rocket-t5.png
  GENERATORS(5):gen-t1.png gen-t2.png gen-t3.png gen-t4.png gen-t5.png
  MODULES (5):  mod-t1.png mod-t2.png mod-t3.png mod-t4.png mod-t5.png

Low tier = plain/simple look, high tier = powerful/glowing. Missing files
fall back to the item's Unicode glyph, so partial delivery is fine.
