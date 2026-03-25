"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FormWizardShell,
  FormWizardHeader,
  FormStepSegments,
  FormPrimaryContentCard,
  FormStickyActionBar,
  formWizardPhaseFromFlags,
} from "@/components/form-shell";
import { getBusinessFormActionLabels, businessFormCopy } from "../businessFormLabels";
import { canPublishContentDirectly } from "@/lib/auth/businessContentAccess";
import { useWizardSession } from "@/hooks/useWizardSession";

import type { PlaceFormData, PlaceWizardMode } from "./types";
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

interface PlaceWizardProps {
  mode: PlaceWizardMode;
  place?: any; // Place entity for edit mode
  userId: string;
  userRole?: Role;
  onComplete?: (placeId: string) => void;
  /** When set (e.g. isolated /editor routes), drives list/edit URLs and post-submit navigation */
  editorSurface?: ContentEditorSurface;
  contentEditorNav?: Partial<ContentEditorNav>;
  /** Overrides default list/queue destination after submit */
  returnTo?: string;
}

const LOCAL_STORAGE_KEY = "place-wizard-draft";

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
  const [originalData] = useState<PlaceFormData>(() => 
    mode === "edit" && place ? mapPlaceToFormData(place) : getDefaultFormData()
  );

  /** Stable idempotency key for create — must match API contract. */
  const [createRequestId] = useState(() => crypto.randomUUID());

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
      const timer = setTimeout(() => {
        const changes = extractChanges(formData, originalData);
        if (Object.keys(changes).length > 0) {
          handleAutoSave(changes);
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [formData, mode]);

  // Auto-save for edit mode
  const handleAutoSave = async (changes: Partial<any>) => {
    if (!place?.id) return;
    
    try {
      const response = await fetch(`/api/business/places/${place.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      
      if (response.ok) {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error("Autosave failed:", error);
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
    setIsSaving(true);
    
    try {
      if (mode === "create") {
        const body = buildCreatePlaceRequestBody(
          formData,
          createRequestId,
          "DRAFT",
          wizardSessionId
        );

        const response = await fetch("/api/business/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

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
        const changes = extractChanges(formData, originalData);
        
        const response = await fetch(`/api/business/places/${place.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        
        if (!response.ok) {
          throw new Error("Failed to save");
        }
        
        toast.success("Изменения сохранены");
        router.refresh();
      }
    } catch (error: any) {
      console.error("Save draft error:", error);
      toast.error(error.message || "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  // Submit for moderation
  const handleSubmit = async () => {
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

        const response = await fetch("/api/business/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to submit");
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
          
          toast.success(
            canPublishContentDirectly(userRole)
              ? "Место опубликовано"
              : "Место отправлено на модерацию",
          );
        }

        if (onComplete) {
          onComplete(place.id);
        } else if (returnTo) {
          router.push(returnTo);
        } else if (surface === "admin") {
          router.push(nav.afterSubmitListPath);
        } else {
          router.refresh();
        }
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Ошибка отправки");
    } finally {
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
  const canPrev = currentStep > 1;
  const isReviewStep = currentStep === 6;

  const segments = useMemo(
    () => WIZARD_STEPS.map((s) => ({ id: s.id, title: s.label })),
    []
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
          <FormStepSegments
            segments={segments}
            currentStep={currentStep}
            onStepClick={handleGoToStep}
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
