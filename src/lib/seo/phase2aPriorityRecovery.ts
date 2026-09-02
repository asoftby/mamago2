/**
 * Phase 2A SEO Recovery: ~52 highest-impact failing URLs (~104,243 historical
 * GSC clicks, ~80% of remaining affected click mass).
 *
 * Source: scripts/tmp/prod-verify/live-matrix-phase2-priority.md
 *         scripts/tmp/prod-verify/phase2a-priority.csv
 *         manifest.csv
 *         scripts/data/wp-redirect-map.json
 *
 * Each entry records:
 * - The legacy WP source URL
 * - The current redirect destination (from manifest)
 * - The entity type and historical GSC clicks
 * - The recommended action after evidence audit
 * - Classification: READY_AUTOMATED, READY_WITH_EXACT_MAPPING, or
 *   BLOCKED_OWNER_REVIEW
 *
 * Classification rules:
 * - READY_AUTOMATED: P2-A articles with deterministic geo/recovery path
 *   (same pattern as Phase 1B). Includes articles whose title/intent/origin
 *   is unambiguous from the existing recovery evidence or manifest data.
 * - READY_WITH_EXACT_MAPPING: Past events or articles that need a specific
 *   equivalent landing page or current-season update, where the destination
 *   is unambiguous.
 * - BLOCKED_OWNER_REVIEW: Unclear semantic destination, multi-region article
 *   without prior owner review, or cases needing editorial judgment.
 */

/** Primary recovery action for a Phase 2A entry. */
export type Phase2Action =
  | "RESTORE_EXISTING_CONTENT"
  | "SEMANTIC_REDIRECT"
  | "UPDATE_RECURRING_OR_SEASONAL"
  | "REDIRECT_LOGIC_FIX"
  | "410_GONE"
  | "SOFT_404_HTTP_FIX"
  | "MANUAL_REVIEW";

/** PLAN-time classification after checking current PROD state. */
export type Phase2PlanAction =
  | "apply"
  | "already_applied"
  | "conflict"
  | "not_found"
  | "blocked_owner_review";

/** Readiness for automated implementation. */
export type ReadinessLevel =
  | "READY_AUTOMATED"
  | "READY_WITH_EXACT_MAPPING"
  | "BLOCKED_OWNER_REVIEW";

export type Phase2ARecoveryEntry = {
  /** Sequential position in the P2-A batch (1-indexed). */
  position: number;
  /** Legacy WP source path (from wp-redirect-map.json). */
  legacySourcePath: string;
  /** Entity type from manifest. */
  entityType: string;
  /** Historical GSC clicks from wp-redirect-map.json. */
  gscClicks: number;
  /** Recommended primary action. */
  action: Phase2Action;
  /** Current redirect destination from manifest.csv. */
  currentDestination: string;
  /** Slug for current PROD entity. */
  currentSlug: string;
  /** Exact Article.id from the committed migration geography audit. */
  targetArticleId?: string;
  /** Readiness for automated implementation. */
  readiness: ReadinessLevel;
  /** Evidence-based geo classification for articles. */
  geoScope: "CITY" | "COUNTRY" | null;
  /** For CITY articles: the citySlug (typically "minsk"). */
  citySlug: string | null;
  /** Confidence in the evidence. */
  confidence: "HIGH" | "MEDIUM" | "LOW";
  /** Human-readable evidence summary. */
  evidence: string;
  /**
   * Owner-review batch ID for BLOCKED rows.
   * Groups related ambiguous entries for efficient owner review.
   */
  ownerReviewBatch?: string;
  /** For events: whether the legacy URL is single-edition (expired) or recurring. */
  isRecurring?: boolean;
};

/**
 * All 52 Phase 2A entries, sorted by historical GSC clicks descending.
 *
 * Excludes:
 * - Phase 1 articles (already PASS)
 * - Hub remaps (event-category, place, place-category — already PASS_INDEXABLE)
 * - The /ivan-kupala-2025 article is INCLUDED here because although its redirect
 *   works, the destination article is still PENDING/soft-404 (it needs content
 *   restoration). Its high 12,535 clicks make it the #1 priority.
 */
