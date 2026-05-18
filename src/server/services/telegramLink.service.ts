import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prismaBase } from "@/lib/prisma";
import {
  getTelegramBotProfileUrl,
  getTelegramConfig,
  requireTelegramConfig,
} from "@/server/config/telegram.config";
import { markWelcomeNotificationsRead } from "@/server/services/notification.service";

const TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000;

function getTelegramConnectionDelegate() {
  const delegate = (prismaBase as typeof prismaBase & {
    telegramConnection?: {
      findUnique?: (...args: unknown[]) => Promise<unknown>;
      updateMany?: (...args: unknown[]) => Promise<unknown>;
      upsert?: (...args: unknown[]) => Promise<unknown>;
    };
  }).telegramConnection;

  return delegate ?? null;
}

function isMissingTelegramLinkEnvironmentFieldError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2022" && error.message.includes("environment")) {
      return true;
    }
  }

  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Unknown argument `environment`") ||
    error.message.includes("Unknown field `environment`") ||
    error.message.includes("Unknown select field") && error.message.includes("environment") ||
    error.message.includes("The column `environment` does not exist")
  );
}

function isMissingTelegramConnectionTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

function buildTelegramStartUrl(botUsername: string, token: string): string {
  return `${getTelegramBotProfileUrl(botUsername)}?start=link_${token}`;
}

function buildTelegramStartCommand(token: string): string {
  return `/start link_${token}`;
}

export type CreateTelegramLinkResult = {
  url: string;
  command: string;
  expiresAt: string;
  environment: string;
  botUsername: string;
};

export async function createTelegramLink(params: { userId: string }): Promise<CreateTelegramLinkResult> {
  const config = requireTelegramConfig();
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MS);

  // Clean up expired/unused tokens for this user+environment before creating a new one
  try {
    await prismaBase.telegramLinkToken.deleteMany({
      where: {
        userId: params.userId,
        environment: config.environment,
        usedAt: null,
        expiresAt: { lt: new Date() },
      },
    });
  } catch {
    // Non-fatal: cleanup failure should not block link creation
  }

  try {
    await prismaBase.telegramLinkToken.create({
      data: {
        token,
        userId: params.userId,
        environment: config.environment,
        expiresAt,
      },
    });
  } catch (error) {
    if (!isMissingTelegramLinkEnvironmentFieldError(error)) {
      throw error;
    }

    await prismaBase.$executeRaw`
      INSERT INTO "TelegramLinkToken" ("id", "token", "userId", "expiresAt", "createdAt", "updatedAt")
      VALUES (${randomBytes(12).toString("hex")}, ${token}, ${params.userId}, ${expiresAt}, NOW(), NOW())
    `;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[telegram:link] createTelegramLink userId=%s token=%s expiresAt=%s",
      params.userId, token, expiresAt.toISOString(),
    );
  }

  return {
    url: buildTelegramStartUrl(config.botUsername, token),
    command: buildTelegramStartCommand(token),
    expiresAt: expiresAt.toISOString(),
    environment: config.environment,
    botUsername: config.botUsername,
  };
}

export async function getTelegramLinkStatus(params: { userId: string }) {
  const config = getTelegramConfig();

  if (!config.botUsername) {
    return {
      linked: false,
      username: undefined,
      environment: config.environment,
      botUsername: undefined,
      configured: false,
    };
  }

  const telegramConnection = getTelegramConnectionDelegate();
  if (!telegramConnection?.findUnique) {
    return {
      linked: false,
      username: undefined,
      environment: config.environment,
      botUsername: config.botUsername,
      configured: Boolean(config.botToken && config.botUsername),
    };
  }

  const connection = await (async () => {
    try {
      return await telegramConnection.findUnique({
        where: {
          userId_environment: {
            userId: params.userId,
            environment: config.environment,
          },
        },
        select: {
          isActive: true,
          telegramUsername: true,
          botUsername: true,
        },
      });
    } catch (error) {
      if (!isMissingTelegramConnectionTableError(error)) {
        throw error;
      }

      console.warn(
        "[telegram] TelegramConnection table does not exist yet; returning disconnected status",
      );
      return null;
    }
  })();

  return {
    linked: connection?.isActive === true,
    username: connection?.telegramUsername ?? undefined,
    environment: config.environment,
    botUsername: connection?.botUsername ?? config.botUsername,
    configured: Boolean(config.botToken && config.botUsername),
  };
}

