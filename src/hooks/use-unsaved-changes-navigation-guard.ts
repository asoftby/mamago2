"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Предупреждение при уходе со страницы с несохранёнными изменениями:
 * - закрытие вкладки / обновление (beforeunload)
 * - переход по внутренним ссылкам (модальное подтверждение + router.push)
 * - программная навигация через `requestLeave` (кнопки «Назад» / router.back)
 */
export function useUnsavedChangesNavigationGuard(dirty: boolean) {
  const router = useRouter();
  const pendingPathRef = useRef<string | null>(null);
  /** Отложенное программное действие навигации (requestLeave с callback) */
  const pendingActionRef = useRef<(() => void) | null>(null);
  /** Чтобы onOpenChange не сбросил путь до router.push после подтверждения */
  const confirmingLeaveRef = useRef(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Once leaving was confirmed in our own dialog, never show a second browser prompt.
      if (confirmingLeaveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a?.href) return;
      if (a.target === "_blank" || a.download) return;
      try {
        const u = new URL(a.href, window.location.href);
        if (u.origin !== window.location.origin) return;
        const targetFull = `${u.pathname}${u.search}${u.hash}`;
        const currentFull = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (targetFull === currentFull) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        pendingPathRef.current = targetFull;
        setLeaveDialogOpen(true);
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) {
      pendingPathRef.current = null;
      pendingActionRef.current = null;
      confirmingLeaveRef.current = false;
      queueMicrotask(() => setLeaveDialogOpen(false));
    }
  }, [dirty]);

  const confirmLeave = useCallback(() => {
    const p = pendingPathRef.current;
    const action = pendingActionRef.current;
    pendingPathRef.current = null;
    pendingActionRef.current = null;
    confirmingLeaveRef.current = true;
    setLeaveDialogOpen(false);
    if (action) {
      action();
    } else if (p) {
      router.push(p);
    }
    // Suppression is one-shot, only for an unload initiated immediately by
    // the confirmed action. If router.back() is a no-op (no history entry),
    // restore the dirty-form protection on the next event-loop turn.
    window.setTimeout(() => {
      confirmingLeaveRef.current = false;
    }, 0);
  }, [router]);

  const onLeaveDialogOpenChange = useCallback((open: boolean) => {
    setLeaveDialogOpen(open);
    if (!open && !confirmingLeaveRef.current) {
      pendingPathRef.current = null;
      pendingActionRef.current = null;
    }
  }, []);

  /**
   * Программная навигация под защитой guard'а: без несохранённых изменений
   * выполняется сразу, иначе откладывается до подтверждения в диалоге.
   * `target` — внутренний путь (router.push) или callback (например, router.back).
   */
  const requestLeave = useCallback(
    (target: string | (() => void)) => {
      if (!dirty) {
        if (typeof target === "function") target();
        else router.push(target);
        return;
      }
      if (typeof target === "function") {
        pendingActionRef.current = target;
        pendingPathRef.current = null;
      } else {
        pendingPathRef.current = target;
        pendingActionRef.current = null;
      }
      setLeaveDialogOpen(true);
    },
    [dirty, router],
  );

  return { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange, requestLeave };
}
