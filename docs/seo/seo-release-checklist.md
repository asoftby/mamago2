# Проверка SEO после выпуска

Это дополнение к [действующей release coordination](../release/dev-to-prod-checklist.md), а не разрешение на deploy. До выпуска: review task-only diff, обязательные проверки и CI, зафиксированный commit/artifact SHA. Ни один пункт ниже не выполнен на PROD за счёт изменения серверов в рамках аудита.

- [ ] Проверить build identity DEV/PROD на ожидаемом SHA; не считать merge доказательством deploy.
- [ ] PROD robots Allow и sitemap absolute PROD URL; global noindex off только при штатном release flag. DEV robots Disallow, пустой sitemap, meta/X-Robots noindex даже при SITE_INDEXING_ENABLED=true и APP_ENV=dev.
- [ ] Получить свежий sitemap, проверить XML/unique URL/origin; сверить с разрешённым inventory опубликованных публичных сущностей, а не только счётчиком URL. Draft/private/noindex/неактивные города исключены.
- [ ] GET каждого sitemap URL: final 200, нет error digest/notFound/noindex, один правильный canonical; JSON-LD parse без ошибок. После SQL fix повторить все blog category URL Минска и Марьиной Горки.
- [ ] Неизвестный root/городской path не направляется на `/minsk`; штатный notFound и noindex. Если HTTP уже начал streaming, отдельно решить строгий HTTP 404, не объявлять исправленный status без замера.
- [ ] Существующие точные manifest redirects (в том числе top-18) сохранены, без loop и без лишнего slash-hop; final canonical совпадает с sitemap.
- [ ] Для ровно 13 cutover routes проверить frozen CSV, один постоянный переход к опубликованной статье, контент/изображения/категорию, self-canonical, sitemap. HTML meta refresh записывать отдельно от HTTP redirect. DB-ready guard не обходится. `marshrut-mogilev` не включать.
- [ ] Проверить `/minsk` и другой город: разные self-canonical, правильная география и внутренние ссылки. Events filters noindex/follow+base canonical, реальная blog pagination page2 self-canonical; отсутствие indexable пустой pagination.
- [ ] Проверить прошлое событие по принятой политике, без массовых 301/410; актуальные даты и offers в JSON-LD. Rich Results Test для реальных Place/Event/Article URL.
- [ ] Smoke: семейный профиль, My Plan, Booking, business/admin/auth и возврат на исходный URL; noindex приватных surface и доступы сохранены.
- [ ] Получить реальные GSC отчёты по [списку](seo-recovery-action-plan.md), проверить sitemap fetch и Google-selected canonical; только eligible публичные target URL отправлять на индексацию.
- [ ] Записать GSC baseline и контрольные окна 7/14/28 дней. #249/#253/#270 закрывать только при их фактических критериях, не по merge или успешной сборке.
