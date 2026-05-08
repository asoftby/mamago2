/** Пользователь для меню аккаунта (API /api/auth/me и т.п.) */
export type AccountMenuUser = {
  id: string;
  email: string;
  role: string;
  /** true when partner business exists and is APPROVED */
  hasApprovedBusinessProfile?: boolean;
  /** Business deposit balance in BYN for account dropdown (business surface only) */
  businessBalanceBYN?: number;
  displayName?: string | null;
  avatarUrl?: string | null;
  /** Phone verification timestamp (ISO string) */
  phoneVerifiedAt?: string | null;
  /** Семейная персона (primary adult) — тот же источник, что блок «Моя семья» */
  familyRole?: string | null;
  ageBandLabel?: string | null;
  preferenceSummary?: string | null;
  leisureFormatSummary?: string | null;
  /** Дочерние SignalDefinition (группа preferences), до 3 */
  preferenceSignalIds?: string[];
  leisureFormatSignalId?: string | null;
};

/** Контекст приложения для сборки пунктов меню */
export type AccountAppSurface =
  | "public"
  | "admin"
  | "business";
