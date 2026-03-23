import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

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
};

export default nextConfig;
