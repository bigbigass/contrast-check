import ContrastTool from "@/components/ContrastTool";
import JsonLd from "@/components/JsonLd";
import Link from "next/link";
import { FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const webAppLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: SITE_DESCRIPTION,
  applicationCategory: "DesignApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript",
  inLanguage: "en",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "WCAG 2.2 contrast ratio",
    "AA and AAA pass/fail for normal and large text",
    "UI components and graphics 3:1 check",
    "Live preview",
    "Shareable URL",
    "Closest passing color suggestion",
  ],
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd data={webAppLd} />
      <JsonLd data={faqLd} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Color Contrast Checker</h1>
        <p className="mt-2 max-w-3xl text-slate-700">
          Check any text and background color pair against WCAG 2.2 AA and AAA. Get the exact contrast ratio,
          pass/fail for normal text, large text and UI components, and a shareable link. Free and private: everything
          runs in your browser.
        </p>
      </div>

      <ContrastTool />

      <section id="how-it-works" className="mt-12 max-w-3xl scroll-mt-6">
        <h2 className="text-2xl font-bold">How the contrast ratio is calculated</h2>
        <div className="mt-3 space-y-3 text-slate-800">
          <p>
            WCAG defines contrast using <strong>relative luminance</strong>, how bright a color appears to the human
            eye on a scale from 0 (black) to 1 (white). For each color, ContrastCheck:
          </p>
          <ol className="list-decimal space-y-1 pl-6">
            <li>Splits the hex value into red, green and blue channels and divides each by 255.</li>
            <li>
              Linearizes each channel: values ≤ 0.04045 are divided by 12.92; otherwise{" "}
              <code className="rounded bg-slate-100 px-1">((c + 0.055) / 1.055)^2.4</code>.
            </li>
            <li>
              Weights them by how sensitive our eyes are to each:{" "}
              <code className="rounded bg-slate-100 px-1">L = 0.2126·R + 0.7152·G + 0.0722·B</code>.
            </li>
          </ol>
          <p>
            The contrast ratio is then{" "}
            <code className="rounded bg-slate-100 px-1">(L_lighter + 0.05) / (L_darker + 0.05)</code>, which ranges from
            1:1 for identical colors to 21:1 for black on white. The result is compared to the thresholds without
            rounding: 4.5:1 (AA) and 7:1 (AAA) for normal text, 3:1 (AA) and 4.5:1 (AAA) for large text, and 3:1 for
            UI components and graphics.
          </p>
          <p>
            Not sure which level to target? Read{" "}
            <Link href="/guide/wcag-aa-vs-aaa/" className="text-indigo-700 underline">
              WCAG AA vs AAA contrast: which should you use?
            </Link>
          </p>
        </div>
      </section>

      <section id="faq" className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold">Color contrast checker FAQ</h2>
        <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {FAQ.map(({ q, a }) => (
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
