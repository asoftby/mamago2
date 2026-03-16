"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Send, Save } from "lucide-react";
import { toast } from "sonner";
import { useWizardSession } from "@/hooks/useWizardSession";

import type { OfferFormData, OfferWizardMode } from "./types";
import { getDefaultFormData, hasMeaningfulContent, determineIntent, suggestCTAType } from "./defaults";
import { validateStep, validateForSubmit } from "./validation";
import { OFFER_WIZARD_STEPS, getStepLabel, TOTAL_CONTENT_STEPS } from "./offerWizardSteps.config";

import { Step8Review } from "./steps/Step8Review";

interface OfferWizardProps {
  mode: OfferWizardMode;
  offer?: any; // Offer entity for edit mode
  userId: string;
  userRole?: "BUSINESS_OWNER" | "ADMIN" | "MODERATOR";
  business?: {
    id: string;
    name: string;
    description?: string;
    phone?: string;
    website?: string;
    logoUrl?: string;
  };
  onComplete?: (offerId: string) => void;
}

const LOCAL_STORAGE_KEY = "offer-wizard-draft";
const TOTAL_STEPS = TOTAL_CONTENT_STEPS + 1; // Content steps + review step

export function OfferWizard({ mode, offer, userId, userRole, business, onComplete }: OfferWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [offerId, setOfferId] = useState<string | null>(
    mode === "edit" && offer ? offer.id : null
  );
  const [formData, setFormData] = useState<OfferFormData>(() => {
    if (mode === "edit" && offer) {
      // TODO: Add mapOfferToFormData function
      return getDefaultFormData();
    }
    
    // Create mode: try to restore from localStorage (client-side only)
    if (mode === "create" && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const defaults = getDefaultFormData();
          
          return {
            ...defaults,
            ...parsed,
          };
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
      // TODO: Add buildOfferPayload function
      const payload = formData;
      
      if (offerId) {
        // Update existing draft
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
        // Create new draft
        const response = await fetch("/api/business/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create draft");
        }
        
        const data = await response.json();
        setOfferId(data.offer.id);
        
        // Switch to edit mode
        router.replace(`/business/offers/${data.offer.id}/edit`);
      }
      
      toast.success("Черновик сохранен");
      setLastSaved(new Date());
      
      if (mode === "create" && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
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
    // Validate before submit
    const validation = validateForSubmit(formData);
    
    if (!validation.isValid) {
      toast.error("Заполните все обязательные поля");
      console.error("Validation errors:", validation.errors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // First save as draft if not saved yet
      if (!offerId) {
        // TODO: Add buildOfferPayload function
        const payload = formData;
        const createResponse = await fetch("/api/business/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(error.error || "Failed to create offer");
        }
        
        const createData = await createResponse.json();
        setOfferId(createData.offer.id);
        
        // Submit the newly created offer
        const submitResponse = await fetch(`/api/business/offers/${createData.offer.id}/submit`, {
          method: "POST",
        });
        
        if (!submitResponse.ok) {
          const error = await submitResponse.json();
          throw new Error(error.error || "Failed to submit offer");
        }
      } else {
        // Submit existing draft
        const response = await fetch(`/api/business/offers/${offerId}/submit`, {
          method: "POST",
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to submit offer");
        }
      }
      
      toast.success("Предложение отправлено на модерацию");
      
      if (mode === "create" && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
      
      router.push("/business/offers");
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Ошибка отправки");
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
  const isReviewStep = currentStep === 8;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">
                {mode === "create" ? "Новое предложение" : "Редактирование предложения"}
              </h1>
              {lastSaved && (
                <div className="text-xs text-muted-foreground">
                  Сохранено {lastSaved.toLocaleTimeString()}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Шаг {currentStep} из {TOTAL_STEPS}: {getStepLabel(currentStep)}
              </p>
            </div>
          </div>
          
          {/* Step Progress with Navigation */}
          <div className="space-y-3">
            <div className="flex gap-2">
              {/* Content steps from config */}
              {OFFER_WIZARD_STEPS.map((step) => (
                <button
                  key={step.id}
                  onClick={() => handleGoToStep(step.id)}
                  className={`flex-1 h-2 rounded-full transition-colors ${
                    step.id === currentStep
                      ? "bg-primary"
                      : step.id < currentStep
                      ? "bg-primary/50"
                      : "bg-gray-200"
                  }`}
                  title={step.title}
                />
              ))}
              {/* Review step */}
              <button
                onClick={() => handleGoToStep(TOTAL_STEPS)}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  TOTAL_STEPS === currentStep
                    ? "bg-primary"
                    : TOTAL_STEPS < currentStep
                    ? "bg-primary/50"
                    : "bg-gray-200"
                }`}
                title="Проверка"
              />
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {canPrev && (
                  <Button
                    variant="outline"
                    onClick={handlePrev}
                    disabled={isSaving || isSubmitting}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Назад
                  </Button>
                )}
              </div>

              <div className="flex gap-3">
                {isReviewStep ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={isSaving || isSubmitting}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? "Сохранение..." : "Сохранить черновик"}
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || isSaving}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isSubmitting ? "Отправка..." : "Отправить на модерацию"}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={!canNext || isSaving || isSubmitting}
                  >
                    Далее
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border p-8">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}