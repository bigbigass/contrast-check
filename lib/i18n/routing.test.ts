import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";
import { LANG_TAG, LOCALES, PAGES, languageAlternates, localePath, stripLocale } from "./config";
import { pageAlternates } from "./seo";

/** English URLs that existed before i18n. They must keep working unchanged (no 404, no redirect). */
const LEGACY_EN_ROUTES = ["/", "/guide/wcag-aa-vs-aaa/"];

const EXPECTED_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://contrastcheck.top").replace(
  /\/$/,
  "",
);

describe("existing English routes", () => {
  it.each(LEGACY_EN_ROUTES)("%s is still a page served at the same URL", async (route) => {
    expect(PAGES).toContain(route);
    expect(localePath("en", route)).toBe(route);

    // Backed by a page file under app/[locale]/
    const file = join(process.cwd(), "app", "[locale]", ...route.split("/").filter(Boolean), "page.tsx");
    expect(existsSync(file), file).toBe(true);

    // Served by rewrite (not redirect) to the en locale.
    const rewrites = await nextConfig.rewrites!();
    const before = Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles;
    expect(before).toContainEqual({ source: route, destination: `/en${route}` });
    const redirects = await nextConfig.redirects!();
    // The only redirects are /en… → root; no legacy route is redirected.
    for (const r of redirects) expect(r.source === "/en" || r.source.startsWith("/en/")).toBe(true);
  });

  it("keeps trailing slashes", () => {
    expect(nextConfig.trailingSlash).toBe(true);
  });
});

describe("locale paths", () => {
  it("prefixes non-English locales", () => {
    expect(localePath("de", "/")).toBe("/de/");
    expect(localePath("ja", "/guide/wcag-aa-vs-aaa/")).toBe("/ja/guide/wcag-aa-vs-aaa/");
  });

  it("strips a locale prefix", () => {
    expect(stripLocale("/fr/guide/wcag-aa-vs-aaa/")).toBe("/guide/wcag-aa-vs-aaa/");
    expect(stripLocale("/en/")).toBe("/");
    expect(stripLocale("/zh")).toBe("/");
    expect(stripLocale("/guide/wcag-aa-vs-aaa/")).toBe("/guide/wcag-aa-vs-aaa/");
  });
});

describe("hreflang", () => {
  it("lists 7 locales + x-default for a sample page", () => {
    const alt = pageAlternates("es", "/guide/wcag-aa-vs-aaa/");
    expect(alt.canonical).toBe(`${SITE_URL}/es/guide/wcag-aa-vs-aaa/`);
    const languages = alt.languages as Record<string, string>;
    expect(Object.keys(languages).sort()).toEqual([...LOCALES.map((l) => LANG_TAG[l]), "x-default"].sort());
    expect(languages["x-default"]).toBe(`${SITE_URL}/guide/wcag-aa-vs-aaa/`);
    expect(languages.en).toBe(`${SITE_URL}/guide/wcag-aa-vs-aaa/`);
    expect(languages["zh-Hans"]).toBe(`${SITE_URL}/zh/guide/wcag-aa-vs-aaa/`);
  });
});

describe("sitemap", () => {
  const entries = sitemap();

  it("uses the production site URL", () => {
    expect(SITE_URL).toBe(EXPECTED_SITE_URL);
  });

  it("contains every page × 7 locales as absolute URLs", () => {
    expect(entries).toHaveLength(PAGES.length * LOCALES.length);
    const urls = entries.map((e) => e.url);
    for (const page of PAGES) {
      for (const locale of LOCALES) expect(urls).toContain(`${EXPECTED_SITE_URL}${localePath(locale, page)}`);
    }
    for (const url of urls) expect(url.startsWith(`${EXPECTED_SITE_URL}/`)).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("lists hreflang alternates on every entry", () => {
    for (const entry of entries) {
      const page = PAGES.find((p) => entry.url.endsWith(p) && stripLocale(entry.url.slice(SITE_URL.length)) === p)!;
      expect(entry.alternates?.languages).toEqual(languageAlternates(EXPECTED_SITE_URL, page));
    }
  });
});
