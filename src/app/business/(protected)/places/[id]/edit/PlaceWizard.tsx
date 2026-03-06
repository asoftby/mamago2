"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Place, PlaceImage } from "@prisma/client";
import { WizardHeaderNew } from "./components/WizardHeaderNew";
import { Step1Profile } from "./steps/Step1Profile";
import { Step2Location } from "./steps/Step2Location";
import { Step3Photos } from "./steps/Step3Photos";
import { Step4Contacts } from "./steps/Step4Contacts";
import { AlertCircle } from "lucide-react";
import {
  getStepStatus,
  canGoToNextStep,
  canGoToPrevStep,
  canGoToStep,
  validateStep3,
} from "./utils/stepValidation";
import { toast } from "sonner";

interface PlaceWithImages extends Place {
  images: PlaceImage[];
}

interface PlaceWizardProps {
  place: PlaceWithImages;
  initialStep: number;
  moderationMessage?: string | null;
}

export function PlaceWizard({ place: initialPlace, initialStep, moderationMessage }: PlaceWizardProps) {
  const router = useRouter();
  const [place, setPlace] = useState<PlaceWithImages>(initialPlace);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Manual save state
  const [isDirty, setIsDirty] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Partial<Place>>({});

  // Update URL when step changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("step", currentStep.toString());
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [currentStep, router]);

  // Warn before leaving if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "У вас есть несохранённые изменения. Вы уверены, что хотите покинуть страницу?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const saveDraft = useCallback(async () => {
    if (!isDirty || Object.keys(pendingChanges).length === 0) {
      console.log("[PlaceWizard] No changes to save");
      return true;
    }

    setIsSaving(true);
    try {
      console.log("[PlaceWizard] Saving draft:", pendingChanges);
      
      const res = await fetch(`/api/business/places/${place.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingChanges),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("[PlaceWizard] Save failed:", errorData);
        throw new Error(errorData.message || errorData.error || "Failed to save");
      }

      const { place: updatedPlace } = await res.json();
      
      // Update place with server response
      setPlace((prev) => ({ ...prev, ...updatedPlace }));
      
      // Clear dirty state
      setIsDirty(false);
      setPendingChanges({});
      setLastSaved(new Date());
      
      toast.success("Черновик сохранён");
      return true;
    } catch (error) {
      console.error("[PlaceWizard] Save error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, pendingChanges, place.id]);

  const handleStepClick = async (targetStep: number) => {
    if (!canGoToStep(targetStep, currentStep, place)) {
      return;
    }

    // Save if dirty before navigating
    if (isDirty) {
      const saved = await saveDraft();
      if (!saved) {
        return; // Don't navigate if save failed
      }
    }

    setCurrentStep(targetStep);
  };

  const handleNext = async () => {
    // Save if dirty before navigating
    if (isDirty) {
      const saved = await saveDraft();
      if (!saved) {
        return; // Don't navigate if save failed
      }
    }

    if (currentStep === 4) {
      // Last step - submit
      handleSubmit();
    } else if (canGoToNextStep(currentStep, place)) {
      setCurrentStep(currentStep + 1);
    } else {
      toast.error("Заполните обязательные поля для продолжения");
    }
  };

  const handlePrev = async () => {
    // Save if dirty before navigating
    if (isDirty) {
      const saved = await saveDraft();
      if (!saved) {
        return; // Don't navigate if save failed
      }
    }

    if (canGoToPrevStep(currentStep)) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleUpdate = (updates: Partial<Place> & { images?: PlaceImage[] }) => {
    // Extract images if provided
    const { images: updatedImages, ...placeUpdates } = updates;
    
    console.log("[PlaceWizard] handleUpdate called:", {
      hasImages: !!updatedImages,
      imagesCount: updatedImages?.length || 0,
      placeUpdates: Object.keys(placeUpdates),
    });
    
    // Optimistic UI update
    setPlace((prev) => {
      const updated = { 
        ...prev, 
        ...placeUpdates,
        ...(updatedImages && { images: updatedImages })
      };
      
      // Log validation status after update
      if (updatedImages) {
        console.log("[PlaceWizard] After update - Step 3 valid:", validateStep3(updated));
      }
      
      return updated;
    });
    
    // Track changes for manual save (exclude images from pendingChanges)
    if (Object.keys(placeUpdates).length > 0) {
      setPendingChanges((prev) => ({ ...prev, ...placeUpdates }));
      setIsDirty(true);
    }
  };

  const handleSubmit = async () => {
    // Save draft first if dirty
    if (isDirty) {
      const saved = await saveDraft();
      if (!saved) {
        toast.error("Сначала сохраните изменения");
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/business/places/${place.id}/submit`, {
        method: "POST",
      });

      const data = await res.json();

      if (data.error === "VALIDATION") {
        toast.error(`Ошибки валидации:\n${data.missing.join("\n")}`);
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || "Failed to submit");
      }

      // Redirect to success page
      router.push(`/business/places/${place.id}/submitted`);
    } catch (error) {
      console.error("[PlaceWizard] Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка при отправке");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <WizardHeaderNew
        currentStep={currentStep}
        totalSteps={4}
        status={place.status}
        isSaving={isSaving}
        isDirty={isDirty}
        lastSaved={lastSaved}
        onStepClick={handleStepClick}
        onSaveDraft={saveDraft}
        canGoNext={currentStep === 4 ? true : canGoToNextStep(currentStep, place)}
        getStepStatus={(step) => getStepStatus(step, currentStep, place)}
        place={place}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Moderation Message Banner */}
        {place.status === "NEEDS_CHANGES" && moderationMessage && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                  Требуется исправление
                </h3>
                <p className="text-sm text-yellow-700 whitespace-pre-wrap">
                  {moderationMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {place.status === "REJECTED" && moderationMessage && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-red-800 mb-1">
                  Место отклонено
                </h3>
                <p className="text-sm text-red-700 whitespace-pre-wrap">
                  {moderationMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Unsaved Changes Warning */}
        {isDirty && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-amber-600 mr-3 flex-shrink-0" />
                <p className="text-sm font-medium text-amber-800">
                  Есть несохранённые изменения
                </p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <Step1Profile
            place={place}
            onUpdate={handleUpdate}
            onNext={handleNext}
            canNext={canGoToNextStep(currentStep, place)}
          />
        )}

        {currentStep === 2 && (
          <Step2Location
            place={place}
            onUpdate={handleUpdate}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={canGoToNextStep(currentStep, place)}
          />
        )}

        {currentStep === 3 && (
          <Step3Photos
            place={place}
            images={place.images}
            onUpdate={handleUpdate}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={canGoToNextStep(currentStep, place)}
          />
        )}

        {currentStep === 4 && (
          <Step4Contacts
            place={place}
            onUpdate={handleUpdate}
            onPrev={handlePrev}
            onSubmit={handleSubmit}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
}
