import { z } from "zod";
import type { SharedContactsData } from "@/domain/contacts/structuredContacts";
import type { SharedPriceData } from "@/domain/pricing/structuredPrice";
import type { SharedOpeningHoursData } from "@/domain/opening-hours/structuredOpeningHours";

export function contactsDraftFieldErrors(value: SharedContactsData) {
  return {
    phones: value.phones.map((phone) =>
      !phone.value.trim() && Boolean(phone.label?.trim()) ? "Укажите номер телефона" : null,
    ),
    socials: value.socials.map((social) =>
      social.url.trim() && !z.url().safeParse(social.url.trim()).success
        ? "Введите полную ссылку, например https://instagram.com/..."
        : null,
    ),
    email:
      value.email?.trim() && !z.email().safeParse(value.email.trim()).success
        ? "Введите корректный email"
        : undefined,
    website:
      value.website?.trim() && !z.url().safeParse(value.website.trim()).success
        ? "Введите корректный адрес сайта"
        : undefined,
  };
}

export function priceForMode(value: SharedPriceData, mode: SharedPriceData["mode"]): SharedPriceData {
  const base = { ...value, mode };
  if (mode === "FREE") return { ...base, min: 0, max: 0 };
  if (mode === "EXACT") return { ...base, min: value.min ?? 0, max: value.min ?? 0 };
  if (mode === "FROM") return { ...base, min: value.min ?? 0, max: null };
  if (mode === "RANGE") return { ...base, min: value.min ?? 0, max: value.max ?? value.min ?? 0 };
  return { ...base, min: null, max: null };
}

export function updateExceptionInterval(
  data: SharedOpeningHoursData,
  exceptionIndex: number,
  intervalIndex: number,
  patch: Partial<{ startTime: string; endTime: string }>,
): SharedOpeningHoursData {
  return {
    ...data,
    exceptions: data.exceptions.map((item, i) =>
      i === exceptionIndex
        ? {
            ...item,
            intervals: item.intervals.map((interval, j) =>
              j === intervalIndex ? { ...interval, ...patch } : interval,
            ),
          }
        : item,
    ),
  };
}

export function addExceptionInterval(
  data: SharedOpeningHoursData,
  exceptionIndex: number,
): SharedOpeningHoursData {
  return {
    ...data,
    exceptions: data.exceptions.map((item, i) =>
      i === exceptionIndex
        ? { ...item, intervals: [...item.intervals, { startTime: "09:00", endTime: "18:00" }] }
        : item,
    ),
  };
}

export function removeExceptionInterval(
  data: SharedOpeningHoursData,
  exceptionIndex: number,
  intervalIndex: number,
): SharedOpeningHoursData {
  return {
    ...data,
    exceptions: data.exceptions.map((item, i) =>
      i === exceptionIndex
        ? { ...item, intervals: item.intervals.filter((_, j) => j !== intervalIndex) }
        : item,
    ),
  };
}
