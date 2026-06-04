import localFont from "next/font/local";
import { PT_Serif, Instrument_Serif, Prata, Bitter, Cormorant_Garamond } from "next/font/google";

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
  fallback: ["nbrb", "ui-sans-serif", "system-ui", "sans-serif"],
});

export const ptSerif = PT_Serif({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});

export const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
  preload: false,
});

export const prata = Prata({
  weight: "400",
  subsets: ["latin", "cyrillic"],
  variable: "--font-prata",
  display: "swap",
  preload: false,
});

export const bitter = Bitter({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-bitter",
  display: "swap",
  preload: false,
});

export const sourceSerifPro = localFont({
  src: [
    {
      path: "../../public/fonts/sourceserifpro/SourceSerifPro-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/sourceserifpro/SourceSerifPro-It.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/sourceserifpro/SourceSerifPro-Semibold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/sourceserifpro/SourceSerifPro-SemiboldIt.ttf",
      weight: "600",
      style: "italic",
    },
  ],
  variable: "--font-source-serif",
  display: "swap",
  preload: false,
});

export const cormorantGaramond = Cormorant_Garamond({
  weight: ["400", "600"],
  style: ["normal", "italic"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-cormorant",
  display: "swap",
  preload: false,
});
