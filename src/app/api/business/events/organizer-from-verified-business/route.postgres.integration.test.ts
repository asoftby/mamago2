/**
 * Real API/authorization and PostgreSQL concurrency tests for verified
 * Business -> Organizer selection. Only run on disposable localhost CI DB.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import NodeModule from "node:module";
import { NextRequest } from "next/server";

const dbUrl = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(dbUrl.hostname) &&
  dbUrl.pathname === "/seo_redirect_test", "Requires disposable seo_redirect_test PostgreSQL");

let sessionToken: string | null = null;
const loader = NodeModule as unknown as { _load: (request: string, ...args: unknown[]) => unknown };
const originalLoad = loader._load;
loader._load = function (request, ...args) {
  if (request === "server-only") return {};
  // API handlers must not load the Next.js client router in Node integration tests.
  if (request === "next/navigation") {
    return { redirect: (url: string): never => { throw new Error(`Unexpected redirect in API test: ${url}`); } };
  }
  if (request === "next/headers") {
    return { cookies: async () => ({ get: () => sessionToken ? { value: sessionToken } : undefined }) };
  }
  return originalLoad.apply(this, [request, ...args]);
};

async function main() {
  const db = (await import("@/lib/prisma")).default;
  const { createSession } = await import("@/lib/auth/session");
  const { POST } = await import("./route");
  const { GET } = await import("@/app/api/admin/organizers/route");
  const marker = randomUUID().slice(0, 12);
  const userIds: string[] = [];
  const businessIds: string[] = [];
  let createdOrganizerId: string | null = null;

  const user = async (role: "USER" | "ADMIN" = "USER") => {
    const u = await db.user.create({ data: { email: `organizer-${marker}-${userIds.length}@example.test`, role } });
    userIds.push(u.id);
    return u;
  };
  const business = async (ownerUserId: string, name: string, status: "APPROVED" | "PENDING" = "APPROVED",
    operation: "ACTIVE" | "DISABLED" = "ACTIVE", unp?: string) => {
    const row = await db.business.create({
      data: { ownerUserId, name, unp, verificationStatus: status, operationalStatus: operation },
    });
    businessIds.push(row.id);
    return row;
  };
  const body = (businessId: unknown) => new NextRequest("http://localhost/api/business/events/organizer-from-verified-business", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessId }),
  });
  const search = (query: string) => new NextRequest(
    `http://localhost/api/admin/organizers?query=${encodeURIComponent(query)}&limit=20`,
  );

  try {
    const owner = await user();
    const manager = await user();
    const outsider = await user();
    const admin = await user("ADMIN");
    const primary = await business(owner.id, "Organizer primary " + marker);
    const pending = await business((await user()).id, "Pending " + marker, "PENDING");
    const disabled = await business((await user()).id, "Disabled " + marker, "APPROVED", "DISABLED");
    const noUnp = await business((await user()).id, "Verified without UNP " + marker);
    await db.businessMember.createMany({ data: [
      { userId: owner.id, businessId: primary.id, role: "OWNER", isActive: true },
      { userId: manager.id, businessId: primary.id, role: "MANAGER", isActive: true },
    ] });

    // Actual handler: unauthenticated and unrelated user must not write.
    sessionToken = null;
    assert.equal((await POST(body(noUnp.id))).status, 401);
    sessionToken = await createSession(outsider.id);
    assert.equal((await POST(body(noUnp.id))).status, 403);
    assert.equal(await db.organizer.count({ where: { linkedBusinessId: noUnp.id } }), 0);

    sessionToken = await createSession(owner.id);
    const listed = await GET(search(marker));
    assert.equal(listed.status, 200);
    const names = ((await listed.json()) as { organizers: Array<{ name: string }> }).organizers.map(x => x.name);
    assert.ok(names.some(x => x.includes("Verified without UNP")), "approved ACTIVE business searchable");
    assert.ok(!names.some(x => x.startsWith("Pending ")), "unapproved hidden");
    assert.ok(!names.some(x => x.startsWith("Disabled ")), "disabled hidden");

    for (const disallowed of [pending.id, disabled.id]) {
      assert.equal((await POST(body(disallowed))).status, 404, "no organizer for unapproved/inactive Business");
      assert.equal(await db.organizer.count({ where: { linkedBusinessId: disallowed } }), 0);
    }
    assert.equal((await POST(body(""))).status, 400);

    // Parallel real POSTs serialize on the Business row, even without UNP.
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => POST(body(noUnp.id))));
    assert.ok(concurrent.every(r => r.status === 200), "parallel selections succeed");
    const ids = await Promise.all(concurrent.map(async r => ((await r.json()) as { organizer: { id: string } }).organizer.id));
    assert.equal(new Set(ids).size, 1, "all requests reuse one Organizer ID");
    createdOrganizerId = ids[0];
    assert.equal(await db.organizer.count({ where: { linkedBusinessId: noUnp.id } }), 1);
    assert.equal((await POST(body(noUnp.id))).status, 200, "idempotent repeat");

    // Active MANAGER with platform USER role has the same permission.
    sessionToken = await createSession(manager.id);
    const managerResult = await POST(body(noUnp.id));
    assert.equal(managerResult.status, 200);
    assert.equal(((await managerResult.json()) as { organizer: { id: string } }).organizer.id, ids[0]);

    await db.businessMember.updateMany({ where: { userId: manager.id, businessId: primary.id },
      data: { isActive: false } });
    assert.equal((await POST(body(noUnp.id))).status, 403, "inactive manager denied");
    sessionToken = await createSession(admin.id);
    assert.equal((await POST(body(noUnp.id))).status, 200, "editorial ADMIN allowed");

    // Existing Organizer with the same UNP is adopted, not duplicated.
    sessionToken = await createSession(owner.id);
    const legalUnp = String(100000000 + Math.floor(Math.random() * 800000000));
    const withUnp = await business((await user()).id, "Verified linked " + marker, "APPROVED", "ACTIVE", legalUnp);
    const legacy = await db.organizer.create({ data: { name: "Legacy " + marker, unp: legalUnp, createdFrom: "MANUAL" } });
    const adopted = await POST(body(withUnp.id));
    assert.equal(adopted.status, 200);
    assert.equal(((await adopted.json()) as { organizer: { id: string } }).organizer.id, legacy.id);
    const row = await db.organizer.findUniqueOrThrow({ where: { id: legacy.id } });
    assert.equal(row.linkedBusinessId, withUnp.id);
    assert.equal(await db.organizer.count({ where: { unp: legalUnp } }), 1);
    console.log("Verified organizer API auth, eligibility, no-UNP concurrency and dedup: PASS");
  } finally {
    sessionToken = null;
    if (businessIds.length) await db.organizer.deleteMany({ where: { linkedBusinessId: { in: businessIds } } });
    if (createdOrganizerId) await db.organizer.deleteMany({ where: { id: createdOrganizerId } });
    await db.session.deleteMany({ where: { userId: { in: userIds } } });
    await db.businessMember.deleteMany({ where: { userId: { in: userIds } } });
    await db.business.deleteMany({ where: { id: { in: businessIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
