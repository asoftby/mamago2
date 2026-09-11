# Аудит перед переносом «Маршрутов» в «Статьи» / «Путешествия»

Дата аудита: 2026-09-11  
База анализа: ветка `dev`  
Режим: **READ-ONLY**, кроме создания этого отчёта.

## 0. Резюме

Аудит выполнен без изменения данных, Prisma schema, миграций и кода. Живой сайт, GSC API и внешние URL не запрашивались.

Критическое ограничение среды: текущая PostgreSQL БД недоступна. В доступной GitHub-копии `.env` отсутствует, а `docker-compose.yml` только описывает локальный PostgreSQL. Поэтому все выводы, которым нужен актуальный `SELECT`, ниже помечены **«не удалось определить»**. Исторические migration-review артефакты июля 2026 приведены отдельно и не выдаются за состояние PROD на 2026-09-11.

Подтверждённый исторический срез:

- 14 legacy Route lineage учтены;
- 13/13 разрешённых маршрутов были доведены до `PUBLISHED`;
- 1 маршрут — `marshrut-mogilev` — оставлен `CITY_BLOCKED` / `DRAFT`;
- 13 маршрутов были привязаны к `cityId` Минска, Mogilev остался без разрешённого города;
- 13 разрешённых маршрутов содержали 86 `RouteStop`; Mogilev — ещё 4, всего 90 stop;
- все 14 — legacy WordPress editorial content, `authorId = null`; UGC в этом историческом наборе нет;
- `route-preview.json` фиксирует 612 legacy media refs и 60 relation refs;
- 10/14 получили warning `ROUTE_LEVEL_LOCATION_DROPPED`;
- все 14 legacy slug отсутствуют в `manifest.csv`;
- отдельная CSV-выгрузка GSC с URL/clicks/impressions в репозитории не найдена, поэтому группу «GSC есть, manifest нет» и top-30 по кликам достоверно вычислить невозможно.

По совокупности офлайн-доказательств для 13 исторически опубликованных маршрутов применима схема **(а): сохранить существующий URL `/routes/{slug}` и менять только внутреннее представление/источник контента**. При такой схеме новые redirect rows не нужны: **N = 0**. `marshrut-mogilev` должен оставаться вне автоматического публичного переноса до отдельного решения по географии.

Если человек сознательно выберет смену URL на Article URL (`/{city}/blog/{slug}` или `/blog/{slug}`), это уже схема (б): потребуется 13 новых redirect rows для исторически публичного набора, либо 14 после отдельного разрешения Mogilev.

---

# 1. Источники и границы аудита

## 1.1. Модели

Проверены:

- `prisma/schema.prisma:2671-2717` — `Route`, `RouteSlugHistory`;
- `prisma/schema.prisma:2719-2815` — `Article`, category/geo/slug relations;
- `prisma/schema.prisma:2891-2951` — `RouteStop`, `RouteStopImage`;
- `RouteStatus`: `DRAFT | PUBLISHED | ARCHIVED`;
- `RouteVisibility`: `PRIVATE | UNLISTED | PUBLIC`;
- `ContentStatus`: `DRAFT | PENDING | PUBLISHED | NEEDS_REVISION | REJECTED`.

Главное структурное различие: `Route` не имеет `publishedAt` и не имеет top-level body/description. Основной текст legacy-маршрута находится в упорядоченных `RouteStop.note` вместе с данными точки. `Article`, наоборот, имеет `contentJson`, `publishedAt`, category/geo scope и MediaAsset-backed cover.

## 1.2. Офлайн-артефакты

Использованы:

- `manifest.csv` — итоговый redirect manifest; у WP-map rows поле `notes` содержит GSC-derived clicks;
- `scripts/data/wp-redirect-map.json` — статическая WordPress redirect map;
- `docs/migration/reviews/route-preview.json` — sanitized preview 14 Route;
- `docs/migration/reviews/route-review-2026-07-28.md/.json` — editorial review;
- `docs/migration/reviews/route-apply-plan-2026-07-28.json` — 13 `READY`, 1 `BLOCKED`;
- `docs/migration/reviews/route-apply-manifest-2026-07-28.md` — 13 non-Mogilev / 86 stop;
- `docs/migration/prelaunch-checklist.md` — post-apply historical closure: Routes COMPLETE, 13/13 reviewed Routes PUBLISHED, 1 CITY_BLOCKED kept DRAFT.

## 1.3. Недоступные источники

### Текущая PostgreSQL БД

`docker-compose.yml` описывает PostgreSQL 16 и приложение, но в текущей среде нет рабочего project checkout/container и нет `.env` с доступным DB connection.

Поэтому **не удалось определить** по актуальной БД:

- фактическое текущее число Route;
- текущую разбивку status / visibility / city;
- текущие даты/возраст записей;
- Route ↔ Article slug collisions;
- точные non-empty counts RouteStop полей;
- пустые/почти пустые `note`;
- Route без собственного cover;
- текущую целостность `RouteStopImage.mediaAssetId`;
- shared MediaAsset usage / fail-closed delete dependencies;
- внутренние ссылки внутри текущих DB body/contentJson.

### Отдельная GSC CSV

