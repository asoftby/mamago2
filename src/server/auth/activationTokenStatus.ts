import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokenHash";

const PURPOSE = "MIGRATED_ACCOUNT_ACTIVATION" as const;

export type ActivationTokenStatus =
  | "VALID"
  | "EXPIRED"
  | "USED"
  | "INVALID"
  | "ALREADY_ACTIVE";

/**
 * Read-only lookup for the `/activate` page's initial state — never
 * consumes the token (`usedAt` is never written here) and never returns
 * anything about the account beyond its own lifecycle bucket (no email,
 * no id, no name). Lets the page distinguish "expired" from "already used"
 * from "invalid" from "already activated" before asking for a password —
 * `completeMigratedAccountActivation` deliberately stays generic on
 * failure (anti-oracle for the *consuming* action); this is a separate,
 * lower-stakes read that mirrors what a password-reset page commonly shows.
 */
export async function checkActivationTokenStatus(token: string): Promise<ActivationTokenStatus> {
  const tokenHash = hashToken(token);
  const row = await prisma.userActionToken.findUnique({
    where: { tokenHash },
    select: {
      purpose: true,
      usedAt: true,
      invalidatedAt: true,
      expiresAt: true,
      user: { select: { status: true, deletedAt: true } },
    },
  });

  if (!row || row.purpose !== PURPOSE) return "INVALID";
  if (row.invalidatedAt !== null) return "INVALID";
  if (row.usedAt !== null) return "USED";
  if (!row.user || row.user.deletedAt !== null) return "INVALID";
  if (row.user.status === "ACTIVE") return "ALREADY_ACTIVE";
  if (row.user.status !== "PENDING_ACTIVATION") return "INVALID";
  if (row.expiresAt.getTime() <= Date.now()) return "EXPIRED";
  return "VALID";
}
