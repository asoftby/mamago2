import "server-only";

import { Prisma } from "@prisma/client";
import { prismaBase } from "@/lib/prisma";
import { getTelegramConfig } from "@/server/config/telegram.config";

function getTelegramConnectionDelegate() {
  const delegate = (prismaBase as typeof prismaBase & {
    telegramConnection?: {
      findUnique?: (...args: unknown[]) => Promise<unknown>;
      updateMany?: (...args: unknown[]) => Promise<unknown>;
    };
  }).telegramConnection;

  return delegate ?? null;
}

function isMissingTelegramConnectionTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export async function getActiveTelegramConnectionForCurrentEnvironment(userId: string) {
  const config = getTelegramConfig();
  if (!config.botUsername) return null;
  const telegramConnection = getTelegramConnectionDelegate();
  if (!telegramConnection?.findUnique) return null;

  try {
    return await telegramConnection.findUnique({
      where: {
        userId_environment: {
          userId,
          environment: config.environment,
        },
      },
    });
  } catch (error) {
    if (!isMissingTelegramConnectionTableError(error)) {
      throw error;
    }

    console.warn(
      "[telegram] TelegramConnection table does not exist yet; treating connection as missing",
    );
    return null;
  }
}

export async function getTelegramConnectionStatusForCurrentEnvironment(userId: string) {
  const connection = await getActiveTelegramConnectionForCurrentEnvironment(userId);
  const config = getTelegramConfig();

  return {
    linked: connection?.isActive === true,
    username: connection?.telegramUsername ?? undefined,
    botUsername: connection?.botUsername ?? config.botUsername ?? undefined,
    environment: config.environment,
  };
}

export async function findTelegramConnectionByChatIdForCurrentEnvironment(
  telegramChatId: string,
) {
  const config = getTelegramConfig();
  if (!config.botUsername) return null;
  const telegramConnection = getTelegramConnectionDelegate();
  if (!telegramConnection?.findUnique) return null;

  try {
    return await telegramConnection.findUnique({
      where: {
        environment_telegramChatId: {
          environment: config.environment,
          telegramChatId,
        },
      },
    });
  } catch (error) {
    if (!isMissingTelegramConnectionTableError(error)) {
      throw error;
    }

    return null;
  }
}

export async function touchTelegramConnectionByChatIdForCurrentEnvironment(
  telegramChatId: string,
) {
  const config = getTelegramConfig();
  if (!config.botUsername) return;
  const telegramConnection = getTelegramConnectionDelegate();
  if (!telegramConnection?.updateMany) return;

  try {
    await telegramConnection.updateMany({
      where: {
        environment: config.environment,
        telegramChatId,
        isActive: true,
      },
      data: {
        lastInteractionAt: new Date(),
      },
    });
  } catch (error) {
    if (!isMissingTelegramConnectionTableError(error)) {
      throw error;
    }
  }
}
