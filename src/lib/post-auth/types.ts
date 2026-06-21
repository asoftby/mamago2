/**
 * Единая модель post-auth: точка входа, отложенное действие, возврат.
 */

export type AuthEntryPoint =
  | "profile"
  | "save_idea"
  | "save_plan"
  | "my_plan"
  | "birthday_constructor";

export type AuthAction = "login" | "signup";

/** Сущность для сохранения после входа (активность или маршрут). */
export type PendingEntityType = "activity" | "route";

export type PendingSaveIdeaAction = {
  kind: "save_idea";
  entityType: PendingEntityType;
  entityId: string;
  /** Для маршрута — опционально */
  routeSlug?: string;
  /** Для UI / аналитики */
  title?: string;
  coverImageUrl?: string | null;
};

export type PendingSavePlanAction = {
  kind: "save_plan";
  entityType: PendingEntityType;
  entityId: string;
  plannedDate: string;
  timeSlotId?: string | null;
  title?: string;
  coverImageUrl?: string | null;
  routeSlug?: string;
};

export type PendingPostAuthAction = PendingSaveIdeaAction | PendingSavePlanAction | null;

export interface PostAuthContext {
  source: AuthEntryPoint;
  authAction?: AuthAction | null;
  pendingAction: PendingPostAuthAction;
  /** Куда вернуться после полного завершения (pathname + search или абсолютный URL) */
  returnTo: string | null;
  createdAt: number;
}

/** Обязательные шаги (сервер подсказывает resume). */
export type ProfileMandatoryStepId = "adult" | "child" | "child_interests";

/** Полный flow = обязательные + опциональный add_more (только на клиенте после интересов). */
export type ProfileCompletionStepId =
  | ProfileMandatoryStepId
  | "add_more_children";

export interface ProfileCompletionFlags {
  hasAdultProfile: boolean;
  hasChildProfile: boolean;
  hasChildInterests: boolean;
  isProfileComplete: boolean;
}

export interface ProfileStatePayload extends ProfileCompletionFlags {
  /** Первый ребёнок по createdAt (для дозаполнения). */
  primaryChildId: string | null;
  /** Снимок для UI — без лишних полей */
  user: {
    id: string;
    familyRole: string | null;
    ageBandLabel: string | null;
  };
  children: Array<{
    id: string;
    name: string;
    birthDate: string | null;
    createdAt: string;
    interestCount: number;
  }>;
  /** С какого обязательного шага продолжить; null = usable-профиль уже есть */
  resumeStep: ProfileMandatoryStepId | null;
}
