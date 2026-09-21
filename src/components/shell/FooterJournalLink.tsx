"use client";

import Link from "next/link";
import { useCity } from "@/contexts/CityContext";
import { buildPublicPath } from "@/lib/routing/surface";

export function FooterJournalLink() {
  const { citySlug } = useCity();

  return (
    <Link
      href={buildPublicPath(`/${citySlug}/blog`)}
      scroll
      onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "auto" })}
      className="hover:text-primary transition-colors"
    >
      Журнал
    </Link>
  );
}
