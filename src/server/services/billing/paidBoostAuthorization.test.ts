import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  canPurchasePaidBoost,
  assertPaidBoostPurchaserInTx,
  PaidBoostMembershipRequiredError,
} from "./paidBoostAuthorization";

type Member = { businessId: string; userId: string; role: "OWNER" | "MANAGER"; isActive: boolean };
type Business = { id: string; operationalStatus: "ACTIVE" | "SUSPENDED"; members: Member[] };

function dbFor(businesses: Business[]) {
  const db = {
    business: {
      findFirst: async ({ where }: { where: Prisma.BusinessWhereInput }) => {
        const id = where.id as string;
        const status = where.operationalStatus;
        const condition = (where.members as { some: { userId: string; isActive: boolean; role: { in: string[] } } }).some;
        const business = businesses.find((item) =>
          item.id === id &&
          item.operationalStatus === status &&
          item.members.some((member) =>
            member.businessId === id &&
            member.userId === condition.userId &&
            member.isActive === condition.isActive &&
            condition.role.in.includes(member.role),
          ),
        );
        return business ? { id: business.id } : null;
      },
    },
  };
  return db as unknown as Prisma.TransactionClient;
}

const ACTIVE_BUSINESS: Business = {
  id: "business-a",
  operationalStatus: "ACTIVE",
  members: [
    { businessId: "business-a", userId: "owner", role: "OWNER", isActive: true },
    { businessId: "business-a", userId: "manager", role: "MANAGER", isActive: true },
    { businessId: "business-a", userId: "disabled-manager", role: "MANAGER", isActive: false },
  ],
};

test("paid Boost: OWNER and MANAGER of active business may purchase", async () => {
  const db = dbFor([ACTIVE_BUSINESS]);
  assert.equal(await canPurchasePaidBoost("owner", "business-a", db), true);
  assert.equal(await canPurchasePaidBoost("manager", "business-a", db), true);
  await assert.doesNotReject(assertPaidBoostPurchaserInTx(db, "business-a", "manager"));
});

test("paid Boost: unrelated, inactive or missing actors cannot purchase or replay", async () => {
  const db = dbFor([ACTIVE_BUSINESS]);
  for (const userId of ["disabled-manager", "outsider", ""]) {
    assert.equal(await canPurchasePaidBoost(userId, "business-a", db), false);
    await assert.rejects(
      assertPaidBoostPurchaserInTx(db, "business-a", userId),
      PaidBoostMembershipRequiredError,
    );
  }
});

test("paid Boost: cross-business and operationally inactive business are denied", async () => {
  const inactive = { ...ACTIVE_BUSINESS, id: "business-b", operationalStatus: "SUSPENDED" as const,
    members: [{ businessId: "business-b", userId: "owner", role: "OWNER" as const, isActive: true }] };
  const db = dbFor([ACTIVE_BUSINESS, inactive]);
  assert.equal(await canPurchasePaidBoost("manager", "business-b", db), false);
  assert.equal(await canPurchasePaidBoost("owner", "business-b", db), false);
  assert.equal(await canPurchasePaidBoost("owner", "unknown-business", db), false);
  await assert.rejects(
    assertPaidBoostPurchaserInTx(db, "business-b", "owner"),
    PaidBoostMembershipRequiredError,
  );
});
