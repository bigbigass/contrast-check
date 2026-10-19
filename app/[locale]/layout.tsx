import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { LANG_TAG, LOCALES, LOCALE_NAMES, OG_LOCALE, type Locale, isLocale, localePath } from "@/lib/i18n/config";
import { fill, getDictionary } from "@/lib/i18n/dictionaries";
import { pageAlternates } from "@/lib/i18n/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "../globals.css";

type Params = Promise<{ locale: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).meta;
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${t.siteTitle} — ${SITE_NAME}`,
      template: `%s — ${SITE_NAME}`,
    },
    description: t.siteDescription,
    applicationName: SITE_NAME,
    alternates: pageAlternates(locale, "/"),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: localePath(locale, "/"),
      title: t.siteTitle,
      description: t.siteDescription,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: t.ogImageAlt }],
      locale: OG_LOCALE[locale],
    },
    twitter: {
      card: "summary_large_image",
      title: t.siteTitle,
      description: t.siteDescription,
      images: ["/og.png"],
    },
    icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  const options = LOCALES.map((l: Locale) => ({ locale: l, name: LOCALE_NAMES[l], lang: LANG_TAG[l] }));

  return (
    <html lang={LANG_TAG[locale]}>
      <body className="min-h-screen font-sans">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <Link href={localePath(locale, "/")} className="flex items-center gap-2 font-semibold" aria-label={t.nav.home}>
              <span aria-hidden className="inline-flex h-6 w-6 overflow-hidden rounded-full border border-slate-900">
                <span className="w-1/2 bg-slate-900" />
                <span className="w-1/2 bg-white" />
              </span>
              {SITE_NAME}
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href={localePath(locale, "/guide/wcag-aa-vs-aaa/")}
                className="text-sm text-slate-700 underline-offset-4 hover:underline"
              >
                {t.nav.guide}
              </Link>
              <LanguageSwitcher locale={locale} label={t.nav.language} options={options} />
            </div>
          </nav>
        </header>
        {children}
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-600">
            <p>{fill(t.footer.text, { year: new Date().getFullYear(), site: SITE_NAME })}</p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
