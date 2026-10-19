import type { NextConfig } from "next";
import { DEFAULT_LOCALE, PAGES, localePath } from "./lib/i18n/config";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async redirects() {
    // /en/... duplicates the root English pages; send it to the canonical URL.
    return [
      { source: `/${DEFAULT_LOCALE}`, destination: "/", permanent: true },
      { source: `/${DEFAULT_LOCALE}/:path+`, destination: "/:path+/", permanent: true },
    ];
  },
  async rewrites() {
    // English lives at the root: serve app/[locale] with locale=en without changing the URL.
    return {
      beforeFiles: PAGES.map((path) => ({
        source: path,
        destination: `/${DEFAULT_LOCALE}${localePath(DEFAULT_LOCALE, path)}`,
      })),
    };
  },
};

export default nextConfig;
