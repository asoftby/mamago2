# Структура компонентов Premium Place Landing Page

## Визуальная схема страницы

```
┌─────────────────────────────────────────────────────────────┐
│                        PlaceHero                            │
│  ┌──────┐  Культурный центр «Корпус»          [Редактир▼]  │
│  │ LOGO │  ⭐ 4.8 (127 отзывов)                             │
│  └──────┘  Современное пространство для творчества...      │
│  ← Назад к списку мест                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      PlaceGallery                           │
│  ┌─────────────────────┬──────────┬──────────┐             │
│  │                     │  Photo 2 │  Photo 3 │             │
│  │     Main Photo      ├──────────┼──────────┤             │
│  │      (Large)        │  Photo 4 │  Photo 5 │             │
│  │                     │          │ +Показать│             │
│  └─────────────────────┴──────────┴──────────┘             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PlaceQuickFacts                          │
│  📅 Год: 2018    🌍 Языки: Рус, Бел    👥 До 250 человек   │
│  📍 Адрес        🕐 Часы работы        📞 Телефон          │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┬──────────────────────────┐
│         Main Content             │    PlaceSidebarCard      │
│                                  │  ┌────────────────────┐  │
│  ┌────────────────────────────┐  │  │ Свяжитесь с нами   │  │
│  │      PlaceContent          │  │  │                    │  │
│  │  ─────────────────────     │  │  │ 📞 +375 29 123... │  │
│  │  О месте                   │  │  │ 🌐 Посетить сайт  │  │
│  │  Описание места...         │  │  │ 📍 Адрес          │  │
│  │                            │  │  │                    │  │
│  │  Что мы предлагаем         │  │  │ [Отправить запрос] │  │
│  │  ✓ Особенность 1           │  │  │                    │  │
│  │  ✓ Особенность 2           │  │  │ 🔗 Поделиться     │  │
│  │                            │  │  │ ❤️  Сохранить      │  │
│  │  Удобства                  │  │  │                    │  │
│  │  ✓ Wi-Fi  ✓ Парковка       │  │  │ ✓ Проверенное     │  │
│  └────────────────────────────┘  │  │ ✓ Быстрый ответ   │  │
│                                  │  └────────────────────┘  │
│  ┌────────────────────────────┐  │         (Sticky)         │
│  │  PlaceEventsCarousel       │  │                          │
│  │  ─────────────────────     │  │                          │
│  │  Предстоящие события       │  │                          │
│  │  [◄] [Event 1] [Event 2]..│  │                          │
│  │      [Event 3] [Event 4][►]│  │                          │
│  │                            │  │                          │
│  │  [Посмотреть все события]  │  │                          │
│  └────────────────────────────┘  │                          │
│                                  │                          │
│  ┌────────────────────────────┐  │                          │
│  │  PlaceOffersCarousel       │  │                          │
│  │  ─────────────────────     │  │                          │
│  │  Специальные предложения   │  │                          │
│  │  [◄] [Offer 1] [Offer 2].. │  │                          │
│  │      [Offer 3] [Offer 4][►]│  │                          │
│  │                            │  │                          │
│  │  [Посмотреть все предлож.] │  │                          │
│  └────────────────────────────┘  │                          │
│                                  │                          │
│  ┌────────────────────────────┐  │                          │
│  │      PlaceReviews          │  │                          │
│  │  ─────────────────────     │  │                          │
│  │  Отзывы гостей             │  │                          │
│  │                            │  │                          │
│  │  ┌──────┐  ┌────────────┐  │  │                          │
│  │  │ 4.8  │  │ 5★ ████ 85 │  │  │                          │
│  │  │ ⭐⭐⭐⭐⭐│  │ 4★ ███  30 │  │  │                          │
│  │  │127 отз│  │ 3★ █    10 │  │  │                          │
│  │  └──────┘  │ 2★      2  │  │  │                          │
│  │            │ 1★      0  │  │  │                          │
│  │            └────────────┘  │  │                          │
│  │                            │  │                          │
│  │  👤 Анна Петрова  ⭐⭐⭐⭐⭐   │  │                          │
│  │  Прекрасное место...       │  │                          │
│  │  👍 Полезно (12)           │  │                          │
│  │                            │  │                          │
│  │  [Показать все отзывы]     │  │                          │
│  └────────────────────────────┘  │                          │
│                                  │                          │
│  ┌────────────────────────────┐  │                          │
│  │    PlaceMapSection         │  │                          │
│  │  ─────────────────────     │  │                          │
│  │  Где мы находимся          │  │                          │
│  │                            │  │                          │
│  │  ┌──────┐  ┌────────────┐  │  │                          │
│  │  │ 📍   │  │            │  │  │                          │
│  │  │Адрес │  │   [MAP]    │  │  │                          │
│  │  │      │  │            │  │  │                          │
│  │  │[🗺️]  │  │            │  │  │                          │
│  │  │[🧭]  │  │            │  │  │                          │
│  │  └──────┘  └────────────┘  │  │                          │
│  └────────────────────────────┘  │                          │
│                                  │                          │
└──────────────────────────────────┴──────────────────────────┘
```

