import type {
  LifecycleActionCategory,
  LifecycleActionId,
} from "./lifecycleTypes";

export type LifecycleActionDefinition = {
  id: LifecycleActionId;
  label: string;
  description?: string;
  category: LifecycleActionCategory;
  destructive?: boolean;
  requiresConfirmation: boolean;
  successMessage?: string;
  errorMessage?: string;
};

export const LIFECYCLE_ACTION_REGISTRY: Record<
  LifecycleActionId,
  LifecycleActionDefinition
> = {
  edit: {
    id: "edit",
    label: "Редактировать",
    category: "navigation",
    requiresConfirmation: false,
  },
  preview: {
    id: "preview",
    label: "Просмотреть",
    category: "navigation",
    requiresConfirmation: false,
  },
  review: {
    id: "review",
    label: "Модерация",
    description: "Открыть экран модерации",
    category: "navigation",
    requiresConfirmation: false,
  },
  publish: {
    id: "publish",
    label: "Опубликовать",
    description: "Опубликовать без очереди модерации",
    category: "transition",
    requiresConfirmation: true,
    successMessage: "Публикация опубликована",
    errorMessage: "Не удалось опубликовать",
  },
  submitForModeration: {
    id: "submitForModeration",
    label: "Отправить на модерацию",
    description: "Отправить материал на проверку",
    category: "transition",
    requiresConfirmation: true,
    successMessage: "Отправлено на модерацию",
    errorMessage: "Не удалось отправить на модерацию",
  },
  withdrawFromModeration: {
    id: "withdrawFromModeration",
    label: "Отозвать с модерации",
    description: "Вернуть в черновик до решения модератора",
    category: "transition",
    requiresConfirmation: true,
    successMessage: "Заявка на модерацию отозвана",
    errorMessage: "Не удалось отозвать с модерации",
  },
  archive: {
    id: "archive",
    label: "Переместить в архив",
    description: "Скрыть публикацию из каталога",
    category: "transition",
    requiresConfirmation: true,
    successMessage: "Публикация перемещена в архив",
    errorMessage: "Не удалось архивировать",
  },
  restore: {
    id: "restore",
    label: "Восстановить публикацию",
    description: "Вернуть публикацию из архива",
    category: "transition",
    requiresConfirmation: true,
    successMessage: "Публикация восстановлена",
    errorMessage: "Не удалось восстановить",
  },
  deleteDraft: {
    id: "deleteDraft",
    label: "Удалить черновик",
    description: "Безвозвратно удалить черновик",
    category: "transition",
    destructive: true,
    requiresConfirmation: true,
    successMessage: "Черновик удалён",
    errorMessage: "Не удалось удалить черновик",
  },
  deleteArchived: {
    id: "deleteArchived",
    label: "Удалить из архива",
    description: "Безвозвратно удалить архивную публикацию",
    category: "transition",
    destructive: true,
    requiresConfirmation: true,
    successMessage: "Публикация удалена из архива",
    errorMessage: "Не удалось удалить из архива",
  },
  unpublish: {
    id: "unpublish",
    label: "Снять с публикации",
    description: "Вернуть в черновик",
    category: "transition",
    requiresConfirmation: true,
    successMessage: "Публикация снята",
    errorMessage: "Не удалось снять с публикации",
  },
  approve: {
    id: "approve",
    label: "Одобрить",
    description: "Опубликовать после модерации",
    category: "moderation",
    requiresConfirmation: true,
    successMessage: "Публикация одобрена",
    errorMessage: "Не удалось одобрить",
  },
  reject: {
    id: "reject",
    label: "Отклонить",
    description: "Отклонить публикацию",
    category: "moderation",
    destructive: true,
    requiresConfirmation: true,
    successMessage: "Публикация отклонена",
    errorMessage: "Не удалось отклонить",
  },
  requestChanges: {
    id: "requestChanges",
    label: "Запросить правки",
    description: "Вернуть автору на доработку",
    category: "moderation",
    requiresConfirmation: true,
    successMessage: "Запрошены правки",
    errorMessage: "Не удалось запросить правки",
  },
};

export function getLifecycleActionDefinition(
  actionId: LifecycleActionId,
): LifecycleActionDefinition {
  return LIFECYCLE_ACTION_REGISTRY[actionId];
}

export const LIFECYCLE_TRANSITION_ACTION_IDS: LifecycleActionId[] = (
  Object.values(LIFECYCLE_ACTION_REGISTRY) as LifecycleActionDefinition[]
)
  .filter((action) => action.category !== "navigation")
  .map((action) => action.id);
