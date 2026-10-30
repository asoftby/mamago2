import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { planScopeFor } from "./familyAccess";
import { listFamilyForUser } from "./familyMembers.service";
import { listFamilyCalendarItems } from "@/server/services/manualPlanEntry.service";

if (!process.env.DATABASE_URL) throw new Error("Isolated PostgreSQL DATABASE_URL required");
if (process.env.FAMILY_CORE_READS !== "1") throw new Error("FAMILY_CORE_READS=1 required");

// Synthetic users, no production data. All writes are isolated by unique ids.
const tag = randomUUID();
const userIds: string[] = [];
const familyIds: string[] = [];
const joined = new Date("2026-10-20T12:00:00Z");
const before = new Date("2026-10-10T12:00:00Z");
const date = "2026-11-10";
const ids = (rows: Array<{ id: string }>) => rows.map(row => row.id).sort();
const visible = async (userId: string) =>
  ids(await prisma.planItem.findMany({
    where: { ...(await planScopeFor(userId)), date },
    select: { id: true },
  }));

async function main() {
  try {
    const [a, b, outsider] = await Promise.all(
      ["a", "b", "outside"].map(label =>
        prisma.user.create({ data: { email: `family-acl-${tag}-${label}@example.invalid`, displayName: `Family ${label}`, avatarUrl: `https://example.invalid/${label}.png` } }),
      ),
    );
    userIds.push(a.id, b.id, outsider.id);
    const family = await prisma.family.create({ data: { name: `family-acl-${tag}` } });
    const otherFamily = await prisma.family.create({ data: { name: `other-family-${tag}` } });
    familyIds.push(family.id, otherFamily.id);
    await prisma.familyMembership.createMany({ data: [
      { userId: a.id, familyId: family.id, role: "OWNER", historyAccess: "ALL", joinedAt: before },
      { userId: b.id, familyId: family.id, role: "ADULT", historyAccess: "FROM_JOIN", joinedAt: joined },
      { userId: outsider.id, familyId: otherFamily.id, role: "OWNER", historyAccess: "ALL", joinedAt: before },
    ] });
    // Identity is determined by active membership, not inferred from the plan's creator.
    const familyView = await listFamilyForUser(prisma, a.id);
    assert.deepEqual(
      familyView?.adults.map(member => [member.userId, member.displayName, member.avatarUrl, member.isMe]),
      [[a.id, "Family a", "https://example.invalid/a.png", true], [b.id, "Family b", "https://example.invalid/b.png", false]],
      "both adults must resolve to separate named users",
    );
    const create = (userId: string, familyId: string, visibility: "PRIVATE" | "FAMILY", createdAt: Date) =>
      prisma.planItem.create({ data: {
        userId, familyId, visibility, date, createdAt, updatedAt: createdAt,
        source: "MANUAL", entryType: "TASK", title: `acl-${tag}`,
      } });
    const [aPrivate, bPrivate, aShared, bShared, outsiderShared, legacyShared] = await Promise.all([
      create(a.id, family.id, "PRIVATE", joined),
      create(b.id, family.id, "PRIVATE", joined),
      create(a.id, family.id, "FAMILY", joined),
      create(b.id, family.id, "FAMILY", joined),
      create(outsider.id, otherFamily.id, "FAMILY", joined),
      create(a.id, family.id, "FAMILY", before),
    ]);
    const calendarA = await listFamilyCalendarItems({ owner: { userId: a.id }, from: date, to: date });
    const calendarB = await listFamilyCalendarItems({ owner: { userId: b.id }, from: date, to: date });
    assert.ok(!calendarB.some(item => item.id === aPrivate.id), "private creator's entry must stay hidden");
    assert.equal(calendarA.find(item => item.id === bShared.id)?.authorName, "Family b");
    assert.equal(calendarB.find(item => item.id === aShared.id)?.authorName, "Family a");

    // The future date makes legacy shared records visible under FROM_JOIN;
    // test historical restrictions separately using an old event date.
    assert.deepEqual(await visible(a.id), ids([aPrivate, aShared, bShared, legacyShared]));
    assert.deepEqual(await visible(b.id), ids([bPrivate, aShared, bShared, legacyShared]));
    assert.deepEqual(await visible(outsider.id), [outsiderShared.id]);
    // Restrict the older shared item to a date before B joined.
    await prisma.planItem.update({ where: { id: legacyShared.id }, data: { date: "2026-10-10" } });
    const historicalForB = await prisma.planItem.findMany({
      where: { ...(await planScopeFor(b.id)), date: "2026-10-10" },
      select: { id: true },
    });
    assert.ok(!historicalForB.some(row => row.id === legacyShared.id), "FROM_JOIN cannot read old shared history");
    // Leaving the family changes read scope immediately.
    await prisma.familyMembership.updateMany({
      where: { userId: b.id, familyId: family.id, leftAt: null },
      data: { leftAt: new Date() },
    });
    assert.deepEqual(await visible(b.id), [], "departed user cannot read former family's data");
    assert.deepEqual(await visible(a.id), ids([aPrivate, aShared, bShared]), "owner retains family shared entries");
    console.log("Family plan PostgreSQL ACL isolation: passed");
  } finally {
    if (familyIds.length) {
      await prisma.planItem.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyMembership.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
    }
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
