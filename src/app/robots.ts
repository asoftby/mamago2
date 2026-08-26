import type { MetadataRoute } from "next";
import {
  getGlobalNoindexPublicBaseUrl,
  isGlobalNoindexEnabled,
} from "@/lib/seo/globalNoindex";

// Indexing is an explicit runtime release gate. Keep robots.txt dynamic so a
// deployed container can switch SITE_INDEXING_ENABLED without relying on the
// environment that happened to exist during `next build`.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getGlobalNoindexPublicBaseUrl();

  if (isGlobalNoindexEnabled()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
