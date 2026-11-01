import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveCategoryPrior, type FeedbackTargetType } from "@/lib/feedback/model";
import { computeStarAggregate, type AggregateTagDef, type StarReactionRow } from "@/lib/feedback/starAggregate";

/**
 * Star aggregates per target and source projection (ТЗ Feedback 5★, 5.6–5.7).
 *
 * Every write recomputes the affected projections in full for one target, in
 * the same transaction (no increments). A daily reconcile rewrites any drifted
 * aggregate. Only STARS5, public, non-withdrawn reactions are counted.
 */

type Db = Prisma.TransactionClient | typeof prisma;
type Projection = "DIRECT" | "LINKED_EVENT" | "LINKED_OFFER" | "BUSINESS_ROLLUP";

const COUNTED = { scale: "STARS5", withdrawnAt: null, isPublicEligible: true } as const;
const LINKED_VISITS = ["SELF_REPORTED", "VERIFIED"] as const;

const ROW_SELECT = {
  id: true, actorKey: true, targetId: true, value: true, tagIds: true, visitStatus: true, updatedAt: true,
} satisfies Prisma.FeedbackReactionSelect;

type LoadedRow = Prisma.FeedbackReactionGetPayload<{ select: typeof ROW_SELECT }>;

function toRows(rows: readonly LoadedRow[]): StarReactionRow[] {
  return rows.map((row) => ({
    id: row.id,
    actorKey: row.actorKey,
    targetId: row.targetId,
    value: row.value,
    tagIds: row.tagIds,
    visitStatus: row.visitStatus,
    ratedAt: row.updatedAt,
  }));
}

async function loadTags(db: Db): Promise<AggregateTagDef[]> {
  const tags = await db.feedbackTag.findMany({
    where: { isActive: true },
    select: { id: true, key: true, showFor: true, targetTypes: true, partyCategories: true },
  });
  return tags.map((tag) => ({ ...tag, targetTypes: tag.targetTypes as string[], partyCategories: tag.partyCategories as string[] }));
}

/** Mean of DIRECT aggregates: { count, mean } for the category and for the whole target type. */
async function priorFor(db: Db, targetType: "PLACE" | "EVENT" | "OFFER", category: string | null): Promise<number> {
  const level = async (filter: Prisma.Sql) => {
    const rows = await db.$queryRaw<Array<{ sum: bigint | null; count: bigint | null }>>`
      SELECT SUM(a."ratingSum")::bigint AS sum, SUM(a."ratingCount")::bigint AS count
      FROM "FeedbackReputationAggregate" a
      ${filter}
    `;
    const count = Number(rows[0]?.count ?? 0);
    return { count, mean: count > 0 ? Number(rows[0]?.sum ?? 0) / count : null };
  };
  const typeFilter = Prisma.sql`WHERE a."targetType" = ${targetType}::"FeedbackTargetType" AND a."projection" = 'DIRECT'::"FeedbackProjection"`;
  let categoryFilter: Prisma.Sql | null = null;
  if (category) {
    if (targetType === "PLACE") {
      categoryFilter = Prisma.sql`JOIN "Place" p ON p."id" = a."targetId" ${typeFilter} AND p."category" = ${category}`;
    } else if (targetType === "EVENT") {
      categoryFilter = Prisma.sql`JOIN "Activity" x ON x."id" = a."targetId" ${typeFilter} AND x."type"::text = ${category}`;
    } else if (category.startsWith("PARTY_SERVICE:")) {
      categoryFilter = Prisma.sql`JOIN "Offer" o ON o."id" = a."targetId" ${typeFilter}
        AND o."productType" = 'PARTY_SERVICE'::"OfferProductType" AND o."category"::text = ${category.slice("PARTY_SERVICE:".length)}`;
    } else {
      categoryFilter = Prisma.sql`JOIN "Offer" o ON o."id" = a."targetId" ${typeFilter} AND o."productType"::text = ${category}`;
    }
  }
  return resolveCategoryPrior({
    category: categoryFilter ? await level(categoryFilter) : null,
    targetType: await level(typeFilter),
  });
}

/**
 * Serialize recomputes of one aggregate row. Inside a write transaction the
 * lock is held until commit, so a concurrent writer waits and then reads the
 * committed reactions — no lost update between two simultaneous ratings.
 * Lock order is always DIRECT → LINKED → BUSINESS_ROLLUP (no deadlock cycle).
 * Outside a transaction (reconcile) it is released at once and is harmless.
 */
async function lockAggregate(db: Db, key: { targetType: string; targetId: string; projection: Projection }): Promise<void> {
  const lockKey = `mamago:feedback-aggregate:${key.targetType}:${key.targetId}:${key.projection}`;
  await db.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}

