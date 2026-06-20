import { absolutePublicUrl, trimTrailingSlash } from "@/lib/seo/schema/url";

export type WebSiteJsonLdInput = {
  name?: string;
  alternateName?: string;
  publicBase?: string;
  searchPath?: string | null;
};

export function buildWebSiteJsonLd(input: WebSiteJsonLdInput = {}) {
  const publicBase = trimTrailingSlash(input.publicBase ?? absolutePublicUrl("/") ?? "https://mamago.by");
  const searchUrl = input.searchPath ? absolutePublicUrl(input.searchPath, publicBase) : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${publicBase}/#website`,
    name: input.name ?? "mamaGo",
    alternateName: input.alternateName ?? "mamaGo.by",
    url: publicBase,
    publisher: {
      "@id": `${publicBase}/#organization`,
    },
    potentialAction: searchUrl
      ? {
          "@type": "SearchAction",
          target: `${searchUrl}{search_term_string}`,
          "query-input": "required name=search_term_string",
        }
      : undefined,
  };
}
