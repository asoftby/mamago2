/** Canonical, user-facing mamaGo font families. */
export const BRAND_FONTS = ["Google Sans", "PT Serif", "Menlo"] as const;
export type BrandFont = (typeof BRAND_FONTS)[number];

/** Map persisted branding names to safe CSS variables, never arbitrary CSS. */
export function normalizeBrandFont(value: string | null | undefined, fallback: BrandFont): BrandFont {
  return BRAND_FONTS.includes(value as BrandFont) ? (value as BrandFont) : fallback;
}

export function getBrandFontStack(font: BrandFont): string {
  if (font === "PT Serif") return "var(--font-pt-serif), ui-serif, serif";
  if (font === "Menlo") return "Menlo, ui-monospace, SFMono-Regular, Monaco, Consolas, monospace";
  return "var(--font-google-sans), ui-sans-serif, system-ui, sans-serif";
}
