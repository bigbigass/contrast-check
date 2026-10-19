import type { Locale } from "./config";
import { LANG_TAG } from "./config";

/**
 * Locale-aware version of formatRatio(): still truncated (never rounded up) to
 * 2 decimals so a fail never reads as a pass, but with the locale's decimal
 * separator ("4,54:1" in de/fr/es/pt).
 */
export function formatRatioLocale(ratio: number, locale: Locale): string {
  const truncated = Math.floor(ratio * 100) / 100;
  const n = new Intl.NumberFormat(LANG_TAG[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n.format(truncated)}:1`;
}

/** Threshold label such as "4.5:1" / "4,5:1" (no forced decimals). */
export function formatThreshold(value: number, locale: Locale): string {
  const n = new Intl.NumberFormat(LANG_TAG[locale], { maximumFractionDigits: 2 });
  return `${n.format(value)}:1`;
}
