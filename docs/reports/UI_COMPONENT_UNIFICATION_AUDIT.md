# UI Component Unification Audit

Дата: 2026-05-15

## Цель этапа

Первый этап не меняет массово публичный UI. Его задача:

- зафиксировать текущие карточки и повторяемые блоки;
- определить безопасную базу для постепенной миграции;
- ввести единый нормализованный контракт для activity-card UI;
- создать витрину для новых состояний без переноса production-компонентов в `ui-lab`.

## Найденные карточки активности и похожие сущности

### Публичные activity / offer / place карточки

1. `src/components/activity/ActivityCard.tsx`
Назначение: основная публичная карточка активности для событий.
Использования:
- `src/features/city-home/components/CityHomeContentRows.tsx`
- `src/components/discovery/DiscoveryActivitiesGrid.tsx`
- `src/components/activity/ActivityGrid.tsx`
- `src/app/(public)/me/ideas/IdeasClient.tsx`
- `src/app/(ui)/ui-lab/_sections/UiPrimitivesSection.tsx`

2. `src/components/offers/OfferCard.tsx`
Назначение: отдельная публичная карточка предложения.
Использования:
- `src/features/city-home/components/CityHomeContentRows.tsx`
- `src/components/place/marketplace/PlaceOffersSection.tsx`
- `src/app/(public)/me/ideas/IdeasClient.tsx`

3. `src/components/place/PlaceCard.tsx`
Назначение: карточка места.
Использования:
- `src/components/place/PlaceNetworkSection.tsx`

### Карточки “моего плана” и рекомендаций

4. `src/features/me/components/PlanCard.tsx`
Назначение: контейнер недельного/дневного плана, внутри есть собственная inline-карточка `PlanItemCard`.
Использования:
- компонент зарегистрирован в `src/components/ui-lab/registry.ts`

5. `src/features/my-plan/components/RecommendationCard.tsx`
Назначение: карточка рекомендации для `my-plan`.
Использования:
- `src/features/my-plan/components/PlanSuggestionsSheet.tsx`
- `src/features/my-plan/components/GuestMyPlanPanel.tsx`
- `src/features/my-plan/components/PlanMainContent.tsx`

6. `src/app/(public)/me/plan/RecommendationsSection.tsx`
Назначение: ещё одна отдельная inline-карточка рекомендаций для публичной страницы плана.
Использования:
- только внутри `RecommendationsSection`

### Embedded / article cards

7. `src/components/article/blocks/ArticleEventCardBlock.tsx`
8. `src/components/article/blocks/ArticleOfferCardBlock.tsx`
9. `src/components/article/blocks/ArticlePlaceCardBlock.tsx`

Все три используются в:
- `src/components/article/mvp/ArticleMvpView.tsx`
- `src/app/(public)/blog/[slug]/page.tsx`

Это не прямые feed-card карточки, а embed-блоки статьи, но у них уже есть общий нижележащий shell: `ArticleEmbeddedCardShell`.

### Специализированные карточки вне прямого scope миграции

10. `src/features/birthday/components/cards/BirthdayOfferCard.tsx`
Назначение: специальная карточка предложения для birthday-flow.

11. `src/components/routes/RouteCard.tsx`
Назначение: карточка маршрута с собственной save/plan логикой.

12. Business/backoffice-ветка:
- `src/components/business/events/EventCardHorizontal.tsx`
- `src/components/business/offers/OfferCardHorizontal.tsx`
- `src/components/business/places/PlaceCardHorizontal.tsx`

Эти компоненты не относятся к публичному unified activity-card шаблону и могут жить отдельно.

## Что дублирует друг друга

### Явное дублирование карточек активности

1. `src/components/activity/ActivityCard.tsx` и `src/components/offers/OfferCard.tsx`
- обе решают задачу публичной карточки активности;
- обе показывают image + title + meta + save affordance;
- различаются в основном раскладкой и тем, что действия/статусы зашиты по-разному.

2. `src/features/my-plan/components/RecommendationCard.tsx` и inline `RecommendationCard` в `src/app/(public)/me/plan/RecommendationsSection.tsx`
- обе карточки описывают “элемент активности + действия”;
- обе содержат title / image / meta / add/remove actions;
- различаются плотностью и сценариями, но базовый UI-скелет общий.

3. `PlanItemCard` внутри `src/features/me/components/PlanCard.tsx`
- отдельная карточка активности для плана;
- визуально и по структуре близка к будущему `ActivityCard variant="plan"`;
- сейчас не переиспользуется как самостоятельный публичный компонент.

4. `ArticleEventCardBlock` и `ArticleOfferCardBlock`
- оба представляют activity-like entity в embed-контексте;
- уже частично унифицированы через `ArticleEmbeddedCardShell`;
- это хороший пример правильного разделения shell + variant data.

