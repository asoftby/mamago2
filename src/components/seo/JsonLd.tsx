import { cleanJsonLd } from "@/lib/seo/schema/cleanJsonLd";

type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined;
};

export function JsonLd({ data }: JsonLdProps) {
  if (!data) return null;

  const cleaned = cleanJsonLd(data);
  if (!cleaned) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleaned) }}
    />
  );
}
