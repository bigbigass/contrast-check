import { describe, expect, it } from "vitest";
import { LOCALES } from "./config";
import { DICTIONARIES } from "./dictionaries";

/** Flatten to "a.b.0.c" → value, so arrays (FAQ, steps) are compared item by item. */
function flatten(value: unknown, prefix = ""): Record<string, unknown> {
  if (value !== null && typeof value === "object") {
    return Object.entries(value).reduce<Record<string, unknown>>(
      (acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }),
      {},
    );
  }
  return { [prefix]: value };
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe("dictionaries", () => {
  const en = flatten(DICTIONARIES.en);
  const enKeys = Object.keys(en).sort();

  it("has a dictionary for every locale", () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual([...LOCALES].sort());
  });

  it.each(LOCALES)("%s has exactly the same keys as en", (locale) => {
    expect(Object.keys(flatten(DICTIONARIES[locale])).sort()).toEqual(enKeys);
  });

  it.each(LOCALES)("%s has no empty values", (locale) => {
    for (const [key, value] of Object.entries(flatten(DICTIONARIES[locale]))) {
      expect(typeof value, key).toBe("string");
      expect((value as string).trim(), key).not.toBe("");
    }
  });

  it.each(LOCALES)("%s keeps the same {placeholders} as en", (locale) => {
    for (const [key, value] of Object.entries(flatten(DICTIONARIES[locale]))) {
      expect(placeholders(value as string), key).toEqual(placeholders(en[key] as string));
    }
  });

  it.each(LOCALES.filter((l) => l !== "en"))("%s is actually translated", (locale) => {
    const d = DICTIONARIES[locale];
    expect(d.home.h1).not.toBe(DICTIONARIES.en.home.h1);
    expect(d.meta.siteDescription).not.toBe(DICTIONARIES.en.meta.siteDescription);
    d.faq.forEach((item, i) => expect(item.q).not.toBe(DICTIONARIES.en.faq[i].q));
  });
});