В git tree есть CSV-файлы, но отдельной выгрузки Google Search Console с URL + clicks/impressions не найдено. Поиск CSV, содержащих `clicks`, возвращает только `manifest.csv`.

Следовательно, невозможно честно построить множество **«URL есть в GSC, но нет в manifest»** и top-30 таких URL по кликам.

---

# A. Инвентаризация

## A1. Текущая БД

| Срез | Результат |
| --- | --- |
| Всего Route | **не удалось определить** — нет DB connection |
| По `Route.status` | **не удалось определить** |
| По `Route.visibility` | **не удалось определить** |
| По городам | **не удалось определить** |
| По годам публикации | **не удалось определить**; у `Route` нет `publishedAt` |
| Самый старый / свежий по публикации | **не удалось определить** |
| Editorial / UGC сейчас | **не удалось определить** |

`Route.createdAt` нельзя использовать как оригинальную дату публикации legacy WordPress материала: это техническая дата target record и она может отражать миграцию, а не первую публикацию.

## A2. Подтверждённый исторический срез 2026-07-28/29

| Метрика | Значение |
| --- | ---: |
| Legacy Route lineage | 14 |
| Publishable / reviewed | 13 |
| `PUBLISHED` после route closure | 13 |
| `CITY_BLOCKED` / kept `DRAFT` | 1 |
| Привязаны к target `cityId` Минска | 13 |
| Без разрешённого city (`marshrut-mogilev`) | 1 |
| Stops в 13 publishable Route | 86 |
| Stops в Mogilev | 4 |
| Stops всего | 90 |
| Legacy media refs в preview | 612 |
| Legacy relation refs в preview | 60 |
| Route с `ROUTE_LEVEL_LOCATION_DROPPED` | 10 |

Источники:

- `docs/migration/prelaunch-checklist.md` — `13/13 reviewed Routes PUBLISHED`, `1 CITY_BLOCKED kept DRAFT`;
- `docs/migration/reviews/route-apply-manifest-2026-07-28.md` — `13 non-Mogilev routes, 86 stops reviewed`;
- `docs/migration/reviews/route-review-2026-07-28.md` — Mogilev: 4 stop;
- `docs/migration/reviews/route-preview.json` — 14 candidates, `mediaRefCount`, `relationRefCount`, warnings.

### Target city context

В review 13 маршрутов имеют `cityId = cmqpohiye006dwss6idaw626x`; в других migration artifacts этот ID явно указан как `cityName: "Минск"`. `marshrut-mogilev` имел `cityId = null` и blocker `ROUTE_CITY_UNRESOLVED`.

| Target city | Кол-во legacy Route |
| --- | ---: |
| Минск | 13 |
| Не разрешён / Mogilev | 1 |

Это **не означает**, что география содержимого всех 13 — Минск. В legacy набор входят материалы про Нарочь, Браслав, Кобрин—Брест, Гомель, Санкт-Петербург и др. Для Article это критично, потому что `geoScope/cityId/regionId` влияет на canonical URL и discovery.

## A3. Старый editorial контент vs новый UGC

### Критерий

Основной детерминированный признак текущей Route-модели/рендера:

- `authorId === null` → editorial;
- `authorId !== null` → пользовательский Route / UGC.

Для legacy migration этот признак подтверждается дополнительными сигналами:

1. lineage `wordpress-db:routes:*`;
2. `authorId = null` во всех 14 review records;
3. содержательные многоабзацные `RouteStop.note`, а не пустые/короткие UGC-пункты;
4. множественные legacy media/relation refs;
5. происхождение через WordPress migration pipeline.

**Дата не используется как первичный классификатор**, потому что `Route` не хранит original `publishedAt`, а `createdAt` для мигрированных записей ненадёжен как дата публикации. Поле top-level description у Route также отсутствует; объём оценивается по сумме stop notes.

### Исторический результат

| Класс | Кол-во |
| --- | ---: |
| Старый редакционный WordPress content | 14 |
| Новый UGC в historical set | 0 |

Текущий UGC inventory после июля **не удалось определить** без DB SELECT.

---

# B. Статус URL по manifest / GSC, без сети

## B1. Manifest

`scripts/build-migration-manifest.ts` документирует, что `manifest.csv` строится из canonical targets, Article slug history и `scripts/data/wp-redirect-map.json`, причём WP map curated from GSC click data.

Формат:

```text
rule_type,old_url,new_url,entity_type,entity_id,notes
```

В `notes` у WP rows встречаются значения вида `12535 clicks`, `8807 clicks` и т.д. Поэтому manifest является пригодным offline source для **покрытых** URL, но не позволяет восстановить URL, которые были в GSC и не вошли в map.

## B2. Проверка 14 legacy Route slug

Каждый slug был отдельно проверен в `manifest.csv`. Совпадений нет.

