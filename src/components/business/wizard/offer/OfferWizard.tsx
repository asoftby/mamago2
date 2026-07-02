"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  FormWizardShell,
  FormWizardHeader,
  FormPrimaryContentCard,
  FormStickyActionBar,
  SaveIndicator,
  formatRelativeTimeRu,
  formWizardPhaseFromFlags,
} from "@/components/form-shell";
import { Button } from "@/components/ui/button";
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
import { WizardProgress } from "@/components/ui/wizard-progress";
import { getBusinessFormActionLabels, businessFormCopy } from "../businessFormLabels";
import { canPublishContentDirectly } from "@/lib/auth/businessContentAccess";
import { useWizardSession } from "@/hooks/useWizardSession";
import { useWizardDraft } from "@/hooks/useWizardDraft";
import { useUnsavedChangesNavigationGuard } from "@/hooks/use-unsaved-changes-navigation-guard";

import type { OfferFormData, OfferWizardMode, OfferWizardStepKey } from "./types";
import { getDefaultFormData, hasMeaningfulContent } from "./defaults";
import { validateForSubmit, type ValidationResult } from "./validation";
import {
  getStepsForOfferType,
  getStepNumber,
  isStepComplete,
  getMissingFieldsForStep,
  getNextStepKey,
  getPreviousStepKey,
  normalizeWizardCompletedSteps,
  ALL_OFFER_WIZARD_STEP_KEYS,
} from "./offerWizardSteps.config";
import {
  buildOfferCreatePayload,
  buildOfferUpdatePayload,
  mapOfferToFormData,
} from "./mappers";

import { Step8Review } from "./steps/Step8Review";
import { Step4CampSchedule } from "./steps/Step4CampSchedule";
import { Step5Accommodation } from "./steps/Step5Accommodation";
import { campImpliesLodging } from "./campOfferModel";
import type { Role, Offer } from "@prisma/client";
import {
  defaultEditorNav,
  editorOfferEditHref,
  type ContentEditorNav,
  type ContentEditorSurface,
} from "@/lib/content-editor/types";
import { resolveDraftTitle } from "@/lib/content-editor/resolveDraftTitle";
import { ContentSuccessModal } from "@/components/shared/ContentSuccessModal";
import { resolveContentSuccessState } from "@/lib/content-success/resolver";
import type { ContentSuccessPayload, ResolvedContentSuccessState } from "@/lib/content-success/types";

// Import step components
import { Step1Type } from "./steps/Step1Type";
import { Step2Placements } from "./steps/Step2Placements";
import { Step2Information } from "./steps/Step2Information";
import { Step3Media } from "./steps/Step3Media";
import { Step4Conditions } from "./steps/Step4Conditions";
import { Step5Pricing } from "./steps/Step5Pricing";
import { Step6Contacts } from "./steps/Step6Contacts";
import { FaqStep } from "../shared/FaqStep";

interface OfferWizardProps {
  mode: OfferWizardMode;
  offer?: Offer & {
    place?: {
      id: string;
      title: string;
      city?: {
        slug: string;
      } | null;
    } | null;
  };
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
  onComplete?: (offerId: string) => void;
  defaultPlaceId?: string | null;
  editorSurface?: ContentEditorSurface;
  contentEditorNav?: Partial<ContentEditorNav>;
  returnTo?: string;
  /** 1-based шаг в мастере (из query `?step=`). Только для `mode="edit"`. */
  initialStepNumber?: number;
  ctaStepEnabled?: boolean;
}

/** Ключ автосейва до миграции на useWizardDraft — подчищается на mount */
const LEGACY_LOCAL_STORAGE_KEY = "offer-wizard-draft";

/** Версия схемы черновика; bump при несовместимом изменении OfferFormData/шагов */
const OFFER_WIZARD_DRAFT_SCHEMA_VERSION = 1;

/** Черновик мастера: данные формы + прогресс прохождения шагов */
interface OfferWizardDraftData {
  formData: OfferFormData;
  completedSteps: OfferWizardStepKey[];
  currentStep: OfferWizardStepKey;
}

type OfferMutationErrorPayload = {
  code?: string;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[];
};

