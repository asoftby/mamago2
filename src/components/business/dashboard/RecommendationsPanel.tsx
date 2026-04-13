import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";

export function RecommendationsPanel({
  items,
  primaryHref,
}: {
  items: string[];
  primaryHref: string;
}) {
  return (
    <BusinessSurfaceCard tone="warm" className="p-6 md:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Next actions
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
            Что сделать дальше
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600">
            Без искусственного “AI”. Только понятные рекомендации из текущего состояния кабинета.
          </p>
        </div>
        <Link
          href={primaryHref}
          className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900"
        >
          Открыть раздел
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 grid gap-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-[22px] border border-amber-200/70 bg-white/90 px-4 py-4 text-sm leading-7 text-stone-700"
          >
            {item}
          </div>
        ))}
      </div>
    </BusinessSurfaceCard>
  );
}
