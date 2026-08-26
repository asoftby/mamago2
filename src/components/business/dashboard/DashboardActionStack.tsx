"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { CreatePublicationQuickMenu } from "@/components/shared/CreatePublicationQuickMenu";
import { cn } from "@/lib/utils";
import { BUSINESS_DASHBOARD_MVP } from "@/config/businessDashboardMvp";

interface DashboardActionStackProps {
  promotionHref: string;
  hasPublications: boolean;
}

export function DashboardActionStack({
  promotionHref,
  hasPublications,
}: DashboardActionStackProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Primary: Create publication — reuses header + flow */}
      <CreatePublicationQuickMenu
        publicationMode="business"
        trigger={(onClick) => (
          <button
            type="button"
            onClick={onClick}
            className="w-full rounded-2xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 active:scale-[0.98]"
          >
            Создать публикацию
          </button>
        )}
      />

      {/* Secondary: Promote */}
      {BUSINESS_DASHBOARD_MVP.businessPaidPromotionUiEnabled && (hasPublications ? (
        <Link
          href={promotionHref}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 hover:border-stone-300 active:scale-[0.98]"
        >
          <Zap className="h-4 w-4 text-amber-500" />
          История Promotion
        </Link>
      ) : (
        <div className="group relative">
          <button
            type="button"
            disabled
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-5 py-3 text-sm font-semibold text-stone-400"
          >
            <Zap className="h-4 w-4 text-stone-300" />
            Boost после публикации Offer
          </button>
          <div
            className={cn(
              "pointer-events-none absolute bottom-full left-1/2 mb-2 w-56 -translate-x-1/2 rounded-xl",
              "border border-stone-200 bg-white px-3 py-2.5 text-xs text-stone-500 shadow-lg",
              "opacity-0 transition-opacity group-hover:opacity-100",
            )}
          >
            First PROD: платный Boost доступен только для опубликованных Offers
          </div>
        </div>
      ))}
    </div>
  );
}
