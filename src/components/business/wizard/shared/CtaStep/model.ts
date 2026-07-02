import {
  createCanonicalCta,
  type CanonicalCtaObject,
} from "@/lib/cta-platform";
import type {
  CtaContactFallback,
  CtaExternalTarget,
} from "@/lib/cta-platform";
import type {
  CtaStepCalendarDay,
  CtaStepDerivedState,
  CtaStepFormValue,
  CtaStepSourceContext,
} from "./types";

function createId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}`;
}

export function createEmptyCtaCalendarSlot() {
  return {
    id: createId("cta-slot"),
    startTime: "",
    endTime: "",
    capacity: null,
  };
}

export function createEmptyCtaCalendarDay(): CtaStepCalendarDay {
  return {
    id: createId("cta-day"),
    date: "",
    capacity: null,
    slots: [createEmptyCtaCalendarSlot()],
  };
}

export function createDefaultCtaStepFormValue(): CtaStepFormValue {
  return {
    actionChoice: "DISCOVER",
    requestMode: null,
    calendarMode: "DATE_ONLY",
    externalKind: "SITE",
    externalUrl: "",
    instructions: "",
    requestLabelKind: "REQUEST",
    legacyOrigin: null,
    fallback: {
      phone: "",
      website: "",
    },
    calendarDays: [createEmptyCtaCalendarDay()],
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizePhoneHref(value: string): string | null {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : null;
}

function buildFallbacks(value: CtaStepFormValue): CtaContactFallback[] | undefined {
  const items: CtaContactFallback[] = [];

  const phone = value.fallback.phone.trim();
  const phoneHref = phone ? normalizePhoneHref(phone) : null;
  if (phone && phoneHref) {
    items.push({
      channel: "PHONE",
      value: phone,
      href: phoneHref,
      label: "Позвонить",
    });
  }

  const website = value.fallback.website.trim();
  if (website && isHttpUrl(website)) {
    items.push({
      channel: "URL",
      value: website,
      href: website,
      label: "Сайт",
    });
  }

  return items.length > 0 ? items : undefined;
}

function buildExternalTarget(value: CtaStepFormValue): CtaExternalTarget | undefined {
  const url = value.externalUrl.trim();
  if (!url || !isHttpUrl(url)) return undefined;
  return {
    channel: "URL",
    value: url,
    href: url,
    openInNewTab: true,
  };
}

function hasConfiguredDates(days: CtaStepCalendarDay[]): boolean {
  return days.some((day) => day.date.trim().length > 0);
}

function hasConfiguredSlots(days: CtaStepCalendarDay[]): boolean {
  return days.some((day) =>
    day.date.trim().length > 0 &&
    day.slots.some(
      (slot) =>
        slot.startTime.trim().length > 0 &&
        slot.endTime.trim().length > 0 &&
        typeof slot.capacity === "number" &&
        slot.capacity > 0,
    ),
  );
}

export function buildCanonicalCtaFromCtaStepValue(
  context: CtaStepSourceContext,
  value: CtaStepFormValue,
): CanonicalCtaObject {
  const contactFallback = buildFallbacks(value);

  if (value.actionChoice === "REQUEST") {
    if (value.requestMode === "CALENDAR") {
      return createCanonicalCta({
        actionKind: "REQUEST",
        sourceEntityType: context.sourceEntityType,
        sourceEntityId: context.sourceEntityId,
        primaryLabel: "Забронировать",
        requestConfig: {
          runtime: "BOOKING",
          selectionMode:
            value.calendarMode === "DATE_AND_TIME" ? "SLOT" : "DATE",
        },
        instructions: value.instructions.trim() || undefined,
        contactFallback,
      });
    }

    return createCanonicalCta({
      actionKind: "REQUEST",
      sourceEntityType: context.sourceEntityType,
      sourceEntityId: context.sourceEntityId,
      primaryLabel:
        value.requestLabelKind === "BOOK" ? "Записаться" : "Оставить заявку",
      requestConfig: {
        runtime: "BOOKING",
        selectionMode: "NONE",
      },
      instructions: value.instructions.trim() || undefined,
      contactFallback,
    });
  }

  if (value.actionChoice === "EXTERNAL") {
    const externalTarget = buildExternalTarget(value);
    return createCanonicalCta({
      actionKind: "EXTERNAL",
      sourceEntityType: context.sourceEntityType,
      sourceEntityId: context.sourceEntityId,
      primaryLabel:
        value.externalKind === "TICKETS" ? "Купить билет" : "Перейти на сайт",
      externalTarget,
      instructions: value.instructions.trim() || undefined,
      contactFallback,
      availability: externalTarget ? "AVAILABLE" : "UNAVAILABLE",
      availabilityReason: externalTarget
        ? undefined
        : "Добавьте корректную ссылку на внешний сервис.",
    });
  }

  return createCanonicalCta({
    actionKind: "DISCOVER",
    sourceEntityType: context.sourceEntityType,
    sourceEntityId: context.sourceEntityId,
    primaryLabel: "Подробнее",
    instructions: value.instructions.trim() || undefined,
    contactFallback,
  });
}

export function buildCtaStepFormValueFromCanonical(
  value: CanonicalCtaObject,
): CtaStepFormValue {
  const formValue = createDefaultCtaStepFormValue();

  if (value.actionKind === "REQUEST") {
    formValue.actionChoice = "REQUEST";
    formValue.requestMode =
      value.requestConfig?.selectionMode === "NONE" ? "SIMPLE" : "CALENDAR";
    formValue.calendarMode =
      value.requestConfig?.selectionMode === "SLOT"
        ? "DATE_AND_TIME"
        : "DATE_ONLY";
    formValue.requestLabelKind = /записаться/i.test(value.primaryLabel)
      ? "BOOK"
      : "REQUEST";
  } else if (value.actionKind === "EXTERNAL") {
    formValue.actionChoice = "EXTERNAL";
    formValue.externalUrl =
      value.externalTarget?.channel === "URL" ? value.externalTarget.href : "";
    formValue.externalKind = /билет/i.test(value.primaryLabel) ? "TICKETS" : "SITE";
  } else {
    formValue.actionChoice = "DISCOVER";
  }

  for (const fallback of value.contactFallback ?? []) {
    if (fallback.channel === "PHONE" && !formValue.fallback.phone) {
      formValue.fallback.phone = fallback.value;
    }
    if (fallback.channel === "URL" && !formValue.fallback.website) {
      formValue.fallback.website = fallback.href;
    }
  }

  formValue.instructions = value.instructions ?? "";

  return formValue;
}

function buildIssues(value: CtaStepFormValue): string[] {
  const issues: string[] = [];

  if (value.actionChoice === "REQUEST") {
    if (!value.requestMode) {
      issues.push("Выберите, как проходит запись.");
    } else if (value.requestMode === "CALENDAR") {
      if (value.calendarMode === "DATE_ONLY" && !hasConfiguredDates(value.calendarDays)) {
        issues.push("Добавьте хотя бы одну доступную дату.");
      }
      if (
        value.calendarMode === "DATE_AND_TIME" &&
        !hasConfiguredSlots(value.calendarDays)
      ) {
        issues.push("Добавьте хотя бы один доступный слот.");
      }
    }
  }

  if (value.actionChoice === "EXTERNAL" && !buildExternalTarget(value)) {
    issues.push("Добавьте корректную ссылку на внешний сервис.");
  }

  return issues;
}

function buildSummary(value: CtaStepFormValue): string {
  if (value.actionChoice === "REQUEST") {
    if (value.requestMode === "CALENDAR") {
      if (value.calendarMode === "DATE_AND_TIME") {
        return "Пользователь сможет выбрать свободную дату и время, а затем отправить заявку.";
      }
      return "Пользователь сможет выбрать свободную дату и отправить заявку.";
    }

    return "Пользователь сможет оставить заявку, после чего вы получите уведомление и сможете связаться с ним.";
  }

  if (value.actionChoice === "EXTERNAL") {
    if (value.externalKind === "TICKETS") {
      return "Пользователь будет перенаправлен на внешний сайт для покупки билетов.";
    }
    return "Пользователь будет перенаправлен на внешний сайт.";
  }

  return "Пользователь сможет ознакомиться с описанием и при необходимости выбрать удобный способ связи.";
}

export function deriveCtaStepState(
  context: CtaStepSourceContext,
  value: CtaStepFormValue,
): CtaStepDerivedState {
  return {
    canonicalCta: buildCanonicalCtaFromCtaStepValue(context, value),
    userFacingSummary: buildSummary(value),
    issues: buildIssues(value),
  };
}