async function writeAggregate(
  db: Db,
  key: { targetType: FeedbackTargetType; targetId: string; projection: Projection },
  input: { rows: StarReactionRow[]; rowsTargetType: FeedbackTargetType; partyCategory: string | null; prior: number; tags: AggregateTagDef[]; now: Date },
): Promise<void> {
  const where = { targetType_targetId_projection: key };
  const aggregate = computeStarAggregate({
    rows: input.rows,
    targetType: input.rowsTargetType,
    partyCategory: input.partyCategory,
    categoryPrior: input.prior,
    tags: input.tags,
    now: input.now,
  });
  if (aggregate.ratingCount === 0) {
    // No ratings = no row: readers treat a missing aggregate as the neutral prior.
    await db.feedbackReputationAggregate.deleteMany({ where: key });
    return;
  }
  const data = {
    ratingCount: aggregate.ratingCount,
    ratingSum: aggregate.ratingSum,
    ratingAverage: aggregate.ratingAverage,
    c1: aggregate.c1, c2: aggregate.c2, c3: aggregate.c3, c4: aggregate.c4, c5: aggregate.c5,
    verifiedCount: aggregate.verifiedCount,
    rankScore: aggregate.rankScore,
    tagStats: aggregate.tagStats as Prisma.InputJsonValue,
  };
  await db.feedbackReputationAggregate.upsert({ where, create: { ...key, ...data }, update: data });
}

async function partyCategoryOf(db: Db, targetType: FeedbackTargetType, targetId: string): Promise<string | null> {
  if (targetType !== "OFFER") return null;
  const offer = await db.offer.findUnique({ where: { id: targetId }, select: { productType: true, category: true } });
  return offer?.productType === "PARTY_SERVICE" ? offer.category ?? null : null;
}

async function categoryOf(db: Db, targetType: "PLACE" | "EVENT" | "OFFER", targetId: string): Promise<string | null> {
  if (targetType === "PLACE") {
    return (await db.place.findUnique({ where: { id: targetId }, select: { category: true } }))?.category ?? null;
  }
  if (targetType === "EVENT") {
    return (await db.activity.findUnique({ where: { id: targetId }, select: { type: true } }))?.type ?? null;
  }
  const offer = await db.offer.findUnique({ where: { id: targetId }, select: { productType: true, category: true } });
  if (!offer) return null;
  return offer.productType === "PARTY_SERVICE" && offer.category ? `PARTY_SERVICE:${offer.category}` : offer.productType ?? null;
}

export async function recomputeDirect(db: Db, targetType: "PLACE" | "EVENT" | "OFFER", targetId: string, now = new Date()): Promise<void> {
  await lockAggregate(db, { targetType, targetId, projection: "DIRECT" });
  const [rows, tags, prior, partyCategory] = await Promise.all([
    db.feedbackReaction.findMany({ where: { ...COUNTED, targetType, targetId }, select: ROW_SELECT }),
    loadTags(db),
    categoryOf(db, targetType, targetId).then((category) => priorFor(db, targetType, category)),
    partyCategoryOf(db, targetType, targetId),
  ]);
  await writeAggregate(db, { targetType, targetId, projection: "DIRECT" }, {
    rows: toRows(rows), rowsTargetType: targetType, partyCategory, prior, tags, now,
  });
}

export async function recomputeLinkedForPlace(db: Db, placeId: string, now = new Date()): Promise<void> {
  const tags = await loadTags(db);
  for (const [projection, rowsType] of [["LINKED_EVENT", "EVENT"], ["LINKED_OFFER", "OFFER"]] as const) {
    await lockAggregate(db, { targetType: "PLACE", targetId: placeId, projection });
    const [rows, prior] = await Promise.all([
      db.feedbackReaction.findMany({
        where: { ...COUNTED, targetType: rowsType, venuePlaceIdAtVisit: placeId, visitStatus: { in: [...LINKED_VISITS] } },
        select: ROW_SELECT,
      }),
      priorFor(db, rowsType, null),
    ]);
    await writeAggregate(db, { targetType: "PLACE", targetId: placeId, projection }, {
      rows: toRows(rows), rowsTargetType: rowsType, partyCategory: null, prior, tags, now,
    });
  }
}

/** Performer rating = direct ratings of the business's own services; venues it worked at are not mixed in. */
export async function recomputeBusinessRollup(db: Db, businessId: string, now = new Date()): Promise<void> {
  await lockAggregate(db, { targetType: "BUSINESS", targetId: businessId, projection: "BUSINESS_ROLLUP" });
  const offers = await db.offer.findMany({ where: { place: { ownerBusinessId: businessId } }, select: { id: true } });
  const [rows, prior, tags] = await Promise.all([
    offers.length === 0
      ? Promise.resolve([] as LoadedRow[])
      : db.feedbackReaction.findMany({
        where: { ...COUNTED, targetType: "OFFER", targetId: { in: offers.map((offer) => offer.id) } },
        select: ROW_SELECT,
      }),
    priorFor(db, "OFFER", null),
    loadTags(db),
  ]);
  await writeAggregate(db, { targetType: "BUSINESS", targetId: businessId, projection: "BUSINESS_ROLLUP" }, {
    rows: toRows(rows), rowsTargetType: "OFFER", partyCategory: null, prior, tags, now,
  });
}

