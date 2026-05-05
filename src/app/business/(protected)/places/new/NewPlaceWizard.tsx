"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { WizardHeaderNew } from "../[id]/edit/components/WizardHeaderNew";
import { Step1Profile } from "../[id]/edit/steps/Step1Profile";
import { Step2Location } from "../[id]/edit/steps/Step2Location";
import { Step3Photos } from "../[id]/edit/steps/Step3Photos";
import { Step4Contacts } from "../[id]/edit/steps/Step4Contacts";
import { SaveDraftDialog } from "./components/SaveDraftDialog";
import { isMeaningfulDraft } from "./utils/isMeaningfulDraft";
import { AlertCircle, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import type { Place, PlaceImage, Prisma } from "@prisma/client";
import { ContentStatus, PlaceKind } from "@prisma/client";
import {
  getStepStatus,
  canGoToNextStep,
  canGoToPrevStep,
  canGoToStep,
} from "../[id]/edit/utils/stepValidation";
import { useWizardSession } from "@/hooks/useWizardSession";
import { useLocalAutosave } from "@/hooks/useLocalAutosave";
import { randomId } from "@/lib/utils/randomId";

// Client-side getCurrentUser
async function getCurrentUser() {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Get current user error:", error);
    return null;
  }
}

interface PlaceWithImages extends Place {
  images: PlaceImage[];
}

// Local draft state (no DB record yet)
interface LocalDraft {
  // Step 1
  title: string;
  category: string;
  shortDesc: string;
  description: string | null;
  ageTags: string[];
  visitFormats: string[];
  activityTypes: string[];
  
  // Step 2
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  formattedAddr: string | null;
  addressJson: Prisma.InputJsonValue | null;
  customAddress: string | null;
  cityId: string | null;
  districtAutoId: string | null;
  districtManualId: string | null;
  metroAutoId: string | null;
  metroAutoDistanceM: number | null;
  metroManualId: string | null;
  metroManualDistanceM: number | null;
  
  // UI-only fields (not saved to DB, just for display)
  _districtName?: string | null;
  _metroName?: string | null;
  
  // Step 3 (temp media tracking)
  logoMediaId: string | null;
  logoUrl: string | null;
  galleryMediaIds: string[];
  galleryUrls: string[];
  
  // Step 4
  phone: string | null;
  website: string | null;
  instagramHandle: string | null;
  instagramUrl: string | null;
  
  // Hierarchy
  placeKind: PlaceKind;
  floor: string | null;
  unit: string | null;
}