| # | Legacy slug | Есть в manifest | Есть в отдельной GSC CSV вне manifest | Группа по доступным данным |
| ---: | --- | --- | --- | --- |
| 1 | `marshrut-po-drozdam-zhivopisno-i-razvlekatelno` | нет | не удалось определить | нет данных |
| 2 | `marshrut-kurosovshchina-zoologicheski-ekstremalnaya` | нет | не удалось определить | нет данных |
| 3 | `marshrut-majak-minska-krasivo-i-aktivno` | нет | не удалось определить | нет данных |
| 4 | `marshrut-narochanskij-zhivopisno-i-peshehodno` | нет | не удалось определить | нет данных |
| 5 | `chto-posmotret-turistu-za-2-dnya-v-kobrine-i-breste` | нет | не удалось определить | нет данных |
| 6 | `marshrut-malinovka` | нет | не удалось определить | нет данных |
| 7 | `marshrut-traktornyj-zavod` | нет | не удалось определить | нет данных |
| 8 | `marshrut-braslav-nomad-houses-chto-posmotret-v-braslave` | нет | не удалось определить | нет данных |
| 9 | `marshrut-shchorsy` | нет | не удалось определить | нет данных |
| 10 | `novogodniy-marshrut` | нет | не удалось определить | нет данных |
| 11 | `marshrut-mogilev` | нет | не удалось определить | нет данных |
| 12 | `5-mini-puteshestvij-na-1-den-nedaleko-ot-minska` | нет | не удалось определить | нет данных |
| 13 | `marshrut-na-avtodome-zoopark-vodopady-safari-gomel` | нет | не удалось определить | нет данных |
| 14 | `marshrut-po-piteru-kulturnaya-programma-na-2-sutok-bez-detej` | нет | не удалось определить | нет данных |

Итог:

| Группа | Кол-во |
| --- | ---: |
| Есть строка в redirect manifest | 0 |
| Есть в отдельной GSC CSV, но отсутствует в manifest | **не удалось определить** |
| Не встречается в доступных offline URL/GSC artifacts | 14 |

### Почему `0 в manifest` не доказывает потерю URL

Код сохраняет полноценный Route URL contract:

- `src/app/(public)/routes/page.tsx:13-19` — canonical global listing `/routes`;
- `src/app/(public)/routes/[slug]/page.tsx:69-128` — metadata/canonical detail Route;
- `src/app/(public)/routes/[slug]/page.tsx:145-251` — permanent slug-history redirect, Route JSON-LD, Breadcrumbs и `routePath = /routes/{slug}`;
- `src/app/sitemap.ts:264-288` — query публичных Route и включение их canonical URL в sitemap;
- `src/lib/seo/schema/buildRouteJsonLd.ts:8-35` — schema.org `ItemList` с `url = ${publicBase}/routes/${route.slug}`.

Следовательно, отсутствие redirect row совместимо с архитектурой «URL не менялся, поэтому redirect не нужен».

## B3. Top-30 по кликам среди непокрытых manifest

**Не удалось определить.**

Причина: отдельной GSC CSV с полным URL dimension нет. `manifest.csv` содержит клики только у уже включённых redirect rows, поэтому из него логически невозможно построить множество `GSC URL − manifest URL`.

Таблица top-30 намеренно не заполнена предположениями.

---

# C. Совместимость полей Route → Article

## C1. Top-level mapping

| Route | Article | Совместимость / замечание |
| --- | --- | --- |
| `id` | `id` | тип совместим, но reuse ID не требуется моделью и является отдельным migration decision |
| `slug` | `slug` | семантика отличается: Route slug global `@unique`; Article slug nullable и scoped через `cityId + slug` |
| `title` | `title` | прямая |
| `ageTags` | нет прямого поля | можно преобразовать в discovery tags/content; не 1:1 |
| `agePolicy` | нет прямого поля | нет 1:1 |
| `budgetLevel` | нет прямого поля | нет 1:1 |
| `cityId` | `cityId` | требует одновременно корректного `geoScope`; механическое CITY/Minsk для всех 13 некорректно |
| `coverImageUrl` | `heroImage` или `coverImageId` | Route хранит URL; Article имеет URL + MediaAsset FK; нужна политика |
| `authorId` | `authorUserId` | прямая по смыслу; legacy `null` = editorial |
| `status` | `status` | частично: `DRAFT/PUBLISHED` совпадают; `ARCHIVED` Route не имеет прямого аналога в `ContentStatus` |
| `visibility` | нет прямого поля | Article не имеет `PRIVATE/UNLISTED/PUBLIC`; `noindex` не эквивалент visibility |
| `createdAt` | `createdAt` | технически совместимо, но не original publication date |
| `updatedAt` | `updatedAt` | технически совместимо |
| `seoCanonicalUrl` | `seoCanonicalUrl` | прямая; при схеме (а) canonical должен остаться Route URL |
| `seoDescription` | `seoDescription` | прямая |
| `seoH1` | `seoH1` | прямая |
| `seoJsonLdOverride` | `seoJsonLdOverride` | поле есть, но тип/семантика schema.org Route vs Article различается |
| `seoOgDescription` | `seoOgDescription` | прямая |
| `seoOgImage` | `seoOgImage` | прямая |
| `seoOgTitle` | `seoOgTitle` | прямая |
| `seoRobots` | `seoRobots` | прямая |
| `seoTitle` | `seoTitle` | прямая |
| `slugUpdatedAt` | `slugUpdatedAt` | прямая |
| `seoCanonicalSource` | `seoCanonicalSource` | прямая |
| `slugHistory` | `ArticleSlugHistory` | требует преобразования; Article history city-scoped |
| `routeIdeas` | `ideas` | разные relation-модели; требуется repoint/migration |
| `ratings` | `ratings` | разные relation-модели; отдельное решение |
| `planItems` | `planItems` | relation есть у обеих сущностей, но требуется перенос FK/entity identity |
| `stops` | `contentJson` | нет first-class аналога; требуется структурное преобразование |
| — | `publishedAt` | у Route источника нет; нельзя подставлять `createdAt` без доказательства |
| — | `categoryId` | при Article migration нужно назначить ARTICLE-категорию «Путешествия» |
| — | `geoScope` | обязательное смысловое решение |
| — | `excerpt/subtitle` | прямого Route источника нет |

