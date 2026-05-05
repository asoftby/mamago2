"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ContentStatus, Activity } from "@prisma/client";
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

import type { EventFormData, EventWizardMode } from "./types";
import { hasMeaningfulContent } from "./defaults";
import { validateStep, validateForSubmit, validateForDraft } from "./validation";
import { buildEventPayload } from "./mappers";
import {
  EVENT_WIZARD_STEPS,
  getStepLabel,
  TOTAL_EVENT_WIZARD_STEPS,
} from "./eventWizardSteps.config";
import { useEventEditorDraft } from "./useEventEditorDraft";

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
  clearEventEditorReturnStep,
  readEventEditorReturnStep,
} from "@/lib/business/eventEditorReturnStep";
import { parseEventEditorStepQuery } from "@/lib/business/eventEditorStepQuery";
import { navigateToCompatibleHref } from "@/lib/routing/clientNavigation";
import type { EventStep1Taxonomies } from "./steps/step1Taxonomies";
import { useAiEnrichment } from "./useAiEnrichment";
import { applyAiEnrichmentToDraft } from "@/lib/event/applyAiEnrichment";

type AiSuggestedFields = {
  participationFormat: boolean;
  atmosphere: boolean;
  interests: boolean;
  mainCategory: boolean;
};

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
  initialStep1Taxonomies?: EventStep1Taxonomies;
  /** ImportedRecord id — enables AI enrichment button on Step 1 */
  importedRecordId?: string | null;
  /** Pre-fetched AI enrichment (from server) — cached, no auto-fetch */
  initialAiEnrichment?: import("@/lib/ai/enrichEvent").EnrichmentResult | null;
}

const LOCAL_STORAGE_KEY = "event-wizard-draft";
const CURRENT_STEP_STORAGE_KEY = "event-wizard-current-step";
const TOTAL_STEPS = TOTAL_EVENT_WIZARD_STEPS;
const DEBUG_EDITOR = process.env.NODE_ENV !== "production";

function debugEditorLog(message: string, payload?: Record<string, unknown>) {
  if (!DEBUG_EDITOR) return;
  if (payload) {
    console.debug(`[EventEditor] ${message}`, payload);
    return;
  }
  console.debug(`[EventEditor] ${message}`);
}

function eventSlugFromSubmitBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const ev = (body as { event?: { slug?: unknown } }).event;
  const s = ev?.slug;
  return typeof s === "string" && s.trim().length > 0 ? s.trim() : null;
}

function eventPublicPathFromSubmitBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const ev = (body as { event?: { publicPath?: unknown } }).event;
  return typeof ev?.publicPath === "string" && ev.publicPath.trim().length > 0
    ? ev.publicPath.trim()
    : null;
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
  initialStep1Taxonomies,
  importedRecordId,
  initialAiEnrichment,
}: EventWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
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
  const {
    draft: formData,
    patchDraft: patchFormData,
    clearPersistedDraft,
  } = useEventEditorDraft({
    mode,
    event,
    persistenceKey: eventId ?? event?.id ?? "new",
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

  // ── AI enrichment ─────────────────────────────────────────────────────────
  const {
    enrichment: aiEnrichment,
    isLoading: isAiLoading,
    isDone: isAiDone,
    manualOverrides: aiManualOverrides,
    markManualOverride: markAiManualOverride,
    run: runAiEnrichment,
  } = useAiEnrichment({
    importedRecordId,
    activityId: eventId ?? event?.id ?? null,
    initialEnrichment: initialAiEnrichment,
  });
  const [aiAppliedFields, setAiAppliedFields] = useState<string[]>([]);
  const [aiSuggestedFields, setAiSuggestedFields] = useState<AiSuggestedFields>({
    participationFormat: false,
    atmosphere: false,
    interests: false,
    mainCategory: false,
  });

  const handleAiManualOverride = useCallback(
    (field: string) => {
      setAiSuggestedFields((prev) => {
        if (field === "format") {
          return { ...prev, participationFormat: false };
        }
        if (field === "eventFormats") {
          return { ...prev, atmosphere: false };
        }
        if (field === "interestIds") {
          return { ...prev, interests: false };
        }
        if (field === "categoryId") {
          return { ...prev, mainCategory: false };
        }
        return prev;
      });
      markAiManualOverride(field);
    },
    [markAiManualOverride],
  );

  // Apply enrichment when a new result arrives. Only untouched Step 1 fields are patched.
  const lastAppliedEnrichmentRef = useRef<typeof aiEnrichment>(null);
  useEffect(() => {
    if (!aiEnrichment) return;
    if (lastAppliedEnrichmentRef.current === aiEnrichment) return;

    lastAppliedEnrichmentRef.current = aiEnrichment;

    const { updates, appliedFields } = applyAiEnrichmentToDraft(formData, aiEnrichment, {
      manualOverrides: aiManualOverrides,
    });
    setAiAppliedFields(appliedFields);
    setAiSuggestedFields({
      participationFormat:
        "format" in updates && Boolean(aiEnrichment.participationFormat),
      atmosphere:
        "eventFormats" in updates &&
        (aiEnrichment.atmosphereSignals?.length ?? 0) > 0,
      interests:
        "interestIds" in updates &&
        (aiEnrichment.interestSignals?.length ?? 0) > 0,
      mainCategory:
        "categoryId" in updates && Boolean(aiEnrichment.mainCategory),
    });

    if (Object.keys(updates).length > 0) {
      patchFormData(updates);
    }

    if (appliedFields.length > 0) {
      toast.success(
        aiEnrichment.partial
          ? "Частично определено автоматически"
          : "Поля определены автоматически",
      );
      return;
    }

    if (isAiDone) {
      toast.message("AI не нашёл достаточно уверенных значений для применения");
    }
  }, [aiEnrichment, aiManualOverrides, formData, isAiDone, patchFormData]);

  useEffect(() => {
    debugEditorLog("wizard mounted", {
      mode,
      eventId: event?.id ?? null,
      pathname,
      initialEditStep: initialEditStep ?? null,
    });
    return () => {
      debugEditorLog("wizard unmounted", {
        mode,
        eventId: event?.id ?? null,
        pathname,
      });
    };
  }, [event?.id, initialEditStep, mode, pathname]);

  useEffect(() => {
    if (!DEBUG_EDITOR || typeof window === "undefined") return;

    const handleSubmitCapture = (submitEvent: Event) => {
      const form = submitEvent.target as HTMLFormElement | null;
      debugEditorLog("native submit captured", {
        defaultPrevented: submitEvent.defaultPrevented,
        action: form?.action ?? null,
        method: form?.method ?? null,
        id: form?.id ?? null,
      });
    };

    window.addEventListener("submit", handleSubmitCapture, true);
    return () => window.removeEventListener("submit", handleSubmitCapture, true);
  }, []);

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
    const q = raw ?? "";
    const parsed = parseEventEditorStepQuery(q || null);
    if (parsed != null) {
      debugEditorLog("step restored from url", { parsed, eventId });
      setCurrentStep(parsed);
      clearEventEditorReturnStep();
      return;
    }
    if (sessionHydratedForEventRef.current !== eventId) {
      sessionHydratedForEventRef.current = eventId;
      const fromStore = readEventEditorReturnStep(eventId);
      if (fromStore != null && fromStore >= 1 && fromStore <= TOTAL_STEPS) {
        debugEditorLog("step restored from session", { fromStore, eventId });
        setCurrentStep(fromStore);
      }
    }
  }, [mode, eventId]);

  useEffect(() => {
    if (mode !== "edit" || typeof window === "undefined") return;

    const handlePopState = () => {
      const raw = new URLSearchParams(window.location.search).get("step");
      const parsed = parseEventEditorStepQuery(raw);
      if (parsed != null) {
        debugEditorLog("step updated from popstate", { parsed });
        setCurrentStep(parsed);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [mode]);

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
    const nextSearch = params.toString();
    const nextHref = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname;
    debugEditorLog("replaceState step sync", { currentStep, nextHref });
    window.history.replaceState(window.history.state, "", nextHref);
  }, [currentStep, mode, eventId, pathname]);

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
    patchFormData(updates);
  }, [patchFormData]);

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
    // On first step, go back to where user came from
    if (currentStep === 1) {
      router.push(afterSubmitDestination);
      return;
    }
    
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
    debugEditorLog("save draft started", { mode, eventId, currentStep });
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
          debugEditorLog("router.push after create draft", {
            href: editorEventEditHref(data.event.id),
          });
          router.push(editorEventEditHref(data.event.id));
        }
      }
      
      toast.success("Черновик сохранен");
      setLastSaved(new Date());
      
      if (mode === "create" && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
        clearPersistedDraft();
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
    debugEditorLog("published review save started", { eventId, currentStep });
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
      const href =
        eventPublicPathFromSubmitBody(submitBody) ??
        publicActivityPath(tid, formData.city, eventSlugFromSubmitBody(submitBody));
      debugEditorLog("router.push to public activity", { href });
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
        clearPersistedDraft();
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
    debugEditorLog("submit started", { mode, eventId, currentStep });
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
            clearPersistedDraft();
          }
          setModerationSuccessEventId(newId);
          setModerationSuccessModalOpen(true);
          return;
        }
        if (isPublishedSuccess(submitBody)) {
          if (mode === "create" && typeof window !== "undefined") {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
            clearPersistedDraft();
          }
          setPublishedActivityHref(
            eventPublicPathFromSubmitBody(submitBody) ??
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
          clearPersistedDraft();
        }

        if (onComplete) {
          onComplete(newId);
        } else {
          debugEditorLog("router.push after create submit", {
            href: afterSubmitDestination,
          });
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
          clearPersistedDraft();
        }
        setModerationSuccessEventId(targetId);
        setModerationSuccessModalOpen(true);
        return;
      }
      if (isPublishedSuccess(submitBody)) {
        if (mode === "create" && typeof window !== "undefined") {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          localStorage.removeItem(CURRENT_STEP_STORAGE_KEY);
          clearPersistedDraft();
        }
        setPublishedActivityHref(
          eventPublicPathFromSubmitBody(submitBody) ??
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
        clearPersistedDraft();
      }
      
      if (onComplete) {
        onComplete(targetId);
      } else if (mode === "create") {
        debugEditorLog("navigate after submit", { href: afterSubmitDestination, reason: "create" });
        navigateToCompatibleHref(router, afterSubmitDestination);
      } else if (returnTo) {
        debugEditorLog("navigate after submit", { href: returnTo, reason: "returnTo" });
        navigateToCompatibleHref(router, returnTo);
      } else if (surface === "admin") {
        debugEditorLog("navigate after submit", { href: nav.afterSubmitListPath, reason: "admin surface" });
        navigateToCompatibleHref(router, nav.afterSubmitListPath);
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
    
    // Add import-aware context for steps that depend on the current event entity
    if (
      stepConfig.key === "location" ||
      stepConfig.key === "media" ||
      stepConfig.key === "schedule" ||
      stepConfig.key === "pricing" ||
      stepConfig.key === "contacts" ||
      stepConfig.key === "organizer"
    ) {
      if (stepConfig.key === "organizer" || stepConfig.key === "location") {
        return <StepComponent {...commonProps} eventId={eventId ?? event?.id} />;
      }
      return <StepComponent {...commonProps} wizardSessionId={wizardSessionId} eventId={eventId ?? event?.id} />;
    }
    
    if (stepConfig.key === "basics") {
      return (
        <StepComponent
          {...commonProps}
          initialTaxonomies={initialStep1Taxonomies}
          aiEnrichment={aiEnrichment}
          aiAppliedFields={aiAppliedFields}
          aiSuggestedFields={aiSuggestedFields}
          onRunAiEnrichment={importedRecordId ? runAiEnrichment : undefined}
          onAiManualOverride={handleAiManualOverride}
          isAiLoading={isAiLoading}
          isAiDone={isAiDone}
        />
      );
    }

    return <StepComponent {...commonProps} />;
  };

  const canNext =
    currentStep < TOTAL_STEPS && validateStep(currentStep, formData).isComplete;
  const canPrev = true; // Always show back button (on step 1 it goes to returnTo)
  const isReviewStep = currentStep === TOTAL_STEPS;
  const isPublishedEdit =
    mode === "edit" && event?.status === ContentStatus.PUBLISHED;
  const isPublishedEditReview = isPublishedEdit && isReviewStep;

  const progressSteps = useMemo(
    () => [
      ...EVENT_WIZARD_STEPS.map((s) => ({
        id: s.id,
        label: s.shortLabel ?? s.title,
        isComplete: s.isComplete ? s.isComplete(formData) : false,
      })),
      { id: TOTAL_STEPS, label: "Проверка", isComplete: false },
    ],
    [formData]
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
        <WizardProgress
          steps={progressSteps}
          currentStep={currentStep}
          onStepChange={handleGoToStep}
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
  return <EventWizardInner {...props} />;
}