### Дублирование действий

1. Идеи / план / удалить / изменить дату сейчас размазаны по:
- `src/features/save/SaveHeart.tsx`
- `src/components/activity/SaveToPlanModal.tsx`
- `src/app/(public)/me/ideas/IdeasClient.tsx`
- `src/features/my-plan/components/RecommendationCard.tsx`
- `src/app/(public)/me/plan/RecommendationsSection.tsx`
- `src/components/event-page/EventStickyActionBar.tsx`
- `src/components/routes/RouteCard.tsx`

Проблема: UI действия часто живут внутри конкретной карточки или рядом с ней, а не в отдельном action-layer.

## Что можно оставить как основу

### Хорошая база для activity-card foundation

1. `src/components/activity/ActivityCard.tsx`
- уже используется в discovery/feed/ideas;
- содержит общую domain-идею “activity card”;
- но слишком завязан на текущую save-логику и старый adapter props contract.

Вывод: не мигрировать его массово сейчас, а использовать как reference для плавного перехода к новому `src/components/content-cards/ActivityCard.tsx`.

2. `src/components/article/blocks/ArticleEmbeddedCardShell.tsx`
- хороший пример архитектуры shell + variant content;
- полезен как паттерн для будущей унификации publication embeds.

3. `src/components/event-page/EventVenueBlock.tsx`
- уже оформлен как самостоятельный location block;
- подходит как опорный шаблон для общих publication-блоков.

4. `src/components/ui/media-cover.tsx`
- можно использовать как общую основу для media zone карточек.

## Что следует заменить позже

1. `src/components/offers/OfferCard.tsx`
- главный кандидат на миграцию в единый activity template.

2. Inline action-row в `src/app/(public)/me/ideas/IdeasClient.tsx`
- должен уйти в `ActivityActionsPlan` или близкий action component.

3. Inline `PlanItemCard` в `src/features/me/components/PlanCard.tsx`
- в будущем может стать thin-wrapper над `ActivityCard variant="plan"`.

4. Inline `RecommendationCard` в `src/app/(public)/me/plan/RecommendationsSection.tsx`
- явный кандидат на замену общим activity-card + отдельными actions.

5. `src/features/my-plan/components/RecommendationCard.tsx`
- можно постепенно приводить к тем же visual contracts и слотам действий.

## Какие состояния activity-card нужны

Для unified `ActivityCard` на первом этапе зафиксированы такие состояния:

1. `default`
- стандартная карточка для ленты/подборки.

2. `compact`
- более плотная версия для списков и узких колонок.

3. `horizontal`
- горизонтальная карточка для рекомендаций, saved/feed и side-lists.

4. `plan`
- тот же визуальный шаблон, но адаптированный под контекст “Моего плана”.

### Смысловые статусы карточки

1. `isSaved`
- мягкий статус “В идеях”.

2. `isPlanned`
- мягкий статус “В плане”.

3. `isPast`
- мягкий статус “Прошло”.

4. `statusLabel`
- дополнительная строка статуса из нормализованной модели, если нужна бизнес-метка.

5. no image
- карточка должна иметь устойчивый placeholder.

6. long title
- карточка должна держать длинный заголовок без визуального развала.

## Какие publication-блоки нужно унифицировать

Нужна постепенная унификация повторяемых блоков на публичных страницах событий / предложений / мест.

### Уже выделенные или близкие к этому блоки

1. Location block
- `src/components/event-page/EventVenueBlock.tsx`
- `src/components/offers/OfferPlace.tsx`
- `src/components/event-page/EventLocation.tsx`

2. Schedule block
- `src/components/offers/OfferSchedule.tsx`
- `src/components/event-page/EventSessionSelector.tsx`

3. Reviews block
- `src/components/event-page/EventReviews.tsx`
- `src/components/offers/OfferReviews.tsx`
- `src/components/place/premium/PlaceReviews.tsx`
- `src/components/place/marketplace/PlaceReviewsSection.tsx`

4. Gallery / media block
- `src/components/event-page/EventMediaStack.tsx`
- `src/components/place/premium/PlaceGallery.tsx`
- `src/components/place/PlaceGalleryPreview.tsx`

### Где блоки пока не нормализованы

1. `EventPageView.tsx`
- содержит крупные inline editorial sections, включая location-like and meta sections.

2. `OfferPageView.tsx`
- собирает page sections из отдельных компонентов, но naming/contract ещё не выровнены под общие publication blocks.

### Рекомендуемая цель

В следующих этапах привести к общим блокам:

- `LocationBlock`
- `ScheduleBlock`
- `PriceBlock`
- `GalleryBlock`
- `ReviewsBlock`
- общие `EmptyState` / `LoadingState` / `ErrorState` для публичных сценариев