Schema: `prisma/schema.prisma:2671-2815`.

## C2. RouteStop поля без first-class места в Article

`RouteStop` (`prisma/schema.prisma:2891-2934`) содержит:

- `order`;
- `placeId`;
- `googlePlaceId`;
- `lat`, `lng`;
- `address`, `formattedAddress`, `addressComponents`;
- `customTitle`;
- `note`;
- `photoUrl`;
- `priceType`, `priceMin`, `priceMax`, `priceCurrency`, `priceNote`;
- `rawGooglePayload`;
- `detectedCountryCode`, `detectedCountryName`, `detectedCityName`, `detectedRegionName`;
- ordered `RouteStopImage[]`.

У `Article` нет first-class `ArticleStop/ArticlePoint`. Значит порядок точек, координаты, карта, Google Place binding, per-stop price/address/media должны либо:

1. сохраняться как структурированные Article blocks в `contentJson`, либо
2. быть сознательно отброшены как продуктовая семантика.

Это **не** прямой перенос колонок.

### Non-empty counts

Точные current counts по каждому RouteStop полю **не удалось определить** без DB SELECT.

Подтверждённый исторический срез:

| Данные | Значение |
| --- | ---: |
| RouteStop записей | 90 |
| Stop в 13 publishable Route | 86 |
| Route с legacy relation refs | 14/14 |
| Legacy relation refs | 60 |
| Route с legacy media refs | 14/14 |
| Legacy media refs | 612 |
| Route с route-level legacy location | 10/14 |

`mediaRefCount = 612` — это source migration references из preview, а не доказанное текущее число `RouteStopImage` rows.

## C3. Slug collisions Route ↔ Article

**Не удалось определить.**

Полный список коллизий требует актуального SELECT по `Route.slug` и `Article.slug` с учётом `Article.cityId/geoScope`. DB connection отсутствует.

Отсутствие 14 Route slug в `manifest.csv` не является доказательством отсутствия Article с такими slug в БД.

---

# D. Целостность контента

## D1. Пустое / почти пустое тело

У Route нет top-level body. Текст находится главным образом в `RouteStop.note`.

Текущий count пустых/почти пустых Route по суммарной длине stop notes **не удалось определить**.

Исторический review подтверждает:

- 13 publishable Route → 86 reviewed stop;
- Mogilev → ещё 4 stop;
- zero-stop legacy Route в этом наборе не зафиксировано;
- editorial review содержит содержательные многоабзацные notes и не фиксирует отдельный empty-content blocker.

Это подтверждает, что historical set не состоял из пустых карточек, но не заменяет current SELECT `length(trim(note))`.

## D2. Записи без обложки

Точный current count `Route.coverImageUrl IS NULL/blank` **не удалось определить**.

Публичный код использует fallback:

1. `Route.coverImageUrl`;
2. первый `RouteStop.photoUrl`;
3. внешний Unsplash fallback.

См. `src/app/(public)/routes/page.tsx:23-52` и `src/app/(public)/routes/[slug]/page.tsx:145-230`.

Поэтому наличие изображения на UI не доказывает наличие собственного cover.

## D3. MediaAsset / fail-closed delete gate

### Schema

- Route top-level cover — `coverImageUrl String?`, без FK на `MediaAsset`;
- `RouteStopImage.mediaAssetId` — nullable FK на `MediaAsset`, `onDelete: SetNull` (`prisma/schema.prisma:2937-2951`);
- generic reference model называется `MediaUsage` и содержит `mediaId/entityType/entityId/field`;
- `MediaEntityType` включает `ROUTE` и `ARTICLE`;
- Article cover — first-class `coverImageId -> MediaAsset`.

### Подтверждено

Historical preview: 612 legacy media refs across 14 Route; каждый Route имел минимум 23 source media refs.

### Не удалось определить

Без current DB нельзя посчитать:

- broken `RouteStopImage.mediaAssetId` links;
- сколько MediaAsset одновременно используется Route и другой сущностью;
- сколько assets подпадает под fail-closed delete gate;
- сколько legacy source refs реально материализовано в `RouteStopImage`.

**Следствие:** Route rows нельзя удалять как часть migration batch до отдельного read-only shared-media/reference audit.

## D4. Внутренние ссылки на старые Route URL

### DB body/content

