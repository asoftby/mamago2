# SEO recovery audit — 22 октября 2026

## Результат и границы доказательств

База исходников: `8f564a489a9766f9ad5ac09b4c23415ef71a2898` (`dev`, свежий task-start gate). Проверки публичных PROD/DEV URL — только GET, без авторизации, максимум два параллельных запроса; дата в JSON — UTC, дата отчёта — Europe/Minsk. Изменения не развёрнуты на серверах. Доступность страницы не доказывает её индексацию или восстановление трафика.

Канонические правила не переопределяются: [URL architecture](../migration/seo/final-url-architecture-2026-08-15.md), [SEO migration closure](../migration/seo-migration-closure.md), [release coordination](../release/dev-to-prod-checklist.md). Этот документ — датированный аудит, а не новая архитектура.

Полный список выполненных запросов и цепочек: [HTTP evidence](evidence/http-checks-2026-10-22.json). Подтверждённые legacy соответствия: [CSV](legacy-url-mapping-2026-10-22.csv). Дефекты и воспроизведение: [indexation issues](indexation-issues-2026-10-22.md).

## Подтверждённые исправления в коде

1. **P1: неизвестные URL перенаправлялись на нерелевантный `/minsk`.** Убрана только общая ветка middleware; manifest и точные legacy override сохранены. Несуществующий путь теперь доходит до штатного `notFound`, а новые города не зависят от статического списка в middleware. HTTP 404 после выпуска необходимо проверить отдельно: Next может уже начать streaming и отдать 200 с `noindex`.
2. **P1: категории журнала в sitemap отвечали not-found/noindex.** `indexableArticleWhere` применял `NOT seoRobots ILIKE '%noindex%'`, исключавший также SQL NULL. Явно разрешён NULL, сохранено исключение `noindex`. Синтетическая статья воспроизводит падение до исправления и согласованность разрешения категории/sitemap после него. Это восстановление доступности существующих категорий; sitemap и содержимое не удаляются.
3. **P2: stored canonical со слешем принимался как корректный и возвращался со слешем**, хотя middleware перенаправляет на URL без слеша. Валидатор теперь требует точный pathname и возвращает управление существующему canonical resolver при несовпадении. Строки БД не меняются.
4. **P1, превентивная защита DEV:** явный APP_ENV local/dev/development/staging/preview/test больше нельзя сделать индексируемым через `SITE_INDEXING_ENABLED=true`; при отсутствии APP_ENV учитывается preview/development VERCEL_ENV. Production/prod и принудительный kill switch сохраняют поведение. Фактический DEV во время аудита уже закрыт корректно; утечки индексации не заявляются.

Регрессии подключены к `test:seo-recovery`, обязательному `check:push` и существующему SEO-шагу CI. Синтетический интеграционный тест категорий запускается отдельно и требует локальной выделенной БД `mamago_seo_*` и явного opt-in. CI без PostgreSQL не выдаётся за проверку интеграции с БД.

5. **P2: лишний slash-hop перед точным legacy redirect.** Подтверждён `/top-18-kafe-i-restoranov-s-detskoj-ploshhadkoj-ili-komnatoj/`: `308 → source без слеша → 308 → final 200`. Включён `skipTrailingSlashRedirect`, чтобы manifest обрабатывал исходный URL первым; существующий middleware сохраняет 301 для обычных GET/HEAD URL со слешем. Query и исключения API/assets остаются в существующей политике. Это изменение Next runtime config требует проверки собранного приложения; данные mappings не переписываются.

## Robots и sitemap

- PROD `/robots.txt`: 200, Allow `/`, ссылка на `/sitemap.xml`.
- PROD `/sitemap.xml`: 200, XML urlset, 257 уникальных абсолютных same-origin URL в зафиксированном снимке. Проверены все 257: 14 blog category возвращают notFound/noindex (SEO-02); остальные 243 не имеют обнаруженного HTTP/canonical/robots/JSON-LD противоречия. Всего проверены 289 различных URL (291 ответ с учётом двух дополнительных User-Agent проб). `/sitemap_index.xml`: 200, совместимый индекс на этот sitemap. Старый endpoint сейчас работает; его историческая ошибка из #249 не является доказательством текущей HTTP-ошибки.
- DEV robots: Disallow `/`; sitemap: пустой urlset; `/minsk`: meta и X-Robots-Tag `noindex, nofollow`. DEV совместимый sitemap index указывает только на DEV.
- Источник sitemap фильтрует публикацию, публичную видимость, активность города и `noindex`. Приватные Route, draft Article и birthday builder не добавляются. Отсутствие Offer/Route detail в текущем снимке само по себе не доказывает потерю данных: доступ к БД окружений не использовался.
- События с истёкшей датой могут оставаться доступными по прямому URL по действующей политике. Для detail sitemap используется detail visibility, для категорий — listing visibility. Не удалять историю и не выдавать массовые 410 только по возрасту.
- `lastmod` карточек берётся из `updatedAt`; у listing URL используется `City.updatedAt`/`Category.updatedAt`, что не обязательно отражает изменение состава выдачи. Улучшение достоверности listing lastmod — P2, без подстановки текущего времени на каждый запрос.

## Canonical, фильтры, регионы и structured data

`/minsk`, `/minsk/events`, `/minsk/classes`, `/minsk/routes`, `/minsk/blog`, `/marina-gorka`, `/marina-gorka/blog` имеют разные self-canonical. Полезные страницы другого города не каноникализируются на Минск. `/minsk/kuda` сохраняет query при переходе на `/minsk/events`; фактически наблюдается streaming meta refresh, а не HTTP 308.

