# Admin navigation refactor & publications foundation (mamaGo 2.0)

## 1. Audit — было

- **Сайдбар:** «Модерация» содержала Очередь, Места, События, Предложения; «Контент» — только Медиатека.
- **UI-маршруты:** списки мест/событий/предложений жили под `/admin/moderation/...`; детальная модерация места — `/admin/moderation/places/[id]`.
- **Очередь:** только места и правки мест; счётчик `queueTotal` в навбаре не включал события/офферы.
- **Роли:** по-прежнему `ADMIN` / `MODERATOR` в `src/app/admin/layout.tsx` (без изменений логики).

## 2. Целевая карта маршрутов (UI)

| Назначение | Путь |
|------------|------|
| Очередь (inbox) | `/admin/moderation/queue` |
| События (список) | `/admin/content/events` |
| Места (список) | `/admin/content/places` |
| Предложения (список) | `/admin/content/offers` |
| Модерация места | `/admin/content/places/[id]` |
| Публикации (список) | `/admin/content/publications` |
| Создание публикации | `/admin/content/publications/new?type=news\|article\|collection` |
| Медиатека | `/admin/media` |

**Обратная совместимость:** `GET /admin/moderation/places`, `/events`, `/offers` (и `[id]` для мест) — серверные `redirect` на новые URL с сохранением query.

**API без переноса:** `/api/admin/moderation/...` остаётся каноном для модерации сущностей.

## 3. Сайдбар (новая структура)

- **Главная**
- **Модерация** → только **Очередь** (бейдж = `queueTotal`: места + правки + события + офферы в `PENDING`)
- **Контент** → События, Места, Предложения, Публикации, Медиатека
- Остальные разделы без изменений (B2B, Биллинг, …)

Конфиг: `src/lib/admin/contentSidebarConfig.ts`, `src/lib/admin/moderationSidebarConfig.ts`.

## 4. Публикации — что сделано

- Индекс: табы (Все / Новости / Статьи / Подборки), фильтры (статус, автор, город, дата; тип дублируется табами — отдельный селект disabled как placeholder), таблица колонок по ТЗ, пустое состояние.
- Создание: кнопка открывает диалог выбора типа → переход на `.../new?type=...`.
- Редакторы-пресеты: `NEWS`, `ARTICLE` (+ блоки), `COLLECTION` — UI без сохранения в БД.
- Блоки статьи: список, добавление, типы из `ArticleBlockType`, блок `dynamicActivityFeed` с режимами static/dynamic и черновиком правил.
- Доменные типы: `src/lib/publications/domain.ts`, подписи: `src/lib/publications/labels.ts`, mock-строки: `src/lib/publications/mockPublications.ts` (по умолчанию пустой список).

## 5. Prisma — предложение на следующий шаг

```prisma
enum PublicationType {
  ARTICLE
  NEWS
  COLLECTION
}

enum PublicationStatus {
  DRAFT
  PENDING
  PUBLISHED
  REJECTED
  SCHEDULED
  ARCHIVED
}

model Publication {
  id            String              @id @default(cuid())
  type          PublicationType
  status        PublicationStatus   @default(DRAFT)
  title         String
  slug          String?             @unique
  authorUserId  String?
  author        User?               @relation(fields: [authorUserId], references: [id])
  cityId        String?
  city          City?               @relation(fields: [cityId], references: [id])
  publishedAt   DateTime?
  scheduledFor  DateTime?
  views         Int                 @default(0)
  /// ARTICLE: массив блоков; COLLECTION: feed + SEO; NEWS: компактные поля
  bodyJson      Json?
  seoJson       Json?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@index([status, type])
  @@index([cityId])
  @@index([publishedAt])
}
```

Связь очереди модерации с `Publication` (когда появится сущность) — отдельное поле или общая `ModerationItem` — на усмотрение следующего этапа.

## 6. Файлы

**Добавлены**

- `src/lib/admin/contentSidebarConfig.ts`
- `src/lib/publications/domain.ts`, `labels.ts`, `mockPublications.ts`
- `src/app/admin/content/places/page.tsx`, `PlacesFilters.tsx`, `places/[id]/page.tsx` (перенос)
- `src/app/admin/content/events/page.tsx`, `offers/page.tsx`
- `src/app/admin/content/publications/page.tsx`, `publications/new/page.tsx`
- `src/components/admin/publications/*` (index, new flow, editors, blocks, SEO, dialogs)
- `src/app/admin/moderation/places/page.tsx`, `places/[id]/page.tsx`, `events/page.tsx`, `offers/page.tsx` — только `redirect`

**Изменены (основное)**

- `src/components/admin/AdminSidebar.tsx`, `AdminNav.tsx`
- `src/lib/admin/moderationSidebarConfig.ts`, `getModerationNavCounts.ts`
- `src/app/admin/moderation/queue/page.tsx`
- `src/components/admin/PlaceModerationView.tsx`, `PlaceRevisionModerationView.tsx`
- `src/lib/content-editor/types.ts`, `src/lib/admin/mockDashboardData.ts`
- `src/lib/mocks/adminNotifications.ts`, `src/components/ui-lab/registry.ts`
- API: `revalidatePath` для `/admin/content/events` в маршрутах событий

## 7. Breadcrumbs / back links

- Используются существующие паттерны: заголовки страниц + `BackButton` там, где уже был (редактор публикаций — «Назад» на список).
- Внутренние ссылки из таблиц/дашборда обновлены на `/admin/content/...` где применимо.
