import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { join } from "node:path";
import {
  deriveAllowedSectionsFromAppDir,
  loadRedirectManifest,
} from "./src/lib/seo/redirectManifest";

const defaultDevOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://mamago.local:3000",
  "http://admin.mamago.local:3000",
  "http://business.mamago.local:3000",
  "http://192.168.0.106:3000",
  "localhost:3000",
  "127.0.0.1:3000",
  "mamago.local:3000",
  "admin.mamago.local:3000",
  "business.mamago.local:3000",
  "192.168.0.106:3000",
  "192.168.0.106",
  "mamago.local",
  "admin.mamago.local",
  "business.mamago.local",
];

const envDevOrigins = (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedDevOrigins = Array.from(
  new Set([...defaultDevOrigins, ...envDevOrigins]),
);

/**
 * SEO migration redirects: manifest.csv (wp_journal + slug_history rows) →
 * Next.js redirect rules. Parsing and validation live in
 * src/lib/seo/redirectManifest.ts.
 *
 * Fail-loud: REQUIRE_REDIRECT_MANIFEST=1 (set in the production Docker build)
 * aborts the build when the manifest is missing, has fewer redirect rows than
 * REDIRECT_MANIFEST_MIN_ROWS (default 900), or fails validation (duplicate
 * sources, cycles, destinations off the new URL scheme). Without the flag
 * (local dev) problems are logged and invalid rows are dropped.
 */
function loadManifestRedirects(): Array<{ source: string; destination: string; permanent: boolean }> {
  const { rules, totalRedirectRows } = loadRedirectManifest({
    manifestPath: join(process.cwd(), "manifest.csv"),
    require: process.env.REQUIRE_REDIRECT_MANIFEST === "1",
    minRows: Number(process.env.REDIRECT_MANIFEST_MIN_ROWS ?? "900"),
    allowedSections: deriveAllowedSectionsFromAppDir(join(process.cwd(), "src", "app")),
  });

  console.info(
    `[redirect-manifest] Loaded ${rules.length} redirect rules ` +
      `(${totalRedirectRows} redirect rows in manifest.csv)`,
  );

  return rules;
}

const nextConfig: NextConfig = {
  /* config options here */
  // No-trailing-slash policy: canonical URLs never end with `/`.
  // Incoming requests with a trailing slash are redirected (301) by middleware.
  trailingSlash: false,

  // В dev React Compiler сильно раздувает время компиляции страниц (десятки секунд TTFB).
  // В production оставляем включённым.
  reactCompiler: process.env.NODE_ENV === "production",

  // Standalone output для Docker-сборки
  output: "standalone",

  async redirects() {
    const manifestRedirects = loadManifestRedirects();
    // permanent: true → Next.js responds with 308 (not 301). Deliberate:
    // Google treats 308 as a permanent redirect, click equity transfers.
    return [
      // Static legacy redirects (pre-mamaGo 2.0 paths)
      { source: "/birthday", destination: "/minsk/birthday/make", permanent: true },
      { source: "/birthday/builder", destination: "/minsk/birthday/make", permanent: true },
      // SEO migration: wp_journal + slug_history from manifest.csv
      // Regenerate: pnpm build-migration-manifest → pnpm build
      ...manifestRedirects,
    ];
  },

  // Exclude sharp from client bundle (server-only image processing)
  serverExternalPackages: ['sharp'],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "family.by",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
    ],
  },

  experimental: {
    // Set body size limit for API routes (10MB for image uploads)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  /** Доступ к dev с localhost / кастомного local-domain / LAN без поломанной загрузки `/_next/*`. */
  allowedDevOrigins,
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "mamago",
  project: "mamago2",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for better stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and error reports
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your Sentry bill.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Skip sourcemap upload when no auth token is present (e.g. Docker CI builds)
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});
