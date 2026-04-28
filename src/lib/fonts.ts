import localFont from "next/font/local";

/**
 * Единый источник правды для шрифта NTSomic.
 * next/font/local автоматически:
 * - генерирует @font-face
 * - preload-ит только нужные файлы (без лишних warning)
 * - задаёт CSS-переменную --font-sans
 *
 * Подключается ТОЛЬКО в src/app/layout.tsx (root layout).
 * Все остальные layouts наследуют шрифт через body.
 */
export const ntSomic = localFont({
  src: [
    {
      path: "../../public/fonts/NTSomic/NTSomic-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/NTSomic/NTSomic-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/NTSomic/NTSomic-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/NTSomic/NTSomic-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
