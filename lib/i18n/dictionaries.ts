import type { Locale } from "./config";
import en from "./dictionaries/en.json";
import zh from "./dictionaries/zh.json";
import es from "./dictionaries/es.json";
import de from "./dictionaries/de.json";
import fr from "./dictionaries/fr.json";
import ja from "./dictionaries/ja.json";
import pt from "./dictionaries/pt.json";

export { fill } from "./fill";

/** English is the source of truth; every other locale must match its shape. */
export type Dictionary = typeof en;

export const DICTIONARIES: Record<Locale, Dictionary> = { en, zh, es, de, fr, ja, pt };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
