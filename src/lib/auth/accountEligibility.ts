import type { UserStatus } from "@prisma/client";

export type AccountEligibilityInput = {
  status: UserStatus;
  deletedAt: Date | null;
};

/** Statuses that may create and retain an authenticated application session. */
export function isSessionEligibleStatus(status: UserStatus): boolean {
  return status === "ACTIVE" || status === "LIMITED";
}

export function isSessionEligibleAccount(account: AccountEligibilityInput): boolean {
  return account.deletedAt === null && isSessionEligibleStatus(account.status);
}
