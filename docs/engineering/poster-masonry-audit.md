# Аудит: кладка постеров в афише (PR 0)

База: `dev` @ `36dbde94`, 2026-10-27. Только чтение, кода в этом PR нет.

## 1. Карточка события

- Одна общая карточка: `src/components/events/EventCard.tsx` (+ `eventCardAdapter.ts`, `eventCardLayout.ts`).
  Параллельных копий карточки события нет, но рядом живут **отдельные** карточки с той же вёрсткой:
  `IdeaPosterCard` (избранное), `OfferCard` (офферы), `ArticleEventCardBlock` (событие внутри статьи; на `EventCard` не завязана).
- Где используется `EventCard`:
  - «Афиша» `/[city]/events` (+ чипы «Сегодня/Завтра/Хэллоуин» — это фильтры той же ленты) — `DiscoveryActivitiesGrid` (grid 2/4 колонки);
  - главная — `CityHomeKudaSection` в `CityHomeContentRows.tsx`: **горизонтальная карусель** (`HorizontalCardRow`, 8 карточек), ленты событий на главной нет;
  - «Похожие» — `SimilarEventsSection`: **сетка 2/4**, не карусель;
  - афиша места — `PlaceEventsSection` (карусель);
  - **журнал**: `ArticlePlaceEmbed` (карусель афиши места внутри статьи, `coverRatio="1/1"`, без лайка, с ценой на постере).
- Избранное (`/me/ideas`) — не `EventCard`, а `IdeaPosterCard`; лента смешанная (события, офферы, маршруты, статьи); кнопка-сердце открывает диалог «план/коллекции», а не `SaveHeart`.

## 2. Masonry / сетки

- Уже есть `src/components/ideas/OrderedMasonryGrid.tsx` (+ `orderedMasonryGeometry.ts`, тест). Используется только в избранном.
  Алгоритм — CSS grid + `grid-row-end: span N` по ResizeObserver, порядок построчный. SSR рендерит обычную сетку и **перестраивается после гидрации**; колонки 2/4, зазоры не по ТЗ.
  План: расширить этот компонент (алгоритм «в самую короткую колонку», 2/3/4, SSR в 2 колонки), а не создавать второй. Затронет избранное.
- `columns` нигде в листингах событий не используется. Листинги: `DiscoveryActivitiesGrid` (Tailwind grid), `HorizontalCardRow` (карусели).

## 3. Медиа-модель

- `MediaAsset.width/height Int?` **уже есть** (а также `ActivityImage.width/height`). Новая колонка и миграция не нужны.
  Дедупликация по SHA-256 — `contentHash` (`src/lib/media/dedup.ts`); связи — `MediaUsage`.
- Обработка: `src/lib/media/imageProcessor.ts` (sharp, EXIF-rotate, мастер ≤1600 WebP). Размеры мастера пишутся во всех upload-роутах
  (`/api/upload`, `/upload/v2`, `/upload/wizard`, `/media/from-url`) через `registerUploadedMedia` → `createMediaAsset` и в WP-миграции (`mamagoMediaImporter`).
- Дыры: `ensureMediaAssetForStoredFileUrl` (часть путей зовёт без размеров, напр. `mediaPublicAccess.ts`), legacy-скрипт `backfill-media-library.ts`.
  Общая точка для дозаполнения — `createMediaAsset`/`registerUploadedMedia` (чтение заголовка sharp `metadata()` при отсутствии размеров).

## 4. Пайплайны картинок

- 24afisha (ABWS) и family.by: `import-publish.service.ts` → `optimizeImportedImage` (sharp, размеры пишет в `MediaAsset`), но в `Activity` кладёт **только `coverImageUrl`**, без `coverImageId`.
- Визард/кабинет бизнеса: `coverImageId` → FK на `MediaAsset` (размеры доступны джойном); галерея — `ActivityImage.mediaAssetId`.
- Редакторский бот/Telegram capture собственных картинок событий не пишет.
- Без скачивания: размеры событий брать из `MediaAsset` по `coverImageId`, иначе батч-поиском по `storageKey`/`publicUrl` (у `publicUrl` нет индекса, `storageKey` — unique). Бэкфилл — `sharp(file).metadata()` по локальному файлу (читает заголовок).

## 5. Отдача изображений

`next/image` (`fill`, `object-cover`, `sizes=EVENT_CARD_IMAGE_SIZES` под ширину карусели) для локальных и allowlist-хостов (`nextImagePolicy.ts`), иначе `<img>`.
Focal point/кропа ресайзером нет — кроп только `object-fit: cover` по центру. `aspect-ratio` фиксирован (`coverRatio`, по умолчанию 4/5; избранное — 3/4).

## 6. Бейджи и лайк

- `EventCard`: цена — бейдж на постере (bottom-right), `SaveHeart` — абсолютно поверх постера (top-right, 44px на мобильном); возраст и дата — в мета-строке под названием.
- `IdeaPosterCard`: цена и кнопка-сердце тоже поверх постера. `OfferCard` — аналогично (вне скоупа).
- Формат цены — `formatPublicCardPrice` (`Бесплатно`, `от 30 Br` с иконкой рубля через `renderCurrencyText`).

## 7. Пагинация и возврат

- **Пагинации нет.** «Афиша»: SSR одной порцией до 80 событий (`getKudaDiscoveryFeed`), фильтрация/ранжирование по персоне — на клиенте (`partitionDiscoveryFeed`, два блока: основной и «вторичный»). Избранное — тоже одной порцией.
- Своего восстановления скролла нет (стандарт App Router; фильтры пишут URL с `scroll: false`).

## Решения и риски

- Перенос цены/лайка — во всех местах `EventCard`, кроме журнала: для `ArticlePlaceEmbed` нужен вариант (prop) со старой вёрсткой.
- Клиентское ранжирование по персоне может менять порядок после гидрации — риск для «SSR без перестройки».
- Кладка включается только для событий; `DiscoveryActivitiesGrid` также рисует офферы («Занятия», «Праздники») — там сетка не меняется.

## Вопросы к владельцу (блокируют PR 1–3)

1. На главной событий-«ленты» нет: есть карусель «Куда пойти» на 8 карточек. Кладка на главной = заменить карусель блоком-кладкой (сколько карточек?) или оставить карусель (тогда только новая карточка)?
2. Подгрузки нет. Делать в PR 3 подгрузку (infinite scroll/«Показать ещё» с серверной пагинацией — отдельный объём) или кладка работает с текущей порцией до 80, а API для добавления карточек закладываем на будущее?
3. Избранное: переводить на правило пропорций и вёрстку без оверлеев только события или все типы (офферы, маршруты, статьи)? Сердце там открывает диалог «план/коллекции» — сохраняем это поведение?
4. Общая `OrderedMasonryGrid` будет переписана на «самую короткую колонку» 2/3/4 — это изменит и раскладку коллекций в избранном. Ок?
5. «Похожие» сейчас сетка 2/4, а не карусель — оставляем сеткой с новой карточкой без кладки?
