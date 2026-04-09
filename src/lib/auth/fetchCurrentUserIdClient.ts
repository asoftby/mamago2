"use client";

/**
 * После логина в модалке — получить id пользователя (сессия в cookie).
 * Раньше использовали несуществующий /api/auth/session.
 */
export async function fetchCurrentUserIdAfterAuth(): Promise<string> {
  const res = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : "Сессия не найдена. Обновите страницу и попробуйте снова.",
    );
  }
  if (!data.id) {
    throw new Error("Не удалось получить профиль после входа");
  }
  return data.id;
}
