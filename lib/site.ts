/**
 * Production base URL. Set NEXT_PUBLIC_SITE_URL once a custom domain is bound;
 * on Vercel it falls back to the project's production *.vercel.app host.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://contrast-check.vercel.app")
).replace(/\/$/, "");

export const SITE_NAME = "ContrastCheck";

export const SITE_DESCRIPTION =
  "Free color contrast checker for WCAG 2.2 AA and AAA. Enter two hex colors to get the contrast ratio, pass/fail for normal text, large text and UI components, plus a live preview and shareable link. Runs entirely in your browser.";

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What is a good color contrast ratio?",
    a: "WCAG 2.2 Level AA requires at least 4.5:1 for normal body text and 3:1 for large text. Level AAA raises that to 7:1 for normal text and 4.5:1 for large text. Ratios range from 1:1 (identical colors) to 21:1 (black on white).",
  },
  {
    q: "What counts as large text in WCAG?",
    a: "Large text is at least 18 point (about 24 CSS px) at regular weight, or at least 14 point (about 18.66 CSS px) when bold. Large text has lower contrast thresholds because bigger glyphs are easier to read.",
  },
  {
    q: "What is the 3:1 UI component and graphics requirement?",
    a: "WCAG success criterion 1.4.11 Non-text Contrast requires a 3:1 ratio for the visual boundaries of interactive controls (input borders, focus rings, toggle states) and for graphical objects such as icons and chart lines needed to understand content.",
  },
  {
    q: "Does the order of foreground and background matter?",
    a: "No. The WCAG formula always divides the lighter color's luminance by the darker one's, so swapping foreground and background gives the same ratio. The preview changes, but the numbers and pass/fail results do not.",
  },
  {
    q: "Is my data uploaded anywhere?",
    a: "No. This color contrast checker runs entirely in your browser. The only place your colors are stored is the page URL (?fg=…&bg=…), which lets you bookmark or share a specific pair.",
  },
  {
    q: "Why does 4.49:1 fail when it is so close to 4.5:1?",
    a: "WCAG thresholds are hard minimums and are not rounded. ContrastCheck compares the exact ratio and truncates the displayed value, so a pair that shows 4.49:1 fails AA for normal text. Use the suggested color to nudge it over the line.",
  },
  {
    q: "Does this checker support APCA or WCAG 3?",
    a: "Not yet. ContrastCheck uses the WCAG 2.x contrast ratio, which is what current laws and procurement standards (ADA guidance, Section 508, EN 301 549 / European Accessibility Act) reference today.",
  },
];
