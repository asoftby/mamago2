/**
 * Onboarding Orchestrator - Core Types
 * 
 * Единая типизация для всех onboarding entry points и сценариев
 */

/**
 * Entry points - откуда пользователь начал auth/onboarding
 */
export enum OnboardingEntryPoint {
  /** Клик на профиль в хедере */
  HEADER_PROFILE = "HEADER_PROFILE",
  
  /** Сохранение события в идеи/план */
  SAVE_EVENT = "SAVE_EVENT",
  
  /** Открытие "Мой план" через виджет (с preview state) */
  HEADER_MY_PLAN = "HEADER_MY_PLAN",
  
  /** Открытие "Мой план" (legacy, deprecated) */
  MY_PLAN = "MY_PLAN",
  
  /** Конструктор дня рождения */
  BIRTHDAY_CONSTRUCTOR = "BIRTHDAY_CONSTRUCTOR",
  
  /** Создание отзыва (future: SMS verification) */
  REVIEW_CREATE = "REVIEW_CREATE",
  
  /** Общий вход (без специфичного контекста) */
  GENERIC_LOGIN = "GENERIC_LOGIN",
}

/**
 * User intent - что пользователь хочет сделать
 */
export enum OnboardingIntent {
  /** Просто создать аккаунт */
  CREATE_ACCOUNT = "CREATE_ACCOUNT",
  
  /** Сохранить событие в идеи */
  SAVE_TO_IDEAS = "SAVE_TO_IDEAS",
  
  /** Сохранить событие в план на дату */
  SAVE_TO_PLAN = "SAVE_TO_PLAN",
  
  /** Открыть мой план */
  OPEN_MY_PLAN = "OPEN_MY_PLAN",
  
  /** Отправить заявку на день рождения */
  SUBMIT_BIRTHDAY_REQUEST = "SUBMIT_BIRTHDAY_REQUEST",
  
  /** Создать отзыв (требует SMS verification) */
  CREATE_REVIEW = "CREATE_REVIEW",
  
  /** Просмотр профиля */
  VIEW_PROFILE = "VIEW_PROFILE",
}

/**
 * Outcome - куда вести пользователя после завершения
 */
export enum OnboardingOutcome {
  /** Вернуть в профиль */
  RETURN_TO_PROFILE = "RETURN_TO_PROFILE",
  
  /** Завершить сохранение в идеи */
  COMPLETE_SAVE_TO_IDEAS = "COMPLETE_SAVE_TO_IDEAS",
  
  /** Завершить сохранение в план */
  COMPLETE_SAVE_TO_PLAN = "COMPLETE_SAVE_TO_PLAN",
  
  /** Открыть мой план */
  OPEN_MY_PLAN = "OPEN_MY_PLAN",
  
  /** Вернуть к результату конструктора */
  RETURN_TO_BIRTHDAY_RESULT = "RETURN_TO_BIRTHDAY_RESULT",
  
  /** Запросить SMS verification для отзыва */
  REQUEST_SMS_VERIFICATION_FOR_REVIEW = "REQUEST_SMS_VERIFICATION_FOR_REVIEW",
  
  /** Остаться на текущей странице */
  STAY_ON_PAGE = "STAY_ON_PAGE",
  
  /** Перейти на указанный URL */
  REDIRECT_TO_URL = "REDIRECT_TO_URL",
}

/**
 * Deferred prompt types - что можно предложить позже
 */
export enum DeferredPromptType {
  /** Добавить ребёнка для персонализации */
  ADD_CHILD_PROFILE = "ADD_CHILD_PROFILE",
  
  /** Указать интересы */
  SET_INTERESTS = "SET_INTERESTS",
  
  /** Настроить предпочтения */
  SET_PREFERENCES = "SET_PREFERENCES",
  
  /** Подтвердить телефон для отзывов */
  VERIFY_PHONE_FOR_REVIEWS = "VERIFY_PHONE_FOR_REVIEWS",
  
