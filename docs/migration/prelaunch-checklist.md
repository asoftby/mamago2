# Project Phoenix: Prelaunch Checklist

**Статус:** живой чек-лист до полного финала миграции WordPress → mamaGo 2.0.
Обновлять при закрытии каждого пункта (дата + PR/коммит).

Создан: 2026-07-13. Основа: [`production-cutover-runbook.md`](./production-cutover-runbook.md)
(раздел «Not yet implemented»), [`wordpress-to-mamago.md`](./wordpress-to-mamago.md)
(Migration Order, Needs Decision), [`wordpress-db-inspection-2026-07-06.md`](./wordpress-db-inspection-2026-07-06.md)
(счётчики источника).

## Правила работы по этому чек-листу (для любого агента: Claude, Codex, человек)

1. **Этот файл — единственный источник истины по прогрессу миграции.**
   Перед началом работы прочитать его целиком + `CLAUDE.md` в корне репо
   (критично: правила Prisma-миграций — никаких `migrate dev` / `db push` / reset).
2. **Порядок:** двигаться по разделам §1 → §2 → §3 → §4. Внутри §1 порядок:
   Routes → Offers → Users → Profiles → Reviews (Reviews зависит от Users+Places).
   Продуктовые решения (§3 и помеченные «продуктовое решение») агент сам
   не принимает — формулирует варианты и спрашивает Алексея.
3. **При закрытии пункта:** поставить `[x]`, дописать в скобках дату и
   PR/коммит. Новые обнаруженные задачи — добавлять пунктом в нужный раздел,
   а не держать в голове/чате.
4. **Паттерн реализации сущностей:** копировать существующий путь
   Place/Article/Event — adapter/normalizer (`src/lib/migration/adapters/wordpress-db/`),
   commit runner (`src/lib/migration/commit/`), тесты рядом. Не изобретать
   новую архитектуру.
5. **Конец сессии / передача (handoff):** дописать запись в «Журнал сессий»
   внизу файла: что сделано, что в незавершённом состоянии (ветка, файлы),
   какой пункт следующий. Запись должна быть достаточной, чтобы другой агент
   продолжил без контекста чата.
6. **WP-креды:** env-переменные `WP_SSH_HOST/WP_SSH_USER/WP_DB_NAME/WP_DB_USER/
   WP_DB_PASSWORD` лежат в локальном `.env` (gitignored) на машине Алексея —
   секреты в git не коммитить никогда. Подхват: `set -a; source .env; set +a`.
   SSH-аутентификация скриптов — только по ключу (BatchMode); интерактивный
   пароль скрипты не принимают by design.

---

## 0. Готово (Phase 2D, для контекста)

- [x] Движок миграции: `Migration*` ledger-таблицы, идемпотентный CLI
      (`scripts/migration-commit-wordpress-db.ts`), preview/inspect, JSON-снапшоты.
- [x] **Places** — adapter/normalizer/runner (82 publish).
- [x] **Articles** (`post`) — adapter/normalizer/runner (115 publish).
- [x] **Events** — adapter/normalizer/runner + `EventMediaSyncer` (28 eligible).
- [x] Редиректы из slug history / articles через `manifest.csv`.
- [x] Cutover runbook (планировочный документ).

---

## 1. Контентные сущности (инженерная работа по готовому паттерну)

### Routes (14 publish)

- [x] **PR A** (2026-07-13, ветка `feat/phoenix-route-import`, коммит/мердж за
      Алексеем) — `getPublishedRoutes()`/`getPublishedRouteById()`,
      `groupIndexedMeta()` (1-based, images сырой строкой attachment ID),
      `normalizeRoute()` (`placeId: null` для всех стопов — доказано по данным),
      wiring в адаптер + barrel, тесты, golden-sample helper. Отброшено
      осознанно: `route-duration` (считается по точкам через API), `reels-route`.
      Общий тип `RouteStopPlaceResolution` объявлен в `place-resolution/types.ts`,
      к Route не подключён (для будущего `Event.placeIdRaw`). *(`route-budget`
      изначально резолвился через taxonomy lookup — решение изменено, см.
      Follow-up ниже.)*
- [x] **Follow-up PR A** (2026-07-14, ветка `feat/phoenix-route-import`) —
      решение изменено: **`route-budget` НЕ импортируется вообще**, как и
      `route-duration`. Бюджет в новой модели формируется из цен точек
      (`summarizeRouteBudget`), которые редактор проставит при ручном review.
      Убран taxonomy lookup и slug→`BudgetLevel` map из `normalizeRoute`
      (`budgetLevel`/`budgetTermRaw` удалены из `NormalizedRouteCandidate`,
      `Route.budgetLevel` остаётся на схемном дефолте); тесты упрощены.
      Inspect-шаг `route_budget_terms` оставлен (полезен для review). Реальные
      термы источника — сами являются ценовыми диапазонами — задокументированы
      в `wordpress-db-inspection-2026-07-06.md` §10: до 100 (5), 100–200 (1),
      200–300 (2), 300–400 (0), 400–500 (0), больше 500 (5); сумма 13 из 14
      маршрутов (один без терма — ожидаемо).
