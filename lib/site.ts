/**
 * Production base URL. Set NEXT_PUBLIC_SITE_URL once a custom domain is bound;
 * on Vercel it falls back to the project's production *.vercel.app host.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://contrastcheck.top")
).replace(/\/$/, "");

export const SITE_NAME = "ContrastCheck";