  /** Сохранить данные ребёнка из birthday constructor */
  SAVE_BIRTHDAY_CHILD_TO_PROFILE = "SAVE_BIRTHDAY_CHILD_TO_PROFILE",
}

/**
 * Required fields для конкретного сценария
 */
export type RequiredField = 
  | "email"
  | "name"
  | "phone"
  | "childName"
  | "childBirthDate"
  | "childInterests";

/**
 * Pending action - действие, которое нужно завершить после auth
 */
export interface PendingActionBase {
  /** Тип действия */
  type: string;
  
  /** Данные для выполнения действия */
  payload: Record<string, unknown>;
  
  /** Timestamp создания */
  createdAt: number;
  
  /** TTL в миллисекундах (опционально) */
  ttl?: number;
}

/**
 * Onboarding context - полный контекст текущего onboarding flow
 */
export interface OnboardingContext {
  /** Entry point */
  entryPoint: OnboardingEntryPoint;
  
  /** User intent */
  intent: OnboardingIntent;
  
  /** Ожидаемый outcome */
  outcome: OnboardingOutcome;
  
  /** Обязательные поля для этого сценария */
  requiredFields: RequiredField[];
  
  /** Отложенные поля (можно спросить позже) */
  deferredFields: RequiredField[];
  
  /** URL для возврата после завершения */
  returnUrl?: string;
  
  /** Pending action для выполнения после auth */
  pendingAction?: PendingActionBase;
  
  /** Metadata для аналитики */
  analyticsMetadata?: Record<string, unknown>;
  
  /** Timestamp создания контекста */
  createdAt: number;
}

/**
 * Post-auth result - результат завершения onboarding
 */
export interface PostAuthResult {
  /** Статус завершения */
  status: "success" | "cancelled" | "error";
  
  /** ID пользователя */
  userId?: string;
  
  /** Завершённые шаги */
  completedSteps: string[];
  
  /** Пропущенные шаги */
  skippedSteps: string[];
  
  /** Следующее действие */
  nextAction?: {
    type: "redirect" | "execute_pending" | "show_deferred_prompt" | "none";
    payload?: unknown;
  };
  
  /** URL для редиректа */
  redirectTarget?: string;
  
  /** Отложенные prompts для показа */
  deferredPrompts: DeferredPromptType[];
  
  /** Было ли выполнено pending action */
  completedPendingAction?: boolean;
  
  /** Ошибка (если есть) */
  error?: string;
  
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Deferred prompt config
 */
export interface DeferredPromptConfig {
  /** Тип prompt */
  type: DeferredPromptType;
  
  /** Приоритет (меньше = выше) */
  priority: number;
  
  /** Условие показа */
  condition?: (context: OnboardingContext, result: PostAuthResult) => boolean;
  
  /** Задержка перед показом (мс) */
  delay?: number;
  
  /** Можно ли пропустить */
  skippable: boolean;
}

/**
 * Onboarding scenario config
 */
export interface OnboardingScenario {
  /** Entry point */
  entryPoint: OnboardingEntryPoint;
  
  /** Заголовок */
  title: string;
  
  /** Подзаголовок */
  subtitle: string;
  
  /** Value proposition */
  valueProposition?: string;
  
  /** Обязательные поля */
  requiredFields: RequiredField[];
  
  /** Опциональные поля */
  optionalFields: RequiredField[];
  
  /** Правила пропуска шагов */
  skipRules?: {
    field: RequiredField;
    condition: (context: OnboardingContext) => boolean;
  }[];
  
  /** Стратегия завершения */
  completionStrategy: {
    outcome: OnboardingOutcome;
    getReturnUrl?: (context: OnboardingContext) => string;
  };
  
  /** Deferred prompts для этого сценария */
  deferredPrompts?: DeferredPromptConfig[];
  
  /** Metadata для аналитики */
  analyticsMetadata?: Record<string, unknown>;
}
