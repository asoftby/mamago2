/**
 * Email-safe design tokens for mamaGo.
 *
 * Email clients do not reliably support CSS custom properties, so these
 * values mirror the brand colors in src/app/globals.css as inline styles.
 */
export const emailTheme = {
  accent: "#EF8759",
  accentHover: "#E07848",
  accentSoft: "#FFF2EB",
  ink: "#211F1D",
  text: "#383431",
  muted: "#68635E",
  mutedLight: "#847C74",
  canvas: "#F8F7F5",
  paper: "#FFFFFF",
  warm: "#FFF1D9",
  border: "#EAE5DF",
  bg: "#FFFFFF",
} as const;

export const emailFontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
