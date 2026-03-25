"use client";

import Link from "next/link";
import { ActivityCard } from "@/components/activity/ActivityCard";
import { RouteCard } from "@/components/routes/RouteCard";
import { CityHomeSection } from "@/features/city-home/components/CityHomeSection";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import { MINSK_JOURNAL_PREVIEW } from "@/features/city-home/data/minskCityHome";
import { useCity } from "@/contexts/CityContext";
import { getCityDisplayName } from "@/lib/city/cityLabels";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";
import { MOCK_ROUTES } from "@/mocks/routes.mock";
import { cn } from "@/lib/utils";

const KUDA_PREVIEW = MINSK_ACTIVITIES.slice(0, 8);
const CLASSES_PREVIEW = MINSK_ACTIVITIES.filter((a) => a.type === "CLASS_SCHEDULE").slice(
  0,
  8,
);
const ROUTES_PREVIEW = MOCK_ROUTES.filter((r) => r.cityName === "Минск").slice(0, 6);

const cardShell = "shrink-0 snap-start w-[42vw] min-w-[156px] max-w-[220px] sm:max-w-[240px]";

function kudaTitle(citySlug: string): string {
  const name = getCityDisplayName(citySlug);
  return citySlug === "minsk"
    ? "Куда пойти сегодня в Минске"
    : `Куда пойти сегодня — ${name}`;
}

export function CityHomeKudaSection() {
  const { citySlug, appendCityQuery } = useCity();
  const preview =
    citySlug === "minsk" ? KUDA_PREVIEW : ([] as typeof KUDA_PREVIEW);

  if (preview.length === 0) {
    return (
      <CityHomeSection
        className="pt-[5px]"
        title={kudaTitle(citySlug)}
        actionLabel="Смотреть все"
        actionHref={appendCityQuery(`/${citySlug}/kuda`)}
        actionIconButton
      >
        <p className="text-sm text-neutral-500 px-1 py-2 leading-relaxed">
          Подборка для {getCityDisplayName(citySlug)} скоро появится — а пока
          загляните в раздел «Куда пойти».
        </p>
      </CityHomeSection>
    );
  }

  return (
    <CityHomeSection
      className="pt-[5px]"
      title={kudaTitle(citySlug)}
      actionLabel="Смотреть все"
      actionHref={appendCityQuery(`/${citySlug}/kuda`)}
      actionIconButton
    >
      <HorizontalCardRow>
        {preview.map((activity) => (
          <div key={activity.id} className={cardShell}>
            <ActivityCard
              activity={activity}
              saveMeta={{
                title: activity.title,
                dateISO: activity.dateStart ?? null,
                dateLabel: activity.dateStart
                  ? formatRuShortDayMonth(activity.dateStart)
                  : null,
              }}
            />
          </div>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}

export function CityHomeClassesSection() {
  const { citySlug, appendCityQuery } = useCity();
  const preview =
    citySlug === "minsk" ? CLASSES_PREVIEW : ([] as typeof CLASSES_PREVIEW);

  if (preview.length === 0) return null;

  return (
    <CityHomeSection
      title="Занятия"
      actionLabel="Все занятия"
      actionHref={appendCityQuery(`/${citySlug}/classes`)}
      actionIconButton
    >
      <HorizontalCardRow>
        {preview.map((activity) => (
          <div key={activity.id} className={cardShell}>
            <ActivityCard
              activity={activity}
              saveMeta={{
                title: activity.title,
                dateISO: activity.dateStart ?? null,
                dateLabel: activity.dateStart
                  ? formatRuShortDayMonth(activity.dateStart)
                  : null,
              }}
            />
          </div>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}

export function CityHomeRoutesSection() {
  const { citySlug, appendCityQuery } = useCity();
  const preview =
    citySlug === "minsk" ? ROUTES_PREVIEW : ([] as typeof ROUTES_PREVIEW);

  if (preview.length === 0) return null;

  return (
    <CityHomeSection
      title="Маршруты"
      actionLabel="Все маршруты"
      actionHref={appendCityQuery(`/${citySlug}/routes`)}
      actionIconButton
    >
      <HorizontalCardRow>
        {preview.map((route) => (
          <div key={route.id} className={cn(cardShell, "max-w-[260px] sm:max-w-[280px]")}>
            <RouteCard route={route} />
          </div>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}

export function CityHomeJournalSection() {
  const { appendCityQuery } = useCity();
  if (MINSK_JOURNAL_PREVIEW.length === 0) return null;

  return (
    <CityHomeSection
      title="Статьи и обзоры"
      actionLabel="В журнал"
      actionHref={appendCityQuery("/blog")}
      actionIconButton
    >
      <HorizontalCardRow>
        {MINSK_JOURNAL_PREVIEW.map((a) => (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}`}
            className={cn(
              cardShell,
              "rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300 hover:bg-neutral-50/80 transition-colors",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              {a.category}
            </p>
            <p className="text-sm font-semibold text-neutral-900 leading-snug line-clamp-3 mt-2">
              {a.title}
            </p>
            {a.subtitle ? (
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{a.subtitle}</p>
            ) : null}
            <p className="text-xs text-neutral-400 mt-3">{a.readTime} мин чтения</p>
          </Link>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}
