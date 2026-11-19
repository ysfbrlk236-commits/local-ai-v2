/** Renk dönüşümleri: hex <-> RGB <-> HSV. Tema düzenleyici ve renk çemberi kullanır. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsv {
  /** 0-360 */
  h: number;
  /** 0-1 */
  s: number;
  /** 0-1 */
  v: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** "#abc", "abc", "#aabbcc" kabul eder; geçersizse null. */
export function parseHex(input: string): Rgb | null {
  let hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

/** Saydamlıklı CSS rengi. Geçersiz hex olduğu gibi döner. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb || alpha >= 1) return hex;
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${clamp(alpha, 0, 1).toFixed(2)})`;
}

/** Arka plan rengine göre okunur yazı rengi (siyah ya da beyaz). */
export function readableOn(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#ffffff";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}