На текущем этапе создавать их массово не нужно, но правила уже надо зафиксировать.

## Состояния страницы, которые тоже размазаны

### Empty states

Найдены локальные inline-реализации:
- `src/app/(public)/me/ideas/IdeasClient.tsx`
- `src/app/(public)/me/routes/RoutesClient.tsx`
- `src/app/(public)/me/bookings/ParentBookingsClient.tsx`
- `src/app/business/(protected)/bookings/BookingsPageClient.tsx`
- admin-specific variants в отдельных файлах

### Error / loading states

Общие публичные `LoadingState` / `ErrorState` почти не выделены, чаще используются локальные условные рендеры или inline-функции.

Вывод: unified states тоже нужны, но это отдельный миграционный поток после карточек и publication blocks.

## Bottom / sticky action patterns

Найдены смежные action-bar паттерны:

1. `src/components/event-page/EventStickyActionBar.tsx`
- публичный sticky top + mobile bottom bar для события.

2. `src/components/layout/MobileBottomBarShell.tsx`
- layout-shell для мобильного нижнего бара приложения.

3. `src/components/form-shell/FormStickyActionBar.tsx`
- sticky actions для business forms.

Это разные уровни UI. Для unified public card architecture они важны как reference, но не должны сливаться в один компонент.

## Главные риски миграции

1. Поломка save/plan flows
- текущая логика распределена между `SaveHeart`, `SaveToPlanModal`, `SaveActivityFlow*`, `OfferPageView`, `RouteCard`, `IdeasClient`.
- если зашить действия внутрь новой карточки, связность только ухудшится.

2. Смешение UI-shell и business logic
- старые карточки часто принимают domain-specific props;
- новый `ActivityCard` должен принимать только нормализованный UI item.

3. Параллельные несовместимые карточки
- если продолжать создавать `EventCard` / `OfferCard` / `PlanEventCard`, миграция станет бесконечной.

4. Слишком ранний массовый рефакторинг
- затронет discovery, city-home, ideas, plan, article embeds одновременно;
- высок риск визуальных и поведенческих регрессий.

5. Потеря контекстных действий
- контекст feed / ideas / plan / recommendations различается;
- поэтому actions должны быть slot-based, а не зашиты внутрь shell.

## Рекомендуемая стратегия миграции

1. Ввести новый `ActivityCardItem` и новый `content-cards/ActivityCard`.
2. Вынести действия в отдельные компоненты:
- `ActivityActionsFeed`
- `ActivityActionsPlan`
3. Проверять новые состояния в `ui-lab/cards`.
4. Делать миграцию точечно:
- сначала `me/ideas`
- затем recommendations / my-plan
- затем discovery / city-home
5. Старые компоненты удалить только после полной замены usages.

## Stage 2 migration: me/ideas

На этапе 2 выполнена первая реальная миграция страницы на новый foundation:

- `src/app/(public)/me/ideas/IdeasClient.tsx`
  теперь использует новый `src/components/content-cards/ActivityCard.tsx`
  для `ACTIVITY` и `OFFER`;
- данные для карточки нормализуются через:
  - `mapEventToActivityCardItem`
  - `mapOfferToActivityCardItem`
- действия на карточке вынесены в `ActivityActionsPlan` через `actions` slot.

### Что мигрировано

1. `ACTIVITY` ideas
- migrated to unified `ActivityCard`

2. `OFFER` ideas
- migrated to unified `ActivityCard`

3. `ActivityActionsPlan`
- расширен под реальный page-level usage:
  - `item`
  - `isScheduling`
  - `isRemoving`
  - `disabled`
  - скрытие schedule/remove по context

### Что пока осталось legacy

1. `ROUTE` ideas
- оставлены отдельным lightweight card pattern;
- не были включены в activity-card migration этого этапа.

2. Старые публичные карточки проекта
- `src/components/activity/ActivityCard.tsx`
- `src/components/offers/OfferCard.tsx`
- `src/features/me/components/PlanCard.tsx` inline `PlanItemCard`
- recommendation cards в plan flows

### Ограничения и риски

1. `/me/ideas` сохраняет существующую page-level логику планирования и удаления.
- actions не знают API;
- callbacks остаются на уровне контейнера.

2. Offer planning behaviour не расширялся насильно.
- migration не должна ломать текущую бизнес-логику;
- если у offer сценарий планирования будет развиваться, это нужно делать отдельно.

3. На странице всё ещё есть смешанный режим migration:
- `ACTIVITY` и `OFFER` уже на unified card;
- `ROUTE` пока отдельно.

### Следующий шаг

1. Перевести recommendation / my-plan cards на тот же `ActivityCard`.
2. После этого сравнить, можно ли вынести общий ideas/plan action pattern.
3. Затем отдельно идти в унификацию publication blocks.
