"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { randomId } from "@/lib/utils/randomId";
import {
  WizardDraftAutosaver,
  clearWizardDraft,
  readWizardDraft,
  wizardDraftKey,
  type WizardDraftMode,
  type WizardDraftStatus,
} from "@/lib/wizard/wizardDraftStorage";

export type { WizardDraftStatus } from "@/lib/wizard/wizardDraftStorage";

export interface UseWizardDraftOptions<TData> {
  wizardType: string;
  mode: WizardDraftMode;
  entityId?: string | null;
  /** При несовпадении версии существующий черновик игнорируется и удаляется */
  schemaVersion: number;
  /** Текущие данные формы — автосохраняются с debounce */
  data: TData;
  /** Выключает автосейв (например, пока форма пустая). По умолчанию true */
  enabled?: boolean;
  debounceMs?: number;
  /** ISO updatedAt сущности на момент начала правок (edit) — для детекции конфликта при restore */
  entityUpdatedAt?: string | null;
}

export interface UseWizardDraftResult<TData> {
  status: WizardDraftStatus;
  lastSavedAt: Date | null;
  /**
   * Найден черновик прошлой сессии, решение пользователя не принято.
   * Пока true — автосейв приостановлен (не затираем старый черновик),
   * визард обязан показать resume-баннер: restoreDraft() / discardDraft().
   */
  hasDraft: boolean;
  /** Когда был сохранён найденный черновик (для resume-баннера) */
  draftSavedAt: Date | null;
  /** updatedAt сущности из конверта найденного черновика (детекция конфликта) */
  draftEntityUpdatedAt: Date | null;
  /** Вернуть данные черновика и продолжить с ними; null — черновик исчез */
  restoreDraft: () => TData | null;
  /** Отклонить черновик прошлой сессии и начать заново */
  discardDraft: () => void;
  /** После успешного submit: удалить черновик и сбросить статус */
  markClean: () => void;
  /** Повторить запись после status === "error" */
  retry: () => void;
  /** Стабильный UUID для идемпотентного create (паттерн PlaceWizard) */
  createRequestId: string;
}

/**
 * Черновик wizard-формы в localStorage: ключ `mg.wizard.<type>:<mode>:<entityId|"new">`,
 * schemaVersion-инвалидация, debounce 1500ms, статусы idle/saving/saved/error.
 *
 * Hydration safety: localStorage читается только в useEffect после mount.
 * Restore НЕ автоматический — см. `hasDraft`.
 */
export function useWizardDraft<TData>({
  wizardType,
  mode,
  entityId,
  schemaVersion,
  data,
  enabled = true,
  debounceMs = 1500,
  entityUpdatedAt = null,
}: UseWizardDraftOptions<TData>): UseWizardDraftResult<TData> {
  const storageKey = useMemo(
    () => wizardDraftKey(wizardType, mode, entityId),
    [wizardType, mode, entityId],
  );

  const [status, setStatus] = useState<WizardDraftStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftEntityUpdatedAt, setDraftEntityUpdatedAt] = useState<Date | null>(null);
  /** Ключ, для которого завершена начальная проверка LS (mount-гейт автосейва) */
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  const [createRequestId] = useState(() => randomId());

  const autosaverRef = useRef<WizardDraftAutosaver<TData> | null>(null);

  // Compare the persisted JSON value, not newly allocated wizard objects.
  // Status changes ("saving"/"saved") must not restart the debounce.
  const dataSnapshot = JSON.stringify(data);

  // Начальное чтение LS — только после mount (hydration safety)
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot чтение localStorage возможно только после mount; гейт hydratedKey исключает повторные прогоны */
  useEffect(() => {
    const found = readWizardDraft<TData>(window.localStorage, storageKey, schemaVersion);
    if (found) {
      setHasDraft(true);
      setDraftSavedAt(found.savedAt);
      setDraftEntityUpdatedAt(found.entityUpdatedAt);
    } else {
      setHasDraft(false);
      setDraftSavedAt(null);
      setDraftEntityUpdatedAt(null);
    }
    setStatus("idle");
    setLastSavedAt(null);
    setHydratedKey(storageKey);
  }, [storageKey, schemaVersion]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Автосейвер живёт, пока неизменны ключ/версия/debounce
  useEffect(() => {
    const autosaver = new WizardDraftAutosaver<TData>({
      storage: window.localStorage,
      key: storageKey,
      schemaVersion,
      debounceMs,
      onStatusChange: (next, savedAt) => {
        setStatus(next);
        setLastSavedAt(savedAt);
      },
      entityUpdatedAt,
    });
    autosaverRef.current = autosaver;
    return () => {
      // несохранённый хвост дописываем при размонтировании
      autosaver.flush();
      autosaver.dispose();
      autosaverRef.current = null;
    };
  }, [storageKey, schemaVersion, debounceMs, entityUpdatedAt]);

  // Планируем автосохранение при изменении содержимого, а не ссылки на объект.
  const isFirstDataRunRef = useRef(true);
  useEffect(() => {
    if (hydratedKey !== storageKey) return;
    // First meaningful input must not get lost when enabled changes false → true.
    if (isFirstDataRunRef.current) {
      isFirstDataRunRef.current = false;
      if (enabled && !hasDraft) return; // initial server data, not a user edit
    }
    // Never overwrite a previously saved draft until the user decides to restore/discard it.
    if (!enabled || hasDraft) return;
    autosaverRef.current?.schedule(JSON.parse(dataSnapshot) as TData);
  }, [dataSnapshot, enabled, hasDraft, hydratedKey, storageKey]);

  const restoreDraft = useCallback((): TData | null => {
    const found = readWizardDraft<TData>(window.localStorage, storageKey, schemaVersion);
    setHasDraft(false);
    if (!found) return null;
    setLastSavedAt(found.savedAt);
    setStatus("saved");
    return found.data;
  }, [storageKey, schemaVersion]);

  const discardDraft = useCallback(() => {
    clearWizardDraft(window.localStorage, storageKey);
    setHasDraft(false);
    setDraftSavedAt(null);
    setDraftEntityUpdatedAt(null);
  }, [storageKey]);

  const markClean = useCallback(() => {
    autosaverRef.current?.cancel();
    clearWizardDraft(window.localStorage, storageKey);
    setHasDraft(false);
    setDraftSavedAt(null);
    setDraftEntityUpdatedAt(null);
    setStatus("idle");
  }, [storageKey]);

  const retry = useCallback(() => {
    autosaverRef.current?.retry();
  }, []);

  return {
    status,
    lastSavedAt,
    hasDraft,
    draftSavedAt,
    draftEntityUpdatedAt,
    restoreDraft,
    discardDraft,
    markClean,
    retry,
    createRequestId,
  };
}
