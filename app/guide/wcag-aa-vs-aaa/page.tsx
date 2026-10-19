import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const TITLE = "WCAG AA vs AAA Contrast: Which Level Should You Target?";
const DESCRIPTION =
  "The difference between WCAG AA and AAA color contrast: 4.5:1 vs 7:1 for normal text, 3:1 vs 4.5:1 for large text, what counts as large text, and which level your project actually needs.";

export const metadata: Metadata = {
  title: "WCAG AA vs AAA Contrast Ratios Explained",
  description: DESCRIPTION,
  alternates: { canonical: "/guide/wcag-aa-vs-aaa/" },
  openGraph: { type: "article", url: "/guide/wcag-aa-vs-aaa/", title: TITLE, description: DESCRIPTION },
};

const articleLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  description: DESCRIPTION,
  inLanguage: "en",
  mainEntityOfPage: `${SITE_URL}/guide/wcag-aa-vs-aaa/`,
  publisher: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
};

function Example({ fg, bg, note }: { fg: string; bg: string; note: string }) {
  return (
    <Link
      href={`/?fg=${fg.slice(1)}&bg=${bg.slice(1)}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 hover:border-indigo-400"
      style={{ background: bg, color: fg }}
    >
      <span className="font-medium">
        {fg} on {bg}
      </span>
      <span className="text-sm">{note}</span>
    </Link>
  );
}

export default function Guide() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={articleLd} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-600">
        <Link href="/" className="underline">
          Color contrast checker
        </Link>{" "}
        › Guide
      </nav>
      <article className="space-y-5 text-slate-800 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{TITLE}</h1>
        <p className="text-lg">
          WCAG 2.2 defines two levels of text contrast. <strong>AA</strong> is the level referenced by most accessibility
          laws and policies; <strong>AAA</strong> is an enhanced level for content that needs to be readable by as many
          people as possible.
        </p>

        <h2>The thresholds at a glance</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-white text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3">Content</th>
                <th className="p-3">AA (minimum)</th>
                <th className="p-3">AAA (enhanced)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-3">Normal text</td>
                <td className="p-3 font-mono">4.5:1</td>
                <td className="p-3 font-mono">7:1</td>
              </tr>
              <tr>
                <td className="p-3">Large text (≥ 24px, or ≥ 18.66px bold)</td>
                <td className="p-3 font-mono">3:1</td>
                <td className="p-3 font-mono">4.5:1</td>
              </tr>
              <tr>
                <td className="p-3">UI components &amp; graphics (SC 1.4.11)</td>
                <td className="p-3 font-mono">3:1</td>
                <td className="p-3">No separate AAA level</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The text criteria are SC 1.4.3 Contrast (Minimum) for AA and SC 1.4.6 Contrast (Enhanced) for AAA. Logos,
          purely decorative text and disabled controls are exempt.
        </p>

        <h2>What counts as “large text”?</h2>
        <p>
          WCAG defines large text as at least <strong>18 point</strong> regular or <strong>14 point bold</strong>. On the
          web, 1pt = 1.333px, so that is roughly <strong>24px</strong> regular or <strong>18.66px</strong> bold. Most
          body copy (14–18px) is <em>normal</em> text and needs the stricter threshold.
        </p>

        <h2>Examples</h2>
        <div className="space-y-2">
          <Example fg="#000000" bg="#ffffff" note="21:1 · passes AA and AAA" />
          <Example fg="#595959" bg="#ffffff" note="7.00:1 · just passes AAA" />
          <Example fg="#767676" bg="#ffffff" note="4.54:1 · passes AA, fails AAA" />
          <Example fg="#777777" bg="#ffffff" note="4.47:1 · fails AA for normal text" />
          <Example fg="#949494" bg="#ffffff" note="3.03:1 · large text and UI only" />
        </div>
        <p className="text-sm text-slate-600">Click any example to open it in the checker.</p>

        <h2>Which level should you target?</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Aim for AA everywhere.</strong> ADA guidance in the US, Section 508, EN 301 549 and the European
            Accessibility Act all point to WCAG Level AA. Failing AA is a real compliance risk.
          </li>
          <li>
            <strong>Use AAA for long-form reading.</strong> Articles, documentation, government and healthcare content
            benefit from 7:1 body text, especially for older readers and people with low vision.
          </li>
          <li>
            <strong>Don’t require AAA site-wide.</strong> W3C itself notes that AAA cannot be met for all content. Treat
            it as a goal for primary text, not a blocker for brand colors on large headings.
          </li>
          <li>
            <strong>Don’t forget non-text contrast.</strong> Input borders, focus indicators and icons that convey
            meaning need 3:1 against adjacent colors, even if your text passes.
          </li>
        </ul>

        <h2>Check your colors</h2>
        <p>
          Paste your palette into the{" "}
          <Link href="/" className="text-indigo-700 underline">
            ContrastCheck color contrast checker
          </Link>{" "}
          to see AA and AAA results instantly. If a pair falls short, it suggests the closest lightness adjustment that
          passes.
        </p>
      </article>
    </main>
  );
}
