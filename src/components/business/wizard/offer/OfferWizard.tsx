"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

import type { OfferFormData, OfferWizardMode, OfferWizardStepKey } from "./types";
import { getDefaultFormData, hasMeaningfulContent, determineIntent, suggestCTAType } from "./defaults";
import { validateStep, validateForSubmit } from "./validation";
import { 
  getStepsForOfferType, 
  getStepNumber, 
  getTotalStepsForType,
  isStepComplete,
  getMissingFieldsForStep,
  getNextStepKey,
  getPreviousStepKey,
} from "./offerWizardSteps.config";
import {
  buildOfferCreatePayload,
  buildOfferUpdatePayload,
  mapOfferToFormData,
} from "./mappers";
import { createClientSavePerf } from "@/lib/perf/clientSavePerf";

import { Step8Review } from "./steps/Step8Review";
import type { Role, Offer } from "@prisma/client";
import {
  defaultEditorNav,
  editorOfferEditHref,
  type ContentEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";

// Import step components
import { Step1Type } from "./steps/Step1Type";
import { Step2Information } from "./steps/Step2Information";
import { Step3Media } from "./steps/Step3Media";
import { Step4Conditions } from "./steps/Step4Conditions";
import { Step5Pricing } from "./steps/Step5Pricing";
import { Step6Contacts } from "./steps/Step6Contacts";
import { Step7Publication } from "./steps/Step7Publication";

interface OfferWizardProps {
  mode: OfferWizardMode;
  offer?: Offer;
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
  defaultPlaceId?: string | null;
  editorSurface?: ContentEditorSurface;
  contentEditorNav?: Partial<ContentEditorNav>;
  returnTo?: string;
}

const LOCAL_STORAGE_KEY = "offer-wizard-draft";

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
  
  const [formData, setFormData] = useState<OfferFormData>(() => {
    if (mode === "edit" && offer) {
      return mapOfferToFormData(offer);
    }
    return getDefaultFormData();
  });
  
  // Get steps based on current offer type
  const steps = getStepsForOfferType(formData.offerWizardType);
  const totalSteps = steps.length;
  
  // Current step key (not number)
  const [currentStepKey, setCurrentStepKey] = useState<OfferWizardStepKey>("type");
  
  // Normalize current step if offer type changes
  useEffect(() => {
    const currentStepNum = getStepNumber(formData.offerWizardType, currentStepKey);
    if (currentStepNum === null) {
      setCurrentStepKey("type");
    }
  }, [formData.offerWizardType, currentStepKey]);
  
  // Restore from localStorage after hydration
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
  
  const [offerId, setOfferId] = useState<string | null>(
    mode === "edit" && offer ? offer.id : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { wizardSessionId } = useWizardSession({
    userId,
    wizardType: "offer",
    entityId: mode === "edit" ? offer?.id : undefined,
  });

  // Autosave effect
  useEffect(() => {
    if (mode === "create" && typeof window !== "undefined") {
      const timer = setTimeout(() => {
        if (hasMeaningfulContent(formData)) {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
            setLastSaved(new Date());
          } catch (e) {
            console.error("Failed to save draft:", e);
          }
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [formData, mode]);

  // Auto-determine intent and CTA
  useEffect(() => {
    if (formData.offerKind) {
      const intent = determineIntent(formData);
      if (intent && intent !== formData.intent) {
        setFormData(prev => ({ ...prev, intent }));
      }

      const suggestedCTA = suggestCTAType(formData);
      if (suggestedCTA && !formData.ctaType) {
        setFormData(prev => ({ ...prev, ctaType: suggestedCTA }));
      }
    }
  }, [formData.offerKind, formData.durationType]);

  const handleChange = useCallback(
    (
      updates:
        | Partial<OfferFormData>
        | ((prev: OfferFormData) => Partial<OfferFormData>),
    ) => {
      setFormData((prev) => {
        const patch = typeof updates === "function" ? updates(prev) : updates;
        return { ...prev, ...patch };
      });
    },
    [],
  );

  // Navigation by step key
  const handleNext = () => {
    const nextKey = getNextStepKey(formData.offerWizardType, currentStepKey);
    if (nextKey) {
      setCurrentStepKey(nextKey);
    }
  };

  const handlePrev = () => {
    const prevKey = getPreviousStepKey(formData.offerWizardType, currentStepKey);
    if (prevKey) {
      setCurrentStepKey(prevKey);
    } else {
      router.push(afterSubmitDestination);
    }
  };

  const handleGoToStep = (step: number) => {
    const stepDef = steps[step - 1];
    if (stepDef) {
      setCurrentStepKey(stepDef.key);
    }
  };

  // Save as draft
  const handleSaveDraft = async () => {
    if (isSaving || isSubmitting) return;
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
        const createPayload = buildOfferCreatePayload(formData, placeId, { status: "DRAFT" });
        const response = await fetch("/api/business/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
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
    if (isSubmitting) return;
    const validation = validateForSubmit(formData);
    
    if (!validation.isValid) {
      toast.error("Заполните все обязательные поля");
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
        const createPayload = buildOfferCreatePayload(formData, placeId, { status: finalStatus });
        const createResponse = await fetch("/api/business/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
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

      const updatePayload = buildOfferUpdatePayload(formData, { status: "PENDING" });
      const response = await fetch(`/api/business/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
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
      }
    } catch (error: unknown) {
      console.error("Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка отправки");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditable = true;

  // Render current step
  const renderStep = () => {
    if (currentStepKey === "review") {
      return <Step8Review data={formData} isSubmitting={isSubmitting} onGoToStep={handleGoToStep} />;
    }
    
    const commonProps = {
      data: formData,
      onChange: handleChange,
      isEditable,
    };
    
    switch (currentStepKey) {
      case "type":
        return <Step1Type {...commonProps} />;
      case "details":
        return <Step2Information {...commonProps} />;
      case "photo":
        return <Step3Media {...commonProps} wizardSessionId={wizardSessionId} />;
      case "conditions":
        return <Step4Conditions {...commonProps} />;
      case "campSchedule":
        return <div className="p-4">Шаг "Смены и расписание" - в разработке</div>;
      case "accommodation":
        return <div className="p-4">Шаг "Размещение" - в разработке</div>;
      case "price":
        return <Step5Pricing {...commonProps} />;
      case "contacts":
        return <Step6Contacts {...commonProps} />;
      case "publication":
        return <Step7Publication {...commonProps} />;
      default:
        return null;
    }
  };

  const currentStepNum = getStepNumber(formData.offerWizardType, currentStepKey) || 1;
  const canNext = currentStepKey !== "review" && currentStepNum < totalSteps;
  const canPrev = true;
  const isReviewStep = currentStepKey === "review";

  const submitValidation = isReviewStep ? validateForSubmit(formData) : { isValid: true };

  const progressSteps = useMemo(
    () => [
      ...steps.map((s, idx) => ({
        id: idx + 1,
        label: s.shortLabel,
        isComplete: isStepComplete(s.key, formData),
      })),
    ],
    [formData, steps]
  );

  const phase = formWizardPhaseFromFlags({ isSaving, isSubmitting });
  const actionLabels = useMemo(() => getBusinessFormActionLabels(userRole), [userRole]);

  const currentStepDef = steps.find(s => s.key === currentStepKey);
  const stepTitle = currentStepDef?.title || "Шаг";

  return (
    <FormWizardShell>
      <FormWizardHeader
        title={
          mode === "create"
            ? businessFormCopy.offer.createTitle
            : businessFormCopy.offer.editTitle
        }
        subtitle={businessFormCopy.stepSubtitle(
          currentStepNum,
          totalSteps,
          isReviewStep ? businessFormCopy.reviewStepShortTitle : stepTitle
        )}
        trailing={lastSaved ? businessFormCopy.savedAt(lastSaved) : undefined}
      >
        <WizardProgress
          steps={progressSteps}
          currentStep={currentStepNum}
          onStepChange={handleGoToStep}
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
