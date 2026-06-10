"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BreakingNewsFormState } from "@/lib/publications/breakingNewsArticle";
import {
  buildBreakingNewsLocalDraft,
  breakingNewsEditorComparable,
  clearBreakingNewsLocalDrafts,
  getBreakingNewsDraftStorageKey,
  isBreakingNewsLocalDraftEmpty,
  readBreakingNewsLocalDraft,
  removeBreakingNewsLocalDraft,
  writeBreakingNewsLocalDraft,
  type BreakingNewsLocalDraft,
} from "@/lib/publications/breakingNewsLocalDraft";

const AUTOSAVE_DEBOUNCE_MS = 500;

export function useBreakingNewsLocalDraft(args: {
  articleId: string | null;
  formState: BreakingNewsFormState;
  coverImagePreviewUrl: string;
  loadState: "loading" | "ready" | "error";
  savedComparable: string | null;
  onRestoreDraft: (draft: BreakingNewsLocalDraft) => void;
  onDiscardDraft: () => void;
}) {
  const {
    articleId,
    formState,
    coverImagePreviewUrl,
    loadState,
    savedComparable,
    onRestoreDraft,
    onDiscardDraft,
  } = args;

  const storageKey = useMemo(() => getBreakingNewsDraftStorageKey(articleId), [articleId]);
  const [pendingDraft, setPendingDraft] = useState<BreakingNewsLocalDraft | null>(null);
  const persistEnabledRef = useRef(false);
  const draftCheckedRef = useRef(false);

  useEffect(() => {
    draftCheckedRef.current = false;
    persistEnabledRef.current = false;
    setPendingDraft(null);
  }, [storageKey]);

  useEffect(() => {
    if (loadState !== "ready" || savedComparable === null) return;
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    persistEnabledRef.current = true;

    const stored = readBreakingNewsLocalDraft(storageKey);
    if (!stored || isBreakingNewsLocalDraftEmpty(stored)) return;

    const storedComparable = breakingNewsEditorComparable(stored);
    if (storedComparable !== savedComparable) {
      setPendingDraft(stored);
    }
  }, [loadState, savedComparable, storageKey]);

  useEffect(() => {
    if (!persistEnabledRef.current || loadState !== "ready") return;

    const timer = window.setTimeout(() => {
      const draft = buildBreakingNewsLocalDraft(formState, coverImagePreviewUrl);
      if (isBreakingNewsLocalDraftEmpty(draft)) {
        removeBreakingNewsLocalDraft(storageKey);
        return;
      }
      writeBreakingNewsLocalDraft(storageKey, draft);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [formState, coverImagePreviewUrl, loadState, storageKey]);

  const restoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    onRestoreDraft(pendingDraft);
    setPendingDraft(null);
  }, [onRestoreDraft, pendingDraft]);

  const discardDraft = useCallback(() => {
    removeBreakingNewsLocalDraft(storageKey);
    setPendingDraft(null);
    onDiscardDraft();
  }, [onDiscardDraft, storageKey]);

  const clearPersistedDraft = useCallback(() => {
    removeBreakingNewsLocalDraft(storageKey);
    setPendingDraft(null);
  }, [storageKey]);

  return {
    showDraftBanner: pendingDraft != null,
    restoreDraft,
    discardDraft,
    clearPersistedDraft,
  };
}
