import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { listFamilyForUser } from "./familyMembers.service";

function fakeDb() {
  const calls: string[] = [];
  const db = {
    familyMembership: {
      findFirst: async () => (calls.push("membership.findFirst"), { familyId: "f1", role: "OWNER" }),
      findMany: async () => (
        calls.push("membership.findMany"),
        [{ userId: "u1", role: "OWNER", joinedAt: new Date(), user: { displayName: "A", avatarUrl: null } }]
      ),
    },
    child: { findMany: async () => (calls.push("child.findMany"), [{ id: "c1", name: "S", birthDate: null }]) },
    familyInvite: { findMany: async () => (calls.push("invite.findMany"), []) },
  };
  return { db: db as unknown as PrismaClient, calls };
}

const env = { FAMILY_CORE_READS: "1" };

async function main() {
  const withKids = fakeDb();
  const full = await listFamilyForUser(withKids.db, "u1", { env });
  assert.ok(withKids.calls.includes("child.findMany"), "children loaded by default (/me/profile)");
  assert.equal(full?.children.length, 1);

  const noKids = fakeDb();
  const light = await listFamilyForUser(noKids.db, "u1", { env, includeChildren: false });
  assert.ok(!noKids.calls.includes("child.findMany"), "no Child query when includeChildren=false");
  assert.deepEqual(light?.children, []);
  assert.equal(light?.adults.length, 1, "adults still loaded");
  assert.ok(noKids.calls.includes("invite.findMany"), "invites still loaded");
  console.log("familyMembersNoChildren.test: ok");
}
void main();
