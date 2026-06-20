import { absolutePublicUrl } from "@/lib/seo/schema/url";

export type BreadcrumbJsonLdItem = {
  name: string;
  path?: string | null;
  url?: string | null;
};

export function buildBreadcrumbJsonLd(items: BreadcrumbJsonLdItem[], publicBase?: string) {
  const itemListElement = items
    .map((item, index) => {
      const itemUrl = absolutePublicUrl(item.url ?? item.path, publicBase);

      return {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: itemUrl,
      };
    })
    .filter((item) => item.name);

  if (itemListElement.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}
