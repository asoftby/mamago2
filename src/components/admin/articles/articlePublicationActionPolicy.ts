import type { ContentStatus } from "@prisma/client";

export type ArticlePublicationPrimaryAction =
  | { kind: "submit"; label: "Отправить на модерацию" | "Исправить и отправить снова" }
  | {
      kind: "approve";
      label: "Одобрить и опубликовать";
      disabled: boolean;
      disabledReason: string | null;
    }
  | { kind: "save"; label: "Обновить публикацию" | "Изменения сохранены"; disabled: boolean }
  | null;

export function resolveArticlePublicationActionPolicy({
  status,
  canModerate,
  hasUnsavedChanges,
  hasPublicUrl,
}: {
  status: ContentStatus;
  canModerate: boolean;
  hasUnsavedChanges: boolean;
  hasPublicUrl: boolean;
}) {
  let primary: ArticlePublicationPrimaryAction = null;
  if (status === "DRAFT") {
    primary = { kind: "submit", label: "Отправить на модерацию" };
  } else if (status === "REJECTED") {
    primary = { kind: "submit", label: "Исправить и отправить снова" };
  } else if (status === "PENDING" && canModerate) {
    primary = {
      kind: "approve",
      label: "Одобрить и опубликовать",
      disabled: hasUnsavedChanges,
      disabledReason: hasUnsavedChanges ? "Сначала сохраните изменения" : null,
    };
  } else if (status === "PUBLISHED") {
    primary = {
      kind: "save",
      label: hasUnsavedChanges ? "Обновить публикацию" : "Изменения сохранены",
      disabled: !hasUnsavedChanges,
    };
  }

  return {
    primary,
    showQuietSave: status === "DRAFT" || status === "REJECTED",
    showReject: status === "PENDING" && canModerate,
    showPreview: true,
    showPublicLink: status === "PUBLISHED" && hasPublicUrl,
  };
}
