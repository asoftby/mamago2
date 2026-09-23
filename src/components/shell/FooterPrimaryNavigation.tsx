"use client";

import Link from "next/link";
import { useCity } from "@/contexts/CityContext";
import {
  PRIMARY_NAVIGATION_ITEMS,
  type PrimaryNavigationItem,
} from "@/lib/discovery/discoveryIntentConfig";
import { buildPublicPath } from "@/lib/routing/surface";

export const FOOTER_META_TEXT_CLASS = "text-sm text-muted-foreground";

export function FooterPrimaryNavigationList({
  items,
  citySlug,
}: {
  items: PrimaryNavigationItem[];
  citySlug: string;
}) {
  return (
    <nav aria-label="Разделы" className={FOOTER_META_TEXT_CLASS}>
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 min-[769px]:flex-nowrap">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={index > 0 ? "flex items-center border-l border-muted-foreground/60 pl-3" : "flex items-center"}
          >
            <Link
              href={buildPublicPath(item.href(citySlug))}
              scroll
              onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "auto" })}
              className="whitespace-nowrap lowercase transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function FooterPrimaryNavigation() {
  const { citySlug } = useCity();
  const availableItems = PRIMARY_NAVIGATION_ITEMS.filter(
    (item) => item.navigationEnabled && !item.comingSoon,
  );

  return <FooterPrimaryNavigationList items={availableItems} citySlug={citySlug} />;
}