## Иерархия компонентов

```
PremiumPlacePage
├── PlaceHero
│   ├── Back Button
│   ├── Logo Image
│   ├── Title & Category
│   ├── Rating & Reviews
│   ├── Short Description
│   └── Edit Dropdown (conditional)
│
├── PlaceGallery
│   ├── Grid Layout
│   │   ├── Main Image (large)
│   │   └── 4 Small Images
│   └── Fullscreen Modal
│       ├── Image Display
│       ├── Navigation Arrows
│       ├── Counter
│       └── Close Button
│
├── PlaceQuickFacts
│   └── Fact Items (grid)
│       ├── Icon
│       ├── Label
│       └── Value
│
├── Main Layout (2 columns)
│   │
│   ├── Left Column (66%)
│   │   │
│   │   ├── PlaceContent
│   │   │   ├── Description
│   │   │   ├── Features List
│   │   │   └── Amenities Grid
│   │   │
│   │   ├── PlaceEventsCarousel
│   │   │   ├── Header & Navigation
│   │   │   ├── Scrollable Container
│   │   │   │   └── Event Cards
│   │   │   │       ├── Image
│   │   │   │       ├── Title
│   │   │   │       ├── Date & Location
│   │   │   │       └── Price
│   │   │   └── "Show All" Button
│   │   │
│   │   ├── PlaceOffersCarousel
│   │   │   ├── Header & Navigation
│   │   │   ├── Scrollable Container
│   │   │   │   └── Offer Cards
│   │   │   │       ├── Image
│   │   │   │       ├── Discount Badge
│   │   │   │       ├── Title & Description
│   │   │   │       ├── Duration & Capacity
│   │   │   │       └── Price
│   │   │   └── "Show All" Button
│   │   │
│   │   ├── PlaceReviews
│   │   │   ├── Rating Summary
│   │   │   │   ├── Overall Rating
│   │   │   │   └── Rating Breakdown
│   │   │   ├── Reviews List
│   │   │   │   └── Review Cards
│   │   │   │       ├── Avatar
│   │   │   │       ├── Name & Date
│   │   │   │       ├── Stars
│   │   │   │       ├── Text
│   │   │   │       └── Helpful Button
│   │   │   └── "Show All" Button
│   │   │
│   │   └── PlaceMapSection
│   │       ├── Address Info Card
│   │       │   ├── Address Details
│   │       │   ├── "Open in Maps" Button
│   │       │   └── "Get Directions" Button
│   │       └── Map Embed / Fallback
│   │
│   └── Right Column (33%)
│       │
│       └── PlaceSidebarCard (sticky)
│           ├── CTA Section
│           ├── Contact Buttons
│           │   ├── Phone
│           │   ├── Email
│           │   ├── Website
│           │   └── Address
│           ├── Primary CTA Button
│           ├── Action Buttons
│           │   ├── Share
│           │   └── Favorite
│           └── Trust Indicators
```

## Потоки данных

```
┌─────────────────┐
│   Page.tsx      │
│  (Server Side)  │
└────────┬────────┘
         │
         │ Fetch from Prisma:
         │ - Place data
         │ - Images
         │ - Events (Activity type=EVENT)
         │ - Offers (Activity type=OFFER)
         │ - Reviews (TODO)
         │
         ▼
┌─────────────────────────────────┐
│     PremiumPlacePage            │
│     (Client Component)          │
└────────┬────────────────────────┘
         │
         │ Props:
         │ - place: PlaceData
         │ - events: Event[]
         │ - offers: Offer[]
         │ - reviews: Review[]
         │ - canEdit: boolean
         │
         ├──────────────────────────┐
         │                          │
         ▼                          ▼
┌────────────────┐        ┌────────────────┐
│   PlaceHero    │        │  PlaceGallery  │
└────────────────┘        └────────────────┘
         │                          │
         ▼                          ▼
┌────────────────┐        ┌────────────────┐
│PlaceQuickFacts │        │ PlaceContent   │
└────────────────┘        └────────────────┘
         │                          │
         ▼                          ▼
┌────────────────┐        ┌────────────────┐
│PlaceEvents     │        │ PlaceOffers    │
│Carousel        │        │ Carousel       │
└────────────────┘        └────────────────┘
         │                          │
         ▼                          ▼
┌────────────────┐        ┌────────────────┐
│ PlaceReviews   │        │ PlaceMapSection│
└────────────────┘        └────────────────┘
         │
         ▼
┌────────────────┐
│PlaceSidebarCard│
│   (Sticky)     │
└────────────────┘
```

