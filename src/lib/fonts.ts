import localFont from "next/font/local";

/** Google Sans: primary UI and body family throughout mamaGo. */
export const googleSans = localFont({
  src: [
    {
      path: "../../public/fonts/GoogleSans/GoogleSans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/GoogleSans/GoogleSans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/GoogleSans/GoogleSans-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/GoogleSans/GoogleSans-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-google-sans",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

/** PT Serif: the only editorial serif, all four real faces including Cyrillic. */
export const ptSerif = localFont({
  src: [
    {
      path: "../../public/fonts/PT_Serif-Web-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/PT_Serif-Web-Bold.ttf",
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

/** Backwards-compatible homepage alias; both use the same four PT Serif faces. */
export const ptSerifHome = ptSerif;
