# Offer Page Components

Модульная система компонентов для публичной страницы предложения (Offer Page) в едином premium-стиле с EventPage и PlacePage.

## Архитектура

```
src/
├── app/(public)/[city]/offers/[slug]/
│   └── page.tsx                    # Next.js страница
├── components/offers/
│   ├── OfferPageView.tsx          # Главный контейнер
│   ├── OfferHero.tsx              # Hero-зона с cover + title
│   ├── OfferGallery.tsx           # Фотогалерея с lightbox
│   ├── OfferTrailer.tsx           # Видео трейлер/reels
│   ├── OfferMetaGrid.tsx          # Ключевые параметры (возраст, формат и т.д.)
│   ├── OfferRichDescription.tsx   # Описание (rich HTML)
│   ├── OfferPricing.tsx           # Цены и акции
│   ├── OfferSchedule.tsx          # Расписание/смены
│   ├── OfferAccommodation.tsx     # Размещение (для лагерей)
│   ├── OfferLocation.tsx          # Карта и адрес
│   ├── OfferReviews.tsx           # Отзывы
│   ├── OfferHowToJoin.tsx         # Как записаться (4 шага)
│   ├── OfferSimilar.tsx           # Похожие предложения
│   ├── OfferStickyBar.tsx         # Sticky action bar (mobile + desktop)
│   ├── OfferActions.tsx           # CTA кнопки (sidebar)
│   └── index.ts                   # Экспорты
└── lib/offer/
    └── offerPageTypes.ts          # TypeScript типы
```

## Дизайн-система

### Layout
- **Max-width**: 1280px (premium feel)
- **Grid**: 60% content + 40% sidebar (desktop)
- **Mobile**: одна колонка + sticky bottom bar
- **Spacing**: много воздуха, минимальный визуальный шум

### Цвета
- **Brand**: `#EF8759` (primary CTA, accents)
- **Background**: `#FFF7F3` (soft accent backgrounds)
- **Border**: `border-border/60` (мягкие границы)
- **Shadows**: `shadow-sm`, `shadow-lg` (subtle elevation)

### Typography
- **Headings**: `font-headline`, `font-bold`, `tracking-tight`
- **Body**: `text-[15px]`, `leading-[1.7]` (Notion/Airbnb style)
- **Meta**: `text-[13px]`, `text-muted-foreground`

### Radius
- **Cards**: `rounded-2xl` (16px), `rounded-3xl` (24px)
- **Buttons**: `rounded-xl` (12px)
- **Images**: `rounded-2xl`, `rounded-3xl`

### Buttons
- **Primary**: `bg-[#EF8759]`, `hover:bg-[#EF8759]/90`, white text
- **Secondary**: `border-border/80`, `hover:bg-accent/50`
- **In Plan**: `border-[#EF8759]`, `bg-[#FFF7F3]`, `text-[#EF8759]`

## Компоненты

### OfferPageView
Главный контейнер страницы. Управляет состоянием (loading, plan status) и координирует все дочерние компоненты.

**Props**: `{ data: OfferPageData }`

### OfferHero
Hero-зона с breadcrumbs, title, cover image, quick info cards.

**Features**:
- Breadcrumbs навигация
- Category badge
- Cover image с video play overlay
- Quick info cards (desktop): место, возраст, длительность

### OfferGallery
Фотогалерея с lightbox.

**Features**:
- Desktop: grid 4-5 колонок
- Mobile: horizontal scroll
- Lightbox с навигацией
- "+N" badge для скрытых фото

### OfferTrailer
Видео трейлер/reels блок.

**Supports**:
- YouTube, Vimeo, MP4
- Preview thumbnail
- Duration badge
- Modal player

### OfferMetaGrid
Ключевые параметры (возраст, формат, длительность и т.д.).

**Features**:
- Desktop: grid 4-5 колонок
- Mobile: horizontal scroll
- Icon cards с цветными фонами

### OfferSchedule
Расписание занятий или смены лагеря.

**Variants**:
- **Classes**: таблица с группами, днями, временем, ценой
- **Shifts**: карточки смен с датами, местами, CTA

### OfferAccommodation
Размещение и условия (только для лагерей).

**Sections**:
- Размещение (тип, адрес, комнаты)
- Питание (включено, дополнительно)
- Трансфер
- Безопасность
- Что взять с собой

### OfferReviews
Отзывы (только внутренние mamaGo).

**Features**:
- Horizontal scroll
- Avatar + rating + text
- "Все отзывы" link

### OfferHowToJoin
Блок "Как записаться" (4 шага).

**Features**:
- Minimal icons
- Line connectors (desktop)
- Адаптивные шаги под CTA type

### OfferStickyBar
Sticky action bar.

**Variants**:
- **Desktop**: top sticky bar (появляется после scroll)
- **Mobile**: bottom sticky bar (всегда видим)

**Features**:
- Title + price
- Primary + secondary CTA
- Safe area support