export const PHASE_2A_PRIORITY_RECOVERIES: Phase2ARecoveryEntry[] = [
  // ============================================================
  // 1-25: RESTORE_EXISTING_CONTENT articles
  // ============================================================
  {
    position: 1,
    legacySourcePath: "/ivan-kupala-2025-ili-gde-otmetit-kupale-v-minske",
    currentDestination: "/minsk/blog/ivan-kupala-2025-ili-gde-otmetit-kupale-v-minske",
    currentSlug: "ivan-kupala-2025-ili-gde-otmetit-kupale-v-minske",
    entityType: "article",
    gscClicks: 12535,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title explicitly states 'в Минске', but the committed migration geography audits contain no exact targetArticleId for this slug. Automated recovery must fail closed until the target ID is audited.",
    ownerReviewBatch: "p2a-missing-target-id",
  },
  {
    position: 2,
    legacySourcePath: "/gde-otmetit-den-rozhdeniya-rebenka-10-krutyh-mest-v-gorode",
    currentDestination: "/minsk/blog/gde-otmetit-den-rozhdeniya-rebenka-10-krutyh-mest-v-gorode",
    currentSlug: "gde-otmetit-den-rozhdeniya-rebenka-10-krutyh-mest-v-gorode",
    targetArticleId: "cmsswxmyw02viwsqh3yederzv",
    entityType: "article",
    gscClicks: 8355,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Birthday venue guide with local Minsk venues. 'в городе' implies city scope. Same pattern as Phase 1B CITY articles.",
  },
  {
    position: 3,
    legacySourcePath: "/lyubimye-plyazhi-i-otkrytye-basseyny-v-minske-i-nepodalyoku",
    currentDestination: "/minsk/blog/lyubimye-plyazhi-i-otkrytye-basseyny-v-minske-i-nepodalyoku",
    currentSlug: "lyubimye-plyazhi-i-otkrytye-basseyny-v-minske-i-nepodalyoku",
    targetArticleId: "cmsswzhug03liwsqhinljyzat",
    entityType: "article",
    gscClicks: 6329,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title explicitly states 'в Минске и неподалёку' (in Minsk and nearby). Seasonal summer content but evergreen pool/beach recommendations. Same pattern as Phase 1B CITY articles.",
  },
  {
    position: 4,
    legacySourcePath: "/gde-otmetit-den-rozhdeniya-rebenka-7",
    currentDestination: "/minsk/blog/gde-otmetit-den-rozhdeniya-rebenka-7",
    currentSlug: "gde-otmetit-den-rozhdeniya-rebenka-7",
    targetArticleId: "cmsswt2ux017qwsqhz5wses40",
    entityType: "article",
    gscClicks: 4202,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Another birthday venue article (different slug from position 2). Same Minsk scope by analogy. Same Phase 1B CITY pattern.",
  },
  {
    position: 5,
    legacySourcePath: "/park-ugo-chavesa-samyy-bolshoy-skeyt-park-zamok-i-attrakciony",
    currentDestination: "/minsk/blog/park-ugo-chavesa-samyy-bolshoy-skeyt-park-zamok-i-attrakciony",
    currentSlug: "park-ugo-chavesa-samyy-bolshoy-skeyt-park-zamok-i-attrakciony",
    targetArticleId: "cmsswz2qn03eewsqh4jjfwnyp",
    entityType: "article",
    gscClicks: 4040,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      'Article about "Парк Уго Чавеса" (Hugo Chavez Park) — a specific named park in Minsk. Same CITY pattern.',
  },
  {
    position: 6,
    legacySourcePath: "/maslenicza-2026-v-minske-kuda-pojti-s-detmi-i-gde-otmetit-prazdnik",
    currentDestination: "/minsk/blog/maslenicza-2026-v-minske-kuda-pojti-s-detmi-i-gde-otmetit-prazdnik",
    currentSlug: "maslenicza-2026-v-minske-kuda-pojti-s-detmi-i-gde-otmetit-prazdnik",
    targetArticleId: "cmssu87h700j6ws3f9pfvedqx",
    entityType: "article",
    gscClicks: 3683,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title explicitly 'в Минске'. Maslenitsa is annual/perennial. Content can be updated annually. Same CITY pattern.",
  },
  {
    position: 7,
    legacySourcePath: "/mashiny-pomoshhniki-v-minske-otkrylsya-detskij-gorod-professij",
    currentDestination: "/minsk/blog/mashiny-pomoshhniki-v-minske-otkrylsya-detskij-gorod-professij",
    currentSlug: "mashiny-pomoshhniki-v-minske-otkrylsya-detskij-gorod-professij",
    targetArticleId: "cmssx0z0w045mwsqhjk4khd0c",
    entityType: "article",
    gscClicks: 2964,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title 'в Минске'. Article about a specific children's city of professions. The venue still operates. Same CITY pattern.",
  },
  {
    position: 8,
    legacySourcePath: "/kuda-shodit-s-rebenkom-v-minske-v-den-zashhity-detej-1-iyunya",
    currentDestination: "/minsk/blog/kuda-shodit-s-rebenkom-v-minske-v-den-zashhity-detej-1-iyunya",
    currentSlug: "kuda-shodit-s-rebenkom-v-minske-v-den-zashhity-detej-1-iyunya",
    targetArticleId: "cmssx0yzs045iwsqhztlqbaty",
    entityType: "article",
    gscClicks: 2451,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title explicitly 'в Минске'. Children's Day annual guide with local Minsk venues. Same CITY pattern.",
  },
  {
    position: 9,
    legacySourcePath: "/bassejny-minsk-i-ne-tolko-ili-akvazony-na-vse-sluchai-zhizni",
    currentDestination: "/minsk/blog/bassejny-minsk-i-ne-tolko-ili-akvazony-na-vse-sluchai-zhizni",
    currentSlug: "bassejny-minsk-i-ne-tolko-ili-akvazony-na-vse-sluchai-zhizni",
    targetArticleId: "cmssx0e8l03yewsqhwpgxssmh",
    entityType: "article",
    gscClicks: 2110,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title starts with 'бассейны Минск' (Minsk pools). Pools/pools Minsk. Seasonal but annual summer content. Same CITY pattern.",
  },
  {
    position: 10,
    legacySourcePath: "/novyj-god-2026-ili-kuda-shodit-na-novogodnih-kanikulah-v-minske",
    currentDestination: "/minsk/blog/novyj-god-2026-ili-kuda-shodit-na-novogodnih-kanikulah-v-minske",
    currentSlug: "novyj-god-2026-ili-kuda-shodit-na-novogodnih-kanikulah-v-minske",
    targetArticleId: "cmssu7oz600c6ws3fwvsis0lm",
    entityType: "article",
    gscClicks: 2092,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title 'в Минске'. New Year guide 2026 — annual content. Same CITY pattern. Update year in title for 2027.",
  },
  {
    position: 11,
    legacySourcePath: "/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
    currentDestination: "/minsk/blog/lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
    currentSlug: "lyubimye-mesta-v-grodno-i-v-okrestnostyah-na-mashine-ili-avtodome",
    entityType: "article",
    gscClicks: 1114,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: null,
    citySlug: null,
    confidence: "MEDIUM",
    evidence:
      "Title about Grodno (a different city, not Minsk). Current redirect goes to /minsk/blog/ which is the wrong city scope. Needs owner decision on whether to scope to Grodno or COUNTRY.",
    ownerReviewBatch: "p2a-non-minsk-cities",
  },
  {
    position: 12,
    legacySourcePath: "/kuda-shodit-14-go-fevralya-raznym-tipam-parochek",
    currentDestination: "/minsk/blog/kuda-shodit-14-go-fevralya-raznym-tipam-parochek",
    currentSlug: "kuda-shodit-14-go-fevralya-raznym-tipam-parochek",
    // No targetArticleId exists for this slug in the committed geography audits.
    entityType: "article",
    gscClicks: 1033,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Valentine's Day guide, but the committed migration geography audits contain no exact targetArticleId for this slug. Automated recovery must fail closed until the target ID is audited.",
    ownerReviewBatch: "p2a-missing-target-id",
  },
  {
    position: 13,
    legacySourcePath: "/kruzhki-i-sekczii-dlya-detej-v-minske",
    currentDestination: "/minsk/blog/kruzhki-i-sekczii-dlya-detej-v-minske",
    currentSlug: "kruzhki-i-sekczii-dlya-detej-v-minske",
    targetArticleId: "cmssx1t6r04gqwsqh5m5xl8d3",
    entityType: "article",
    gscClicks: 836,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title 'в Минске'. Children's clubs and sections article. Same pattern as Phase 1 article with similar topic. Same CITY pattern.",
  },
  {
    position: 14,
    legacySourcePath: "/detskiy-den-rozhdeniya-na-prirode",
    currentDestination: "/blog/detskiy-den-rozhdeniya-na-prirode",
    currentSlug: "detskiy-den-rozhdeniya-na-prirode",
    targetArticleId: "cmsswvwih029qwsqh1es4dlf9",
    entityType: "article",
    gscClicks: 804,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "COUNTRY",
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Authoritative geography audit classifies this general outdoor birthday guide GLOBAL/HIGH: no venue or city dependency.",
  },
  {
    position: 15,
    legacySourcePath: "/besedki-dlya-dnya-rozhdeniya-na-prirode",
    currentDestination: "/minsk/blog/besedki-dlya-dnya-rozhdeniya-na-prirode",
    currentSlug: "besedki-dlya-dnya-rozhdeniya-na-prirode",
    targetArticleId: "cmssww3vh02cewsqhng38x353",
    entityType: "article",
    gscClicks: 743,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: null,
    citySlug: null,
    confidence: "MEDIUM",
    evidence:
      "Committed geography audit classifies this target UNCLEAR. Redirect destination is not geography evidence; owner review is required.",
    ownerReviewBatch: "p2a-ambiguous-scope",
  },
  {
    position: 16,
    legacySourcePath:
      "/kuda-otvesti-malchishek-otkrylas-pervaya-v-minske-ogromnaya-krytaya-pesochnica-so-spectehnikoy-mama-ya-sam",
    currentDestination:
      "/minsk/blog/kuda-otvesti-malchishek-otkrylas-pervaya-v-minske-ogromnaya-krytaya-pesochnica-so-spectehnikoy-mama-ya-sam",
    currentSlug:
      "kuda-otvesti-malchishek-otkrylas-pervaya-v-minske-ogromnaya-krytaya-pesochnica-so-spectehnikoy-mama-ya-sam",
    targetArticleId: "cmsswskgb010qwsqhjlfnon3t",
    entityType: "article",
    gscClicks: 726,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title 'в Минске'. Sandbox playground article — specific named venue in Minsk. Same CITY pattern.",
  },
  {
    position: 17,
    legacySourcePath: "/akvapark-v-molodechno-i-vkusnjushhshhshhie-burgery",
    currentDestination: "/minsk/blog/akvapark-v-molodechno-i-vkusnjushhshhshhie-burgery",
    currentSlug: "akvapark-v-molodechno-i-vkusnjushhshhshhie-burgery",
    entityType: "article",
    gscClicks: 719,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: null,
    citySlug: null,
    confidence: "MEDIUM",
    evidence:
      "About aquapark in Molodechno (a town ~40km from Minsk, different district). Current redirect /minsk/blog/ is wrong. Needs owner decision: scope to COUNTRY or remove Minsk cityId.",
    ownerReviewBatch: "p2a-non-minsk-cities",
  },
  {
    position: 18,
    legacySourcePath: "/kak-otmetit-detskij-den-rozhdeniya-10-idej-dlya-neobychnogo-prazdnika",
    currentDestination: "/minsk/blog/kak-otmetit-detskij-den-rozhdeniya-10-idej-dlya-neobychnogo-prazdnika",
    currentSlug: "kak-otmetit-detskij-den-rozhdeniya-10-idej-dlya-neobychnogo-prazdnika",
    targetArticleId: "cmssx19v204a2wsqhtcobt2ye",
    entityType: "article",
    gscClicks: 582,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Birthday ideas article. Current redirect /minsk/blog/. Same pattern as other birthday articles. CITY by redirect destination.",
  },
  {
    position: 19,
    legacySourcePath: "/chem-zanjat-podrostka-10-sovmestnyh-dnej-letom-v-minske",
    currentDestination: "/minsk/blog/chem-zanjat-podrostka-10-sovmestnyh-dnej-letom-v-minske",
    currentSlug: "chem-zanjat-podrostka-10-sovmestnyh-dnej-letom-v-minske",
    targetArticleId: "cmsswyoc0039mwsqhae6xu955",
    entityType: "article",
    gscClicks: 543,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    evidence:
      "Title 'в Минске'. Teen summer activity guide. Same CITY pattern.",
  },
  {
    position: 20,
    legacySourcePath: "/leto-2026-zagorodnyy-i-gorodskoy-otdyh-dlya-detey",
    currentDestination: "/minsk/blog/leto-2026-zagorodnyy-i-gorodskoy-otdyh-dlya-detey",
    currentSlug: "leto-2026-zagorodnyy-i-gorodskoy-otdyh-dlya-detey",
    targetArticleId: "cmssx0ttq043ewsqhyzzcpx7u",
    entityType: "article",
    gscClicks: 537,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: null,
    citySlug: null,
    confidence: "MEDIUM",
    evidence:
      "Committed geography audit classifies this target UNCLEAR due mixed city/out-of-town coverage. Owner review is required.",
    ownerReviewBatch: "p2a-ambiguous-scope",
  },
  {
    position: 21,
    legacySourcePath: "/gde-ostavit-rebenka-s-nyaney",
    currentDestination: "/minsk/blog/gde-ostavit-rebenka-s-nyaney",
    currentSlug: "gde-ostavit-rebenka-s-nyaney",
    targetArticleId: "cmsswtnwj01fiwsqhglz4e7xb",
    entityType: "article",
    gscClicks: 523,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: null,
    citySlug: null,
    confidence: "MEDIUM",
    evidence:
      "Committed geography audit classifies this generic nanny guide UNCLEAR. Redirect destination is insufficient evidence; owner review is required.",
    ownerReviewBatch: "p2a-ambiguous-scope",
  },
  {
    position: 22,
    legacySourcePath: "/kosmos-novyy-park-i-zona-otdyha-mezhdu-sportivnoy-i-kuncevshchinoy",
    currentDestination: "/minsk/blog/kosmos-novyy-park-i-zona-otdyha-mezhdu-sportivnoy-i-kuncevshchinoy",
    currentSlug: "kosmos-novyy-park-i-zona-otdyha-mezhdu-sportivnoy-i-kuncevshchinoy",
    targetArticleId: "cmsswz3ll03euwsqhvmzwi8r2",
    entityType: "article",
    gscClicks: 463,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "READY_AUTOMATED",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "MEDIUM",
    evidence:
      "New park 'Kosmos' between Sportivnaya and Kuntsaushchyna (Minsk metro stations). The metro stations are in Minsk. Same CITY pattern.",
  },
  {
    position: 23,
    legacySourcePath: "/ekotropy",
    currentDestination: "/minsk/blog/ekotropy",
    currentSlug: "ekotropy",
    entityType: "article",
    gscClicks: 456,
    action: "RESTORE_EXISTING_CONTENT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: null,
    citySlug: null,
    confidence: "LOW",
    evidence:
      "Title 'Экотропы' (eco-trails). Generic topic — could be CITY (Minsk eco-trails) or COUNTRY (Belarus eco-trails). Need owner decision.",
    ownerReviewBatch: "p2a-ambiguous-scope",
  },
  {
    position: 24,
    legacySourcePath: "/leto-2025-zagorodnyy-i-gorodskoy-otdyh-dlya-detey",
    currentDestination: "/minsk/blog/leto-2025-zagorodnyy-i-gorodskoy-otdyh-dlya-detey",
    currentSlug: "leto-2025-zagorodnyy-i-gorodskoy-otdyh-dlya-detey",
    entityType: "article",
    gscClicks: 432,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "MEDIUM",
    evidence:
      "Summer 2025 article — the 2026 edition exists (position 20, leto-2026). Redirect 2025 -> 2026 as recurring/updated content.",
  },

  // ============================================================
  // 25+: SEMANTIC_REDIRECT events
  // ============================================================
  {
    position: 25,
    legacySourcePath: "/events/festival-lidbeer-2025-lidbir",
    currentDestination: "/minsk/events/festival-lidbeer-2025-lidbir",
    currentSlug: "festival-lidbeer-2025-lidbir",
    entityType: "event",
    gscClicks: 4587,
    action: "SEMANTIC_REDIRECT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: null,
    citySlug: null,
    confidence: "MEDIUM",
    evidence:
      "Lidbeer 2025 festival. Single-edition past event with no 2026 edition. Candidate for SEMANTIC_REDIRECT to /minsk/events. But Lidbeer may have 2026 edition — needs confirmation.",
    ownerReviewBatch: "p2a-event-semantic-destination",
    isRecurring: false,
  },
  {
    position: 26,
    legacySourcePath: "/events/serija-koncertov-klassika-u-ratushi",
    currentDestination: "/minsk/events/serija-koncertov-klassika-u-ratushi",
    currentSlug: "serija-koncertov-klassika-u-ratushi",
    entityType: "event",
    gscClicks: 4211,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Concert series 'Klassika u Ratushi' — recurring series. May have 2026 edition. If 2026 edition exists, redirect 2025->2026. If not, redirect to /minsk/events.",
    isRecurring: true,
  },
  {
    position: 27,
    legacySourcePath: "/events/bolshaya-kosmicheskaya-vystavka-kosmopark",
    currentDestination: "/minsk/events/bolshaya-kosmicheskaya-vystavka-kosmopark",
    currentSlug: "bolshaya-kosmicheskaya-vystavka-kosmopark",
    entityType: "event",
    gscClicks: 3447,
    action: "SEMANTIC_REDIRECT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Past space exhibition at Kosmopark. No exact current equivalent is configured; a generic /minsk/events hub is not a semantic equivalent.",
    ownerReviewBatch: "p2a-event-semantic-destination",
    isRecurring: false,
  },
  {
    position: 28,
    legacySourcePath: "/events/teatralnaya-gostinaya-v-rakovskom-dvorike-sezon-2025",
    currentDestination: "/minsk/events/teatralnaya-gostinaya-v-rakovskom-dvorike-sezon-2025",
    currentSlug: "teatralnaya-gostinaya-v-rakovskom-dvorike-sezon-2025",
    entityType: "event",
    gscClicks: 2930,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Theater series at Rakovsky Dvorik — has 'season 2025' in slug. Check for 2026 season edition. If exists, redirect 2025->2026. If not, /minsk/events.",
    isRecurring: true,
  },
  {
    position: 29,
    legacySourcePath: "/events/vechera-organnoj-muzyki-svjashhennaja-simfonija",
    currentDestination: "/minsk/events/vechera-organnoj-muzyki-svjashhennaja-simfonija",
    currentSlug: "vechera-organnoj-muzyki-svjashhennaja-simfonija",
    entityType: "event",
    gscClicks: 2418,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Organ music concert series. Recurring. Check for current season. Redirect to /minsk/events if no current edition.",
    isRecurring: true,
  },
  {
    position: 30,
    legacySourcePath: "/events/den-goroda-minska-2025",
    currentDestination: "/minsk/events/den-goroda-minska-2025",
    currentSlug: "den-goroda-minska-2025",
    entityType: "event",
    gscClicks: 2362,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Minsk City Day 2025. Annual event. Check for 2026 edition. If exists, redirect. If not, /minsk/events.",
    isRecurring: true,
  },
  {
    position: 31,
    legacySourcePath: "/events/obshhegorodskie-meropriyatiya-k-novomu-2025-godu-v-minske",
    currentDestination: "/minsk/events/obshhegorodskie-meropriyatiya-k-novomu-2025-godu-v-minske",
    currentSlug: "obshhegorodskie-meropriyatiya-k-novomu-2025-godu-v-minske",
    entityType: "event",
    gscClicks: 1905,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "New Year city events 2025. Annual. Check for 2026/2027 New Year events edition.",
    isRecurring: true,
  },
  {
    position: 32,
    legacySourcePath: "/events/detskaja-zheleznaja-doroga-raspisanie",
    currentDestination: "/minsk/events/detskaja-zheleznaja-doroga-raspisanie",
    currentSlug: "detskaja-zheleznaja-doroga-raspisanie",
    entityType: "event",
    gscClicks: 1497,
    action: "SEMANTIC_REDIRECT",
    readiness: "BLOCKED_OWNER_REVIEW",
    geoScope: null,
    citySlug: null,
    confidence: "MEDIUM",
    evidence:
      "Children's railway schedule — this is a recurring venue (Minsk Children's Railway), not a single event. May need permanent place content. Owner decision needed.",
    ownerReviewBatch: "p2a-event-semantic-destination",
    isRecurring: true,
  },
  {
    position: 33,
    legacySourcePath: "/events/9-maya-v-minske",
    currentDestination: "/minsk/events/9-maya-v-minske",
    currentSlug: "9-maya-v-minske",
    entityType: "event",
    gscClicks: 1039,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "May 9 Victory Day. Annual fixed-date event. Redirect to /minsk/events or check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 34,
    legacySourcePath: "/events/vystavka-paukov-i-reptilij-instinkt-hishhnika",
    currentDestination: "/minsk/events/vystavka-paukov-i-reptilij-instinkt-hishhnika",
    currentSlug: "vystavka-paukov-i-reptilij-instinkt-hishhnika",
    entityType: "event",
    gscClicks: 1028,
    action: "SEMANTIC_REDIRECT",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Spider and reptile exhibition. One-off exhibition, may return seasonally. Redirect to /minsk/events as hub.",
    isRecurring: false,
  },
  {
    position: 35,
    legacySourcePath: "/events/festival-viva-braslav-2025",
    currentDestination: "/minsk/events/festival-viva-braslav-2025",
    currentSlug: "festival-viva-braslav-2025",
    entityType: "event",
    gscClicks: 955,
    action: "SEMANTIC_REDIRECT",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Viva Braslav 2025 festival. Past event with no 2026 edition likely. Redirect /minsk/events.",
    isRecurring: false,
  },
  {
    position: 36,
    legacySourcePath: "/events/teatralnyj-dvorik-afisha-na-ijun",
    currentDestination: "/minsk/events/teatralnyj-dvorik-afisha-na-ijun",
    currentSlug: "teatralnyj-dvorik-afisha-na-ijun",
    entityType: "event",
    gscClicks: 934,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "June theater courtyard poster. Seasonal/recurring. Check for 2026 June edition.",
    isRecurring: true,
  },
  {
    position: 37,
    legacySourcePath: "/events/cikl-koncertov-v-aleksandrovskom-skvere",
    currentDestination: "/minsk/events/cikl-koncertov-v-aleksandrovskom-skvere",
    currentSlug: "cikl-koncertov-v-aleksandrovskom-skvere",
    entityType: "event",
    gscClicks: 931,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Concert series in Alexander Square. Recurring summer series. Check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 38,
    legacySourcePath: "/events/exhibitions-and-museums/vystavka-dva-veka-mody-v-hudozhestvennom",
    currentDestination: "/minsk/events/exhibitions-and-museums/vystavka-dva-veka-mody-v-hudozhestvennom",
    currentSlug: "vystavka-dva-veka-mody-v-hudozhestvennom",
    entityType: "event",
    gscClicks: 914,
    action: "SEMANTIC_REDIRECT",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Fashion exhibition at Khudozhestvenny Museum. Past exhibition. Redirect /minsk/events.",
    isRecurring: false,
  },
  {
    position: 39,
    legacySourcePath: "/events/joga-v-stile-fysm-na-stadione-dinamo",
    currentDestination: "/minsk/events/joga-v-stile-fysm-na-stadione-dinamo",
    currentSlug: "joga-v-stile-fysm-na-stadione-dinamo",
    entityType: "event",
    gscClicks: 909,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Yoga at Dinamo Stadium — recurring summer series. Check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 40,
    legacySourcePath: "/events/3-iyulya-den-nezavisimosti",
    currentDestination: "/minsk/events/3-iyulya-den-nezavisimosti",
    currentSlug: "3-iyulya-den-nezavisimosti",
    entityType: "event",
    gscClicks: 810,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "July 3 Independence Day. Annual fixed-date event. Redirect /minsk/events or check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 41,
    legacySourcePath: "/events/kinopokazy-pod-otkrytym-nebom-v-lejksajd-parke",
    currentDestination: "/minsk/events/kinopokazy-pod-otkrytym-nebom-v-lejksajd-parke",
    currentSlug: "kinopokazy-pod-otkrytym-nebom-v-lejksajd-parke",
    entityType: "event",
    gscClicks: 801,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Outdoor cinema in Lakeside Park. Seasonal summer series. Check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 42,
    legacySourcePath: "/events/czikl-konczertov-v-aleksandrovskom-skvere",
    currentDestination: "/minsk/events/czikl-konczertov-v-aleksandrovskom-skvere",
    currentSlug: "czikl-konczertov-v-aleksandrovskom-skvere",
    entityType: "event",
    gscClicks: 790,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Encoding variant of position 37 (cikl vs czikl). Same concert series. Same treatment.",
    isRecurring: true,
  },
  {
    position: 43,
    legacySourcePath: "/events/holydays/maslenicza-v-lejksajd-parke",
    currentDestination: "/minsk/events/holydays/maslenicza-v-lejksajd-parke",
    currentSlug: "maslenicza-v-lejksajd-parke",
    entityType: "event",
    gscClicks: 760,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Maslenitsa in Lakeside Park. Annual recurring. Check for 2026/2027 edition.",
    isRecurring: true,
  },
  {
    position: 44,
    legacySourcePath: "/events/vishnevyj-festival-v-glubokom",
    currentDestination: "/minsk/events/vishnevyj-festival-v-glubokom",
    currentSlug: "vishnevyj-festival-v-glubokom",
    entityType: "event",
    gscClicks: 676,
    action: "SEMANTIC_REDIRECT",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Cherry festival in Glubokoye (not Minsk). Past single-edition festival. Redirect /minsk/events.",
    isRecurring: false,
  },
  {
    position: 45,
    legacySourcePath: "/events/noch-pozhiratelej-reklamy-2025",
    currentDestination: "/minsk/events/noch-pozhiratelej-reklamy-2025",
    currentSlug: "noch-pozhiratelej-reklamy-2025",
    entityType: "event",
    gscClicks: 631,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Night of Advertising Eaters 2025. May be recurring. Check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 46,
    legacySourcePath: "/events/dzhazovyj-festival-let-s-jaz",
    currentDestination: "/minsk/events/dzhazovyj-festival-let-s-jaz",
    currentSlug: "dzhazovyj-festival-let-s-jaz",
    entityType: "event",
    gscClicks: 628,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Jazz festival 'Let's Jazz'. Summer recurring festival. Check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 47,
    legacySourcePath: "/events/muzej-aviacii-i-kosmonavtiki-torzhestvennoe-otkrytie",
    currentDestination: "/minsk/events/muzej-aviacii-i-kosmonavtiki-torzhestvennoe-otkrytie",
    currentSlug: "muzej-aviacii-i-kosmonavtiki-torzhestvennoe-otkrytie",
    entityType: "event",
    gscClicks: 612,
    action: "SEMANTIC_REDIRECT",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Aviation museum grand opening. The museum venue still exists. Could redirect to museum place page if available, otherwise /minsk/events.",
    isRecurring: false,
  },
  {
    position: 48,
    legacySourcePath: "/events/9-maya-na-memorialnom-komplekse-kurgan-slavy",
    currentDestination: "/minsk/events/9-maya-na-memorialnom-komplekse-kurgan-slavy",
    currentSlug: "9-maya-na-memorialnom-komplekse-kurgan-slavy",
    entityType: "event",
    gscClicks: 559,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "May 9 at Mound of Glory. Annual commemorative event. Check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 49,
    legacySourcePath: "/events/teatralnaya-gostinaya-v-loshiczkom-usadebno-parkovom-komplekse",
    currentDestination: "/minsk/events/teatralnaya-gostinaya-v-loshiczkom-usadebno-parkovom-komplekse",
    currentSlug: "teatralnaya-gostinaya-v-loshiczkom-usadebno-parkovom-komplekse",
    entityType: "event",
    gscClicks: 554,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Theater series in Loshitsky Park Estate. Recurring. Check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 50,
    legacySourcePath: "/events/osennij-salon-s-belgazprombankom-2025",
    currentDestination: "/minsk/events/osennij-salon-s-belgazprombankom-2025",
    currentSlug: "osennij-salon-s-belgazprombankom-2025",
    entityType: "event",
    gscClicks: 542,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Autumn Salon with Belgazprombank 2025. Recurring exhibition. Check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 51,
    legacySourcePath: "/events/kinopokazy-na-kryshe-evo-wellness-club",
    currentDestination: "/minsk/events/kinopokazy-na-kryshe-evo-wellness-club",
    currentSlug: "kinopokazy-na-kryshe-evo-wellness-club",
    entityType: "event",
    gscClicks: 501,
    action: "UPDATE_RECURRING_OR_SEASONAL",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Rooftop cinema at EVO Wellness Club. Seasonal recurring. Check for 2026 edition.",
    isRecurring: true,
  },
  {
    position: 52,
    legacySourcePath: "/events/czirk-shapito-13-metrov",
    currentDestination: "/minsk/events/czirk-shapito-13-metrov",
    currentSlug: "czirk-shapito-13-metrov",
    entityType: "event",
    gscClicks: 477,
    action: "SEMANTIC_REDIRECT",
    readiness: "READY_WITH_EXACT_MAPPING",
    geoScope: null,
    citySlug: null,
    confidence: "HIGH",
    evidence:
      "Cirque tent show 'Shapito 13 metrov'. Past touring show. Redirect /minsk/events.",
    isRecurring: false,
  },
];

