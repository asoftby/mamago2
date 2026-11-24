# Манифест интеграции B2B

90 изменённых путей рабочего дерева `feat-business-cabinet-publication-ux-20261117`, включая 9 untracked. HEAD источника `114716eba37fddafa3f0af0febdf52749d457358`. Колонка WIP обозначает 50 путей, затронутых коммитом `97433a41d`. Остальные 40 разобраны при продолжении. Сравнение выполнено по полным байтам. Для идентификации приведены первые 16 шестнадцатеричных знаков SHA-256.

INTEGRATED **77**, ADAPTED **11**, SUPERSEDED **2**, REJECTED **0**, BLOCKED **0**.

| Исходный путь | Этап | Решение | SHA-256 источника | SHA-256 результата | Основание |
|---|---|---|---|---|---|
| `src/app/(ui)/ui-lab/_sections/DesignSystemFoundationSection.tsx` | Остаток | INTEGRATED | 963d81025f2ce81a | 963d81025f2ce81a | Байты совпадают. |
| `src/app/business/(protected)/bookings/BookingsView.tsx` | Остаток | INTEGRATED | 5efebfc53374ff68 | 5efebfc53374ff68 | Байты совпадают. |
| `src/app/business/(protected)/dashboard/page.tsx` | WIP | INTEGRATED | 7167ae1b8d1a4394 | 7167ae1b8d1a4394 | Байты совпадают. |
| `src/app/business/(protected)/events/EventsList.tsx` | WIP | INTEGRATED | 92787dcb71aaf376 | 92787dcb71aaf376 | Байты совпадают. |
| `src/app/business/(protected)/offers/OffersList.tsx` | Остаток | INTEGRATED | 507932281972d5d1 | 507932281972d5d1 | Байты совпадают. |
| `src/app/business/(protected)/offers/page.tsx` | WIP | ADAPTED | 9955d5372a7aef52 | b085be9e638d8eeb | Сортировка активного Boost поверх серверной квоты и проверки eligible. |
| `src/app/business/(protected)/places/[id]/submitted/page.tsx` | WIP | INTEGRATED | fca59132344990f9 | fca59132344990f9 | Байты совпадают. |
| `src/app/business/(protected)/publications/offers/page.tsx` | Остаток | ADAPTED | 1a91a697bd6af482 | a241e3488c3fd2a0 | endAt берётся из связанного активного Boost, максимум одна дата на предложение. Стабильная сортировка по продвижению. |
| `src/app/business/(protected)/reviews/page.tsx` | WIP | INTEGRATED | 2d786621506a679b | 2d786621506a679b | Байты совпадают. |
| `src/app/business/onboarding/AccessRequestPanel.tsx` | Остаток | ADAPTED | 94fd58c2c57b212a | 372444fed6df49e5 | Перенесён вариант кнопки. Сохранены handleSubmit и статусы запроса dev. |
| `src/app/business/onboarding/OnboardingForm.tsx` | Остаток | INTEGRATED | 471b0a6bc128bd37 | 471b0a6bc128bd37 | Байты совпадают. |
| `src/app/business/verification/page.tsx` | WIP | ADAPTED | 17bf5b58b2aa658e | 5488cabbebc984e7 | Ссылка оформлена через Button asChild. Устранены вложенные интерактивные элементы. |
| `src/app/globals.css` | Остаток | INTEGRATED | 2da08a9e9ebe76b1 | 2da08a9e9ebe76b1 | Байты совпадают. |
| `src/app/settings/SettingsHomeClient.tsx` | WIP | INTEGRATED | d95e3ec8af7df73c | d95e3ec8af7df73c | Байты совпадают. |
| `src/app/settings/email/EmailSettingsClient.tsx` | WIP | INTEGRATED | 7b339fae5883a674 | 7b339fae5883a674 | Байты совпадают. |
| `src/app/settings/security/page.tsx` | WIP | INTEGRATED | bde9e139a1776a9d | bde9e139a1776a9d | Байты совпадают. |
| `src/app/telegram/business/open/BusinessTelegramOpenClient.tsx` | Остаток | INTEGRATED | 6e62ed9d5b88451e | 6e62ed9d5b88451e | Байты совпадают. |
| `src/components/account/AccountDropdownContent.tsx` | WIP | INTEGRATED | 76cae90a6dad9470 | 76cae90a6dad9470 | Байты совпадают. |
| `src/components/account/AccountPage.contract.test.ts` | Остаток | ADAPTED | 2b57b7996312d112 | 939f7136954596fa | Проверяет BackButton и действующий customer-layout DirectInbox. |
| `src/components/account/AccountPage.tsx` | WIP | INTEGRATED | 3a5468c3fdceb714 | 3a5468c3fdceb714 | Байты совпадают. |
| `src/components/account/accountDropdownTokens.ts` | WIP | INTEGRATED | de7d467643bded15 | de7d467643bded15 | Байты совпадают. |
| `src/components/business/billing/DepositTopUpTrigger.tsx` | Остаток | INTEGRATED | 1b2ed7a2efcb0270 | 1b2ed7a2efcb0270 | Байты совпадают. |
| `src/components/business/booking-units/BookingUnitCalendar.tsx` | Остаток | INTEGRATED | 63770fc6f860a948 | 63770fc6f860a948 | Байты совпадают. |
| `src/components/business/booking-units/BookingUnitManager.tsx` | Остаток | INTEGRATED | 62e4487e9b5c44b5 | 62e4487e9b5c44b5 | Байты совпадают. |
| `src/components/business/bookings/ManualBookingDialog.tsx` | Остаток | INTEGRATED | 9f8e175ad0f73c04 | 9f8e175ad0f73c04 | Байты совпадают. |
| `src/components/business/bookings/inbox/BookingsInbox.tsx` | Остаток | INTEGRATED | f122f0138d5f091b | f122f0138d5f091b | Байты совпадают. |
| `src/components/business/bookings/inbox/InboxActionOverlays.tsx` | Остаток | INTEGRATED | b2b6b86dd2c02f9c | b2b6b86dd2c02f9c | Байты совпадают. |
| `src/components/business/bookings/inbox/PartyConfirmOverlay.tsx` | Остаток | INTEGRATED | 2b8f40bc05a304b7 | 2b8f40bc05a304b7 | Байты совпадают. |
| `src/components/business/dashboard/BusinessOnboardingTour.tsx` | WIP | INTEGRATED | d204599150215e22 | d204599150215e22 | Байты совпадают. |
| `src/components/business/dashboard/DashboardActionStack.tsx` | WIP | INTEGRATED | 73cfe3d3a5f507dc | 73cfe3d3a5f507dc | Байты совпадают. |
| `src/components/business/dashboard/DashboardClient.tsx` | WIP | INTEGRATED | 361a54b02c444f0a | 361a54b02c444f0a | Байты совпадают. |
| `src/components/business/dashboard/ImprovementRequestsWidget.tsx` | WIP | INTEGRATED | 64e64c9eb04e6f8e | 64e64c9eb04e6f8e | Байты совпадают. |
| `src/components/business/dashboard/NewBusinessDashboard.tsx` | WIP | INTEGRATED | b1730ce8ae9943e6 | b1730ce8ae9943e6 | Байты совпадают. |
| `src/components/business/events/EventCardHorizontal.tsx` | WIP | ADAPTED | 9b8dcd9035678be3 | 55f1632edb9524a9 | Серверный BoostLauncher, доступность и displayOccurrenceAt. |
| `src/components/business/events/boostBadgePolicy.test.ts` | WIP | ADAPTED | 1e15e1337e9262ac | 245ee8faa05c5600 | Проверяет серверную квоту, активный период и актуальную дату события. |
| `src/components/business/layout/BusinessCabinetNav.tsx` | WIP | INTEGRATED | 85bd676e0d1b6fa9 | 85bd676e0d1b6fa9 | Байты совпадают. |
| `src/components/business/layout/BusinessHeader.tsx` | WIP | INTEGRATED | 8da11d86a89f4bc8 | 8da11d86a89f4bc8 | Байты совпадают. |
| `src/components/business/layout/BusinessShell.tsx` | WIP | INTEGRATED | 2a7a649780731bf1 | 2a7a649780731bf1 | Байты совпадают. |
| `src/components/business/layout/BusinessSidebar.tsx` | WIP | INTEGRATED | 913164abea769ea3 | 913164abea769ea3 | Байты совпадают. |
| `src/components/business/notifications/BusinessTelegramStatusRow.tsx` | Остаток | INTEGRATED | 9112e253968246f0 | 9112e253968246f0 | Байты совпадают. |
| `src/components/business/offers/OfferCardHorizontal.tsx` | WIP | ADAPTED | 786da1ab9d10fdc6 | 715b282cebda2590 | Кнопка использует BoostLauncher с квотой и cooldown от сервера. |
| `src/components/business/place/ConfirmExistingPlaceModal.tsx` | WIP | INTEGRATED | c226b8075bde68ee | c226b8075bde68ee | Байты совпадают. |
| `src/components/business/place/PlaceDuplicateBlock.tsx` | WIP | INTEGRATED | e3b98254ac11fd53 | e3b98254ac11fd53 | Байты совпадают. |
| `src/components/business/place/PlaceGalleryUpload.tsx` | WIP | INTEGRATED | 545ce13abe3a3aca | 545ce13abe3a3aca | Байты совпадают. |
| `src/components/business/place/PlaceLogoUpload.tsx` | WIP | INTEGRATED | 6ab064f1682ba47d | 6ab064f1682ba47d | Байты совпадают. |
| `src/components/business/place/PlaceMapModal.tsx` | WIP | INTEGRATED | 17dd3a50b2fbbde7 | 17dd3a50b2fbbde7 | Байты совпадают. |
| `src/components/business/place/PlaceMapPreview.tsx` | WIP | INTEGRATED | 1f3d6501f916de12 | 1f3d6501f916de12 | Байты совпадают. |
| `src/components/business/places/PlaceCardHorizontal.tsx` | WIP | INTEGRATED | 5df0733e46481976 | 5df0733e46481976 | Байты совпадают. |
| `src/components/business/promotion/PromotionOverviewClient.tsx` | Остаток | INTEGRATED | 1a521581d50e2448 | 1a521581d50e2448 | Байты совпадают. |
| `src/components/business/sections/BusinessSectionHeader.tsx` | WIP | INTEGRATED | 768dd8006cd9be89 | 768dd8006cd9be89 | Байты совпадают. |
| `src/components/business/shared/BusinessContentList.tsx` | WIP | INTEGRATED | 31c90ba850f1d2cc | 31c90ba850f1d2cc | Байты совпадают. |
| `src/components/business/shared/BusinessPublicationCard.tsx` | WIP | INTEGRATED | 1b892140b3c5a57a | 1b892140b3c5a57a | Байты совпадают. |
| `src/components/business/shared/PublicationBoostActiveUi.tsx` | WIP | ADAPTED | 863dd3c3d94e9264 | 33412ca7c6a2788c | Общий useBoostCountdown, HH:MM:SS и обновление при окончании периода. |
| `src/components/business/shared/PublicationStatisticsDialog.tsx` | WIP | INTEGRATED | 7f23dd3a7ebda669 | 7f23dd3a7ebda669 | Байты совпадают. |
| `src/components/business/team/BusinessInviteStatusCard.tsx` | WIP | INTEGRATED | 8314d4fe8f584d1c | 8314d4fe8f584d1c | Байты совпадают. |
| `src/components/business/team/BusinessTeamPageClient.tsx` | Остаток | INTEGRATED | a124429e8ef375ec | a124429e8ef375ec | Байты совпадают. |
| `src/components/business/ui/businessCta.ts` | WIP | INTEGRATED | f453b7579567683f | f453b7579567683f | Байты совпадают. |
| `src/components/business/verification/VerificationPendingNextSteps.tsx` | WIP | INTEGRATED | f13707d5452b8b5c | f13707d5452b8b5c | Байты совпадают. |
| `src/components/business/wizard/event/EventWizard.tsx` | Остаток | INTEGRATED | 8cac891919005358 | 8cac891919005358 | Байты совпадают. |
| `src/components/business/wizard/event/steps/Step3Media.tsx` | Остаток | INTEGRATED | 04f1e7ec80782c04 | 04f1e7ec80782c04 | Байты совпадают. |
| `src/components/business/wizard/event/steps/Step7Contacts.tsx` | Остаток | INTEGRATED | 706f536102708eba | 706f536102708eba | Байты совпадают. |
| `src/components/business/wizard/event/steps/Step8Organizer.tsx` | Остаток | ADAPTED | e39430c21af20edc | 580132bbe5c2fc89 | Вариант кнопки применён к действующему выбору подтверждённой компании. |
| `src/components/business/wizard/event/steps/location/EventLocationMapModal.tsx` | Остаток | INTEGRATED | 43a1a90f00a6f346 | 43a1a90f00a6f346 | Байты совпадают. |
| `src/components/business/wizard/event/steps/location/EventLocationMapPreview.tsx` | Остаток | INTEGRATED | b118e81873cc45d5 | b118e81873cc45d5 | Байты совпадают. |
| `src/components/business/wizard/event/steps/location/QuickPlaceCreate.tsx` | Остаток | INTEGRATED | 91a99e439ae9dcc2 | 91a99e439ae9dcc2 | Байты совпадают. |
| `src/components/business/wizard/offer/OfferWizard.tsx` | Остаток | INTEGRATED | ced51b1e93a0ed1f | ced51b1e93a0ed1f | Байты совпадают. |
| `src/components/business/wizard/offer/components/BookingServicesEditor.tsx` | Остаток | INTEGRATED | 4e920c8bc5f9de1d | 4e920c8bc5f9de1d | Байты совпадают. |
| `src/components/business/wizard/offer/components/PartyResourceEditor.tsx` | Остаток | INTEGRATED | e9d34e2f8d409161 | e9d34e2f8d409161 | Байты совпадают. |
| `src/components/business/wizard/offer/components/PartyResourceSchedule.tsx` | Остаток | INTEGRATED | 4c14c3739c92feb0 | 4c14c3739c92feb0 | Байты совпадают. |
| `src/components/business/wizard/offer/steps/Step4CampSchedule.tsx` | Остаток | INTEGRATED | 84085b69fde0b527 | 84085b69fde0b527 | Байты совпадают. |
| `src/components/business/wizard/offer/steps/Step6Contacts.tsx` | Остаток | INTEGRATED | deca41d14069f7ba | deca41d14069f7ba | Байты совпадают. |
| `src/components/business/wizard/place/PlaceWizard.tsx` | Остаток | INTEGRATED | f0a630ff479a485a | f0a630ff479a485a | Байты совпадают. |
| `src/components/content-editor/ContentEditorChrome.tsx` | Остаток | INTEGRATED | 8e41a5e5780ee609 | 8e41a5e5780ee609 | Байты совпадают. |
| `src/components/navigation/HistoryBackButton.tsx` | WIP | INTEGRATED | c00b64687833f817 | c00b64687833f817 | Байты совпадают. |
| `src/components/settings/BusinessAccountHub.tsx` | WIP | INTEGRATED | 9d8a1e7f79ecc6e4 | 9d8a1e7f79ecc6e4 | Байты совпадают. |
| `src/components/settings/SettingsLinkRow.tsx` | WIP | INTEGRATED | 79d1d2a7bc741b2e | 79d1d2a7bc741b2e | Байты совпадают. |
| `src/components/settings/SettingsPageLayout.tsx` | WIP | INTEGRATED | 7bb81554e543e88c | 7bb81554e543e88c | Байты совпадают. |
| `src/components/settings/SettingsScaffold.tsx` | WIP | INTEGRATED | fcf2fec89f5395b7 | fcf2fec89f5395b7 | Байты совпадают. |
| `src/components/settings/settingsSectionIconTile.ts` | WIP | INTEGRATED | ebb55ca9db03cfe5 | ebb55ca9db03cfe5 | Байты совпадают. |
| `src/components/shared/MobileSmartBackButton.tsx` | Остаток | INTEGRATED | 9c9d86b8704c8097 | 9c9d86b8704c8097 | Байты совпадают. |
| `src/components/site/header/MobileHeaderBackButton.tsx` | Остаток | INTEGRATED | f5b136fb14e70f79 | f5b136fb14e70f79 | Байты совпадают. |
| `src/components/ui/back-button.tsx` | WIP | INTEGRATED | cdd863c865a2e1ff | cdd863c865a2e1ff | Байты совпадают. |
| `src/components/ui/button.tsx` | WIP | INTEGRATED | a11a21a8523cdc39 | a11a21a8523cdc39 | Байты совпадают. |
| `src/components/ui/overlay-layout.ts` | Остаток | INTEGRATED | ebe0924090c35b1b | ebe0924090c35b1b | Байты совпадают. |
| `src/components/ui/responsive-overlay.tsx` | Остаток | INTEGRATED | 91dc932d6862ec08 | 91dc932d6862ec08 | Байты совпадают. |
| `src/features/settings/server/renderers.tsx` | WIP | ADAPTED | 36ab7fd438c553ed | 48ee337706c9d546 | Сохранён вывод статуса верификации dev. |
| `src/lib/business/cabinetCrumbs.test.ts` | WIP | INTEGRATED | 7fa4968b3583decc | 7fa4968b3583decc | Байты совпадают. |
| `src/lib/business/cabinetCrumbs.ts` | WIP | INTEGRATED | d636b8d6510f44c4 | d636b8d6510f44c4 | Байты совпадают. |
| `src/lib/promotion/boostCountdown.test.ts` | Остаток | SUPERSEDED | 9493161f2a40c8e5 | — | Покрытие реализовано в boostCountdownLive.test.ts с поддержкой прежнего минутного API. |
| `src/server/services/promotion/activeBoostEndsByOfferIds.ts` | Остаток | SUPERSEDED | 337fddd172dfed2e | — | Отдельный findMany заменён проекцией boosts на странице публикаций и существующими кандидатами в основном списке. |
