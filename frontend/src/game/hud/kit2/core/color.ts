// Farbrechnung: Hex-Parsing, Aufhellen und Abdunkeln, rgba()-Strings für
// Canvas-Verläufe. Alles synchron und ohne Allokation im Heißpfad.

/** Beliebige Farbangabe zu 0xRRGGBB. */
export function hex(v: string | number): number {
  if (typeof v === "number") return v >>> 0;
  const s = v.trim().replace("#", "");
  if (s.length === 3) {
    const r = s[0], g = s[1], b = s[2];
    return parseInt(r + r + g + g + b + b, 16) >>> 0;
  }
  const n = parseInt(s, 16);
  return Number.isNaN(n) ? 0xb866ff : n >>> 0;
}

/**
 * Aufhellen (amt > 0) oder Abdunkeln (amt < 0).
 * amt = 0.5 heißt "halb zum Weiß", amt = -0.5 "halb zum Schwarz".
 */
export function shade(color: string | number, amt: number): number {
  const c = hex(color);
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    const k = 1 + amt; r *= k; g *= k; b *= k;
  }
  return ((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)) >>> 0;
}

/** rgba()-String für Canvas-Verläufe. */
export function rgba(color: string | number, a: number): string {
  const c = hex(color);
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}

/** Linear zwischen zwei Farben mischen. */
export function mix(a: string | number, b: string | number, k: number): number {
  const ca = hex(a), cb = hex(b);
  const r = ((ca >> 16) & 255) + (((cb >> 16) & 255) - ((ca >> 16) & 255)) * k;
  const g = ((ca >> 8) & 255) + (((cb >> 8) & 255) - ((ca >> 8) & 255)) * k;
  const bl = (ca & 255) + ((cb & 255) - (ca & 255)) * k;
  return ((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)) >>> 0;
}

/** Zahl mit Tausendertrennung, tabellarische Ziffern (CLAUDE.md). */
export const num = (n: number): string => Math.round(n).toLocaleString("en-US");

/** Kurzform: 1.84M, 412K, 96. */
export function short(n: number): string {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
  if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + "K";
  return String(Math.round(n));
}
