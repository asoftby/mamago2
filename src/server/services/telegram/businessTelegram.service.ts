import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prismaBase } from "@/lib/prisma";
import { getBusinessTelegramConfig } from "@/server/config/businessTelegram.config";
import { getMyBusiness } from "@/server/business/getMyBusiness";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export const businessTelegramStatus = async (userId: string) => {
  const config = getBusinessTelegramConfig();
  const business = await getMyBusiness(userId);
  if (!business) return null;
  const connection = await prismaBase.businessTelegramConnection.findUnique({
    where: { userId_environment: { userId, environment: config.environment } },
  });
  return { linked: connection?.isActive === true && connection.businessId === business.id,
    configured: config.configured, botUsername: config.botUsername || undefined,
    username: connection?.telegramUsername || undefined };
};

export async function createBusinessTelegramLink(userId: string) {
  const config = getBusinessTelegramConfig();
  if (!config.configured) throw new Error("Business Telegram bot is not configured");
  const business = await getMyBusiness(userId);
  if (!business) throw new Error("Business access required");
  const token = randomBytes(24).toString("hex");
  await prismaBase.businessTelegramLinkToken.create({
    data: { userId, businessId: business.id, tokenHash: hash(token),
      environment: config.environment, expiresAt: new Date(Date.now() + 15 * 60_000) },
  });
  return { url: `https://t.me/${config.botUsername}?start=business_${token}`,
    botUsername: config.botUsername, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() };
}

export async function consumeBusinessTelegramLink(token: string, actor: {
  chatId: string; telegramUserId: string; username?: string;
}) {
  if (!/^[a-f0-9]{48}$/.test(token) || !/^\d+$/.test(actor.chatId) ||
      actor.chatId !== actor.telegramUserId) return false;
  const config = getBusinessTelegramConfig();
  const tokenHash = hash(token);
  const now = new Date();
  return prismaBase.$transaction(async tx => {
    const link = await tx.businessTelegramLinkToken.findUnique({ where: { tokenHash } });
    if (!link || link.environment !== config.environment || link.usedAt || link.expiresAt <= now) return false;
    // Re-check membership at consumption, not only at link issuance.
    const member = await tx.businessMember.findFirst({
      where: { businessId: link.businessId, userId: link.userId, role: { in: ["OWNER", "MANAGER"] } },
      select: { id: true },
    });
    const owner = await tx.business.findFirst({ where: { id: link.businessId, ownerUserId: link.userId }, select: { id: true } });
    if (!member && !owner) return false;
    const updated = await tx.businessTelegramLinkToken.updateMany({
      where: { id: link.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now },
    });
    if (updated.count !== 1) return false;
    await tx.businessTelegramConnection.upsert({
      where: { userId_environment: { userId: link.userId, environment: config.environment } },
      create: { businessId: link.businessId, userId: link.userId, environment: config.environment,
        botUsername: config.botUsername, telegramUserId: actor.telegramUserId,
        telegramChatId: actor.chatId, telegramUsername: actor.username },
      update: { businessId: link.businessId, botUsername: config.botUsername,
        telegramUserId: actor.telegramUserId, telegramChatId: actor.chatId,
        telegramUsername: actor.username, isActive: true, linkedAt: now },
    });
    return true;
  });
}

export async function disconnectBusinessTelegram(userId: string) {
  const business = await getMyBusiness(userId);
  if (!business) return false;
  const { environment } = getBusinessTelegramConfig();
  await prismaBase.$transaction([
    prismaBase.businessTelegramConnection.updateMany({
      where: { userId, businessId: business.id, environment }, data: { isActive: false },
    }),
    prismaBase.businessTelegramLinkToken.deleteMany({
      where: { userId, businessId: business.id, environment, usedAt: null },
    }),
  ]);
  return true;
}
