"use client";

import { usePathname } from "next/navigation";
import { track } from "@vercel/analytics";
import { type Locale, localePath, stripLocale } from "@/lib/i18n/config";

type Option = { locale: Locale; name: string; lang: string };

/** Header language menu: links to the same page in every locale, keeping ?fg=&bg=. */
export default function LanguageSwitcher({
  locale,
  label,
  options,
}: {
  locale: Locale;
  label: string;
  options: Option[];
}) {
  const path = stripLocale(usePathname() ?? "/");
  const current = options.find((o) => o.locale === locale);

  return (
    <details className="relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100 marker:hidden"
        aria-label={label}
      >
        <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
        </svg>
        {current?.name}
      </summary>
      <ul className="absolute right-0 z-10 mt-1 min-w-36 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
        {options.map((o) => (
          <li key={o.locale}>
            <a
              href={localePath(o.locale, path)}
              hrefLang={o.lang}
              lang={o.lang}
              aria-current={o.locale === locale ? "true" : undefined}
              onClick={(e) => {
                track("locale_switch", { from: locale, to: o.locale });
                // Keep shared colors (?fg=&bg=) when switching language.
                const search = window.location.search;
                if (search) {
                  e.preventDefault();
                  window.location.assign(localePath(o.locale, path) + search);
                }
              }}
              className={`block px-3 py-1.5 text-sm hover:bg-slate-100 ${
                o.locale === locale ? "font-semibold text-slate-900" : "text-slate-700"
              }`}
            >
              {o.name}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
