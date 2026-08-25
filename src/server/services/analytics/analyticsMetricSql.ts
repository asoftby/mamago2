import { Prisma } from "@prisma/client";

/**
 * Server-side SQL fragments for Analytics Contract v1.
 *
 * All fragments assume the UserEvent table is aliased as `e`.
 * Keep raw-SQL analytics services on these helpers so the definition of a
 * content impression / conversion CTA cannot drift between dashboards.
 */

export const CANONICAL_CARD_IMPRESSION_SQL = Prisma.sql`
  e."eventType" = 'CARD_VIEW'
  AND COALESCE(e."meta"->>'articleEvent', '') <> 'article_telegram_cta_impression'
`;

export const CANONICAL_CTA_CLICK_SQL = Prisma.sql`
  e."eventType" = 'CTA_CLICK'
  AND COALESCE(e."meta"->>'articleEvent', '') NOT IN (
    'article_read_25',
    'article_read_50',
    'article_read_75',
    'article_complete',
    'next_article_loaded',
    'article_section_exhausted',
    'article_rating_submitted'
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
