import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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

const nextConfig: NextConfig = {
  /* config options here */
  // В dev React Compiler сильно раздувает время компиляции страниц (десятки секунд TTFB).
  // В production оставляем включённым.
  reactCompiler: process.env.NODE_ENV === "production",

  // Standalone output для Docker-сборки
  output: "standalone",

  async redirects() {
    return [
      { source: "/birthday/builder", destination: "/minsk/birthday/make", permanent: true },
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

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});
