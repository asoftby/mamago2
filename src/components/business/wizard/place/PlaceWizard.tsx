"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  FormWizardShell,
  FormWizardHeader,
  FormPrimaryContentCard,
  FormStickyActionBar,
  formWizardPhaseFromFlags,
  SaveIndicator,
  formatRelativeTimeRu,
} from "@/components/form-shell";
import { WizardProgress } from "@/components/ui/wizard-progress";
import { getBusinessFormActionLabels, businessFormCopy } from "../businessFormLabels";
import { canPublishContentDirectly } from "@/lib/auth/businessContentAccess";
import { useWizardSession } from "@/hooks/useWizardSession";
import { useWizardDraft } from "@/hooks/useWizardDraft";
import { useUnsavedChangesNavigationGuard } from "@/hooks/use-unsaved-changes-navigation-guard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { PlaceFormData, PlaceWizardMode } from "./types";
import type { Place, ContentStatus } from "@prisma/client";
import { createClientSavePerf } from "@/lib/perf/clientSavePerf";
import { WIZARD_STEPS, TOTAL_STEPS, getStepLabel } from "./config";
import { getDefaultFormData, hasMeaningfulContent } from "./defaults";
import { mapPlaceToFormData, buildPlacePayload, extractChanges } from "./mappers";
import { validateStep, validateForSubmit, canGoToNextStep, canGoToPrevStep } from "./validation";

