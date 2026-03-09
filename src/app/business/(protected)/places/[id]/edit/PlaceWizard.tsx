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
import { useWizardSession } from "@/hooks/useWizardSession";
import { Badge } from "@/components/ui/badge";

interface PlaceWithImages extends Place {
  images: PlaceImage[];
}

interface PlaceWizardProps {
  place: PlaceWithImages;
  initialStep: number;
  moderationMessage?: string | null;
  activeRevision?: any | null;
}

export function PlaceWizard({ place: initialPlace, initialStep, moderationMessage, activeRevision }: PlaceWizardProps) {
  const router = useRouter();
  const [place, setPlace] = useState<PlaceWithImages>(initialPlace);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Manual save state
  const [isDirty, setIsDirty] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Partial<Place>>({});

  // Improvement requests
  const [improvementRequests, setImprovementRequests] = useState<any[]>([]);

  // Debug: log moderation data
  console.log("[PlaceWizard] Moderation data:", {
    placeStatus: place.status,
    hasActiveRevision: !!activeRevision,
    revisionStatus: activeRevision?.status,
    moderationMessage,
    revisionComment: activeRevision?.moderatorComment,
  });

  // Wizard session for temp media uploads
  const { wizardSessionId } = useWizardSession({
    userId: initialPlace.ownerUserId,
    wizardType: "place",
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

    if (place.status === "PUBLISHED") {
      fetchImprovementRequests();
    }
  }, [place.id, place.status]);

  // Determine if place is locked for editing (under review)
  // For published places, check revision status
  // For non-published places, check place status
  const isLocked = place.status === "PUBLISHED" 
    ? activeRevision?.status === "PENDING"
    : place.status === "PENDING";
  const isEditable = !isLocked;

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
    // Don't save if locked for moderation
    if (isLocked) {
      console.log("[PlaceWizard] Save blocked - place is on moderation");
      return true;
    }

    if (!isDirty || Object.keys(pendingChanges).length === 0) {
      console.log("[PlaceWizard] No changes to save");
      return true;
    }

    // Check if place is published - must use revision flow
    const isPublished = place.status === "PUBLISHED";

    setIsSaving(true);
    try {
      console.log("[PlaceWizard] Saving draft:", {
        isPublished,
        changes: pendingChanges,
        placeId: place.id,
        status: place.status,
      });
      
      let res;
      let updatedData;

      if (isPublished) {
        // Published places must be edited through revisions
        // First, get or create revision
        const getRevisionRes = await fetch(`/api/business/places/${place.id}/revision`, {
          method: "GET",
        });

        if (!getRevisionRes.ok) {
          const errorText = await getRevisionRes.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || "Failed to get revision" };
          }
          console.error("[PlaceWizard] Get revision failed:", {
            status: getRevisionRes.status,
            statusText: getRevisionRes.statusText,
            error: errorData,
          });
          throw new Error(errorData.message || errorData.error || "Failed to get revision");
        }

        const { revision } = await getRevisionRes.json();
        console.log("[PlaceWizard] Got revision:", revision.id);

        // Now update the revision
        res = await fetch(`/api/business/places/${place.id}/revision`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revisionId: revision.id,
            data: {
              ...pendingChanges,
              wizardSessionId, // Include wizardSessionId for temp media attachment
            },
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || "Failed to save revision" };
          }
          console.error("[PlaceWizard] Save revision failed:", {
            status: res.status,
            statusText: res.statusText,
            error: errorData,
          });
          throw new Error(errorData.message || errorData.error || "Failed to save revision");
        }

        const revisionData = await res.json();
        updatedData = revisionData.revision;
        console.log("[PlaceWizard] Revision saved successfully");
        
        // Update place with revision images (important for photo persistence)
        if (updatedData.images) {
          setPlace((prev) => ({ ...prev, images: updatedData.images }));
        }
      } else {
        // Draft/needs_revision/rejected places can be edited directly
        res = await fetch(`/api/business/places/${place.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pendingChanges),
        });

        if (!res.ok) {
          const errorText = await res.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || "Failed to save" };
          }
          console.error("[PlaceWizard] Save failed:", {
            status: res.status,
            statusText: res.statusText,
            error: errorData,
          });
          throw new Error(errorData.message || errorData.error || "Failed to save");
        }

        const placeData = await res.json();
        updatedData = placeData.place;
        console.log("[PlaceWizard] Place saved successfully");
      }
      
      // Update place with server response (for non-published) or keep current (for published with revision)
      if (!isPublished) {
        setPlace((prev) => ({ ...prev, ...updatedData }));
      }
      
      // Clear dirty state
      setIsDirty(false);
      setPendingChanges({});
      setLastSaved(new Date());
      
      toast.success(isPublished ? "Изменения сохранены в черновик" : "Черновик сохранён");
      return true;
    } catch (error) {
      console.error("[PlaceWizard] Save error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, pendingChanges, place.id, place.status, isLocked]);

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
    // Block updates if locked for moderation
    if (isLocked) {
      console.log("[PlaceWizard] Update blocked - place is on moderation");
      return;
    }

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
    // Block submission if locked
    if (isLocked) {
      toast.error("Место находится на проверке");
      return;
    }

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
      // Check if place is published - must submit revision instead
      const isPublished = place.status === "PUBLISHED";

      if (isPublished) {
        // For published places, get or create revision first
        const getRevisionRes = await fetch(`/api/business/places/${place.id}/revision`, {
          method: "GET",
        });

        if (!getRevisionRes.ok) {
          const errorText = await getRevisionRes.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || "Failed to get revision" };
          }
          throw new Error(errorData.message || errorData.error || "Failed to get revision");
        }

        const { revision } = await getRevisionRes.json();
        console.log("[PlaceWizard] Got revision for submit:", revision.id);

        // Now submit the revision
        const submitRes = await fetch(`/api/business/places/${place.id}/revision/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revisionId: revision.id }),
        });

        // Try to parse response
        const text = await submitRes.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          console.error("[PlaceWizard] Submit revision response not JSON:", {
            status: submitRes.status,
            statusText: submitRes.statusText,
            body: text,
          });
          throw new Error(text || "Ошибка при отправке изменений");
        }

        if (data.error === "VALIDATION") {
          toast.error(`Ошибки валидации:\n${data.missing?.join("\n") || data.error}`);
          return;
        }

        if (!submitRes.ok) {
          throw new Error(data.message || data.error || "Failed to submit revision");
        }

        // Redirect to success page with revision flag
        router.push(`/business/places/${place.id}/submitted?revision=true`);
      } else {
        // For non-published places, submit the place directly
        const res = await fetch(`/api/business/places/${place.id}/submit`, {
          method: "POST",
        });

        // Try to parse response
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          console.error("[PlaceWizard] Submit response not JSON:", {
            status: res.status,
            statusText: res.statusText,
            body: text,
          });
          throw new Error(text || "Ошибка при отправке");
        }

        if (data.error === "VALIDATION") {
          toast.error(`Ошибки валидации:\n${data.missing.join("\n")}`);
          return;
        }

        if (!res.ok) {
          throw new Error(data.message || data.error || "Failed to submit");
        }

        // Redirect to success page
        router.push(`/business/places/${place.id}/submitted`);
      }
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
        hasActiveRevision={!!activeRevision}
        revisionStatus={activeRevision?.status}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Improvement Request Banner */}
        {place.status === "PUBLISHED" && improvementRequests.length > 0 && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">
                  Требуется доработка опубликованного контента
                </h3>
                <p className="text-sm text-amber-700 mb-3">
                  Модератор запросил улучшения для этого места. Внесите изменения и отправьте на проверку.
                </p>
                <div className="space-y-2">
                  {improvementRequests.map((request: any) => (
                    <div key={request.id} className="bg-white rounded p-3 border border-amber-200">
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-medium text-sm text-gray-900">
                          {request.title}
                        </span>
                        <Badge className={
                          request.severity === "CRITICAL" ? "bg-red-100 text-red-800" :
                          request.severity === "HIGH" ? "bg-orange-100 text-orange-800" :
                          request.severity === "MEDIUM" ? "bg-yellow-100 text-yellow-800" :
                          "bg-blue-100 text-blue-800"
                        }>
                          {request.severity === "CRITICAL" ? "Критическая" :
                           request.severity === "HIGH" ? "Высокая" :
                           request.severity === "MEDIUM" ? "Средняя" : "Низкая"}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">
                        {request.description}
                      </p>
                      {request.dueAt && (
                        <p className="text-xs text-amber-700 mt-2">
                          Срок: {new Date(request.dueAt).toLocaleDateString("ru-RU")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Locked for Moderation Banner */}
        {isLocked && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-700">
                  Изменения находятся на проверке модератора. Редактирование станет доступно после проверки.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Moderation Message Banner */}
        {place.status === "NEEDS_REVISION" && moderationMessage && (
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

        {activeRevision?.status === "NEEDS_REVISION" && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                  Требуется исправление изменений
                </h3>
                {moderationMessage ? (
                  <p className="text-sm text-yellow-700 whitespace-pre-wrap">
                    {moderationMessage}
                  </p>
                ) : (
                  <div className="text-sm text-yellow-700">
                    <p className="mb-2">
                      Модератор запросил исправления. Внесите необходимые изменения и отправьте повторно.
                    </p>
                    <p className="text-xs">
                      Комментарий модератора может быть в разделе{" "}
                      <a href="/business/notifications" className="underline hover:text-yellow-800">
                        Уведомления
                      </a>
                    </p>
                  </div>
                )}
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
            onSubmit={handleSubmit}
            isSaving={isSaving}
            isEditable={isEditable}
            isRevisionMode={place.status === "PUBLISHED" && !!activeRevision}
            revisionStatus={activeRevision?.status}
          />
        )}
      </div>
    </div>
  );
}
