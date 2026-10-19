import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { type Locale, type PagePath, languageAlternates, localePath } from "./config";

/** Absolute URL of `path` in `locale`. */
export function absoluteUrl(locale: Locale, path: PagePath): string {
  return `${SITE_URL}${localePath(locale, path)}`;
}

/** Self-referencing canonical + hreflang for all locales + x-default. */
export function pageAlternates(locale: Locale, path: PagePath): NonNullable<Metadata["alternates"]> {
  return {
    canonical: absoluteUrl(locale, path),
    languages: languageAlternates(SITE_URL, path),
  };
}
