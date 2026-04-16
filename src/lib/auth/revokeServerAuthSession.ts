import {
  deleteSession,
  deleteSessionCookieAction,
  getSessionToken,
} from "@/lib/auth/session";

/** Удаляет сессию в БД и чистит httpOnly cookie (единая точка для logout). */
export async function revokeServerAuthSession(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    await deleteSession(token).catch(() => {
      /* ignore */
    });
  }
  await deleteSessionCookieAction();
}