Grep по `Article.contentJson`, `RouteStop.note` и другим body-полям current DB **не удалось выполнить** без DB connection.

### Код / компоненты

Подтверждено не менее 13 production/code anchors на Route routing. Exact total repo grep **не удалось определить**: GitHub connector возвращает broad code-search в усечённом виде, поэтому искусственный exact count не приводится.

| Файл | Строки / anchor | Привязка |
| --- | --- | --- |
| `src/app/(public)/routes/page.tsx` | 13–19 | canonical `/routes` |
| `src/app/(public)/routes/[slug]/page.tsx` | 69–128 | canonical detail `/routes/{slug}` |
| `src/app/(public)/routes/[slug]/page.tsx` | 145–251 | slug redirect, JSON-LD, breadcrumbs, routePath |
| `src/lib/seo/schema/buildRouteJsonLd.ts` | 8–35 | schema.org Route URL `/routes/{slug}` |
| `src/app/(public)/routes/[slug]/RouteDetailClient.tsx` | `href="/routes"` | backlink к listing |
| `src/components/routes/ShareSheet.tsx` | ``/routes/${route.slug}`` | share URL |
| `src/components/routes/RouteCard.tsx` | Route card href | detail link |
| `src/app/(public)/me/routes/components/RoutesGrid.tsx` | ``/routes/${route.slug}`` | user route link |
| `src/app/(public)/me/routes/components/RoutesHeader.tsx` | `/routes/new` | create flow |
| `src/app/(public)/me/routes/components/RoutesEmptyState.tsx` | `/routes/new` | create flow |
| `src/components/routes/RouteEditor.tsx` | ``router.push(`/routes/${slug}`)`` | post-save navigation |
| `src/app/admin/content/routes/page.tsx` | ``/routes/${route.slug}/edit`` | admin edit flow |
| `src/lib/seo/indexingPolicy.ts` | `ROUTE_EDITOR_PATTERN` | indexing/editor policy |

---

# E. Внешние точки привязки Route в коде

## E1. Public listing

`src/app/(public)/routes/page.tsx:13-19`

- title/description;
- canonical `/routes`.

`src/app/(public)/routes/page.tsx:23-52`

- `listPublicRoutes()`;
- cover fallback;
- `isEditorial = authorId === null`;
- stop mapping.

## E2. Detail, canonical, redirects, schema.org

`src/app/(public)/routes/[slug]/page.tsx:69-128`

- `findRouteBySlug`;
- `prisma.route.findUnique`;
- PUBLISHED/PUBLIC visibility logic;
- Route canonical resolver;
- fallback URL `${publicBase}/routes/${db.slug}`;
- robots для non-public Route.

`src/app/(public)/routes/[slug]/page.tsx:145-251`

- full Route/RouteStop read;
- `permanentRedirect(/routes/${db.slug})` для slug history;
- stop order/address/lat/lng rendering;
- `buildRouteJsonLd`;
- `routePath = /routes/{slug}`;
- BreadcrumbList содержит `/routes` и Route detail;
- analytics `entityType="ROUTE"`.

`src/lib/seo/schema/buildRouteJsonLd.ts:8-35`

- schema type: `ItemList`;
- `url = ${publicBase}/routes/${route.slug}`;
- `numberOfItems = route.stops.length`;
- ordered `ListItem` для stops.

## E3. City routes listing / filters

`src/app/(public)/[city]/routes/page.tsx:11-25`

- `buildCityRoutesListingMetadata(citySlug)`;
- `CityShell intent="routes"`;
- search params проходят в discovery shell.

`src/lib/discovery/discoveryIntentConfig.ts:59-68`

- id `routes`;
- label `Маршруты`;
- href `/{city}/routes`;
- `hasFilters: true`;
- `navigationEnabled: false`;
- `comingSoon: true`.

## E4. Central URL contract

`src/lib/routing/cityPaths.ts:15-25`

- `routes // /[city]/routes`;
- `route // /[city]/routes/[slug]`;
- `article // /[city]/blog/[slug]`.

`src/lib/routing/cityPaths.ts:80-120`

- `case "routes" -> /{city}/routes`;
- `case "route" -> /{city}/routes/{slug}`;
- `case "journal" -> /{city}/blog`;
- `case "article" -> /{city}/blog/{slug}`.

Route и Article имеют явно разные URL contracts.

## E5. Sitemap

`src/app/sitemap.ts:70-190`

- city `/routes` listing добавляется как отдельный sitemap entry.

`src/app/sitemap.ts:264-288`

- `prisma.route.findMany({ where: getPublicRouteIndexWhere() })`;
- каждый Route получает canonical через `resolveRouteCanonicalUrl`.

`src/app/sitemap.ts:290+`

- Articles строятся отдельным query/resolver.

Если удалить Route entity без compatibility layer, Route detail entries исчезнут из Route-ветки sitemap.

## E6. Menu / discovery / home

- `src/lib/discovery/discoveryIntentConfig.ts:59-68` — Route intent остаётся в общем discovery config;
- `src/features/city-home/components/CityHomeContentRows.tsx` — блок «Маршруты», CTA «Все маршруты»;
- primary navigation сейчас неактивна для Route (`navigationEnabled: false`, `comingSoon: true`), но это не отключает route, sitemap, canonical или внутренние ссылки.