export function summarizePhase2A(): {
  total: number;
  totalClicks: number;
  actionBreakdown: Record<string, number>;
  readinessBreakdown: Record<string, number>;
  geoBreakdown: Record<string, number>;
  ownerReviewBatches: Record<string, number>;
} {
  const total = PHASE_2A_PRIORITY_RECOVERIES.length;
  const totalClicks = PHASE_2A_PRIORITY_RECOVERIES.reduce((sum, r) => sum + r.gscClicks, 0);
  const actionBreakdown: Record<string, number> = {};
  const readinessBreakdown: Record<string, number> = {};
  const geoBreakdown: Record<string, number> = {};
  const ownerReviewBatches: Record<string, number> = {};

  for (const entry of PHASE_2A_PRIORITY_RECOVERIES) {
    actionBreakdown[entry.action] = (actionBreakdown[entry.action] ?? 0) + 1;
    readinessBreakdown[entry.readiness] = (readinessBreakdown[entry.readiness] ?? 0) + 1;
    const geoKey = entry.geoScope ?? "null";
    geoBreakdown[geoKey] = (geoBreakdown[geoKey] ?? 0) + 1;
    if (entry.ownerReviewBatch) {
      ownerReviewBatches[entry.ownerReviewBatch] =
        (ownerReviewBatches[entry.ownerReviewBatch] ?? 0) + 1;
    }
  }

  return { total, totalClicks, actionBreakdown, readinessBreakdown, geoBreakdown, ownerReviewBatches };
}