## Типы данных

### OfferPageData
Главный тип данных страницы.

```typescript
interface OfferPageData {
  id: string;
  slug: string;
  citySlug: string;
  title: string;
  shortDescription: string;
  description: string; // Rich HTML
  offerType: "SINGLE" | "REGULAR" | "CAMP";
  
  media: {
    posterUrl: string;
    gallery: OfferGalleryImage[];
    videoUrl?: string;
    // ...
  };
  
  metaGrid: OfferMetaItem[];
  pricing: { /* ... */ };
  schedule?: { /* ... */ };
  accommodation?: { /* ... */ };
  place?: { /* ... */ };
  reviews: OfferReview[];
  cta: { /* ... */ };
  similar: OfferSimilarItem[];
  seo: { /* ... */ };
}
```

## Mobile UX

### Особенности
- **App-like feel**: sticky bottom CTA, compact spacing
- **Gallery swipe**: horizontal scroll с snap
- **Reels fullscreen**: modal video player
- **No tiny tap zones**: минимум 44x44px для кнопок
- **Safe area support**: `env(safe-area-inset-bottom)`

### Bottom CTA
- Всегда видим
- Цена + 2 кнопки (primary + secondary)
- Компактный текст на мобильном

## Performance

### Оптимизации
- `next/image` для всех изображений
- Lazy loading галереи
- Deferred video loading
- Lightbox dynamic import
- Avoid layout shifts

### Image Sizes
- Hero cover: `(max-width: 1024px) 100vw, 60vw`
- Gallery: `(max-width: 640px) 50vw, 20vw`
- Similar cards: `(max-width: 640px) 280px, 25vw`

## Accessibility

### Требования
- Keyboard navigation
- ARIA labels
- Focus states
- Contrast ratios
- `inert` для скрытых sticky bars

### Focus Management
- Снимаем фокус при скрытии sticky bar
- Trap focus в lightbox/modal
- Skip links для навигации

## SEO

### Metadata
- `title`, `description`
- `og:image`, `og:title`, `og:description`
- Canonical URL
- Schema.org Offer
- Breadcrumbs schema
- VideoObject schema (если есть trailer)

## Использование

### Базовый пример

```tsx
import { OfferPageView } from "@/components/offers";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";

export default function OfferPage({ data }: { data: OfferPageData }) {
  return <OfferPageView data={data} />;
}
```

### Кастомизация CTA

```typescript
const data: OfferPageData = {
  // ...
  cta: {
    type: "записаться",
    primaryLabel: "Записаться на занятие",
    secondaryLabel: "В план",
    phone: "+375 29 123 45 67",
    instructions: "Позвоните или оставьте заявку",
  },
};
```

### Расписание (Classes)

```typescript
const data: OfferPageData = {
  // ...
  schedule: {
    type: "classes",
    items: [
      {
        id: "1",
        groupName: "Младшая группа",
        days: "Пн, Ср, Пт",
        time: "10:00 - 11:30",
        price: "120 BYN/мес",
        ctaEnabled: true,
        ctaLabel: "Записаться",
      },
    ],
  },
};
```

### Смены (Shifts)

```typescript
const data: OfferPageData = {
  // ...
  schedule: {
    type: "shifts",
    items: [
      {
        id: "1",
        title: "Первая смена",
        dateFrom: "1 июня",
        dateTo: "14 июня",
        duration: "14 дней",
        ageRange: "7-12 лет",
        spotsLeft: 5,
        capacity: 20,
        price: "850 BYN",
        ctaEnabled: true,
      },
    ],
  },
};
```

## TODO

### Фаза 1 (MVP) ✅
- [x] Базовая структура компонентов
- [x] Hero + Gallery + Trailer
- [x] Meta Grid + Description
- [x] Pricing + Actions
- [x] Schedule (classes + shifts)
- [x] Reviews + Location
- [x] Sticky Bar (mobile + desktop)
- [x] TypeScript типы

### Фаза 2 (Интеграция)
- [ ] Интеграция с БД (Prisma)
- [ ] API endpoints для данных
- [ ] Реальная карта (Google Maps / Yandex)
- [ ] Booking flow интеграция
- [ ] Save to Plan интеграция
- [ ] Share functionality

### Фаза 3 (Улучшения)
- [ ] Lightbox анимации
- [ ] Video player controls
- [ ] Reviews pagination
- [ ] Similar offers carousel
- [ ] A/B testing CTA variants
- [ ] Analytics events

## Связанные файлы

- `src/components/event-page/` — EventPage компоненты (reference)
- `src/components/activity/` — Activity cards (для Similar)
- `src/components/ui/` — UI kit (Button, Dialog и т.д.)
- `src/lib/routing/` — Routing helpers
- `src/lib/toast.ts` — Toast notifications

## Поддержка

Для вопросов и предложений:
- Документация: `/docs/offer-page.md`
- Дизайн: Figma (ссылка)
- Код: GitHub Issues