## E7. Sharing / cards / profile / editor / admin

Route URL anchors подтверждены в:

- `src/components/routes/ShareSheet.tsx`;
- `src/components/routes/RouteCard.tsx`;
- `src/app/(public)/routes/[slug]/RouteDetailClient.tsx`;
- `src/app/(public)/me/routes/components/RoutesGrid.tsx`;
- `src/app/(public)/me/routes/components/RoutesHeader.tsx`;
- `src/app/(public)/me/routes/components/RoutesEmptyState.tsx`;
- `src/components/routes/RouteEditor.tsx`;
- `src/app/admin/content/routes/page.tsx`.

Следствие: «скопировать Route rows в Article и удалить Route» — **не data-only migration**. Без compatibility layer это изменение public routing, sitemap, sharing, JSON-LD, analytics и UGC route flow.

---

# 2. Полный historical legacy set

| WP source | Slug | Historical disposition |
| --- | --- | --- |
| `wordpress-db:routes:17822` | `marshrut-po-drozdam-zhivopisno-i-razvlekatelno` | publishable / published |
| `wordpress-db:routes:18437` | `marshrut-kurosovshchina-zoologicheski-ekstremalnaya` | publishable / published |
| `wordpress-db:routes:19413` | `marshrut-majak-minska-krasivo-i-aktivno` | publishable / published |
| `wordpress-db:routes:22133` | `marshrut-narochanskij-zhivopisno-i-peshehodno` | publishable / published |
| `wordpress-db:routes:24298` | `chto-posmotret-turistu-za-2-dnya-v-kobrine-i-breste` | publishable / published |
| `wordpress-db:routes:24917` | `marshrut-malinovka` | publishable / published |
| `wordpress-db:routes:25888` | `marshrut-traktornyj-zavod` | publishable / published |
| `wordpress-db:routes:29290` | `marshrut-braslav-nomad-houses-chto-posmotret-v-braslave` | published; 3 unparseable legacy-meta warnings |
| `wordpress-db:routes:32543` | `marshrut-shchorsy` | publishable / published |
| `wordpress-db:routes:34581` | `novogodniy-marshrut` | publishable / published |
| `wordpress-db:routes:46963` | `marshrut-mogilev` | `CITY_BLOCKED`, kept DRAFT |
| `wordpress-db:routes:47932` | `5-mini-puteshestvij-na-1-den-nedaleko-ot-minska` | publishable / published |
| `wordpress-db:routes:48687` | `marshrut-na-avtodome-zoopark-vodopady-safari-gomel` | publishable / published |
| `wordpress-db:routes:51442` | `marshrut-po-piteru-kulturnaya-programma-na-2-sutok-bez-detej` | publishable / published |

---

# 3. Что должен решить человек до миграции

1. **URL policy:** `/routes/{slug}` остаётся canonical навсегда или материал переходит на Article URL?
2. **Compatibility policy:** Route остаётся thin proxy/compatibility record или Route rows предполагается удалять?
3. **Категория:** подтвердить exact `EventCategory.id` категории «Путешествия» с `publicationType=ARTICLE` в target DB.
4. **GeoScope:** определить CITY / REGION / COUNTRY по содержимому, а не механически копировать legacy target `cityId=Минск`.
5. **Mogilev:** создавать/активировать город, делать REGION/COUNTRY Article или исключать из batch?
6. **RouteStop representation:** какой Article block является каноническим представлением одной точки?
7. **Карта:** должны ли `lat/lng/googlePlaceId/order` пережить перенос как machine-readable данные?
8. **Publication date:** откуда брать original `publishedAt`, если Route его не хранит?
9. **Media:** использовать `heroImage` URL или полноценный `coverImageId`; как переносить stop galleries?
10. **Relations:** что делать с RouteIdea, RouteRating, PlanItem, SearchDocument `entityType=route`?
11. **UGC:** пользовательские Route остаются отдельной сущностью? Если да, scope переноса должен быть только legacy editorial subset.
12. **Analytics identity:** сохранять `ROUTE` для старых URL или переключать на `ARTICLE`, и как обеспечить continuity метрик?

---

# 4. Вывод

