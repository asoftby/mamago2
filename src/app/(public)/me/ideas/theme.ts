/** Local warm-editorial palette for this page only — do not promote to the global Tailwind theme. */
export const C = {
  bg: "#F6F2EA",
  paper: "#FAF7F1",
  ink: "#141210",
  ink2: "#3A332B",
  ink3: "rgba(20,18,16,.55)",
  line: "rgba(20,18,16,.10)",
  line2: "rgba(20,18,16,.18)",
  accent: "#E86A3A",
  accentDeep: "#C24E22",
  accentSoft: "#FFE8DC",
} as const;

/** Poster fallback gradients for ideas without a cover image. */
export const TONES = {
  warm: "linear-gradient(160deg, #F2C8A7, #E89460)",
  sun: "linear-gradient(160deg, #F6D567, #E8B935)",
  soft: "linear-gradient(160deg, #E6DBC8, #C9BCA0)",
  mint: "linear-gradient(160deg, #CDE3D6, #9CC1AC)",
  ink: "linear-gradient(160deg, #2A2622, #141210)",
  vintage: "linear-gradient(160deg, #F4E9D4, #D9C7A0)",
} as const;

const TONE_KEYS = Object.keys(TONES) as Array<keyof typeof TONES>;

/** Deterministic tone per idea so the same card doesn't flicker between tones on re-render. */
export function toneForId(id: string): keyof typeof TONES {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TONE_KEYS[hash % TONE_KEYS.length];
}

const MONTHS_RU = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function formatAddedDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}
