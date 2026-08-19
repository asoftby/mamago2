#!/usr/bin/env tsx
/**
 * Phase 2.6 — full inventory census (no type filter).
 *
 * Usage:
 *   set -a; source .env; set +a
 *   pnpm exec tsx scripts/stories-inventory-census.ts [--city=minsk]
 */

import {
  ActivityType,
  ContentStatus,
  OfferKind,
  OfferProductType,
  OfferStatus,
} from "@prisma/client";
import { URL } from "node:url";
import prisma from "../src/lib/prisma";
import { findCityBySlug } from "../src/server/geo/findCityBySlug";
import { activityInCityWhere } from "../src/server/discovery/activityInCityWhere";
import {
  activityOwnerBusinessActiveWhere,
  getActivityNotExpiredForPublicWhere,
  getPublicListingActivityWhere,
} from "../src/server/public/publicContentVisibility";
import { BREAKING_NEWS_SUBTITLE } from "../src/lib/publications/breakingNewsArticle";
import { SERIAL_CLASSIFICATION_CONFIG } from "../src/lib/stories/serialConfig";

function parseArgs(argv: string[]) {
  let citySlug = "minsk";
  for (const arg of argv) {
    if (arg.startsWith("--city=")) citySlug = arg.slice("--city=".length);
  }
  return { citySlug };
}

function envFingerprint(): {
  envGuess: string;
  dbHost: string;
  dbPort: string;
  dbName: string;
  snapshotAt: string;
} {
  const raw = process.env.DATABASE_URL ?? "";
  let dbHost = "(unset)";
  let dbPort = "";
  let dbName = "";
  try {
    const u = new URL(raw);
    dbHost = u.hostname || "(empty)";
    dbPort = u.port || "";
    dbName = (u.pathname || "").replace(/^\//, "");
  } catch {
    dbHost = "(unparseable DATABASE_URL)";
  }
  const h = dbHost.toLowerCase();
  let envGuess = "unknown";
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) {
    envGuess = "local-dev";
  } else if (h.includes("staging") || h.includes("stage")) {
    envGuess = "staging";
  } else if (h.includes("prod") || h.includes("mamago")) {
    envGuess = "likely-remote";
  }
  return {
    envGuess,
    dbHost,
    dbPort,
    dbName,
    snapshotAt: new Date().toISOString(),
  };
}

function printMatrix(
  title: string,
  rows: Array<Record<string, string | number>>,
  columns: string[],
) {
  console.log(`\n## ${title}\n`);
  if (rows.length === 0) {
    console.log("(empty)\n");
    return;
  }
  console.log(columns.join(" | "));
  console.log(columns.map(() => "---").join(" | "));
  for (const row of rows) {
    console.log(columns.map((c) => String(row[c] ?? 0)).join(" | "));
  }
}

async function countActivityMatrix(cityId: string | null, now: Date) {
  const types = Object.values(ActivityType);
  const statuses = Object.values(ContentStatus);
  const rows: Array<Record<string, string | number>> = [];

  for (const type of types) {
    for (const status of statuses) {
      const base = {
        type,
        status,
        ...(cityId ? activityInCityWhere(cityId) : {}),
      };

      const [total, withSessions, withoutSessions, futureNext] = await Promise.all([
        prisma.activity.count({ where: base }),
        prisma.activity.count({
          where: { AND: [base, { sessions: { some: {} } }] },
        }),
        prisma.activity.count({
          where: { AND: [base, { sessions: { none: {} } }] },
        }),
        prisma.activity.count({
          where: {
            AND: [base, { nextOccurrenceAt: { gte: now } }],
          },
        }),
      ]);

      if (total === 0) continue;
      rows.push({
        type,
        status,
        total,
        with_sessions: withSessions,
        without_sessions: withoutSessions,
        nextOccurrence_future: futureNext,
      });
    }
  }
  return rows;
}

async function countOfferMatrix(cityId: string | null) {
  const kinds = Object.values(OfferKind);
  const productTypes = [...Object.values(OfferProductType), "NULL"] as const;
  const statuses = Object.values(OfferStatus);
  const rows: Array<Record<string, string | number>> = [];

  for (const kind of kinds) {
    for (const productType of productTypes) {
      for (const status of statuses) {
        const productWhere =
          productType === "NULL"
            ? { productType: null }
            : { productType: productType as OfferProductType };
        const base = {
          kind,
          status,
          ...productWhere,
          ...(cityId
            ? { OR: [{ cityId }, { place: { cityId } }] }
            : {}),
        };

        const [total, withSessions, withoutSessions] = await Promise.all([
          prisma.offer.count({ where: base }),
          prisma.offer.count({
            where: { AND: [base, { sessions: { some: {} } }] },
          }),
          prisma.offer.count({
            where: { AND: [base, { sessions: { none: {} } }] },
          }),
        ]);
        if (total === 0) continue;
        rows.push({
          kind,
          productType,
          status,
          total,
          with_OfferSession: withSessions,
          without_OfferSession: withoutSessions,
        });
      }
    }
  }
  return rows;
}

