"use client";

import { useCity } from "@/contexts/CityContext";
import { BreakingNewsStrip, type BreakingNewsItem } from "./BreakingNewsStrip";

type CityHomeBreakingNewsProps = {
  items: BreakingNewsItem[];
  className?: string;
};

export function CityHomeBreakingNews({ items, className }: CityHomeBreakingNewsProps) {
  const { appendCityQuery } = useCity();
  return (
    <BreakingNewsStrip
      items={items}
      allNewsHref={appendCityQuery("/blog")}
      className={className}
    />
  );
}