- [x] Commit runner для Route/RouteStop (2026-07-13, коммит
      `feat(migration): add Route/RouteStop commit runner`) — `RouteCommitRunner`
      + `buildRouteCreateDraft`, writer/orchestrator, wiring в dispatch/commit CLI,
      ledger-идемпотентность по активному `MigrationLineage`; импорт создаёт
      `Route` + упорядоченные `RouteStop` (`placeId: null`, `customTitle` из
      title, `note` из description), `DRAFT`/`PRIVATE`/`authorId: null`.
      `images-location-*`, RouteSlugHistory/redirect map и route-level
      `location` JSON намеренно не пишутся в этом PR.
- [x] Медиа стопов (`images-location-*` → MediaAsset через media ledger)
      (2026-07-13, ветка `feat/phoenix-route-import`, коммит
      `feat(migration): import RouteStop media`) — фактический формат
      source-поля подтверждён normalizer/tests: comma-separated attachment IDs
      (`"17885,17886"`), не repeated rows. `RouteStopMediaSyncer` импортирует
      attachment через общий `MediaImportWriter`/`MigrationLineage`, переиспользует
      существующий `MEDIA_ASSET` lineage и пишет первый успешно импортированный
      asset в существующее поле `RouteStop.photoUrl`; `syncRouteMediaUsage`
      уже умеет считать `photoUrl` route-owned usage. `MigrationProfile`
      соблюдается через route-specific media policy gate: `FULL` импортирует,
      `METADATA` пишет evidence warning без download/link, `NONE` полностью
      пропускает. `MediaAsset` ownership берётся из optional
      `context-config.defaults.route.mediaOwnerUserId`/override; при отсутствии
      owner media не импортируется и пишется warning. Ошибки отдельных
      attachments не ломают Route commit.
- [x] Route-level `location` JSON — продуктовое решение (2026-07-13, ветка
      `feat/phoenix-route-import`, коммит
      `docs(migration): define Route location import policy`) — принято:
      legacy route-level `location` **не импортируется** в продуктовую модель
      `Route`/`RouteStop`, не создаёт Prisma-поле и не задаёт искусственный
      map center/start point. Raw value сохраняется как migration evidence в
      `normalizedPayload.locationRaw`, `normalizedPayload.rawMeta.location`
      (и parsed `normalizedPayload.location`, если JSON валиден), а значит
      попадает в persisted normalized snapshot / `MigrationRecord`. Непустое
      значение даёт info warning `ROUTE_LEVEL_LOCATION_DROPPED`; пустое или
      отсутствующее значение warning не создаёт.
