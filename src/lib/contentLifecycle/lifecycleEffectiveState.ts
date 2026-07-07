import type {
  LifecycleContentType,
  LifecycleEffectiveState,
} from "./lifecycleTypes";

function normalizeStatus(status?: string | null): string | null {
  if (!status) return null;
  return status.toUpperCase();
}

export function isLifecycleArchived(input: {
  status?: string | null;
  archivedAt?: string | Date | null;
}): boolean {
  if (input.archivedAt) {
    return true;
  }
  return normalizeStatus(input.status) === "ARCHIVED";
}

/**
 * Single source of truth for «what state is this publication in right now?»
 * Archive always wins over workflow status (Place/Offer `archivedAt` model).
 */
export function resolveLifecycleEffectiveState(input: {
  contentType?: LifecycleContentType;
  status?: string | null;
  archivedAt?: string | Date | null;
}): LifecycleEffectiveState {
  if (isLifecycleArchived(input)) {
    return "archived";
  }

  const status = normalizeStatus(input.status);
  switch (status) {
    case "DRAFT":
      return "draft";
    case "PENDING":
    case "PENDING_UPDATE":
      return "pending";
    case "PUBLISHED":
      return "published";
    case "REJECTED":
      return "rejected";
    case "NEEDS_REVISION":
      return "needsRevision";
    case "SCHEDULED":
      return "scheduled";
    case "DELETED":
      return "deleted";
    case "ARCHIVED":
      return "archived";
    default:
      return "unknown";
  }
}

export const LIFECYCLE_STATE_META: Record<
  LifecycleEffectiveState,
  { label: string; tone: "neutral" | "warning" | "success" | "muted" | "danger"; description?: string }
> = {
  draft: { label: "Черновик", tone: "neutral" },
  pending: { label: "На модерации", tone: "warning" },
  published: { label: "Опубликовано", tone: "success" },
  archived: {
    label: "В архиве",
    tone: "muted",
    description: "Публикация скрыта из каталога",
  },
  rejected: { label: "Отклонено", tone: "danger" },
  needsRevision: { label: "Требует правок", tone: "warning" },
  scheduled: { label: "Запланировано", tone: "warning" },
  deleted: { label: "Удалено", tone: "muted" },
  unknown: { label: "Неизвестно", tone: "neutral" },
};

/** States where archive transition is meaningful (non-draft, non-archived). */
export const ARCHIVABLE_EFFECTIVE_STATES: LifecycleEffectiveState[] = [
  "published",
  "pending",
  "rejected",
  "needsRevision",
  "scheduled",
];
