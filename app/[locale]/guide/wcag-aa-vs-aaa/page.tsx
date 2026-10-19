import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import Rich from "@/components/Rich";
import { contrastRatio } from "@/lib/contrast";
import { LANG_TAG, OG_LOCALE, type Locale, isLocale, localePath, wordSpace } from "@/lib/i18n/config";
import { fill, getDictionary } from "@/lib/i18n/dictionaries";
import { formatRatioLocale, formatThreshold } from "@/lib/i18n/format";
import { absoluteUrl, pageAlternates } from "@/lib/i18n/seo";
import { SITE_NAME } from "@/lib/site";

const PATH = "/guide/wcag-aa-vs-aaa/";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: t.meta.guideTitle,
    description: t.meta.guideDescription,
    alternates: pageAlternates(locale, PATH),
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      url: localePath(locale, PATH),
      title: t.guide.headline,
      description: t.meta.guideDescription,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: t.meta.ogImageAlt }],
      locale: OG_LOCALE[locale],
    },
    twitter: {
      card: "summary_large_image",
      title: t.guide.headline,
      description: t.meta.guideDescription,
      images: ["/og.png"],
    },
  };
}

function Example({ locale, fg, bg, label, note }: { locale: Locale; fg: string; bg: string; label: string; note: string }) {
  return (
    <Link
      href={`${localePath(locale, "/")}?fg=${fg.slice(1)}&bg=${bg.slice(1)}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 hover:border-indigo-400"
      style={{ background: bg, color: fg }}
    >
      <span className="font-medium">{label}</span>
      <span className="text-sm">
        {formatRatioLocale(contrastRatio(fg, bg), locale)} · {note}
      </span>
    </Link>
  );
}

export default async function Guide({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { guide: t, meta } = getDictionary(locale);
  const r = (v: number) => formatThreshold(v, locale);
  const sp = wordSpace(locale);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t.headline,
    description: meta.guideDescription,
    inLanguage: LANG_TAG[locale],
    mainEntityOfPage: absoluteUrl(locale, PATH),
    publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl(locale, "/") },
  };

  const examples = [
    { fg: "#000000", note: t.examplePassesAll },
    { fg: "#595959", note: t.exampleJustAAA },
    { fg: "#767676", note: t.exampleAAOnly },
    { fg: "#777777", note: t.exampleFailsAA },
    { fg: "#949494", note: t.exampleLargeOnly },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={articleLd} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-600">
        <Link href={localePath(locale, "/")} className="underline">
          {t.breadcrumbHome}
        </Link>{" "}
        › {t.breadcrumbGuide}
      </nav>
      <article className="space-y-5 text-slate-800 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t.headline}</h1>
        <p className="text-lg">
          <Rich text={t.intro} />
        </p>

        <h2>{t.tableTitle}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-white text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3">{t.colContent}</th>
                <th className="p-3">{t.colAA}</th>
                <th className="p-3">{t.colAAA}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-3">{t.rowNormal}</td>
                <td className="p-3 font-mono">{r(4.5)}</td>
                <td className="p-3 font-mono">{r(7)}</td>
              </tr>
              <tr>
                <td className="p-3">{t.rowLarge}</td>
                <td className="p-3 font-mono">{r(3)}</td>
                <td className="p-3 font-mono">{r(4.5)}</td>
              </tr>
              <tr>
                <td className="p-3">{t.rowUi}</td>
                <td className="p-3 font-mono">{r(3)}</td>
                <td className="p-3">{t.noAAA}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>{t.criteria}</p>

        <h2>{t.largeTitle}</h2>
        <p>
          <Rich text={t.largeBody} />
        </p>

        <h2>{t.examplesTitle}</h2>
        <div className="space-y-2">
          {examples.map(({ fg, note }) => (
            <Example
              key={fg}
              locale={locale}
              fg={fg}
              bg="#ffffff"
              label={fill(t.examplePair, { fg, bg: "#ffffff" })}
              note={note}
            />
          ))}
        </div>
        <p className="text-sm text-slate-600">{t.examplesHint}</p>

        <h2>{t.whichTitle}</h2>
        <ul className="list-disc space-y-2 pl-6">
          {t.advice.map(({ title, text }) => (
            <li key={title}>
              <strong>{title}</strong>
              {sp}
              {text}
            </li>
          ))}
        </ul>

        <h2>{t.checkTitle}</h2>
        <p>
          {t.checkPrefix}
          {sp}
          <Link href={localePath(locale, "/")} className="text-indigo-700 underline">
            {t.checkLink}
          </Link>
          {sp}
          {t.checkSuffix}
        </p>
      </article>
    </main>
  );
}
