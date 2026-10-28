/**
 * User-level, time-ordered engagement funnel (ТЗ «Аналитика админки», D7/D8).
 *
 * Counts UNIQUE PEOPLE, not events, so no share can exceed 100%:
 *
 *   view   people with any funnel event in scope (feed impression, page view,
 *          open, save, plan, CTA) — the top of the funnel;
 *   open   people with >= 1 DETAIL_OPEN;
 *   save   opened AND saved at/after their first open;
 *   plan   opened AND added to plan at/after their first open;
 *   click  opened AND went to the partner (CTA_CLICK) at/after their first open.
 *
 * `save`, `plan` and `click` are independent branches of `open` (a CTA is not
 * "after plan"), exactly like funnel.* in engagementFunnel.ts, so each of them
 * is a share of the people who opened a card. Identity = userId, else the
 * unique authenticated user linked to the session across ALL events in the
 * reporting window, else anonymous sessionId. Shared sessions with multiple
 * authenticated users remain anonymous for unattributed events.
 *
 * The caller passes two filters: the content event scope (city/entity/vertical,
 * filters) and an identity ownership scope limited to reporting dates and
 * internal-traffic exclusion only. Segment/child-age membership is applied
 * AFTER identity resolution, so anonymous events linked to eligible users count. Identity MUST be determined before
 * content filters, or shared sessions can be misattributed.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OrderedFunnelCounts = {
  view: number;
  open: number;
  save: number;
  plan: number;
  click: number;
};

export const EMPTY_ORDERED_FUNNEL: OrderedFunnelCounts = { view: 0, open: 0, save: 0, plan: 0, click: 0 };

const IDENTITY = Prisma.sql`COALESCE(e."userId", linked."user_id", CASE WHEN e."sessionId" IS NOT NULL THEN 'anon:' || e."sessionId" END)`;

// Resolve ownership for sessions present in matched events, but use ALL
// identity-bearing events in the reporting window to detect shared browsers.
const MATCHED_AND_LINKED = (eventWhere: Prisma.Sql, identityWhere: Prisma.Sql) => Prisma.sql`
  WITH matched AS (
    SELECT e.* FROM "UserEvent" e
    WHERE ${eventWhere} AND ${FUNNEL_TYPES}
  ), matched_sessions AS (
    SELECT DISTINCT "sessionId" FROM matched WHERE "sessionId" IS NOT NULL
  ), linked AS (
    SELECT e."sessionId", MIN(e."userId") AS user_id
    FROM "UserEvent" e
    INNER JOIN matched_sessions s ON s."sessionId" = e."sessionId"
    WHERE ${identityWhere} AND e."userId" IS NOT NULL
    GROUP BY e."sessionId"
    HAVING COUNT(DISTINCT e."userId") = 1
  )
`;
const FUNNEL_TYPES = Prisma.sql`e."eventType" IN ('PAGE_VIEW', 'CARD_VIEW', 'DETAIL_OPEN', 'SAVE', 'PLAN_ADD', 'CTA_CLICK')`;

const AUDIENCE_MEMBERSHIP = (allowed: Set<string> | null): Prisma.Sql => {
  if (!allowed) return Prisma.sql`TRUE`;
  if (allowed.size === 0) return Prisma.sql`FALSE`;
  // Anonymous events can belong to a segment member after session linking.
  return Prisma.sql`COALESCE(e."userId", linked."user_id") IN (${Prisma.join([...allowed])})`;
};

const PER_IDENTITY_COLUMNS = Prisma.sql`
  MIN(e."createdAt") FILTER (WHERE e."eventType" = 'DETAIL_OPEN') AS first_open,
  MAX(e."createdAt") FILTER (WHERE e."eventType" = 'SAVE') AS last_save,
  MAX(e."createdAt") FILTER (WHERE e."eventType" = 'PLAN_ADD') AS last_plan,
  MAX(e."createdAt") FILTER (WHERE e."eventType" = 'CTA_CLICK') AS last_cta
`;

const STEP_COUNTS = Prisma.sql`
  count(*)::bigint AS view,
  count(*) FILTER (WHERE first_open IS NOT NULL)::bigint AS open,
  count(*) FILTER (WHERE first_open IS NOT NULL AND last_save >= first_open)::bigint AS save,
  count(*) FILTER (WHERE first_open IS NOT NULL AND last_plan >= first_open)::bigint AS plan,
  count(*) FILTER (WHERE first_open IS NOT NULL AND last_cta >= first_open)::bigint AS click
`;

type CountsRow = { view: bigint; open: bigint; save: bigint; plan: bigint; click: bigint };

const toCounts = (row: CountsRow | undefined): OrderedFunnelCounts =>
  row
    ? {
        view: Number(row.view),
        open: Number(row.open),
        save: Number(row.save),
        plan: Number(row.plan),
        click: Number(row.click),
      }
    : { ...EMPTY_ORDERED_FUNNEL };

/** Ordered unique-people funnel for the events matched by `eventWhere` (alias `e`). */
export async function countOrderedFunnel(eventWhere: Prisma.Sql, identityWhere: Prisma.Sql, allowed: Set<string> | null = null): Promise<OrderedFunnelCounts> {
  const rows = await prisma.$queryRaw<CountsRow[]>(Prisma.sql`
    ${MATCHED_AND_LINKED(eventWhere, identityWhere)}, per AS (
      SELECT ${IDENTITY} AS ident, ${PER_IDENTITY_COLUMNS}
      FROM matched e
      LEFT JOIN linked ON linked."sessionId" = e."sessionId"
      WHERE ${IDENTITY} IS NOT NULL AND ${AUDIENCE_MEMBERSHIP(allowed)}
      GROUP BY 1
    )
    SELECT ${STEP_COUNTS} FROM per
  `);
  return toCounts(rows[0]);
}

export type EntityFunnelRow = OrderedFunnelCounts & { entityType: string; entityId: string };

/** The same funnel per (entityType, entityId): unique people per card. */
export async function countOrderedFunnelByEntity(eventWhere: Prisma.Sql, identityWhere: Prisma.Sql, allowed: Set<string> | null = null): Promise<EntityFunnelRow[]> {
  const rows = await prisma.$queryRaw<Array<CountsRow & { entityType: string; entityId: string }>>(Prisma.sql`
    ${MATCHED_AND_LINKED(eventWhere, identityWhere)}, per AS (
      SELECT e."entityType"::text AS et, e."entityId" AS eid, ${IDENTITY} AS ident, ${PER_IDENTITY_COLUMNS}
      FROM matched e
      LEFT JOIN linked ON linked."sessionId" = e."sessionId"
      WHERE ${IDENTITY} IS NOT NULL AND ${AUDIENCE_MEMBERSHIP(allowed)}
        AND e."entityType" IS NOT NULL AND e."entityId" IS NOT NULL
      GROUP BY 1, 2, 3
    )
    SELECT et AS "entityType", eid AS "entityId", ${STEP_COUNTS}
    FROM per
    GROUP BY et, eid
  `);
  return rows.map((r) => ({ entityType: r.entityType, entityId: r.entityId, ...toCounts(r) }));
}

/** Share in 0..1; null when the denominator is empty. */
export function share(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}
