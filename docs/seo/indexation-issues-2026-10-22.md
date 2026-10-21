# Реестр проблем индексации — 2026-10-22

Снимок HTTP и даты каждого запроса: [evidence](evidence/http-checks-2026-10-22.json). Все исправления ниже относятся к исходникам PR, не к уже развёрнутому PROD. Свежих подтверждений GSC нет.

| ID / приоритет | Доказательство и воспроизведение | Исправление / критерий |
|---|---|---|
| SEO-01 P1 | GET `/seo-audit-nonexistent-20261022`, `/unknown-city-seo/events`: 301 на `/minsk`, затем 200 с canonical хаба. `src/middleware.ts`, прежний wpLegacyCatchAll. Риск нерелевантного redirect/soft-404 классификации, а не подтверждённый GSC soft 404. | Убран общий fallback; тест реального middleware оставляет unknown и новые города route resolver. После выпуска проверить notFound/noindex и HTTP status, отсутствие location на `/minsk`. Точные manifest redirects остаются. |
| SEO-02 P1 | Sitemap содержит `/marina-gorka/blog/category/laifkhaki`, `/mamagosti`, `/marshruty` и другие category URL; HTTP 200 streaming notFound с noindex без canonical. `src/server/article/cityBlogCategories.ts`: SQL NOT исключает NULL. | NULL robots явно разрешён. Интеграция на синтетической статье: до fix `category resolution for null: false !== true`, после — категория и sitemap согласованы для NULL/index/noindex. Проверить все 14 blog category URL после выпуска. |
| SEO-03 P2 | `validateStoredCanonical({stored:'https://mamago.by/minsk/events/example/', expectedPath:'/minsk/events/example', publicBase:'https://mamago.by'})` ранее возвращал URL со слешем; он является redirect source по middleware. Только доказательство кодом; распространённость в PROD БД неизвестна. | Точное сравнение pathname, существующий resolver строит URL без слеша. Регрессии для пяти типов сущностей, query/hash/host/другого города. |
| SEO-04 P1, hardening | APP_ENV=dev, NODE_ENV=production, SITE_INDEXING_ENABLED=true ранее снимали глобальный noindex. Текущий HTTP DEV закрыт — инцидент не заявляется. | Явные непродуктивные APP_ENV и VERCEL preview закрыты независимо от release flag. Матрица окружений, meta и middleware X-Robots-Tag. |
| SEO-05 P1, acceptance #253 | 13 `/routes/{slug}`: 200 + instant refresh; 13 target Article: 200/self-canonical/sitemap. Это documented streaming permanent redirect, но HTTP-критерий 301/308 пока не выполнен. | Не обходить DB-ready guard статическим redirect. Разобрать pre-stream execution, проверить исходный/целевой контент и GSC Google canonical. Могилёв исключён. Код cutover и данные не менялись. |
| SEO-06 P1, external #249 | Windsor возвращает предупреждение о приостановленном чтении и placeholder вместо page/query; метрики невалидны. | Восстановить чтение силами владельца или предоставить выгрузки; не менять account/тариф автоматически. |
| SEO-07 P2 | Listing lastmod из City/Category updatedAt, а не изменения фактической выдачи. Полнота sitemap при runtime DB exception не подтверждается HTTP одиночным снимком. | Проверить семантику lastmod и мониторинг полноты; не ставить today на каждый запрос. |
| SEO-08 P2 | Два исторических SEO-теста падают и на BASE_HEAD: CITY/global path и 37/36 owner-review rows. | Отдельно сверить frozen data/owner decisions, затем восстановить regression suite. Не менять ожидания только ради CI. |

| SEO-09 P2 | Top-18 legacy URL со слешем: два HTTP 308 перед final 200. Next automatic slash redirect исполнялся перед manifest. | `skipTrailingSlashRedirect: true`; существующий custom middleware и manifest остаются. Проверить собранный routes manifest и локальный HTTP, включая query и GET/HEAD. |

## Не считать установленными дефектами

- 200 с `NEXT_HTTP_ERROR_FALLBACK;404` и meta noindex — streaming notFound, не доказательство индексируемой soft 404. URL Inspection нужен для фактической классификации Google.
- `/sitemap_index.xml` сейчас исправно возвращает индекс; исторический GSC статус в #249 не обновлялся в рамках этого аудита.
- Нет Offer/Route detail в sitemap — не доказательство пропажи опубликованных карточек без независимого inventory.
- Нет даты/билетов у прошлых событий — не основание автоматически удалять историю или делать нерелевантный 301.
- Instant meta refresh не равен JavaScript-only redirect и поддерживается Google. Проверка strict HTTP acceptance и фактической консолидации всё ещё нужна.