const OFFER_API_FIELD_LABELS: Record<string, string> = {
  "selectedPlace.id": "Место",
  kind: "Тип предложения",
  title: "Название",
  shortDescription: "Краткое описание",
  ageMinMonths: "Возраст от",
  ageMaxMonths: "Возраст до",
  coverImage: "Главное изображение",
  videoUrl: "Видео",
  singlePrice: "Цена",
  pricingOptions: "Варианты цен",
  ctaType: "Тип действия",
  phone: "Телефон для связи",
  website: "Ссылка",
  contactPhone: "Контактный телефон",
  contactPhone2: "Дополнительный телефон",
  contactPhone3: "Дополнительный телефон",
  contactWebsite: "Сайт",
  faqItems: "FAQ",
  wizardCompletedSteps: "Прогресс мастера",
  productType: "Тип предложения",
  requestedPlacements: "Сценарии размещения",
  details: "Детали предложения",
  category: "Категория услуги",
  partyLocationType: "Формат проведения",
  minChildren: "Минимум детей",
  maxChildren: "Максимум детей",
  occasions: "Подходящие праздники",
  campProgramType: "Тип программы лагеря",
  campSessions: "Смены лагеря",
  campIncludedMeals: "Питание",
};

class OfferMutationError extends Error {
  description?: string;

  constructor(message: string, description?: string) {
    super(message);
    this.name = "OfferMutationError";
    this.description = description;
  }
}

function isOfferMutationErrorPayload(value: unknown): value is OfferMutationErrorPayload {
  return Boolean(value) && typeof value === "object";
}

function humanizeOfferFieldPath(fieldPath: string): string {
  const directMatch = OFFER_API_FIELD_LABELS[fieldPath];
  if (directMatch) return directMatch;

  const normalized = fieldPath.replace(/\.\d+/g, "");
  const normalizedMatch = OFFER_API_FIELD_LABELS[normalized];
  if (normalizedMatch) return normalizedMatch;

  if (fieldPath.startsWith("pricingOptions.")) return "Варианты цен";
  if (fieldPath.startsWith("campSessions.")) return "Смены лагеря";
  if (fieldPath.startsWith("contactSocialLinks.")) return "Соцсети";
  if (fieldPath.startsWith("faqItems.")) return "FAQ";
  if (fieldPath.startsWith("wizardCompletedSteps.")) return "Прогресс мастера";

  return fieldPath;
}

function describeOfferMutationError(errorData: OfferMutationErrorPayload): {
  message: string;
  description?: string;
} {
  const fieldEntry = Object.entries(errorData.fieldErrors ?? {}).find(
    ([, messages]) => Array.isArray(messages) && messages.length > 0,
  );

  if (fieldEntry) {
    const [fieldPath, messages] = fieldEntry;
    return {
      message: messages?.[0] || errorData.message || errorData.error || "Проверьте поля формы",
      description: `Поле: ${humanizeOfferFieldPath(fieldPath)}`,
    };
  }

  const formError = errorData.formErrors?.[0];
  if (formError) {
    return { message: formError };
  }

  return {
    message: errorData.message || errorData.error || "Проверьте поля формы",
  };
}

