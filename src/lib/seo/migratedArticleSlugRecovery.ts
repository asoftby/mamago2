/**
 * Verified migrated CITY articles whose legacy WP redirect destination still
 * points at the pre-migration slug instead of the current PROD slug.
 *
 * Evidence: docs/migration/reviews/article-geoscope-source-2026-08-15.ndjson
 * (targetArticleId + legacyPermalinkPath + legacyPostId per row).
 */
export type MigratedArticleSlugRecovery = {
  legacySourcePath: string;
  articleId: string;
  legacyPostId: number;
  currentProdSlug: string;
  gscClicks: number;
};

export const MINSK_CITY_SLUG = "minsk";

export function cityBlogPath(slug: string, citySlug = MINSK_CITY_SLUG): string {
  return `/${citySlug}/blog/${slug}`;
}

export const MIGRATED_ARTICLE_SLUG_RECOVERIES: MigratedArticleSlugRecovery[] = [
  {
    legacySourcePath: "/top-18-kafe-i-restoranov-s-detskoj-ploshhadkoj-ili-komnatoj",
    articleId: "cmsswy95w034ywsqhtdtya6t4",
    legacyPostId: 21537,
    currentProdSlug: "top-18-kafe-i-restoranov-s-detskoy-ploshchadkoy-ili-komnatoy",
    gscClicks: 8807,
  },
  {
    legacySourcePath: "/10-parkov-dlya-aktivnogo-otdyha-i-razvlecheniy-v-minske",
    articleId: "cmsswyqze03amwsqhrkm0afc6",
    legacyPostId: 21932,
    currentProdSlug: "10-parkov-dlja-aktivnogo-otdyha-i-razvlechenij-v-minske",
    gscClicks: 4167,
  },
  {
    legacySourcePath: "/novogodnie-fotozony-minska-40-fotozon-i-40-idey-pochemu-stoit-tuda-shodit",
    articleId: "cmssu3til01k0wsobe87c51bg",
    legacyPostId: 34363,
    currentProdSlug: "novogodnie-fotozony-minska-40-fotozon-i-40-idej-pochemu-stoit-tuda-shodit",
    gscClicks: 3216,
  },
  {
    legacySourcePath: "/sportivnye-kruzhki-i-sekcii-dlya-detey-v-minske",
    articleId: "cmsswzu4z03qqwsqh6axbx74n",
    legacyPostId: 23812,
    currentProdSlug: "sportivnye-kruzhki-i-sekcii-dlja-detej-v-minske",
    gscClicks: 394,
  },
  {
    legacySourcePath: "/tvorcheskie-muzykalnye-i-yazykovye-kruzhki-i-sekcii-dlya-detey-v-minske",
    articleId: "cmssu0ow1007cwsobcv282mvt",
    legacyPostId: 24695,
    currentProdSlug: "tvorcheskie-muzykalnye-i-jazykovye-kruzhki-i-sekcii-dlja-detej-v-minske",
    gscClicks: 258,
  },
  {
    legacySourcePath: "/lyubimye-detskie-kluby-kofeyni-i-igrovye-minska",
    articleId: "cmsswz6a903fywsqhejbhg6gu",
    legacyPostId: 22603,
    currentProdSlug: "ljubimye-detskie-kluby-kofejni-i-igrovye-minska",
    gscClicks: 246,
  },
  {
    legacySourcePath: "/top-idey-chto-podarit-mame-na-den-materi-interesnye-i-originalnye-podarki-pro-emocii",
    articleId: "cmssu29u000xswsobs5591cis",
    legacyPostId: 28546,
    currentProdSlug: "top-idej-chto-podarit-mame-na-den-materi-interesnye-i-originalnye-podarki-pro-jemocii",
    gscClicks: 180,
  },
  {
    legacySourcePath: "/pervyy-detskiy-sad-severnogo-berega",
    articleId: "cmssu26ev00wcwsobwpy1glg0",
    legacyPostId: 27355,
    currentProdSlug: "4-8-mln-za-pervyj-detskij-sad-severnogo-berega",
    gscClicks: 159,
  },
  {
    legacySourcePath: "/novogodniy-gayd-kuda-poyti-na-zimnih-kanikulah-i-gde-otmetit-novyy-god-s-detmi",
    articleId: "cmssu3i7401gcwsobb2h2nsfn",
    legacyPostId: 33899,
    currentProdSlug: "novogodnij-gajd-kuda-pojti-na-zimnih-kanikulah-i-gde-otmetit-novyj-god-s-detmi",
    gscClicks: 64,
  },
  {
    legacySourcePath: "/mama-ya-sam-ferma",
    articleId: "cmssu2p6p013swsob5sfq3dhv",
    legacyPostId: 30642,
    currentProdSlug: "mama-ja-sam-ferma-luchshee-mesto-dlja-vsej-semi",
    gscClicks: 25,
  },
  {
    legacySourcePath: "/gde-otmetit-den-rozhdeniya-v-krytom-parke-10-klassnyh-parkov-razvlecheniy-dlya-prazdnika",
    articleId: "cmssu30ek019kwsobf832vz78",
    legacyPostId: 31021,
    currentProdSlug: "gde-otmetit-den-rozhdenija-v-krytom-parke-10-klassnyh-parkov-razvlechenij-dlja-prazdnika",
    gscClicks: 11,
  },
];

export function expectedLegacyRedirectDestination(recovery: MigratedArticleSlugRecovery): string {
  return cityBlogPath(recovery.currentProdSlug);
}
