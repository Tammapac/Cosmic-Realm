// Geometrie: die clip-path-Polygone aus Cosmic Kit, Zahl für Zahl übernommen.
//
// Panels schneiden oben rechts und unten links, Karten oben links und unten
// rechts (CLAUDE.md). Nie border zusammen mit clip-path — statt dessen wird die
// Kante als gestapelte, jeweils enger geclippte Fläche gebaut.

import { Graphics } from "pixi.js";

/** Welche Ecken gefast sind. */
export type Cuts = "tr-bl" | "tl-br" | "all" | "none";

/**
 * Punktliste eines gefasten Rechtecks.
 * Rückgabe ist ein flaches Array [x0,y0,x1,y1,…] für Graphics.poly().
 */
export function chamferPath(
  x: number, y: number, w: number, h: number, c: number, cuts: Cuts = "tr-bl",
): number[] {
  const r = x + w, b = y + h;
  if (cuts === "none" || c <= 0) return [x, y, r, y, r, b, x, b];
  if (cuts === "tl-br") return [x + c, y, r, y, r, b - c, r - c, b, x, b, x, y + c];
  if (cuts === "all") {
    return [x + c, y, r - c, y, r, y + c, r, b - c, r - c, b, x + c, b, x, b - c, x, y + c];
  }
  return [x, y, r - c, y, r, y + c, r, b, x + c, b, x, b - c];
}

/** Gefaste Fläche in ein Graphics zeichnen. */
export function cut(
  g: Graphics, x: number, y: number, w: number, h: number, c: number,
  fill: number, alpha = 1, cuts: Cuts = "tr-bl",
): Graphics {
  g.poly(chamferPath(x, y, w, h, c, cuts)).fill({ color: fill, alpha });
  return g;
}

/** Gefaste Kontur. */
export function cutStroke(
  g: Graphics, x: number, y: number, w: number, h: number, c: number,
  width: number, color: number, alpha = 1, cuts: Cuts = "tr-bl",
): Graphics {
  g.poly(chamferPath(x, y, w, h, c, cuts)).stroke({ width, color, alpha });
  return g;
}

/** 26/74-Hexagon — Item-Sockel, Wappen, Kartenknoten. */
export function hexPath(x: number, y: number, w: number, h: number): number[] {
  return [
    x + w * 0.5, y,
    x + w, y + h * 0.26,
    x + w, y + h * 0.74,
    x + w * 0.5, y + h,
    x, y + h * 0.74,
    x, y + h * 0.26,
  ];
}

/** Achteck — Rangabzeichen, Kapstein-Knoten. */
export function octPath(x: number, y: number, w: number, h: number, q = 0.29): number[] {
  const qx = w * q, qy = h * q, r = x + w, b = y + h;
  return [x + qx, y, r - qx, y, r, y + qy, r, b - qy, r - qx, b, x + qx, b, x, b - qy, x, y + qy];
}

/** Raute — Filterpunkte, Marker, Kanalpunkte. */
export function diamondPath(cx: number, cy: number, r: number): number[] {
  return [cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy];
}

/** Dreieck nach oben — Gegner, Aufwärtspfeile. */
export function trianglePath(cx: number, cy: number, r: number): number[] {
  return [cx, cy - r, cx + r * 0.86, cy + r * 0.7, cx - r * 0.86, cy + r * 0.7];
}

/** Wappenformen für den Clan-Bau. */
export type CrestShape = "hex" | "shield" | "diamond" | "oct" | "chev" | "blade";

export function crestPath(
  kind: CrestShape, x: number, y: number, w: number, h: number,
): number[] {
  const r = x + w, b = y + h, mx = x + w / 2;
  switch (kind) {
    case "shield": return [x, y, r, y, r, y + h * 0.58, mx, b, x, y + h * 0.58];
    case "diamond": return [mx, y, r, y + h / 2, mx, b, x, y + h / 2];
    case "oct": return octPath(x, y, w, h);
    case "chev": return [mx, y, r, y + h * 0.34, r, b, mx, b - h * 0.28, x, b, x, y + h * 0.34];
    case "blade": return [mx, y, r, y + h * 0.42, r - w * 0.18, b, x + w * 0.18, b, x, y + h * 0.42];
    default: return hexPath(x, y, w, h);
  }
}

/** Kreisbogen als Polygonzug — für Abklingringe ohne Filter. */
export function arcPath(
  cx: number, cy: number, r: number, from: number, to: number, steps = 48,
): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + (to - from) * (i / steps);
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}
