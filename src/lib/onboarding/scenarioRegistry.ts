/**
 * Onboarding Scenario Registry
 * 
 * Единый реестр всех onboarding сценариев
 */

import {
  OnboardingEntryPoint,
  OnboardingIntent,
  OnboardingOutcome,
  DeferredPromptType,
  type OnboardingScenario,
  type OnboardingContext,
  type PostAuthResult,
} from "./types";

/**
 * Registry of all onboarding scenarios
 */
const SCENARIO_REGISTRY: Record<OnboardingEntryPoint, OnboardingScenario> = {
  [OnboardingEntryPoint.HEADER_PROFILE]: {
    entryPoint: OnboardingEntryPoint.HEADER_PROFILE,
    title: "Войдите в аккаунт",
    subtitle: "Сохраняйте идеи и получайте персональные рекомендации",
    requiredFields: ["email"],
    optionalFields: ["name"],
    completionStrategy: {
      outcome: OnboardingOutcome.RETURN_TO_PROFILE,
    },
    deferredPrompts: [
      {
        type: DeferredPromptType.ADD_CHILD_PROFILE,
        priority: 1,
        skippable: true,
        delay: 1000,
      },
    ],
    analyticsMetadata: {
      source: "header_profile",
    },
  },

  [OnboardingEntryPoint.SAVE_EVENT]: {
    entryPoint: OnboardingEntryPoint.SAVE_EVENT,
    title: "Войдите, чтобы сохранить",
    subtitle: "Сохраняйте события и планируйте дни",
    valueProposition: "Напомним, чтобы не пропустить",
    requiredFields: ["email"],
    optionalFields: [],
    completionStrategy: {
      outcome: OnboardingOutcome.COMPLETE_SAVE_TO_IDEAS,
      getReturnUrl: (context) => {
        // Return to the page where save was initiated
        return context.returnUrl || "/";
      },
    },
    deferredPrompts: [
      {
        type: DeferredPromptType.ADD_CHILD_PROFILE,
        priority: 2,
        skippable: true,
        delay: 3000,
        condition: (context, result) => {
          // Only show if user doesn't have children yet
          return !result.metadata?.hasChildren;
        },
      },
    ],
    analyticsMetadata: {
      source: "save_event",
    },
  },

  [OnboardingEntryPoint.HEADER_MY_PLAN]: {
    entryPoint: OnboardingEntryPoint.HEADER_MY_PLAN,
    title: "Создайте план для вашей семьи",
    subtitle: "Персональные рекомендации под возраст и интересы детей",
    valueProposition: "Автоматически подбираем события на каждый день",
    requiredFields: ["email", "childName", "childBirthDate"],
    optionalFields: ["childInterests"],
    completionStrategy: {
      outcome: OnboardingOutcome.OPEN_MY_PLAN,
      getReturnUrl: (context) => {
        return context.returnUrl || "/?myPlan=open&firstRun=true";
      },
    },
    deferredPrompts: [],
    analyticsMetadata: {
      source: "my_plan_widget",
    },
  },

  [OnboardingEntryPoint.MY_PLAN]: {
    entryPoint: OnboardingEntryPoint.MY_PLAN,
    title: "Войдите, чтобы открыть Мой план",
    subtitle: "Сохраняйте идеи и получайте рекомендации под ваших детей",
    requiredFields: ["email"],
    optionalFields: ["childName", "childBirthDate"],
    completionStrategy: {
      outcome: OnboardingOutcome.OPEN_MY_PLAN,
      getReturnUrl: (context) => {
        return context.returnUrl || "/?myPlan=open";
      },
    },
    deferredPrompts: [
      {
        type: DeferredPromptType.ADD_CHILD_PROFILE,
        priority: 1,
        skippable: true,
        delay: 500,
        condition: (context, result) => {
          return !result.metadata?.hasChildren;
        },
      },
      {
        type: DeferredPromptType.SET_INTERESTS,
        priority: 2,
        skippable: true,
        delay: 3000,
      },
    ],
    analyticsMetadata: {
      source: "my_plan",
    },
  },

  [OnboardingEntryPoint.BIRTHDAY_CONSTRUCTOR]: {
    entryPoint: OnboardingEntryPoint.BIRTHDAY_CONSTRUCTOR,
    title: "Войдите в аккаунт, чтобы сохранить праздник и отправить заявки",
    subtitle: "С учётом возраста и интересов ваших детей",
    requiredFields: ["email"],
    optionalFields: ["name"],
    completionStrategy: {
      outcome: OnboardingOutcome.RETURN_TO_BIRTHDAY_RESULT,
      getReturnUrl: (context) => {
        return context.returnUrl || "/birthday";
      },
    },
    deferredPrompts: [
      {
        type: DeferredPromptType.SAVE_BIRTHDAY_CHILD_TO_PROFILE,
        priority: 1,
        skippable: true,
        delay: 1000,
        condition: (context, result) => {
          // Only if birthday data has child info
          return !!result.metadata?.birthdayChildData;
        },
      },
    ],
    analyticsMetadata: {
      source: "birthday_constructor",
    },
  },

  [OnboardingEntryPoint.REVIEW_CREATE]: {
    entryPoint: OnboardingEntryPoint.REVIEW_CREATE,
    title: "Войдите, чтобы оставить отзыв",
    subtitle: "Помогите другим родителям сделать выбор",
    requiredFields: ["email"],
    optionalFields: ["name", "phone"],
    completionStrategy: {
      outcome: OnboardingOutcome.REQUEST_SMS_VERIFICATION_FOR_REVIEW,
      getReturnUrl: (context) => {
        return context.returnUrl || "/";
      },
    },
    deferredPrompts: [
      {
        type: DeferredPromptType.VERIFY_PHONE_FOR_REVIEWS,
        priority: 1,
        skippable: false,
        delay: 0,
        condition: (context, result) => {
          // Only if phone not verified yet
          return !result.metadata?.phoneVerified;
        },
      },
    ],
    analyticsMetadata: {
      source: "review_create",
    },
  },

  [OnboardingEntryPoint.GENERIC_LOGIN]: {
    entryPoint: OnboardingEntryPoint.GENERIC_LOGIN,
    title: "Войдите в аккаунт",
    subtitle: "Доступ ко всем возможностям mamaGo",
    requiredFields: ["email"],
    optionalFields: [],
    completionStrategy: {
      outcome: OnboardingOutcome.STAY_ON_PAGE,
    },
    deferredPrompts: [],
    analyticsMetadata: {
      source: "generic_login",
    },
  },
};

