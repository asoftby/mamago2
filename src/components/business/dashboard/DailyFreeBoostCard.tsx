"use client";

import { Eye, Heart, MousePointerClick, Zap } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { BoostLauncher } from "@/components/business/promotion/BoostLauncher";
import type { DashboardData } from "./DashboardClient";

type Props = {
  data: DashboardData["dailyFreeBoost"];
  initialTarget?: string;
};

export function DailyFreeBoostCard({ data, initialTarget }: Props) {
  const initialCandidate = data.candidates.find(
    (candidate) => `${candidate.publicationType}:${candidate.id}` === initialTarget,
  );
  const target = initialCandidate
    ? {
        id: initialCandidate.id,
        publicationType: initialCandidate.publicationType,
        title: initialCandidate.title,
      }
    : undefined;
  const nextFreeLabel = data.nextFreeAt
    ? new Intl.DateTimeFormat("ru-BY", {
        timeZone: "Europe/Minsk",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(data.nextFreeAt))
    : null;
  const eligibleCount = data.candidates.filter(
    (candidate) => candidate.eligible && !candidate.activeBoostUntil,
  ).length;
  const disabled = !data.availableToday || (target
    ? !initialCandidate?.eligible || Boolean(initialCandidate.activeBoostUntil)
    : eligibleCount === 0);

  return (
    <BusinessSurfaceCard className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
          <Zap className="h-4 w-4 text-amber-500" />
        </span>
        <p className="text-sm font-semibold text-stone-900">Бесплатное продвижение</p>
      </div>

      {data.boost ? (
        <>
          <div>
            <p className="text-base font-semibold text-stone-900">Публикация поднята</p>
            <p className="mt-1 text-sm text-stone-600">{data.boost.publicationTitle}</p>
            <p className="mt-2 text-xs text-stone-500">
              {nextFreeLabel
                ? `Следующее бесплатное поднятие: ${nextFreeLabel} (Минск)`
                : "Бесплатное поднятие доступно через 24 часа"}
            </p>
          </div>
          <div className="border-t border-stone-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              За время поднятия
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric icon={Eye} value={data.boost.metrics.views} label="просмотров" />
              <Metric icon={Heart} value={data.boost.metrics.saves} label="сохранений" />
              <Metric icon={MousePointerClick} value={data.boost.metrics.ctaClicks} label="переходов" />
            </div>
          </div>
        </>
      ) : (
        <div>
          <p className="text-base font-semibold text-stone-900">
            {data.availableToday ? "1 бесплатное поднятие доступно" : "Бесплатное поднятие использовано"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
            Поднимите одну публикацию на 24 часа в своём регионе.
            Позиция зависит от актуальности и интересов семьи.
          </p>
        </div>
      )}

      <BoostLauncher
        target={target}
        disabled={disabled}
        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
      >
        {target ? "Продвинуть выбранную публикацию" : "Продвинуть публикацию"}
      </BoostLauncher>
      {data.candidates.length > 0 && (
        <p className="text-xs text-stone-500">
          Доступно для Boost: {eligibleCount} из {data.candidates.length}.

        </p>
      )}
    </BusinessSurfaceCard>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Eye;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-stone-50 px-2 py-2.5">
      <Icon className="mx-auto h-3.5 w-3.5 text-stone-400" />
      <p className="mt-1 text-sm font-semibold tabular-nums text-stone-800">{value}</p>
      <p className="text-[10px] text-stone-400">{label}</p>
    </div>
  );
}
