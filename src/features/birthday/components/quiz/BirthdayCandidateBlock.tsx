"use client";

import type { BirthdayCandidateGroup } from "../../types/birthday";
import { BirthdayOfferCard } from "../cards/BirthdayOfferCard";
import { Sparkles } from "lucide-react";

interface BirthdayCandidateBlockProps {
  groups: BirthdayCandidateGroup[];
  totalCount: number;
}

export function BirthdayCandidateBlock({ groups, totalCount }: BirthdayCandidateBlockProps) {
  if (groups.length === 0) return null;

  return (
    <div className="rounded-2xl bg-orange-50/60 border border-orange-100 p-4 space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#EF8759]" />
        <span className="text-sm font-semibold text-foreground">
          Вот что подходит прямо сейчас
        </span>
        <span className="ml-auto text-xs text-muted-foreground bg-white rounded-full px-2.5 py-0.5 border border-border">
          {totalCount} предложений
        </span>
      </div>

      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            {group.label}
          </h4>
          <div className="space-y-2">
            {group.offers.map((offer) => (
              <BirthdayOfferCard key={offer.id} offer={offer} compact />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