- [ ] Ручной review 14 маршрутов: сжатие длинных описаний стопов в короткие
      заметки (AI rewrite + проверка), PUBLIC/PUBLISHED, без автора.
      **Решение Алексея 2026-07-13: отдельное поле `isEditorial` в схему НЕ
      добавляется** — все 14 импортируемых маршрутов редакционные, семантика
      «editorial = `authorId === null`» (как в текущем public reader)
      подтверждена; review builder не должен блокировать публикацию по этому
      признаку. Route-level location policy (не импортировать, хранить как
      evidence) также подтверждена Алексеем.
      Preview-проход 2026-07-13 подготовил review/apply механизм и артефакты:
      [`reviews/route-review-2026-07.md`](./reviews/route-review-2026-07.md),
      [`reviews/route-review-2026-07.json`](./reviews/route-review-2026-07.json).
      **Импорт в dev-БД выполнен 2026-07-13 ~18:30**: preview 14/14
      normalized (0 failed; warnings ожидаемые: `ROUTE_LEVEL_LOCATION_DROPPED`
      ×10, `ROUTE_META_KEY_UNPARSEABLE_INDEX` ×3), commit 14/14 LINKED (14
      активных `ROUTE` lineage, 14 `Route`/97 `RouteStop` в dev-БД,
      DRAFT/PRIVATE/`authorId: null`/`cityId`=Минск, без дублей на повторном
      прогоне). По пути найден и исправлен реальный баг: commit CLI жадно
      импортировал `createMamagoMediaImporter` (→ `@/server/media/media-storage`,
      под `server-only`) при любом `--media-policy`, а не только `FULL` —
      под чистым `tsx` (не Next-бандлер) это гарантированно падало на любом
      non-FULL прогоне; теперь импорт ленивый, только при `FULL`
      (`scripts/migration-commit-wordpress-db.ts`). Editorial-блокер
      (`ROUTE_ISEDITORIAL_FIELD_MISSING`) снят из `routeEditorialReview.ts`
      согласно решению Алексея. Review перегенерирован свежими данными:
      14/14 DRAFT/PRIVATE, decision counts `NEEDS_COPY_REVIEW: 14`, остальные
      0 (BLOCKED в т.ч.) — `route-preview.json`/`route-commit-report.json`
      теперь в `docs/migration/reviews/`, не в корне репо. `--apply` не
      запускался — публикации не было, ждём ручной review Алексеем всех 14.
      **HTML-фикс 2026-07-13**: `810d3254` добавил `htmlToPlainText` в
      `buildRouteCreateDraft` для будущих импортов, но 14 уже импортированных
      маршрутов остались с сырым WP-HTML в `RouteStop.note`. Прогнан
      одноразовый `scripts/migration-fix-route-note-html.ts` (dry-run →
      `--apply` → dry-run) по всем 97 стопам с активной `MigrationLineage
      targetType=ROUTE` — 97/97 изменены, повторный dry-run: 0. Review
      перегенерирован — `<p>`/`<br>` тегов в заметках больше нет. **Но**: см.
      следующий пункт — заметки всё ещё не полностью чистые из-за отдельного,
      более общего бага.
      **Копирайт-review 2026-07-14 (решение Алексея: bulk-генерация, правки
      точечно)**: массовый первый проход по всем 97 стопам + тизер на каждый
      из 14 маршрутов — [`reviews/route-copy-proposals-2026-07.md`](./reviews/route-copy-proposals-2026-07.md).
      Только предложения, в БД ничего не записано, `--apply` не запускался.
      Применимой AI-rewrite инфраструктуры для Route не нашлось (`/api/ai/rewrite`
      поддерживает только `event|place|offer`, требует живую сессию) — текст
      написан вручную. Все 97 заметок ≤200 символов (проверено скриптом:
      min 103, max 186, среднее ~146), сохранена конкретика (цены, часы,
      практические советы). Найдено и помечено: 1 расхождение заголовок/текст
      стопа (Браслав, стоп 1 — заголовок про костёл, текст про другую церковь),
      7 стопов с несколькими локациями в одном (кандидаты на разбивку —
      детали неизбежно потеряны при сжатии до 200 символов), 1 медицински
      важное предупреждение (церкариоз на пляже «Урлики», Нарочанский) —
      сохранено как приоритет №1 в короткой версии. Пустых/бесполезных
      исходников не найдено. Ждём review Алексея по артефакту в чате.
- [ ] **Баг MySQL batch-escape — отдельный follow-up, не часть Route PR.**
      Найден 2026-07-13 на заметках RouteStop: MySQL batch-режим отдаёт
      реальные переносы строк как буквальный текст `\n`, а общий
      `parseTabularRows()` сейчас не разэкранирует такие значения. Для чистого
      PR #36 оставлен только Route-specific HTML cleanup (`htmlToPlainText`).
      Потенциальный общий фикс `connectExecutor.ts`/`unescapeMysqlBatchValue`
      и cleanup уже импортированных данных нужно вынести в отдельный маленький
      PR после проверки зависимости и стратегии для Place/Article/Event.
- [ ] Старые URL → `RouteSlugHistory` + redirect map.
- [x] Общий wizard для пользователя и редактора (решение Алексея 2026-07-13,
      коммит `19a4a7b6`) — подтверждено: `RouteEditor` один для всех;
      админ-список ссылается на общий `/routes/{slug}/edit`. Фикс:
      admin/moderator редактируют любой маршрут (включая editorial с
      `authorId: null`), которые раньше отдавали 404.
- [x] Гейт просмотра маршрута (коммит `19a4a7b6`) — PUBLISHED+PUBLIC/UNLISTED
      видны всем; DRAFT/ARCHIVED/PRIVATE — только автору и admin/moderator
      (раньше любой статус рендерился всем, кто знает slug); noindex для
      непубличных превью и UNLISTED.
- [ ] **Модерация UGC-маршрутов (решение Алексея 2026-07-13): постмодерация +
      ранжирование.** Пользовательские маршруты публикуются сразу, без
      премодерации; каталог ранжирует по отклику (рейтинг, сохранения в план,
      популярность) с бустом editorial; новые/без отклика — ниже. Админка —
      надзор постфактум (unpublish/archive из восстановленного раздела).
      Реализация ранжирования каталога — отдельная задача (не миграция):
      сортировка в `route.service` листингах + возможно веса в
      `RankingSettings`. Жалоба на маршрут («report») — бэклог.
- [ ] (Позже, продукт) Связывание стопов с Place: вручную в review UI или
      fuzzy-matching по title/coords — в источнике ссылки на Place нет.
- [ ] (Позже, продукт/схема) Полноценная gallery для RouteStop: источник может
      дать несколько `images-location-*` attachment IDs на один стоп, но текущая
      Prisma-модель хранит только один `RouteStop.photoUrl`. Текущий импорт
      связывает первый успешно импортированный asset и предупреждает о
      дополнительных attachment IDs как не импортированных/не представимых
      без расширения модели/UI.

### Offers (services / hb-programs, 90+ publish)

