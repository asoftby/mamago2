"use client";

import Link from "next/link";
import { useCity } from "@/contexts/CityContext";
import { buildPublicPath } from "@/lib/routing/surface";

export function FooterJournalLink() {
  const { citySlug } = useCity();

  return (
    <Link
      href={buildPublicPath(`/${citySlug}/blog`)}
      className="hover:text-primary transition-colors"
    >
      Журнал
    </Link>
  );
}
