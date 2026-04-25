import type { Intent } from "@/lib/intent";
import type { ActivityFormat } from "@prisma/client";

export type ActivityType = 
  | 'EVENT_FIXED'      // Событие с фиксированной датой/временем (Спектакль)
  | 'PLACE_FLEX'       // Место с часами работы (Зоопарк, Кафе)
  | 'CLASS_SCHEDULE'   // Расписание занятий (Мастер-класс)
  | 'BIRTHDAY_BOOKING' // Оффер для ДР (Пакет праздника)
  | 'ARTICLE';         // Статья (Топ-10 мест)

export interface ActivityMock {
  id: string;
  /** Публичный slug события (SEO), если есть в БД */
  slug?: string | null;
  /** Канонический city slug публичной страницы события. */
  citySlug?: string | null;
  format?: ActivityFormat | null;
  type: ActivityType;
  /** Раздел сайта (иконка в хедере на странице публикации); иначе выводится из `type` */
  discoveryIntent?: Intent;
  title: string;
  description: string;
  image: string;
  
  // Мета
  ageFrom: number; // 0
  ageTo: number;   // 16
  priceMin?: number;
  priceMax?: number;
  /** В подписи карточки: «от X BYN» vs «X BYN» (фикс). */
  priceListUsesOt?: boolean;
  priceDetails?: string; // Optional price breakdown (e.g., "Дети — 30 BYN\nВзрослые — 50 BYN")
  currency: 'BYN';
  
  // Локация
  district?: string; // Центральный
  address?: string;  // ул. Ленина, 5
  
  // Даты (упрощенно для моков)
  dateStart?: string; // ISO
  dateEnd?: string;   // ISO
  workingHours?: string; // "10:00 - 22:00"
  
  // Теги для фильтрации
  tags: string[]; // ['today', 'weekend', 'free', 'class', 'birthday']
  
  // UI
  badge?: string;
  /** Гео-маркер для ленты хаба (напр. «За городом» при просмотре /minsk/kuda). */
  geoBadge?: string;
  /** Мягкая подсказка по возрасту (второй слой ленты). */
  ageHintBadge?: string;
  /** Сырые очки engagement с сервера (ранжирование). */
  engagementScore?: number;
  rating?: number;
  reviewsCount?: number;
}
