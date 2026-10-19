/**
 * WCAG 2.x contrast math. Pure functions, no DOM access.
 * https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 */

export type RGB = { r: number; g: number; b: number };

export const THRESHOLDS = {
  aaNormal: 4.5,
  aaLarge: 3,
  aaaNormal: 7,
  aaaLarge: 4.5,
  ui: 3,
} as const;

export type ContrastResult = {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
  ui: boolean;
};

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Normalize "#ABC", "abc", "#aabbcc" → "#aabbcc". Returns null when invalid. */
export function normalizeHex(input: string): string | null {
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex}`;
}

export function isValidHex(input: string): boolean {
  return normalizeHex(input) !== null;
}

export function hexToRgb(input: string): RGB {
  const hex = normalizeHex(input);
  if (!hex) throw new Error(`Invalid hex color: ${input}`);
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** sRGB 8-bit channel → linear value. */
function channelToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function relativeLuminance(color: string | RGB): number {
  const { r, g, b } = typeof color === "string" ? hexToRgb(color) : color;
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

/** Contrast ratio (L1 + 0.05) / (L2 + 0.05), range 1 … 21. Order-independent. */
export function contrastRatio(a: string | RGB, b: string | RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pass/fail against WCAG thresholds. The raw (unrounded) ratio is compared,
 * so e.g. 4.499 does not pass AA even though it displays as "4.50".
 */
export function evaluateRatio(ratio: number): ContrastResult {
  return {
    ratio,
    aaNormal: ratio >= THRESHOLDS.aaNormal,
    aaLarge: ratio >= THRESHOLDS.aaLarge,
    aaaNormal: ratio >= THRESHOLDS.aaaNormal,
    aaaLarge: ratio >= THRESHOLDS.aaaLarge,
    ui: ratio >= THRESHOLDS.ui,
  };
}

export function checkContrast(fg: string, bg: string): ContrastResult {
  return evaluateRatio(contrastRatio(fg, bg));
}

/** Display format, truncated (not rounded up) to 2 decimals so a fail never reads as a pass. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

// --- HSL helpers for the lightness nudge -----------------------------------

type HSL = { h: number; s: number; l: number };

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue(p, q, h + 1 / 3) * 255,
    g: hue(p, q, h) * 255,
    b: hue(p, q, h - 1 / 3) * 255,
  };
}

/**
 * Find the closest foreground color (same hue/saturation, stepped HSL lightness)
 * that reaches `target` contrast against `bg`. Tries both directions (darker and
 * lighter) and returns the one needing the smaller lightness change, or null if
 * neither direction can reach the target.
 */
export function suggestLightnessNudge(
  fg: string,
  bg: string,
  target: number = THRESHOLDS.aaNormal,
  step = 0.005,
): string | null {
  if (contrastRatio(fg, bg) >= target) return normalizeHex(fg);
  const base = rgbToHsl(hexToRgb(fg));
  let best: { hex: string; delta: number } | null = null;
  for (const dir of [-1, 1]) {
    const steps = Math.ceil((dir === -1 ? base.l : 1 - base.l) / step);
    for (let i = 1; i <= steps; i++) {
      // Clamp so the final step lands exactly on black/white at this hue.
      const l = Math.min(1, Math.max(0, base.l + dir * i * step));
      const hex = rgbToHex(hslToRgb({ ...base, l }));
      if (contrastRatio(hex, bg) >= target) {
        const delta = Math.abs(l - base.l);
        if (!best || delta < best.delta) best = { hex, delta };
        break;
      }
    }
  }
  return best?.hex ?? null;
}