1. По доступным офлайн-доказательствам применима схема **(а)**: старые публичные Route URL следует сохранить, а editorial content можно переводить на Article как внутренний source of truth/representation за тем же `/routes/{slug}`.
2. Для этой схемы число новых redirect rows: **N = 0** для 13 исторически опубликованных Route; `marshrut-mogilev` не должен автоматически публиковаться/редиректиться до решения по geography.
3. Схема (б) не подтверждена данными о потере URL: 14 slug отсутствуют в manifest, но отдельной GSC CSV нет, а code/historical closure подтверждают сохранённый Route URL contract и 13 published Route.
4. Если принудительно сменить URL 13 публичных Route на Article URL, потребуется **13** новых redirect rows; если после отдельного решения включить Mogilev — **14**.
5. Риск №1 — SEO/URL continuity: затрагиваются **13 исторически публичных Route URL**; удаление compatibility route создаст новую URL migration.
6. Риск №2 — потеря структуры: historical set содержит **90 RouteStop**, из них **86** в 13 publishable Route; у Article нет first-class point/coordinate/order model.
7. Риск №3 — media/geography/date semantics: preview содержит **612 legacy media refs**, **10/14** route-level location warnings, `Route` не хранит `publishedAt`, ещё **1** record остаётся city-blocked.
8. На уровне historical data gate **13 записей** выглядят пригодными к автоматизированному переносу при заранее определённом deterministic stop→`contentJson` mapping.
9. **1 запись — `marshrut-mogilev` — требует ручного решения** минимум по geography/publication scope.
10. Все **14** требуют продуктового контракта по преобразованию RouteStop/map, но это не означает 14 ручных data fixes: при едином block mapping 13 могут идти автоматически.
11. Current slug collisions, blank covers, shared MediaAsset gate и DB-body links остаются **не удалось определить** до появления read-only DB access.
12. До миграции нельзя удалять Route rows или выключать `/routes/{slug}`: зависимости охватывают canonical, sitemap, JSON-LD, breadcrumbs, sharing, cards, editor/profile и analytics.
13. Safe scope по имеющимся данным: **13 legacy editorial Route**, URL сохранить; UGC Route model/flow не затрагивать; Mogilev вынести в отдельное решение.

---

# 5. SQL / Prisma

## 5.1. Фактически выполненные SQL / Prisma-запросы

**Нет.**

Причина: в текущей среде отсутствует доступ к PostgreSQL проекта. Никаких SQL/Prisma запросов против БД не выполнялось. Все числовые DB-dependent поля, которые нельзя получить из committed audit artifacts, помечены «не удалось определить».

## 5.2. Read-only SELECT для закрытия оставшихся unknowns

Ниже — воспроизводимый список запросов, которые **не выполнялись** в этом аудите. Они предназначены для следующего read-only запуска при наличии DB access.