`/minsk/events?age=5` и `?date=tomorrow` каноникализируются на нефильтрованную выдачу и имеют noindex/follow. `?page=2` в событиях не следует считать доказанной пагинацией: параметр не управляет фактической выдачей. Реальная пагинация журнала `/minsk/blog?page=2` имеет собственный canonical. Фильтр tag в категории журнала требует отдельной оценки дублирования после восстановления доступности категории.

Проверены исходники canonical resolver для Place/Offer/Event/Article/Route, публичная visibility, metadata, JSON-LD builders и безопасная сериализация. Прогон HTTP дополнительно фиксирует JSON-LD types и ошибки JSON. Это не сертификат Google Rich Results и не полный schema.org validator; нужны URL Inspection/Rich Results Test после выпуска. Точные UI/route правила профиля, бронирований, бизнес-кабинета и админки не меняются; middleware-регрессии сохраняют private noindex, остальные контракты покрывает обязательный push gate.

## #253: 13 Route → Article

Ровно утверждённые 13 slug взяты из `legacyEditorialRouteCutover.ts`. Все 13 целевых `/minsk/blog/{slug}` во время проверки дают 200, self-canonical, присутствуют в sitemap; старые `/routes/{slug}` выдают 200 с мгновенным meta refresh на соответствующую статью. Циклов HTTP в этой выборке не обнаружено. Это **не HTTP 301/308** и ещё не выполнение строгого HTTP-критерия #253. Исходник проверяет архивирование исходного Route и готовность опубликованной Article/категории перед cutover; эти data guards сохранены.

Могилёв (`marshrut-mogilev`) исключён: наблюдается not-found/noindex, не добавлен ни в 13 правил, ни в sitemap. Страницы и миграции не удалены. Наличие контента целевой статьи проверяется HTTP, но полная паритетная сверка с историческим WP-источником не заявляется без разрешённой выгрузки. Семантические спорные/неутверждённые legacy URL остаются на owner review, а не перенаправляются массово.

Мгновенный meta refresh — поддерживаемый Google постоянный сигнал, и Next документирует его для streaming. Это не доказательство потери веса. Сохранение data guard при переносе redirect до начала streaming и фактический Google-selected canonical требуют отдельной проверки; менять все 13 на статические redirect без guard не следует.

## GSC и #270

Windsor обнаружил разрешённый Search Console account `https://mamago.by/`, но вернул явное предупреждение: чтение остановлено, потому что подключены 2 account при лимите Free 1. Поля page/query содержат текст о ненастоящих числах. Возвращённые нули **не использованы**. Тариф и подключения не менялись. Page indexing и URL Inspection также не предоставлены этим набором полей. Подтверждённых свежими данными GSC показателей в этом аудите нет.

Исторические показатели в Issues и recovery manifests остаются историческими, не используются как текущие. Метаданные #270 уже соответствуют high-intent формулировке «Куда сходить с детьми в Минске сегодня — афиша mamaGo» и наблюдаются на PROD. Без фактических query/page данных оснований снова переписывать title нет. Замер на 7/14/28 день после выпуска обязателен.

## Проверки и оставшиеся ограничения

Targeted SEO sweep: 27/29 тестов прошли, включая новые регрессии, sitemap/robots, пять canonical resolvers, JSON-LD и synthetic category integration. Исправлен только test-runner boundary mock в city metadata test: реальные metadata и Prisma остаются, marker `server-only` заглушается по существующему тестовому паттерну репозитория. Интеграция требует `SEO_ISOLATED_TEST_DB=true`, `APP_ENV=production`, `SITE_INDEXING_ENABLED=true` и предварительно проверенный localhost DATABASE_URL новой `mamago_seo_*` базы; реальные env-файлы не используются.

Команды и итоговые статусы фиксируются в PR и итоговом отчёте на точном commit SHA. Два существующих теста воспроизводимо падают на неизменённом BASE_HEAD: `migratedArticleSlugRecovery.test.ts` (исторический CITY target против нынешнего `/blog/...`) и `phase2aPriorityRecovery.test.ts` (ожидание 37 blocked при 36 в источнике). Их assertions и recovery-данные не ослаблены ради зелёного результата. Нужна сверка с утверждёнными географией/owner решениями. Глобальный lint baseline — [#687](https://github.com/asoftby/mamago2/issues/687), несвязанные файлы не правились.

Удалён только `src/lib/routing/wpLegacyCatchAll.ts`: назначение — общий 301 на `/minsk`; единственный runtime импорт/вызов был в middleware. Тест этого поведения заменён тестом реального middleware. Проверка ссылок не нашла загрузки helper в сборке, CI или deployment scripts; package alias `test:wp-catch-all` сохранён. Удаление механизма необходимо для устранения подтверждённого нерелевантного redirect, а не мотивировано возрастом файла. Manifest, миграции, конфигурация окружений и рабочие страницы сохранены.

## Источники трактовки

- [Next permanentRedirect: streaming meta tag](https://nextjs.org/docs/app/api-reference/functions/permanentRedirect).
- [Google: redirects and instant meta refresh](https://developers.google.com/search/docs/crawling-indexing/301-redirects).
- [Google: HTTP status и soft 404](https://developers.google.com/crawling/docs/troubleshooting/http-status-codes).
- [Google: согласование canonical и sitemap](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
