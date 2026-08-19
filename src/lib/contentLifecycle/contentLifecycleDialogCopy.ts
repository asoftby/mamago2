export const LIFECYCLE_DIALOG_COPY = {
  archive: {
    title: "Переместить в архив?",
    description:
      "Публикация будет скрыта из каталога. Её можно будет восстановить позже.",
    confirmLabel: "В архив",
  },
  restore: {
    title: "Восстановить публикацию?",
    description:
      "Публикация снова станет доступна согласно её статусу и правилам модерации.",
    confirmLabel: "Восстановить",
  },
  deleteDraft: {
    title: "Удалить черновик?",
    description: "Черновик будет удалён без возможности восстановления.",
    confirmLabel: "Удалить",
  },
  deleteArchived: {
    title: "Удалить из архива?",
    description:
      "Публикация будет безвозвратно удалена из базы. Это действие нельзя отменить.",
    confirmLabel: "Удалить из архива",
  },
  publish: {
    title: "Опубликовать?",
    description: "Публикация станет доступна согласно правилам видимости.",
    confirmLabel: "Опубликовать",
  },
  submitForModeration: {
    title: "Отправить на модерацию?",
    description: "Материал попадёт в очередь модерации.",
    confirmLabel: "Отправить",
  },
  withdrawFromModeration: {
    title: "Отозвать с модерации?",
    description: "Материал вернётся в черновик до решения модератора.",
    confirmLabel: "Отозвать",
  },
  unpublish: {
    title: "Снять с публикации?",
    description: "Публикация вернётся в черновик.",
    confirmLabel: "Снять",
  },
  approve: {
    title: "Одобрить публикацию?",
    description: "Материал будет опубликован.",
    confirmLabel: "Одобрить",
  },
  reject: {
    title: "Отклонить публикацию?",
    description: "Автор увидит отказ и сможет доработать материал.",
    confirmLabel: "Отклонить",
  },
  requestChanges: {
    title: "Запросить правки?",
    description: "Материал вернётся автору на доработку.",
    confirmLabel: "Запросить правки",
  },
  blocked: {
    title: "Действие недоступно",
  },
} as const;

export type LifecycleDialogActionId = keyof typeof LIFECYCLE_DIALOG_COPY;

export type LifecycleConfirmDialogActionId = Exclude<
  LifecycleDialogActionId,
  "blocked"
>;

/** @deprecated Use LIFECYCLE_DIALOG_COPY */
export const CONTENT_LIFECYCLE_DIALOG_COPY = LIFECYCLE_DIALOG_COPY;

export function getLifecycleDialogCopy(actionId: LifecycleConfirmDialogActionId) {
  return LIFECYCLE_DIALOG_COPY[actionId];
}
