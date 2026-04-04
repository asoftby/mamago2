import { hashToken } from "@/lib/auth/crypto";
import { getSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * Id записи Session по cookie (для корреляции событий авторизованного пользователя).
 */
export async function getSessionRowIdFromCookies(): Promise<string | null> {
  try {
    const token = await getSessionToken();
    if (!token) return null;
    const tokenHash = hashToken(token);
    const row = await prisma.session.findUnique({
      where: { tokenHash },
      select: { id: true },
    });
    return row?.id ?? null;
  } catch {
    return null;
  }
}
