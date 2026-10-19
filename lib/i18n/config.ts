/**
 * Locale + route registry. Pure data/helpers so next.config.ts, the sitemap and
 * tests can all share it.
 */

export const LOCALES = ["en", "zh", "es", "de", "fr", "ja", "pt"] as const;
export type Locale = (typeof LOCALES)[number];

/** English is served at the site root (no /en/ prefix). */
export const DEFAULT_LOCALE: Locale = "en";

/** Every page, as its English (root) path with trailing slash. */
export const PAGES = ["/", "/guide/wcag-aa-vs-aaa/"] as const;
export type PagePath = (typeof PAGES)[number];

/** BCP 47 tags for <html lang>, hreflang and JSON-LD inLanguage. */
export const LANG_TAG: Record<Locale, string> = {
  en: "en",
  zh: "zh-Hans",
  es: "es",
  de: "de",
  fr: "fr",
  ja: "ja",
  pt: "pt",
};

/** Open Graph locale codes. */
export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  zh: "zh_CN",
  es: "es_ES",
  de: "de_DE",
  fr: "fr_FR",
  ja: "ja_JP",
  pt: "pt_BR",
};

/** Native language names for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  ja: "日本語",
  pt: "Português",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** "/guide/x/" + "de" → "/de/guide/x/"; English stays at the root. */
export function localePath(locale: Locale, path: string = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return locale === DEFAULT_LOCALE ? p : `/${locale}${p}`;
}

/** Strip a leading locale segment (including "en") from a pathname. */
export function stripLocale(pathname: string): string {
  const m = /^\/([a-z]{2})(\/.*|$)/.exec(pathname);
  if (m && isLocale(m[1])) return m[2] || "/";
  return pathname || "/";
}

/** hreflang → absolute URL for every locale plus x-default (English). */
export function languageAlternates(siteUrl: string, path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) out[LANG_TAG[locale]] = `${siteUrl}${localePath(locale, path)}`;
  out["x-default"] = `${siteUrl}${localePath(DEFAULT_LOCALE, path)}`;
  return out;
}

/** Space between adjacent runs of text (none for Chinese/Japanese). */
export function wordSpace(locale: Locale): string {
  return locale === "zh" || locale === "ja" ? "" : " ";
}
