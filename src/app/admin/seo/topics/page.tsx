import { SeoTopicsClient } from "@/components/admin/seo/SeoTopicsClient";
import { resolveSeoMarketSession } from "@/lib/admin/seo/geo/resolveSeoGeoSession";
import { computeInternalSearchTrends } from "@/lib/admin/seo/topics/internalTrends";
import type { GeoScope } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminSeoTopicsPage() {
  const session = await resolveSeoMarketSession();
  const trends = await computeInternalSearchTrends({
    filter: session.filter,
    geographyLabel: session.presentation.marketLabel,
  });

  let defaultGeoScope: GeoScope = "CITY";
  let defaultCityId: string | null = null;
  let defaultRegionId: string | null = null;

  if (session.viewScope === "region" || session.filter.kind === "region") {
    defaultGeoScope = "REGION";
    defaultRegionId =
      session.filter.kind === "region" || session.filter.kind === "market"
        ? session.filter.regionId
        : session.context.kind === "city"
          ? session.context.regionId
          : session.context.kind === "region"
            ? session.context.regionId
            : null;
  } else if (session.context.kind === "city") {
    defaultGeoScope = "CITY";
    defaultCityId = session.context.cityId;
    defaultRegionId = session.context.regionId;
  } else if (session.context.kind === "region") {
    defaultGeoScope = "REGION";
    defaultRegionId = session.context.regionId;
  }

  return (
    <SeoTopicsClient
      marketLabel={session.presentation.marketLabel}
      windowDays={trends.windowDays}
      rows={trends.rows}
      risingCount={trends.risingCount}
      highPotentialCount={trends.highPotentialCount}
      showUnknownGeoHint={trends.showUnknownGeoHint}
      defaultCityId={defaultCityId}
      defaultRegionId={defaultRegionId}
      defaultGeoScope={defaultGeoScope}
    />
  );
}
