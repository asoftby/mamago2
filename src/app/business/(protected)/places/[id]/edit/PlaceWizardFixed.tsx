"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PlaceWithImages, Place, PlaceImage } from "./types";
import { Step1Profile } from "./steps/Step1Profile";
import { Step2Location } from "./steps/Step2Location";
import { Step3Photos } from "./steps/Step3Photos";
import { Step4Contacts } from "./steps/Step4Contacts";
import { Step5OpeningHours } from "./steps/Step5OpeningHours";
import { Step6Review } from "./steps/Step6Review";
import { AlertCircle } from "lucide-react";
import {
  getStepStatus,
  canGoToNextStep,
  canGoToPrevStep,
  validateStep3,
} from "./utils/stepValidation";
import { toast } from "sonner";
import { useWizardSession } from "@/hooks/useWizardSession";
import { Badge } from "@/components/ui/badge";
import type { OpeningHoursData } from "@/components/openingHours";
import { mapToUIState } from "@/lib/openingHours";
import { hasPlaceDataChanged, deepEqual, normalizePlaceData } from "@/lib/deepEqual";
import { PlaceStatusBadge } from "@/components/business/place/PlaceStatusBadge";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";
import { StickyModerationBar } from "@/components/business/wizard/StickyModerationBar";
import { ImprovementRequestEditBanner } from "@/components/business/wizard/ImprovementRequestEditBanner";

interface PlaceWizardProps {
  place: PlaceWithImages;
  initialStep: number;
  moderationMessage?: string | null;
  activeRevision?: { status: string; moderatorComment?: string | null } | null;
}

