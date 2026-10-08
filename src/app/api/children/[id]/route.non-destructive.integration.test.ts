/**
 * B1 (D05 fix): PUT /api/children/[id] must never wipe interests the caller
 * didn't mention. Exercises the extracted `applyChildUpdate` directly.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx "src/app/api/children/[id]/route.non-destructive.integration.test.ts"
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { applyChildUpdate } from "./route";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
const marker = randomUUID().slice(0, 8);
const userIds: string[] = [];
const childIds: string[] = [];

async function makeUser(): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `nondestructive-${marker}-${randomUUID()}@example.invalid` },
  });
  userIds.push(user.id);
  return user.id;
}

async function makeChildWithInterests(parentId: string): Promise<string> {
  const [sysA, sysB] = SYSTEM_INTERESTS.map((i) => i.slug);
  assert.ok(sysA && sysB, "fixture needs at least 2 catalog interests");
  const child = await prisma.child.create({
    data: {
      name: `NonDestructive ${marker}`,
      birthDate: new Date("2020-05-01"),
      birthPrecision: "DAY",
      parentId,
      systemInterests: { create: [{ interestSlug: sysA }, { interestSlug: sysB }] },
      customInterests: { create: [{ label: `custom-${marker}-1` }, { label: `custom-${marker}-2` }] },
    },
  });
  childIds.push(child.id);
  return child.id;
}

async function readInterests(childId: string) {
  const [systemInterests, customInterests] = await Promise.all([
    prisma.childInterest.findMany({ where: { childId } }),
    prisma.childCustomInterest.findMany({ where: { childId } }),
  ]);
  return { systemInterests, customInterests };
}

async function main() {
  try {
    const owner = await makeUser();

    // ---- Case 1: update birthDate only (omit both interest fields) must not wipe system interests ----
    {
      const childId = await makeChildWithInterests(owner);
      const before = await readInterests(childId);
      assert.equal(before.systemInterests.length, 2, "fixture: 2 system interests before");

      await applyChildUpdate(childId, {
        name: "NonDestructive updated",
        birthPrecision: "MONTH",
        birthYear: 2020,
        birthMonth: 6,
      });

      const after = await readInterests(childId);
      assert.equal(
        after.systemInterests.length,
        before.systemInterests.length,
        "BEFORE: 2 system interests / AFTER birthDate-only update: system interests must survive unchanged",
      );
    }

    // ---- Case 2: update birthDate only must not wipe custom interests ----
    {
      const childId = await makeChildWithInterests(owner);
      const before = await readInterests(childId);
      assert.equal(before.customInterests.length, 2, "fixture: 2 custom interests before");

      await applyChildUpdate(childId, {
        name: "NonDestructive updated",
        birthDate: "2020-06-17",
        birthPrecision: "DAY",
      });

      const after = await readInterests(childId);
      assert.equal(
        after.customInterests.length,
        before.customInterests.length,
        "BEFORE: 2 custom interests / AFTER birthDate-only update: custom interests must survive unchanged",
      );
      const updated = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
      assert.equal(updated.birthPrecision, "DAY", "DAY precision persisted");
      assert.equal(updated.birthDate?.toISOString(), "2020-06-17T00:00:00.000Z");
    }

    // ---- Case 3: update system interests only must not wipe custom interests ----
    {
      const childId = await makeChildWithInterests(owner);
      const before = await readInterests(childId);
      const [sysA] = SYSTEM_INTERESTS.map((i) => i.slug);

      await applyChildUpdate(childId, {
        name: "NonDestructive updated",
        systemInterests: [sysA!],
      });

      const after = await readInterests(childId);
      assert.equal(after.systemInterests.length, 1, "system interests were explicitly replaced with 1");
      assert.equal(
        after.customInterests.length,
        before.customInterests.length,
        "BEFORE: 2 custom interests / AFTER system-interests-only update: custom interests must survive unchanged",
      );
    }

    // ---- Case 4: update custom interests only must not wipe system interests ----
    {
      const childId = await makeChildWithInterests(owner);
      const before = await readInterests(childId);

      await applyChildUpdate(childId, {
        name: "NonDestructive updated",
        customInterests: [`custom-${marker}-replacement`],
      });

      const after = await readInterests(childId);
      assert.equal(after.customInterests.length, 1, "custom interests were explicitly replaced with 1");
      assert.equal(
        after.systemInterests.length,
        before.systemInterests.length,
        "BEFORE: 2 system interests / AFTER custom-interests-only update: system interests must survive unchanged",
      );
    }

    // ---- Case 5: explicit [] genuinely clears (distinguishing omission from explicit-empty) ----
    {
      const childId = await makeChildWithInterests(owner);
      await applyChildUpdate(childId, {
        name: "NonDestructive updated",
        systemInterests: [],
        customInterests: [],
      });
      const after = await readInterests(childId);
      assert.equal(after.systemInterests.length, 0, "explicit [] must actually clear system interests");
      assert.equal(after.customInterests.length, 0, "explicit [] must actually clear custom interests");
    }

    console.log("route.non-destructive.integration.test.ts: OK");
  } finally {
    await prisma.childInterest.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.childCustomInterest.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.child.deleteMany({ where: { id: { in: childIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
