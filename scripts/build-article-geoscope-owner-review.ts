/**
 * Builds the owner-review artifacts for the 107 Article geo-scope
 * OWNER_DECISION records from `docs/migration/reviews/article-geoscope-source-2026-08-15.ndjson`.
 *
 * Read-only / local-only: reads the committed NDJSON source, never touches
 * the DB, never writes Article.geoScope/cityId, never touches PROD/WP.
 *
 * The CLASSIFICATIONS map below is Claude Code's editorial recommendation
 * for each article — formed by reading title + body + categories + tags +
 * headings + detected geo names + relation evidence for all 107 rows. This
 * is NOT a mechanical/keyword rule (e.g. "title contains Минск" alone is
 * explicitly not sufficient per the review brief) — each entry's `reason`
 * states the actual evidence considered. It is a recommendation for owner
 * approval, never automatic migration evidence — no DB write follows from
 * running this script.
 *
 * Run: pnpm tsx scripts/build-article-geoscope-owner-review.ts
 * Outputs:
 *   docs/migration/reviews/article-geoscope-owner-review-2026-08-15.csv
 *   docs/migration/reviews/article-geoscope-owner-review-2026-08-15.md
 *   docs/migration/reviews/article-geoscope-summary-2026-08-15.json (adds `ownerReviewResult`)
 */
import fs from "node:fs";

type Scope = "CITY_MINSK" | "GLOBAL" | "UNCLEAR";
type Confidence = "HIGH" | "MEDIUM" | "LOW";
type Flag =
  | "TITLE_CITY_BODY_GLOBAL"
  | "TITLE_GLOBAL_BODY_CITY"
  | "MIXED_MINSK_BELARUS"
  | "SOFT_SLUG_MISMATCH"
  | "AMBIGUOUS_RELATIONS"
  | "OTHER_REVIEW";

interface Classification {
  scope: Scope;
  conf: Confidence;
  reason: string;
  flags: Flag[];
}

interface SourceRow {
  legacyPostId: number;
  targetArticleId: string;
  title: string;
  slug: string;
  legacyPermalink: string;
}

const SOURCE_PATH = "docs/migration/reviews/article-geoscope-source-2026-08-15.ndjson";
const SUMMARY_PATH = "docs/migration/reviews/article-geoscope-summary-2026-08-15.json";
const CSV_PATH = "docs/migration/reviews/article-geoscope-owner-review-2026-08-15.csv";
const MD_PATH = "docs/migration/reviews/article-geoscope-owner-review-2026-08-15.md";

