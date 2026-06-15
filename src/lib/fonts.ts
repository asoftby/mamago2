import { PT_Serif } from "next/font/google";
import localFont from "next/font/local";

/**
 * Единый источник правды для шрифта NTSomic.
 * Подключается только в root layout и используется как глобальный `--font-sans`
 * для public, admin, business и остальных поверхностей.
 *
 * preload выключен, чтобы Next.js не создавал лишние font preload hints
 * для весов, которые могут не понадобиться на первом экране.
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
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

/** PT Serif — погодная строка героя и другие акцентные serif-поверхности. */
export const ptSerif = PT_Serif({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["cyrillic", "latin"],
  variable: "--font-pt-serif",
  display: "swap",
  preload: false,
  fallback: ["ui-serif", "serif"],
});