```sql
-- A. Inventory: status / visibility / city
SELECT r.status, r.visibility, r."cityId", c.name AS city_name, COUNT(*) AS cnt
FROM "Route" r
LEFT JOIN "City" c ON c.id = r."cityId"
GROUP BY r.status, r.visibility, r."cityId", c.name
ORDER BY cnt DESC;

-- A. createdAt range (это НЕ original publication date)
SELECT MIN("createdAt") AS oldest_created,
       MAX("createdAt") AS newest_created
FROM "Route";

-- A. editorial / UGC по действующему product rule
SELECT
  CASE WHEN "authorId" IS NULL THEN 'EDITORIAL' ELSE 'UGC' END AS class,
  COUNT(*) AS cnt
FROM "Route"
GROUP BY 1;

-- C. Полный список Route/Article slug collisions
SELECT
  r.id AS route_id,
  r.slug AS route_slug,
  r."cityId" AS route_city_id,
  a.id AS article_id,
  a.slug AS article_slug,
  a."cityId" AS article_city_id,
  a."geoScope" AS article_geo_scope,
  a.status AS article_status
FROM "Route" r
JOIN "Article" a ON a.slug = r.slug
ORDER BY r.slug, a."cityId" NULLS FIRST;

-- C. Non-empty counts RouteStop fields
SELECT
  COUNT(*) AS stop_count,
  COUNT(*) FILTER (WHERE "placeId" IS NOT NULL) AS place_id_count,
  COUNT(*) FILTER (WHERE "googlePlaceId" IS NOT NULL AND btrim("googlePlaceId") <> '') AS google_place_id_count,
  COUNT(*) FILTER (WHERE lat IS NOT NULL) AS lat_count,
  COUNT(*) FILTER (WHERE lng IS NOT NULL) AS lng_count,
  COUNT(*) FILTER (WHERE address IS NOT NULL AND btrim(address) <> '') AS address_count,
  COUNT(*) FILTER (WHERE "customTitle" IS NOT NULL AND btrim("customTitle") <> '') AS custom_title_count,
  COUNT(*) FILTER (WHERE btrim(note) <> '') AS nonempty_note_count,
  COUNT(*) FILTER (WHERE "photoUrl" IS NOT NULL AND btrim("photoUrl") <> '') AS photo_url_count,
  COUNT(*) FILTER (WHERE "priceMin" IS NOT NULL) AS price_min_count,
  COUNT(*) FILTER (WHERE "priceMax" IS NOT NULL) AS price_max_count,
  COUNT(*) FILTER (WHERE "priceNote" IS NOT NULL AND btrim("priceNote") <> '') AS price_note_count,
  COUNT(*) FILTER (WHERE "formattedAddress" IS NOT NULL AND btrim("formattedAddress") <> '') AS formatted_address_count,
  COUNT(*) FILTER (WHERE "addressComponents" IS NOT NULL) AS address_components_count,
  COUNT(*) FILTER (WHERE "rawGooglePayload" IS NOT NULL) AS raw_google_payload_count,
  COUNT(*) FILTER (WHERE "detectedCountryCode" IS NOT NULL) AS detected_country_code_count,
  COUNT(*) FILTER (WHERE "detectedCityName" IS NOT NULL) AS detected_city_name_count,
  COUNT(*) FILTER (WHERE "detectedRegionName" IS NOT NULL) AS detected_region_name_count
FROM "RouteStop";

-- D. Пустое / почти пустое содержимое Route
SELECT
  r.id,
  r.slug,
  r.title,
  COUNT(s.id) AS stop_count,
  COALESCE(SUM(length(btrim(s.note))), 0) AS body_chars
FROM "Route" r
LEFT JOIN "RouteStop" s ON s."routeId" = r.id
GROUP BY r.id, r.slug, r.title
HAVING COALESCE(SUM(length(btrim(s.note))), 0) < 100
ORDER BY body_chars ASC, r.slug;

-- D. Missing own cover
SELECT id, slug, title
FROM "Route"
WHERE "coverImageUrl" IS NULL OR btrim("coverImageUrl") = ''
ORDER BY slug;

-- D. Broken RouteStopImage -> MediaAsset refs
SELECT rsi.id, rsi."routeStopId", rsi."mediaAssetId"
FROM "RouteStopImage" rsi
LEFT JOIN "MediaAsset" ma ON ma.id = rsi."mediaAssetId"
WHERE rsi."mediaAssetId" IS NOT NULL
  AND ma.id IS NULL;

-- D. Route gallery assets reused by Article cover / SEO image or multiple RouteStopImage rows
WITH route_assets AS (
  SELECT DISTINCT "mediaAssetId" AS media_id
  FROM "RouteStopImage"
  WHERE "mediaAssetId" IS NOT NULL
)
SELECT
  ra.media_id,
  COUNT(DISTINCT rsi.id) AS route_stop_image_refs,
  COUNT(DISTINCT a_cover.id) AS article_cover_refs,
  COUNT(DISTINCT a_seo.id) AS article_seo_refs
FROM route_assets ra
LEFT JOIN "RouteStopImage" rsi ON rsi."mediaAssetId" = ra.media_id
LEFT JOIN "Article" a_cover ON a_cover."coverImageId" = ra.media_id
LEFT JOIN "Article" a_seo ON a_seo."seoImageId" = ra.media_id
GROUP BY ra.media_id
HAVING COUNT(DISTINCT rsi.id) > 1
    OR COUNT(DISTINCT a_cover.id) > 0
    OR COUNT(DISTINCT a_seo.id) > 0
ORDER BY route_stop_image_refs DESC, ra.media_id;

-- D. Generic MediaUsage for Route gallery assets
SELECT
  mu."mediaId",
  mu."entityType",
  mu."entityId",
  mu.field,
  COUNT(*) OVER (PARTITION BY mu."mediaId") AS refs_per_asset
FROM "MediaUsage" mu
WHERE mu."mediaId" IN (
  SELECT DISTINCT "mediaAssetId"
  FROM "RouteStopImage"
  WHERE "mediaAssetId" IS NOT NULL
)
ORDER BY refs_per_asset DESC, mu."mediaId", mu."entityType";

-- D. Article content containing Route URLs
SELECT id, slug, "cityId"
FROM "Article"
WHERE "contentJson"::text LIKE '%/routes/%'
ORDER BY slug;

-- D. RouteStop notes containing Route URLs
SELECT r.slug AS source_route_slug, s.id AS stop_id, s."order", s.note
FROM "RouteStop" s
JOIN "Route" r ON r.id = s."routeId"
WHERE s.note LIKE '%/routes/%'
ORDER BY r.slug, s."order";

-- Target category "Путешествия"
SELECT id, "nameRu", slug, "publicationType", "isActive", "archivedAt"
FROM "EventCategory"
WHERE "publicationType" = 'ARTICLE'
  AND (
    lower("nameRu") = lower('Путешествия')
    OR lower(slug) IN ('puteshestviya', 'travel')
  )
ORDER BY "archivedAt" NULLS FIRST, "isActive" DESC;
```

## 5.3. Prisma read equivalents, также НЕ выполнялись

```ts
await prisma.route.groupBy({
  by: ["status", "visibility", "cityId"],
  _count: { _all: true },
});

await prisma.route.findMany({
  select: {
    id: true,
    slug: true,
    title: true,
    cityId: true,
    authorId: true,
    status: true,
    visibility: true,
    createdAt: true,
    updatedAt: true,
    coverImageUrl: true,
    stops: {
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        placeId: true,
        googlePlaceId: true,
        lat: true,
        lng: true,
        address: true,
        customTitle: true,
        note: true,
        photoUrl: true,
        priceType: true,
        priceMin: true,
        priceMax: true,
        priceCurrency: true,
        priceNote: true,
        formattedAddress: true,
        addressComponents: true,
        rawGooglePayload: true,
        detectedCountryCode: true,
        detectedCountryName: true,
        detectedCityName: true,
        detectedRegionName: true,
        images: {
          select: { id: true, mediaAssetId: true, url: true, sortOrder: true },
        },
      },
    },
  },
  orderBy: { slug: "asc" },
});

await prisma.article.findMany({
  where: { slug: { in: routeSlugs } },
  select: {
    id: true,
    slug: true,
    cityId: true,
    geoScope: true,
    status: true,
    categoryId: true,
  },
});
```
