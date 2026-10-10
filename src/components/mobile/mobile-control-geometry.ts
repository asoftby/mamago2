/** Shared geometry for the mobile discovery header and bottom navigation. */
export const MOBILE_DISCOVERY_EDGE_PADDING = "px-4";
export const MOBILE_DISCOVERY_EDGE_MARGIN = "mx-4";
export const MOBILE_DISCOVERY_BOTTOM_OFFSET =
  "mb-[max(1rem,env(safe-area-inset-bottom))]";

export const MOBILE_DISCOVERY_FIELD_GEOMETRY =
  "h-[52px] rounded-full px-5 py-0";

export const MOBILE_DISCOVERY_FIELD_CHROME =
  "border border-gray-200 bg-white shadow-sm";

/**
 * Верхний ряд мобильного хедера (лого/«←», 🔔, 👤) — 48px; ряд поиска под ним — 56px.
 * Литералы (не шаблоны) — чтобы Tailwind увидел классы.
 */
export const MOBILE_HEADER_ROW_HEIGHT = "h-12";
export const MOBILE_HEADER_ROW1_COLLAPSE = "-translate-y-12";
/** Sticky-отступ для элементов под хедером: высота одного (верхнего) ряда. */
export const MOBILE_HEADER_STICKY_TOP = "top-12";

/** Белые непрозрачные плавающие контролы (виджет, 🔔, 👤, чип хедера): тонкая серая граница, без тени. */
export const MOBILE_FLOATING_CHROME = "border border-gray-200 bg-white";

/** 26px field radius + the shell's 8px padding keeps the two pills concentric. */
export const MOBILE_DISCOVERY_SHELL_RADIUS = "rounded-[34px]";
