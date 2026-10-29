# #814 — «Сильфида»: расследование публичного 404

Статус: **диагностика начата; причина на PROD не установлена**. Этот документ фиксирует проверенный маршрут по актуальному `dev`; не изменяет правила публикации до выяснения фактических данных.

## Что проверено в коде

- `src/app/(public)/[city]/offers/[slug]/page.tsx`: сначала city-scoped slug, затем глобальная fallback-проверка; 404 возникает при отсутствии города/slug, отказе `isOfferPubliclyVisible` либо при `getOfferPageData() === null`.
- `src/lib/offer/offerPageData.ts`: запрос с `getPublicPublishedOfferWhere()`, обязательными статусами Offer/Place и операционным статусом бизнеса.
- `src/lib/offers/offerVisibility.ts` и `src/server/public/publicContentVisibility.ts`: опубликованный оффер, не архивированный, место опубликовано/не архивировано, бизнес не отключён.
- `src/lib/slug/offerSlugService.ts`: slug может иметь историю, а `Offer.cityId` иногда не совпадает с городом места (BACKLOG-114).

## PROD read-only диагностика (до исправления)

1. Запросить по `gimnastika-dlya-devochek-silfida` нынешний Offer и `OfferSlugHistory` (все cityId и даты) **без персональных данных**.
2. Сверить Offer.id/status/archivedAt/cityId/placeId, Place.status/archivedAt/city.slug и business.operationalStatus. Установить первую точку отказа, не менять статусы заранее.
3. Проверить HTTP обычного канонического URL, ошибочный city URL и URL с возрастными параметрами; параметры профиля не логировать.
4. Только после подтверждения причины сделать минимальный fix, добавить regression для текущего и исторического slug, города и draft/preview/noindex.
5. Проверить CI и после разрешения — DEV; PROD остаётся отдельным решением.

**Не считать проблему исправленной до проверки PROD-записи.**