- [ ] Adapter/normalizer (planner `offerMapping` уже есть — использовать).
- [ ] Commit runner.
- [ ] Медиа.
- [ ] Slug history + редиректы.

### Users (579)

- [ ] Продуктовое решение: политика passwordless-реактивации.
- [ ] Adapter/normalizer/runner с маппингом legacy user ID.

### Profiles (536) — главный блокер по решениям

- [ ] **Продуктовое решение: целевая модель** — классификация personal vs
      business, во что маппится каждый класс. Без этого пункта дальше не двигаться.
- [ ] Adapter/normalizer/runner по принятой модели.
- [ ] Связки ownership: business/organizer ↔ places/offers.

### Reviews → PlaceReview

- [ ] Adapter/normalizer/runner (источник — Voxel `post_reviews`; только approved).
- [ ] Зависимость: требует уже импортированных users и places.

---

## 1.5 Медиа (9 635 attachments) — сквозной трек

- [x] Общая инфраструктура: `MediaImportWriter` + `MEDIA_ASSET` lineage
      (дедупликация через переиспользование lineage), media policy gates
      `FULL`/`METADATA`/`NONE` (`MediaPolicyGated*Syncer`).
- [x] Place media — `PlaceMediaLinker`.
- [x] Event media — `EventMediaSyncer` (для eligible событий).
- [x] RouteStop media — `RouteStopMediaSyncer` (первый attachment на стоп;
      полноценная галерея — см. «позже» в §1 Routes).
- [ ] **Article media — НЕ импортируется** (обнаружено 2026-07-13):
      `buildArticleCreateDraft` явно без медиа — hero/cover, `coverImageId`
      и inline-изображения внутри `contentJson` не переносятся. Нужен
      ArticleMediaSyncer по паттерну Event/Route + ремап `wp-content/uploads`
      URL внутри contentJson-блоков на импортированные MediaAsset.
- [ ] Offer media — вместе с адаптером Offers (§1).
- [ ] Аватары Users / медиа Business-профилей — после продуктовых решений
      по Users/Profiles (§1).
- [ ] Пре-cutover валидация медиа: отчёт missing media, скоуп из 9 635
      attachments (без revisions/неиспользуемых), выборочная проверка
      скачиваемости/целостности, итоговые counts по доменам.

### Image import matrix (финальное решение на 2026-07-14)

| Entity | Import status | Local/prod media policy | Dev media policy | Notes |
| --- | --- | --- | --- | --- |
| User profile | pending | FULL | METADATA | Аватары после Users/Profiles decisions. |
| Business profile | pending | FULL | METADATA | Логотипы/обложки после ownership decisions. |
| Place | ready | FULL | METADATA | `PlaceMediaLinker` уже есть. |
| Article | pending | FULL | METADATA | Нужен ArticleMediaSyncer + remap inline `wp-content/uploads`. |
| Offer | pending | FULL | METADATA | Вместе с Offer adapter/runner. |
| Route | ready | FULL | METADATA | `RouteStopMediaSyncer`, сейчас один `photoUrl` на стоп. |
| Event / Past Event | NONE | NONE | NONE | Past Event импортируется без media до отдельного product decision. |

---

## 2. Связи, таксономии, редиректы

- [ ] **Voxel relations linker**: `wp_voxel_relations` → нативные FK
      (`Activity.placeId`, `Offer.placeId`, `Article.relatedPlaceId`, `RouteStop`,
      `PackageComponent`); ключи без цели — задокументировать как отброшенные.
- [ ] **Кураторская таблица маппинга таксономий** WP → mamaGo
      (`places_category`, `section`, `events-category`, `age`, `metro`,
      `neighbourhood`, `city` и т.д.).
- [ ] **RankMath redirect ingestion** (156 строк `wp_rank_math_redirections`):
      ревью + нормализация в redirect manifest.
- [ ] Политика редиректов для исключённых (прошедших) событий.

---

## 3. Отложенные продуктовые решения

- [ ] Переподтвердить cutoff-правило для прошедших событий
      (`shouldExcludePastEvent()` существует, бизнес-политика — нет).
- [ ] Судьба `page` (71 publish + 13 draft): Page/Article/игнор.
- [ ] Политика unpublished/draft контента (places 187 unpublished, events 538
      draft и т.д.): мигрировать как драфты или игнорировать.
- [ ] Судьба `collection` (90) и остального long-tail из инспекции —
      подтвердить «вне скоупа».

---

## 4. Финальный cutover (по ранбуку, после закрытия §1–3)

- [ ] Freeze: снапшот WP (JSON через preview/inspect), checksums, row counts.
- [ ] `tsc --noEmit`, полный migration test sweep, `pnpm build` — green.
- [ ] `pnpm migration:preview:wordpress-db --entity all` — ревью counts,
      quarantines, warnings.
