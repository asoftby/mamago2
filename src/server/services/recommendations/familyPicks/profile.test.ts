import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { childScopeWhere, familyReadsEnabled } from "@/server/family/familyScope";
import { loadFamilyPicksProfile, familyPicksProfileContext, type FamilyPicksProfileChild } from "./profile";

const child: FamilyPicksProfileChild = {
  id: "child_0001", name: "Ребёнок", birthDate: new Date("2020-06-01Z"), birthPrecision: "MONTH",
  systemInterests: [{ interestSlug: "science" }],
};

test("guest needs neither ACL nor child query", async () => {
  const fail = async (): Promise<never> => { throw new Error("must not query"); };
  assert.deepEqual(await loadFamilyPicksProfile(null, { childScopeFor: fail, findChildren: fail }), {
    userId: null, audience: "guest", children: [],
  });
});

test("audience depends on DOB presence, keeps incomplete children and MONTH precision", async () => {
  for (const children of [[], [{ ...child, birthDate: null, birthPrecision: null }], [child, { ...child, id: "child_0002", birthDate: null }]]) {
    const profile = await loadFamilyPicksProfile("account_a", {
      childScopeFor: async () => ({ parentId: "account_a" }), findChildren: async () => children,
    });
    assert.equal(profile.audience, children.some(c => c.birthDate) ? "personalized" : "no_child_with_DOB");
    assert.deepEqual(profile.children, children);
    const context = familyPicksProfileContext(profile);
    assert.equal(context.accountId, "account_a");
    assert.equal(context.selectionApplied, false);
    assert.ok(context.children.every(c => !("birthDate" in c) && !("systemInterests" in c)));
    if (children[0]?.birthDate) assert.equal(context.children[0]?.birthPrecision, "MONTH");
  }
});

test("passes existing family ACL verbatim: reads off/on, no family, changed membership", async () => {
  for (const [flag, familyId, expected] of [
    ["0", "family_a", { parentId: "account_a" }],
    ["1", "family_a", { familyId: "family_a" }],
    ["true", null, { id: { in: [] } }],
    ["1", "family_b", { familyId: "family_b" }],
  ] as const) {
    const profile = await loadFamilyPicksProfile("account_a", {
      childScopeFor: async userId => childScopeWhere({ userId, familyId }, familyReadsEnabled({ FAMILY_CORE_READS: flag })),
      findChildren: async where => {
        assert.deepEqual(where, expected);
        return familyId === "family_a" ? [child] : [];
      },
    });
    assert.equal(profile.children.length, familyId === "family_a" ? 1 : 0);
  }
});

test("no snapshot is reused after account change or deletion", async () => {
  let rows = [child];
  const deps = { childScopeFor: async (userId: string) => ({ parentId: userId }), findChildren: async () => rows };
  const first = await loadFamilyPicksProfile("account_a", deps);
  rows = [];
  const next = await loadFamilyPicksProfile("account_b", deps);
  assert.equal(first.audience, "personalized");
  assert.deepEqual(next, { userId: "account_b", audience: "no_child_with_DOB", children: [] });
  assert.equal((await loadFamilyPicksProfile("account_a", deps)).children.length, 0);
});

test("ACL and DB errors propagate, never produce an empty-profile fallback", async () => {
  const fail = async (): Promise<never> => { throw new Error("unavailable"); };
  await assert.rejects(loadFamilyPicksProfile("account_a", { childScopeFor: fail, findChildren: async () => [] }), /unavailable/);
  await assert.rejects(loadFamilyPicksProfile("account_a", { childScopeFor: async () => ({}), findChildren: fail }), /unavailable/);
});

// Exercise the production childScopeFor binding with stubbed Prisma I/O, not a second ACL.
test("production profile query follows active membership and never legacy parent ownership when reads are on", async () => {
  const previous = process.env.FAMILY_CORE_READS;
  let familyId: string | null = "family_a";
  const originalMembership = prisma.familyMembership.findFirst;
  const originalChildren = prisma.child.findMany;
  let membershipCalls = 0;
  prisma.familyMembership.findFirst = (async () => {
    membershipCalls += 1;
    return familyId ? { familyId, historyAccess: "ALL", joinedAt: new Date("2026-01-01Z") } : null;
  }) as unknown as typeof prisma.familyMembership.findFirst;
  let expectedWhere: unknown;
  prisma.child.findMany = (async (args: { where: unknown; select: { birthPrecision?: boolean } }) => {
    assert.deepEqual(args.where, expectedWhere);
    assert.equal(args.select.birthPrecision, true);
    return familyId === "family_a" ? [child] : [];
  }) as unknown as typeof prisma.child.findMany;
  try {
    process.env.FAMILY_CORE_READS = "0";
    expectedWhere = { parentId: "account_a" };
    assert.equal((await loadFamilyPicksProfile("account_a")).audience, "personalized");
    assert.equal(membershipCalls, 0);
    process.env.FAMILY_CORE_READS = "1";
    expectedWhere = { familyId: "family_a" };
    assert.equal((await loadFamilyPicksProfile("account_a")).children.length, 1);
    familyId = "family_b";
    expectedWhere = { familyId: "family_b" };
    assert.deepEqual((await loadFamilyPicksProfile("account_b")).children, []);
    familyId = null;
    expectedWhere = { id: { in: [] } };
    assert.equal((await loadFamilyPicksProfile("account_a")).audience, "no_child_with_DOB");
  } finally {
    prisma.familyMembership.findFirst = originalMembership;
    prisma.child.findMany = originalChildren;
    if (previous === undefined) delete process.env.FAMILY_CORE_READS;
    else process.env.FAMILY_CORE_READS = previous;
  }
});