async function countPlaceMatrix(cityId: string | null) {
  const statuses = Object.values(ContentStatus);
  const rows: Array<Record<string, string | number>> = [];
  for (const status of statuses) {
    const base = {
      status,
      ...(cityId ? { cityId } : {}),
    };
    const [total, archived, notArchived] = await Promise.all([
      prisma.place.count({ where: base }),
      prisma.place.count({
        where: { AND: [base, { archivedAt: { not: null } }] },
      }),
      prisma.place.count({
        where: { AND: [base, { archivedAt: null }] },
      }),
    ]);
    if (total === 0) continue;
    rows.push({
      status,
      total,
      archived: archived,
      not_archived: notArchived,
    });
  }
  return rows;
}

async function countArticleMatrix(cityId: string | null) {
  const statuses = Object.values(ContentStatus);
  const rows: Array<Record<string, string | number>> = [];
  for (const status of statuses) {
    const base = {
      status,
      ...(cityId
        ? {
            OR: [
              { cityId },
              { cityContext: null },
              // cityContext stores slug historically for some rows
            ],
          }
        : {}),
    };

    // For city scope prefer cityId; also count cityContext=slug separately below.
    const cityScoped = cityId
      ? { status, OR: [{ cityId }, { city: { id: cityId } }] }
      : { status };

    const [total, breaking, publishedBreaking] = await Promise.all([
      prisma.article.count({ where: cityId ? cityScoped : base }),
      prisma.article.count({
        where: {
          AND: [
            cityId ? cityScoped : base,
            { subtitle: BREAKING_NEWS_SUBTITLE },
          ],
        },
      }),
      prisma.article.count({
        where: {
          AND: [
            cityId ? cityScoped : base,
            { subtitle: BREAKING_NEWS_SUBTITLE },
            { status: "PUBLISHED" },
            { publishedAt: { not: null } },
          ],
        },
      }),
    ]);
    if (total === 0 && breaking === 0) continue;
    rows.push({
      status,
      total,
      breaking,
      breaking_published: publishedBreaking,
    });
  }
  return rows;
}

async function eventFunnel(cityId: string, now: Date) {
  const cityEvent = {
    AND: [{ type: ActivityType.EVENT }, activityInCityWhere(cityId)],
  };

  const statusWhere = {
    status: {
      notIn: [
        ContentStatus.DRAFT,
        ContentStatus.PENDING,
        ContentStatus.NEEDS_REVISION,
        ContentStatus.REJECTED,
        ContentStatus.DELETED,
      ],
    },
  };

  const steps: Array<{ label: string; where: object }> = [
    { label: "0_base_EVENT_in_city", where: cityEvent },
    {
      label: "1_AND_status_publicListing",
      where: { AND: [cityEvent, statusWhere] },
    },
    {
      label: "2_AND_ownerBusinessActive",
      where: {
        AND: [cityEvent, statusWhere, activityOwnerBusinessActiveWhere],
      },
    },
    {
      label: "3_AND_notExpired (full getPublicListingActivityWhere)",
      where: {
        AND: [
          cityEvent,
          getPublicListingActivityWhere(now),
        ],
      },
    },
    {
      label: "2b_status_plus_notExpired_WITHOUT_business",
      where: {
        AND: [cityEvent, statusWhere, getActivityNotExpiredForPublicWhere(now)],
      },
    },
    {
      label: "1b_status_only_PUBLISHED_exact",
      where: { AND: [cityEvent, { status: ContentStatus.PUBLISHED }] },
    },
    {
      label: "1c_status_PUBLISHED_or_PENDING_UPDATE",
      where: {
        AND: [
          cityEvent,
          {
            status: {
              in: [ContentStatus.PUBLISHED, ContentStatus.PENDING_UPDATE],
            },
          },
        ],
      },
    },
    {
      label: "x_has_any_sessions",
      where: { AND: [cityEvent, { sessions: { some: {} } }] },
    },
    {
      label: "x_has_future_session",
      where: {
        AND: [cityEvent, { sessions: { some: { startsAt: { gte: now } } } }],
      },
    },
    {
      label: "x_nextOccurrenceAt_gte_now",
      where: { AND: [cityEvent, { nextOccurrenceAt: { gte: now } }] },
    },
  ];

  const out: Array<{ step: string; n: number; dropped_vs_prev: number | string }> =
    [];
  let prev: number | null = null;
  for (const step of steps) {
    const n = await prisma.activity.count({ where: step.where });
    out.push({
      step: step.label,
      n,
      dropped_vs_prev: prev == null ? "—" : prev - n,
    });
    // Only chain drop for the main cumulative path 0→1→2→3
    if (step.label.startsWith("0_") || step.label.startsWith("1_AND") || step.label.startsWith("2_AND") || step.label.startsWith("3_AND")) {
      prev = n;
    }
  }
  return out;
}