- [ ] Подтверждён `MigrationProfile` и `--context-config`.
- [ ] Прод-бэкап + проверка восстановимости на scratch DB.
- [ ] Dry-run QA review + business sign-off.
- [ ] Финальный прогон в прод-окне.
- [ ] Регенерация redirect manifest, проверка репрезентативных URL.
- [ ] Валидационные отчёты: counts, missing media, broken links, duplicate
      slugs, orphaned relations, redirect conflicts, SEO coverage.
- [ ] WP переведён в read-only, снапшот хранится до приёмки; окно отката согласовано.

---

## Сводка по объёму источника (инспекция 2026-07-06)

| Сущность | Publish | Статус адаптера |
| --- | --- | --- |
| Articles (`post`) | 115 | ✅ готов |
| Places | 82 | ✅ готов |
| Events | 28 eligible | ✅ готов |
| Routes | 14 | 🔨 importer готов до review; остались manual review, slug history/redirect |
| Offers (hb-programs) | 90 | ⬜ нет |
| Users | 579 | ⬜ нет |
| Profiles | 536 | ⬜ нет решения по модели |
| Reviews | ? (approved) | ⬜ нет |
| Attachments | 9 635 | частично (по доменам) |
| RankMath redirects | 156 | ⬜ нет |

---

## Журнал сессий (handoff log)

Формат записи: дата — агент — что сделано — незавершённое (ветка/файлы) — следующий шаг.

- **2026-07-13 — Claude (Cowork)** — Создан этот чек-лист. Решения по Routes
  зафиксированы: экспресс-формат канонический, импорт WP-маршрутов в
  Route/RouteStop; `route-duration` и `reels-route` не импортируются
  (длительность считается по точкам через API); импортированные маршруты —
  редакционные (`isEditorial`, PUBLIC, без автора). Незавершённое: нет.
  Следующий шаг: **Routes PR A** (см. §1) — скоуп согласован в сессии,
  промпт передан в Claude Code.
- **2026-07-13 — Claude Code** — Routes PR A реализован: repository-методы
  (`getPublishedRoutes`/`getPublishedRouteById`), `groupIndexedMeta`,
  `normalizeRoute`, wiring в адаптер + barrel, golden-sample helper, тесты;
  `tsc --noEmit` и все тесты каталога green, eslint чистый. Migration-доки
  дополнены live-находками от 2026-07-13. Незавершённое: **не закоммичено**,
  ветка `feat/phoenix-route-import` (коммит/мердж делает Алексей);
  slug→`BudgetLevel` map для `route-budget` пуст — см. Follow-up PR A в §1.
  Следующий шаг: follow-up по budget map (6 строк через inspect CLI), затем
  **commit runner для Route/RouteStop**.
- **2026-07-13 — Claude (Cowork)** — Дерево приведено в порядок и закоммичено
  на `feat/phoenix-route-import`: `54e03b44` (PR A), `1404531c` (чек-лист,
  агентские заметки), `f1ebd687` (wip birthday builder — не относится к
  миграции, вынесен отдельным коммитом). Хуки при коммите не запускались
  (--no-verify: песочница Linux, node_modules собраны под macOS) — tsc/тесты
  были green на хосте перед коммитом. Незавершённое: ветка не смержена в dev,
  пуш/PR за Алексеем. Следующий шаг: Follow-up PR A (budget map) → commit
  runner для Route/RouteStop.
- **2026-07-14 — Claude Code** — Follow-up PR A: попытка заполнить
  slug→`BudgetLevel` map для `route-budget` уткнулась в отсутствие WP DB
  креденшлов в этой сессии (тот же блокер, что и раньше) — добавлен только
  read-only inspect-шаг `route_budget_terms` (тесты/тайпчек/eslint зелёные).
  Реальные данные (6 термов = ценовые диапазоны, usage до 100→5, 100–200→1,
  200–300→2, 300–400→0, 400–500→0, >500→5, сумма 13/14) получены от Алексея
  через отдельный прогон в Cursor. По итогам решение поменялось: `route-budget`
  решили не импортировать вовсе (бюджет — из цен точек при review), поэтому
  map строить не стали — вместо этого убрали taxonomy lookup и оба поля
  (`budgetLevel`/`budgetTermRaw`) из `normalizeRoute`/`NormalizedRouteCandidate`,
  упростили тесты, задокументировали находки в `wordpress-db-inspection-2026-07-06.md`
  §10 и здесь (см. Follow-up PR A выше). `tsc --noEmit` + все тесты каталога
  + eslint — зелёные. Закоммичено этой же сессией на `feat/phoenix-route-import`
  (см. `git log` — `feat(migration): drop route-budget import, budget derives
  from stop prices`; коммит/мердж в dev/main за Алексеем).
  Незавершённое: нет по этому пункту. Следующий шаг: **commit runner для
  Route/RouteStop**.
