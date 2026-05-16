import type { NextConfig } from "next";

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

export default nextConfig;