const CLASSIFICATIONS: Record<number, Classification> = {
  9704:  { scope: "CITY_MINSK", conf: "HIGH",   reason: "Review of one specific venue (Гранд Бублик, Братская 6А, ЖК Минск-Мир) with prices and address — the content is the venue itself.", flags: [] },
  24695: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Curated list of real, named Minsk children's clubs/studios; title also explicitly says Минск.", flags: ["SOFT_SLUG_MISMATCH"] },
  24772: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "MamaGo's own event booth recap at Lakeside Park, a specific Minsk-area venue; local but a recap/thank-you post rather than a guide.", flags: ["OTHER_REVIEW"] },
  24774: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Personal birthday story centered on a specific real venue (Astoria), but framed as a family anecdote rather than a guide.", flags: [] },
  24988: { scope: "CITY_MINSK", conf: "HIGH",   reason: "New school opening in Novaya Borovaya, a Minsk residential development — a specific local venue/project.", flags: [] },
  26068: { scope: "GLOBAL",     conf: "HIGH",   reason: "General parenting tradition/ritual concept inspired by a film; no venue or city dependency.", flags: [] },
  26605: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'in Minsk'; curated list of named local cafes/restaurants.", flags: [] },
  27355: { scope: "CITY_MINSK", conf: "HIGH",   reason: "News about a new kindergarten in Severny Bereg, a specific Minsk development.", flags: ["SOFT_SLUG_MISMATCH"] },
  28546: { scope: "UNCLEAR",    conf: "LOW",    reason: "Generic Mother's Day gift-idea listicle; some entries may reference local services but framing is not Minsk-specific.", flags: ["SOFT_SLUG_MISMATCH"] },
  30049: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Halloween-adjacent holiday prep guide mixing generic costume/decor tips with a 'where to go' section.", flags: ["SOFT_SLUG_MISMATCH"] },
  30642: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Opening announcement for a specific named venue in Lebyazhy (Minsk area).", flags: ["SOFT_SLUG_MISMATCH"] },
  30700: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'in Minsk'; listicle of activities for kids on autumn break.", flags: [] },
  31021: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Listicle of ten specific named entertainment parks that recur across this corpus as known Minsk venues, despite no city name in the title.", flags: ["SOFT_SLUG_MISMATCH"] },
  32082: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "MamaGo's own event booth recap at Minsk's Botanical Garden; local but a recap post.", flags: ["OTHER_REVIEW"] },
  33172: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Listicle of named children's clubs/camps; genre matches Minsk-club roundups but geo signals mix Minsk and Molodechno with no clear single-city framing.", flags: ["MIXED_MINSK_BELARUS"] },
  33899: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "New Year guide listing specific Minsk landmarks (ГУМ department store, Коммунарка) though title doesn't name the city.", flags: ["SOFT_SLUG_MISMATCH"] },
  34363: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title 'Новогодние фотозоны Минска' explicitly names Minsk; listicle of specific named local photo spots.", flags: ["SOFT_SLUG_MISMATCH"] },
  34997: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title 'Куда сходить в Минске' explicit; listicle of specific new local venues.", flags: [] },
  35329: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Christmas holiday guide with a mix of 'out of town' and generic tips; named Belarus-wide attractions (Дукорский маёнтак, Станьково) rather than purely Minsk-city venues.", flags: ["MIXED_MINSK_BELARUS"] },
  39844: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title says 'в Минске'; news about a specific new kindergarten in Novaya Borovaya.", flags: [] },
  40724: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Spring break activities listicle naming specific venues (VR arena, Disco Park) but geo signals mix Minsk, Molodechno and general Belarus.", flags: ["MIXED_MINSK_BELARUS"] },
  52193: { scope: "GLOBAL",     conf: "HIGH",   reason: "Generic Halloween celebration guide (history, decor ideas, costume tips) with no venue or city dependency in the excerpt.", flags: [] },
  52296: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Explicit 'в Минске' in title; photo walk through specific named Minsk streets/venues with a local business partner.", flags: [] },
  54146: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; New Year events roundup for the city.", flags: [] },
  54929: { scope: "GLOBAL",     conf: "MEDIUM", reason: "How to send a letter to Santa/Ded Moroz — a general seasonal activity guide with no city dependency, phrased for families of Belarus generally.", flags: ["MIXED_MINSK_BELARUS"] },
  55916: { scope: "GLOBAL",     conf: "HIGH",   reason: "General online child-safety advice (grooming, phishing, deepfakes); no venue or city dependency.", flags: [] },
  56250: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Winter break activity listing named local venues (Aktivdeti.by, Экопарк Акварель) in/near Minsk (Ratomka, Marina Gorka); empty body limits full assessment.", flags: [] },
  57731: { scope: "UNCLEAR",    conf: "LOW",    reason: "Cozy family evening ideas (board games); no explicit venue/city dependency, and empty body limits assessment.", flags: [] },
  58101: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Profile of a Minsk-based entrepreneur (Las Legas, PhotoHub — well-known Minsk businesses she founded); content centers on her local ventures.", flags: [] },
  60578: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title and body both explicitly 'в Минске'; Maslenitsa events guide for the city.", flags: [] },
  62132: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Travel guide to Grodno and surroundings — explicitly about a different Belarusian city, not Minsk; empty body limits full assessment. Owner should decide whether this becomes a national-scope article or needs separate handling.", flags: ["MIXED_MINSK_BELARUS", "OTHER_REVIEW"] },
  62336: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Valentine's Day gift/date ideas naming specific venues; geo signal mixes Минск and Гродно but most named activities appear Minsk-based.", flags: ["MIXED_MINSK_BELARUS"] },
  63551: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'Минска'; quest-room listicle in partnership with a Minsk business (extrareality.by).", flags: [] },
  63859: { scope: "GLOBAL",     conf: "MEDIUM", reason: "General ideas for a girls'-night gathering (games, conversation topics); no venue dependency evident in the excerpt.", flags: [] },
  64406: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; Ivan Kupala event guide for the city and surroundings.", flags: [] },
  64460: { scope: "GLOBAL",     conf: "HIGH",   reason: "General child first-aid/health advice for dacha/countryside situations; no venue or city dependency.", flags: [] },
  64522: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Bike route review of a specific named Minsk district (Лебяжий) with landmarks along the way.", flags: [] },
  10679: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Opening recap of a specific named local kids' club chain ('Пуговка') branch; content-relation evidence links to Places records, but city is unresolved by the automated audit.", flags: ["OTHER_REVIEW"] },
  10727: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Explicitly about a waterpark trip to Molodechno, not Minsk — Minsk is mentioned only as the contrasting starting point.", flags: ["MIXED_MINSK_BELARUS"] },
  11112: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Review of the 'Дом Рождества' immersive exhibit at Дворец искусств, a specific Minsk venue.", flags: [] },
  11776: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Explicit walking route through named central Minsk landmarks (Парк Горького, Октябрьская площадь) for the holidays.", flags: [] },
  11948: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Review of a specific venue at a named Minsk address (Куйбышева, 45).", flags: [] },
  12106: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Listicle of specific named Minsk shopping malls (Galileo, Galleria, Palazzo, Титан, Dana Mall) for holiday photos.", flags: [] },
  12229: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Review of a specific exhibit at ТРЦ Palazzo, a named Minsk mall.", flags: [] },
  12256: { scope: "UNCLEAR",    conf: "LOW",    reason: "Generic 'lazy holiday activities at home' ideas (YouTube, board games); no venue dependency despite a detected Minsk geo tag.", flags: [] },
  12348: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; review of a specific exhibit venue ('Мир иллюзий').", flags: [] },
  12372: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Review of a specific venue (Mi Mi Land) at a named Minsk mall (ТРЦ Palazzo); explicitly notes 'в Минске аналогов пока нет'.", flags: [] },
  12392: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; review of a specific new venue.", flags: [] },
  12464: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Curated list of named school-prep centers with 8 linked Place records; content-relation evidence present though city unresolved by the automated audit.", flags: [] },
  12637: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; review of one specific cafe in central Minsk.", flags: [] },
  12841: { scope: "GLOBAL",     conf: "HIGH",   reason: "General DIY birthday party ideas that work anywhere (concert-at-home, scavenger hunt, cooking party); no venue dependency.", flags: [] },
  12891: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'Минска'; curated list of named local kids' cafes/clubs.", flags: [] },
  12957: { scope: "GLOBAL",     conf: "HIGH",   reason: "Astrology-themed listicle about how each zodiac sign vacations; no venue or city dependency.", flags: [] },
  12964: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Review of one specific named venue (Шедевры вкуса) at a named Minsk address (Победителей 133).", flags: [] },
  13071: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Title explicitly 'в Минске'; venue listicle, though body is empty in this extract (7 linked Place relations present).", flags: [] },
  13194: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Review of a specific venue ('Мистерия') that relocated within Minsk (Сухарево).", flags: [] },
  13288: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Listicle of specific named childcare venues, but framing ('где оставить ребенка с няней') is a generic parenting need with local examples.", flags: [] },
  13373: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "February break activities mixing a specific camp with generic 'variant' options; geo signal shows Molodechno, not clearly Minsk.", flags: ["MIXED_MINSK_BELARUS"] },
  13429: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Review of a specific venue (Hero Park) at named Minsk addresses (Сурганова, Дзержинского).", flags: [] },
  13458: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; listicle of named local fitness clubs with an address given (ул. Ратомская, 7).", flags: [] },
  13584: { scope: "GLOBAL",     conf: "HIGH",   reason: "General parenting/psychology musing about kids and full moons; no venue or city dependency.", flags: [] },
  13873: { scope: "UNCLEAR",    conf: "LOW",    reason: "Generic March 8th gift-idea packages; no clear venue dependency evident in the excerpt despite a detected Minsk geo tag.", flags: [] },
  14483: { scope: "GLOBAL",     conf: "MEDIUM", reason: "General springtime bucket-list ideas (evening city walk, park reading); broadly applicable, though one item namechecks a specific museum.", flags: [] },
  15608: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Spring break camps listicle naming a Minsk-branded program ('Научный Минск') and city/country options explicitly.", flags: [] },
  16094: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Personal birthday cost breakdown; genre matches Minsk venue reviews but no explicit venue/city named in this excerpt.", flags: [] },
  16810: { scope: "UNCLEAR",    conf: "LOW",    reason: "Graduation party venue listicle with named clubs; empty body and a Ratomka geo signal (a Minsk-area village) limit confident assessment.", flags: [] },
  17106: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; picnic spot listicle with specific named Minsk parks.", flags: [] },
  18252: { scope: "GLOBAL",     conf: "HIGH",   reason: "Generic April Fools' prank ideas; no venue or city dependency.", flags: [] },
  18366: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Ecotrail listicle explicitly 'Минска (и не только)'; named specific trails mostly in/near the city.", flags: [] },
  18509: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Review of a specific venue chain ('Ладушки') with an explicit count of Minsk locations ('во всём Минске — аж 25').", flags: [] },
  18570: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Summer camps listicle naming '5 филиалах Минска' (5 Minsk branches) explicitly for the flagship camp.", flags: [] },
  18618: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Out-of-town/country camps listicle — explicitly not city-based (Belarus-wide camp locations), though MamaGo itself is Minsk-based.", flags: ["MIXED_MINSK_BELARUS"] },
  18687: { scope: "GLOBAL",     conf: "MEDIUM", reason: "Title says 'в Беларуси' (nationwide); Easter guide content (traditions, recipes, kids activities) is largely generic/national in this excerpt.", flags: ["MIXED_MINSK_BELARUS"] },
  18774: { scope: "GLOBAL",     conf: "HIGH",   reason: "General outdoor birthday party scenario ideas (retro games, scavenger hunt); no venue dependency.", flags: [] },
  18787: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Personal 'favorite places' interview naming specific real Minsk streets/venues (Раковская, Дрозды, KaliLaska).", flags: [] },
  19119: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Listicle of specific named gazebo/venue rentals, but locations are countryside resorts rather than clearly Minsk-city venues.", flags: [] },
  19173: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; review of specific named city parks (Парк Горького, Парк Челюскинцев).", flags: [] },
  19199: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Opening recap of a specific venue chain branch ('Пуговка') at a Minsk address (ул.Тимирязева, 10).", flags: ["OTHER_REVIEW"] },
  19544: { scope: "UNCLEAR",    conf: "LOW",    reason: "Generic long-weekend activity ideas; mentions specific venues (Grill Manero, boat rentals) suggesting Minsk but framing is a broad 'ideas' listicle.", flags: [] },
  19660: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Personal 'favorite places' interview naming Grodno and general Belarus venues, not Minsk specifically.", flags: ["MIXED_MINSK_BELARUS"] },
  19826: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "End-of-school-year activity listicle naming a specific Minsk venue (Футбольный манеж, пр-т Победителей) though geo signals also include Ratomka/Marina Gorka.", flags: ["MIXED_MINSK_BELARUS"] },
  20214: { scope: "UNCLEAR",    conf: "LOW",    reason: "100 generic family activity ideas; empty body and mixed geo signals (Minsk, Brest, Molodechno) prevent confident single-city classification.", flags: ["MIXED_MINSK_BELARUS"] },
  20955: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Personal 'favorite places' interview naming specific real Minsk neighborhoods/streets (Лебяжий, Осмоловка, Раковская).", flags: [] },
  21537: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title scoped 'в пределах Минска и до 10 км от него' explicitly; restaurant listicle with named venues.", flags: ["SOFT_SLUG_MISMATCH"] },
  21827: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'летом в Минске'; teen activity listicle.", flags: [] },
  21932: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; named park listicle.", flags: ["SOFT_SLUG_MISMATCH"] },
  22603: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'Минска'; named kids' cafe/club listicle.", flags: ["SOFT_SLUG_MISMATCH"] },
  22774: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Review of a specific seasonal attraction (corn maze); location context implies a specific local venue though not named explicitly in this excerpt.", flags: [] },
  23191: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; named beach/pool listicle (Минское море, Дрозды).", flags: [] },
  23778: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Personal birthday review of a specific venue (aquazone at cafe 'Птичь').", flags: [] },
  23812: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "AMBIGUOUS WP — flagged explicitly for owner review, not silently auto-approved. Title says 'в Минске' and lists many named sports schools; 3 of 12 relation-evidence Places resolved to Minsk and 9 unresolved — strong CITY_MINSK signal but incomplete relational confirmation.", flags: ["AMBIGUOUS_RELATIONS", "SOFT_SLUG_MISMATCH"] },
  25431: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Back-to-school shopping guide naming a specific Minsk shopping area (Ждановичи); body text is partially corrupted/truncated with tracking metadata.", flags: [] },
  36845: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'Минска'; pool/aquazone listicle with named venues, though empty body in this excerpt.", flags: [] },
  40994: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Named graduation-party venue listicle (Neon Park, Golf Park etc.) matching the recurring Minsk-venue genre.", flags: [] },
  41510: { scope: "UNCLEAR",    conf: "MEDIUM", reason: "Summer camps roundup explicitly covering both 'загородный и городской' (out-of-town and city) options; empty body limits full assessment.", flags: ["MIXED_MINSK_BELARUS"] },
  45861: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; June 1st events guide tied to the city's events calendar.", flags: [] },
  46170: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; review of one specific new venue.", flags: [] },
  46879: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Review of a specific venue (catamaran rental) at a named Minsk landmark (Дрозды).", flags: [] },
  47505: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Birthday-idea listicle of specific named local venues (aquazone Птичь, конная усадьба Буцевичи).", flags: [] },
  47654: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Explicitly names a Minsk district (Советский район города Минска) for a new recreation area.", flags: [] },
  48659: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Review of a specific new kindergarten in a named residential development ('Зеленая гавань'), a Minsk-area complex matching similar articles in this corpus.", flags: [] },
  49011: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; named clubs/studios listicle.", flags: [] },
  49590: { scope: "GLOBAL",     conf: "MEDIUM", reason: "Travel review of a rural retreat (Nomad Houses Ферма) near Braslav — explicitly not Minsk, a countryside destination article.", flags: ["MIXED_MINSK_BELARUS"] },
  50093: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Title explicitly 'в Минске'; review of a specific named exhibit venue (Дом Экспериментального Искусства DEI).", flags: [] },
  50174: { scope: "CITY_MINSK", conf: "HIGH",   reason: "Review of a specific named Minsk park (Лошицкий парк) with exact directions.", flags: [] },
  51073: { scope: "GLOBAL",     conf: "MEDIUM", reason: "Generic Mother's Day gift ideas from the team/bloggers; no venue dependency evident, general listicle format.", flags: [] },
  51263: { scope: "CITY_MINSK", conf: "MEDIUM", reason: "Autumn break activities naming specific venues (Неон Парк, ЖК Маяк Минска, ТЦ Червенский) — Minsk-based venue routes, though body excerpt is truncated.", flags: [] },
};

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

