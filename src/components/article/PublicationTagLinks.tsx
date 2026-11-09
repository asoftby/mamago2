"use client";

import Link from "next/link";
import { useCity } from "@/contexts/CityContext";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";

type PublicationTag = {
  slug: string;
  title: string;
};

/** Editorial topic links: text hashtags, not category chips or filters. */
export function PublicationTagLinks({
  tags,
  citySlug,
  className = "",
}: {
  tags: PublicationTag[];
  citySlug?: string | null;
  className?: string;
}) {
  const city = useCity();
  const resolvedCitySlug = citySlug?.trim() || city.citySlug;
  const visibleTags = tags.filter((tag) => tag.slug.trim() && tag.title.trim());

  if (visibleTags.length === 0 || !resolvedCitySlug) return null;

  return (
    <nav aria-label="Темы публикации" className={`flex flex-wrap gap-x-4 gap-y-2 ${className}`.trim()}>
      {visibleTags.map((tag) => (
        <Link
          key={tag.slug}
          href={buildCityPublicPath({
            citySlug: resolvedCitySlug,
            type: "tag",
            slug: tag.slug,
          })}
          className="text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground hover:underline hover:underline-offset-4 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          #{tag.title.trim().replace(/^#+\s*/, "")}
        </Link>
      ))}
    </nav>
  );
}
