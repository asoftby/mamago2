import type { FormWizardActionLabels } from "@/components/form-shell";
import type { Role } from "@prisma/client";
import { canPublishContentDirectly } from "@/lib/auth/businessContentAccess";

/** Russian copy for business cabinet entity wizards — keep moderation/draft wording here, not inside form sections */
export const businessFormActionLabels: FormWizardActionLabels = {
  back: "Назад",
  next: "Далее",
  saveDraft: "Сохранить черновик",
  savingDraft: "Сохранение...",
  submit: "Отправить на модерацию",
  submitting: "Отправка...",
};

export function getBusinessFormActionLabels(role?: Role): FormWizardActionLabels {
  if (canPublishContentDirectly(role)) {
    return {
      ...businessFormActionLabels,
      submit: "Опубликовать",
      submitting: "Публикация...",
    };
  }
  return businessFormActionLabels;
}

export const businessFormCopy = {
  reviewStepShortTitle: "Проверка и отправка",
  stepSubtitle: (current: number, total: number, stepTitle: string) =>
    `Шаг ${current} из ${total}: ${stepTitle}`,
  /** @deprecated Используйте SaveIndicator из form-shell (статусы + относительное время); удалить после миграции всех визардов на useWizardDraft */
  savedAt: (d: Date) => `Сохранено ${d.toLocaleTimeString()}`,
  place: {
    createTitle: "Новое место",
    editTitle: (name?: string | null) =>
      name?.trim() ? `Редактирование места: ${name.trim()}` : "Редактирование места",
  },
  event: {
    createTitle: "Новое событие",
    editTitle: (name?: string | null) =>
      name?.trim() ? `Редактирование события: ${name.trim()}` : "Редактирование события",
  },
  offer: {
    createTitle: "Новое предложение",
    editTitle: (name?: string | null) =>
      name?.trim() ? `Редактирование предложения: ${name.trim()}` : "Редактирование предложения",
  },
} as const;