/** Get all entries with a specific readiness level. */
export function entriesByReadiness(level: ReadinessLevel): Phase2ARecoveryEntry[] {
  return PHASE_2A_PRIORITY_RECOVERIES.filter((e) => e.readiness === level);
}

/** Get entries for a specific owner-review batch. */
export function entriesByOwnerReviewBatch(batchId: string): Phase2ARecoveryEntry[] {
  return PHASE_2A_PRIORITY_RECOVERIES.filter((e) => e.ownerReviewBatch === batchId);
}

/** Validate that all positions are unique and sequential. */
export function validatePhase2AIntegrity(): string[] {
  const errors: string[] = [];
  const positions = PHASE_2A_PRIORITY_RECOVERIES.map((e) => e.position);
  const uniquePositions = new Set(positions);
  if (uniquePositions.size !== positions.length) {
    errors.push(`Duplicate positions: ${positions.length} total, ${uniquePositions.size} unique`);
  }
  for (let i = 1; i <= positions.length; i++) {
    if (!positions.includes(i)) {
      errors.push(`Missing position ${i}`);
    }
  }
  if (positions[0] !== 1) {
    errors.push(`First position is ${positions[0]} instead of 1`);
  }
  const automatedArticles = PHASE_2A_PRIORITY_RECOVERIES.filter((entry) =>
    entry.entityType === "article" && entry.action === "RESTORE_EXISTING_CONTENT" &&
    entry.readiness === "READY_AUTOMATED",
  );
  for (const entry of automatedArticles) {
    if (!entry.targetArticleId) errors.push(`Position ${entry.position}: missing audited targetArticleId`);
  }
  if (new Set(automatedArticles.map((entry) => entry.targetArticleId)).size !== automatedArticles.length) {
    errors.push("Automated article targetArticleId values must be unique");
  }
  return errors;
}