async function main() {
  const { citySlug } = parseArgs(process.argv.slice(2));
  const fp = envFingerprint();
  const now = new Date();
  const city = await findCityBySlug(citySlug);
  if (!city) {
    console.error(`City not found: ${citySlug}`);
    process.exit(1);
  }

  console.log(`# Stories inventory census`);
  console.log(`snapshot_at=${fp.snapshotAt}`);
  console.log(`env_guess=${fp.envGuess}`);
  console.log(`db_host=${fp.dbHost} db_port=${fp.dbPort || "(default)"} db_name=${fp.dbName}`);
  console.log(`APP_ENV=${process.env.APP_ENV ?? "(unset)"} NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}`);
  console.log(`city=${city.slug} (${city.id})`);
  console.log(
    `serial_config=${JSON.stringify(SERIAL_CLASSIFICATION_CONFIG)} (config only — classification not applied in this census)`,
  );
  console.log(``);
  console.log(
    `NOTE: Activity has no archivedAt column. Offer/Place do. Public EVENT listing uses status + ownerBusinessActive + notExpired.`,
  );

  // ── Global ────────────────────────────────────────────────────────────────
  const [
    activityAll,
    offerAll,
    placeAll,
    articleAll,
    activityMinsk,
    offerMinsk,
    placeMinsk,
    articleMinsk,
    funnel,
  ] = await Promise.all([
    countActivityMatrix(null, now),
    countOfferMatrix(null),
    countPlaceMatrix(null),
    countArticleMatrix(null),
    countActivityMatrix(city.id, now),
    countOfferMatrix(city.id),
    countPlaceMatrix(city.id),
    countArticleMatrix(city.id),
    eventFunnel(city.id, now),
  ]);

  printMatrix(
    "Activity — ALL DB (type × status)",
    activityAll,
    ["type", "status", "total", "with_sessions", "without_sessions", "nextOccurrence_future"],
  );
  printMatrix(
    `Activity — ${city.slug} (type × status)`,
    activityMinsk,
    ["type", "status", "total", "with_sessions", "without_sessions", "nextOccurrence_future"],
  );

  printMatrix(
    "Offer — ALL DB (kind × productType × status)",
    offerAll,
    ["kind", "productType", "status", "total", "with_OfferSession", "without_OfferSession"],
  );
  printMatrix(
    `Offer — ${city.slug} (kind × productType × status)`,
    offerMinsk,
    ["kind", "productType", "status", "total", "with_OfferSession", "without_OfferSession"],
  );

  printMatrix("Place — ALL DB", placeAll, ["status", "total", "archived", "not_archived"]);
  printMatrix(`Place — ${city.slug}`, placeMinsk, ["status", "total", "archived", "not_archived"]);

  printMatrix(
    "Article — ALL DB",
    articleAll,
    ["status", "total", "breaking", "breaking_published"],
  );
  printMatrix(
    `Article — ${city.slug} (cityId)`,
    articleMinsk,
    ["status", "total", "breaking", "breaking_published"],
  );

  // Totals helpers
  const sum = (rows: Array<Record<string, string | number>>, key: string) =>
    rows.reduce((a, r) => a + Number(r[key] ?? 0), 0);

  console.log(`\n## Totals\n`);
  console.log(`scope | Activity | Offer | Place | Article`);
  console.log(`--- | --- | --- | --- | ---`);
  console.log(
    `ALL | ${sum(activityAll, "total")} | ${sum(offerAll, "total")} | ${sum(placeAll, "total")} | ${sum(articleAll, "total")}`,
  );
  console.log(
    `${city.slug} | ${sum(activityMinsk, "total")} | ${sum(offerMinsk, "total")} | ${sum(placeMinsk, "total")} | ${sum(articleMinsk, "total")}`,
  );

  const pubEventMinsk = activityMinsk
    .filter((r) => r.type === "EVENT" && (r.status === "PUBLISHED" || r.status === "PENDING_UPDATE"))
    .reduce((a, r) => a + Number(r.total), 0);
  const pubOfferMinsk = offerMinsk
    .filter((r) => r.status === "PUBLISHED")
    .reduce((a, r) => a + Number(r.total), 0);
  const pubPlaceMinsk = placeMinsk
    .filter((r) => r.status === "PUBLISHED")
    .reduce((a, r) => a + Number(r.not_archived), 0);

  console.log(`\n## Public-ish surface (rough)\n`);
  console.log(`EVENT PUBLISHED|PENDING_UPDATE (${city.slug}): ${pubEventMinsk}`);
  console.log(`Offer PUBLISHED (${city.slug}): ${pubOfferMinsk}`);
  console.log(`Place PUBLISHED not archived (${city.slug}): ${pubPlaceMinsk}`);

  console.log(`\n## Funnel: Activity EVENT × ${city.slug} vs getPublicListingActivityWhere\n`);
  console.log(`step | n | dropped_vs_prev_on_main_path`);
  console.log(`--- | --- | ---`);
  for (const row of funnel) {
    console.log(`${row.step} | ${row.n} | ${row.dropped_vs_prev}`);
  }

  console.log(`\nDone.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
