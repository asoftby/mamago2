import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { enrichSemanticEventMeta } from "./SemanticEventContextService";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at an isolated test database");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const marker = randomUUID();

async function main() {
  const owner = await prisma.user.create({ data: { email: `phase-d-semantic-${marker}@example.invalid` } });
  const category = await prisma.eventCategory.create({
    data: { nameRu: `Наука ${marker}`, nameEn: `Science ${marker}`, slug: `science-${marker}` },
  });
  const activity = await prisma.activity.create({
    data: {
      ownerUserId: owner.id,
      title: `Semantic event ${marker}`,
      shortDesc: "fixture",
      type: "EVENT",
      scheduleMode: "ONE_TIME",
      eventCategoryId: category.id,
      genreSlugs: ["education"],
      discoverySignalIds: ["signal-science-123"],
      format: "HYBRID",
      ageTags: ["5-7"],
      priceFrom: 25,
      scheduleJson: { signals: { interests: ["science", "unknown-custom", "science"] } },
    },
  });
  try {
    for (const eventType of ["ATTENDED", "EXPERIENCE_FEEDBACK"] as const) {
      const enriched = await enrichSemanticEventMeta({
        entityType: "EVENT",
        entityId: activity.id,
        eventType,
        meta: { experienceId: `experience-${marker}` },
      }) as Record<string, unknown>;
      assert.deepEqual(enriched.categoryIds, [category.id]);
      assert.deepEqual(enriched.genreSlugs, ["education"]);
      assert.deepEqual(enriched.signalIds, ["signal-science-123"]);
      assert.equal(enriched.format, "HYBRID");
      assert.deepEqual(enriched.ageRanges, ["5-7"]);
      assert.equal(enriched.priceFrom, 25);
      assert.deepEqual(enriched.interestSlugs, ["science"]);
      assert.doesNotMatch(JSON.stringify(enriched), /unknown-custom/);
    }

    const nonEventMeta = { marker: `unchanged-${marker}` };
    assert.equal(
      await enrichSemanticEventMeta({
        entityType: "PLACE",
        entityId: activity.id,
        eventType: "ATTENDED",
        meta: nonEventMeta,
      }),
      nonEventMeta,
    );
    const completeExisting = {
      categoryIds: [category.id],
      genreSlugs: ["education"],
      signalIds: ["signal-science-123"],
      format: "HYBRID",
    };
    assert.equal(
      await enrichSemanticEventMeta({
        entityType: "EVENT",
        entityId: activity.id,
        eventType: "PLAN_ADD",
        meta: completeExisting,
      }),
      completeExisting,
      "existing strong-event completeness behavior remains unchanged",
    );
  } finally {
    await prisma.activity.delete({ where: { id: activity.id } });
    await prisma.eventCategory.delete({ where: { id: category.id } });
    await prisma.user.delete({ where: { id: owner.id } });
    await prisma.$disconnect();
  }
}

main()
  .then(() => console.log("SemanticEventContextService.outcomes.integration.test.ts: OK"))
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
