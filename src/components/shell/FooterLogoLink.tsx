"use client";

import Image from "next/image";
import Link from "next/link";
import { useCity } from "@/contexts/CityContext";
import { getCityHomeHref } from "@/lib/header/getCityHomeHref";
import { buildPublicPath } from "@/lib/routing/surface";

/** Логотип футера: ведёт на главную активного города. */
export function FooterLogoLink() {
  const { citySlug } = useCity();

  return (
    <Link
      href={buildPublicPath(getCityHomeHref(citySlug))}
      aria-label="mamaGo — на главную"
      className="shrink-0 min-[769px]:justify-self-start"
    >
      <Image
        src="/logomamago.webp"
        alt="mamaGo"
        width={176}
        height={44}
        className="h-[1.925rem] w-auto"
        priority={false}
      />
    </Link>
  );
}
