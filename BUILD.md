# BUILD.md — Claude Code prompt for ContrastCheck

Use this file as the **single implementation prompt**. Read `PROJECT.md` for full product context, then implement the MVP below. Do **not** invent features outside this scope. Do **not** buy domains, deploy, or add paid APIs.

---

## Goal

Ship an overnight MVP of **ContrastCheck**: a free, English-only, browser-only **color contrast checker** (primary keyword) that computes WCAG 2.x contrast ratios client-side and is ready for Vercel + SEO.

Site name: **ContrastCheck**  
Primary keyword: **color contrast checker**  
Stack: **Next.js App Router + Tailwind CSS**  
Logic: pure TypeScript in `lib/contrast.ts` (unit-testable)

---

## Hard constraints

1. **Client-side only** — no server image processing, no paid APIs, no accounts, no database.
2. **Do not** run or assume a custom domain purchase; ship for `*.vercel.app` first.
3. **Do not** add aspect-ratio / platform-size widgets (anti-cannibalization vs aspectratiocalc.top).
4. **English UI only** for MVP.
5. Keep secrets out of the repo. No AdSense code yet (placeholders OK).

---

## Scaffold

From the repo root (`contrast-check/`), create a Next.js App Router + Tailwind app (TypeScript, `app/` directory). Suggested layout:

```
app/layout.tsx          # metadata, fonts, site chrome
app/page.tsx            # tool + FAQ
app/sitemap.ts
app/robots.ts
lib/contrast.ts         # WCAG math
lib/contrast.test.ts    # unit tests
public/                 # favicon + OG placeholder
```

Optional if time: `app/guide/wcag-aa-vs-aaa/page.tsx`.

---

## Implement `lib/contrast.ts`

Export pure functions for:

- Relative luminance (sRGB, WCAG)
- Contrast ratio between two colors
- Pass/fail for: **AA / AAA** × **normal text / large text**, plus **UI/graphics 3:1** (SC 1.4.11)
- Hex parsing / normalization helpers as needed

### Known test cases (must pass)

| Pair | Expected |
|------|----------|
| Black `#000000` on white `#ffffff` (or fg/bg swapped) | Ratio ≈ **21:1**; AA + AAA pass for normal & large text; UI/graphics pass |
| White on black | Same ≈ **21:1** |
| `#777777` on `#ffffff` | Fails AAA for normal text (document exact ratio in tests; assert AAA normal = fail) |
| Identical colors (e.g. `#ffffff` / `#ffffff`) | Ratio = **1:1**; all text/UI checks fail |

Add **≥5** unit tests covering the above family of cases. Prefer Vitest or Jest — whichever `create-next-app` / project setup makes natural. Put tests next to the module or under a conventional `__tests__` path; keep the math in `lib/contrast.ts`.

---

## UI (home page `/`)

English UI. Site title / brand: **ContrastCheck**.

**P0 must-haves:**

1. Foreground + background color inputs: hex text fields + native `<input type="color">`
2. Live **contrast ratio** display
3. Pass/fail badges: AA / AAA × normal text / large text, plus UI/graphics 3:1
4. Live preview panel (sample body text, large heading, button / icon stub)
5. Swap colors; copy ratio; copy hexes
6. Shareable URL query: `/?fg=1a1a1a&bg=ffffff` — round-trip on load (read query → set colors; changing colors updates the URL)
7. Short “How the ratio is calculated” explainer
8. FAQ section on the page

Default colors: sensible high-contrast pair (e.g. dark text on white).

---

## SEO shell

- **H1** includes primary keyword: color contrast checker
- Unique `<title>` and meta description
- Canonical URL (use a placeholder production host or env-friendly base if needed)
- Open Graph tags + OG image placeholder under `public/`
- `FAQPage` + `WebApplication` JSON-LD
- `app/sitemap.ts` + `app/robots.ts`
- Favicon

---

## Nice-to-have (P1, same night if time)

- Suggest nearest AA-passing lightness nudge (simple L-channel step)
- Preset pairs (e.g. slate-900/white, indigo brand pair)
- One long-tail guide page: `/guide/wcag-aa-vs-aaa/`
- Vercel Analytics (free)

**Out of MVP:** i18n, APCA-as-primary, axe crawler suite, accounts, AdSense live code.

---

## Definition of done

1. `npm run build` succeeds with zero errors
2. Known pairs behave correctly (black/white ≈ 21:1; `#777` on `#fff` fails AAA normal)
3. Share URL round-trips colors after reload
4. SEO basics present: title, description, H1, FAQ JSON-LD, sitemap + robots
5. Unit tests for `lib/contrast.ts` (≥5 cases) pass
6. README documents local run (`npm i` / `npm run dev` / `npm run build`) and Vercel import notes
7. No secrets, no paid APIs

When finished, leave the working tree ready for the owner to push/deploy — do not spend money or claim a custom domain.
