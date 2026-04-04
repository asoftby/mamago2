/** Пользователь для меню аккаунта (API /api/auth/me и т.п.) */
export type AccountMenuUser = {
  id: string;
  email: string;
  role: string;
  displayName?: string | null;
  avatarUrl?: string | null;
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
