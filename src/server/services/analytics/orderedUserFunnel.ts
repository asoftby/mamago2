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
 * is a share of the people who opened a card. Identity = userId, else the unique authenticated user linked to that session
 * within the filtered reporting window, else anonymous sessionId. Ambiguous
 * shared sessions remain anonymous to avoid attributing events to wrong users.
 *
 * The caller passes the shared event filter (`analyticsEventWhereSql`: window,
 * internal-traffic exclusion, city/entity/vertical and the segment / child-age
 * user filter) so every tab filters identically.
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

// Resolve session identity once across the filtered reporting window, not per event.
// Only link sessions associated with exactly one authenticated user.
const MATCHED_AND_LINKED = (eventWhere: Prisma.Sql) => Prisma.sql`
  WITH matched AS (
    SELECT e.* FROM "UserEvent" e
    WHERE ${eventWhere} AND ${FUNNEL_TYPES}
  ), linked AS (
    SELECT "sessionId", MIN("userId") AS user_id
    FROM matched
    WHERE "sessionId" IS NOT NULL AND "userId" IS NOT NULL
    GROUP BY "sessionId"
    HAVING COUNT(DISTINCT "userId") = 1
  )
`;
const FUNNEL_TYPES = Prisma.sql`e."eventType" IN ('PAGE_VIEW', 'CARD_VIEW', 'DETAIL_OPEN', 'SAVE', 'PLAN_ADD', 'CTA_CLICK')`;

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
export async function countOrderedFunnel(eventWhere: Prisma.Sql): Promise<OrderedFunnelCounts> {
  const rows = await prisma.$queryRaw<CountsRow[]>(Prisma.sql`
    ${MATCHED_AND_LINKED(eventWhere)}, per AS (
      SELECT ${IDENTITY} AS ident, ${PER_IDENTITY_COLUMNS}
      FROM matched e
      LEFT JOIN linked ON linked."sessionId" = e."sessionId"
      WHERE ${IDENTITY} IS NOT NULL
      GROUP BY 1
    )
    SELECT ${STEP_COUNTS} FROM per
  `);
  return toCounts(rows[0]);
}

export type EntityFunnelRow = OrderedFunnelCounts & { entityType: string; entityId: string };

/** The same funnel per (entityType, entityId): unique people per card. */
export async function countOrderedFunnelByEntity(eventWhere: Prisma.Sql): Promise<EntityFunnelRow[]> {
  const rows = await prisma.$queryRaw<Array<CountsRow & { entityType: string; entityId: string }>>(Prisma.sql`
    ${MATCHED_AND_LINKED(eventWhere)}, per AS (
      SELECT e."entityType"::text AS et, e."entityId" AS eid, ${IDENTITY} AS ident, ${PER_IDENTITY_COLUMNS}
      FROM matched e
      LEFT JOIN linked ON linked."sessionId" = e."sessionId"
      WHERE ${IDENTITY} IS NOT NULL
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
