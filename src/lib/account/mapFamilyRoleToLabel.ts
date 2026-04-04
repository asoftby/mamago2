/** Метки роли в семье (User.familyRole: MOM | DAD | …). Без «use client» — можно вызывать с сервера. */
export function mapFamilyRoleToLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  const m: Record<string, string> = {
    MOM: "Мама",
    DAD: "Папа",
    GRANDMA: "Бабушка",
    GRANDPA: "Дедушка",
    ADULT: "Взрослый",
  };
  return m[role] ?? null;
}
