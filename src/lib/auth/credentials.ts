import type { UserStatus } from "@prisma/client";
import {
  isVerifiablePasswordHash,
  verifyPassword,
} from "@/lib/auth/crypto";
import { isSessionEligibleAccount } from "@/lib/auth/accountEligibility";

// A valid bcrypt hash keeps unknown/ineligible-account timing close to a real login.
// The source phrase is intentionally irrelevant: a successful comparison is ignored
// unless the queried account is independently eligible and owns the selected hash.
const DUMMY_PASSWORD_HASH =
  "$2b$12$R5Yz2SBZsnL.VYS91wTUBuW2CGkeMsfnqr192QrKQWSIM677luKoG";

export type CredentialsAccount = {
  status: UserStatus;
  deletedAt: Date | null;
  passwordHash: string | null;
};

/**
 * Constant-work credential check for known, unknown, pending, and disabled users.
 * Account eligibility is authoritative regardless of the stored password value.
 */
export async function verifyLoginPassword(
  password: string,
  account: CredentialsAccount | null,
  verifier: (password: string, hash: string) => Promise<boolean> = verifyPassword,
): Promise<boolean> {
  const eligible = account !== null && isSessionEligibleAccount(account);
  const usesRealHash = Boolean(
    eligible && account.passwordHash && isVerifiablePasswordHash(account.passwordHash),
  );
  const usableHash = usesRealHash ? account!.passwordHash! : DUMMY_PASSWORD_HASH;
  const matches = await verifier(password, usableHash);
  return eligible && usesRealHash && matches;
}
