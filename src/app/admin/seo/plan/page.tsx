import { SeoContentPlanClient } from "@/components/admin/seo/SeoContentPlanClient";
import { resolveSeoMarketSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";
import {
  addDays,
  addMonths,
  computePlanMix,
  listSeoContentPlanItems,
  startOfMonth,
  startOfWeekMonday,
} from "@/lib/admin/seo/plan/seoContentPlan.service";
import { buildAdminPath } from "@/lib/routing/surface";
import { firstSearchParam } from "@/lib/admin/firstSearchParam";

export const dynamic = "force-dynamic";

function formatWeekLabel(from: Date, toExclusive: Date): string {
  const to = addDays(toExclusive, -1);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  return `${from.toLocaleDateString("ru-RU", opts)} – ${to.toLocaleDateString("ru-RU", opts)}`;
}

function formatMonthLabel(from: Date): string {
  return from.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

interface PageProps {
  searchParams: Promise<{
    period?: string | string[];
    offset?: string | string[];
  }>;
}

export default async function AdminSeoPlanPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const session = await resolveSeoMarketSession();
  const period =
    firstSearchParam(raw.period) === "month" ? "month" : "week";
  const offset = Number(firstSearchParam(raw.offset) ?? "0") || 0;

  const now = new Date();
  let from: Date;
  let to: Date;
  let periodLabel: string;
  let prevOffset = offset - 1;
  let nextOffset = offset + 1;

  if (period === "week") {
    from = addDays(startOfWeekMonday(now), offset * 7);
    to = addDays(from, 7);
    periodLabel = formatWeekLabel(from, to);
  } else {
    from = addMonths(startOfMonth(now), offset);
    to = addMonths(from, 1);
    periodLabel = formatMonthLabel(from);
  }

  const items = await listSeoContentPlanItems({
    filter: session.filter,
    from,
    to,
  });
  const mix = computePlanMix(items);

  const base = buildAdminPath("/seo/plan");
  const qs = (p: string, o: number) => `${base}?period=${p}&offset=${o}`;

  const defaultCityId =
    session.context.kind === "city" ? session.context.cityId : null;
  const defaultRegionId =
    session.context.kind === "city"
      ? session.context.regionId
      : session.context.kind === "region"
        ? session.context.regionId
        : null;
  const defaultCountryName =
    session.context.kind === "country"
      ? session.context.countryName
      : session.presentation.countryName;

  return (
    <SeoContentPlanClient
      marketLabel={session.presentation.marketLabel}
      contextKind={session.context.kind}
      period={period}
      periodLabel={periodLabel}
      prevHref={qs(period, prevOffset)}
      nextHref={qs(period, nextOffset)}
      weekHref={qs("week", 0)}
      monthHref={qs("month", 0)}
      mix={mix}
      defaultCityId={defaultCityId}
      defaultRegionId={defaultRegionId}
      defaultCityName={session.presentation.cityName}
      defaultRegionName={session.presentation.regionName}
      defaultCountryName={defaultCountryName}
      items={items.map((item) => ({
        id: item.id,
        title: item.title,
        targetQuery: item.targetQuery,
        geoScope: item.geoScope,
        scheduledFor: item.scheduledFor?.toISOString() ?? null,
        status: item.status,
        priority: item.priority,
        city: item.city,
        region: item.region,
        article: item.article,
      }))}
    />
  );
}
