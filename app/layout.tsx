import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `Color Contrast Checker (WCAG AA & AAA) — ${SITE_NAME}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/",
    title: "Color Contrast Checker (WCAG AA & AAA)",
    description: SITE_DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ContrastCheck — color contrast checker" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Color Contrast Checker (WCAG AA & AAA)",
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span aria-hidden className="inline-flex h-6 w-6 overflow-hidden rounded-full border border-slate-900">
                <span className="w-1/2 bg-slate-900" />
                <span className="w-1/2 bg-white" />
              </span>
              {SITE_NAME}
            </Link>
            <Link href="/guide/wcag-aa-vs-aaa/" className="text-sm text-slate-700 underline-offset-4 hover:underline">
              WCAG AA vs AAA
            </Link>
          </nav>
        </header>
        {children}
        <footer className="mt-16 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-600">
            <p>
              © {new Date().getFullYear()} {SITE_NAME}. Free, browser-only color contrast checker. Results follow
              WCAG 2.2 contrast formulas; always verify with real users and assistive technology.
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
