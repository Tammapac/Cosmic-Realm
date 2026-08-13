// Schriftfabriken. Vier Rollen, feste Familien und Abstände, damit im ganzen
// Interface nichts auseinanderläuft.
//
// Kenney Future ist die Anzeigeschrift des Spiels und liegt in assets/fonts.
// Vor dem ersten Text muss loadFonts() gelaufen sein.

import { Text, TextStyle } from "pixi.js";
import { FONT, SIZE, LEADING } from "./tokens";

/** Versalien-Label mit weitem Sperrsatz — Rubriken, Reiter, Knopftexte. */
export function label(
  text: string, size: number = SIZE.tiny, fill = 0x9db0c6, spacing = 3.4,
): Text {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: FONT.label,
      fontSize: size,
      fontWeight: "700",
      letterSpacing: spacing,
      fill,
    }),
  });
}

/** Anzeigeschrift für Überschriften und Zahlen im Kopf. */
export function display(
  text: string, size: number = SIZE.title, fill = 0xf2f7ff, spacing = 1.4,
): Text {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: FONT.display,
      fontSize: size,
      fontWeight: "700",
      letterSpacing: spacing,
      fill,
    }),
  });
}

/** Zahlenschrift, tabellarisch — Mengen, Preise, Entfernungen. */
export function value(
  text: string, size: number = SIZE.label, fill = 0xe6f3ff,
): Text {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: FONT.mono,
      fontSize: size,
      fontWeight: "700",
      letterSpacing: 0.4,
      fill,
    }),
  });
}

/** Fließtext mit Umbruch. */
export function body(
  text: string, size: number = SIZE.body, fill = 0xcedef2, wrapWidth?: number,
): Text {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: FONT.body,
      fontSize: size,
      fill,
      lineHeight: size * LEADING,
      wordWrap: wrapWidth !== undefined,
      wordWrapWidth: wrapWidth ?? 0,
    }),
  });
}

/** Fetter Fließtext — Namen in Listen und Karten. */
export function strong(
  text: string, size: number = SIZE.body, fill = 0xe2ecfa, wrapWidth?: number,
): Text {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: FONT.body,
      fontSize: size,
      fontWeight: "700",
      fill,
      wordWrap: wrapWidth !== undefined,
      wordWrapWidth: wrapWidth ?? 0,
    }),
  });
}

/** Glyphe aus der Anzeigeschrift — Rauten, Sterne, Pfeile. */
export function glyph(text: string, size = 10, fill = 0xffffff): Text {
  return new Text({
    text,
    style: new TextStyle({ fontFamily: FONT.display, fontSize: size, fill }),
  });
}

let fontsReady: Promise<void> | null = null;

/** Kenney Future laden. Idempotent — mehrfache Aufrufe teilen dasselbe Promise. */
export function loadFonts(base = "assets/fonts"): Promise<void> {
  if (fontsReady) return fontsReady;
  const faces: [string, string][] = [
    ["Kenney Future", base + "/Kenney Future.ttf"],
    ["Kenney Future Narrow", base + "/Kenney Future Narrow.ttf"],
  ];
  // Font filenames contain spaces ("Kenney Future.ttf") — an unquoted
  // url(...) treats an inner space as a CSS value-list separator, which is
  // exactly the "could not be parsed as a value list" error this was
  // throwing. Quoting the URL fixes the FontFace source, which in turn was
  // aborting the whole loadUiAssets() chain before Assets.loadBundle() ever
  // ran (loadFonts() is awaited first) — so no Kit2 panel frame/background
  // textures ever loaded, which is why windows rendered with no visible
  // outer frame.
  fontsReady = Promise.all(faces.map(async ([family, url]) => {
    const face = new FontFace(family, `url("${url}")`);
    await face.load();
    (document.fonts as FontFaceSet).add(face);
  })).then(() => undefined);
  return fontsReady;
}
