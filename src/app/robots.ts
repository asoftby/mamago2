import type { MetadataRoute } from "next";
import {
  getGlobalNoindexPublicBaseUrl,
  isGlobalNoindexEnabled,
} from "@/lib/seo/globalNoindex";

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
