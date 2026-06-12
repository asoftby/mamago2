/**
 * Хранилище черновиков wizard-форм поверх localStorage.
 *
 * Черновик лежит в конверте с версией схемы: при несовпадении schemaVersion
 * черновик считается несовместимым, игнорируется и удаляется.
 *
 * Чистый модуль без React — логика тестируется напрямую (см. *.test.ts),
 * React-обёртка — `src/hooks/useWizardDraft.ts`.
 */

export type WizardDraftMode = "create" | "edit";

export interface WizardDraftEnvelope<TData> {
  schemaVersion: number;
  savedAt: string; // ISO
  data: TData;
  /** updatedAt сущности на момент начала правок (edit-режим): для детекции конфликта при restore */
  entityUpdatedAt?: string; // ISO
}

export interface StoredWizardDraft<TData> {
  data: TData;
  savedAt: Date;
  entityUpdatedAt: Date | null;
}

/** Минимальный интерфейс хранилища (localStorage / fake в тестах) */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function wizardDraftKey(
  wizardType: string,
  mode: WizardDraftMode,
  entityId?: string | null,
): string {
  return `mg.wizard.${wizardType}:${mode}:${entityId ?? "new"}`;
}

/**
 * Читает черновик. Повреждённый или с несовпадающей schemaVersion —
 * удаляется и считается отсутствующим.
 */
export function readWizardDraft<TData>(
  storage: DraftStorage,
  key: string,
  schemaVersion: number,
): StoredWizardDraft<TData> | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<WizardDraftEnvelope<TData>>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.schemaVersion !== schemaVersion ||
      typeof parsed.savedAt !== "string" ||
      parsed.data === undefined
    ) {
      storage.removeItem(key);
      return null;
    }
    const savedAt = new Date(parsed.savedAt);
    if (Number.isNaN(savedAt.getTime())) {
      storage.removeItem(key);
      return null;
    }
    const entityUpdatedAt =
      typeof parsed.entityUpdatedAt === "string"
        ? new Date(parsed.entityUpdatedAt)
        : null;
    return {
      data: parsed.data as TData,
      savedAt,
      entityUpdatedAt:
        entityUpdatedAt && !Number.isNaN(entityUpdatedAt.getTime())
          ? entityUpdatedAt
          : null,
    };
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      /* noop */
    }
    return null;
  }
}

/** Пишет черновик; ошибки хранилища (quota, private mode) пробрасываются наверх. */
export function writeWizardDraft<TData>(
  storage: DraftStorage,
  key: string,
  schemaVersion: number,
  data: TData,
  opts?: { now?: Date; entityUpdatedAt?: string | null },
): Date {
  const now = opts?.now ?? new Date();
  const envelope: WizardDraftEnvelope<TData> = {
    schemaVersion,
    savedAt: now.toISOString(),
    data,
    ...(opts?.entityUpdatedAt ? { entityUpdatedAt: opts.entityUpdatedAt } : {}),
  };
  storage.setItem(key, JSON.stringify(envelope));
  return now;
}

export function clearWizardDraft(storage: DraftStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* noop */
  }
}

// ─── Автосейвер с debounce и статус-машиной ──────────────────────────────────

export type WizardDraftStatus = "idle" | "saving" | "saved" | "error";

export interface WizardDraftAutosaverOptions {
  storage: DraftStorage;
  key: string;
  schemaVersion: number;
  debounceMs: number;
  onStatusChange: (status: WizardDraftStatus, lastSavedAt: Date | null) => void;
  now?: () => Date;
  /** ISO updatedAt сущности (edit-режим) — кладётся в конверт каждой записи */
  entityUpdatedAt?: string | null;
}

/**
 * Статус-машина: idle → saving (запись запланирована/идёт) → saved | error.
 * После error повторная попытка — `retry()` (пишет немедленно последние данные).
 */
export class WizardDraftAutosaver<TData> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingData: TData | null = null;
  private lastSavedAt: Date | null = null;
  private disposed = false;

  constructor(private readonly opts: WizardDraftAutosaverOptions) {}

  /** Планирует сохранение с debounce; повторный вызов сдвигает таймер. */
  schedule(data: TData): void {
    if (this.disposed) return;
    this.pendingData = data;
    if (this.timer) clearTimeout(this.timer);
    this.opts.onStatusChange("saving", this.lastSavedAt);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.opts.debounceMs);
  }

  /** Немедленно пишет отложенные данные (если есть). */
  flush(): void {
    if (this.disposed || this.pendingData === null) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.lastSavedAt = writeWizardDraft(
        this.opts.storage,
        this.opts.key,
        this.opts.schemaVersion,
        this.pendingData,
        { now: this.opts.now?.(), entityUpdatedAt: this.opts.entityUpdatedAt },
      );
      this.pendingData = null;
      this.opts.onStatusChange("saved", this.lastSavedAt);
    } catch {
      // данные остаются в pendingData — retry() их допишет
      this.opts.onStatusChange("error", this.lastSavedAt);
    }
  }

  /** Повтор после ошибки: пишет последние несохранённые данные немедленно. */
  retry(): void {
    if (this.pendingData === null) return;
    this.opts.onStatusChange("saving", this.lastSavedAt);
    this.flush();
  }

  /** Отменяет отложенную запись и сбрасывает несохранённые данные. */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingData = null;
  }

  dispose(): void {
    this.cancel();
    this.disposed = true;
  }

  get hasPendingWrite(): boolean {
    return this.pendingData !== null;
  }
}
