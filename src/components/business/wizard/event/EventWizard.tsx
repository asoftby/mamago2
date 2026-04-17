"use client";

import {
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ContentStatus, Activity } from "@prisma/client";
import { toast } from "sonner";
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

import type { EventFormData, EventWizardMode } from "./types";
import { getDefaultFormData, hasMeaningfulContent } from "./defaults";
import { validateStep, validateForSubmit, validateForDraft } from "./validation";
import { mapEventToFormData, buildEventPayload } from "./mappers";
import {
  EVENT_WIZARD_STEPS,
  getStepLabel,
  TOTAL_EVENT_WIZARD_STEPS,
} from "./eventWizardSteps.config";

import { Step9Review } from "./steps/Step9Review";
import { EventSubmitModerationSuccessDialog } from "./EventSubmitModerationSuccessDialog";
import { EventPublishedSuccessDialog } from "./EventPublishedSuccessDialog";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { Role } from "@prisma/client";
import {
  defaultEditorNav,
  editorEventEditHref,
  type ContentEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import {
  setEventEditorSession,
  clearEventEditorReturnStep,
  readEventEditorReturnStep,
} from "@/lib/business/eventEditorReturnStep";
import { parseEventEditorStepQuery } from "@/lib/business/eventEditorStepQuery";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";

interface EventWizardProps {
  mode: EventWizardMode;
  event?: Activity; // Event entity for edit mode
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
  onComplete?: (eventId: string) => void;
  editorSurface?: ContentEditorSurface;
  contentEditorNav?: Partial<ContentEditorNav>;
  returnTo?: string;
  /** Серверный `?step=` — чтобы не было гонки с URL-sync (state=1 затирал ?step=N). */
  initialEditStep?: number;
}

const LOCAL_STORAGE_KEY = "event-wizard-draft";
const CURRENT_STEP_STORAGE_KEY = "event-wizard-current-step";
const TOTAL_STEPS = TOTAL_EVENT_WIZARD_STEPS;

function eventSlugFromSubmitBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const ev = (body as { event?: { slug?: unknown } }).event;
  const s = ev?.slug;
  return typeof s === "string" && s.trim().length > 0 ? s.trim() : null;
}

function apiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const b = body as { error?: unknown; errors?: unknown };
  if (Array.isArray(b.errors) && b.errors.length > 0) {
    const lines = b.errors.filter((e): e is string => typeof e === "string");
    if (lines.length > 0) return lines.join("\n");
  }
  if (typeof b.error === "string" && b.error.length > 0) return b.error;
  return fallback;
}

/** Submit API returns PENDING for business authors; show success modal instead of toast + redirect. */
function isModerationPendingSuccess(userRole: Role | undefined, submitBody: unknown): boolean {
  if (canPublishContentDirectly(userRole)) return false;
  if (!submitBody || typeof submitBody !== "object") return false;
  const ev = (submitBody as { event?: { status?: unknown } }).event;
  return ev?.status === "PENDING";
}

function isPublishedSuccess(submitBody: unknown): boolean {
  if (!submitBody || typeof submitBody !== "object") return false;
  const ev = (submitBody as { event?: { status?: unknown } }).event;
  return ev?.status === "PUBLISHED";
}