## Состояния компонентов

### PlaceGallery
```typescript
State:
- isOpen: boolean          // Fullscreen modal
- currentIndex: number     // Current image index

Actions:
- openGallery(index)       // Open modal at index
- nextImage()              // Navigate to next
- prevImage()              // Navigate to previous
- closeGallery()           // Close modal
```

### PlaceSidebarCard
```typescript
State:
- isFavorite: boolean      // Favorite status

Actions:
- handleShare()            // Share place
- handleFavorite()         // Toggle favorite
```

### PlaceEventsCarousel
```typescript
Refs:
- scrollRef: HTMLDivElement // Scroll container

Actions:
- scroll('left' | 'right') // Scroll carousel
```

### PlaceOffersCarousel
```typescript
Refs:
- scrollRef: HTMLDivElement // Scroll container

Actions:
- scroll('left' | 'right') // Scroll carousel
```

### PlaceReviews
```typescript
State:
- showAll: boolean         // Show all reviews

Actions:
- toggleShowAll()          // Toggle reviews display
```

## Адаптивность

### Mobile (< 768px)
```
┌─────────────────┐
│   PlaceHero     │
├─────────────────┤
│  PlaceGallery   │
│  (1 col grid)   │
├─────────────────┤
│ PlaceQuickFacts │
│  (1 col grid)   │
├─────────────────┤
│  PlaceContent   │
├─────────────────┤
│PlaceSidebarCard │
│ (not sticky)    │
├─────────────────┤
│ PlaceEvents     │
├─────────────────┤
│ PlaceOffers     │
├─────────────────┤
│ PlaceReviews    │
├─────────────────┤
│ PlaceMapSection │
└─────────────────┘
```

### Tablet (768px - 1024px)
```
┌─────────────────┐
│   PlaceHero     │
├─────────────────┤
│  PlaceGallery   │
│  (2x2 grid)     │
├─────────────────┤
│ PlaceQuickFacts │
│  (2 col grid)   │
├─────────────────┤
│  PlaceContent   │
├─────────────────┤
│PlaceSidebarCard │
│ (not sticky)    │
├─────────────────┤
│ PlaceEvents     │
├─────────────────┤
│ PlaceOffers     │
├─────────────────┤
│ PlaceReviews    │
├─────────────────┤
│ PlaceMapSection │
└─────────────────┘
```

### Desktop (> 1024px)
```
┌─────────────────────────────────┐
│          PlaceHero              │
├─────────────────────────────────┤
│        PlaceGallery             │
│  (1 large + 4 small grid)       │
├─────────────────────────────────┤
│      PlaceQuickFacts            │
│       (3 col grid)              │
├──────────────────┬──────────────┤
│  PlaceContent    │PlaceSidebar  │
│                  │Card (sticky) │
│  PlaceEvents     │              │
│                  │              │
│  PlaceOffers     │              │
│                  │              │
│  PlaceReviews    │              │
│                  │              │
│  PlaceMapSection │              │
└──────────────────┴──────────────┘
```

## Интерактивные элементы

### Hover эффекты
- Gallery images: `scale(1.05)` + overlay
- Event/Offer cards: `shadow-lg` + title color change
- Buttons: background color change
- Links: underline thickness change

### Transitions
- All: `transition-all duration-300`
- Smooth scroll: `scroll-smooth`
- Modal: fade in/out
- Carousel: smooth scroll

### Focus states
- All interactive elements: `outline-ring/50`
- Keyboard navigation: visible focus rings
- Skip links: for accessibility

## Производительность

### Оптимизации
- Next.js Image: automatic optimization
- Lazy loading: images below fold
- Code splitting: dynamic imports
- CSS: Tailwind tree-shaking
- No external dependencies (except UI libs)

### Метрики
- First Contentful Paint: <1.5s
- Largest Contentful Paint: <2.5s
- Time to Interactive: <3.5s
- Cumulative Layout Shift: <0.1
