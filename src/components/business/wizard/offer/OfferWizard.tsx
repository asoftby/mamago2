"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
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

import type { OfferFormData, OfferWizardMode } from "./types";
import { getDefaultFormData, hasMeaningfulContent, determineIntent, suggestCTAType } from "./defaults";
import { validateStep, validateForSubmit } from "./validation";
import { OFFER_WIZARD_STEPS, getStepLabel, TOTAL_CONTENT_STEPS as OFFER_TOTAL_CONTENT_STEPS } from "./offerWizardSteps.config";
import {
  buildOfferCreatePayload,
  buildOfferUpdatePayload,
  mapOfferToFormData,
} from "./mappers";

import { Step8Review } from "./steps/Step8Review";
import type { Role, Offer } from "@prisma/client";
import {
  defaultEditorNav,
  editorOfferEditHref,
  type ContentEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";

interface OfferWizardProps {
  mode: OfferWizardMode;
  offer?: Offer; // Offer entity for edit mode
  userId: string;
  userRole?: Role;
  business?: {
    id: string;
    name: string;
    description?: string;
    phone?: string;
    website?: string;
    logoUrl?: string;
  };
  onComplete?: (offerId: string) => void;
  /** Required for create — place to attach the offer (query or first owned place). */
  defaultPlaceId?: string | null;
  editorSurface?: ContentEditorSurface;
  contentEditorNav?: Partial<ContentEditorNav>;
  returnTo?: string;
}

const LOCAL_STORAGE_KEY = "offer-wizard-draft";
const TOTAL_STEPS = OFFER_TOTAL_CONTENT_STEPS + 1; // Content steps + review step

export function OfferWizard({
  mode,
  offer,
  userId,
  userRole,
  business,
  onComplete,
  defaultPlaceId,
  editorSurface,
  contentEditorNav,
  returnTo,
}: OfferWizardProps) {
  const router = useRouter();
  const surface: ContentEditorSurface = editorSurface ?? "business";
  const nav: ContentEditorNav = {
    ...defaultEditorNav(surface, "offer"),
    ...contentEditorNav,
  };
  const afterSubmitDestination = returnTo ?? nav.afterSubmitListPath;
  const [currentStep, setCurrentStep] = useState(1);
  const [offerId, setOfferId] = useState<string | null>(
    mode === "edit" && offer ? offer.id : null
  );
  const [formData, setFormData] = useState<OfferFormData>(() => {
    if (mode === "edit" && offer) {
      return mapOfferToFormData(offer);
    }
    
    // Always start with defaults to prevent hydration mismatch
    // localStorage restoration happens in useEffect
    return getDefaultFormData();
  });
  
  // Restore from localStorage after hydration to prevent mismatch
  useEffect(() => {
    if (mode === "create") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const defaults = getDefaultFormData();
          
          setFormData({
            ...defaults,
            ...parsed,
          });
        }
      } catch (e) {
        console.error("Failed to restore draft:", e);
      }
    }
  }, [mode]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Wizard session for temp media
  const { wizardSessionId } = useWizardSession({
    userId,
    wizardType: "offer",
    entityId: mode === "edit" ? offer?.id : undefined,
  });

  // Autosave effect with debounce
  useEffect(() => {
    if (mode === "create" && typeof window !== "undefined") {
      // Local autosave for create mode with debounce
      const timer = setTimeout(() => {
        if (hasMeaningfulContent(formData)) {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
            setLastSaved(new Date());
            setSaveError(null);
          } catch (e) {
            console.error("Failed to save draft:", e);
            setSaveError("Ошибка автосохранения");
          }
        }
      }, 2000); // 2 second debounce
      
      return () => clearTimeout(timer);
    }
  }, [formData, mode]);

  // Auto-determine intent and suggested CTA when relevant data changes
  useEffect(() => {
    if (formData.offerKind) {
      // Auto-determine intent
      const intent = determineIntent(formData);
      if (intent && intent !== formData.intent) {
        setFormData(prev => ({ ...prev, intent }));
      }

      // Auto-suggest CTA type
      const suggestedCTA = suggestCTAType(formData);
      if (suggestedCTA && !formData.ctaType) {
        setFormData(prev => ({ ...prev, ctaType: suggestedCTA }));
      }
    }
  }, [formData.offerKind, formData.durationType]);

  // Update form data
  const handleChange = useCallback((updates: Partial<OfferFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Navigation
  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
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
      const placeId =
        mode === "edit" && offer?.placeId
          ? offer.placeId
          : defaultPlaceId ?? undefined;

      if (mode === "create" && !placeId) {
        toast.error("Не выбрано место для предложения");
        return;
      }

      if (offerId) {
        const payload = buildOfferUpdatePayload(formData);
        const response = await fetch(`/api/business/offers/${offerId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update draft");
        }
      } else {
        if (!placeId) {
          toast.error("Не выбрано место для предложения");
          return;
        }
        const response = await fetch("/api/business/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildOfferCreatePayload(formData, placeId, { status: "DRAFT" })
          ),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create draft");
        }
        
        const data = await response.json();
        setOfferId(data.id);
        
        if (onComplete) {
          onComplete(data.id);
        } else {
          router.push(editorOfferEditHref(data.id));
        }
      }
      
      toast.success("Черновик сохранен");
      setLastSaved(new Date());
      
      if (mode === "create" && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    } catch (error: unknown) {
      console.error("Save draft error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  // Submit for moderation
  const handleSubmit = async () => {
    // Validate before submit
    const validation = validateForSubmit(formData);
    
    if (!validation.isValid) {
      toast.error("Заполните все обязательные поля");
      console.error("Validation errors:", validation.errors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const placeId =
        mode === "edit" && offer?.placeId
          ? offer.placeId
          : defaultPlaceId ?? undefined;

      if (mode === "create" && !placeId) {
        toast.error("Не выбрано место для предложения");
        return;
      }

      if (!offerId) {
        if (!placeId) {
          toast.error("Не выбрано место для предложения");
          return;
        }
        const finalStatus = canPublishContentDirectly(userRole) ? "PUBLISHED" : "PENDING";
        const createResponse = await fetch("/api/business/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildOfferCreatePayload(formData, placeId, { status: finalStatus })
          ),
        });
        
        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(error.error || "Failed to create offer");
        }
        
        const createData = await createResponse.json();
        setOfferId(createData.id);
        
        toast.success(
          finalStatus === "PUBLISHED"
            ? "Предложение опубликовано"
            : "Предложение отправлено на модерацию",
        );
        
        if (mode === "create" && typeof window !== "undefined") {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
        
        if (onComplete) {
          onComplete(createData.id);
        } else {
          router.push(afterSubmitDestination);
        }
        return;
      }

      const response = await fetch(`/api/business/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOfferUpdatePayload(formData, { status: "PENDING" })),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit offer");
      }

      toast.success("Предложение отправлено на модерацию");
      
      if (mode === "create" && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
      
      if (onComplete) {
        onComplete(offerId);
      } else if (mode === "create") {
        navigateToCompatibleHref(router, afterSubmitDestination);
      } else if (returnTo) {
        navigateToCompatibleHref(router, returnTo);
      } else if (surface === "admin") {
        navigateToCompatibleHref(router, nav.afterSubmitListPath);
      } else {
        router.refresh();
      }
    } catch (error: unknown) {
      console.error("Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка отправки");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if editable
  const isEditable = true; // TODO: Add proper logic

  // Render current step (config-driven)
  const renderStep = () => {
    // Review step is special case
    if (currentStep === TOTAL_STEPS) {
      return <Step8Review data={formData} isSubmitting={isSubmitting} onGoToStep={handleGoToStep} />;
    }
    
    // Find step config
    const stepConfig = OFFER_WIZARD_STEPS.find(s => s.id === currentStep);
    if (!stepConfig) return null;
    
    // Render step component from config
    const StepComponent = stepConfig.component;
    const commonProps = {
      data: formData,
      onChange: handleChange,
      isEditable,
    };
    
    // Add wizardSessionId for media step
    if (currentStep === 3) {
      return <StepComponent {...commonProps} wizardSessionId={wizardSessionId} />;
    }
    
    return <StepComponent {...commonProps} />;
  };

  const canNext = currentStep < TOTAL_STEPS;
  const canPrev = currentStep > 1;
  const isReviewStep = currentStep === TOTAL_STEPS;

  const submitValidation =
    currentStep === TOTAL_STEPS ? validateForSubmit(formData) : { isValid: true };

  const segments = useMemo(
    () => [
      ...OFFER_WIZARD_STEPS.map((s) => ({ id: s.id, title: s.title })),
      { id: TOTAL_STEPS, title: businessFormCopy.reviewStepShortTitle },
    ],
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
            ? businessFormCopy.offer.createTitle
            : businessFormCopy.offer.editTitle
        }
        subtitle={businessFormCopy.stepSubtitle(
          currentStep,
          TOTAL_STEPS,
          currentStep === TOTAL_STEPS
            ? businessFormCopy.reviewStepShortTitle
            : getStepLabel(currentStep)
        )}
        trailing={lastSaved ? businessFormCopy.savedAt(lastSaved) : undefined}
      >
        <FormStepSegments
          segments={segments}
          currentStep={currentStep}
          onStepClick={handleGoToStep}
        />
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
        continueDisabled={!canNext || isSaving || isSubmitting}
        onSubmit={isReviewStep ? handleSubmit : undefined}
        submitDisabled={
          isSubmitting || isSaving || !submitValidation.isValid
        }
      />
    </FormWizardShell>
  );
}
