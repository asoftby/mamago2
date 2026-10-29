import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { canAccessBusiness } from "@/server/permissions/business-permissions";

if (!process.env.DATABASE_URL) throw new Error("Isolated PostgreSQL database required");
const tag = randomUUID();
const userIds: string[] = [];
const businessIds: string[] = [];
const threadIds: string[] = [];

async function main() {
  try {
    const [ownerA, ownerB, outsider] = await Promise.all(
      ["a", "b", "outsider"].map(name =>
        prisma.user.create({ data: { email: `support-acl-${tag}-${name}@example.invalid` } }),
      ),
    );
    userIds.push(ownerA.id, ownerB.id, outsider.id);
    const a = await prisma.business.create({ data: { name: "Support A", ownerUserId: ownerA.id } });
    const b = await prisma.business.create({ data: { name: "Support B", ownerUserId: ownerB.id } });
    businessIds.push(a.id, b.id);
    await prisma.businessMember.createMany({ data: [
      { businessId: a.id, userId: ownerA.id, role: "OWNER", isActive: true },
      { businessId: b.id, userId: ownerB.id, role: "OWNER", isActive: true },
    ] });
    const thread = await prisma.supportThread.create({ data: {
      businessId: a.id, createdById: ownerA.id, subject: "ACL test",
      messages: { create: { authorId: ownerA.id, actor: "BUSINESS", body: "Test" } },
    } });
    threadIds.push(thread.id);
    assert.equal(await canAccessBusiness(ownerA.id, a.id), true);
    assert.equal(await canAccessBusiness(ownerB.id, a.id), false);
    assert.equal(await canAccessBusiness(outsider.id, a.id), false);
    const rowsForB = await prisma.supportThread.findMany({
      where: { businessId: { in: [b.id] } }, select: { id: true },
    });
    assert.ok(!rowsForB.some(row => row.id === thread.id), "B must not read A's thread");
    const message = await prisma.supportMessage.findFirst({
      where: { threadId: thread.id }, select: { actor: true, authorId: true },
    });
    assert.equal(message?.actor, "BUSINESS");
    assert.equal(message?.authorId, ownerA.id);
    await prisma.businessMember.update({
      where: { businessId_userId: { businessId: a.id, userId: ownerA.id } },
      data: { isActive: false },
    });
    assert.equal(await canAccessBusiness(ownerA.id, a.id), false, "revoked member loses access");
    console.log("Support cross-business PostgreSQL isolation: passed");
  } finally {
    if (threadIds.length) await prisma.supportThread.deleteMany({ where: { id: { in: threadIds } } });
    if (businessIds.length) {
      await prisma.businessMember.deleteMany({ where: { businessId: { in: businessIds } } });
      await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
    }
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
