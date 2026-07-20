# Parallax Asset-Katalog (DarkOrbit_Parallax_Layers)

Quelle: C:/Users/tamma/Desktop/DarkOrbit_Parallax_Layers -- 166 PNGs, 78 Map-Manifeste (2100x1310-Referenz-Canvas).
Analyse: automatisch (PIL) -- Transparenz, Randdeckung, Frame-/Kachel-Hinweise, Schwarzrand-Verdacht.

## Zusammenfassung

| Kategorie | Dateien | Transparent | Rolle | Ebene | Verwendung |
|---|---|---|---|---|---|
| 01_backgrounds | 43 | 0 | Hintergrundbild (opak) | Far Space (0.02) | Basis pro Map |
| 02_starfields | 20 | 0 | Sterne-Kachel 50x50 (opak, ADD-Blend noetig) | Mid Space (0.06) | alle Maps, komponiert zu 400x400-Tile |
| 03_planets | 48 | 48 | transparente Deko (Planet) | Mid Space (manifest pFactor) / Foreground (Silhouette) | per Manifest bzw. kuratiert |
| 04_lensflares | 43 | 43 | transparente Deko (Flare-Komponente, mehrteilig) | Atmosphere (0.12, ADD) | per Manifest |
| 05_masks | 10 | 10 | transparente Maske 210x131 | nicht genutzt (nur 5-x Maps) | - |
| 06_special_layers | 2 | 2 | transparentes Overlay 2100x1310 | Atmosphere (optional) | - |

## Auffaelligkeiten

- **Starfields sind opak** (schwarzer Grund): korrektes Rendering nur mit ADD-Blend -- dadurch keine schwarzen Rechtecke.
- **planet12.png**: Schwarzrand-Verdacht (>85% dunkle Kantenpixel) -- von der kuratierten Auswahl ausgeschlossen.
- **mask91/92/93-x**: Schwarzrand-Verdacht, betreffen nur 5-x-Maps -- nicht verwendet.
- **Lensflares** bestehen aus je 7 Einzelkomponenten (__imageN); verwendet werden die ersten beiden (Hauptglow + Ring), gestapelt am Manifest-Anker.
- **Fehlende Assets** (laut MISSING_REFERENCES.md): planet48.png (Map 4-5, 3 Platzierungen) -- sichtbar ersetzt durch kuratierte verfuegbare Planeten, KEIN stiller Ersatz; background56/62-69/1091/2001/... betreffen nur GG-/Invasion-/5-x-Maps (nicht in den 20 Zonen).
- 11/20 Zonen haben authentische Original-Kompositionen aus den Manifesten; 9/20 (1-5, 2-5, 3-2..3-5, 4-1, 4-4, 4-5) enthalten im Original nur Background+Starfield und wurden mit festen, deterministischen Kompositionen aus dem verfuegbaren Planeten-Pool versehen (Drittel-Raster, keine Zufalls-Overlaps, in scenes.json fixiert).

## Datei-Details

