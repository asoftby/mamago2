import type { PrismaClient } from "@prisma/client";

/** Exact protected Place adoption identity — Atmosfera / places:43023. */
export const PHOENIX_PROTECTED_PLACE_SOURCE_KEY = "wordpress-db:places:43023";
export const PHOENIX_PROTECTED_PLACE_ADOPTION_HASH = "protected-adoption:places-preview-2026-07-30";

export type PhoenixProtectedPlaceLineageRow = {
  sourceRecordKey: string;
  targetType: string;
  targetId: string | null;
  targetRole: string;
  targetNaturalKey: string | null;
  lastSourceHash: string | null;
  lastPlanAction: string | null;
  isActive: boolean;
};

/**
 * Fail-closed Atmosfera protected-adoption proof shared by live-checkpoint and
 * the pinned Offers-partial report continuation. `block` defaults to the
 * live-checkpoint error prefix so existing checkpoint callers stay unchanged.
 */
export async function assertPhoenixProtectedPlaceAtmosferaAdoption(input: {
  prisma: {
    place: { findMany: PrismaClient["place"]["findMany"] };
    business: { findUnique: PrismaClient["business"]["findUnique"] };
  };
  /** Active lineages in the Phoenix release source (all target types). */
  activeLineages: readonly PhoenixProtectedPlaceLineageRow[];
  /** Every PLACE lineage row for `PHOENIX_PROTECTED_PLACE_SOURCE_KEY` (active or not). */
  protectedPlaceRows: readonly PhoenixProtectedPlaceLineageRow[];
  block?: (code: string) => Error;
}): Promise<{
  sourceRecordKey: typeof PHOENIX_PROTECTED_PLACE_SOURCE_KEY;
  action: "LINK_EXISTING";
  naturalKey: "slug:atmosfera";
  targetId: string;
  targetSlug: "atmosfera";
  normalizedTitle: "атмосфера";
  citySlug: "minsk";
  ownerBusinessId: string;
  ownerUserId: string;
}> {
  const blockedFn = input.block ?? ((code: string) => new Error(`RELEASE_BLOCKED:LIVE_CHECKPOINT_${code}`));
  const protectedLines = input.protectedPlaceRows.filter(
    (row) => row.sourceRecordKey === PHOENIX_PROTECTED_PLACE_SOURCE_KEY && row.targetType === "PLACE",
  );
  if (protectedLines.length !== 1 || !protectedLines[0].isActive) throw blockedFn("PROTECTED_LINEAGE_COUNT_MISMATCH");
  const protectedLine = protectedLines[0];
  if (
    protectedLine.targetRole !== "primary" ||
    protectedLine.targetNaturalKey !== "slug:atmosfera" ||
    protectedLine.lastSourceHash !== PHOENIX_PROTECTED_PLACE_ADOPTION_HASH ||
    protectedLine.lastPlanAction !== "LINK_EXISTING" ||
    !protectedLine.targetId
  ) {
    throw blockedFn("PROTECTED_LINEAGE_MISMATCH");
  }
  const places = (await input.prisma.place.findMany({
    where: {
      OR: [{ id: protectedLine.targetId }, { slug: "atmosfera" }, { title: { equals: "Атмосфера", mode: "insensitive" } }],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      city: { select: { slug: true, isActive: true } },
      createdByUserId: true,
      ownerBusinessId: true,
    },
  })) as Array<{
    id: string;
    title: string;
    slug: string | null;
    status: string;
    city: { slug: string | null; isActive: boolean } | null;
    createdByUserId: string;
    ownerBusinessId: string | null;
  }>;
  if (places.length !== 1 || places[0].id !== protectedLine.targetId) throw blockedFn("PROTECTED_TARGET_AMBIGUOUS");
  const place = places[0];
  if (
    place.slug !== "atmosfera" ||
    place.title.trim().toLocaleLowerCase("ru") !== "атмосфера" ||
    place.status !== "PUBLISHED" ||
    place.city?.slug !== "minsk" ||
    !place.city.isActive ||
    !place.ownerBusinessId
  ) {
    throw blockedFn("PROTECTED_TARGET_MISMATCH");
  }
  const ownerLine = input.activeLineages.filter(
    (row) => row.sourceRecordKey === "wordpress-db:user:525" && row.targetType === "USER" && row.targetRole === "primary",
  );
  if (ownerLine.length !== 1 || ownerLine[0].targetId !== place.createdByUserId) {
    throw blockedFn("PROTECTED_OWNER_LINEAGE_MISMATCH");
  }
  const business = await input.prisma.business.findUnique({
    where: { id: place.ownerBusinessId },
    select: { id: true, ownerUserId: true },
  });
  if (!business || business.ownerUserId !== place.createdByUserId) throw blockedFn("PROTECTED_BUSINESS_MISMATCH");
  return {
    sourceRecordKey: PHOENIX_PROTECTED_PLACE_SOURCE_KEY,
    action: "LINK_EXISTING",
    naturalKey: "slug:atmosfera",
    targetId: place.id,
    targetSlug: "atmosfera",
    normalizedTitle: "атмосфера",
    citySlug: "minsk",
    ownerBusinessId: business.id,
    ownerUserId: place.createdByUserId,
  };
}