export function NewPlaceWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [createRequestId] = useState(() => randomId());
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  
  // Wizard session for temp media uploads
  const { wizardSessionId, isLoaded: sessionLoaded, clearSession } = useWizardSession({
    userId: user?.id,
    wizardType: "place",
  });
  
  // Client-side city resolution
  const resolveCityIdClient = useCallback(async (lat: number, lng: number, addressJson: Record<string, unknown>[] | null) => {
    try {
      console.log("[NewPlaceWizard] Enriching location on client...", { lat, lng, hasAddressJson: !!addressJson });
      
      // Call full enrichment API
      const response = await fetch("/api/geo/enrich-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, addressJson }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("[NewPlaceWizard] ✅ Enrichment result:", result);
        
        // Update localDraft with all enriched data INCLUDING names
        setLocalDraft((prev) => ({
          ...prev,
          cityId: result.cityId || prev.cityId,
          districtAutoId: result.districtAutoId || null,
          metroAutoId: result.metroAutoId || null,
          metroAutoDistanceM: result.metroAutoDistanceM || null,
          // Store names for display (not in schema, just for UI)
          _districtName: result.districtName || null,
          _metroName: result.metroName || null,
        }));
      } else {
        console.log("[NewPlaceWizard] ⚠️ Could not enrich location");
      }
    } catch (error) {
      console.error("[NewPlaceWizard] Location enrichment error:", error);
    }
  }, []);
  
  // Leave confirmation state
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false);
  
  // Local state for new place (no DB record yet)
  const [localDraft, setLocalDraft] = useState<LocalDraft>({
    // Step 1
    title: "",
    category: "other",
    shortDesc: "",
    description: null,
    ageTags: [],
    visitFormats: [],
    activityTypes: [],
    
    // Step 2
    lat: null,
    lng: null,
    googlePlaceId: null,
    formattedAddr: null,
    addressJson: null,
    customAddress: null,
    cityId: null,
    districtAutoId: null,
    districtManualId: null,
    metroAutoId: null,
    metroAutoDistanceM: null,
    metroManualId: null,
    metroManualDistanceM: null,
    
    // Step 3 (temp media)
    logoMediaId: null,
    logoUrl: null,
    galleryMediaIds: [],
    galleryUrls: [],
    
    // Step 4
    phone: null,
    website: null,
    instagramHandle: null,
    instagramUrl: null,
    
    // Hierarchy
    placeKind: PlaceKind.STANDALONE,
    floor: null,
    unit: null,
  });

  // Local autosave (no DB writes)
  // Use fixed key for new places (not session-specific) to avoid orphaned data
  const autosaveKey = `placeWizard:new:${user?.id}`;
  const { save: saveLocal, restore: restoreLocal, clear: clearLocal, lastSaved } = useLocalAutosave<LocalDraft>({
    key: autosaveKey,
    debounceMs: 500,
    onSave: () => {
      console.log("[NewPlaceWizard] Local autosave complete");
    },
  });

  // Load user
  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  // Restore from localStorage on mount
  useEffect(() => {
    if (!sessionLoaded || !user) return;

    // IMPORTANT: Don't restore automatically - localStorage might contain old data
    // Only restore if user explicitly wants to (we'll add a prompt later if needed)
    // For now, always start with a clean slate
    console.log("[NewPlaceWizard] Starting with clean form (not restoring from localStorage)");
    clearLocal();
  }, [sessionLoaded, user, clearLocal]);

  // Auto-save to localStorage on changes (only if meaningful)
  useEffect(() => {
    if (!sessionLoaded || !user) return;
    
    // Only save if there's meaningful data to avoid polluting localStorage
    if (isMeaningfulDraft(localDraft)) {
      saveLocal(localDraft);
    } else {
      // Clear localStorage if draft becomes empty
      clearLocal();
    }
  }, [localDraft, sessionLoaded, user, saveLocal, clearLocal]);
  
  // Compute if draft has meaningful changes
  const shouldConfirmLeave = isMeaningfulDraft(localDraft);

  // Native beforeunload warning (for tab close/refresh)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldConfirmLeave && !isNavigatingRef.current) {
        e.preventDefault();
        e.returnValue = "У вас есть несохранённые изменения. Вы уверены, что хотите покинуть страницу?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldConfirmLeave]);

  const handleUpdate = useCallback((updates: Partial<LocalDraft>) => {
    console.log("[NewPlaceWizard] handleUpdate called with:", updates);
    
    setLocalDraft((prev) => {
      const newDraft = { ...prev, ...updates };
      
      // If location data updated, try to resolve cityId immediately
      const hasNewLocation = updates.lat !== undefined && updates.lng !== undefined;
      const hasAddressJson = updates.addressJson !== undefined || newDraft.addressJson !== null;
      
      if (hasNewLocation && newDraft.lat && newDraft.lng) {
        console.log("[NewPlaceWizard] Location updated, triggering enrichment", {
          lat: newDraft.lat,
          lng: newDraft.lng,
          hasAddressJson,
        });
        // Trigger enrichment asynchronously (don't wait)
        // Use addressJson from updates or existing draft
        // Narrow InputJsonValue to Record<string, unknown>[] | null for the enrichment API
        const addressJsonForEnrichment = Array.isArray(newDraft.addressJson) ? newDraft.addressJson : null;
        resolveCityIdClient(newDraft.lat, newDraft.lng, addressJsonForEnrichment);
      }
      
      return newDraft;
    });
  }, [resolveCityIdClient]);
  
  // Handle back/close navigation with confirmation
  const handleNavigateAway = useCallback((destination: string) => {
    if (shouldConfirmLeave && !isNavigatingRef.current) {
      // Show custom dialog
      pendingNavigationRef.current = destination;
      setShowLeaveDialog(true);
    } else {
      // Navigate immediately
      isNavigatingRef.current = true;
      router.push(destination);
    }
  }, [shouldConfirmLeave, router]);
  
  const handleSaveDraftFromDialog = async () => {
    const destination = pendingNavigationRef.current || "/business/places";
    const success = await saveDraft(destination);
    
    if (success) {
      setShowLeaveDialog(false);
      pendingNavigationRef.current = null;
    }
  };
  
  const handleDiscardFromDialog = async () => {
    const destination = pendingNavigationRef.current || "/business/places";
    
    // Delete temp media session
    try {
      await fetch(`/api/business/temp-media/session/${wizardSessionId}`, {
        method: "DELETE",
      });
      console.log("[NewPlaceWizard] Deleted temp media session");
    } catch (error) {
      console.error("[NewPlaceWizard] Failed to delete temp media (non-fatal):", error);
    }
    
    // Clear local autosave and session
    clearLocal();
    await clearSession();
    
    isNavigatingRef.current = true;
    setShowLeaveDialog(false);
    pendingNavigationRef.current = null;
    router.push(destination);
  };

  const saveDraft = useCallback(async (navigateTo?: string) => {
    setIsSaving(true);
    try {
      console.log("[NewPlaceWizard] Creating place (DRAFT) with sessionId:", wizardSessionId);
      
      const res = await fetch("/api/business/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createRequestId,
          status: "DRAFT",
          data: {
            ...localDraft,
            wizardSessionId, // Attach temp media
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("[NewPlaceWizard] Create failed:", errorData);
        throw new Error(errorData.message || errorData.error || "Failed to create");
      }

      const { place } = await res.json();
      
      console.log("[NewPlaceWizard] Place created successfully:", place.id);
      
      // Clear local autosave and session
      clearLocal();
      await clearSession();
      
      // Delete temp media session (already attached to place)
      try {
        await fetch(`/api/business/temp-media/session/${wizardSessionId}`, {
          method: "DELETE",
        });
      } catch (cleanupError) {
        console.error("[NewPlaceWizard] Temp media cleanup error (non-fatal):", cleanupError);
      }
      
      toast.success("Черновик сохранён");
      
      // Mark as navigating to prevent beforeunload
      isNavigatingRef.current = true;
      
      // Navigate to specified location or edit page
      if (navigateTo) {
        router.push(navigateTo);
      } else {
        router.push(`/business/places/${place.id}/edit?step=${currentStep}`);
      }
      
      return true;
    } catch (error) {
      console.error("[NewPlaceWizard] Create error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка создания");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [localDraft, createRequestId, wizardSessionId, currentStep, router, clearLocal, clearSession]);

  const submitForModeration = useCallback(async () => {
    // Validate all required fields
    if (!localDraft.title || !localDraft.category || !localDraft.shortDesc || 
        !localDraft.description || 
        !localDraft.ageTags || localDraft.ageTags.length === 0 ||
        !localDraft.visitFormats || localDraft.visitFormats.length === 0 ||
        !localDraft.activityTypes || localDraft.activityTypes.length === 0) {
      toast.error("Заполните все обязательные поля на шаге 1");
      return false;
    }

    if (!localDraft.lat || !localDraft.lng) {
      toast.error("Укажите местоположение на шаге 2");
      return false;
    }

    setIsSaving(true);
    try {
      console.log("[NewPlaceWizard] Submitting place (PENDING) with sessionId:", wizardSessionId);
      
      const res = await fetch("/api/business/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createRequestId,
          status: "PENDING",
          data: {
            ...localDraft,
            wizardSessionId, // Attach temp media
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("[NewPlaceWizard] Submit failed:", errorData);
        throw new Error(errorData.message || errorData.error || "Failed to submit");
      }

      const { place } = await res.json();
      
      console.log("[NewPlaceWizard] Place submitted successfully:", place.id);
      
      // Clear local autosave and session
      clearLocal();
      await clearSession();
      
      // Delete temp media session (already attached to place)
      try {
        await fetch(`/api/business/temp-media/session/${wizardSessionId}`, {
          method: "DELETE",
        });
      } catch (cleanupError) {
        console.error("[NewPlaceWizard] Temp media cleanup error (non-fatal):", cleanupError);
      }
      
      toast.success("Место отправлено на модерацию");
      
      // Mark as navigating to prevent beforeunload
      isNavigatingRef.current = true;
      
      // Redirect to places list
      router.push("/business/places?status=PENDING");
      return true;
    } catch (error) {
      console.error("[NewPlaceWizard] Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка отправки");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [localDraft, createRequestId, wizardSessionId, router, clearLocal, clearSession]);

  const handleStepClick = (targetStep: number) => {
    // Create draft place for validation
    const draftPlaceForValidation = {
      id: "new",
      ownerUserId: "new",
      status: ContentStatus.DRAFT,
      createRequestId,
      ...localDraft,
      logoImageId: localDraft.logoMediaId,
      images: [],
      locationSource: localDraft.googlePlaceId ? ("GOOGLE" as const) : ("MANUAL" as const),
      countryCode: null,
      parentPlaceId: null,
      unitLabel: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as PlaceWithImages;
    
    if (!canGoToStep(targetStep, currentStep, draftPlaceForValidation)) {
      return;
    }
    setCurrentStep(targetStep);
  };

  const handleNext = () => {
    if (currentStep === 4) {
      // Last step - submit for moderation
      submitForModeration();
    } else if (canGoToNextStep(currentStep, draftPlace)) {
      setCurrentStep(currentStep + 1);
    } else {
      toast.error("Заполните обязательные поля для продолжения");
    }
  };

  const handlePrev = () => {
    if (canGoToPrevStep(currentStep)) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Create a draft place object for step components compatibility
  const draftPlace = useMemo(() => ({
    id: "new",
    ownerUserId: user?.id || "new",
    status: ContentStatus.DRAFT,
    createRequestId,
    title: localDraft.title,
    category: localDraft.category,
    shortDesc: localDraft.shortDesc,
    description: localDraft.description,
    ageTags: localDraft.ageTags,
    visitFormats: localDraft.visitFormats,
    activityTypes: localDraft.activityTypes,
    lat: localDraft.lat,
    lng: localDraft.lng,
    googlePlaceId: localDraft.googlePlaceId,
    formattedAddr: localDraft.formattedAddr,
    addressJson: localDraft.addressJson,
    customAddress: localDraft.customAddress,
    cityId: localDraft.cityId,
    districtAutoId: localDraft.districtAutoId,
    districtManualId: localDraft.districtManualId,
    metroAutoId: localDraft.metroAutoId,
    metroAutoDistanceM: localDraft.metroAutoDistanceM,
    metroManualId: localDraft.metroManualId,
    metroManualDistanceM: localDraft.metroManualDistanceM,
    phone: localDraft.phone,
    website: localDraft.website,
    instagramHandle: localDraft.instagramHandle,
    instagramUrl: localDraft.instagramUrl,
    placeKind: localDraft.placeKind,
    floor: localDraft.floor,
    unit: localDraft.unit,
    // Enrichment names for display (not in Place schema)
    _districtName: localDraft._districtName,
    _metroName: localDraft._metroName,
    // Map temp media to PlaceImage format for validation
    logoImageId: localDraft.logoMediaId,
    images: [
      // Include logo if exists
      ...(localDraft.logoUrl ? [{
        id: localDraft.logoMediaId || "temp-logo",
        placeId: "new",
        kind: "LOGO" as const,
        url: localDraft.logoUrl,
        width: null,
        height: null,
        blurhash: null,
        sortOrder: -1,
        createdAt: new Date(),
      }] : []),
      // Include gallery images
      ...localDraft.galleryUrls.map((url, index) => ({
        id: localDraft.galleryMediaIds[index] || `temp-${index}`,
        placeId: "new",
        kind: "GALLERY" as const,
        url,
        width: null,
        height: null,
        blurhash: null,
        sortOrder: index,
        createdAt: new Date(),
      })),
    ],
    locationSource: localDraft.googlePlaceId ? ("GOOGLE" as const) : ("MANUAL" as const),
    countryCode: null,
    parentPlaceId: null,
    unitLabel: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as PlaceWithImages), [user?.id, createRequestId, localDraft]);

  const canGoNext = currentStep === 4 ? true : canGoToNextStep(currentStep, draftPlace);

  return (
    <div className="min-h-screen bg-gray-50">
      <WizardHeaderNew
        currentStep={currentStep}
        totalSteps={4}
        status={ContentStatus.DRAFT}
        isSaving={isSaving}
        isDirty={shouldConfirmLeave}
        lastSaved={lastSaved}
        onStepClick={handleStepClick}
        onSaveDraft={() => saveDraft()}
        canGoNext={canGoNext}
        getStepStatus={(step) => getStepStatus(step, currentStep, draftPlace)}
        place={draftPlace}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">

        {currentStep === 1 && (
          <Step1Profile
            place={draftPlace}
            onUpdate={handleUpdate}
            onNext={handleNext}
            canNext={canGoNext}
          />
        )}

        {currentStep === 2 && (
          <Step2Location
            place={draftPlace}
            onUpdate={handleUpdate}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={canGoNext}
          />
        )}

        {currentStep === 3 && sessionLoaded && (
          <Step3Photos
            place={draftPlace}
            images={draftPlace.images}
            wizardSessionId={wizardSessionId}
            onUpdate={handleUpdate}
            onPrev={handlePrev}
            onNext={handleNext}
            canNext={canGoNext}
          />
        )}

        {currentStep === 4 && (
          <Step4Contacts
            place={draftPlace}
            onUpdate={handleUpdate}
            onPrev={handlePrev}
            onSubmit={submitForModeration}
            isSaving={isSaving}
          />
        )}
      </div>
      
      {/* Close button */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleNavigateAway("/business/places")}
          className="rounded-full"
          title="Закрыть"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Save Draft Confirmation Dialog */}
      <SaveDraftDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        onSaveDraft={handleSaveDraftFromDialog}
        onDiscard={handleDiscardFromDialog}
        isSaving={isSaving}
      />
    </div>
  );
}