function EventWizardInner({
  mode,
  event,
  userId,
  userRole,
  business,
  onComplete,
  editorSurface,
  contentEditorNav,
  returnTo,
  initialEditStep,
}: EventWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const surface: ContentEditorSurface = editorSurface ?? "business";
  const nav: ContentEditorNav = {
    ...defaultEditorNav(surface, "event"),
    ...contentEditorNav,
  };
  const afterSubmitDestination = returnTo ?? nav.afterSubmitListPath;
  const [moderationSuccessModalOpen, setModerationSuccessModalOpen] = useState(false);
  const [moderationSuccessEventId, setModerationSuccessEventId] = useState<string | null>(null);
  const [publishedSuccessModalOpen, setPublishedSuccessModalOpen] = useState(false);
  const [publishedActivityHref, setPublishedActivityHref] = useState<string | null>(null);
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
  const [eventId, setEventId] = useState<string | null>(
    mode === "edit" && event ? event.id : null
  );
  const [formData, setFormData] = useState<EventFormData>(() => {
    if (mode === "edit" && event) {
      return mapEventToFormData(event);
    }
    return getDefaultFormData();
  });

  /** Новое создание: не восстанавливаем незавершённое заполнение из localStorage. */
  useEffect(() => {
    if (mode !== "create" || typeof window === "undefined") return;
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [mode]);

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  /** sessionStorage для шага — один раз на смену `eventId`, только если в URL нет `step`. */
  const sessionHydratedForEventRef = useRef<string | null>(null);

  /**
   * Строка `step` из query (примитив) — в deps эффектов вместо объекта `searchParams`.
   */
  const stepQuery = searchParams.get("step") ?? "";

  /**
   * state ← URL / session. На клиенте сначала читаем `window.location`: после клика по Link
   * `useSearchParams` иногда отстаёт от фактического URL.
   */
  useLayoutEffect(() => {
    if (mode !== "edit" || !eventId) return;
    const raw =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("step")
        : null;
    const q = (raw ?? searchParams.get("step") ?? "") || "";
    const parsed = parseEventEditorStepQuery(q || null);
    if (parsed != null) {
      setCurrentStep(parsed);
      clearEventEditorReturnStep();
      return;
    }
    if (sessionHydratedForEventRef.current !== eventId) {
      sessionHydratedForEventRef.current = eventId;
      const fromStore = readEventEditorReturnStep(eventId);
      if (fromStore != null && fromStore >= 1 && fromStore <= TOTAL_STEPS) {
        setCurrentStep(fromStore);
      }
    }
  }, [mode, eventId, stepQuery]);

  /**
   * state → URL. Зависимости без `searchParams`: берём актуальные query из `window`,
   * иначе replace порождает новый searchParams → лишние проходы эффекта.
   */
  useEffect(() => {
    if (mode !== "edit" || !eventId) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("step") === String(currentStep)) return;
    params.set("step", String(currentStep));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [currentStep, mode, eventId, pathname, router]);

  // Wizard session for temp media (без записи в БД до явного сохранения)
  const { wizardSessionId, clearSession } = useWizardSession({
    userId,
    wizardType: "event",
    entityId: mode === "edit" ? event?.id : undefined,
  });

  useEffect(() => {
    if (mode !== "create") return;
    return () => {
      if (!eventId) {
        void clearSession();
      }
    };
  }, [mode, eventId, clearSession]);

  /** Закрытие вкладки / обновление без сохранения черновика в БД */
  useEffect(() => {
    if (mode !== "create" || typeof window === "undefined") return;
    const unsaved = !eventId && hasMeaningfulContent(formData);
    if (!unsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [mode, eventId, formData]);

  // Update form data
  const handleChange = useCallback((updates: Partial<EventFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Navigation
  const handleNext = () => {
    if (currentStep >= TOTAL_STEPS) return;

    // Block forward navigation if current step isn't complete
    const validation = validateStep(currentStep, formData);
    if (!validation.isComplete) {
      toast.error("Заполните обязательные поля перед переходом дальше");
      return;
    }

    setCurrentStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleGoToStep = (step: number) => {
    if (step < 1 || step > TOTAL_STEPS) return;

    // Allow going back freely
    if (step <= currentStep) {
      setCurrentStep(step);
      return;
    }

    // For any forward jump, ensure all intermediate steps are complete
    for (let s = currentStep; s < step; s += 1) {
      const validation = validateStep(s, formData);
      if (!validation.isComplete) {
        toast.error("Заполните обязательные поля перед переходом дальше");
        return;
      }
    }

    setCurrentStep(step);
  };

  // Save as draft
  const handleSaveDraft = async () => {
    const draftCheck = validateForDraft(formData);
    if (!draftCheck.isValid) {
      toast.error(draftCheck.errors[0] ?? "Заполните обязательные поля");
      return;
    }

    setIsSaving(true);
    
    try {
      const payload = buildEventPayload(formData);
      
      if (eventId) {
        const response = await fetch(`/api/business/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(apiErrorMessage(error, "Не удалось сохранить"));
        }

        toast.success("Изменения сохранены");
        setLastSaved(new Date());

        // Если есть returnTo, всегда возвращаемся туда после сохранения
        if (returnTo) {
          router.push(returnTo);
          return;
        }

        // Если нет returnTo, используем старую логику
        if (mode === "edit") {
          setEventEditorSession(eventId, { returnStep: currentStep });
          router.push(`/me/events/${eventId}/preview`);
          return;
        }
      } else {
        // Create new draft
        const response = await fetch("/api/business/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const errorBody = await response.json();
          throw new Error(apiErrorMessage(errorBody, "Не удалось создать черновик"));
        }
        
        const data = await response.json();
        setEventId(data.event.id);
        
        if (onComplete) {
          onComplete(data.event.id);
        } else {
          router.push(editorEventEditHref(data.event.id));
        }
      }
      
      toast.success("Черновик сохранен");
      setLastSaved(new Date());
      
      if (mode === "create" && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
      }
    } catch (error: unknown) {
      console.error("Save draft error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  /** Опубликованное событие: финальный шаг — сохранить, отправить на проверку, редирект на карточку. */
  const handlePublishedReviewSave = async () => {
    const validation = validateForSubmit(formData);
    if (!validation.isValid) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildEventPayload(formData);
      const tid = eventId ?? (mode === "edit" && event ? event.id : null);
      if (!tid) {
        throw new Error("Не найден идентификатор события");
      }

      const patchResponse = await fetch(`/api/business/events/${tid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!patchResponse.ok) {
        const errorBody = await patchResponse.json();
        throw new Error(apiErrorMessage(errorBody, "Не удалось сохранить событие"));
      }

      const submitResponse = await fetch(`/api/business/events/${tid}/submit`, {
        method: "POST",
      });
      if (!submitResponse.ok) {
        const errorBody = await submitResponse.json();
        throw new Error(apiErrorMessage(errorBody, "Не удалось отправить на проверку"));
      }

      const submitBody = await submitResponse.json();
      const href = publicActivityPath(
        tid,
        formData.city,
        eventSlugFromSubmitBody(submitBody),
      );
      router.push(href);
      toast.success(
        canPublishContentDirectly(userRole)
          ? "Изменения опубликованы"
          : "Изменения сохранены и отправлены на проверку",
      );
      setLastSaved(new Date());
      if (mode === "create" && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
      }
    } catch (error: unknown) {
      console.error("Published review save error:", error);
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setIsSubmitting(false);
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
      const payload = buildEventPayload(formData);
      const targetId = eventId ?? (mode === "edit" && event ? event.id : null);

      if (!targetId) {
        const createResponse = await fetch("/api/business/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!createResponse.ok) {
          const errorBody = await createResponse.json();
          throw new Error(apiErrorMessage(errorBody, "Не удалось создать событие"));
        }
        
        const createData = await createResponse.json();
        const newId = createData.event.id;
        setEventId(newId);
        
        const submitResponse = await fetch(`/api/business/events/${newId}/submit`, {
          method: "POST",
        });
        
        if (!submitResponse.ok) {
          const errorBody = await submitResponse.json();
          throw new Error(apiErrorMessage(errorBody, "Не удалось отправить на модерацию"));
        }

        const submitBody = await submitResponse.json();
        if (isModerationPendingSuccess(userRole, submitBody)) {
          if (mode === "create" && typeof window !== "undefined") {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
          }
          setModerationSuccessEventId(newId);
          setModerationSuccessModalOpen(true);
          return;
        }
        if (isPublishedSuccess(submitBody)) {
          if (mode === "create" && typeof window !== "undefined") {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
          }
          setPublishedActivityHref(
            publicActivityPath(newId, formData.city, eventSlugFromSubmitBody(submitBody)),
          );
          setPublishedSuccessModalOpen(true);
          return;
        }

        toast.success(
          canPublishContentDirectly(userRole)
            ? "Событие опубликовано"
            : "Событие отправлено на модерацию",
        );

        if (mode === "create" && typeof window !== "undefined") {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }

        if (onComplete) {
          onComplete(newId);
        } else {
          router.push(afterSubmitDestination);
        }
        return;
      }

      const patchResponse = await fetch(`/api/business/events/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!patchResponse.ok) {
        const errorBody = await patchResponse.json();
        throw new Error(apiErrorMessage(errorBody, "Не удалось сохранить событие"));
      }
      
      const submitResponse = await fetch(`/api/business/events/${targetId}/submit`, {
        method: "POST",
      });
      
      if (!submitResponse.ok) {
        const errorBody = await submitResponse.json();
        throw new Error(apiErrorMessage(errorBody, "Не удалось отправить на модерацию"));
      }

      const submitBody = await submitResponse.json();
      if (isModerationPendingSuccess(userRole, submitBody)) {
        if (mode === "create" && typeof window !== "undefined") {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
        }
        setModerationSuccessEventId(targetId);
        setModerationSuccessModalOpen(true);
        return;
      }
      if (isPublishedSuccess(submitBody)) {
        if (mode === "create" && typeof window !== "undefined") {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
        }
        setPublishedActivityHref(
          publicActivityPath(targetId, formData.city, eventSlugFromSubmitBody(submitBody)),
        );
        setPublishedSuccessModalOpen(true);
        return;
      }

      toast.success(
        canPublishContentDirectly(userRole)
          ? "Событие опубликовано"
          : "Событие отправлено на модерацию",
      );
      
      if (mode === "create" && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
      }
      
      if (onComplete) {
        onComplete(targetId);
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

  const displayTitleRaw = formData.title?.trim() ?? "";
  const displayTitle =
    displayTitleRaw.length === 0
      ? businessFormCopy.event.createTitle
      : displayTitleRaw.length <= 60
        ? displayTitleRaw
        : `${displayTitleRaw.slice(0, 57)}...`;

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

  const canNext =
    currentStep < TOTAL_STEPS && validateStep(currentStep, formData).isComplete;
  const canPrev = currentStep > 1;
  const isReviewStep = currentStep === TOTAL_STEPS;
  const isPublishedEdit =
    mode === "edit" && event?.status === ContentStatus.PUBLISHED;
  const isPublishedEditReview = isPublishedEdit && isReviewStep;

  const segments = useMemo(
    () => [
      ...EVENT_WIZARD_STEPS.map((s) => ({ id: s.id, title: s.title })),
      { id: TOTAL_STEPS, title: businessFormCopy.reviewStepShortTitle },
    ],
    []
  );

  const actionLabels = useMemo(() => {
    const base = getBusinessFormActionLabels(userRole);
    if (isPublishedEditReview) {
      return {
        ...base,
        submit: "Сохранить изменения",
        submitting: "Сохранение...",
      };
    }
    if (mode !== "edit" || !event?.status) return base;
    const published = event.status === ContentStatus.PUBLISHED;
    return {
      ...base,
      saveDraft: published ? "Сохранить изменения" : "Сохранить",
    };
  }, [userRole, mode, event, isPublishedEditReview]);

  const showSaveDraftInBar = (mode === "edit" || isReviewStep) && !isPublishedEditReview;

  const phase = formWizardPhaseFromFlags({ isSaving, isSubmitting });

  return (
    <FormWizardShell>
      <FormWizardHeader
        title={displayTitle}
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
        showSaveDraft={showSaveDraftInBar}
        onSaveDraft={showSaveDraftInBar ? handleSaveDraft : undefined}
        saveDraftDisabled={isSaving || isSubmitting}
        isReviewStep={isReviewStep}
        onContinue={!isReviewStep ? handleNext : undefined}
        continueDisabled={!canNext || isSaving || isSubmitting}
        onSubmit={
          isReviewStep
            ? isPublishedEditReview
              ? handlePublishedReviewSave
              : handleSubmit
            : undefined
        }
        submitDisabled={
          isSubmitting || isSaving || !submitValidation.isValid
        }
      />

      {moderationSuccessEventId && (
        <EventSubmitModerationSuccessDialog
          open={moderationSuccessModalOpen}
          onOpenChange={setModerationSuccessModalOpen}
          eventId={moderationSuccessEventId}
        />
      )}

      {publishedActivityHref && (
        <EventPublishedSuccessDialog
          open={publishedSuccessModalOpen}
          onOpenChange={setPublishedSuccessModalOpen}
          activityHref={publishedActivityHref}
        />
      )}
    </FormWizardShell>
  );
}

export function EventWizard(props: EventWizardProps) {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-[50vh] rounded-xl bg-muted/25"
          aria-hidden
        />
      }
    >
      <EventWizardInner {...props} />
    </Suspense>
  );
}