interface OutputRow {
  legacyId: number;
  targetArticleId: string;
  title: string;
  slug: string;
  legacyUrl: string;
  recommendedScope: Scope;
  recommendedCity: string;
  confidence: Confidence;
  reason: string;
  specialFlag: string;
  ownerDecision: string;
  ownerCity: string;
  ownerNote: string;
}

function groupRank(row: OutputRow): number {
  if (row.recommendedScope === "UNCLEAR") return 0;
  if (row.confidence === "LOW") return 1;
  if (row.confidence === "MEDIUM") return 2;
  return 3; // HIGH
}

function mdEscape(s: string | undefined): string {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function mdTable(rowsSubset: OutputRow[]): string {
  const lines = ["| Legacy ID | Title | Recommendation | Confidence | Reason | Flag |", "|---|---|---|---|---|---|"];
  for (const r of rowsSubset) {
    lines.push(`| ${r.legacyId} | ${mdEscape(r.title)} | ${r.recommendedScope} | ${r.confidence} | ${mdEscape(r.reason)} | ${mdEscape(r.specialFlag)} |`);
  }
  return lines.join("\n");
}

function main(): void {
  const lines = fs.readFileSync(SOURCE_PATH, "utf8").trim().split("\n");
  const recs: SourceRow[] = lines.map((l) => JSON.parse(l));

  if (recs.length !== 107) throw new Error(`Expected 107 source rows, got ${recs.length}`);

  const missing = recs.filter((r) => !CLASSIFICATIONS[r.legacyPostId]);
  if (missing.length > 0) {
    throw new Error(`Missing classification for: ${missing.map((r) => r.legacyPostId).join(", ")}`);
  }
  const sourceIds = new Set(recs.map((r) => r.legacyPostId));
  const extraKeys = Object.keys(CLASSIFICATIONS).filter((k) => !sourceIds.has(Number(k)));
  if (extraKeys.length > 0) {
    throw new Error(`Classification has keys not in source: ${extraKeys.join(", ")}`);
  }

  const rows: OutputRow[] = recs.map((r) => {
    const c = CLASSIFICATIONS[r.legacyPostId];
    return {
      legacyId: r.legacyPostId,
      targetArticleId: r.targetArticleId,
      title: r.title,
      slug: r.slug,
      legacyUrl: r.legacyPermalink,
      recommendedScope: c.scope,
      recommendedCity: c.scope === "CITY_MINSK" ? "minsk" : "",
      confidence: c.conf,
      reason: c.reason,
      specialFlag: c.flags.join(";"),
      ownerDecision: "",
      ownerCity: "",
      ownerNote: "",
    };
  });

  // Order: UNCLEAR, LOW, MEDIUM, HIGH; within each group special/flagged first, then legacyId for stability.
  const ordered = [...rows].sort((a, b) => {
    const ga = groupRank(a);
    const gb = groupRank(b);
    if (ga !== gb) return ga - gb;
    const fa = a.specialFlag ? 0 : 1;
    const fb = b.specialFlag ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.legacyId - b.legacyId;
  });

  // Quality checks (see task section 11).
  const legacyIds = new Set(ordered.map((r) => r.legacyId));
  const targetIds = new Set(ordered.map((r) => r.targetArticleId));
  if (ordered.length !== 107) throw new Error(`Expected 107 output rows, got ${ordered.length}`);
  if (legacyIds.size !== 107) throw new Error("Duplicate legacyId detected");
  if (targetIds.size !== 107) throw new Error("Duplicate targetArticleId detected");
  for (const r of ordered) {
    if (!["CITY_MINSK", "GLOBAL", "UNCLEAR"].includes(r.recommendedScope)) throw new Error(`Bad scope for ${r.legacyId}`);
    if (!["HIGH", "MEDIUM", "LOW"].includes(r.confidence)) throw new Error(`Bad confidence for ${r.legacyId}`);
    if (!r.reason || r.reason.length < 5) throw new Error(`Missing reason for ${r.legacyId}`);
  }

  const csvColumns: (keyof OutputRow)[] = [
    "legacyId", "targetArticleId", "title", "slug", "legacyUrl",
    "recommendedScope", "recommendedCity", "confidence", "reason", "specialFlag",
    "ownerDecision", "ownerCity", "ownerNote",
  ];
  const csvLines = [csvColumns.join(",")];
  for (const r of ordered) {
    csvLines.push(csvColumns.map((col) => csvEscape(r[col])).join(","));
  }
  fs.writeFileSync(CSV_PATH, csvLines.join("\n") + "\n");

  const bulkCounts: Record<Scope, number> = { CITY_MINSK: 0, GLOBAL: 0, UNCLEAR: 0 };
  const confCounts: Record<Confidence, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const flagCounts: Record<string, number> = {};
  let flaggedTotal = 0;
  for (const r of ordered) {
    bulkCounts[r.recommendedScope]++;
    confCounts[r.confidence]++;
    if (r.specialFlag) {
      flaggedTotal++;
      for (const f of r.specialFlag.split(";")) flagCounts[f] = (flagCounts[f] || 0) + 1;
    }
  }
  const carefulReview = ordered.filter((r) => r.recommendedScope === "UNCLEAR" || r.confidence === "LOW" || r.specialFlag).length;
  // Bulk-approval candidates exclude flagged rows even if HIGH confidence —
  // a flag (soft slug mismatch, mixed scope, ambiguous relations) means the
  // row needs individual review regardless of confidence, so it must not
  // double-count as both "needs careful review" and "safe to bulk-approve".
  const bulkHighCity = ordered.filter((r) => r.recommendedScope === "CITY_MINSK" && r.confidence === "HIGH" && !r.specialFlag).length;
  const bulkHighGlobal = ordered.filter((r) => r.recommendedScope === "GLOBAL" && r.confidence === "HIGH" && !r.specialFlag).length;

  const summaryUpdate = {
    ownerReviewGenerated: "2026-08-15",
    generatedBy: "Claude Code (editorial read of title/body/categories/tags/headings/relations for all 107 rows)",
    autoCityMinsk: 9,
    ownerReviewTotal: ordered.length,
    recommendations: bulkCounts,
    confidence: confCounts,
    specialFlagCounts: flagCounts,
    articlesFlagged: flaggedTotal,
    ownerMustInspectCarefully: carefulReview,
    bulkApprovalCandidates: { HIGH_CITY_MINSK: bulkHighCity, HIGH_GLOBAL: bulkHighGlobal },
    softSlugMismatchCrossReferenced: 12,
    softSlugMismatchNoteFromTask: "Task mentioned 13 known soft-slug-mismatch articles; source dataset's softSlugMismatch field identifies exactly 12 non-null matches among the 107 — all 12 cross-referenced and flagged; no 13th identifiable from local data.",
    ambiguousWpExplicitlyReviewed: [23812],
    artifacts: { csv: CSV_PATH, md: MD_PATH },
  };

  const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, "utf8"));
  summary.ownerReviewResult = summaryUpdate;
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2) + "\n");

  const needsCareful = ordered.filter((r) => r.recommendedScope === "UNCLEAR" || r.confidence === "LOW" || r.specialFlag);
  const mediumOnly = ordered.filter((r) => r.recommendedScope !== "UNCLEAR" && r.confidence === "MEDIUM" && !r.specialFlag);
  const highCity = ordered.filter((r) => r.recommendedScope === "CITY_MINSK" && r.confidence === "HIGH" && !r.specialFlag);
  const highGlobal = ordered.filter((r) => r.recommendedScope === "GLOBAL" && r.confidence === "HIGH" && !r.specialFlag);

  const md = `# Article geo-scope owner review — 107 articles (2026-08-15)

Editorial recommendations for owner approval — **not automatic migration
evidence**. No Article.geoScope/cityId was written by this task. Full data
(all columns, ownerDecision/ownerCity/ownerNote to fill in) is in
\`article-geoscope-owner-review-2026-08-15.csv\`. This file has recommendation
context only, no full article bodies.

Final URL contract: GLOBAL → \`/blog/{slug}\`, CITY → \`/{city}/blog/{slug}\`
(current city corpus: Minsk only).

Summary: CITY_MINSK ${bulkCounts.CITY_MINSK} / GLOBAL ${bulkCounts.GLOBAL} / UNCLEAR ${bulkCounts.UNCLEAR}.
Confidence: HIGH ${confCounts.HIGH} / MEDIUM ${confCounts.MEDIUM} / LOW ${confCounts.LOW}.
Owner must inspect carefully (UNCLEAR + LOW + any flagged): **${carefulReview}**.
Bulk-approval candidates (HIGH confidence, no special flag) — shown as counts only, not auto-approved: CITY_MINSK ${highCity.length}, GLOBAL ${highGlobal.length}.

## A. NEEDS CAREFUL REVIEW (UNCLEAR, LOW confidence, or flagged mixed/special cases) — ${needsCareful.length}

${mdTable(needsCareful)}

## B. MEDIUM CONFIDENCE (no special flag) — ${mediumOnly.length}

${mdTable(mediumOnly)}

## C. HIGH CONFIDENCE — CITY_MINSK (no special flag) — ${highCity.length}

${mdTable(highCity)}

## D. HIGH CONFIDENCE — GLOBAL (no special flag) — ${highGlobal.length}

${mdTable(highGlobal)}
`;

  fs.writeFileSync(MD_PATH, md);

  console.log("OK — wrote", ordered.length, "rows");
  console.log(JSON.stringify(summaryUpdate, null, 2));
}

if (process.argv[1]?.endsWith("build-article-geoscope-owner-review.ts")) {
  main();
}
