import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // В dev React Compiler сильно раздувает время компиляции страниц (десятки секунд TTFB).
  // В production оставляем включённым.
  reactCompiler: process.env.NODE_ENV === "production",

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
    ],
  },

  experimental: {
    // Set body size limit for API routes (10MB for image uploads)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  /** Доступ к dev с другого устройства в LAN (через IP), иначе /_next/* может не грузиться */
  ...(process.env.NEXT_DEV_ALLOWED_ORIGINS?.trim()
    ? {
        allowedDevOrigins: process.env.NEXT_DEV_ALLOWED_ORIGINS.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }
    : {}),
};

export default nextConfig;