async function parseOfferMutationResponse<T>(
  response: Response,
  options: {
    fallbackMessage: string;
    operation: string;
    payload?: unknown;
  },
): Promise<T> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (isOfferMutationErrorPayload(body) && body.code === "VALIDATION_ERROR") {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[OfferWizard] ${options.operation} validation error`, {
          payload: options.payload,
          response: body,
          status: response.status,
        });
      }

      const described = describeOfferMutationError(body);
      throw new OfferMutationError(described.message, described.description);
    }

    if (isOfferMutationErrorPayload(body)) {
      throw new OfferMutationError(
        body.message || body.error || options.fallbackMessage,
      );
    }

    throw new OfferMutationError(options.fallbackMessage);
  }

  return body as T;
}

export function OfferWizard({
  mode,
  offer,
  userId,
  userRole,
  onComplete,
  defaultPlaceId,
  editorSurface,
  contentEditorNav,
  returnTo,
  initialStepNumber,
  ctaStepEnabled,
}: OfferWizardProps) {
  const router = useRouter();
  const surface: ContentEditorSurface = editorSurface ?? "business";
  const nav: ContentEditorNav = {
    ...defaultEditorNav(surface, "offer"),
    ...contentEditorNav,
  };
  const afterSubmitDestination = returnTo ?? nav.afterSubmitListPath;
  const isPublishedEditMode = mode === "edit" && offer?.status === "PUBLISHED";
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successState, setSuccessState] = useState<ResolvedContentSuccessState | null>(null);
  
  const [formData, setFormData] = useState<OfferFormData>(() => {
    if (mode === "edit" && offer) {
      return mapOfferToFormData(offer);
    }
    return getDefaultFormData(defaultPlaceId ?? null);
  });
  
  // Get steps based on current offer type
  const steps = getStepsForOfferType(formData.offerWizardType);
  const totalSteps = steps.length;
  
  // Current step key (not number)
  const [currentStepKey, setCurrentStepKey] = useState<OfferWizardStepKey>(() => {
    if (mode !== "edit" || !offer || initialStepNumber == null || initialStepNumber < 1) {
      return "type";
    }
    const fd = mapOfferToFormData(offer);
    const initialSteps = getStepsForOfferType(fd.offerWizardType);
    const idx = Math.min(initialStepNumber, initialSteps.length) - 1;
    return initialSteps[idx]?.key ?? "type";
  });
  
  // Шаги, явно завершённые пользователем через «Далее» (не выводятся из валидности данных)
  const [completedSteps, setCompletedSteps] = useState<OfferWizardStepKey[]>(() => {
    if (mode === "edit" && offer) {
      // Опубликованное/отправленное предложение: данные уже подтверждены пользователем
      if (offer.status !== "DRAFT") {
        return ALL_OFFER_WIZARD_STEP_KEYS;
      }
      return normalizeWizardCompletedSteps(offer.wizardCompletedSteps);
    }
    return [];
  });

  const markStepCompleted = useCallback((stepKey: OfferWizardStepKey) => {
    setCompletedSteps((prev) => (prev.includes(stepKey) ? prev : [...prev, stepKey]));
  }, []);

  // Инвалидация: completed-шаг, чьи данные стали невалидными, теряет отметку
  // навсегда — обратно только через «Далее» на этом шаге.
  useEffect(() => {
    setCompletedSteps((prev) => {
      const next = prev.filter((key) => isStepComplete(key, formData));
      return next.length === prev.length ? prev : next;
    });
  }, [formData]);

  // Смена типа предложения после прохождения шагов: набор шагов меняется,
  // старые отметки недостоверны — сбрасываем полностью.
  const prevWizardTypeRef = useRef(formData.offerWizardType);
  useEffect(() => {
    if (prevWizardTypeRef.current !== formData.offerWizardType) {
      if (prevWizardTypeRef.current !== null) {
        setCompletedSteps([]);
      }
      prevWizardTypeRef.current = formData.offerWizardType;
    }
  }, [formData.offerWizardType]);

  // Normalize current step if offer type changes
  useEffect(() => {
    const currentStepNum = getStepNumber(formData.offerWizardType, currentStepKey);
    if (currentStepNum === null) {
      setCurrentStepKey("type");
    }
  }, [formData.offerWizardType, currentStepKey]);
  
  // Дочистка черновика старого формата (до useWizardDraft): не восстанавливаем,
  // формат и ключ несовместимы
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!defaultPlaceId) return;
    setFormData((prev) => {
      if (prev.placeId) return prev;
      return { ...prev, placeId: defaultPlaceId };
    });
  }, [defaultPlaceId]);
  
  const [offerId, setOfferId] = useState<string | null>(
    mode === "edit" && offer ? offer.id : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { wizardSessionId } = useWizardSession({
    userId,
    wizardType: "offer",
    entityId: mode === "edit" ? offer?.id : undefined,
  });

  // ── Черновик (localStorage) + dirty-база для guard'а ───────────────────────
  /** Состояние формы, совпадающее с сервером (edit) или дефолтами (create) */
  const [baselineFormJson, setBaselineFormJson] = useState(() =>
    JSON.stringify(
      mode === "edit" && offer
        ? mapOfferToFormData(offer)
        : getDefaultFormData(defaultPlaceId ?? null),
    ),
  );
  const formJson = useMemo(() => JSON.stringify(formData), [formData]);
  const isDirty = formJson !== baselineFormJson;

  /** updatedAt оффера, которому соответствует baseline (обновляется после PATCH) */
  const [entityUpdatedAtIso, setEntityUpdatedAtIso] = useState<string | null>(() =>
    mode === "edit" && offer ? new Date(offer.updatedAt).toISOString() : null,
  );

  const draftData = useMemo<OfferWizardDraftData>(
    () => ({ formData, completedSteps, currentStep: currentStepKey }),
    [formData, completedSteps, currentStepKey],
  );

  const draft = useWizardDraft<OfferWizardDraftData>({
    wizardType: "offer",
    mode,
    entityId: mode === "edit" ? offer?.id ?? null : null,
    schemaVersion: OFFER_WIZARD_DRAFT_SCHEMA_VERSION,
    data: draftData,
    enabled: mode === "create" ? hasMeaningfulContent(formData) : isDirty,
    entityUpdatedAt: entityUpdatedAtIso,
  });

  const { leaveDialogOpen, confirmLeave, onLeaveDialogOpenChange, requestLeave } =
    useUnsavedChangesNavigationGuard(
      mode === "edit" && isDirty && !isSaving && !isSubmitting,
    );

  /** Черновик сделан против другой версии оффера (правили в другом месте) */
  const draftConflictsWithEntity =
    mode === "edit" &&
    draft.hasDraft &&
    entityUpdatedAtIso != null &&
    draft.draftEntityUpdatedAt != null &&
    draft.draftEntityUpdatedAt.toISOString() !== entityUpdatedAtIso;

  const handleRestoreDraft = () => {
    const restored = draft.restoreDraft();
    if (!restored) return;
    const defaults = getDefaultFormData(defaultPlaceId ?? null);
    const nextFormData = { ...defaults, ...restored.formData };
    if (!nextFormData.placeId && defaultPlaceId) {
      nextFormData.placeId = defaultPlaceId;
    }
    setFormData(nextFormData);
    setCompletedSteps(normalizeWizardCompletedSteps(restored.completedSteps));
    const nextSteps = getStepsForOfferType(nextFormData.offerWizardType);
    setCurrentStepKey(
      nextSteps.some((s) => s.key === restored.currentStep)
        ? restored.currentStep
        : "type",
    );
  };

  useEffect(() => {
    if (formData.offerWizardType !== "CAMP") return;
    if (!campImpliesLodging(formData.campProgramType)) return;
    if (formData.accommodationProvided) return;
    setFormData((prev) => ({ ...prev, accommodationProvided: true }));
  }, [
    formData.offerWizardType,
    formData.campProgramType,
    formData.accommodationProvided,
  ]);

  // Auto-determine intent and CTA
  useEffect(() => {
    if (formData.offerKind) {
      const intent =
        formData.offerKind === "course"
          ? formData.durationType === "recurring"
            ? "занятия"
            : "куда_пойти"
          : "день_рождения";

      if (intent && intent !== formData.intent) {
        setFormData(prev => ({ ...prev, intent }));
      }

      const suggestedCTA =
        formData.offerKind === "course" ? "записаться" : "отправить_заявку";

      if (suggestedCTA && !formData.ctaType) {
        setFormData(prev => ({ ...prev, ctaType: suggestedCTA }));
      }
    }
  }, [formData.ctaType, formData.durationType, formData.intent, formData.offerKind]);

  const handleChange = useCallback(
    (
      updates:
        | Partial<OfferFormData>
        | ((prev: OfferFormData) => Partial<OfferFormData>),
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

  // Navigation by step key
  const handleNext = () => {
    // Шаг помечается completed только здесь — после успешной валидации по «Далее»
    if (!isStepComplete(currentStepKey, formData)) {
      const missing = getMissingFieldsForStep(currentStepKey, formData);
      toast.error(
        missing.length > 0
          ? `Заполните: ${missing.join(", ")}`
          : "Заполните обязательные поля шага",
      );
      return;
    }
    markStepCompleted(currentStepKey);
    const nextKey = getNextStepKey(formData.offerWizardType, currentStepKey);
    if (nextKey) {
      setCurrentStepKey(nextKey);
    }
  };

  const handlePrev = () => {
    const prevKey = getPreviousStepKey(formData.offerWizardType, currentStepKey);
    if (prevKey) {
      setCurrentStepKey(prevKey);
    } else {
      // Уход из мастера: в edit-режиме с несохранёнными правками — через guard
      requestLeave(afterSubmitDestination);
    }
  };

  const handleGoToStep = (step: number) => {
    const stepDef = steps[step - 1];
    if (stepDef) {
      setCurrentStepKey(stepDef.key);
    }
  };

  // Save as draft
  const handleSaveDraft = async () => {
    if (isSaving || isSubmitting) return;
    setIsSaving(true);
    
    try {
      const canDirectPublish = canPublishContentDirectly(userRole);
      const placeId = formData.placeId ?? undefined;

      if (mode === "create" && !placeId) {
        toast.error("Не выбрано место для предложения");
        return;
      }

      if (offerId) {
        const payload = buildOfferUpdatePayload(formData, {
          ...(mode === "edit" && canDirectPublish ? { status: "PUBLISHED" as const } : {}),
          wizardCompletedSteps: completedSteps,
        });
        const response = await fetch(`/api/business/offers/${offerId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        // Сервер сохранил правки: локальный черновик не нужен, dirty-база — текущее состояние
        const saved = await parseOfferMutationResponse<{ updatedAt?: string }>(response, {
          fallbackMessage: "Failed to update draft",
          operation: "update draft",
          payload,
        });
        if (saved?.updatedAt) {
          setEntityUpdatedAtIso(new Date(saved.updatedAt).toISOString());
        }
        setBaselineFormJson(JSON.stringify(formData));
        draft.markClean();
      } else {
        if (!placeId) {
          toast.error("Не выбрано место для предложения");
          return;
        }
        const createPayload = buildOfferCreatePayload(formData, {
          status: "DRAFT",
          wizardCompletedSteps: completedSteps,
          createRequestId: draft.createRequestId,
        });
        const response = await fetch("/api/business/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });

        const data = await parseOfferMutationResponse<{
          id: string;
          slug?: string | null;
          place?: { city?: { slug?: string | null } | null } | null;
        }>(response, {
          fallbackMessage: "Failed to create draft",
          operation: "create draft",
          payload: createPayload,
        });
        setOfferId(data.id);
        draft.markClean();

        if (onComplete) {
          onComplete(data.id);
        } else {
          router.replace(editorOfferEditHref(data.id));
        }
        showSuccessModal({
          kind: "offer",
          outcome: "draft_saved",
          id: data.id,
          isEdit: false,
        });
        return;
      }

      showSuccessModal({
        kind: "offer",
        outcome:
          canDirectPublish && mode === "edit" && isPublishedEditMode
            ? "changes_published"
            : "draft_saved",
        id: offerId!,
        isEdit: true,
        slug: offer?.slug ?? null,
        citySlug: offer?.place?.city?.slug ?? null,
        offerKind: formData.offerKind,
        offerDurationType: formData.durationType,
        offerCampProgramType: formData.campProgramType,
      });
    } catch (error: unknown) {
      console.error("Save draft error:", error);
      const description =
        error instanceof OfferMutationError ? error.description : undefined;
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения", description
        ? { description }
        : undefined);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit for moderation
  const handleSubmit = async () => {
    if (isSubmitting) return;
    const validation = validateForSubmit(formData);
    
    if (!validation.isComplete) {
      toast.error(validation.errors[0] || "Заполните все обязательные поля");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const placeId = formData.placeId ?? undefined;

      if (mode === "create" && !placeId) {
        toast.error("Выберите своё место на шаге «Контакты» перед публикацией");
        return;
      }

      if (!offerId) {
        if (!placeId) {
          toast.error("Выберите своё место на шаге «Контакты» перед публикацией");
          return;
        }
        const finalStatus = canPublishContentDirectly(userRole) ? "PUBLISHED" : "PENDING";
        const createPayload = buildOfferCreatePayload(formData, {
          status: finalStatus,
          wizardCompletedSteps: completedSteps,
          createRequestId: draft.createRequestId,
        });
        const createResponse = await fetch("/api/business/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });

        const createData = await parseOfferMutationResponse<{
          id: string;
          slug?: string | null;
          place?: { city?: { slug?: string | null } | null } | null;
        }>(createResponse, {
          fallbackMessage: "Failed to create offer",
          operation: "create offer",
          payload: createPayload,
        });
        setOfferId(createData.id);

        draft.markClean();
        showSuccessModal({
          kind: "offer",
          outcome: finalStatus === "PUBLISHED" ? "published" : "submitted",
          id: createData.id,
          isEdit: false,
          slug: createData.slug ?? null,
          citySlug: createData.place?.city?.slug ?? null,
          offerKind: formData.productType === "ONE_TIME_ACTIVITY" ? "EVENT" : formData.offerKind,
          offerDurationType: formData.durationType,
          offerCampProgramType: formData.campProgramType,
        });
        return;
      }

      const canDirectPublish = canPublishContentDirectly(userRole);
      const updatePayload = buildOfferUpdatePayload(formData, {
        status: canDirectPublish ? "PUBLISHED" : "PENDING",
        wizardCompletedSteps: completedSteps,
      });
      const response = await fetch(`/api/business/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      await parseOfferMutationResponse(response, {
        fallbackMessage: "Failed to submit offer",
        operation: "submit offer",
        payload: updatePayload,
      });

      setBaselineFormJson(JSON.stringify(formData));
      draft.markClean();
      showSuccessModal({
        kind: "offer",
        outcome: canDirectPublish
          ? isPublishedEditMode
            ? "changes_published"
            : "published"
          : "submitted",
        id: offerId,
        isEdit: mode === "edit",
        slug: offer?.slug ?? null,
        citySlug: offer?.place?.city?.slug ?? null,
        offerKind: formData.offerKind,
        offerDurationType: formData.durationType,
        offerCampProgramType: formData.campProgramType,
      });
    } catch (error: unknown) {
      console.error("Submit error:", error);
      const description =
        error instanceof OfferMutationError ? error.description : undefined;
      toast.error(error instanceof Error ? error.message : "Ошибка отправки", description
        ? { description }
        : undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditable = true;

  // Render current step
  const renderStep = () => {
    if (currentStepKey === "review") {
      return (
        <Step8Review
          data={formData}
          isSubmitting={isSubmitting}
          onGoToStep={handleGoToStep}
          validation={submitValidation}
        />
      );
    }
    
    const commonProps = {
      data: formData,
      onChange: handleChange,
      isEditable,
      ctaStepEnabled,
    };
    
    switch (currentStepKey) {
      case "type":
        return <Step1Type {...commonProps} />;
      case "placements":
        return <Step2Placements {...commonProps} />;
      case "details":
        return <Step2Information {...commonProps} />;
      case "photo":
        return <Step3Media {...commonProps} wizardSessionId={wizardSessionId} />;
      case "conditions":
        return <Step4Conditions {...commonProps} />;
      case "campSchedule":
        return <Step4CampSchedule {...commonProps} />;
      case "accommodation":
        return <Step5Accommodation {...commonProps} />;
      case "price":
        return <Step5Pricing {...commonProps} />;
      case "contacts":
        return <Step6Contacts {...commonProps} />;
      case "faq":
        return (
          <FaqStep
            kind="offer"
            value={formData.faqItems}
            onChange={(faqItems) => handleChange({ faqItems })}
          />
        );
      default:
        return null;
    }
  };

  const currentStepNum = getStepNumber(formData.offerWizardType, currentStepKey) || 1;
  const canNext = currentStepKey !== "review" && currentStepNum < totalSteps;
  const canPrev = true;
  const isReviewStep = currentStepKey === "review";
  const isChoosingOfferType = currentStepKey === "type" && !formData.productType;

  const submitValidation: ValidationResult = isReviewStep
    ? validateForSubmit(formData)
    : { isValid: true, isComplete: true, errors: [], warnings: [] };

  // Эффективный статус: шаг пройден через «Далее» И его данные всё ещё валидны.
  // «Проверка» — только когда эффективно завершены все предыдущие шаги.
  const progressSteps = useMemo(() => {
    const isEffectivelyCompleted = (key: OfferWizardStepKey): boolean => {
      if (!completedSteps.includes(key) || !isStepComplete(key, formData)) {
        return false;
      }
      if (key === "review") {
        return steps.every(
          (s) => s.key === "review" || isEffectivelyCompleted(s.key),
        );
      }
      return true;
    };

    const effective = steps.map((s) => isEffectivelyCompleted(s.key));
    const firstIncompleteIdx = effective.findIndex((done) => !done);

    return steps.map((s, idx) => ({
      id: idx + 1,
      label: s.shortLabel,
      isComplete: effective[idx],
      // Кликабельны: completed-шаги, текущий и первый незавершённый
      isDisabled:
        !isPublishedEditMode &&
        !effective[idx] && idx + 1 !== currentStepNum && idx !== firstIncompleteIdx,
    }));
  }, [completedSteps, currentStepNum, formData, isPublishedEditMode, steps]);

  const phase = formWizardPhaseFromFlags({ isSaving, isSubmitting });
  const actionLabels = useMemo(() => {
    const base = getBusinessFormActionLabels(userRole);
    if (mode === "edit") {
      return {
        ...base,
        saveDraft: "Сохранить изменения",
        savingDraft: "Сохранение...",
      };
    }
    return base;
  }, [userRole, mode]);
  const showSaveDraftInBar = mode === "edit" || isReviewStep;

  const currentStepDef = steps.find(s => s.key === currentStepKey);
  const stepTitle = currentStepDef?.title || "Шаг";
  const subtitle = isChoosingOfferType
    ? "Выберите формат, с которого начнём"
    : businessFormCopy.stepSubtitle(
        currentStepNum,
        totalSteps,
        isReviewStep ? businessFormCopy.reviewStepShortTitle : stepTitle,
      );

  const displayTitle = resolveDraftTitle(
    formData.title,
    businessFormCopy.offer.createTitle,
  );

  return (
    <FormWizardShell>
      <FormWizardHeader
        title={displayTitle}
        subtitle={subtitle}
        trailing={
          <SaveIndicator
            status={draft.status}
            lastSavedAt={draft.lastSavedAt}
            onRetry={draft.retry}
          />
        }
      >
        {!isChoosingOfferType ? (
          <WizardProgress
            steps={progressSteps}
            currentStep={currentStepNum}
            onStepChange={handleGoToStep}
          />
        ) : null}
      </FormWizardHeader>

      {draft.hasDraft && (
        <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              {draftConflictsWithEntity ? (
                <>
                  Предложение было изменено после сохранения черновика
                  {draft.draftSavedAt
                    ? ` (черновик — ${formatRelativeTimeRu(draft.draftSavedAt)})`
                    : ""}
                  . Какую версию использовать?
                </>
              ) : (
                <>
                  У вас есть незавершённый черновик
                  {draft.draftSavedAt
                    ? ` (${formatRelativeTimeRu(draft.draftSavedAt)})`
                    : ""}
                  . Продолжить с него?
                </>
              )}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => draft.discardDraft()}
              >
                {draftConflictsWithEntity
                  ? "Взять актуальную версию"
                  : "Начать заново"}
              </Button>
              <Button size="sm" onClick={handleRestoreDraft}>
                {draftConflictsWithEntity ? "Применить черновик" : "Продолжить"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
        onSubmit={isReviewStep ? handleSubmit : undefined}
        submitDisabled={
          isSubmitting || isSaving || !submitValidation.isComplete
        }
      />

      <AlertDialog open={leaveDialogOpen} onOpenChange={onLeaveDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Уйти со страницы?</AlertDialogTitle>
            <AlertDialogDescription>
              Изменения не сохранены на сервере. Черновик остаётся на этом
              устройстве — вы сможете продолжить позже.
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
