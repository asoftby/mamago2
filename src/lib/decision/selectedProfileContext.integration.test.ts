import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { buildSelectedProfileContext } from "@/lib/decision/subjects";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at an isolated test database");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const marker = randomUUID();

async function main() {
  const owner = await prisma.user.create({ data: { email: `profile-owner-${marker}@example.invalid` } });
  const stranger = await prisma.user.create({ data: { email: `profile-stranger-${marker}@example.invalid` } });
  try {
    const first = await prisma.child.create({
      data: {
        parentId: owner.id,
        birthDate: new Date("2020-06-01T00:00:00.000Z"),
        birthPrecision: "MONTH",
        systemInterests: { create: [{ interestSlug: "science" }, { interestSlug: "sport" }] },
      },
    });
    const second = await prisma.child.create({
      data: {
        parentId: owner.id,
        birthDate: new Date("2021-06-01T00:00:00.000Z"),
        birthPrecision: "MONTH",
        systemInterests: { create: [{ interestSlug: "science" }] },
      },
    });
    const foreign = await prisma.child.create({
      data: {
        parentId: stranger.id,
        birthDate: new Date("2021-06-01T00:00:00.000Z"),
        birthPrecision: "MONTH",
        systemInterests: { create: [{ interestSlug: "technology" }] },
      },
    });

    const selected = await buildSelectedProfileContext({
      userId: owner.id,
      personaIds: [owner.id, first.id, second.id, first.id, foreign.id],
      targetDate: "2026-10-01",
    });
    assert.deepEqual(selected.systemInterestSlugs, ["science", "sport"]);
    assert.equal(selected.subjects.some((subject) => subject.refId === foreign.id), false);
    assert.equal(selected.subjects.length, 3, "adult plus two owned selected children");

    const free = await buildSelectedProfileContext({
      userId: owner.id,
      personaIds: [],
      targetDate: "2026-10-01",
    });
    assert.deepEqual(free, { subjects: [], systemInterestSlugs: [] });
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } });
    await prisma.$disconnect();
  }
}

main()
  .then(() => console.log("selectedProfileContext.integration.test.ts: OK"))
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