import { Step1Profile } from "./steps/Step1Profile";
import { Step2Location } from "./steps/Step2Location";
import { Step3Contacts } from "./steps/Step3Contacts";
import { Step4Photos } from "./steps/Step4Photos";
import { Step5OpeningHours } from "./steps/Step5OpeningHours";
import { FaqStep } from "../shared/FaqStep";
import { Step6Review } from "./steps/Step6Review";
import { CompletionProgress } from "./CompletionProgress";
import {
  defaultNavForSurface,
  editorPlaceEditHref,
  type ContentEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import type { Role } from "@prisma/client";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";
import { PlaceStatusBadge } from "@/components/business/place/PlaceStatusBadge";
import { PlaceGroupSelector } from "@/components/business/place/PlaceGroupSelector";
import { AdminPlaceGroupManager } from "@/components/admin/AdminPlaceGroupManager";
import { ContentSuccessModal } from "@/components/shared/ContentSuccessModal";
import { resolveContentSuccessState } from "@/lib/content-success/resolver";
import type { ContentSuccessPayload, ResolvedContentSuccessState } from "@/lib/content-success/types";

/**
 * Validate returnTo URL to prevent open redirects
 */
function isValidReturnTo(url: string | undefined): boolean {
  if (!url) return false;
  // Only allow internal paths starting with /
  if (!url.startsWith("/")) return false;
  // Prevent protocol-based redirects
  if (url.includes("://") || url.startsWith("//")) return false;
  return true;
}

function parseJsonErrorPayload(text: string): { message?: string; error?: string } {
  try {
    return JSON.parse(text) as { message?: string; error?: string };
  } catch {
    return { message: text };
  }
}

interface PlaceWizardProps {
  mode: PlaceWizardMode;
  place?: Place; // Place entity for edit mode
  userId: string;
  userRole?: Role;
  onComplete?: (placeId: string) => void;
  /** When set (e.g. isolated /editor routes), drives list/edit URLs and post-submit navigation */
  editorSurface?: ContentEditorSurface;
  contentEditorNav?: Partial<ContentEditorNav>;
  /** Overrides default list/queue destination after submit */
  returnTo?: string;
  /** Серверный `?step=` — чтобы не было гонки с начальным состоянием шага. */
  initialEditStep?: number;
  /** Активная ревизия для overlay-статуса (только edit mode). */
  activeRevision?: { id: string; status: string } | null;
}

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
  initialEditStep,
  activeRevision,
}: PlaceWizardProps) {
  const router = useRouter();
  const surface: ContentEditorSurface = editorSurface ?? "business";
  const nav: ContentEditorNav = {
    ...defaultNavForSurface(surface),
    ...contentEditorNav,
  };
  const afterSubmitDestination = returnTo ?? nav.afterSubmitListPath;
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successState, setSuccessState] = useState<ResolvedContentSuccessState | null>(null);
  const [currentStep, setCurrentStep] = useState(() => {
    if (
      mode === "edit" &&
      typeof initialEditStep === "number" &&
      initialEditStep >= 1 &&
      initialEditStep <= TOTAL_STEPS
    ) {
      return initialEditStep;
    }
    return 1;
  });
  const [formData, setFormData] = useState<PlaceFormData>(() => {
    if (mode === "edit" && place) {
      return mapPlaceToFormData(place);
    }
    return getDefaultFormData();
  });
  const isPublishedEditMode = mode === "edit" && place?.status === "PUBLISHED";

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autosaveError, setAutosaveError] = useState(false);
  const [selectedRelatedPlaceIds, setSelectedRelatedPlaceIds] = useState<string[]>([]);
  const [currentPlaceGroupId, setCurrentPlaceGroupId] = useState<string | null>(
    place?.placeGroupId ?? null,
  );
  const [originalData, setOriginalData] = useState<PlaceFormData>(() =>
    mode === "edit" && place ? mapPlaceToFormData(place) : getDefaultFormData()
  );
  const autosaveInFlightRef = useRef(false);
  const pendingAutosaveChangesRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    setCurrentPlaceGroupId(place?.placeGroupId ?? null);
  }, [place?.placeGroupId]);

  // isDirty: формула изменилась относительно baseline
  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(originalData),
    [formData, originalData],
  );

  // ── useWizardDraft (create mode: LS-черновик + resume-баннер) ───────────────
  const PLACE_WIZARD_SCHEMA_VERSION = 1;
  const draft = useWizardDraft<PlaceFormData>({
    wizardType: "place",
    mode,
    entityId: mode === "edit" ? place?.id ?? null : null,
    schemaVersion: PLACE_WIZARD_SCHEMA_VERSION,
    data: formData,
    enabled: mode === "create" ? hasMeaningfulContent(formData) : isDirty,
  });

  // createRequestId: для create — берём из draft (стабильный UUID)
  const createRequestId = draft.createRequestId;

  // ── Navigation guard ────────────────────────────────────────────────────────
  const guardActive =
    (mode === "create" && hasMeaningfulContent(formData) && !isSubmitting) ||
    (mode === "edit" && isDirty && !isSaving && !isSubmitting);

  const { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange, requestLeave } =
    useUnsavedChangesNavigationGuard(guardActive);

  // Wizard session for temp media
  const { wizardSessionId } = useWizardSession({
    userId,
    wizardType: "place",
    entityId: mode === "edit" ? place?.id : undefined,
  });

  const persistRelatedPlacesAfterCreate = useCallback(
    async (createdPlaceId: string) => {
      if (selectedRelatedPlaceIds.length === 0) {
        return;
      }

      try {
        const response = await fetch(`/api/business/places/${createdPlaceId}/group`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ relatedPlaceIds: selectedRelatedPlaceIds }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          };
          throw new Error(
            payload.message ||
              payload.error ||
              "Failed to save related places after creation",
          );
        }
      } catch (error) {
        console.error("Failed to save related places after create:", error);
        toast.error(
          "Место создано, но связанные места не удалось сохранить. Их можно добавить позже в редактировании.",
        );
      }
    },
    [selectedRelatedPlaceIds],
  );

  // Auto-save for edit mode
  const handleAutoSave = useCallback(async (changes: Record<string, unknown>) => {
    if (!place?.id || autosaveInFlightRef.current || isSaving || isSubmitting) return;

    pendingAutosaveChangesRef.current = changes;
    try {
      autosaveInFlightRef.current = true;
      const perf = createClientSavePerf("save-place:client", {
        endpoint: `/api/business/places/${place.id}`,
        payload: changes,
      });
      const response = await fetch(`/api/business/places/${place.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      perf.log({ status: response.status, mode: "autosave" });

      if (response.ok) {
        setLastSaved(new Date());
        setAutosaveError(false);
        setOriginalData((prev) => ({ ...prev, ...changes }));
        pendingAutosaveChangesRef.current = null;
      } else {
        setAutosaveError(true);
      }
    } catch {
      setAutosaveError(true);
    } finally {
      autosaveInFlightRef.current = false;
    }
  }, [place?.id, isSaving, isSubmitting]);

  // Autosave effect
  useEffect(() => {
    if (mode === "create") {
      // Create mode: draft autosave handled by useWizardDraft hook
      return;
    } else if (mode === "edit") {
      // API autosave for edit mode — only for draft/non-published or admin.
      // Published non-admin edits go through revision flow on explicit save/submit.
      const isPublished = place?.status === "PUBLISHED";
      const isAdmin = userRole === "ADMIN";
      if (isPublished && !isAdmin) return;

      if (isSaving || isSubmitting || autosaveInFlightRef.current) {
        return;
      }
      const timer = setTimeout(() => {
        const changes = extractChanges(formData, originalData);
        if (Object.keys(changes).length > 0) {
          handleAutoSave(changes);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [formData, mode, originalData, isSaving, isSubmitting, place?.status, userRole, handleAutoSave]);

  // Update form data
  const handleChange = useCallback(
    (
      updates:
        | Partial<PlaceFormData>
        | ((prev: PlaceFormData) => Partial<PlaceFormData>),
    ) => {
      setFormData((prev) => {
        const patch = typeof updates === "function" ? updates(prev) : updates;
        return { ...prev, ...patch };
      });
    },
    [],
  );

  const showSuccessModal = useCallback(
    (payload: Omit<ContentSuccessPayload, "surface" | "returnTo">) => {
      const next = resolveContentSuccessState({
        ...payload,
        surface,
        returnTo,
        role: userRole,
      });
      if (!next) return;
      setSuccessState(next);
      setSuccessModalOpen(true);
    },
    [returnTo, surface, userRole],
  );

  // Navigation
  const handleNext = () => {
    if (currentStep < TOTAL_STEPS && canGoToNextStep(currentStep, formData)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    // On first step, go back to where user came from
    if (currentStep === 1) {
      requestLeave(afterSubmitDestination);
      return;
    }

    if (currentStep > 1 && canGoToPrevStep(currentStep)) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleGoToStep = (step: number) => {
    if (step < 1 || step > TOTAL_STEPS) return;

    if (isPublishedEditMode) {
      setCurrentStep(step);
      return;
    }

    // Allow backward navigation freely; forward only up to currentStep+1 (sequential)
    if (step <= currentStep + 1 || step < currentStep) {
      setCurrentStep(step);
    }
  };

  // Save as draft
  const handleSaveDraft = async () => {
    if (isSaving || isSubmitting) return;
    setIsSaving(true);

    try {
      if (mode === "create") {
        const body = buildCreatePlaceRequestBody(
          formData,
          createRequestId,
          "DRAFT",
          wizardSessionId
        );
        const perf = createClientSavePerf("save-place:client", {
          endpoint: "/api/business/places",
          payload: body,
        });

        const response = await fetch("/api/business/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        perf.log({ status: response.status, mode: "create-draft" });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            (err as { message?: string }).message ||
              (err as { error?: string }).error ||
              "Failed to save draft"
          );
        }

        const result = await response.json();

        await persistRelatedPlacesAfterCreate(result.place.id);

        draft.markClean();

        if (onComplete) {
          onComplete(result.place.id);
        } else {
          router.replace(editorPlaceEditHref(result.place.id));
        }
        showSuccessModal({
          kind: "place",
          outcome: "draft_saved",
          id: result.place.id,
          isEdit: false,
        });
      } else {
        // Update existing place
        if (!place) {
          toast.error("Ошибка: данные места отсутствуют");
          setIsSaving(false);
          return;
        }
        const changes = extractChanges(formData, originalData);
        if (Object.keys(changes).length === 0) {
          toast.success("Изменения уже сохранены");
          return;
        }
        const perf = createClientSavePerf("save-place:client", {
          endpoint: `/api/business/places/${place.id}`,
          payload: changes,
        });

        const response = await fetch(`/api/business/places/${place.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
        perf.log({ status: response.status, mode: "save-draft" });

        if (!response.ok) {
          throw new Error("Failed to save");
        }

        setOriginalData(formData);
        showSuccessModal({
          kind: "place",
          outcome: "draft_saved",
          id: place.id,
          isEdit: true,
        });
      }
    } catch (error: unknown) {
      console.error("Save draft error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  // Save and close (edit mode only)
  const handleSaveAndClose = async () => {
    if (mode !== "edit" || !place) {
      toast.error("Ошибка: данные места отсутствуют");
      return;
    }
    if (isSaving || isSubmitting) return;

    setIsSaving(true);

    try {
      const changes = extractChanges(formData, originalData);
      const openingHoursChanged = JSON.stringify(formData.openingHoursData) !== JSON.stringify(originalData.openingHoursData);
      if (Object.keys(changes).length === 0 && !openingHoursChanged) {
        if (isValidReturnTo(returnTo)) {
          navigateToCompatibleHref(router, returnTo!);
        } else {
          router.back();
        }
        return;
      }

      // ADMIN может редактировать опубликованные места напрямую
      // Остальные пользователи должны создавать ревизию
      const isPublished = formData.status === "PUBLISHED";
      const isAdmin = userRole === "ADMIN";
      const needsRevision = isPublished && !isAdmin;

      if (needsRevision) {
        // 1. Получить или создать ревизию
        const revisionResponse = await fetch(`/api/business/places/${place.id}/revision`);

        if (!revisionResponse.ok) {
          const errorText = await revisionResponse.text();
          const errorData = parseJsonErrorPayload(errorText);
          throw new Error(errorData.message || errorData.error || "Не удалось создать ревизию");
        }

        const { revision } = await revisionResponse.json();

        // 2. Сохранить изменения данных в ревизию (+ attach фото/лого из wizardSessionId)
        if (Object.keys(changes).length > 0 || wizardSessionId) {
          const saveResponse = await fetch(`/api/business/places/${place.id}/revision`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revisionId: revision.id,
              data: { ...changes, wizardSessionId },
            }),
          });

          if (!saveResponse.ok) {
            const errorData = parseJsonErrorPayload(await saveResponse.text());
            throw new Error(errorData.message || errorData.error || "Failed to save revision");
          }
        }

        // 3. Сохранить изменения режима работы в ревизию
        if (openingHoursChanged && formData.openingHoursData !== null) {
          const ohResponse = await fetch(`/api/business/places/${place.id}/revision/opening-hours`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revisionId: revision.id, data: formData.openingHoursData }),
          });

          if (!ohResponse.ok) {
            const errorData = await ohResponse.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || "Failed to save opening hours revision");
          }
        }

        // 4. Отправить ревизию на модерацию
        const submitResponse = await fetch(`/api/business/places/${place.id}/revision/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revisionId: revision.id }),
        });

        if (!submitResponse.ok) {
          const errorData = await submitResponse.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.error || "Failed to submit revision");
        }

        setOriginalData(formData);
        showSuccessModal({
          kind: "place",
          outcome: "submitted",
          id: place.id,
          isEdit: true,
          slug: place.slug ?? null,
          status: place.status,
        });
      } else {
        // Для черновиков или ADMIN - прямое сохранение (+ attach фото/лого из wizardSessionId)
        if (Object.keys(changes).length > 0 || wizardSessionId) {
          const response = await fetch(`/api/business/places/${place.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...changes, wizardSessionId }),
          });

          if (!response.ok) {
            const errorData = parseJsonErrorPayload(await response.text());
            throw new Error(errorData.message || errorData.error || "Failed to save");
          }
        }

        // Save opening hours if changed
        if (openingHoursChanged && formData.openingHoursData !== null) {
          const ohResponse = await fetch(`/api/business/places/${place.id}/opening-hours`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: formData.openingHoursData }),
          });
          if (!ohResponse.ok) {
            const errorData = await ohResponse.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || "Failed to save opening hours");
          }
        }

        setOriginalData(formData);
        showSuccessModal({
          kind: "place",
          outcome: formData.status === "PUBLISHED" ? "changes_published" : "draft_saved",
          id: place.id,
          isEdit: true,
          slug: place.slug ?? null,
          status: formData.status,
        });
      }
    } catch (error: unknown) {
      console.error("Save and close error:", error);
      const errorMessage = error instanceof Error ? error.message : "Не удалось сохранить изменения";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit for moderation
  const handleSubmit = async () => {
    if (isSubmitting) return;
    // Validate
    const validation = validateForSubmit(formData);
    if (!validation.isValid) {
      toast.error("Заполните все обязательные поля");
      // Go to first incomplete step
      for (let i = 1; i <= TOTAL_STEPS; i++) {
        const stepValidation = validateStep(i, formData);
        if (!stepValidation.isComplete && i < 7) {
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
        const perf = createClientSavePerf("publish-place:client", {
          endpoint: "/api/business/places",
          payload: body,
        });

        const response = await fetch("/api/business/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        perf.log({ status: response.status, mode: publishDirect ? "publish" : "submit" });

        if (!response.ok) {
          const errorText = await response.text();
          let errorPayload: Record<string, unknown> | null = null;

          try {
            errorPayload = errorText ? (JSON.parse(errorText) as Record<string, unknown>) : null;
          } catch {
            errorPayload = errorText ? { raw: errorText } : null;
          }

          console.error("[PlaceWizard] create place failed", {
            status: response.status,
            statusText: response.statusText,
            response: errorPayload,
            payload: body,
          });

          throw new Error(
            (typeof errorPayload?.message === "string" && errorPayload.message) ||
              (typeof errorPayload?.error === "string" && errorPayload.error) ||
              (typeof errorPayload?.details === "string" && errorPayload.details) ||
              `Failed to submit place (${response.status})`
          );
        }

        const result = await response.json();

        await persistRelatedPlacesAfterCreate(result.place.id);

        draft.markClean();
        showSuccessModal({
          kind: "place",
          outcome: publishDirect ? "published" : "submitted",
          id: result.place.id,
          isEdit: false,
          slug: result.place.slug ?? result.place.id,
          status: publishDirect ? "PUBLISHED" : "PENDING",
        });
      } else {
        // Submit existing place or create revision
        if (!place) {
            toast.error("Ошибка: данные места отсутствуют");
            setIsSubmitting(false);
            return;
          }
          if (place.status === "PUBLISHED") {
          const isAdmin = userRole === "ADMIN" || userRole === "MODERATOR";

          if (isAdmin) {
            // Admin: save directly without revision (+ attach фото/лого из wizardSessionId)
            const changes = extractChanges(formData, originalData);

            if (Object.keys(changes).length > 0 || wizardSessionId) {
              const response = await fetch(`/api/business/places/${place.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...changes, wizardSessionId }),
              });
              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || error.error || "Failed to save");
              }
            }

            if (formData.openingHoursData !== null) {
              const ohResponse = await fetch(`/api/business/places/${place.id}/opening-hours`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: formData.openingHoursData }),
              });
              if (!ohResponse.ok) {
                const error = await ohResponse.json();
                throw new Error(error.message || error.error || "Failed to save opening hours");
              }
            }

            setOriginalData(formData);
            showSuccessModal({
              kind: "place",
              outcome: "changes_published",
              id: place.id,
              isEdit: true,
              slug: place.slug ?? place.id,
              status: "PUBLISHED",
            });
          } else {
          // Non-admin: create/update revision for published place and submit
          const changes = extractChanges(formData, originalData);
          const openingHoursChanged =
            JSON.stringify(formData.openingHoursData) !== JSON.stringify(originalData.openingHoursData);

          // 1. Получить или создать ревизию
          const revisionResponse = await fetch(`/api/business/places/${place.id}/revision`);
          if (!revisionResponse.ok) {
            const errorData = await revisionResponse.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || "Не удалось создать ревизию");
          }
          const { revision } = await revisionResponse.json();

          // 2. Сохранить данные в ревизию (+ attach фото/лого из wizardSessionId)
          if (Object.keys(changes).length > 0 || wizardSessionId) {
            const saveResponse = await fetch(`/api/business/places/${place.id}/revision`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                revisionId: revision.id,
                data: { ...changes, wizardSessionId },
              }),
            });
            if (!saveResponse.ok) {
              const errorData = await saveResponse.json().catch(() => ({}));
              throw new Error(errorData.message || errorData.error || "Failed to save revision");
            }
          }

          // 3. Сохранить режим работы в ревизию
          if (openingHoursChanged && formData.openingHoursData !== null) {
            const ohResponse = await fetch(
              `/api/business/places/${place.id}/revision/opening-hours`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ revisionId: revision.id, data: formData.openingHoursData }),
              },
            );
            if (!ohResponse.ok) {
              const errorData = await ohResponse.json().catch(() => ({}));
              throw new Error(errorData.message || errorData.error || "Failed to save opening hours revision");
            }
          }

          // 4. Отправить ревизию на модерацию
          const submitResponse = await fetch(`/api/business/places/${place.id}/revision/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revisionId: revision.id }),
          });
          if (!submitResponse.ok) {
            const errorData = await submitResponse.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || "Failed to submit revision");
          }

          setOriginalData(formData);
          showSuccessModal({
            kind: "place",
            outcome: "submitted",
            id: place.id,
            isEdit: true,
            slug: place.slug ?? place.id,
            status: "PENDING",
          });
          }
        } else {
          // Submit draft place
          const response = await fetch(`/api/business/places/${place.id}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              openingHoursData: formData.openingHoursData,
              wizardSessionId: wizardSessionId ?? null,
            }),
          });

          if (!response.ok) {
            const error = await response.json();

            // Handle structured ValidationError from server (missing required fields)
            if (error && error.error === "VALIDATION" && Array.isArray(error.missing) && error.missing.length > 0) {
              const fieldLabels: Record<string, string> = {
                title: "Название",
                category: "Категория",
                shortDesc: "Краткое описание",
                logoImageId: "Логотип",
                location: "Местоположение",
                locationSource: "Источник местоположения",
                parentPlaceId: "Родительское место",
                floor: "Этаж",
                unit: "Помещение",
              };

              const missingLabels = error.missing.map(
                (f: string) => fieldLabels[f] || f,
              );
              toast.error(`Не заполнены обязательные поля: ${missingLabels.join(", ")}`);

              // Navigate to appropriate step based on first missing field
              const fieldToStep: Record<string, number> = {
                title: 1,
                category: 1,
                shortDesc: 1,
                logoImageId: 4,
                location: 2,
                locationSource: 2,
                parentPlaceId: 2,
                floor: 2,
                unit: 2,
              };

              for (const field of error.missing) {
                const step = fieldToStep[field];
                if (step !== undefined && step < 7) {
                  setCurrentStep(step);
                  break;
                }
              }

              setIsSubmitting(false);
              return;
            }

            throw new Error(error.message || error.error || "Failed to submit");
          }

          setOriginalData(formData);
          showSuccessModal({
            kind: "place",
            outcome: canPublishContentDirectly(userRole) ? "published" : "submitted",
            id: place.id,
            isEdit: true,
            slug: place.slug ?? place.id,
            status: canPublishContentDirectly(userRole) ? "PUBLISHED" : "PENDING",
          });
        }
      }
    } catch (error: unknown) {
      console.error("Submit error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка отправки");
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
        return (
          <FaqStep
            kind="place"
            value={formData.faqItems}
            onChange={(faqItems) => handleChange({ faqItems })}
          />
        );
      case 7:
        return <Step6Review data={formData} isSubmitting={isSubmitting} onGoToStep={handleGoToStep} />;
      default:
        return null;
    }
  };

  const stepValidation = validateStep(currentStep, formData);
  const canNext = currentStep < TOTAL_STEPS;
  const canPrev = true; // Always show back button (on step 1 it goes to returnTo)
  const isReviewStep = currentStep === 7;

  const progressSteps = useMemo(
    () => WIZARD_STEPS.map((s) => ({
      id: s.id,
      label: s.label,
      isComplete: validateStep(s.id, formData).isComplete,
    })),
    [formData]
  );

  const phase = formWizardPhaseFromFlags({ isSaving, isSubmitting });

  const actionLabels = useMemo(
    () => getBusinessFormActionLabels(userRole),
    [userRole],
  );

  const liveTitle = useMemo(() => {
    const trimmedTitle = formData.title?.trim();
    return trimmedTitle || businessFormCopy.place.createTitle;
  }, [formData.title]);

  const showBusinessRelatedPlaces = surface === "business" && currentStep === 1;
  const showAdminRelatedPlaces =
    surface === "admin" && mode === "edit" && currentStep === 1 && !!place?.id;

  return (
    <FormWizardShell>
      <FormWizardHeader
        title={liveTitle}
        subtitle={businessFormCopy.stepSubtitle(
          currentStep,
          TOTAL_STEPS,
          getStepLabel(currentStep)
        )}
        trailing={
          <div className="flex flex-col items-end gap-1">
            {mode === "edit" && place && (
              <PlaceStatusBadge
                status={place.status as ContentStatus}
                hasActiveRevision={!!activeRevision}
                revisionStatus={activeRevision?.status}
              />
            )}
            {mode === "edit" ? (
              <SaveIndicator
                status={autosaveError ? "error" : isSaving ? "saving" : lastSaved ? "saved" : "idle"}
                lastSavedAt={lastSaved}
                onRetry={
                  autosaveError && pendingAutosaveChangesRef.current
                    ? () => {
                        setAutosaveError(false);
                        if (pendingAutosaveChangesRef.current) {
                          handleAutoSave(pendingAutosaveChangesRef.current);
                        }
                      }
                    : undefined
                }
              />
            ) : (
              <SaveIndicator
                status={draft.status}
                lastSavedAt={draft.lastSavedAt}
                onRetry={draft.status === "error" ? draft.retry : undefined}
              />
            )}
          </div>
        }
      >
        <div className="space-y-3">
          <WizardProgress
            steps={progressSteps}
            currentStep={currentStep}
            onStepChange={handleGoToStep}
          />
          <div className="flex justify-end">
            <CompletionProgress data={formData} />
          </div>
        </div>
      </FormWizardHeader>

      {/* Resume-баннер черновика (только create mode) */}
      {mode === "create" && draft.hasDraft && (
        <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              У вас есть незавершённый черновик
              {draft.draftSavedAt
                ? ` (${formatRelativeTimeRu(draft.draftSavedAt)})`
                : ""}
              . Продолжить с него?
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => draft.discardDraft()}>
                Начать заново
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const restored = draft.restoreDraft();
                  if (restored) setFormData(restored);
                }}
              >
                Продолжить
              </Button>
            </div>
          </div>
        </div>
      )}

      <FormPrimaryContentCard>
        <div className="space-y-6">
          {renderStep()}

          {showBusinessRelatedPlaces ? (
            <PlaceGroupSelector
              currentPlaceId={mode === "edit" ? place?.id : undefined}
              currentGroupId={mode === "edit" ? currentPlaceGroupId : undefined}
              onGroupIdChange={mode === "edit" ? setCurrentPlaceGroupId : undefined}
              selectedPlaceIds={mode === "create" ? selectedRelatedPlaceIds : undefined}
              onSelectedPlaceIdsChange={
                mode === "create" ? setSelectedRelatedPlaceIds : undefined
              }
              disabled={
                mode === "edit" ? !isEditable || isSaving || isSubmitting : isSaving || isSubmitting
              }
              emptyStateDescription={
                mode === "create"
                  ? "Пока нет других мест для связи. После создания ещё одного места вы сможете связать их между собой."
                  : "Пока нет других мест для связи."
              }
            />
          ) : null}

          {showAdminRelatedPlaces ? (
            <AdminPlaceGroupManager
              currentPlaceId={place!.id}
              currentGroupId={currentPlaceGroupId}
            />
          ) : null}
        </div>
      </FormPrimaryContentCard>

      <FormStickyActionBar
        phase={phase}
        labels={actionLabels}
        showBack={canPrev}
        onBack={handlePrev}
        showSaveDraft={isReviewStep}
        onSaveDraft={isReviewStep ? handleSaveDraft : undefined}
        saveDraftDisabled={isSaving || isSubmitting}
        showSaveAndClose={mode === "edit" && !isReviewStep}
        onSaveAndClose={mode === "edit" ? handleSaveAndClose : undefined}
        saveAndCloseDisabled={isSaving || isSubmitting}
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

      <AlertDialog open={leaveDialogOpen} onOpenChange={onLeaveDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Уйти со страницы?</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === "create"
                ? "Черновик остаётся на этом устройстве — вы сможете продолжить позже."
                : "Изменения ещё не сохранены. Уйти?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Остаться</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave}>Уйти</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContentSuccessModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        state={successState}
      />
    </FormWizardShell>
  );
}
