"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MAX_FEEDBACK_REVIEW_LENGTH,
  MAX_FEEDBACK_TAGS,
  type FeedbackTargetType,
  type FeedbackValue,
} from "@/lib/feedback/model";
import {
  availableFeedbackTags,
  STARTER_FEEDBACK_TAGS,
  type StarterFeedbackTag,
} from "@/lib/feedback/tagCatalog";

type Persist = void | Promise<void>;

export type FeedbackComposerProps = {
  targetType: FeedbackTargetType;
  initialValue?: FeedbackValue | null;
  initialTagKeys?: readonly string[];
  initialText?: string;
  /** Use server-supplied active tags after the admin catalog is connected. */
  tags?: readonly StarterFeedbackTag[];
  isPhoneVerified: boolean;
  onSaveReaction: (value: FeedbackValue) => Persist;
  onSaveTags?: (keys: readonly string[]) => Persist;
  onSubmitText?: (text: string) => Persist;
  /** Open in-place verification; never navigate away or discard text. */
  onRequestPhoneVerification?: () => void;
  className?: string;
};

/**
 * Controlled by persistence callbacks. A reaction is sent on tap; tags and
 * text are optional. Until legally approved, adapters must keep unverified
 * reactions PRIVATE (not in public aggregates). This component does not
 * make its own network requests or claim publication.
 */
export function FeedbackComposer({
  targetType,
  initialValue = null,
  initialTagKeys = [],
  initialText = "",
  tags = STARTER_FEEDBACK_TAGS,
  isPhoneVerified,
  onSaveReaction,
  onSaveTags,
  onSubmitText,
  onRequestPhoneVerification,
  className,
}: FeedbackComposerProps) {
  const uid = useId();
  const isContent = targetType === "ARTICLE" || targetType === "NEWS" || targetType === "ROUTE";
  const [value, setValue] = useState<FeedbackValue | null>(initialValue);
  const [selectedTags, setSelectedTags] = useState<string[]>([...initialTagKeys]);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [textSaved, setTextSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedTags = value === null ? [] : availableFeedbackTags(targetType, value, tags);
  const options: Array<{ value: FeedbackValue; icon: string; label: string }> = isContent
    ? [
        { value: -1, icon: "👎", label: "Нет" },
        { value: 0, icon: "🤷", label: "Отчасти" },
        { value: 1, icon: "👍", label: "Да" },
      ]
    : [
        { value: -1, icon: "😞", label: "Не очень" },
        { value: 0, icon: "😐", label: "Нормально" },
        { value: 1, icon: "😍", label: "Супер" },
      ];

  const question = isContent
    ? "Материал был полезен?"
    : targetType === "PLACE"
      ? "Как вам место?"
      : targetType === "OFFER"
        ? "Как вам услуга?"
        : "Как вам понравилось?";

  async function chooseReaction(next: FeedbackValue) {
    if (busy || value === next) return;
    const prev = value;
    const prevTags = selectedTags;
    const validKeys = new Set(availableFeedbackTags(targetType, next, tags).map((tag) => tag.key));
    const nextTags = prevTags.filter((key) => validKeys.has(key));
    setValue(next);
    setSelectedTags(nextTags);
    setSaved(false);
    setError(null);
    setBusy(true);
    try {
      await onSaveReaction(next);
      if (onSaveTags && nextTags.length !== prevTags.length) await onSaveTags(nextTags);
      setSaved(true);
    } catch {
      setValue(prev);
      setSelectedTags(prevTags);
      setError("Не удалось сохранить оценку. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTag(key: string) {
    if (value === null || busy || !onSaveTags) return;
    const previous = selectedTags;
    const next = previous.includes(key)
      ? previous.filter((item) => item !== key)
      : previous.length < MAX_FEEDBACK_TAGS ? [...previous, key] : previous;
    if (next === previous) return;
    setSelectedTags(next);
    setError(null);
    setBusy(true);
    try {
      await onSaveTags(next);
    } catch {
      setSelectedTags(previous);
      setError("Не удалось сохранить отметки. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function submitText() {
    if (busy || !onSubmitText || text.trim().length === 0) return;
    if (!isPhoneVerified) {
      onRequestPhoneVerification?.();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmitText(text.trim());
      setTextSaved(true);
    } catch {
      setError("Не удалось отправить комментарий. Текст сохранён в форме.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cn("space-y-5 rounded-2xl border border-border bg-background p-4 sm:p-6", className)}>
      <div>
        <h3 className="text-lg font-semibold" id={uid}>{question}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Выберите один вариант</p>
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby={uid}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={busy}
            aria-pressed={value === option.value}
            onClick={() => void chooseReaction(option.value)}
            className={cn(
              "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border px-1 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50",
              value === option.value
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            <span aria-hidden className="text-3xl">{option.icon}</span>
            <span className="text-xs font-semibold sm:text-sm">{option.label}</span>
          </button>
        ))}
      </div>

      {value !== null && saved ? (
        <p aria-live="polite" className="text-xs text-muted-foreground">Реакция сохранена</p>
      ) : null}

      {!isContent && value !== null && onSaveTags && allowedTags.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Что особенно запомнилось?</p>
          <p className="text-xs text-muted-foreground">Можно выбрать до {MAX_FEEDBACK_TAGS} вариантов</p>
          <div className="flex flex-wrap gap-2">
            {allowedTags.map((tag) => (
              <button
                type="button"
                key={tag.key}
                disabled={busy}
                aria-pressed={selectedTags.includes(tag.key)}
                onClick={() => void toggleTag(tag.key)}
                className={cn(
                  "min-h-11 rounded-full border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50",
                  selectedTags.includes(tag.key)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground",
                )}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!isContent && value !== null && onSubmitText ? (
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor={uid + "-comment"}>Хотите добавить пару слов?</label>
          <textarea
            id={uid + "-comment"}
            value={text}
            onChange={(event) => { setText(event.target.value); setTextSaved(false); }}
            maxLength={MAX_FEEDBACK_REVIEW_LENGTH}
            rows={2}
            placeholder="Что понравилось или что можно улучшить? Необязательно."
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {text.trim() ? (
            <>
              {!isPhoneVerified ? (
                <p className="text-xs text-muted-foreground">Чтобы опубликовать комментарий, подтвердите номер телефона. Введённый текст сохранится в форме.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Комментарий появится после модерации.</p>
              )}
              <button
                type="button"
                disabled={busy || (!isPhoneVerified && !onRequestPhoneVerification)}
                onClick={() => void submitText()}
                className="min-h-11 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {isPhoneVerified ? "Отправить комментарий" : "Подтвердить телефон"}
              </button>
              {textSaved ? <p role="status" className="text-sm text-muted-foreground">Комментарий отправлен на проверку</p> : null}
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