export function PlaceWizardFixed({ place: initialPlace, initialStep, moderationMessage, activeRevision }: PlaceWizardProps) {
  const router = useRouter();
  const [place, setPlace] = useState<PlaceWithImages>(initialPlace);
  
  // Ensure initial step is within valid range (1-6)
  const validInitialStep = Math.min(Math.max(initialStep, 1), 6);
  const [currentStep, setCurrentStep] = useState(validInitialStep);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Baseline snapshots for meaningful change detection
  const [originalPlace] = useState<PlaceWithImages>(() => {
    return JSON.parse(JSON.stringify(initialPlace));
  });
  const [originalOpeningHours] = useState<OpeningHoursData | null>(() => {
    return mapToUIState((initialPlace.openingHours as Parameters<typeof mapToUIState>[0]) || null);
  });
  
  // Track pending changes for submission
  const [pendingChanges, setPendingChanges] = useState<Partial<Place>>({});
  // Opening hours state (stored separately, not in Place model yet)
  const [openingHoursData, setOpeningHoursData] = useState<OpeningHoursData | null>(() => {
    // Initialize from place.openingHours if it exists
    return mapToUIState((initialPlace.openingHours as Parameters<typeof mapToUIState>[0]) || null);
  });

  // Improvement requests
  const [improvementRequests, setImprovementRequests] = useState<{ status: string; severity: string; title: string; description: string; dueAt: string | null; createdAt: string; id: string; createdByModerator: { id: string; email: string; role: string } }[]>([]);

  // Debug: log moderation data
  console.log("[PlaceWizard] Moderation data:", {
    placeStatus: place.status,
    hasActiveRevision: !!activeRevision,
    revisionStatus: activeRevision?.status,
    moderationMessage,
    revisionComment: activeRevision?.moderatorComment,
  });

  // Wizard session for temp media uploads
  const { wizardSessionId, clearSession } = useWizardSession({
    userId: initialPlace.createdByUserId,
    wizardType: "place",
    entityId: initialPlace.id, // Include placeId for session isolation
  });

  // Fetch improvement requests for this place
  useEffect(() => {
    const fetchImprovementRequests = async () => {
      try {
        const response = await fetch(`/api/business/places/${place.id}/improvement-requests`);
        if (response.ok) {
          const data = await response.json();
          setImprovementRequests(data.requests || []);
        }
      } catch (error) {
        console.error("Failed to fetch improvement requests:", error);
      }
    };

    fetchImprovementRequests();
  }, [place.id]);

  // Determine if place is locked for editing (under review)
  // For published places, check revision status
  // For non-published places, check place status
  const isLocked = place.status === "PUBLISHED" 
    ? activeRevision?.status === "PENDING"
    : place.status === "PENDING";
  const isEditable = !isLocked;
  
  // Simple change tracking - only track if user has made actual changes
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false);
  
  // Track image changes separately (set when temp media uploads occur)
  const [imagesChanged, setImagesChanged] = useState(false);
  
  // Debug: log when imagesChanged updates
  useEffect(() => {
    console.log("[PlaceWizard] imagesChanged state updated:", imagesChanged);
  }, [imagesChanged]);
  
  // Function to check if current state differs from original baseline
  const checkForMeaningfulChanges = useCallback(() => {
    // Check place changes by comparing current pending changes with empty state
    const hasPlaceChanges = Object.keys(pendingChanges).length > 0;
    
    // Check opening hours changes by comparing normalized data
    const hasOpeningHoursChanges = !deepEqual(
      normalizePlaceData(openingHoursData),
      normalizePlaceData(originalOpeningHours)
    );
    
    // Include image changes
    const hasMeaningfulChanges = hasPlaceChanges || hasOpeningHoursChanges || imagesChanged;
    
    // Debug logging
    console.log("[PlaceWizard] Change check:", {
      hasPlaceChanges,
      hasOpeningHoursChanges,
      imagesChanged,
      hasMeaningfulChanges,
      pendingChangesCount: Object.keys(pendingChanges).length,
      pendingChanges: pendingChanges,
      currentHasUserMadeChanges: hasUserMadeChanges,
    });
    
    setHasUserMadeChanges(hasMeaningfulChanges);
    return hasMeaningfulChanges;
  }, [pendingChanges, openingHoursData, originalOpeningHours, imagesChanged, hasUserMadeChanges]);
  
  // Check for changes whenever dependencies change
  useEffect(() => {
    checkForMeaningfulChanges();
  }, [checkForMeaningfulChanges]);
  
  // Check if there are meaningful changes to submit
  const hasChanges = hasUserMadeChanges;

  // Update URL when step changes (for all steps 1-6)
  useEffect(() => {
    if (currentStep >= 1 && currentStep <= 6) {
      const params = new URLSearchParams();
      params.set("step", currentStep.toString());
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    
    // Debug: log state when step changes
    console.log("[PlaceWizard] Step changed to:", currentStep, {
      imagesChanged,
      hasUserMadeChanges,
      hasChanges,
    });
  }, [currentStep, router, imagesChanged, hasUserMadeChanges, hasChanges]);
  const handleNext = async () => {
    if (currentStep === 6) {
      // Last step - submit
      console.log("Submit");
    } else if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = async () => {
    if (canGoToPrevStep(currentStep)) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleUpdate = useCallback((updates: Partial<Place> & { images?: PlaceImage[] }) => {
    // Block updates if locked for moderation
    if (isLocked) {
      console.log("[PlaceWizard] Update blocked - place is on moderation");
      return;
    }

    // Extract images if provided
    const { images: updatedImages, ...placeUpdates } = updates;
    
    console.log("[PlaceWizard] handleUpdate called with:", {
      updates: Object.keys(placeUpdates),
      placeUpdates,
    });
    
    // Check if this update includes temp media fields (image uploads)
    const tempMediaFields = ['logoMediaId', 'logoUrl', 'galleryMediaIds', 'galleryUrls'];
    const hasTempMediaUpdate = Object.keys(placeUpdates).some(key => tempMediaFields.includes(key));
    
    if (hasTempMediaUpdate) {
      console.log("[PlaceWizard] Temp media update detected, marking images as changed");
      setImagesChanged(true);
    }
    
    // Filter out non-meaningful updates (UI-only/temporary fields)
    // These fields are not part of the actual Place model and should not trigger dirty state
    const meaningfulUpdates = Object.fromEntries(
      Object.entries(placeUpdates).filter(([key]) => {
        // Exclude temporary/UI-only fields used during photo upload process
        const nonMeaningfulFields = [
          'logoMediaId',    // Temporary field, real field is logoImageId
          'logoUrl',        // UI-only field, not stored in Place model
          'galleryMediaIds', // UI-only field, images stored in PlaceImage relation
          'galleryUrls',    // UI-only field, not stored in Place model
        ];
        return !nonMeaningfulFields.includes(key);
      })
    );
    
    console.log("[PlaceWizard] After filtering:", {
      meaningfulUpdates: Object.keys(meaningfulUpdates),
      hasTempMediaUpdate,
    });
    
    // Update pending changes for submission (only meaningful changes)
    if (Object.keys(meaningfulUpdates).length > 0) {
      setPendingChanges(prev => {
        const newPendingChanges = { ...prev, ...meaningfulUpdates };
        
        // Remove fields that have been reverted to original values
        const filteredChanges: Partial<Place> = {};
        for (const [key, value] of Object.entries(newPendingChanges)) {
          const originalValue = (originalPlace as Record<string, unknown>)[key];
          // Only keep the change if it's different from original
          if (!deepEqual(normalizePlaceData(value), normalizePlaceData(originalValue))) {
            filteredChanges[key as keyof Place] = value as Place[keyof Place];
          }
        }
        
        console.log("[PlaceWizard] Updated pendingChanges:", {
          before: Object.keys(prev),
          after: Object.keys(filteredChanges),
        });
        
        return filteredChanges;
      });
    }
    
    // Optimistic UI update (include all updates for UI responsiveness)
    setPlace((prev) => {
      const updated = { 
        ...prev, 
        ...placeUpdates,
        ...(updatedImages && { images: updatedImages })
      };
      
      return updated;
    });
  }, [isLocked, originalPlace]);

  const handleSubmit = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    
    try {
      // For published places, we need to work with revisions
      if (place.status === "PUBLISHED") {
        // Get or create revision first
        const revisionResponse = await fetch(`/api/business/places/${place.id}/revision`);
        if (!revisionResponse.ok) {
          throw new Error("Failed to get or create revision");
        }
        
        const revisionData = await revisionResponse.json();
        const revisionId = revisionData.revision?.id;
        
        if (!revisionId) {
          throw new Error("Failed to get or create revision");
        }
        
        // Save place data changes to revision
        if (Object.keys(pendingChanges).length > 0) {
          const response = await fetch(`/api/business/places/${place.id}/revision`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              revisionId,
              data: pendingChanges 
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to save place changes (${response.status})`);
          }
        }
        
        // Save opening hours changes to revision
        const hasOpeningHoursChanges = !deepEqual(
          normalizePlaceData(openingHoursData),
          normalizePlaceData(originalOpeningHours)
        );
        
        if (hasOpeningHoursChanges) {
          const response = await fetch(`/api/business/places/${place.id}/revision/opening-hours`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              revisionId,
              data: openingHoursData 
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to save opening hours changes (${response.status})`);
          }
        }
        
        // Submit revision for moderation
        const submitResponse = await fetch(`/api/business/places/${place.id}/revision/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            revisionId,
            wizardSessionId, // Pass wizard session ID for temp media conversion
          }),
        });
        
        if (!submitResponse.ok) {
          const errorData = await submitResponse.json();
          throw new Error(errorData.error || "Failed to submit revision");
        }
        
        toast.success("Изменения отправлены на модерацию");
        
        // Clear wizard session after successful submission
        await clearSession();
        
        // For published places, redirect back to public page
        if (getPlacePublicUrl(place)) {
          router.push(getPlacePublicUrl(place)!);
        } else {
          router.push(`/business/places/${place.id}/submitted`);
        }
        
      } else {
        // For non-published places, submit directly
        
        // First save any pending changes
        if (Object.keys(pendingChanges).length > 0) {
          const response = await fetch(`/api/business/places/${place.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pendingChanges),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to save place changes (${response.status})`);
          }
        }
        
        // Save opening hours if changed
        const hasOpeningHoursChanges = !deepEqual(
          normalizePlaceData(openingHoursData),
          normalizePlaceData(originalOpeningHours)
        );
        
        if (hasOpeningHoursChanges) {
          const response = await fetch(`/api/business/places/${place.id}/opening-hours`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: openingHoursData }),
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to save opening hours (${response.status})`);
          }
        }
        
        // Submit place for moderation
        const submitResponse = await fetch(`/api/business/places/${place.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        
        if (!submitResponse.ok) {
          const errorData = await submitResponse.json();
          
          // Handle validation errors
          if (errorData.error === "VALIDATION") {
            const missingFields = errorData.missing?.join(", ") || "некоторые поля";
            toast.error(`Заполните обязательные поля: ${missingFields}`);
            setIsSaving(false);
            return;
          }
          
          throw new Error(errorData.error || "Failed to submit place");
        }
        
        toast.success("Место отправлено на модерацию");
      }
      
      // Clear wizard session after successful submission
      await clearSession();
      
      // Redirect to submitted page
      router.push(`/business/places/${place.id}/submitted`);
      
    } catch (error) {
      console.error("Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Произошла ошибка при отправке");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStepClick = async (targetStep: number) => {
    // Allow navigation to any step 1-6
    if (targetStep < 1 || targetStep > 6) {
      return;
    }
    setCurrentStep(targetStep);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Page Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Редактирование места: {place.title}
              </h1>
              <div className="mt-2">
                <PlaceStatusBadge
                  status={place.status}
                  hasActiveRevision={!!activeRevision}
                  revisionStatus={activeRevision?.status}
                />
              </div>
            </div>
            
            {getPlacePublicUrl(place) && (
              <a
                href={getPlacePublicUrl(place)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Перейти
              </a>
            )}
          </div>
        </div>
      </div>

      <div className={`max-w-4xl mx-auto px-4 py-8 ${place.status === "PUBLISHED" ? "pb-24" : ""}`}>
        {/* Improvement Request Banner */}
        <ImprovementRequestEditBanner requests={improvementRequests} />

        {currentStep === 1 && (
          <Step1Profile
            place={place}
            onUpdate={handleUpdate}
            onNext={handleNext}
            canNext={canGoToNextStep(currentStep, place)}
            isEditable={isEditable}
          />
        )}

        {currentStep === 2 && (
          <Step2Location
            place={place}
            onUpdate={handleUpdate}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={canGoToNextStep(currentStep, place)}
            isEditable={isEditable}
          />
        )}

        {currentStep === 3 && (
          <Step3Photos
            place={place}
            images={place.images}
            wizardSessionId={wizardSessionId}
            onUpdate={handleUpdate}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={canGoToNextStep(currentStep, place)}
            isEditable={isEditable}
          />
        )}

        {currentStep === 4 && (
          <Step4Contacts
            place={place}
            onUpdate={handleUpdate}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={canGoToNextStep(currentStep, place)}
            isEditable={isEditable}
          />
        )}

        {currentStep === 5 && (
          <Step5OpeningHours
            place={place}
            openingHoursData={openingHoursData}
            onUpdate={(data) => {
              setOpeningHoursData(data);
              setHasUserMadeChanges(true);
            }}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={true} // Allow next to step 6
            isEditable={isEditable}
          />
        )}

        {currentStep === 6 && (
          <Step6Review
            place={place}
            openingHoursData={openingHoursData}
            onSubmit={handleSubmit}
            isSubmitting={isSaving}
            onPrev={handlePrev}
            showSubmitButton={place.status !== "PUBLISHED"}
          />
        )}
      </div>

      {/* Sticky Moderation Bar for Published Places */}
      <StickyModerationBar
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        hasChanges={hasChanges}
        isVisible={place.status === "PUBLISHED" && isEditable}
      />
    </div>
  );
}