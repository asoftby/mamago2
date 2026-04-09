/** Участник семьи для UI и фильтра «Для кого» (единая модель). */
export type FamilyPersonaKind = "adult" | "child";

export type FamilyPersona = {
  id: string;
  kind: FamilyPersonaKind;
  displayName: string;
  avatarUrl?: string | null;
  /** Для взрослого: MOM | DAD | … */
  familyRole?: string | null;
  ageBandLabel?: string | null;
  preferenceSummary?: string | null;
  leisureFormatSummary?: string | null;
  preferenceSignalIds?: string[];
  leisureFormatSignalId?: string | null;
  birthDate?: string | null;
  /** Для взрослого: true если профиль заполнен (есть displayName) */
  isProfileComplete?: boolean;
};
