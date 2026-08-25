import { Prisma } from "@prisma/client";
import {
  ARTICLE_NON_CONTENT_CARD_IMPRESSION_KEYS,
  ARTICLE_NON_CTA_EVENT_KEYS,
} from "@/lib/analytics/metricSemantics";

/**
 * Server-side SQL fragments for Analytics Contract v1.
 *
 * All fragments assume the UserEvent table is aliased as `e`.
 * The exclusion lists come from metricSemantics so TypeScript and SQL cannot
 * silently diverge on what counts as a content impression / conversion CTA.
 */

export const CANONICAL_CARD_IMPRESSION_SQL = Prisma.sql`
  e."eventType" = 'CARD_VIEW'
  AND COALESCE(e."meta"->>'articleEvent', '') NOT IN (
    ${Prisma.join([...ARTICLE_NON_CONTENT_CARD_IMPRESSION_KEYS])}
  )
`;

export const CANONICAL_CTA_CLICK_SQL = Prisma.sql`
  e."eventType" = 'CTA_CLICK'
  AND COALESCE(e."meta"->>'articleEvent', '') NOT IN (
    ${Prisma.join([...ARTICLE_NON_CTA_EVENT_KEYS])}
  )
`;

export type CanonicalMetricCounts = {
  impressions: number;
  opens: number;
  saves: number;
  planAdds: number;
  ctaClicks: number;
};

export type CanonicalMetricRow = {
  impressions: bigint;
  opens: bigint;
  saves: bigint;
  plan_adds: bigint;
  cta_clicks: bigint;
};

export function canonicalMetricSelectSql(): Prisma.Sql {
  return Prisma.sql`
    COUNT(*) FILTER (WHERE ${CANONICAL_CARD_IMPRESSION_SQL})::bigint AS impressions,
    COUNT(*) FILTER (WHERE e."eventType" = 'DETAIL_OPEN')::bigint AS opens,
    COUNT(*) FILTER (WHERE e."eventType" = 'SAVE')::bigint AS saves,
    COUNT(*) FILTER (WHERE e."eventType" = 'PLAN_ADD')::bigint AS plan_adds,
    COUNT(*) FILTER (WHERE ${CANONICAL_CTA_CLICK_SQL})::bigint AS cta_clicks
  `;
}

export function canonicalMetricRowToCounts(
  row: CanonicalMetricRow | null | undefined,
): CanonicalMetricCounts {
  return {
    impressions: Number(row?.impressions ?? 0),
    opens: Number(row?.opens ?? 0),
    saves: Number(row?.saves ?? 0),
    planAdds: Number(row?.plan_adds ?? 0),
    ctaClicks: Number(row?.cta_clicks ?? 0),
  };
}
