/** Family Core M5b: pure view helpers for the profile "Семья" block. */

export type MemberRole = "OWNER" | "ADULT";

export function roleLabel(role: MemberRole): string {
  return role === "OWNER" ? "Владелец" : "Взрослый";
}

const ERRORS: Record<string, string> = {
  disabled: "Раздел пока недоступен.",
  limit_reached: "Уже создано 3 приглашения. Отзовите ненужное и попробуйте снова.",
  rate_limited: "Слишком много писем за сутки. Скопируйте ссылку и отправьте её сами.",
  invalid_email: "Проверьте адрес электронной почты.",
  owner_must_transfer: "Сначала передайте роль владельца другому взрослому.",
  last_adult: "Вы единственный взрослый в семье.",
  not_owner: "Передать роль может только владелец.",
  target_not_member: "Этот взрослый уже не в семье.",
  conflict: "Состав семьи изменился. Обновите страницу.",
  not_member: "Вы не состоите в семье.",
  invalid_invite: "Приглашение уже недействительно.",
};

export function familyErrorMessage(code: string | undefined | null): string {
  return (code && ERRORS[code]) || "Не получилось. Попробуйте ещё раз.";
}

export type FamilyActionAvailability = {
  canInvite: boolean;
  canLeave: boolean;
  canTransfer: boolean;
};

/** Which buttons to show. Leave/transfer need ≥2 adults; leave is for ADULT, transfer for OWNER. */
export function familyActions(input: {
  myRole: MemberRole;
  adultsCount: number;
  invitesEnabled: boolean;
}): FamilyActionAvailability {
  const multi = input.adultsCount >= 2;
  return {
    canInvite: input.invitesEnabled,
    canLeave: multi && input.myRole === "ADULT",
    canTransfer: multi && input.myRole === "OWNER",
  };
}

export function adultDisplayName(a: { displayName: string | null; isMe: boolean }): string {
  const n = a.displayName?.trim();
  if (n) return a.isMe ? `${n} (вы)` : n;
  return a.isMe ? "Вы" : "Взрослый";
}
