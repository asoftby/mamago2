import type { ActivityMock } from "@/mocks/activity.types";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { formatPriceFrom } from "@/lib/formatters/format-price";
import { EVENT_PAGE_OVERRIDES } from "@/mocks/eventPageOverrides";
import type { EventPageData } from "./eventPageTypes";
import { mapActivityToDiscoveryIntent } from "./mapActivityToDiscoveryIntent";
import {
  getActivityFormatDetailLabel,
  getActivityFormatLabel,
} from "@/domain/activities/activity-format";
import { ageFromPlusLabelFromBounds } from "@/lib/event/activityAgeBounds";

function priceLabelFromMock(a: ActivityMock): string {
  if (a.priceMin === 0) return "Бесплатно";
  if (a.priceMin != null)
    return formatPriceFrom(a.priceMin);
  return "Уточняйте цену";
}

function defaultSessions(a: ActivityMock): EventPageData["sessions"] {
  if (!a.dateStart) return [];
  return [{ id: "default", startsAt: a.dateStart }];
}

function defaultFactChips(a: ActivityMock): EventPageData["factChips"] {
  const chips: EventPageData["factChips"] = [];
  if (a.format && a.format !== "OFFLINE") {
    chips.push({ id: "format", label: getActivityFormatLabel(a.format) });
  }
  if (a.tags.includes("outdoor")) chips.push({ id: "out", label: "На улице" });
  else chips.push({ id: "in", label: "В помещении" });
  return chips.slice(0, 5);
}

function defaultImportantFacts(a: ActivityMock): EventPageData["importantFacts"] {
  const rows: EventPageData["importantFacts"] = [];
  if (a.ageFrom != null && a.ageTo != null) {
    rows.push({
      id: "age",
      label: "Возраст",
      value: `${a.ageFrom}–${a.ageTo} лет`,
    });
  }
  rows.push({
    id: "fmt",
    label: "Формат",
    value: a.format ? getActivityFormatDetailLabel(a.format) : a.badge ?? "Семейный досуг",
  });
  if (a.dateStart) {
    rows.push({
      id: "period",
      label: "Когда",
      value: "См. расписание ниже",
    });
  } else if (a.workingHours) {
    rows.push({
      id: "hours",
      label: "Время",
      value: a.workingHours,
    });
  }
  if (a.district) {
    rows.push({
      id: "area",
      label: "Район",
      value: a.district,
    });
  }
  return rows;
}

function defaultWhyGo(a: ActivityMock): string[] {
  return [
    a.description.slice(0, 120) + (a.description.length > 120 ? "…" : ""),
    "Формат подходит для семейного досуга: можно обсудить впечатления после.",
    "Проверьте возраст и длительность — чтобы день было комфортно.",
  ];
}

function defaultGoodFit(a: ActivityMock): string[] {
  return [
    `Если вы ищете активность для возраста ${a.ageFrom}–${a.ageTo} лет.`,
    "Если хотите спокойный сценарий без лишней суеты.",
    "Если вам важны понятные правила и предсказуемый формат.",
  ];
}

function defaultAbout(a: ActivityMock): EventPageData["about"] {
  return {
    summary:
      a.description ||
      "Программа для семей: можно спланировать визит и обсудить детали заранее.",
    full:
      a.description.length > 200
        ? `${a.description}\n\nДополнительные детали уточняйте у организатора.`
        : undefined,
  };
}

export function attachSimilarEvents(
  data: EventPageData,
  all: ActivityMock[],
  citySlug: string,
  limit = 4
): EventPageData {
  const similar = all
    .filter((a) => a.id !== data.id)
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      title: a.title,
      imageUrl: a.image,
      dateLabel: a.dateStart ? formatRuShortDayMonth(a.dateStart) : undefined,
      priceLabel: priceLabelFromMock(a),
      href: publicActivityPath(a.id, citySlug, null),
    }));
  return { ...data, similar };
}

export function buildEventPageData(
  activity: ActivityMock,
  citySlug: string
): EventPageData {
  const o = EVENT_PAGE_OVERRIDES[activity.id];

  const sessions = o?.sessions?.length
    ? o.sessions
    : defaultSessions(activity);

  const media: EventPageData["media"] = {
    posterUrl: activity.image,
    posterAlt: activity.title,
    ...o?.media,
  };

  const venue =
    o?.venue ??
    (activity.address || activity.district
      ? {
          name: activity.title,
          address: activity.address,
          district: activity.district,
          mapUrl: activity.address
            ? `https://maps.google.com/?q=${encodeURIComponent(activity.address)}`
            : undefined,
        }
      : undefined);

  const data: EventPageData = {
    id: activity.id,
    slug: null,
    citySlug,
    discoveryIntent: mapActivityToDiscoveryIntent(activity),
    ageFromBadge: o?.ageFromBadge ?? ageFromPlusLabelFromBounds(activity.ageFrom),
    categoryLabel: activity.badge,
    title: activity.title,
    subtitle:
      activity.description.length > 180
        ? `${activity.description.slice(0, 177)}…`
        : activity.description,
    factChips: o?.factChips ?? defaultFactChips(activity),
    importantFacts: o?.importantFacts ?? defaultImportantFacts(activity),
    media,
    sessions,
    venue,
    whyGo: o?.whyGo ?? defaultWhyGo(activity),
    goodFit: o?.goodFit ?? defaultGoodFit(activity),
    about: o?.about ?? defaultAbout(activity),
    planDayLinks: o?.planDayLinks,
    organizerNote: o?.organizerNote,
    similar: [],
    breadcrumbs: [
      { label: "Главная", href: `/${citySlug}` },
      { label: "События", href: `/${citySlug}/kuda` },
      { label: activity.title, href: "#" },
    ],
    priceLabel: priceLabelFromMock(activity),
    priceDetails: activity.priceDetails,
    bookingNotes: o?.bookingNotes,
    cta: o?.cta ?? {
      planLabel: "В план",
      buyLabel: "Купить билет",
      saveLabel: "В идеи",
    },
  };

  return data;
}
