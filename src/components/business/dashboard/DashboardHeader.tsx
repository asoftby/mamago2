"use client";

import Link from "next/link";
import type { DashboardPeriod } from "@/server/services/business/businessWorkspace.service";

export interface DashboardHeaderProps {
  businessName: string;
  legalName?: string | null;
  city?: string | null;
  settingsHref: string;
  // kept for API compatibility — no longer used internally
  period?: DashboardPeriod;
  onPeriodChange?: (p: DashboardPeriod) => void;
  onCustomRange?: (from: Date, to: Date) => void;
}

export function DashboardHeader({
  businessName,
  legalName,
  city,
  settingsHref,
}: DashboardHeaderProps) {
  const identity = legalName ?? businessName;
  const subtitle = city ? `${identity} · ${city}` : identity;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-stone-950 md:text-[1.75rem]">
        Панель управления
      </h1>
      <Link
        href={settingsHref}
        className="mt-0.5 inline-block text-sm text-stone-400 transition hover:text-stone-600"
        title="Настройки бизнеса"
      >
        {subtitle}
      </Link>
    </div>
  );
}
