"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  FormWizardShell,
  FormWizardHeader,
  FormPrimaryContentCard,
  FormStickyActionBar,
  formWizardPhaseFromFlags,
} from "@/components/form-shell";
import { WizardProgress } from "@/components/ui/wizard-progress";
import { getBusinessFormActionLabels, businessFormCopy } from "../businessFormLabels";
import { canPublishContentDirectly } from "@/lib/auth/businessContentAccess";
import { useWizardSession } from "@/hooks/useWizardSession";

import type { PlaceFormData, PlaceWizardMode } from "./types";
import type { Place } from "@prisma/client";
import { createClientSavePerf } from "@/lib/perf/clientSavePerf";
import { WIZARD_STEPS, TOTAL_STEPS, getStepLabel } from "./config";
import { getDefaultFormData, hasMeaningfulContent } from "./defaults";
import { mapPlaceToFormData, buildPlacePayload, extractChanges } from "./mappers";
import { validateStep, validateForSubmit, canGoToNextStep, canGoToPrevStep } from "./validation";

import { Step1Profile } from "./steps/Step1Profile";
import { Step2Location } from "./steps/Step2Location";
import { Step3Contacts } from "./steps/Step3Contacts";
import { Step4Photos } from "./steps/Step4Photos";
import { Step5OpeningHours } from "./steps/Step5OpeningHours";
import { Step6Review } from "./steps/Step6Review";
import { CompletionProgress } from "./CompletionProgress";
import {
  defaultNavForSurface,
  editorPlaceEditHref,
  type ContentEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import type { Role } from "@prisma/client";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";

const LOCAL_STORAGE_KEY = "place-wizard-draft";

/**
 * Validate returnTo URL to prevent open redirects
 */
function isValidReturnTo(url: string | undefined): boolean {
  if (!url) return false;
  // Only allow internal paths starting with /
  if (!url.startsWith("/")) return false;
  // Prevent protocol-based redirects
  if (url.includes("://") || url.startsWith("//")) return false;
  return true;
}

function parseJsonErrorPayload(text: string): { message?: string; error?: string } {
  try {
    return JSON.parse(text) as { message?: string; error?: string };
  } catch {
    return { message: text };
  }
}

interface PlaceWizardProps {
  mode: PlaceWizardMode;
  place?: Place; // Place entity for edit mode
  userId: string;
  userRole?: Role;
  onComplete?: (placeId: string) => void;
  /** When set (e.g. isolated /editor routes), drives list/edit URLs and post-submit navigation */
  editorSurface?: ContentEditorSurface;
  contentEditorNav?: Partial<ContentEditorNav>;
  /** Overrides default list/queue destination after submit */
  returnTo?: string;
}

/** POST /api/business/places expects { createRequestId, status, data } — not a flat payload. */
function buildCreatePlaceRequestBody(
  formData: PlaceFormData,
  createRequestId: string,
  status: "DRAFT" | "PENDING" | "PUBLISHED",
  wizardSessionId: string | undefined
) {
  const data: Record<string, unknown> = {
    ...buildPlacePayload(formData),
  };
  if (wizardSessionId) {
    data.wizardSessionId = wizardSessionId;
  }
  if (formData.openingHoursData) {
    data.openingHoursData = formData.openingHoursData;
  }
  return {
    createRequestId,
    status,
    data,
  };
}

export function PlaceWizard({
  mode,
  place,
  userId,
  userRole,
  onComplete,
  editorSurface,
  contentEditorNav,
  returnTo,
}: PlaceWizardProps) {
  const router = useRouter();
  const surface: ContentEditorSurface = editorSurface ?? "business";
  const nav: ContentEditorNav = {
    ...defaultNavForSurface(surface),
    ...contentEditorNav,
  };
  const afterSubmitDestination = returnTo ?? nav.afterSubmitListPath;
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PlaceFormData>(() => {
    if (mode === "edit" && place) {
      return mapPlaceToFormData(place);
    }

    // Create mode: try to restore from localStorage
    if (mode === "create") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...getDefaultFormData(), ...parsed };
        }
      } catch (e) {
        console.error("Failed to restore draft:", e);
      }
    }

    return getDefaultFormData();
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [originalData, setOriginalData] = useState<PlaceFormData>(() =>
    mode === "edit" && place ? mapPlaceToFormData(place) : getDefaultFormData()
  );
  const autosaveInFlightRef = useRef(false);

  /** Stable idempotency key for create — must match API contract. */
  const [createRequestId] = useState(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Fallback for non-secure contexts
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  });

  // Wizard session for temp media
  const { wizardSessionId, clearSession } = useWizardSession({
    userId,
    wizardType: "place",
    entityId: mode === "edit" ? place?.id : undefined,
  });

  // Autosave effect
  useEffect(() => {
    if (mode === "create") {
      // Local autosave for create mode
      const timer = setTimeout(() => {
        if (hasMeaningfulContent(formData)) {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
            setLastSaved(new Date());
          } catch (e) {
            console.error("Failed to save draft:", e);
          }
        }
      }, 1000);

      return () => clearTimeout(timer);
    } else if (mode === "edit") {
      // API autosave for edit mode
      if (isSaving || isSubmitting || autosaveInFlightRef.current) {
        return;
      }
      const timer = setTimeout(() => {
        const changes = extractChanges(formData, originalData);
        if (Object.keys(changes).length > 0) {
          handleAutoSave(changes);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [formData, mode, originalData, isSaving, isSubmitting]);

  // Auto-save for edit mode
  const handleAutoSave = async (changes: Partial<PlaceFormData>) => {
    if (!place?.id || autosaveInFlightRef.current || isSaving || isSubmitting) return;

    try {
      autosaveInFlightRef.current = true;
      const perf = createClientSavePerf("save-place:client", {
        endpoint: `/api/business/places/${place.id}`,
        payload: changes,
      });
      const response = await fetch(`/api/business/places/${place.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (response.ok) {
        setLastSaved(new Date());
        setOriginalData((prev) => ({ ...prev, ...changes }));
      }
      perf.log({ status: response.status, mode: "autosave" });
    } catch (error) {
      console.error("Autosave failed:", error);
    } finally {
      autosaveInFlightRef.current = false;
    }
  };

  // Update form data
  const handleChange = useCallback((updates: Partial<PlaceFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Navigation
  const handleNext = () => {
    if (currentStep < TOTAL_STEPS && canGoToNextStep(currentStep, formData)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    // On first step, go back to where user came from
    if (currentStep === 1) {
      router.push(afterSubmitDestination);
      return;
    }

    if (currentStep > 1 && canGoToPrevStep(currentStep)) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleGoToStep = (step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
    }
  };

  // Save as draft
  const handleSaveDraft = async () => {
    if (isSaving || isSubmitting) return;
    setIsSaving(true);

    try {
      if (mode === "create") {
        const body = buildCreatePlaceRequestBody(
          formData,
          createRequestId,
          "DRAFT",
          wizardSessionId
        );
        const perf = createClientSavePerf("save-place:client", {
          endpoint: "/api/business/places",
          payload: body,
        });

        const response = await fetch("/api/business/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        perf.log({ status: response.status, mode: "create-draft" });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            (err as { message?: string }).message ||
              (err as { error?: string }).error ||
              "Failed to save draft"
          );
        }

        const result = await response.json();

        // Clear local draft
        localStorage.removeItem(LOCAL_STORAGE_KEY);

        toast.success("Черновик сохранен");

        if (onComplete) {
          onComplete(result.place.id);
        } else {
          router.push(editorPlaceEditHref(result.place.id));
        }
      } else {
        // Update existing place
        if (!place) {
          toast.error("Ошибка: данные места отсутствуют");
          setIsSaving(false);
          return;
        }
        const changes = extractChanges(formData, originalData);
        if (Object.keys(changes).length === 0) {
          toast.success("Изменения уже сохранены");
          return;
        }
        const perf = createClientSavePerf("save-place:client", {
          endpoint: `/api/business/places/${place.id}`,
          payload: changes,
        });

        const response = await fetch(`/api/business/places/${place.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        perf.log({ status: response.status, mode: "save-draft" });

        if (!response.ok) {
          throw new Error("Failed to save");
        }

        setOriginalData(formData);
        toast.success("Изменения сохранены");
      }
    } catch (error: unknown) {
      console.error("Save draft error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  // Save and close (edit mode only)
  const handleSaveAndClose = async () => {
    if (mode !== "edit" || !place) {
      toast.error("Ошибка: данные места отсутствуют");
      return;
    }
    if (isSaving || isSubmitting) return;

    setIsSaving(true);

    try {
      const changes = extractChanges(formData, originalData);
      if (Object.keys(changes).length === 0) {
        if (isValidReturnTo(returnTo)) {
          navigateToCompatibleHref(router, returnTo!);
        } else {
          router.back();
        }
        return;
      }

      console.log("[PlaceWizard] Saving changes:", changes);
      console.log("[PlaceWizard] Place status:", formData.status);
      console.log("[PlaceWizard] User role:", userRole);

      // ADMIN может редактировать опубликованные места напрямую
      // Остальные пользователи должны создавать ревизию
      const isPublished = formData.status === "PUBLISHED";
      const isAdmin = userRole === "ADMIN";
      const needsRevision = isPublished && !isAdmin;

      if (needsRevision) {
        console.log("[PlaceWizard] Published place (non-admin) - using revision flow");

        // 1. Получить или создать ревизию
        const revisionResponse = await fetch(`/api/business/places/${place.id}/revision`, {
          method: "GET",
        });

        if (!revisionResponse.ok) {
          const errorText = await revisionResponse.text();
          console.error("[PlaceWizard] Failed to get revision:", errorText);
          throw new Error("Не удалось создать ревизию");
        }

        const { revision } = await revisionResponse.json();
        console.log("[PlaceWizard] Got revision:", revision.id);

        // 2. Сохранить изменения в ревизию
        const saveResponse = await fetch(`/api/business/places/${place.id}/revision`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revisionId: revision.id,
            data: changes,
          }),
        });

        console.log("[PlaceWizard] Revision save response:", saveResponse.status, saveResponse.statusText);

        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          console.error("[PlaceWizard] Failed to save revision:", errorText);
          const errorData = parseJsonErrorPayload(errorText);

          const errorMessage = errorData.message || errorData.error || "Failed to save revision";
          throw new Error(errorMessage);
        }

        console.log("[PlaceWizard] Revision saved successfully");
        setOriginalData(formData);
        toast.success("Изменения отправлены на модерацию");
      } else {
        // Для черновиков или ADMIN - прямое сохранение
        console.log("[PlaceWizard] Direct save:", isAdmin ? "(ADMIN)" : "(DRAFT)");

        const response = await fetch(`/api/business/places/${place.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });

        console.log("[PlaceWizard] Response status:", response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[PlaceWizard] Error response text:", errorText);
          const errorData = parseJsonErrorPayload(errorText);

          console.error("[PlaceWizard] Failed to save place:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            changes,
          });

          const errorMessage = errorData.message || errorData.error || "Failed to save";
          throw new Error(errorMessage);
        }

        console.log("[PlaceWizard] Save successful");
        setOriginalData(formData);
        toast.success("Изменения сохранены");
      }

      // Navigate back to returnTo or fallback
      if (isValidReturnTo(returnTo)) {
        navigateToCompatibleHref(router, returnTo!); // TypeScript: we know it's not undefined from isValidReturnTo check
      } else {
        router.back();
      }
    } catch (error: unknown) {
      console.error("Save and close error:", error);
      const errorMessage = error instanceof Error ? error.message : "Не удалось сохранить изменения";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit for moderation
  const handleSubmit = async () => {
    if (isSubmitting) return;
    // Validate
    const validation = validateForSubmit(formData);
    if (!validation.isValid) {
      toast.error("Заполните все обязательные поля");
      // Go to first incomplete step
      for (let i = 1; i <= TOTAL_STEPS; i++) {
        const stepValidation = validateStep(i, formData);
        if (!stepValidation.isComplete && i < 6) {
          setCurrentStep(i);
          break;
        }
      }
      return;
    }

    console.time("[publish:place:client]");
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        const publishDirect = canPublishContentDirectly(userRole);
        const body = buildCreatePlaceRequestBody(
          formData,
          createRequestId,
          publishDirect ? "PUBLISHED" : "PENDING",
          wizardSessionId
        );
        const perf = createClientSavePerf("publish-place:client", {
          endpoint: "/api/business/places",
          payload: body,
        });

        const response = await fetch("/api/business/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        perf.log({ status: response.status, mode: publishDirect ? "publish" : "submit" });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || error.error || "Failed to submit");
        }

        const result = await response.json();

        // Clear local draft
        localStorage.removeItem(LOCAL_STORAGE_KEY);

        toast.success(
          publishDirect ? "Место опубликовано" : "Место отправлено на модерацию",
        );

        if (onComplete) {
          onComplete(result.place.id);
        } else {
          router.push(afterSubmitDestination);
        }
      } else {
        // Submit existing place or create revision
        if (!place) {
            toast.error("Ошибка: данные места отсутствуют");
            setIsSubmitting(false);
            return;
          }
          if (place.status === "PUBLISHED") {
          // Create revision for published place
          const changes = extractChanges(formData, originalData);

          const response = await fetch(`/api/business/places/${place.id}/revision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              changes,
              openingHoursData: formData.openingHoursData,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to submit revision");
          }

          setOriginalData(formData);
          toast.success("Изменения отправлены на модерацию");
        } else {
          // Submit draft place
          const response = await fetch(`/api/business/places/${place.id}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              openingHoursData: formData.openingHoursData,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to submit");
          }

          setOriginalData(formData);
          toast.success(
            canPublishContentDirectly(userRole)
              ? "Место опубликовано"
              : "Место отправлено на модерацию",
          );
        }

        if (onComplete) {
          onComplete(place.id);
        } else if (returnTo) {
          navigateToCompatibleHref(router, returnTo);
        } else if (surface === "admin") {
          navigateToCompatibleHref(router, nav.afterSubmitListPath);
        }
      }
    } catch (error: unknown) {
      console.error("Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка отправки");
    } finally {
      console.timeEnd("[publish:place:client]");
      setIsSubmitting(false);
    }
  };

  // Determine if editable
  const isEditable = mode === "create" ||
    (mode === "edit" && place?.status !== "PENDING");

  // Render current step
  const renderStep = () => {
    const commonProps = {
      data: formData,
      onChange: handleChange,
      isEditable,
    };

    switch (currentStep) {
      case 1:
        return <Step1Profile {...commonProps} />;
      case 2:
        return <Step2Location {...commonProps} />;
      case 3:
        return <Step3Contacts {...commonProps} />;
      case 4:
        return <Step4Photos {...commonProps} wizardSessionId={wizardSessionId} />;
      case 5:
        return <Step5OpeningHours {...commonProps} />;
      case 6:
        return <Step6Review data={formData} isSubmitting={isSubmitting} onGoToStep={handleGoToStep} />;
      default:
        return null;
    }
  };

  const stepValidation = validateStep(currentStep, formData);
  const canNext = currentStep < TOTAL_STEPS;
  const canPrev = true; // Always show back button (on step 1 it goes to returnTo)
  const isReviewStep = currentStep === 6;

  const segments = useMemo(
    () => WIZARD_STEPS.map((s) => ({ id: s.id, title: s.label })),
    []
  );

  const progressSteps = useMemo(
    () => WIZARD_STEPS.map((s) => ({
      id: s.id,
      label: s.label,
      isComplete: s.id < currentStep,
    })),
    [currentStep]
  );

  const phase = formWizardPhaseFromFlags({ isSaving, isSubmitting });

  const actionLabels = useMemo(
    () => getBusinessFormActionLabels(userRole),
    [userRole],
  );

  return (
    <FormWizardShell>
      <FormWizardHeader
        title={
          mode === "create"
            ? businessFormCopy.place.createTitle
            : businessFormCopy.place.editTitle
        }
        subtitle={businessFormCopy.stepSubtitle(
          currentStep,
          TOTAL_STEPS,
          getStepLabel(currentStep)
        )}
        trailing={lastSaved ? businessFormCopy.savedAt(lastSaved) : undefined}
      >
        <div className="space-y-3">
          <WizardProgress
            steps={progressSteps}
            currentStep={currentStep}
            onStepChange={handleGoToStep}
          />
          <div className="flex justify-end">
            <CompletionProgress data={formData} />
          </div>
        </div>
      </FormWizardHeader>

      <FormPrimaryContentCard>{renderStep()}</FormPrimaryContentCard>

      <FormStickyActionBar
        phase={phase}
        labels={actionLabels}
        showBack={canPrev}
        onBack={handlePrev}
        showSaveDraft={isReviewStep}
        onSaveDraft={isReviewStep ? handleSaveDraft : undefined}
        saveDraftDisabled={isSaving || isSubmitting}
        showSaveAndClose={mode === "edit" && !isReviewStep}
        onSaveAndClose={mode === "edit" ? handleSaveAndClose : undefined}
        saveAndCloseDisabled={isSaving || isSubmitting}
        isReviewStep={isReviewStep}
        onContinue={!isReviewStep ? handleNext : undefined}
        continueDisabled={
          !canNext ||
          isSaving ||
          isSubmitting ||
          !canGoToNextStep(currentStep, formData)
        }
        onSubmit={isReviewStep ? handleSubmit : undefined}
        submitDisabled={
          !stepValidation.isValid || isSubmitting || isSaving
        }
      />
    </FormWizardShell>
  );
}
