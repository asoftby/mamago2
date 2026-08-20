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

/**
 * Editorial serif accent — exposed as `--font-pt-serif`, aliased site-wide
 * to `--font-editorial` / `--font-serif` / `--font-display` (see
 * globals.css), used across ~60 files (weather hero, `.font-display`/
 * `.font-display-italic`, place/article editorial surfaces, etc).
 *
 * Loaded locally to keep Docker builds independent from fonts.gstatic.com.
 * Existing Source Serif Pro faces remain the normal editorial style, while
 * every italic request resolves to the real PT Serif italic face (including
 * Cyrillic) instead of a browser-generated slant of the surrounding font.
 */
export const ptSerif = localFont({
  src: [
    {
      path: "../../public/fonts/sourceserifpro/SourceSerifPro-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/sourceserifpro/SourceSerifPro-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/PT_Serif-Web-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/PT_Serif-Web-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-pt-serif",
  display: "swap",
  preload: false,
  fallback: ["ui-serif", "serif"],
});
