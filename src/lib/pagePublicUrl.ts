import { absolutePublicUrl, normalizePath } from "@/lib/seo/schema/url";
import type { PageType } from "@prisma/client";

export function getPagePublicPath(page: {
  type: PageType;
  slug: string;
}): string {
  const slug = encodeURIComponent(page.slug.trim());
  const path = page.type === "LEGAL" ? `/legal/${slug}` : `/page/${slug}`;
  return normalizePath(path);
}

export function getPagePublicUrl(page: {
  type: PageType;
  slug: string;
}): string {
  return absolutePublicUrl(getPagePublicPath(page))!;
}