| Datei | Kategorie | Groesse | Transparenz | Frames/Kachel | Ebene | Verdacht |
|---|---|---|---|---|---|---|
| background1.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background10.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background11.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background12.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background13.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background14.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background15.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background16.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background17.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background18.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background19.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background2.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background20.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background21.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background22.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background23.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background24.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background25.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background255.png | 01_backgrounds | 1050x655 | nein | - | Far Space (0.02) | - |
| background26.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background27.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background28.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background29.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background3.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background4.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background42.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background5.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background51.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background52.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background53.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background54.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background55.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background57.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background6.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background61.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background7.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background8.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background81.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background82.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background9.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background91.png | 01_backgrounds | 4200x2620 | nein | - | Far Space (0.02) | - |
| background92.png | 01_backgrounds | 2100x1310 | nein | - | Far Space (0.02) | - |
| background93.png | 01_backgrounds | 4200x2620 | nein | - | Far Space (0.02) | - |
| stars1-50x50__image10_id10.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars1-50x50__image1_id1.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars1-50x50__image2_id2.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars1-50x50__image3_id3.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars1-50x50__image4_id4.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars1-50x50__image5_id5.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars1-50x50__image6_id6.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars1-50x50__image7_id7.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars1-50x50__image8_id8.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars1-50x50__image9_id9.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image10_id10.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image1_id1.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image2_id2.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image3_id3.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image4_id4.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image5_id5.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image6_id6.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image7_id7.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image8_id8.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| stars2-50x50__image9_id9.png | 02_starfields | 50x50 | nein | Komponente | Mid Space (0.06) | - |
| pirateExit.png | 03_planets | 274x279 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| pirateOneway.png | 03_planets | 150x215 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet1.png | 03_planets | 533x533 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet10.png | 03_planets | 125x125 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet11.png | 03_planets | 502x504 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet12.png | 03_planets | 1035x608 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | Schwarzrand? |
| planet13.png | 03_planets | 849x849 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet14.png | 03_planets | 735x726 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet15.png | 03_planets | 191x190 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet16.png | 03_planets | 173x164 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet17.png | 03_planets | 356x356 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet18.png | 03_planets | 185x185 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet19.png | 03_planets | 332x331 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet2.png | 03_planets | 178x177 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet20.png | 03_planets | 1100x987 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet21.png | 03_planets | 132x132 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet22.png | 03_planets | 50x50 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet23.png | 03_planets | 592x592 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet24.png | 03_planets | 330x330 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet25.png | 03_planets | 511x511 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet26.png | 03_planets | 460x201 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet27.png | 03_planets | 133x132 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet28.png | 03_planets | 319x319 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet29.png | 03_planets | 127x128 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet3.png | 03_planets | 229x229 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet30.png | 03_planets | 711x696 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet31.png | 03_planets | 752x752 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet32.png | 03_planets | 407x407 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet33.png | 03_planets | 790x658 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet34.png | 03_planets | 352x357 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet35.png | 03_planets | 467x507 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet36.png | 03_planets | 610x560 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet37.png | 03_planets | 591x549 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet38.png | 03_planets | 531x388 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet39.png | 03_planets | 543x399 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet4.png | 03_planets | 572x572 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet40.png | 03_planets | 2100x1310 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet41.png | 03_planets | 2100x1310 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet42.png | 03_planets | 2100x1310 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet43.png | 03_planets | 2100x1310 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet44.png | 03_planets | 544x562 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet45.png | 03_planets | 1670x942 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet46.png | 03_planets | 810x654 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet5.png | 03_planets | 572x572 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet6.png | 03_planets | 350x350 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet7.png | 03_planets | 1300x1300 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet8.png | 03_planets | 226x226 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| planet9.png | 03_planets | 103x111 | ja | - | Mid Space (manifest pFactor) / Foreground (Silhouette) | - |
| lensFlash.png | 04_lensflares | 729x729 | ja | - | Atmosphere (0.12, ADD) | - |
| lensflare0__image10_id19.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image11_id21.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image12_id23.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image13_id25.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image14_id27.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image15_id29.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image16_id32.png | 04_lensflares | 171x178 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image17_id35.png | 04_lensflares | 76x76 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image18_id38.png | 04_lensflares | 34x35 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image19_id41.png | 04_lensflares | 50x48 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image1_id1.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image20_id44.png | 04_lensflares | 137x136 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image21_id47.png | 04_lensflares | 252x251 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image2_id3.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image3_id5.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image4_id7.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image5_id9.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image6_id11.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image7_id13.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image8_id15.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare0__image9_id17.png | 04_lensflares | 400x400 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare1__image1_id1.png | 04_lensflares | 324x324 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare1__image2_id4.png | 04_lensflares | 171x178 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare1__image3_id7.png | 04_lensflares | 76x74 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare1__image4_id10.png | 04_lensflares | 34x34 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare1__image5_id13.png | 04_lensflares | 50x50 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare1__image6_id16.png | 04_lensflares | 137x137 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare1__image7_id19.png | 04_lensflares | 252x251 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare2__image1_id1.png | 04_lensflares | 324x324 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare2__image2_id4.png | 04_lensflares | 171x178 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare2__image3_id7.png | 04_lensflares | 76x76 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare2__image4_id10.png | 04_lensflares | 34x33 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare2__image5_id13.png | 04_lensflares | 50x50 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare2__image6_id16.png | 04_lensflares | 137x136 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare2__image7_id19.png | 04_lensflares | 252x251 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare3__image1_id1.png | 04_lensflares | 324x323 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare3__image2_id4.png | 04_lensflares | 171x178 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare3__image3_id7.png | 04_lensflares | 76x74 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare3__image4_id10.png | 04_lensflares | 34x33 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare3__image5_id13.png | 04_lensflares | 50x48 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare3__image6_id16.png | 04_lensflares | 137x134 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| lensflare3__image7_id19.png | 04_lensflares | 252x251 | ja | Komponente | Atmosphere (0.12, ADD) | - |
| mask91-1.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | Schwarzrand? |
| mask91-2.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | Schwarzrand? |
| mask91-3.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | - |
| mask92-0.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | - |
| mask92-1.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | Schwarzrand? |
| mask92-2.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | Schwarzrand? |
| mask92-3.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | - |
| mask93-1.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | Schwarzrand? |
| mask93-2.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | Schwarzrand? |
| mask93-3.png | 05_masks | 210x131 | ja | - | nicht genutzt (nur 5-x Maps) | - |
| layer1.png | 06_special_layers | 2100x1310 | ja | - | Atmosphere (optional) | - |
| layer2.png | 06_special_layers | 2100x1310 | ja | - | Atmosphere (optional) | - |