import { absolutePublicImageUrl, absolutePublicUrl, trimTrailingSlash } from "@/lib/seo/schema/url";

export type OrganizationJsonLdInput = {
  name?: string;
  description?: string | null;
  logoPath?: string | null;
  sameAs?: string[];
  publicBase?: string;
};

export function buildOrganizationJsonLd(input: OrganizationJsonLdInput = {}) {
  const publicBase = trimTrailingSlash(input.publicBase ?? absolutePublicUrl("/") ?? "https://mamago.by");

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${publicBase}/#organization`,
    name: input.name ?? "mamaGo",
    url: publicBase,
    description: input.description ?? "mamaGo — семейный помощник для планирования досуга с детьми.",
    logo: absolutePublicImageUrl(input.logoPath, publicBase),
    sameAs: input.sameAs,
  };
}