export async function unlinkTelegramAccount(params: { userId: string }) {
  const config = getTelegramConfig();
  const telegramConnection = getTelegramConnectionDelegate();

  if (!telegramConnection?.updateMany) {
    return;
  }

  await prismaBase.$transaction(async (tx) => {
    try {
      await tx.telegramConnection.updateMany({
        where: {
          userId: params.userId,
          environment: config.environment,
        },
        data: {
          isActive: false,
        },
      });
    } catch (error) {
      if (!isMissingTelegramConnectionTableError(error)) {
        throw error;
      }
    }

    try {
      await tx.telegramLinkToken.deleteMany({
        where: {
          userId: params.userId,
          environment: config.environment,
          usedAt: null,
        },
      });
    } catch (error) {
      if (!isMissingTelegramLinkEnvironmentFieldError(error)) {
        throw error;
      }

      await tx.telegramLinkToken.deleteMany({
        where: {
          userId: params.userId,
          usedAt: null,
        },
      });
    }
  });
}

export async function consumeTelegramLinkToken(params: {
  token: string;
  telegramUserId: string;
  telegramChatId: string;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
}) {
  const config = requireTelegramConfig();
  const now = new Date();
  const telegramConnection = getTelegramConnectionDelegate();

  if (!telegramConnection?.upsert) {
    throw new Error(
      "TelegramConnection model is unavailable in the current Prisma client. Restart dev server and regenerate/apply migrations.",
    );
  }

  try {
    await prismaBase.$queryRaw`SELECT 1 FROM "TelegramConnection" LIMIT 1`;
  } catch (error) {
    if (isMissingTelegramConnectionTableError(error)) {
      throw new Error(
        'TelegramConnection table does not exist yet. Run "pnpm db:migrate:dev" and restart the dev server.',
      );
    }
  }

  const linkToken = await (async () => {
    try {
      return await prismaBase.telegramLinkToken.findUnique({
        where: { token: params.token },
        select: {
          id: true,
          userId: true,
          environment: true,
          expiresAt: true,
          usedAt: true,
        },
      });
    } catch (error) {
      if (!isMissingTelegramLinkEnvironmentFieldError(error)) {
        throw error;
      }

      const legacyToken = await prismaBase.telegramLinkToken.findUnique({
        where: { token: params.token },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          usedAt: true,
        },
      });

      if (!legacyToken) return null;

      return {
        ...legacyToken,
        environment: config.environment,
      };
    }
  })();

  if (!linkToken) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[telegram:link] consumeTelegramLinkToken FAIL — token not found (token=%s)",
        params.token,
      );
    }
    return { ok: false as const, reason: "invalid_or_expired" };
  }

  if (linkToken.environment !== config.environment) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[telegram:link] consumeTelegramLinkToken FAIL — environment mismatch: expected=%s actual=%s (token=%s, userId=%s)",
        config.environment, linkToken.environment, params.token, linkToken.userId,
      );
    }
    return { ok: false as const, reason: "invalid_or_expired" };
  }

  if (linkToken.usedAt) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[telegram:link] consumeTelegramLinkToken FAIL — already used (token=%s, userId=%s, usedAt=%s)",
        params.token, linkToken.userId, linkToken.usedAt.toISOString(),
      );
    }
    return { ok: false as const, reason: "invalid_or_expired" };
  }

  if (linkToken.expiresAt <= now) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[telegram:link] consumeTelegramLinkToken FAIL — expired (token=%s, userId=%s, expiresAt=%s)",
        params.token, linkToken.userId, linkToken.expiresAt.toISOString(),
      );
    }
    return { ok: false as const, reason: "invalid_or_expired" };
  }

  await prismaBase.$transaction(async (tx) => {
    await tx.telegramConnection.upsert({
      where: {
        userId_environment: {
          userId: linkToken.userId,
          environment: config.environment,
        },
      },
      create: {
        userId: linkToken.userId,
        environment: config.environment,
        botUsername: config.botUsername,
        telegramUserId: params.telegramUserId,
        telegramChatId: params.telegramChatId,
        telegramUsername: params.telegramUsername ?? null,
        telegramFirstName: params.telegramFirstName ?? null,
        isActive: true,
        linkedAt: now,
        lastInteractionAt: now,
      },
      update: {
        botUsername: config.botUsername,
        telegramUserId: params.telegramUserId,
        telegramChatId: params.telegramChatId,
        telegramUsername: params.telegramUsername ?? null,
        telegramFirstName: params.telegramFirstName ?? null,
        isActive: true,
        linkedAt: now,
        lastInteractionAt: now,
      },
    });

    await tx.telegramLinkToken.update({
      where: { id: linkToken.id },
      data: {
        usedAt: now,
      },
    });

    await tx.user.update({
      where: { id: linkToken.userId },
      data: {
        telegramPromptDismissedAt: null,
      },
    });
  });

  await markWelcomeNotificationsRead(linkToken.userId);

  return { ok: true as const, userId: linkToken.userId };
}
