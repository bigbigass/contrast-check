import type { MetadataRoute } from "next";
import { LOCALES, PAGES, type PagePath, languageAlternates } from "@/lib/i18n/config";
import { absoluteUrl } from "@/lib/i18n/seo";
import { SITE_URL } from "@/lib/site";

const SETTINGS: Record<PagePath, Pick<MetadataRoute.Sitemap[number], "changeFrequency" | "priority">> = {
  "/": { changeFrequency: "monthly", priority: 1 },
  "/guide/wcag-aa-vs-aaa/": { changeFrequency: "yearly", priority: 0.7 },
};

/** Every page × every locale, each entry listing all hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PAGES.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(locale, path),
      lastModified: now,
      ...SETTINGS[path],
      alternates: { languages: languageAlternates(SITE_URL, path) },
    })),
  );
}
