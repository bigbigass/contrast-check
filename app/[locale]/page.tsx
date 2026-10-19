import type { Metadata } from "next";
import ContrastTool from "@/components/ContrastTool";
import JsonLd from "@/components/JsonLd";
import Rich from "@/components/Rich";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LANG_TAG, OG_LOCALE, isLocale, localePath, wordSpace } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { absoluteUrl, pageAlternates } from "@/lib/i18n/seo";
import { SITE_NAME } from "@/lib/site";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).meta;
  return {
    title: { absolute: `${t.siteTitle} — ${SITE_NAME}` },
    description: t.siteDescription,
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
  };
}

export default async function Home({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  const webAppLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: absoluteUrl(locale, "/"),
    description: t.meta.siteDescription,
    applicationCategory: "DesignApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    inLanguage: LANG_TAG[locale],
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: t.jsonLd.featureList,
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: LANG_TAG[locale],
    mainEntity: t.faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd data={webAppLd} />
      <JsonLd data={faqLd} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.home.h1}</h1>
        <p className="mt-2 max-w-3xl text-slate-700">{t.home.intro}</p>
      </div>

      <ContrastTool locale={locale} t={t.tool} />

      <section id="how-it-works" className="mt-12 max-w-3xl scroll-mt-6">
        <h2 className="text-2xl font-bold">{t.home.howTitle}</h2>
        <div className="mt-3 space-y-3 text-slate-800">
          <p>
            <Rich text={t.home.howIntro} />
          </p>
          <ol className="list-decimal space-y-1 pl-6">
            {t.home.howSteps.map((step) => (
              <li key={step}>
                <Rich text={step} />
              </li>
            ))}
          </ol>
          <p>
            <Rich text={t.home.howRatio} />
          </p>
          <p>
            {t.home.readMorePrefix}
            {wordSpace(locale)}
            <Link href={localePath(locale, "/guide/wcag-aa-vs-aaa/")} className="text-indigo-700 underline">
              {t.home.readMoreLink}
            </Link>
          </p>
        </div>
      </section>

      <section id="faq" className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold">{t.home.faqTitle}</h2>
        <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {t.faq.map(({ q, a }) => (
            <details key={q} className="group p-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                {q}
              </summary>
              <p className="mt-2 pl-5 text-slate-700">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
