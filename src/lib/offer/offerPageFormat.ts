/**
 * Offer Page Formatting Utilities
 * Утилиты для форматирования данных страницы предложения
 */

import {
  formatPrice as formatBelarusPrice,
  formatPriceFrom as formatBelarusPriceFrom,
  formatPriceRange as formatBelarusPriceRange,
} from "@/lib/formatters/format-price";
import type { OfferType, OfferCtaType } from "./offerPageTypes";

/**
 * Форматирует тип предложения для отображения
 */
export function formatOfferType(type: OfferType): string {
  const labels: Record<OfferType, string> = {
    SINGLE: "Мероприятие",
    REGULAR: "Занятия",
    CAMP: "Лагерь",
  };
  return labels[type];
}

/**
 * Форматирует CTA label в зависимости от типа
 */
export function formatCtaLabel(type: OfferCtaType): string {
  const labels: Record<OfferCtaType, string> = {
    записаться: "Записаться",
    забронировать: "Забронировать",
    купить_билет: "Купить билет",
    отправить_заявку: "Оставить заявку",
    перейти_на_сайт: "Перейти на сайт",
  };
  return labels[type];
}

/**
 * Форматирует возрастной диапазон
 */
export function formatAgeRange(minMonths: number | null, maxMonths: number | null): string {
  if (!minMonths && !maxMonths) return "Любой возраст";
  
  const minYears = minMonths ? Math.floor(minMonths / 12) : 0;
  const maxYears = maxMonths ? Math.floor(maxMonths / 12) : 0;
  
  if (minYears === 0 && maxYears === 0) return "До 1 года";
  if (minYears === maxYears) return `${minYears} ${pluralizeYears(minYears)}`;
  if (!maxMonths) return `От ${minYears} ${pluralizeYears(minYears)}`;
  if (!minMonths) return `До ${maxYears} ${pluralizeYears(maxYears)}`;
  
  return `${minYears}-${maxYears} ${pluralizeYears(maxYears)}`;
}

/**
 * Плюрализация слова "лет"
 */
function pluralizeYears(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return "год";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "года";
  return "лет";
}

/**
 * Форматирует цену
 */
export function formatPrice(price: number, currency: string = "BYN"): string {
  void currency;
  return formatBelarusPrice(price, { hideZero: true });
}

/**
 * Форматирует диапазон цен
 */
export function formatPriceRange(from: number, to: number, currency: string = "BYN"): string {
  void currency;
  return formatBelarusPriceRange(from, to);
}

/**
 * Форматирует "от X"
 */
export function formatPriceFrom(price: number, currency: string = "BYN"): string {
  void currency;
  return formatBelarusPriceFrom(price);
}

/**
 * Форматирует длительность в минутах
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) return `${hours} ${pluralizeHours(hours)}`;
  return `${hours} ${pluralizeHours(hours)} ${mins} мин`;
}

/**
 * Плюрализация слова "час"
 */
function pluralizeHours(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return "час";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "часа";
  return "часов";
}

/**
 * Форматирует дату для отображения
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Форматирует короткую дату (без года)
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

/**
 * Форматирует время
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Форматирует диапазон дат
 */
export function formatDateRange(from: Date | string, to: Date | string): string {
  const fromDate = typeof from === "string" ? new Date(from) : from;
  const toDate = typeof to === "string" ? new Date(to) : to;
  
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  const sameMonth = sameYear && fromDate.getMonth() === toDate.getMonth();
  
  if (sameMonth) {
    return `${fromDate.getDate()}-${toDate.getDate()} ${fromDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}`;
  }
  
  if (sameYear) {
    return `${formatShortDate(fromDate)} - ${formatShortDate(toDate)} ${fromDate.getFullYear()}`;
  }
  
  return `${formatDate(fromDate)} - ${formatDate(toDate)}`;
}

/**
 * Форматирует количество мест
 */
export function formatSpotsLeft(left: number, total: number): string {
  if (left === 0) return "Мест нет";
  if (left === total) return `${total} ${pluralizeSpots(total)}`;
  return `${left} из ${total} ${pluralizeSpots(total)}`;
}

/**
 * Плюрализация слова "место"
 */
function pluralizeSpots(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return "место";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "места";
  return "мест";
}

/**
 * Форматирует рейтинг
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Форматирует количество отзывов
 */
export function formatReviewsCount(count: number): string {
  if (count === 0) return "Нет отзывов";
  return `${count} ${pluralizeReviews(count)}`;
}

/**
 * Плюрализация слова "отзыв"
 */
function pluralizeReviews(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return "отзыв";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "отзыва";
  return "отзывов";
}

/**
 * Генерирует breadcrumbs для страницы
 */
export function generateOfferBreadcrumbs(citySlug: string, title: string) {
  return [
    { label: citySlug, href: `/${citySlug}` },
    { label: "Предложения", href: `/${citySlug}/offers` },
    { label: title, href: "#" },
  ];
}

/**
 * Извлекает video ID из YouTube URL
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  
  return null;
}

/**
 * Извлекает video ID из Vimeo URL
 */
export function extractVimeoId(url: string): string | null {
  const pattern = /vimeo\.com\/(\d+)/;
  const match = url.match(pattern);
  return match?.[1] || null;
}

/**
 * Проверяет, является ли URL видео
 */
export function isVideoUrl(url: string): boolean {
  return (
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes("vimeo.com") ||
    url.endsWith(".mp4") ||
    url.endsWith(".webm")
  );
}

/**
 * Генерирует thumbnail URL для YouTube видео
 */
export function getYouTubeThumbnail(videoId: string, quality: "default" | "hq" | "maxres" = "hq"): string {
  const qualityMap = {
    default: "default",
    hq: "hqdefault",
    maxres: "maxresdefault",
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}
