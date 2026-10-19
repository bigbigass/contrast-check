# AI 出海建站 · Project Pick #2 (overnight MVP)

Date: 2026-10-20 (Asia/Shanghai UTC+8)  
Existing property: **aspectratiocalc.top** (do not cannibalize)  
Proposal file: `/workspace/haiwai-project-pick.md`  
Status: **proposal only** — no deploy, no domain purchase, no spend.

---

## 0. What aspectratiocalc.top already is (from local files only)

| Item | Detail |
|------|--------|
| **Niche** | Free **aspect ratio calculator** for designers / video / photo / display sizes |
| **Primary keyword** | `aspect ratio calculator` (+ long-tails: from image, diagonal/screen size, Instagram Reels sizes, etc.) |
| **Domain** | `aspectratiocalc.top` (NameSilo, expires ~2027-10-18); Vercel fallback `aspect-ratio-calculator-mu.vercel.app` |
| **Tech stack** | **Vite** multi-page static site (plain HTML/CSS/JS). No backend, no DB, no paid APIs. Client-side only (GCD math, local image read, diagonal → size). |
| **Deploy / ops** | Vercel + Web Analytics; daily stats/report scripts under `/home/box/scripts/arc_daily_*.sh` |
| **i18n / SEO** | 9 locales (en, zh, zh-tw, es, fr, de, ja, pt, ko); hreflang; FAQPage + WebApplication JSON-LD; OG; sitemap/robots; programmatic landings `/ratio/<w>x<h>/` and `/size/<platform>/` (~387 URLs) |
| **Code locations** | Production-shaped copy: `/workspace/arc/`; earlier overnight build notes: `/workspace/overseas-site/` (+ `REPORT.md`) |
| **Not overlapping tonight** | Any more “width×height / ratio / crop / platform size” tools |

Playbook already proven here: single-purpose free tool → SEO landing + FAQ + structured data → Vercel → GSC → later AdSense. Tonight’s pick should reuse that playbook on **Next.js App Router** and a **different SERP**.

---

## 1. Pick (ONE project)

| Field | Value |
|-------|--------|
| **Project name** | **ContrastCheck** (working title) |
| **Primary keyword** | **color contrast checker** |
| **Secondary / long-tail** | `wcag contrast checker`, `contrast ratio calculator`, `aa aaa contrast checker`, `text background contrast checker`, `wcag 2.2 contrast ratio` |
| **One-liner** | Free browser-only WCAG 2.2 AA/AAA color contrast checker with live preview and shareable hex URLs — no upload, no API. |

### Why this (not the others)

| Candidate | Verdict |
|-----------|---------|
| **color contrast checker** ✅ | Proven mid-tail utility; pure math (relative luminance); overnight-shippable; a11y demand growing (WCAG / ADA / EAA); audience adjacent to design but **different keyword cluster** from aspect ratio; AdSense + later affiliate (a11y courses, axe/WAVE-style tools) |
| utm link builder | Real demand, but Google Campaign URL Builder + Buffer + many free clones dominate the head term; harder to differentiate overnight |
| favicon generator | Crowded with polished client-side ZIP tools; ICO packing adds overnight risk |
| png → webp converter | Strong intent, but still “image file” adjacency to ARC; slightly muddies portfolio story |
| regex tester / json formatter | Extremely crowded authority SERPs; low AdSense yield (dev adblock) |
| timezone meeting planner | Good niche, heavier MVP (DST/zone lists/UI) |
| tip calculator / loom downloader | Crowded or gray-area — skipped |

Light web check (2026-10-20): SERP has WebAIM (authority), Figma free tool, plus many small single-purpose sites — same “calculatorsoup + lots of CMDs” shape that ARC already beat. No need for paid keyword tools tonight; treat volumes as unknown and win on UX + long-tail pages.

---

## 2. MVP feature list (tonight / overnight)

**Must ship (P0)**

1. Foreground + background color inputs (hex + native `<input type="color">`)
2. Live **contrast ratio** (WCAG relative luminance formula)
3. Pass/fail badges: **AA / AAA** × **normal text / large text**, plus **UI/graphics 3:1** (SC 1.4.11)
4. Live preview panel (sample body text, large heading, button / icon stub)
5. Swap colors + copy ratio / copy hexes
6. Shareable URL `/?fg=1a1a1a&bg=ffffff` (like ARC’s `/?w=&h=`)
7. SEO shell: H1 = primary keyword, meta description, FAQ section, `FAQPage` + `WebApplication` JSON-LD, canonical, OG image placeholder, `sitemap.xml` + `robots.txt`, favicon
8. Short “How the ratio is calculated” explainer (trust + long-tail keywords)
9. Fully client-side — **zero paid APIs**, no server image processing

