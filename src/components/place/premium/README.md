# Premium Place Landing Page Components

Набор компонентов для создания premium landing page для мест в стиле Airbnb/Apple.

## Структура компонентов

### 1. **PremiumPlacePage** (главный компонент)
Объединяет все компоненты в единую страницу.

**Props:**
- `place` - основные данные о месте
- `events` - массив событий
- `offers` - массив предложений
- `reviews` - массив отзывов
- `canEdit` - флаг прав на редактирование

### 2. **PlaceHero**
Hero-секция с логотипом, названием, категорией и рейтингом.

**Особенности:**
- Кнопка "Назад к списку мест"
- Dropdown меню редактирования (для владельцев)
- Адаптивный дизайн

### 3. **PlaceGallery**
Airbnb-style галерея изображений.

**Особенности:**
- Большое фото слева + 4 маленьких справа
- Fullscreen модальное окно с навигацией
- Hover эффекты
- Кнопка "Показать все фото"

### 4. **PlaceQuickFacts**
Горизонтальная полоса с ключевыми фактами.

**Отображаемые данные:**
- Год основания
- Языки
- Вместимость
- Адрес
- Часы работы
- Телефон

### 5. **PlaceSidebarCard**
Sticky sidebar с контактами и CTA.

**Особенности:**
- Кнопки контактов (телефон, email, сайт, карта)
- Главная CTA кнопка "Отправить запрос"
- Кнопки "Поделиться" и "Сохранить"
- Trust indicators

### 6. **PlaceContent**
Основной контент с описанием и особенностями.

**Секции:**
- О месте (описание)
- Что мы предлагаем (features)
- Удобства (amenities)

### 7. **PlaceEventsCarousel**
Горизонтальная карусель событий.

**Особенности:**
- Smooth scroll
- Кнопки навигации
- Карточки событий с изображениями
- Кнопка "Посмотреть все события"

### 8. **PlaceOffersCarousel**
Горизонтальная карусель предложений.

**Особенности:**
- Smooth scroll
- Кнопки навигации
- Бейджи скидок
- Карточки предложений с ценами

### 9. **PlaceReviews**
Секция отзывов с рейтингами.

**Особенности:**
- Общий рейтинг
- Breakdown по звездам
- Список отзывов с аватарами
- Кнопка "Показать все отзывы"

### 10. **PlaceMapSection**
Секция с картой и адресом.

**Особенности:**
- Google Maps embed
- Кнопки "Открыть на карте" и "Построить маршрут"
- Fallback для мест без координат

## Использование

```tsx
import { PremiumPlacePage } from "@/components/place/premium";

export default function PlacePage() {
  return (
    <PremiumPlacePage
      place={{
        id: "place-id",
        title: "Название места",
        slug: "place-slug",
        category: "Категория",
        shortDesc: "Краткое описание",
        description: "Полное описание",
        logoUrl: "/logo.jpg",
        rating: 4.8,
        reviewCount: 42,
        phone: "+375291234567",
        email: "info@place.com",
        website: "https://place.com",
        address: "ул. Примерная, 1",
        city: "Минск",
        latitude: 53.9,
        longitude: 27.5,
        images: [
          { id: "1", url: "/photo1.jpg", alt: "Photo 1" },
          { id: "2", url: "/photo2.jpg", alt: "Photo 2" },
        ],
        features: ["Особенность 1", "Особенность 2"],
        amenities: ["Wi-Fi", "Парковка"],
      }}
      events={[...]}
      offers={[...]}
      reviews={[...]}
      canEdit={false}
    />
  );
}
```

## Дизайн

### Цветовая схема
- Фон: белый (#FFFFFF)
- Текст: серый (#1F1F1F, #6B6B6B)
- Акцент: оранжевый (#EF8759)
- Границы: светло-серый (#ECEAE6)

### Типографика
- Заголовки: font-bold, tracking-tight
- Текст: font-medium, leading-relaxed
- Размеры: от text-sm до text-4xl

### Spacing
- Секции: py-8 или py-12
- Карточки: p-4 или p-6
- Gaps: gap-2, gap-4, gap-6

### Адаптивность
- Mobile-first подход
- Breakpoints: sm, md, lg
- Grid layouts с адаптивными колонками

## TODO

- [ ] Добавить поле `category` в модель Place
- [ ] Реализовать систему отзывов
- [ ] Добавить расчет среднего рейтинга
- [ ] Реализовать функционал "Сохранить в избранное"
- [ ] Добавить проверку прав на редактирование
- [ ] Настроить Google Maps API key
- [ ] Добавить поля `features` и `amenities` в модель Place
- [ ] Реализовать страницу контактной формы
- [ ] Добавить SEO оптимизацию для новых компонентов
- [ ] Добавить анимации появления элементов

## Зависимости

- `@/components/ui/button`
- `@/components/ui/card`
- `@/components/ui/dialog`
- `@/components/ui/dropdown-menu`
- `lucide-react`
- `next/image`
- `next/link`

## Переменные окружения

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```
