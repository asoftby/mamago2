# План SEO recovery

Основание: [аудит 2026-10-22](seo-recovery-audit-2026-10-22.md), [реестр дефектов](indexation-issues-2026-10-22.md), Issues [249](https://github.com/asoftby/mamago2/issues/249), [253](https://github.com/asoftby/mamago2/issues/253), [270](https://github.com/asoftby/mamago2/issues/270). Сроки ниже отсчитываются от фактического выпуска проверенного SHA, не от даты PR.

| Приоритет | Работа / ответственный по роли | Критерий завершения |
|---|---|---|
| P0 | Подтверждённых новых P0 нет. SEO owner проверяет GSC на массовый noindex/robots/canonical инцидент после получения реальных данных. | Свежая выгрузка, а не placeholder или старые цифры Issue. |
| P1 | Reviewer: проверить PR с SEO-01/02/03/04 и scope удаления fallback. Release owner: выпустить известный SHA штатной процедурой отдельно от аудита. | Regression gate/CI, build identity окружения, post-deploy checklist. PROD не менялся этой задачей. |
| P1 | SEO owner: восстановить разрешённое GSC чтение или выгрузить данные. | Pages indexing с причинами, sitemap статус и URL Inspection выборки; baseline performance. |
| P1 | #253 / migration owner: сохранить DB-ready guard, проработать настоящий pre-stream HTTP redirect для ровно 13 утверждённых маршрутов, исключить Могилёв. | One-hop 301/308, final 200/indexable/self-canonical/in sitemap; сверка контента, проверка Google-selected canonical. Не активировать новые mappings без доказательств. |
| P1 | #249 / SEO owner: проверить, что Google успешно прочитал текущий sitemap. | В GSC актуальный fetch без ошибки; причины excluded распределены по ожидаемым и ошибочным. |
| P1 | Migration/SEO owner: four checked legacy event targets (Phase2A 25–28) remain missing/noindex. | Approved equivalent or restored historical content; otherwise explicit justified 404/410 policy. No inferred current-season target or generic hub. |
| P2 | #270 / SEO owner: контроль /minsk/events по query/page на 7/14/28 день. | Сравнимые окна и сегменты, clicks/impressions/CTR/position, дата последней доступной статистики, отсутствие вывода по неполным дням. |
| P2 | Engineering: восстановить исторические recovery tests после проверки утверждённых CITY/COUNTRY и owner-review решений. | Оба теста проходят без ослабления data guard и без подмены target нерелевантным хабом. |
| P2 | Engineering: listing lastmod, category tag pagination и runtime sitemap полнота/alerts. | Доказанная потребность и отдельный fresh task; не расширять текущий PR неподтверждённой оптимизацией. |

## Необходимые выгрузки GSC

1. Выбрать property `https://mamago.by/`. В Indexing → Pages экспортировать totals и URL примеры каждой причины: Crawled/Discovered currently not indexed; Duplicate without user-selected canonical; Alternate with proper canonical; Page with redirect; Not found; Soft 404; Blocked by robots; Excluded by noindex. Записать дату отчёта и ограничение числа примеров.
2. В Sitemaps открыть `/sitemap.xml` и совместимый `/sitemap_index.xml`, сохранить submitted/read dates, discovered URLs, errors/warnings. После исправления подтверждённой ошибки выполнить Validate Fix; доступный HTTP XML сам по себе не подтверждает обработку Google.
3. URL Inspection: `/minsk`, `/minsk/events`, одна городская category, существующие Place/Event/Article, все 13 старых и новых route/article, исключённый Могилёв и один случайный отсутствующий URL. Сохранить indexed/live test, robots/noindex, Google-selected и user canonical, last crawl, referring sitemap. Не отправлять приватные/DEV/исключённые URL на индексацию.
4. Performance → Search results → Web: полные последние 90 дней, daily и page/query (по возможности также device/country/search appearance), четыре метрики. Отдельные фильтры `/minsk/events`, legacy и 13 новых статей. Сравнить 28 полных дней до/после, дополнительно 7/14/28 дней с одинаковыми сегментами и учётом сезонности. Зафиксировать privacy/row-limit ограничения; query totals могут не складываться в page totals.

Намеренные исключения приватных страниц, фильтров и дублей не являются автоматическими багами. Трафик считается восстановленным только по реальным послерелизным данным.