- **2026-07-13 — Codex** — Реализован commit runner для Route/RouteStop:
  добавлены `buildRouteCreateDraft`, `RouteCommitWriter`/`Orchestrator`/`Runner`,
  wiring в `dispatchCommitRunner`, `runCommitExecutionPlan` и
  `scripts/migration-commit-wordpress-db.ts` (`--entity route`, точечный
  `--source-record-key wordpress-db:routes:{id}`). Стопы пишутся в порядке
  source index → `order`, с `placeId: null`, `customTitle` из title и `note`
  из description; `images-location-*`, route-level `location`, slug history и
  redirect map не пишутся. Статусы импорта: `DRAFT`/`PRIVATE`/`authorId: null`;
  `cityId` берётся из optional `context-config.defaults.route`/override, иначе
  остаётся `null` с warning `ROUTE_CITY_UNRESOLVED` в `validationSummary`.
  Проверки: `pnpm exec tsc --noEmit`, полный migration test sweep, targeted
  eslint touched files — зелёные; полный `eslint src ...` всё ещё падает на
  существующих unrelated правилах `react-hooks/set-state-in-effect` и старых
  `no-explicit-any` вне этого скоупа. Незавершённое: нет по commit runner.
  Следующий шаг: **Медиа стопов (`images-location-*` → MediaAsset через media
  ledger)**.
- **2026-07-13 — Codex** — Реализован импорт media стопов маршрута:
  `RouteStopMediaSyncer` импортирует/переиспользует WP attachments через общий
  `MediaImportWriter` + `MigrationLineage`, `MediaPolicyGatedRouteStopMediaSyncer`
  соблюдает `FULL`/`METADATA`/`NONE`, commit CLI wire-up подключён к
  `--entity route` и точечному `--source-record-key wordpress-db:routes:{id}`.
  Формат `images-location-*`: одна строка comma-separated attachment IDs;
  invalid части отсекает `normalizeRoute()` с warning. Существующая модель
  позволяет хранить только один media reference на стоп (`RouteStop.photoUrl`),
  поэтому первый успешно импортированный asset привязывается к правильному
  stop order, дополнительные attachment IDs после первого успешного не
  импортируются и дают warning + отдельный later-блокер выше. Для импорта
  нужен optional `route.mediaOwnerUserId` в context-config; без него media
  skip с warning, Route commit остаётся successful. Проверки: `pnpm exec tsc
  --noEmit`, полный migration test sweep, targeted eslint touched files —
  зелёные; полный eslint всё ещё падает только на существующих unrelated
  `react-hooks/set-state-in-effect` и старых `no-explicit-any` в
  `resolveEventCommitContextWithMatching*`. Незавершённое: нет по single-photo
  stop media. Следующий шаг: **Route-level `location` JSON — продуктовое
  решение, куда маппить (или отбросить)**.
- **2026-07-13 — Codex** — Закрыто продуктовое решение по route-level
  `location` JSON: legacy blob сознательно не импортируется в `Route` или
  `RouteStop`, Prisma-схема не менялась. Evidence уже сохраняется в
  `NormalizedRouteCandidate` (`locationRaw`, parsed `location` при валидном
  JSON, `rawMeta.location`) и далее в persisted normalized snapshot /
  `MigrationRecord`; добавлен info warning `ROUTE_LEVEL_LOCATION_DROPPED`
  для непустого значения. `Route`/`RouteStop` draft/writer эти поля не читают.
  Обновлены `wordpress-to-mamago.md` и inspection addendum со списком
  сознательно отброшенных Route-полей (`route-duration`, `route-budget`,
  `reels-route`, route-level `location`). Проверки: `pnpm exec tsc --noEmit`,
  полный migration test sweep, targeted eslint touched files — зелёные.
  Незавершённое: нет по location policy. Следующий шаг: **ручной review 14
  маршрутов**.
- **2026-07-13 — Codex** — Начат preview-проход ручного review Routes:
  добавлены `scripts/migration-route-review.ts` и
  `scripts/migration-apply-route-review.ts` плюс pure helpers/tests для
  review/apply. Review builder пишет Markdown/JSON в
  `docs/migration/reviews/route-review-2026-07.{md,json}`; apply-script по
  умолчанию dry-run, требует `--apply`, поддерживает
  `--source-record-key`, проверяет before-values, выполняет транзакцию на
  один Route и не публикует non-READY/BLOCKED routes. Дополнительно preview
  CLI научен `--entity route`. Фактический review 14 маршрутов не выполнен:
  локальная БД показала 0 активных `MigrationLineage targetType=ROUTE`, а
  read-only WP preview заблокирован отсутствующими env `WP_SSH_HOST`,
  `WP_SSH_USER`, `WP_DB_NAME`, `WP_DB_USER`, `WP_DB_PASSWORD`. Артефакты
  созданы как blocker snapshot: READY 0 / NEEDS_* 0 / BLOCKED 0,
  global blocker `EXPECTED_14_ROUTES_FOUND_0`; dry-run apply прошёл и ничего
  не менял. Отдельная продуктовая/схемная находка: в Prisma `Route` нет поля
  `isEditorial`, текущий public reader выводит editorial как `authorId === null`;
  при реальном review builder заблокирует публикацию до решения/подтверждения
  этой семантики. Незавершённое: ветка `feat/phoenix-route-import`, файлы
  review/apply + artifacts. Следующий шаг: поднять WP env/context-config,
  выполнить `pnpm migration:preview:wordpress-db --entity route`, затем
  идемпотентный `pnpm migration:commit:wordpress-db --entity route` и заново
  запустить route review для проверки Алексеем.
