/** Shared geometry for the mobile discovery header and bottom navigation. */
export const MOBILE_DISCOVERY_EDGE_PADDING = "px-4";
export const MOBILE_DISCOVERY_EDGE_MARGIN = "mx-4";
export const MOBILE_DISCOVERY_BOTTOM_OFFSET =
  "mb-[max(1rem,env(safe-area-inset-bottom))]";

export const MOBILE_DISCOVERY_FIELD_GEOMETRY =
  "h-[52px] rounded-full px-5 py-0";

export const MOBILE_DISCOVERY_FIELD_CHROME =
  "border border-gray-200 bg-white shadow-sm";

/** Высота строки мобильного хедера и соответствующий sticky-отступ для элементов под ним (литералы — для Tailwind). */
export const MOBILE_HEADER_ROW_HEIGHT = "h-16";
export const MOBILE_HEADER_STICKY_TOP = "top-16";

/** Liquid glass для плавающих контролов: полупрозрачная заливка, blur, светлая кромка и внутренний блик. */
export const MOBILE_GLASS_CHROME =
  "border border-white/60 bg-white/55 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]";

/** 26px field radius + the shell's 8px padding keeps the two pills concentric. */
export const MOBILE_DISCOVERY_SHELL_RADIUS = "rounded-[34px]";
