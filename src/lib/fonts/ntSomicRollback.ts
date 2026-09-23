import localFont from "next/font/local";

/**
 * Rollback-only primary font retained until Google Sans is visually approved.
 * Keep this module out of the runtime import graph unless rollback is needed.
 */
export const ntSomic = localFont({
  src: [
    {
      path: "../../../public/fonts/NTSomic/NTSomic-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/NTSomic/NTSomic-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/fonts/NTSomic/NTSomic-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../../public/fonts/NTSomic/NTSomic-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
  preload: false,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