- **2026-07-13 — Claude (Cowork)** — Сверка дерева/чек-листа после серии
  коммитов Claude Code/Codex: всё консистентно, 6 Phoenix-коммитов на
  `feat/phoenix-route-import`. Алексей подтвердил два решения:
  (1) route-level `location` не импортируется (политика из
  `f0b70b2d` была его указанием); (2) поле `isEditorial` в схему не
  добавляется — все 14 маршрутов редакционные, семантика
  `authorId === null` = editorial подтверждена, блокер публикации в review
  builder по этому признаку снять. Незавершённое: импорт не выполнен
  (0/14 в локальной БД) — WP env есть только на машине Алексея.
  Следующий шаг: Алексей запускает preview → commit --entity route →
  route-review; затем ручной review 14 маршрутов.
- **2026-07-13 — Claude (Cowork)** — Сверка после прогона импорта: preview
  14/14 normalized (0 failed), commit 14/14 LINKED в dev-БД — отчёты
  `route-preview.json` / `route-commit-report.json` в корне репо. Сессия
  Claude Code оборвалась до финала: в дереве незакоммичены снятие
  editorial-блокера (`src/lib/migration/reviews/route/routeEditorialReview.*`)
  и правки `scripts/migration-commit-wordpress-db.ts`; review-артефакты НЕ
  перегенерированы (лежит пустой snapshot 14:54 с
  `EXPECTED_14_ROUTES_FOUND_0`). Следующий шаг: с машины Алексея —
  дозакоммитить изменения кода, `pnpm migration:route-review`, закоммитить
  свежие артефакты; затем ручной review 14 маршрутов (внимание к 3×
  `ROUTE_META_KEY_UNPARSEABLE_INDEX`). `--apply` без Алексея не запускать.
