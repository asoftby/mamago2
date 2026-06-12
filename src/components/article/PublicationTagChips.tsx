"use client";

import Link from "next/link";
import { useCity } from "@/contexts/CityContext";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";

type PublicationTagChip = {
  slug: string;
  title: string;
};

export function PublicationTagChips({
  tags,
  citySlug,
  className = "",
}: {
  tags: PublicationTagChip[];
  citySlug?: string | null;
  className?: string;
}) {
  const city = useCity();
  const resolvedCitySlug = citySlug?.trim() || city.citySlug;

  if (tags.length === 0 || !resolvedCitySlug) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {tags.map((tag) => (
        <Link
          key={tag.slug}
          href={buildCityPublicPath({
            citySlug: resolvedCitySlug,
            type: "tag",
            slug: tag.slug,
          })}
          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
        >
          {tag.title}
        </Link>
      ))}
    </div>
  );
}
