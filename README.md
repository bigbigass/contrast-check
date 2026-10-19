# ContrastCheck

Free, browser-only **color contrast checker** for WCAG 2.x AA/AAA (and UI/graphics 3:1). Live preview, shareable `?fg=&bg=` URLs, fully client-side — no uploads, no paid APIs.

| | |
|--|--|
| **Site name** | ContrastCheck |
| **Primary keyword** | color contrast checker |
| **Stack** | Next.js App Router + Tailwind CSS |
| **Status** | MVP implemented (P0 + P1: lightness nudge, presets, `/guide/wcag-aa-vs-aaa/`, Vercel Analytics) |

## Docs in this repo

- [`PROJECT.md`](./PROJECT.md) — full product pick, MVP scope, SEO notes, anti-cannibalization vs aspectratiocalc.top
- [`BUILD.md`](./BUILD.md) — **single prompt** to implement the app (read this to code)

## Layout

```
app/layout.tsx                    # metadata, OG/Twitter, header/footer, Vercel Analytics
app/page.tsx                      # H1, tool, "how it's calculated", FAQ, WebApplication + FAQPage JSON-LD
app/guide/wcag-aa-vs-aaa/page.tsx # long-tail guide (Article JSON-LD)
app/sitemap.ts, app/robots.ts
app/favicon.ico
components/ContrastTool.tsx       # client tool: pickers, badges, preview, swap/copy, ?fg=&bg= sync, nudge, presets
lib/contrast.ts                   # WCAG luminance / ratio / pass-fail / hex helpers / lightness nudge
lib/contrast.test.ts              # Vitest unit tests
lib/site.ts                       # site URL, name, description, FAQ copy
public/og.png, favicon.svg, apple-touch-icon.png
```

## Local run

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests for lib/contrast.ts (Vitest)
npm run build    # production build
```

Share links: `/?fg=1a1a1a&bg=ffffff` (hex without `#`, 3 or 6 digits).

## Deploy (Vercel)

1. Vercel → **Add New → Project** → import `bigbigass/contrast-check` (framework auto-detected: Next.js, no settings needed).
2. Optional env var `NEXT_PUBLIC_SITE_URL` (e.g. `https://contrastcheck.com`) once a custom domain is bound. Without it, canonical/sitemap URLs use Vercel's production `*.vercel.app` host automatically.
3. Enable **Analytics** in the Vercel project to activate Web Analytics (`@vercel/analytics` is already wired in).
4. After a GSC smoke test, bind a custom domain (owner decision — never bought by agents) and submit `/sitemap.xml` in Google Search Console.

## License / monetization

MVP ships with no AdSense. Affiliate / ads are post-traffic decisions for the owner.
