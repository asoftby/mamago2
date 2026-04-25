/** Одна буква на круглой кнопке профиля (напр. админ-хедер). */
export function accountProfileTriggerLetter(
  displayName: string | null | undefined,
  email: string | undefined,
): string {
  const name = displayName?.trim();
  if (name) {
    return name.charAt(0).toLocaleUpperCase("ru-RU");
  }
  const local = email?.split("@")[0]?.replace(/[._-]+/g, "").trim();
  if (local) return local.charAt(0).toUpperCase();
  return "?";
}

/** Инициалы для меню: из displayName, иначе из локальной части email */
export function userMenuInitials(displayName: string | null | undefined, email: string | undefined): string {
  const name = displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]!.charAt(0);
      const b = parts[parts.length - 1]!.charAt(0);
      return (a + b).toUpperCase();
    }
    const compact = name.replace(/\s+/g, "");
    const slice = compact.slice(0, 2).toUpperCase();
    return slice || "?";
  }
  return userInitialsFromEmail(email);
}

/** Инициалы для аватара в меню аккаунта */
export function userInitialsFromEmail(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "?";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0];
    const b = parts[parts.length - 1]![0];
    return (a + b).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase() || "?";
}
