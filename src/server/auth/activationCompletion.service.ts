import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/crypto";
import { hashToken } from "@/lib/auth/tokenHash";

const PURPOSE = "MIGRATED_ACCOUNT_ACTIVATION" as const;
const MAX_TRANSACTION_ATTEMPTS = 3;

export type CompleteActivationResult =
  | { completed: true; userId: string }
  | { completed: false };

class InvalidActivationTokenError extends Error {}

export class ActivationCompletionError extends Error {
  readonly code = "ACTIVATION_UNAVAILABLE";

  constructor() {
    super("ACTIVATION_UNAVAILABLE");
    this.name = "ActivationCompletionError";
  }
}

type ClaimedTokenRow = {
  id: string;
  userId: string;
};

type LockedAccountRow = {
  id: string;
  emailVerifiedAt: Date | null;
};

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code === "P2034") {
    return true;
  }
  return (
    error.code === "P2010" &&
    typeof error.meta === "object" &&
    error.meta !== null &&
    "code" in error.meta &&
    error.meta.code === "40001"
  );
}

export async function completeMigratedAccountActivation(params: {
  token: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  now?: Date;
}): Promise<CompleteActivationResult> {
  const tokenHash = hashToken(params.token);
  const passwordHash = await hashPassword(params.password);
  const now = params.now ?? new Date();

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const accounts = await tx.$queryRaw<LockedAccountRow[]>(Prisma.sql`
            SELECT account."id", account."emailVerifiedAt"
            FROM "User" AS account
            JOIN "UserActionToken" AS token ON token."userId" = account."id"
            WHERE token."tokenHash" = ${tokenHash}
              AND token."purpose" = ${PURPOSE}::"UserActionTokenPurpose"
              AND account."deletedAt" IS NULL
              AND account."status" = 'PENDING_ACTIVATION'::"UserStatus"
            FOR UPDATE OF account
          `);
          const account = accounts[0];
          if (!account || accounts.length !== 1) {
            throw new InvalidActivationTokenError();
          }

          const claimed = await tx.$queryRaw<ClaimedTokenRow[]>(Prisma.sql`
            UPDATE "UserActionToken" AS token
            SET "usedAt" = ${now}
            FROM "User" AS account
            WHERE token."tokenHash" = ${tokenHash}
              AND token."purpose" = ${PURPOSE}::"UserActionTokenPurpose"
              AND token."usedAt" IS NULL
              AND token."invalidatedAt" IS NULL
              AND token."expiresAt" > ${now}
              AND account."id" = token."userId"
              AND account."deletedAt" IS NULL
              AND account."status" = 'PENDING_ACTIVATION'::"UserStatus"
            RETURNING token."id" AS "id", token."userId" AS "userId"
          `);
          const token = claimed[0];
          if (!token || claimed.length !== 1) {
            throw new InvalidActivationTokenError();
          }
          if (token.userId !== account.id) {
            throw new InvalidActivationTokenError();
          }

          const updated = await tx.user.updateMany({
            where: {
              id: token.userId,
              status: "PENDING_ACTIVATION",
              deletedAt: null,
            },
            data: {
              passwordHash,
              status: "ACTIVE",
              emailVerifiedAt: account.emailVerifiedAt ?? now,
            },
          });
          if (updated.count !== 1) {
            throw new InvalidActivationTokenError();
          }

          await tx.userActionToken.updateMany({
            where: {
              userId: token.userId,
              purpose: PURPOSE,
              id: { not: token.id },
              usedAt: null,
              invalidatedAt: null,
            },
            data: { invalidatedAt: now },
          });
          await tx.session.deleteMany({ where: { userId: token.userId } });
          await tx.auditLog.create({
            data: {
              actorId: token.userId,
              targetType: "USER",
              targetId: token.userId,
              action: "MIGRATED_ACCOUNT_ACTIVATION_COMPLETED",
              ipAddress: params.ipAddress,
              userAgent: params.userAgent,
              metadata: { purpose: PURPOSE },
            },
          });

          return { completed: true as const, userId: token.userId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof InvalidActivationTokenError) {
        return { completed: false };
      }
      if (attempt < MAX_TRANSACTION_ATTEMPTS && isSerializationConflict(error)) {
        continue;
      }
      throw new ActivationCompletionError();
    }
  }

  throw new ActivationCompletionError();
}
