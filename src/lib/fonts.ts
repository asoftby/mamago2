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
 * Loaded locally (Source Serif Pro, already present in
 * public/fonts/sourceserifpro/, full Cyrillic coverage confirmed in the
 * Regular/Bold faces) instead of Google Fonts' PT Serif, to remove a
 * remote fetch from `next build` — Docker builds have no route to
 * fonts.gstatic.com, which previously failed Docker Build & Push outright.
 *
 * Only normal-style faces are registered on purpose: this source's italic
 * files (`-It`, `-BoldIt`) ship with zero Cyrillic glyphs, so registering
 * them would silently drop Cyrillic text in `.font-display-italic` to a
 * different fallback font mid-heading. Browsers synthesize a readable
 * "faux italic" from the normal face instead when `font-style: italic` is
 * requested, keeping one consistent face across both scripts.
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
  ],
  variable: "--font-pt-serif",
  display: "swap",
  preload: false,
  fallback: ["ui-serif", "serif"],
});