/**
 * Get scenario by entry point
 */
export function getScenario(entryPoint: OnboardingEntryPoint): OnboardingScenario {
  return SCENARIO_REGISTRY[entryPoint];
}

/**
 * Get all scenarios
 */
export function getAllScenarios(): OnboardingScenario[] {
  return Object.values(SCENARIO_REGISTRY);
}

/**
 * Resolve intent from entry point and context
 */
export function resolveIntent(
  entryPoint: OnboardingEntryPoint,
  context?: Partial<OnboardingContext>
): OnboardingIntent {
  switch (entryPoint) {
    case OnboardingEntryPoint.HEADER_PROFILE:
      return OnboardingIntent.VIEW_PROFILE;
    
    case OnboardingEntryPoint.SAVE_EVENT:
      // Check if saving to plan or ideas
      if (context?.pendingAction?.type === "saveEventWithDate") {
        return OnboardingIntent.SAVE_TO_PLAN;
      }
      return OnboardingIntent.SAVE_TO_IDEAS;
    
    case OnboardingEntryPoint.HEADER_MY_PLAN:
    case OnboardingEntryPoint.MY_PLAN:
      return OnboardingIntent.OPEN_MY_PLAN;
    
    case OnboardingEntryPoint.BIRTHDAY_CONSTRUCTOR:
      return OnboardingIntent.SUBMIT_BIRTHDAY_REQUEST;
    
    case OnboardingEntryPoint.REVIEW_CREATE:
      return OnboardingIntent.CREATE_REVIEW;
    
    case OnboardingEntryPoint.GENERIC_LOGIN:
    default:
      return OnboardingIntent.CREATE_ACCOUNT;
  }
}

/**
 * Check if field is required for scenario
 */
export function isFieldRequired(
  scenario: OnboardingScenario,
  field: string
): boolean {
  return scenario.requiredFields.includes(field as never);
}

/**
 * Check if field can be deferred for scenario
 */
export function isFieldDeferred(
  scenario: OnboardingScenario,
  field: string
): boolean {
  return scenario.optionalFields.includes(field as never);
}

/**
 * Get deferred prompts for scenario
 */
export function getDeferredPrompts(
  scenario: OnboardingScenario,
  context: OnboardingContext,
  result: PostAuthResult
): DeferredPromptType[] {
  if (!scenario.deferredPrompts) return [];
  
  return scenario.deferredPrompts
    .filter((prompt) => {
      if (!prompt.condition) return true;
      return prompt.condition(context, result);
    })
    .sort((a, b) => a.priority - b.priority)
    .map((prompt) => prompt.type);
}
