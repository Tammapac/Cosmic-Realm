// Texturküche. Pixi kennt kein box-shadow und keinen linear-gradient, deshalb
// werden Verläufe, Weichzeichnung und Rauschen einmal auf ein Offscreen-Canvas
// gemalt und als Textur gecacht. Jede Textur wird über ihren Schlüssel
// wiederverwendet — bei 24 Sockeln im Inventar heißt das eine Textur statt 24.

import { Texture } from "pixi.js";
import { rgba, shade } from "./color";

const cache = new Map<string, Texture>();

/** Alle gebackenen Texturen freigeben. Beim Szenenwechsel rufen. */
export function clearTextureCache(): void {
  for (const t of cache.values()) t.destroy(true);
  cache.clear();
}

type Stop = [number, string];

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  return [cv, cv.getContext("2d")!];
}

/** Linearer Verlauf. vertical = true malt von oben nach unten. */
export function gradientTexture(stops: Stop[], vertical = true, size = 128): Texture {
  const key = `g|${vertical ? "v" : "h"}|${size}|${stops.map((s) => s[0] + s[1]).join()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas(vertical ? 1 : size, vertical ? size : 1);
  const g = ctx.createLinearGradient(0, 0, vertical ? 0 : size, vertical ? size : 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}

/** Radialer Verlauf — Glow, Wash, Funken, weiche Schatten. */
export function radialTexture(stops: Stop[], size = 128): Texture {
  const key = `r|${size}|${stops.map((s) => s[0] + s[1]).join()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}

/**
 * Metallverlauf der Rahmenkante: 150°, hell oben links nach dunkel unten rechts.
 * Genau die Stops aus CLAUDE.md, in der Akzentfarbe.
 */
export function metalRimTexture(accent: string | number, size = 128): Texture {
  const key = `metal|${accent}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas(size, size);
  const g = ctx.createLinearGradient(0, 0, size * 0.87, size);
  g.addColorStop(0, rgba(shade(accent, 0.86), 1));
  g.addColorStop(0.42, rgba(shade(accent, -0.06), 1));
  g.addColorStop(0.72, rgba(shade(accent, -0.6), 1));
  g.addColorStop(1, rgba(shade(accent, -0.82), 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}

/** Gebürstetes Metall: Metallverlauf plus feine waagerechte Riefen. */
export function brushedMetalTexture(accent: string | number, size = 256): Texture {
  const key = `brushed|${accent}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas(size, size);
  const g = ctx.createLinearGradient(0, 0, size * 0.87, size);
  g.addColorStop(0, rgba(shade(accent, 0.8), 1));
  g.addColorStop(0.44, rgba(shade(accent, -0.1), 1));
  g.addColorStop(1, rgba(shade(accent, -0.74), 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.06;
  for (let y = 0; y < size; y += 2) {
    ctx.fillStyle = (y / 2) % 2 ? "#ffffff" : "#000000";
    ctx.fillRect(0, y, size, 1);
  }
  ctx.globalAlpha = 1;
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}

/** Glasfläche: heller Sturz oben, klare Mitte, Reflexstreifen. */
export function glassTexture(accent: string | number, size = 128): Texture {
  const key = `glass|${accent}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas(size, size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, rgba(shade(accent, 0.9), 0.34));
  g.addColorStop(0.18, rgba(shade(accent, 0.4), 0.12));
  g.addColorStop(0.52, rgba(accent, 0.04));
  g.addColorStop(1, rgba(shade(accent, -0.7), 0.2));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const s = ctx.createLinearGradient(0, 0, size, size * 0.5);
  s.addColorStop(0, "rgba(255,255,255,0)");
  s.addColorStop(0.46, "rgba(255,255,255,.16)");
  s.addColorStop(0.54, "rgba(255,255,255,0)");
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, size, size);
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}

/** Mattglas: Glasfläche plus Rauschen. */
export function frostedGlassTexture(accent: string | number, size = 128): Texture {
  const key = `frosted|${accent}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas(size, size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, rgba(shade(accent, 0.8), 0.24));
  g.addColorStop(1, rgba(shade(accent, -0.6), 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}

/** Kohlefaser: gekreuztes Köpergewebe. */
export function carbonFibreTexture(size = 32): Texture {
  const key = `carbon|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas(size, size);
  ctx.fillStyle = "#0b0e14";
  ctx.fillRect(0, 0, size, size);
  const h = size / 2;
  ctx.fillStyle = "#141a24";
  ctx.fillRect(0, 0, h, h);
  ctx.fillRect(h, h, h, h);
  ctx.strokeStyle = "rgba(255,255,255,.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 3) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, size); ctx.stroke();
  }
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}

/** Hologramm: waagerechte Zeilen in Akzentfarbe, oben heller. */
export function hologramTexture(accent: string | number, size = 64): Texture {
  const key = `holo|${accent}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas(size, size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, rgba(shade(accent, 0.7), 0.3));
  g.addColorStop(1, rgba(accent, 0.06));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  for (let y = 0; y < size; y += 3) ctx.fillRect(0, y, size, 1);
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}

/** Weiche Schattenscheibe für den Wurfschatten. */
export function softShadowTexture(alpha: number, size = 128): Texture {
  return radialTexture([
    [0, `rgba(0,0,0,${alpha})`],
    [0.55, `rgba(0,0,0,${alpha * 0.5})`],
    [1, "rgba(0,0,0,0)"],
  ], size);
}

/** Funkenkorn: weißer Kern, Akzentmantel, weicher Rand. */
export function sparkTexture(accent: string | number, size = 64): Texture {
  return radialTexture([
    [0, "rgba(255,255,255,1)"],
    [0.22, rgba(shade(accent, 0.85), 0.9)],
    [0.5, rgba(shade(accent, 0.2), 0.38)],
    [1, rgba(accent, 0)],
  ], size);
}

/** Ein-Pixel-Weiß für getönte Flächen ohne eigene Graphics-Instanz. */
export function whiteTexture(): Texture {
  const key = "white1";
  const hit = cache.get(key);
  if (hit) return hit;
  const [cv, ctx] = canvas(1, 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1, 1);
  const t = Texture.from(cv);
  cache.set(key, t);
  return t;
}