/** Recompute everything a single reaction contributes to (old and new venue both). */
export async function recomputeForReaction(
  db: Db,
  input: { targetType: "PLACE" | "EVENT" | "OFFER"; targetId: string; venuePlaceIds: readonly (string | null)[] },
  now = new Date(),
): Promise<void> {
  await recomputeDirect(db, input.targetType, input.targetId, now);
  if (input.targetType !== "PLACE") {
    for (const placeId of new Set(input.venuePlaceIds.filter((id): id is string => Boolean(id)))) {
      await recomputeLinkedForPlace(db, placeId, now);
    }
  }
  if (input.targetType === "OFFER") {
    const offer = await db.offer.findUnique({ where: { id: input.targetId }, select: { place: { select: { ownerBusinessId: true } } } });
    const businessId = offer?.place?.ownerBusinessId;
    if (businessId) await recomputeBusinessRollup(db, businessId, now);
  }
}

/**
 * Daily reconcile (ТЗ 5.6): recompute every target that has star reactions or an
 * aggregate row. Returns how many aggregate rows changed so drift is visible.
 */
export async function reconcileFeedbackAggregates(now = new Date()): Promise<{ targets: number; changed: number }> {
  const snapshot = async () => new Map(
    (await prisma.feedbackReputationAggregate.findMany({
      select: { targetType: true, targetId: true, projection: true, ratingCount: true, ratingSum: true, rankScore: true },
    })).map((row) => [`${row.targetType}:${row.targetId}:${row.projection}`, `${row.ratingCount}/${row.ratingSum}/${row.rankScore}`]),
  );
  const before = await snapshot();

  const direct = await prisma.feedbackReaction.findMany({
    where: { scale: "STARS5", targetType: { in: ["PLACE", "EVENT", "OFFER"] } },
    distinct: ["targetType", "targetId"],
    select: { targetType: true, targetId: true },
  });
  const venues = await prisma.feedbackReaction.findMany({
    where: { scale: "STARS5", venuePlaceIdAtVisit: { not: null }, targetType: { in: ["EVENT", "OFFER"] } },
    distinct: ["venuePlaceIdAtVisit"],
    select: { venuePlaceIdAtVisit: true },
  });
  const existing = await prisma.feedbackReputationAggregate.findMany({ select: { targetType: true, targetId: true, projection: true } });

  const directKeys = new Map<string, { targetType: "PLACE" | "EVENT" | "OFFER"; targetId: string }>();
  for (const row of direct) directKeys.set(`${row.targetType}:${row.targetId}`, row as { targetType: "PLACE" | "EVENT" | "OFFER"; targetId: string });
  const linkedPlaces = new Set(venues.map((row) => row.venuePlaceIdAtVisit!).filter(Boolean));
  const businesses = new Set<string>();
  for (const row of existing) {
    if (row.projection === "DIRECT" && row.targetType !== "BUSINESS") {
      directKeys.set(`${row.targetType}:${row.targetId}`, row as { targetType: "PLACE" | "EVENT" | "OFFER"; targetId: string });
    } else if (row.projection === "LINKED_EVENT" || row.projection === "LINKED_OFFER") {
      linkedPlaces.add(row.targetId);
    } else if (row.projection === "BUSINESS_ROLLUP") {
      businesses.add(row.targetId);
    }
  }
  const offerIds = [...directKeys.values()].filter((key) => key.targetType === "OFFER").map((key) => key.targetId);
  if (offerIds.length > 0) {
    const owners = await prisma.offer.findMany({ where: { id: { in: offerIds } }, select: { place: { select: { ownerBusinessId: true } } } });
    for (const owner of owners) if (owner.place?.ownerBusinessId) businesses.add(owner.place.ownerBusinessId);
  }

  for (const key of directKeys.values()) await recomputeDirect(prisma, key.targetType, key.targetId, now);
  for (const placeId of linkedPlaces) await recomputeLinkedForPlace(prisma, placeId, now);
  for (const businessId of businesses) await recomputeBusinessRollup(prisma, businessId, now);

  const after = await snapshot();
  let changed = 0;
  for (const key of new Set([...before.keys(), ...after.keys()])) if (before.get(key) !== after.get(key)) changed += 1;
  return { targets: directKeys.size + linkedPlaces.size + businesses.size, changed };
}
