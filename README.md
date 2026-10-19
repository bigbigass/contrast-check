# ContrastCheck

Free, browser-only **color contrast checker** for WCAG 2.x AA/AAA (and UI/graphics 3:1). Live preview, shareable `?fg=&bg=` URLs, fully client-side — no uploads, no paid APIs.

| | |
|--|--|
| **Site name** | ContrastCheck |
| **Primary keyword** | color contrast checker |
| **Stack** | Next.js App Router + Tailwind CSS |
| **Status** | Docs-only scaffold — implement via `BUILD.md` (Claude Code overnight) |

## Docs in this repo

- [`PROJECT.md`](./PROJECT.md) — full product pick, MVP scope, SEO notes, anti-cannibalization vs aspectratiocalc.top
- [`BUILD.md`](./BUILD.md) — **single prompt** to implement the app (read this to code)

## Planned layout (after scaffold)

```
app/layout.tsx
app/page.tsx            # tool + FAQ
app/sitemap.ts
app/robots.ts
lib/contrast.ts         # WCAG luminance / ratio / pass-fail
lib/contrast.test.ts
public/
```

## Local run (after Next.js is scaffolded)

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm test         # unit tests for lib/contrast.ts
```

## Deploy

Import this GitHub repo into **Vercel** (Hobby). Bind a custom domain later after GSC smoke test — do not buy a domain from CI or agents without explicit owner approval.

## License / monetization

MVP ships with no AdSense. Affiliate / ads are post-traffic decisions for the owner.
