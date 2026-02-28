export type ActivityType = 
  | 'EVENT_FIXED'      // Событие с фиксированной датой/временем (Спектакль)
  | 'PLACE_FLEX'       // Место с часами работы (Зоопарк, Кафе)
  | 'CLASS_SCHEDULE'   // Расписание занятий (Мастер-класс)
  | 'BIRTHDAY_BOOKING' // Оффер для ДР (Пакет праздника)
  | 'ARTICLE';         // Статья (Топ-10 мест)

export interface ActivityMock {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  image: string; // URL placeholder
  
  // Мета
  ageFrom: number; // 0
  ageTo: number;   // 16
  priceMin?: number;
  priceMax?: number;
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
  rating: number;
  reviewsCount: number;
}
