/**
 * Единые токены для мобильных bottom sheet и desktop dialog в рамках ResponsiveOverlay.
 * Подключайте эти классы при постепенной миграции legacy Sheet/Dialog.
 */

/** Backdrop: см. `DialogOverlay` / `SheetOverlay` — bg-black/50, z-50 (не дублировать кастомом). */

/** Нижний отступ с учётом safe area для футера sheet / sticky CTA */
export const overlaySafeFooterPadding =
  "pb-[max(1rem,env(safe-area-inset-bottom))]";

/** Высота мобильного sheet по умолчанию (верхний блок «Мой план», save flow и т.п.) */
export const mobileSheetHeightTall = "h-[min(88vh,100dvh)]";

/** Альтернатива — почти на весь экран */
export const mobileSheetHeightFull = "h-[min(92vh,100dvh)]";

/** Скругление верха мобильного sheet */
export const mobileSheetTopRadius = "rounded-t-3xl";

/** Обводка верха */
export const mobileSheetTopBorder = "border-t border-neutral-200";

/** Базовая оболочка контента мобильного bottom sheet (без высоты — её задаёт heightMode) */
export const mobileSheetShellBase = [
  mobileSheetTopRadius,
  mobileSheetTopBorder,
  "bg-white p-0 gap-0 overflow-hidden flex flex-col shadow-lg",
].join(" ");

/** Desktop dialog shell для крупных модалок (контент с нулевым padding, как в My Plan) */
export const desktopDialogShellLarge = [
  "!w-[min(92vw,960px)] !max-w-[960px] !max-h-[92vh]",
  "gap-0 overflow-hidden rounded-3xl border border-neutral-200/80 bg-neutral-50 p-0 shadow-2xl flex flex-col",
].join(" ");

/*
 * === AUDIT: modal / sheet / overlay (кратко, 2026) ===
 *
 * Реализации Sheet (@/components/ui/sheet): MyPlanOverlay, AddRouteToPlanSheet,
 * AccountDropdownSurface, AdminHeader, DayScenarioModal, PlanAudienceSheet,
 * AddPersonaTypeModal, PlanSuggestionsSheet, SaveToPlanModal,
 * NotificationsDropdown, MobileSelectSheet, when-select, MobileFilterSheet, SeoTemplatesClient,
 * MobileDateSheet, StructuredDataCenterClient, BirthdayBuilderStickyBar, OfferQuickView,
 * PartyForChildSection, ShareSheet, FilterControl.
 *
 * Пары Dialog+Sheet по media: AddRouteToPlanSheet, DayScenarioModal, PlanAudienceSheet,
 * AddPersonaTypeModal, PlanSuggestionsSheet, SaveToPlanModal, ShareSheet,
 * OfferQuickView, PartyForChildSection (частично).
 *
 * Только Dialog: DefaultAuthModal, SiteAuthModal, QuickAddChildModal, QuickAddAdultModal,
 * AddParticipantModal, EventPageView, auth modals, и др.
 *
 * Кастом fixed overlay: MobileSearchSheet, MyPlanProvider preview, RefinementFiltersModal,
 * StoryModal, AddParticipantModal overlay, admin billing, и др.
 *
 * Стандарт дальше: новые экраны — через ResponsiveOverlay; миграция постепенная.
 */
