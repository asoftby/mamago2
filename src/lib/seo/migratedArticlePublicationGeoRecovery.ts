import type { GeoScope } from "@prisma/client";

/**
 * Verified migrated articles left `status=PENDING`, `geoScope=NULL`,
 * `cityId=NULL` after Phase 1 (PR #159) corrected their legacy redirect
 * slugs but did not touch publication state or geography.
 *
 * Evidence: docs/migration/reviews/article-publication-geo-recovery-2026-08-31.md
 * (editorial re-read of title/body/headings for all 9 rows; 2 of them
 * override the 2026-08-15 owner-review auto-classification after a direct
 * content re-audit).
 */
export type MigratedArticlePublicationGeoRecovery = {
  articleId: string;
  title: string;
  currentSlug: string;
  legacyUrl: string;
  geoScope: Extract<GeoScope, "CITY" | "COUNTRY">;
  citySlug: "minsk" | null;
  confidence: "HIGH" | "MEDIUM";
  reason: string;
};

export const MINSK_CITY_SLUG = "minsk";

export const MIGRATED_ARTICLE_PUBLICATION_GEO_RECOVERIES: MigratedArticlePublicationGeoRecovery[] = [
  {
    articleId: "cmsswy95w034ywsqhtdtya6t4",
    title: "ТОП-18 кафе и ресторанов с детской площадкой или комнатой",
    currentSlug: "top-18-kafe-i-restoranov-s-detskoy-ploshchadkoy-ili-komnatoy",
    legacyUrl: "/top-18-kafe-i-restoranov-s-detskoj-ploshhadkoj-ili-komnatoj",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    reason:
      'Body explicitly states scope "в пределах Минска и до 10 км от него"; named Minsk cafes/restaurants.',
  },
  {
    articleId: "cmsswyqze03amwsqhrkm0afc6",
    title: "10 парков для активного отдыха и развлечений в Минске",
    currentSlug: "10-parkov-dlja-aktivnogo-otdyha-i-razvlechenij-v-minske",
    legacyUrl: "/10-parkov-dlya-aktivnogo-otdyha-i-razvlecheniy-v-minske",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    reason: "Title explicitly names Minsk; named park listicle.",
  },
  {
    articleId: "cmssu3til01k0wsobe87c51bg",
    title: "Новогодние фотозоны Минска 2025/2026",
    currentSlug: "novogodnie-fotozony-minska-40-fotozon-i-40-idej-pochemu-stoit-tuda-shodit",
    legacyUrl: "/novogodnie-fotozony-minska-40-fotozon-i-40-idey-pochemu-stoit-tuda-shodit",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    reason: "Title explicitly names Minsk; listicle of named local photo spots.",
  },
  {
    articleId: "cmssu0ow1007cwsobcv282mvt",
    title: "Творческие, музыкальные и языковые кружки и секции для детей в Минске",
    currentSlug: "tvorcheskie-muzykalnye-i-jazykovye-kruzhki-i-sekcii-dlja-detej-v-minske",
    legacyUrl: "/tvorcheskie-muzykalnye-i-yazykovye-kruzhki-i-sekcii-dlya-detey-v-minske",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    reason: "Title explicitly names Minsk; curated list of named Minsk clubs/studios.",
  },
  {
    articleId: "cmssu29u000xswsobs5591cis",
    title:
      "ТОП идей, что подарить маме на День матери: интересные и оригинальные подарки про эмоции.",
    currentSlug:
      "top-idej-chto-podarit-mame-na-den-materi-interesnye-i-originalnye-podarki-pro-jemocii",
    legacyUrl:
      "/top-idey-chto-podarit-mame-na-den-materi-interesnye-i-originalnye-podarki-pro-emocii",
    geoScope: "COUNTRY",
    citySlug: null,
    confidence: "MEDIUM",
    reason:
      "No detected geographic names; generic gift-idea listicle not tied to any city.",
  },
  {
    articleId: "cmssu26ev00wcwsobwpy1glg0",
    title: "4.8 млн.$ за первый детский сад «Северного берега»",
    currentSlug: "4-8-mln-za-pervyj-detskij-sad-severnogo-berega",
    legacyUrl: "/pervyy-detskiy-sad-severnogo-berega",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    reason: 'News about a named residential development ("Северный берег") inside Minsk.',
  },
  {
    articleId: "cmssu3i7401gcwsobb2h2nsfn",
    title: "Новогодний гайд: куда пойти на зимних каникулах и где отметить Новый год с детьми",
    currentSlug: "novogodnij-gajd-kuda-pojti-na-zimnih-kanikulah-i-gde-otmetit-novyj-god-s-detmi",
    legacyUrl:
      "/novogodniy-gayd-kuda-poyti-na-zimnih-kanikulah-i-gde-otmetit-novyy-god-s-detmi",
    geoScope: "COUNTRY",
    citySlug: null,
    confidence: "HIGH",
    reason:
      'Content audit found non-Minsk venues ("Мирский замок" — different oblast, ~100 km; "Станьково" — ~40 km) alongside Minsk ones; materially multi-region.',
  },
  {
    articleId: "cmssu2p6p013swsob5sfq3dhv",
    title: "«Мама, я сам. Ферма» — лучшее место для всей семьи",
    currentSlug: "mama-ja-sam-ferma-luchshee-mesto-dlja-vsej-semi",
    legacyUrl: "/mama-ya-sam-ferma",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    reason: 'Named venue at "Лебяжий" (Lebyazhy), within Minsk city.',
  },
  {
    articleId: "cmssu30ek019kwsobf832vz78",
    title:
      "Где отметить день рождения в крытом парке: 10 классных парков развлечений для праздника",
    currentSlug:
      "gde-otmetit-den-rozhdenija-v-krytom-parke-10-klassnyh-parkov-razvlechenij-dlja-prazdnika",
    legacyUrl:
      "/gde-otmetit-den-rozhdeniya-v-krytom-parke-10-klassnyh-parkov-razvlecheniy-dlya-prazdnika",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    reason:
      "Per-venue audit of all 10 named parks found no non-Minsk geographic marker.",
  },
];

export function expectedFinalCanonicalPath(
  recovery: MigratedArticlePublicationGeoRecovery,
): string {
  return recovery.geoScope === "CITY"
    ? `/${recovery.citySlug}/blog/${recovery.currentSlug}`
    : `/blog/${recovery.currentSlug}`;
}
