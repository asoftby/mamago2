import { Prisma, type UserActionTokenPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateRawToken, hashToken } from "@/lib/auth/tokenHash";

export const MIGRATED_ACCOUNT_ACTIVATION_TOKEN_TTL_MS = 60 * 60 * 1000;
export const ISSUE_TRANSACTION_MAX_ATTEMPTS = 3;

const MIGRATED_ACCOUNT_ACTIVATION_PURPOSE = "MIGRATED_ACCOUNT_ACTIVATION";

export type UserActionTokenClock = {
  now: () => Date;
};

const SYSTEM_CLOCK: UserActionTokenClock = {
  now: () => new Date(),
};

export type IssueUserActionTokenResult = {
  id: string;
  token: string;
  expiresAt: Date;
};

export type ConsumeUserActionTokenResult =
  | {
      consumed: true;
      tokenId: string;
      userId: string;
      usedAt: Date;
    }
  | { consumed: false };

export class UserActionTokenIssueError extends Error {
  readonly code = "USER_ACTION_TOKEN_UNAVAILABLE";

  constructor() {
    super("USER_ACTION_TOKEN_UNAVAILABLE");
    this.name = "UserActionTokenIssueError";
  }
}

export class UserActionTokenServiceError extends Error {
  readonly code = "USER_ACTION_TOKEN_UNAVAILABLE";

  constructor() {
    super("USER_ACTION_TOKEN_UNAVAILABLE");
    this.name = "UserActionTokenServiceError";
  }
}

function isSupportedPurpose(
  purpose: UserActionTokenPurpose,
): purpose is typeof MIGRATED_ACCOUNT_ACTIVATION_PURPOSE {
  return purpose === MIGRATED_ACCOUNT_ACTIVATION_PURPOSE;
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/**
 * Issues a raw token exactly once to the caller while persisting only its hash.
 * Any previous unresolved token for the same user and purpose is invalidated.
 */
export async function issueUserActionToken(
  params: {
    userId: string;
    purpose: UserActionTokenPurpose;
  },
  options: {
    clock?: UserActionTokenClock;
  } = {},
): Promise<IssueUserActionTokenResult> {
  if (!isSupportedPurpose(params.purpose)) {
    throw new UserActionTokenIssueError();
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const now = (options.clock ?? SYSTEM_CLOCK).now();
  const expiresAt = new Date(
    now.getTime() + MIGRATED_ACCOUNT_ACTIVATION_TOKEN_TTL_MS,
  );

  for (let attempt = 1; attempt <= ISSUE_TRANSACTION_MAX_ATTEMPTS; attempt += 1) {
    try {
      const tokenId = await prisma.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: params.userId },
            select: { status: true, deletedAt: true },
          });

          if (
            !user ||
            user.deletedAt !== null ||
            user.status !== "PENDING_ACTIVATION"
          ) {
            throw new UserActionTokenIssueError();
          }

          await tx.userActionToken.updateMany({
            where: {
              userId: params.userId,
              purpose: params.purpose,
              usedAt: null,
              invalidatedAt: null,
            },
            data: { invalidatedAt: now },
          });

          const created = await tx.userActionToken.create({
            data: {
              userId: params.userId,
              purpose: params.purpose,
              tokenHash,
              expiresAt,
            },
            select: { id: true },
          });

          await tx.adminAuditLog.create({
            data: {
              actorId: null,
              actorRole: "SYSTEM",
              action: "MIGRATED_ACCOUNT_ACTIVATION_TOKEN_ISSUED",
              entityType: "USER",
              entityId: params.userId,
              metadata: {
                purpose: params.purpose,
                expiresAt: expiresAt.toISOString(),
              },
            },
          });

          return created.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return { id: tokenId, token: rawToken, expiresAt };
    } catch (error) {
      if (attempt < ISSUE_TRANSACTION_MAX_ATTEMPTS && isRetryableTransactionError(error)) {
        continue;
      }
      if (error instanceof UserActionTokenIssueError) {
        throw error;
      }
      throw new UserActionTokenIssueError();
    }
  }

  throw new UserActionTokenIssueError();
}

/** Invalidates every unresolved token for a user/purpose without deleting history. */
export async function invalidateUserActionTokens(
  params: {
    userId: string;
    purpose: UserActionTokenPurpose;
  },
  options: {
    clock?: UserActionTokenClock;
  } = {},
): Promise<number> {
  if (!isSupportedPurpose(params.purpose)) {
    return 0;
  }

  const result = await prisma.userActionToken.updateMany({
    where: {
      userId: params.userId,
      purpose: params.purpose,
      usedAt: null,
      invalidatedAt: null,
    },
    data: { invalidatedAt: (options.clock ?? SYSTEM_CLOCK).now() },
  });

  return result.count;
}

type ConsumedTokenRow = {
  id: string;
  userId: string;
  usedAt: Date;
};

/**
 * Atomically consumes a live token. The conditional UPDATE is the single-use
 * boundary: concurrent callers cannot both transition usedAt from NULL.
 */
export async function consumeUserActionToken(
  params: {
    token: string;
    purpose: UserActionTokenPurpose;
  },
  options: {
    clock?: UserActionTokenClock;
  } = {},
): Promise<ConsumeUserActionTokenResult> {
  if (!isSupportedPurpose(params.purpose)) {
    return { consumed: false };
  }

  const tokenHash = hashToken(params.token);
  const usedAt = (options.clock ?? SYSTEM_CLOCK).now();
  let rows: ConsumedTokenRow[];

  try {
    rows = await prisma.$queryRaw<ConsumedTokenRow[]>(Prisma.sql`
      UPDATE "UserActionToken" AS token
      SET "usedAt" = ${usedAt}
      FROM "User" AS account
      WHERE token."tokenHash" = ${tokenHash}
        AND token."purpose" = CAST(${params.purpose} AS "UserActionTokenPurpose")
        AND token."usedAt" IS NULL
        AND token."invalidatedAt" IS NULL
        AND token."expiresAt" > ${usedAt}
        AND account."id" = token."userId"
        AND account."deletedAt" IS NULL
        AND account."status" = 'PENDING_ACTIVATION'::"UserStatus"
      RETURNING token."id" AS "id", token."userId" AS "userId", token."usedAt" AS "usedAt"
    `);
  } catch {
    throw new UserActionTokenServiceError();
  }

  const consumed = rows[0];
  if (!consumed) {
    return { consumed: false };
  }
  if (
    rows.length !== 1 ||
    typeof consumed.id !== "string" ||
    typeof consumed.userId !== "string" ||
    !(consumed.usedAt instanceof Date)
  ) {
    throw new UserActionTokenServiceError();
  }

  return {
    consumed: true,
    tokenId: consumed.id,
    userId: consumed.userId,
    usedAt: consumed.usedAt,
  };
}
