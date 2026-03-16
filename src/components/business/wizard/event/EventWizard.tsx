"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Send, Save } from "lucide-react";
import { toast } from "sonner";
import { useWizardSession } from "@/hooks/useWizardSession";

import type { EventFormData, EventWizardMode } from "./types";
import { getDefaultFormData, hasMeaningfulContent } from "./defaults";
import { validateStep, validateForSubmit } from "./validation";
import { mapEventToFormData, buildEventPayload } from "./mappers";
import { EVENT_WIZARD_STEPS, getStepLabel, TOTAL_CONTENT_STEPS } from "./eventWizardSteps.config";

import { Step9Review } from "./steps/Step9Review";

interface EventWizardProps {
  mode: EventWizardMode;
  event?: any; // Event entity for edit mode
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
  onComplete?: (eventId: string) => void;
}

const LOCAL_STORAGE_KEY = "event-wizard-draft";
const TOTAL_STEPS = TOTAL_CONTENT_STEPS + 1; // Content steps + review step

export function EventWizard({ mode, event, userId, userRole, business, onComplete }: EventWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [eventId, setEventId] = useState<string | null>(
    mode === "edit" && event ? event.id : null
  );
  const [formData, setFormData] = useState<EventFormData>(() => {
    if (mode === "edit" && event) {
      return mapEventToFormData(event);
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
          
          // Migrate old structure to new structure
          const migrated = {
            ...defaults,
            ...parsed,
            // Ensure dates is array of strings, not objects
            dates: Array.isArray(parsed.dates) 
              ? parsed.dates.map((d: any) => typeof d === 'string' ? d : d.date || '')
              : [],
            // Ensure ageGroups exists (renamed from age)
            ageGroups: parsed.ageGroups || parsed.age || [],
            // Ensure fullDescription exists (renamed from description)
            fullDescription: parsed.fullDescription || parsed.description || "",
            // Ensure reelsUrl exists (renamed from videoLink)
            reelsUrl: parsed.reelsUrl || parsed.videoLink || "",
            // Ensure locationMode is correct (renamed from existing)
            locationMode: parsed.locationMode === "existing" ? "place" : parsed.locationMode || "place",
            // Flatten manualLocation if it exists
            venueName: parsed.venueName || parsed.manualLocation?.venueName || "",
            address: parsed.address || parsed.manualLocation?.address || "",
            city: parsed.city || parsed.manualLocation?.city || "",
            // Ensure socialLinks exists (renamed from socialNetworks)
            socialLinks: parsed.socialLinks || parsed.socialNetworks || [],
          };
          
          setFormData(migrated);
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
    wizardType: "event",
    entityId: mode === "edit" ? event?.id : undefined,
  });

  // Clear old localStorage data on mount (one-time migration)
  useEffect(() => {
    if (mode === "create" && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Check if it's old structure (has EventDate objects in dates array)
          if (parsed.dates && parsed.dates.length > 0 && typeof parsed.dates[0] === 'object') {
            console.log("Migrating old event wizard data structure");
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }
      } catch (e) {
        console.error("Migration check failed:", e);
      }
    }
  }, [mode]);

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

  // Update form data
  const handleChange = useCallback((updates: Partial<EventFormData>) => {
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
      const payload = buildEventPayload(formData);
      
      if (eventId) {
        // Update existing draft
        const response = await fetch(`/api/business/events/${eventId}`, {
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
        const response = await fetch("/api/business/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create draft");
        }
        
        const data = await response.json();
        setEventId(data.event.id);
        
        // Switch to edit mode
        router.replace(`/business/events/${data.event.id}/edit`);
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
      if (!eventId) {
        const payload = buildEventPayload(formData);
        const createResponse = await fetch("/api/business/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(error.error || "Failed to create event");
        }
        
        const createData = await createResponse.json();
        setEventId(createData.event.id);
        
        // Submit the newly created event
        const submitResponse = await fetch(`/api/business/events/${createData.event.id}/submit`, {
          method: "POST",
        });
        
        if (!submitResponse.ok) {
          const error = await submitResponse.json();
          throw new Error(error.error || "Failed to submit event");
        }
      } else {
        // Submit existing draft
        const response = await fetch(`/api/business/events/${eventId}/submit`, {
          method: "POST",
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to submit event");
        }
      }
      
      toast.success("Событие отправлено на модерацию");
      
      if (mode === "create" && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
      
      router.push("/business/events");
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Ошибка отправки");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if editable
  const isEditable = true; // TODO: Add proper logic

  // Check if form is valid for submission (only on review step)
  const submitValidation = currentStep === TOTAL_STEPS ? validateForSubmit(formData) : { isValid: true };

  // Render current step (config-driven)
  const renderStep = () => {
    // Review step is special case
    if (currentStep === TOTAL_STEPS) {
      return <Step9Review data={formData} isSubmitting={isSubmitting} onGoToStep={handleGoToStep} />;
    }
    
    // Find step config
    const stepConfig = EVENT_WIZARD_STEPS.find(s => s.id === currentStep);
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
    
    // Add userRole and business for organizer step
    if (currentStep === 8) {
      return <StepComponent 
        {...commonProps} 
        userRole={{ 
          role: userRole || "BUSINESS_OWNER", 
          business 
        }} 
      />;
    }
    
    return <StepComponent {...commonProps} />;
  };

  const canNext = currentStep < TOTAL_STEPS;
  const canPrev = currentStep > 1;
  const isReviewStep = currentStep === 9;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">
                {mode === "create" ? "Новое событие" : "Редактирование события"}
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
              {EVENT_WIZARD_STEPS.map((step) => (
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
                      disabled={isSubmitting || isSaving || !submitValidation.isValid}
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
