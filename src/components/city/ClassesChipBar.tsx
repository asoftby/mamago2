"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";

type ClassesChipBarProps = {
  chips: Array<{
    id: string;
    title: string;
    slug: string;
  }>;
  activeChipSlug: string;
};

export function ClassesChipBar({
  chips,
  activeChipSlug,
}: ClassesChipBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const items = useMemo<ChipItem[]>(
    () =>
      chips.map((chip) => ({
        id: chip.id,
        label: chip.title,
        active: chip.slug === activeChipSlug,
        onClick: () => {
          const params = new URLSearchParams(searchParams.toString());
          if (chip.slug === "all") params.delete("chip");
          else params.set("chip", chip.slug);
          const next = params.toString();
          router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
        },
        className:
          chip.slug === activeChipSlug
            ? "border-[#EF8759] bg-[#EF8759] text-white"
            : "border-[#E7DED9] bg-[#FFF8F4] text-neutral-800 hover:border-border-brand-soft hover:bg-brand-soft",
      })),
    [activeChipSlug, chips, pathname, router, searchParams],
  );

  return <ChipsRow items={items} layout="scroll" aria-label="Категории занятий" />;
}