**Nice if time (P1, still same night)**

- Suggest nearest AA-passing lightness nudge (simple L channel step)
- Preset pairs (common UI: slate-900/white, brand indigo, etc.)
- One English-only long-tail landing: `/guide/wcag-aa-vs-aaa/` (static MDX or page.tsx)
- Vercel Analytics (free)

**Explicitly out of MVP**

- Paid AI, accounts, DB, multi-language (add later like ARC)
- Full site crawler / axe-core audit suite
- APCA-only mode as primary (can mention later; keep WCAG 2.x as headline)

---

## 3. Stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js (App Router)** |
| UI | **Tailwind CSS** |
| Deploy | **Vercel** (Hobby) |
| Logic | Pure TS module `lib/contrast.ts` (unit-testable luminance / ratio / pass-fail) |
| Optional AI | None for MVP; later optional “explain this failure in plain English” behind free tier only if desired |
| Analytics | Vercel Web Analytics (same ops habit as ARC) |
| Monetization later | Google AdSense; affiliate blocks for a11y tools / courses (footer, not blocking the tool) |

Scaffold sketch (not created tonight unless asked):

```
contrast-check/
  app/layout.tsx          # metadata, fonts
  app/page.tsx            # tool + FAQ
  app/guide/...           # optional SEO page
  lib/contrast.ts         # WCAG math
  public/og.png
  app/sitemap.ts
  app/robots.ts
```

---

## 4. Domain naming ideas

Prefer brandable short names; check availability before buying (do **not** buy tonight).

| Idea | Notes |
|------|--------|
| `contrastcheck.com` | Clean primary-keyword-ish |
| `wcagcontrast.com` | Keyword-forward |
| `contrastok.com` | Short brand |
| `checkcontrast.app` | .app — tool-y |
| `contrast.tools` | .tools — category feel |
| `aacontrast.com` | AA-focused long-tail brand |
| `ratiocontrast.com` | Avoid — too close to “ratio” / ARC confusion |
| `colorcontrast.top` | Cheap .top like ARC; weaker trust for AdSense sometimes |

Recommendation order to check: **contrastcheck.com** → **checkcontrast.app** → **wcagcontrast.com** → **contrast.tools**.  
Ship first on `*.vercel.app`; bind custom domain after GSC smoke test.

---

## 5. Success criteria for tonight

Ship is “done” when **all** of the following are true locally (deploy optional / owner-gated):

1. `npx create-next-app` project builds with `npm run build` (zero errors)
2. Tool correctly reports known pairs, e.g. black/white ≈ **21:1** (AA+AAA pass); `#777` on `#fff` fails AAA normal
3. Share URL round-trips colors after reload
4. Lighthouse-ish basics present: unique title/description, H1, FAQ JSON-LD, sitemap/robots routes
5. README with: local run, Vercel import, domain + GSC steps (mirror ARC README style)
6. No secrets, no paid APIs, no AdSense code yet (placeholders OK)
7. Proposal + build notes committed only if owner asks; **no production deploy / no domain spend without explicit approval**

Stretch: one unit test file for `lib/contrast.ts` (≥5 cases).

---

## 6. Differentiation vs ARC (anti-cannibalization)

| | aspectratiocalc.top | ContrastCheck |
|--|---------------------|---------------|
| Job-to-be-done | Size → ratio / resize | Color pair → WCAG pass/fail |
| Audience overlap | Designers/video | Designers/devs/a11y — partial, different intent |
| SERP | aspect ratio* | contrast / WCAG* |
| Stack tonight | Vite static (already live) | Next.js App Router (new) |

Do **not** add “platform image size” or “aspect ratio” widgets to ContrastCheck.

---

## 7. Next actions (when owner says go)

1. Scaffold Next.js + Tailwind under e.g. `/workspace/contrast-check/`
2. Implement `lib/contrast.ts` + UI on `/`
3. SEO shell + FAQ + share links
4. `npm run build` green → push GitHub → Vercel (owner login)
5. Domain check/buy + GSC (owner) → AdSense after traffic

