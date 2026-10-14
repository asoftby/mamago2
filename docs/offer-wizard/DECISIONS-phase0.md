# Решения по аудиту фазы 0 (12.10.2026)

База аудита: `origin/dev` @ `f1a3e52a`, PR #531.

1. PR #531 мержится в `dev`; фаза 1 строится поверх него за флагом.
2. Модерация опубликованных офферов — отдельный PR до включения у реальных партнёров.
   - Контент (title, description, фото/видео, категории, интересы, FAQ, внешние URL) → ревизия + модерация, живая версия остаётся опубликованной.
   - Операционные данные (цены/тарифы, OpeningHours и исключения, способ записи, OfferBooking, предоплата/отмена, телефоны) → применяются сразу, пишутся в журнал изменений.
   - `shouldBlockPublishedOfferEdit` переписывается под это разделение, с тестами.
3. Миграция `20261012120000_offer_booking_foundation` проверяется на DEV владельцем; до подтверждения в `OfferBooking` не пишем.
4. Флаг: `Business.features` (JSON) с типизированным хелпером и переключателем в админке. Ключи: `newOfferWizard`, `leadForm`, `selections`.
5. Категории: `EventCategory(publicationType=OFFER)` + `OfferCategory` (до 3).
   - party — значения `PartyCategory`; place — как `EventCategory(PLACE)`; class — slug `DiscoveryClassChip`;
   - camp — `city`, `out-of-town`, `sport`, `language`, `it-robotics`, `creative`.
6. Интересы: 13 из `SYSTEM_INTERESTS`, хранение `Offer.interestSlugs`. Расширение справочника — отдельная задача.
7. Предоплата/отмена для всех типов: колонки `prepaymentTerms` / `cancellationTerms` на `Offer`; для party копируем из `birthdayDetails` (старое не трогаем). Зона выезда — `serviceAreaText`.
8. Режим работы — `OpeningHours` + `OpeningHoursException`. Занятия — `OfferScheduleRule/Exception`, лагерь — `campSessions` JSON.
9. Порядок PR фазы 1: docs → флаг → модерация по полям → шаги 1–9 (план в отчёте фазы 0).
