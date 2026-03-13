"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Send, Save } from "lucide-react";
import { toast } from "sonner";
import { useWizardSession } from "@/hooks/useWizardSession";
import { ContentStatus } from "@prisma/client";

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

interface PlaceWizardProps {
  mode: PlaceWizardMode;
  place?: any; // Place entity for edit mode
  userId: string;
  onComplete?: (placeId: string) => void;
}

const LOCAL_STORAGE_KEY = "place-wizard-draft";

export function PlaceWizard({ mode, place, userId, onComplete }: PlaceWizardProps) {
  const router = useRouter();
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
        // Create new place as draft
        const payload = {
          ...buildPlacePayload(formData),
          status: ContentStatus.DRAFT,
          ownerUserId: userId,
        };
        
        const response = await fetch("/api/business/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          throw new Error("Failed to save draft");
        }
        
        const result = await response.json();
        
        // Clear local draft
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        
        toast.success("Черновик сохранен");
        
        if (onComplete) {
          onComplete(result.place.id);
        } else {
          router.push(`/business/places/${result.place.id}/edit`);
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
        // Create and submit
        const payload = {
          ...buildPlacePayload(formData),
          status: ContentStatus.PENDING,
          ownerUserId: userId,
        };
        
        // Include opening hours if configured
        if (formData.openingHoursData) {
          (payload as any).openingHoursData = formData.openingHoursData;
        }
        
        const response = await fetch("/api/business/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to submit");
        }
        
        const result = await response.json();
        
        // Clear local draft
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        
        toast.success("Место отправлено на модерацию");
        
        if (onComplete) {
          onComplete(result.place.id);
        } else {
          router.push("/business/places");
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
          
          toast.success("Место отправлено на модерацию");
        }
        
        router.refresh();
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
        return <Step6Review data={formData} isSubmitting={isSubmitting} />;
      default:
        return null;
    }
  };

  const stepValidation = validateStep(currentStep, formData);
  const canNext = currentStep < TOTAL_STEPS;
  const canPrev = currentStep > 1;
  const isReviewStep = currentStep === 6;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">
                {mode === "create" ? "Новое место" : "Редактирование места"}
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
              <CompletionProgress data={formData} />
            </div>
          </div>
          
          {/* Step Progress with Navigation */}
          <div className="space-y-3">
            <div className="flex gap-2">
              {WIZARD_STEPS.map((step) => (
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
                  title={step.label}
                />
              ))}
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
                      disabled={!stepValidation.isValid || isSubmitting || isSaving}
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
