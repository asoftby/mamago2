"use client";

import { useEffect, useState } from "react";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";

type DiscoveryClassChip = {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  isDefault: boolean;
};

interface OfferClassChipPickerProps {
  value: string[];
  onChange: (slugs: string[]) => void;
  disabled?: boolean;
}

export function OfferClassChipPicker({
  value,
  onChange,
  disabled = false,
}: OfferClassChipPickerProps) {
  const [chips, setChips] = useState<DiscoveryClassChip[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/discovery/class-chips")
      .then((response) => response.json())
      .then((data: DiscoveryClassChip[]) => {
        if (!cancelled) setChips(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setChips([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items: ChipItem[] = chips
    .filter((chip) => chip.slug !== "all")
    .map((chip) => {
      const active = value.includes(chip.slug);
      return {
        id: chip.id,
        label: chip.title,
        active,
        disabled,
        onClick: () => {
          if (disabled) return;
          onChange(
            active
              ? value.filter((slug) => slug !== chip.slug)
              : [...value, chip.slug],
          );
        },
      };
    });

  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">Чипы занятий появятся после настройки Discovery.</div>;
  }

  return <ChipsRow items={items} layout="wrap" aria-label="Чипы занятий" />;
}
