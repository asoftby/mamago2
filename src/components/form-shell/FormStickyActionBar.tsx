"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Save, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormWizardActionLabels, FormWizardUiPhase } from "./types";

export interface FormStickyActionBarProps {
  phase: FormWizardUiPhase;
  labels: FormWizardActionLabels;
  showBack: boolean;
  onBack?: () => void;
  showSaveDraft: boolean;
  onSaveDraft?: () => void;
  saveDraftDisabled?: boolean;
  /** Middle / non-review step: primary = continue */
  isReviewStep: boolean;
  onContinue?: () => void;
  continueDisabled?: boolean;
  /** Review step: primary = submit for moderation (or other final action) */
  onSubmit?: () => void;
  submitDisabled?: boolean;
  className?: string;
}

function phaseBlocksActions(phase: FormWizardUiPhase): boolean {
  return phase === "loading" || phase === "savingDraft" || phase === "submitting";
}

/**
 * Unified bottom actions for multi-step entity forms.
 * Copy (moderation, drafts, etc.) comes from `labels` — not hardcoded here.
 */
export function FormStickyActionBar({
  phase,
  labels,
  showBack,
  onBack,
  showSaveDraft,
  onSaveDraft,
  saveDraftDisabled,
  isReviewStep,
  onContinue,
  continueDisabled,
  onSubmit,
  submitDisabled,
  className,
}: FormStickyActionBarProps) {
  const busy = phaseBlocksActions(phase);
  const saving = phase === "savingDraft";
  const submitting = phase === "submitting";

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90",
        className
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-h-10 items-center justify-start gap-2">
          {showBack && onBack && (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onBack}
              disabled={busy}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              {labels.back}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {isReviewStep && showSaveDraft && onSaveDraft && (
            <Button
              type="button"
              variant="outline"
              onClick={onSaveDraft}
              disabled={busy || saveDraftDisabled}
              className="gap-2"
            >
              <Save className="h-4 w-4 shrink-0" />
              {saving ? labels.savingDraft : labels.saveDraft}
            </Button>
          )}

          {!isReviewStep && onContinue && (
            <Button
              type="button"
              onClick={onContinue}
              disabled={busy || continueDisabled}
              className="gap-2"
            >
              {labels.next}
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Button>
          )}

          {isReviewStep && onSubmit && (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={busy || submitDisabled}
              className="gap-2"
            >
              <Send className="h-4 w-4 shrink-0" />
              {submitting ? labels.submitting : labels.submit}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