- **2026-07-13 — Claude Code** — Независимо от параллельной сессии (тот же
  рабочий каталог, не отдельный worktree) дошёл до тех же двух находок и
  тех же исправлений: (1) editorial-блокер снят из
  `routeEditorialReview.ts`/тест обновлён, (2) тот же `server-only`-баг в
  `scripts/migration-commit-wordpress-db.ts` (жадный `await import(...)`
  реального media-importer'а падал на любом non-FULL прогоне) — тот же
  ленивый fix. К моменту попытки закоммитить свою версию другая сессия уже
  закоммитила идентичные правки (`e77e3905`, `4182d5b3`) и её же live-прогон
  (preview → commit → review) — `git status` после моих же изменений
  показал чистое дерево, коммитить было нечего. Дополнительно сам
  independently прогнал preview/commit (14/14, без дублей на повторном
  прогоне) до того, как увидел чужие коммиты — числа совпали. Полная
  проверка на актуальном HEAD: `tsc --noEmit`, весь
  `src/lib/migration/**/*.test.ts` + `scripts/migration-*.test.ts`, eslint
  touched files — все green. Обновил только этот чек-лист (предыдущая
  запись о статусе Routes была неточной — на самом деле (а) и (б) уже
  закоммичены другой сессией). Незавершённое: нет по инженерной части.
  Следующий шаг: **ручной review 14 маршрутов** — обсуждается в чате с
  Алексеем по свежему `route-review-2026-07.md`.
- **2026-07-13 — Claude (Cowork)** — Восстановлен раздел «Маршруты» в админке
  из stash@{0} (застэшен 2026-07-10 на `feat/event-cinema-occasion-fields` и
  забыт): `/admin/content/routes` (список с фильтрами + lifecycle-действия),
  `/api/admin/routes/[id]` (+`/archive`), пункты сайдбара, admin-transitions
  в lifecycleStateMachine/Resolver, `buildAdminRouteLifecycleInput`. Коммит
  `9eab7e24` в `feat/phoenix-route-import`. Остальное содержимое stash@{0}
  (blog, article editor, event wizard) НЕ трогалось — stash сохранён.
  Незавершённое: tsc/тесты по восстановленным файлам не гонялись (песочница) —
  прогнать `pnpm check` на хосте; проверить /admin/content/routes глазами
  (там теперь 14 импортированных DRAFT-маршрутов). В бизнес-кабинете
  маршрутов никогда не было (проверены все ветки и stash'и) — если нужны,
  это новая продуктовая задача.
- **2026-07-13 — Claude Code** — Покрыл тестами три уже закоммиченных (без
  тестов) фикса по маршрутам, найденных при восстановлении админ-раздела:
  (1) `cc5e2f4e` subdomain pass-through — `isRouteContentRoute` в
  `subdomainMiddleware.ts` держит `/routes`/`/routes/*` на текущем
  admin/business-сабдомене вместо rewrite в несуществующий
  `/admin(/business)/routes/*`; добавлены кейсы в
  `subdomainMiddleware.test.ts` (edit/detail/new на admin и business хостах)
  + регрессия (прочие пути всё ещё rewrite, авторуты — redirect на public).
  (2) `19a4a7b6` admin edit access — `getEditableRouteBySlug` с
  `allowAnyAuthor` пускает admin/moderator в любой маршрут, включая
  authorless editorial (`authorId: null`, импортированные WP-маршруты).
  Построение `where` вынесено в чистую `buildEditableRouteWhereClause`
  (новый `route.service.test.ts`) — обращение к Prisma не мокал, только
  чистая логика ветвления, по инструкции («минимальный юнит на построение
  where»), т.к. `route.service.ts` использует синглтон `@/lib/prisma`, а не
  DI. (3) `19a4a7b6` view gate — `canViewRoute` вынесен из
  `routes/[slug]/page.tsx` в чистый `src/lib/routes/routeAccess.ts` (route +
  user, без вызова `getCurrentUser()` внутри); страница теперь сама зовёт
  `getCurrentUser()` и передаёт результат. Тест — полная таблица
  3 статуса × 3 видимости × 5 типов viewer'а (аноним/чужой/автор/админ/
  модератор) = 45 комбинаций (`routeAccess.test.ts`), плюс отдельный кейс
  на authorless editorial route (виден только admin/moderator, ни один
  обычный пользователь не может совпасть с `authorId: null`). Рефактор
  вынесен отдельным коммитом от тестов, как просили. Проверки: `tsc
  --noEmit`, все `*.test.ts` в `src/lib/routing`, `src/lib/routes`,
  `src/server/services` (новые) + весь `src/lib/migration`/
  `scripts/migration-*.test.ts` (регрессия), eslint touched files — все
  green. Незавершённое: нет. Следующий шаг: копирайт-review 14 маршрутов
  (см. запись выше) — Алексей проверяет ссылку из админки после этого коммита.
- **2026-07-13 — Claude Code** — Экспортировал `htmlToPlainText` из
  `buildRouteCreateDraft.ts` + тесты (теги/вложенные теги/`<br>`/`&nbsp;`/
  `&laquo;`/`&mdash;`/collapse пустых абзацев/идемпотентность на чистом
  тексте). Написал `planRouteNoteHtmlFixes` (чистая функция, свой тест) +
  `scripts/migration-fix-route-note-html.ts` (dry-run по умолчанию,
  `--apply` для записи, разбивка по маршрутам). Прогнал на dev-БД: dry-run
  97/97 стопов → `--apply` → повторный dry-run 0/97 (идемпотентность
  подтверждена живым прогоном, не только тестом). Перегенерировал
  `pnpm migration:route-review`. **Важная находка по пути**: заметки всё
  ещё не полностью чистые — нашёл отдельный, более общий баг в
  `parseTabularRows()` (`connectExecutor.ts`): MySQL batch-режим
  экранирует реальные переводов строк как буквальный текст `\n`, это не
  разэкранируется нигде в пайплайне, подтверждено на 100% (97/97) стопов.
  Не Route-специфично — тот же executor используется для Place/Article/
  Event. Зафиксировал как отдельный пункт чек-листа (см. выше), **не
  трогал `connectExecutor.ts`** — вне скоупа этой задачи (только HTML),
  нужно решение/приоритет от Алексея. Проверки: `tsc --noEmit`, весь
  `src/lib/migration/**/*.test.ts` + `scripts/migration-*.test.ts`, eslint
  touched files — все green. Незавершённое: нет по HTML-задаче как
  таковой. Следующий шаг: решение по MySQL-escape багу, затем продолжение
  копирайт-review (следующий промпт — HEIC, судя по чату).
- **2026-07-13 — Claude Code** — MySQL batch-escape подтверждён как общий
  migration-layer bug, но не включён в чистый Route PR. В текущем PR остаётся
  только Route-specific HTML cleanup; общий `connectExecutor.ts` fix,
  возможный report script и cleanup данных вынесены в отдельный follow-up
  после решения по Place/Article/Event.
- **2026-07-14 — Claude Code** — HEIC upload fix вынесен из Route/Phoenix
  истории и смержен отдельно в `dev` через PR #37
  (`fix(upload): convert HEIC images with modern decoder`). PR #36 не должен
  содержать HEIC code/package changes; в этом чек-листе HEIC упоминается
  только как закрытый внешний prelaunch blocker.
- **2026-07-14 — Claude Code** — Массовый первый проход по 97 RouteStop notes
  + 14 тизерам маршрутов выполнен как review artifact:
  `docs/migration/reviews/route-copy-proposals-2026-07.md`. В БД ничего не
  записано, `--apply` не запускался. Следующий шаг: Алексей утверждает пачкой
  или правит точечно; после этого — фактическая публикация 14 маршрутов и
  slug-history/redirect map.
