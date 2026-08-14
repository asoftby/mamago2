import assert from "node:assert/strict";

import { DEFAULT_LIMIT, MAX_LIMIT, clampLimit } from "./sql";
import { WordPressRepository, type WordPressQueryExecutor } from "./WordPressRepository";
import {
  buildOfferSourceRecordKey,
  type WordPressAttachmentRow,
  type WordPressOfferPlaceRelationRow,
  type WordPressPlaceIndexRow,
  type WordPressPostMetaRow,
  type WordPressPostRow,
  type WordPressRedirectRow,
  type WordPressTermRow,
  type WordPressUserMetaRow,
  type WordPressUserRow,
} from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const articlePost: WordPressPostRow = {
  ID: 201,
  post_author: 5,
  post_date: "2026-01-01 00:00:00",
  post_content: "<p>Hello</p>",
  post_title: "Hello Article",
  post_excerpt: "",
  post_status: "publish",
  post_name: "hello-article",
  post_modified: "2026-01-02 00:00:00",
  post_parent: 0,
  guid: "https://example.com/?p=201",
  post_type: "post",
  post_mime_type: "",
};

const articlePostMeta: WordPressPostMetaRow[] = [
  { meta_id: 1, post_id: 201, meta_key: "_thumbnail_id", meta_value: "555" },
  { meta_id: 2, post_id: 201, meta_key: "rank_math_title", meta_value: "SEO Title" },
  { meta_id: 3, post_id: 201, meta_key: "rank_math_focus_keyword", meta_value: "kids" },
];

const articleTerms: WordPressTermRow[] = [
  { post_id: 201, term_id: 10, name: "News", slug: "news", taxonomy: "category" },
];

const placePost: WordPressPostRow = {
  ID: 301,
  post_author: 5,
  post_date: "2026-01-01 00:00:00",
  post_content: "<p>Place desc</p>",
  post_title: "Cool Place",
  post_excerpt: "",
  post_status: "publish",
  post_name: "cool-place",
  post_modified: "2026-01-02 00:00:00",
  post_parent: 0,
  guid: "https://example.com/?p=301",
  post_type: "places",
  post_mime_type: "",
};

const placePostMeta: WordPressPostMetaRow[] = [
  { meta_id: 11, post_id: 301, meta_key: "short-desc-place", meta_value: "A great place for kids" },
  { meta_id: 12, post_id: 301, meta_key: "phone", meta_value: "+375291234567" },
  { meta_id: 13, post_id: 301, meta_key: "work_hours", meta_value: "Mon-Fri 9-18" },
  { meta_id: 14, post_id: 301, meta_key: "location", meta_value: "Minsk, some street" },
  { meta_id: 15, post_id: 301, meta_key: "gallery", meta_value: "111" },
  { meta_id: 16, post_id: 301, meta_key: "gallery", meta_value: "222" },
];

const placeTerms: WordPressTermRow[] = [
  { post_id: 301, term_id: 20, name: "Playground", slug: "playground", taxonomy: "places_category" },
];

const placeIndexRows: WordPressPlaceIndexRow[] = [
  { post_id: 301, post_status: "publish", priority: 5, lat: 53.9, lng: 27.5667 },
];

const eventPost: WordPressPostRow = {
  ID: 401,
  post_author: 5,
  post_date: "2026-01-01 00:00:00",
  post_content: "<p>Event desc</p>",
  post_title: "Kids Fest",
  post_excerpt: "",
  post_status: "publish",
  post_name: "kids-fest",
  post_modified: "2026-01-02 00:00:00",
  post_parent: 0,
  guid: "https://example.com/?p=401",
  post_type: "events",
  post_mime_type: "",
};

const eventPostMeta: WordPressPostMetaRow[] = [
  { meta_id: 21, post_id: 401, meta_key: "event_date", meta_value: "2026-08-15 10:00:00" },
  { meta_id: 22, post_id: 401, meta_key: "event-place-name", meta_value: "Central Park" },
];

const eventTerms: WordPressTermRow[] = [
  { post_id: 401, term_id: 30, name: "Festival", slug: "festival", taxonomy: "events-category" },
];

const routePost: WordPressPostRow = {
  ID: 501,
  post_author: 5,
  post_date: "2026-01-01 00:00:00",
  post_content: "<p>Route intro</p>",
  post_title: "Kids Route",
  post_excerpt: "",
  post_status: "publish",
  post_name: "kids-route",
  post_modified: "2026-01-02 00:00:00",
  post_parent: 0,
  guid: "https://example.com/?p=501",
  post_type: "routes",
  post_mime_type: "",
};

const routePostMeta: WordPressPostMetaRow[] = [
  { meta_id: 31, post_id: 501, meta_key: "title-location-1", meta_value: "First Stop" },
  { meta_id: 32, post_id: 501, meta_key: "location", meta_value: '{"address":"x","latitude":1,"longitude":2}' },
];

const routeTerms: WordPressTermRow[] = [
  { post_id: 501, term_id: 40, name: "Бюджетно", slug: "budget-low", taxonomy: "route-budget" },
];

// --- Offer fixtures (hb-programs + services source post types) ---

function offerPost(overrides: Partial<WordPressPostRow>): WordPressPostRow {
  return {
    ID: 601,
    post_author: 5,
    post_date: "2026-01-01 00:00:00",
    post_content: "<p>Camp program description</p>",
    post_title: "Kids Camp Program",
    post_excerpt: "",
    post_status: "publish",
    post_name: "kids-camp-program",
    post_modified: "2026-01-02 00:00:00",
    post_parent: 0,
    guid: "https://example.com/?p=601",
    post_type: "hb-programs",
    post_mime_type: "",
    ...overrides,
  };
}

/** Regular published hb-programs post — one Place relation, full meta/taxonomy. */
const hbProgramPost = offerPost({ ID: 601 });

/** The single real `services` row (2026-07-14 inspection: publish count = 1). */
const servicesPost = offerPost({
  ID: 602,
  post_title: "Шоу и артисты «Jokers»",
  post_name: "show-and-artists-jokers",
  post_content: "<p>Артисты на праздник</p>",
  post_type: "services",
});

/** No Place relation at all — the ~30%-of-source case that must not get a fabricated one. */
const hbProgramNoRelationPost = offerPost({
  ID: 603,
  post_title: "Program Without Place",
  post_name: "program-without-place",
});

/** Two Place relations, neither structurally "primary" — repository must not pick one. */
const hbProgramMultiRelationPost = offerPost({
  ID: 604,
  post_title: "Program With Two Places",
  post_name: "program-with-two-places",
});

/** draft status — must never appear in the published list/by-id methods. */
const hbProgramDraftPost = offerPost({
  ID: 605,
  post_title: "Draft Program",
  post_name: "draft-program",
  post_status: "draft",
});

const hbProgramPostMeta: WordPressPostMetaRow[] = [
  { meta_id: 41, post_id: 601, meta_key: "program-cost", meta_value: "<ul><li>300 byn - до 10 чел</li></ul>" },
  { meta_id: 42, post_id: 601, meta_key: "average-check-program", meta_value: "385" },
  { meta_id: 43, post_id: 601, meta_key: "hb-program-duration", meta_value: "180" },
  { meta_id: 44, post_id: 601, meta_key: "max-guests-program", meta_value: "15" },
  { meta_id: 45, post_id: 601, meta_key: "gallery", meta_value: "18929,26663" },
  {
    meta_id: 46,
    post_id: 601,
    meta_key: "program-booking-settings",
    meta_value: '{"enabled":true,"base_price":300}',
  },
  { meta_id: 47, post_id: 601, meta_key: "rank_math_title", meta_value: "Camp SEO Title" },
  { meta_id: 48, post_id: 601, meta_key: "_wp_old_slug", meta_value: "old-camp-slug" },
  // A real embedded newline (post-connectExecutor-fix shape) must pass through the
  // bundle byte-for-byte — this repository does no HTML/text processing of its own.
  { meta_id: 49, post_id: 601, meta_key: "short-description", meta_value: "Line one\nLine two" },
];

const servicesPostMeta: WordPressPostMetaRow[] = [
  { meta_id: 51, post_id: 602, meta_key: "main-image-service", meta_value: "7001" },
  { meta_id: 52, post_id: 602, meta_key: "phone-services", meta_value: "+375291112233" },
];

/** Malformed JSON — repository must return it as-is, never parse/validate/reject it. */
const hbProgramMultiRelationPostMeta: WordPressPostMetaRow[] = [
  { meta_id: 53, post_id: 604, meta_key: "program-booking-settings", meta_value: '{"enabled":true, "base_price":' },
  // A literal two-character escape sequence (backslash + n, not a real newline byte) —
  // this repository is agnostic to escape semantics entirely (that's connectExecutor's
  // job, already fixed/tested separately); whatever string arrives must pass through verbatim.
  { meta_id: 54, post_id: 604, meta_key: "short-description", meta_value: "Contains literal: \\n sequence" },
];

const hbProgramTerms: WordPressTermRow[] = [
  { post_id: 601, term_id: 60, name: "Аниматоры", slug: "animatory", taxonomy: "org-capacity" },
  { post_id: 601, term_id: 61, name: "7-9 лет", slug: "7-9-let", taxonomy: "program-age" },
];

const offerPlaceRelationRows: WordPressOfferPlaceRelationRow[] = [
  {
    post_id: 601,
    related_post_id: 301,
    related_post_type: "places",
    relation_key: "post-relation-hb-programs",
    relation_order: 0,
    relation_side: "child",
  },
  {
    post_id: 604,
    related_post_id: 301,
    related_post_type: "places",
    relation_key: "post-relation-hb-programs",
    relation_order: 0,
    relation_side: "child",
  },
  {
    post_id: 604,
    related_post_id: 302,
    related_post_type: "places",
    relation_key: "post-relation-hb-programs",
    relation_order: 1,
    relation_side: "child",
  },
];

const attachmentRows: WordPressAttachmentRow[] = [
  {
    ID: 555,
    post_title: "cover.jpg",
    post_name: "cover",
    post_mime_type: "image/jpeg",
    guid: "https://example.com/cover.jpg",
    post_parent: 201,
    attached_file: "2020/01/cover.jpg",
  },
];

const redirectRows: WordPressRedirectRow[] = [
  { id: 1, sources: "/old-path", url_to: "/new-path", header_code: 301, hits: 4, status: "active", created: "2025-01-01", updated: "2025-01-01" },
];

const userRows: WordPressUserRow[] = [
  { ID: 9, user_login: "admin", user_email: "admin@example.com", user_registered: "2020-01-01", display_name: "Admin" },
];

const userMetaRows: WordPressUserMetaRow[] = [
  { umeta_id: 1, user_id: 9, meta_key: "voxel:avatar", meta_value: "555" },
  // Duplicate (user_id, meta_key) row with a higher umeta_id — the earlier
  // one (umeta_id: 1) must win, mirroring buildAttachmentsQuery()'s
  // earliest-value-wins determinism.
  { umeta_id: 2, user_id: 9, meta_key: "voxel:avatar", meta_value: "999" },
  { umeta_id: 3, user_id: 10, meta_key: "some_other_key", meta_value: "irrelevant" },
];

// ---------------------------------------------------------------------------
// Fake executor
// ---------------------------------------------------------------------------

interface RecordedCall {
  sql: string;
  params: readonly unknown[];
}

function createFakeExecutor() {
  const calls: RecordedCall[] = [];

  const executor: WordPressQueryExecutor = async (sql, params = []) => {
    calls.push({ sql, params });

    if (sql.includes("FROM wp_posts") && sql.includes("post_type IN (?, ?)")) {
      // buildPublishedOffersQuery: [servicesType, programsType, "publish", limit].
      const status = params[2];
      const allOfferPosts = [
        hbProgramPost,
        servicesPost,
        hbProgramNoRelationPost,
        hbProgramMultiRelationPost,
        hbProgramDraftPost,
      ];
      return allOfferPosts.filter((post) => post.post_status === status) as never;
    }
    if (sql.includes("FROM wp_posts") && sql.includes("post_type = ?")) {
      const [postType, , postId] = params;
      const byId = sql.includes("ID = ?");
      if (postType === "post") {
        if (byId) return (Number(postId) === articlePost.ID ? articlePost : []) as never;
        return articlePost as never;
      }
      if (postType === "places") {
        if (byId) return (Number(postId) === placePost.ID ? placePost : []) as never;
        return placePost as never;
      }
      if (postType === "events") {
        if (byId) return (Number(postId) === eventPost.ID ? eventPost : []) as never;
        return eventPost as never;
      }
      if (postType === "routes") {
        if (byId) return (Number(postId) === routePost.ID ? routePost : []) as never;
        return routePost as never;
      }
      if (postType === "hb-programs" || postType === "services") {
        const candidates = [
          hbProgramPost,
          servicesPost,
          hbProgramNoRelationPost,
          hbProgramMultiRelationPost,
        ].filter((post) => post.post_type === postType);
        if (byId) return (candidates.find((post) => post.ID === Number(postId)) ?? []) as never;
        return candidates as never;
      }
      return [] as never;
    }
    // Checked before the generic "FROM wp_postmeta" branch below: the real
    // buildAttachmentsQuery() now has a `_wp_attached_file` correlated
    // subquery that also contains the substring "FROM wp_postmeta" (a
    // review finding, PR #51 — the query itself is fine, only this fake
    // executor's naive substring routing needed reordering to stay
    // unambiguous).
    if (sql.includes("post_type = 'attachment'")) {
      const ids = params as readonly number[];
      return attachmentRows.filter((row) => ids.includes(row.ID)) as never;
    }
    if (sql.includes("FROM wp_postmeta")) {
      const ids = params as readonly number[];
      return [
        ...articlePostMeta,
        ...placePostMeta,
        ...eventPostMeta,
        ...routePostMeta,
        ...hbProgramPostMeta,
        ...servicesPostMeta,
        ...hbProgramMultiRelationPostMeta,
      ].filter((row) => ids.includes(row.post_id)) as never;
    }
    if (sql.includes("FROM wp_term_relationships")) {
      const ids = params as readonly number[];
      return [...articleTerms, ...placeTerms, ...eventTerms, ...routeTerms, ...hbProgramTerms].filter((row) =>
        ids.includes(row.post_id),
      ) as never;
    }
    if (sql.includes("FROM wp_voxel_index_places")) {
      const ids = params as readonly number[];
      return placeIndexRows.filter((row) => ids.includes(row.post_id)) as never;
    }
    if (sql.includes("FROM wp_voxel_relations")) {
      // buildOfferPlaceRelationsQuery: params = [...postIds, ...postIds] (parent-side half, then child-side half).
      const ids = params as readonly number[];
      return offerPlaceRelationRows.filter((row) => ids.includes(row.post_id)) as never;
    }
    if (sql.includes("FROM wp_rank_math_redirections")) {
      return redirectRows as never;
    }
    if (sql.includes("FROM wp_users")) {
      return userRows as never;
    }
    if (sql.includes("FROM wp_usermeta")) {
      const [userIds, metaKey] = [params.slice(0, -1) as readonly number[], params[params.length - 1] as string];
      return userMetaRows.filter((row) => userIds.includes(row.user_id) && row.meta_key === metaKey) as never;
    }

    throw new Error(`Unexpected query in test fake: ${sql}`);
  };

  return { executor, calls };
}

// Note: the fake above returns a single row (not an array) for the
// post_type branch to keep the fixtures terse; wrap it so the repository
// always receives an array as a real mysql driver would.
function wrapSingleRowAsArray(executor: WordPressQueryExecutor): WordPressQueryExecutor {
  return async (sql, params) => {
    const result = await executor(sql, params);
    return (Array.isArray(result) ? result : [result]) as never;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testArticleBundle() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundles = await repo.getPublishedArticles();

  assert.equal(bundles.length, 1);
  const [bundle] = bundles;
  assert.deepEqual(bundle.post, articlePost);
  assert.deepEqual(bundle.postMeta, {
    _thumbnail_id: ["555"],
    rank_math_title: ["SEO Title"],
    rank_math_focus_keyword: ["kids"],
  });
  assert.deepEqual(bundle.terms, articleTerms);

  const postsCall = calls.find((call) => call.sql.includes("post_type = ?"));
  assert.ok(postsCall);
  assert.deepEqual(postsCall!.params, ["post", "publish", DEFAULT_LIMIT]);
}

async function testPublishedArticleById() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundle = await repo.getPublishedArticleById(201);

  assert.ok(bundle);
  assert.deepEqual(bundle.post, articlePost);
  assert.deepEqual(bundle.postMeta, {
    _thumbnail_id: ["555"],
    rank_math_title: ["SEO Title"],
    rank_math_focus_keyword: ["kids"],
  });
  assert.deepEqual(bundle.terms, articleTerms);

  const postsCall = calls.find((call) => call.sql.includes("ID = ?") && call.params[0] === "post");
  assert.ok(postsCall);
  assert.deepEqual(postsCall!.params, ["post", "publish", 201]);
}

async function testPlaceBundle() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundles = await repo.getPublishedPlaces();

  assert.equal(bundles.length, 1);
  const [bundle] = bundles;
  assert.deepEqual(bundle.post, placePost);
  assert.deepEqual(bundle.postMeta, {
    "short-desc-place": ["A great place for kids"],
    phone: ["+375291234567"],
    work_hours: ["Mon-Fri 9-18"],
    location: ["Minsk, some street"],
    gallery: ["111", "222"],
  });
  assert.deepEqual(bundle.terms, placeTerms);
  assert.deepEqual(bundle.placeIndex, placeIndexRows[0]);
}

async function testEventBundle() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundles = await repo.getPublishedEvents();

  assert.equal(bundles.length, 1);
  const [bundle] = bundles;
  assert.deepEqual(bundle.post, eventPost);
  assert.deepEqual(bundle.postMeta, {
    event_date: ["2026-08-15 10:00:00"],
    "event-place-name": ["Central Park"],
  });
  assert.deepEqual(bundle.terms, eventTerms);

  const postsCall = calls.find((call) => call.sql.includes("post_type = ?") && call.params[0] === "events");
  assert.ok(postsCall);
  assert.deepEqual(postsCall!.params, ["events", "publish", DEFAULT_LIMIT]);
}

async function testPublishedEventById() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundle = await repo.getPublishedEventById(401);

  assert.ok(bundle);
  assert.deepEqual(bundle.post, eventPost);

  const postsCall = calls.find((call) => call.sql.includes("ID = ?") && call.params[0] === "events");
  assert.ok(postsCall);
  assert.deepEqual(postsCall!.params, ["events", "publish", 401]);
}

async function testRouteBundle() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundles = await repo.getPublishedRoutes();

  assert.equal(bundles.length, 1);
  const [bundle] = bundles;
  assert.deepEqual(bundle.post, routePost);
  assert.deepEqual(bundle.postMeta, {
    "title-location-1": ["First Stop"],
    location: ['{"address":"x","latitude":1,"longitude":2}'],
  });
  assert.deepEqual(bundle.terms, routeTerms);

  const postsCall = calls.find((call) => call.sql.includes("post_type = ?") && call.params[0] === "routes");
  assert.ok(postsCall);
  assert.deepEqual(postsCall!.params, ["routes", "publish", DEFAULT_LIMIT]);
}

async function testPublishedRouteById() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundle = await repo.getPublishedRouteById(501);

  assert.ok(bundle);
  assert.deepEqual(bundle.post, routePost);

  const postsCall = calls.find((call) => call.sql.includes("ID = ?") && call.params[0] === "routes");
  assert.ok(postsCall);
  assert.deepEqual(postsCall!.params, ["routes", "publish", 501]);
}

async function testPublishedPlaceById() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundle = await repo.getPublishedPlaceById(301);

  assert.ok(bundle);
  assert.deepEqual(bundle!.post, placePost);
  assert.deepEqual(bundle!.placeIndex, placeIndexRows[0]);

  const postsCall = calls.find((call) => call.sql.includes("ID = ?") && call.params[0] === "places");
  assert.ok(postsCall);
  assert.deepEqual(postsCall!.params, ["places", "publish", 301]);

  // Targeted lookup must never touch the bulk 82-row query path.
  const bulkCall = calls.find(
    (call) => call.sql.includes("post_type = ?") && !call.sql.includes("ID = ?") && call.params[0] === "places",
  );
  assert.ok(!bulkCall, "getPublishedPlaceById must not also run the bulk getPublishedPlaces query");
}

async function testPublishedPlaceByIdReturnsNullWhenNotFound() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundle = await repo.getPublishedPlaceById(9999);
  assert.equal(bundle, null);
}

async function testMissingPlaceIndexDoesNotFailBundle() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const [bundle] = await repo.getPublishedPlaces();
  assert.notEqual(bundle.placeIndex, undefined);

  // A place with no matching wp_voxel_index_places row must still bundle,
  // just with placeIndex: null instead of throwing.
  const noIndexExecutor: WordPressQueryExecutor = async (sql, params) => {
    if (sql.includes("FROM wp_voxel_index_places")) return [] as never;
    return wrapSingleRowAsArray(executor)(sql, params);
  };
  const repoNoIndex = new WordPressRepository(noIndexExecutor);
  const [bundleNoIndex] = await repoNoIndex.getPublishedPlaces();
  assert.equal(bundleNoIndex.placeIndex, null);
}

async function testEmptyIdListsSkipExecutor() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(executor);

  const postMeta = await repo.getPostMeta([]);
  const terms = await repo.getTerms([]);
  const placeIndex = await repo.getPlaceIndexRows([]);
  const attachments = await repo.getAttachmentsByIds([]);

  assert.equal(postMeta.size, 0);
  assert.equal(terms.size, 0);
  assert.equal(placeIndex.size, 0);
  assert.equal(attachments.size, 0);
  assert.equal(calls.length, 0);
}

async function testAttachmentsById() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(executor);

  const attachments = await repo.getAttachmentsByIds([555]);
  assert.equal(attachments.size, 1);
  assert.deepEqual(attachments.get(555), attachmentRows[0]);
}

async function testRedirectsAndUsers() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(executor);

  assert.deepEqual(await repo.getRankMathRedirects(), redirectRows);
  assert.deepEqual(await repo.getUsers(), userRows);
}

async function testUserMetaByKeyPicksEarliestRowPerUser() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(executor);

  const map = await repo.getUserMetaByKey([9, 10], "voxel:avatar");
  assert.equal(map.size, 1);
  // umeta_id: 1 (meta_value "555") wins over the later duplicate (umeta_id: 2, "999").
  assert.deepEqual(map.get(9), { umeta_id: 1, user_id: 9, meta_key: "voxel:avatar", meta_value: "555" });
  assert.equal(map.get(10), undefined);
}

async function testUserMetaByKeyEmptyIdsSkipsExecutor() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(executor);

  const map = await repo.getUserMetaByKey([], "voxel:avatar");
  assert.equal(map.size, 0);
  assert.equal(calls.length, 0);
}

// ---------------------------------------------------------------------------
// Regression: PROD avatar preview bug (2026-08-15).
//
// The real SSH `mysql --defaults-extra-file` tabular executor only coerces
// a fixed column-name allowlist (`NUMERIC_COLUMNS` in connectExecutor.ts)
// to `number` — `user_id`/`umeta_id` are not in it, so every row actually
// arrives with `user_id` as the *string* "14", not the number 14, despite
// `WordPressUserMetaRow`'s `number`-typed interface. This executor
// reproduces that exact runtime shape (bypassing `createFakeExecutor()`'s
// already-numeric fixtures, which cannot catch this) to prove
// `getUserMetaByKey()` still keys its Map by the real numeric user id.
// ---------------------------------------------------------------------------

function createStringTypedUserMetaExecutor(
  rawRows: ReadonlyArray<{ umeta_id: string; user_id: string; meta_key: string; meta_value: string | null }>,
): WordPressQueryExecutor {
  return (async (sql: string, params?: readonly unknown[]) => {
    if (!sql.includes("FROM wp_usermeta")) throw new Error(`Unexpected query in test fake: ${sql}`);
    const paramList = params ?? [];
    const metaKey = paramList[paramList.length - 1] as string;
    const userIds = new Set((paramList.slice(0, -1) as readonly string[]).map(String));
    return rawRows.filter((row) => userIds.has(String(row.user_id)) && row.meta_key === metaKey);
  }) as unknown as WordPressQueryExecutor;
}

async function testUserMetaByKeyCoercesMysqlTabularStringUserId() {
  const executor = createStringTypedUserMetaExecutor([
    { umeta_id: "123", user_id: "14", meta_key: "voxel:avatar", meta_value: "4445" },
  ]);
  const repo = new WordPressRepository(executor);

  const map = await repo.getUserMetaByKey([14], "voxel:avatar");
  const entry = map.get(14);
  assert.notEqual(entry, undefined);
  assert.equal(entry?.meta_value, "4445");
  // Normalized to real numbers, not left as the strings the executor returned.
  assert.equal(entry?.user_id, 14);
  assert.equal(typeof entry?.user_id, "number");
  assert.equal(entry?.umeta_id, 123);
  assert.equal(typeof entry?.umeta_id, "number");
}

async function testUserMetaByKeyNumericUserIdAlsoWorks() {
  // A fake/test executor (or a future NUMERIC_COLUMNS addition) may hand
  // back already-numeric values — coercion must be a no-op there too.
  const executor: WordPressQueryExecutor = (async (sql: string) => {
    if (!sql.includes("FROM wp_usermeta")) throw new Error(`Unexpected query in test fake: ${sql}`);
    return [{ umeta_id: 123, user_id: 14, meta_key: "voxel:avatar", meta_value: "4445" }];
  }) as unknown as WordPressQueryExecutor;
  const repo = new WordPressRepository(executor);

  const map = await repo.getUserMetaByKey([14], "voxel:avatar");
  assert.deepEqual(map.get(14), { umeta_id: 123, user_id: 14, meta_key: "voxel:avatar", meta_value: "4445" });
}

async function testUserMetaByKeyMultipleUsersDoNotConflict() {
  const executor = createStringTypedUserMetaExecutor([
    { umeta_id: "1", user_id: "14", meta_key: "voxel:avatar", meta_value: "100" },
    { umeta_id: "2", user_id: "27", meta_key: "voxel:avatar", meta_value: "200" },
    { umeta_id: "3", user_id: "138", meta_key: "voxel:avatar", meta_value: "300" },
  ]);
  const repo = new WordPressRepository(executor);

  const map = await repo.getUserMetaByKey([14, 27, 138], "voxel:avatar");
  assert.equal(map.size, 3);
  assert.equal(map.get(14)?.meta_value, "100");
  assert.equal(map.get(27)?.meta_value, "200");
  assert.equal(map.get(138)?.meta_value, "300");
}

async function testUserMetaByKeyInvalidUserIdDoesNotCreateFalseMapKey() {
  const executor = createStringTypedUserMetaExecutor([
    // Malformed/garbage user_id — must never become a NaN (or otherwise
    // bogus) Map key; the row is dropped deterministically instead.
    { umeta_id: "1", user_id: "not-a-number", meta_key: "voxel:avatar", meta_value: "100" },
    { umeta_id: "2", user_id: "", meta_key: "voxel:avatar", meta_value: "200" },
    { umeta_id: "3", user_id: "14", meta_key: "voxel:avatar", meta_value: "300" },
  ]);
  const repo = new WordPressRepository(executor);

  const map = await repo.getUserMetaByKey([14], "voxel:avatar");
  assert.equal(map.size, 1);
  assert.equal(map.get(14)?.meta_value, "300");
  assert.equal([...map.keys()].some((key) => Number.isNaN(key)), false);
}

async function testLimitClamping() {
  assert.equal(clampLimit(undefined), DEFAULT_LIMIT);
  assert.equal(clampLimit(0), DEFAULT_LIMIT);
  assert.equal(clampLimit(-5), DEFAULT_LIMIT);
  assert.equal(clampLimit(Number.NaN), DEFAULT_LIMIT);
  assert.equal(clampLimit(10_000_000), MAX_LIMIT);
  assert.equal(clampLimit(42), 42);

  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(executor);
  await repo.getUsers(10_000_000);
  const usersCall = calls.find((call) => call.sql.includes("FROM wp_users"));
  assert.deepEqual(usersCall!.params, [MAX_LIMIT]);
}

// ---------------------------------------------------------------------------
// Offer (hb-programs + services) — source repository only, no classification.
// ---------------------------------------------------------------------------

async function testOfferBundleRegularHbProgram() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundles = await repo.getPublishedOffers();
  const bundle = bundles.find((b) => b.post.ID === hbProgramPost.ID);

  assert.ok(bundle);
  assert.deepEqual(bundle!.post, hbProgramPost);
  assert.equal(bundle!.post.post_type, "hb-programs");

  // program-cost, gallery, valid booking JSON, RankMath, old slug, and a real
  // embedded newline all pass through verbatim — no HTML stripping, no JSON
  // parsing, no gallery-ID splitting. That's normalizer work, not this PR's.
  assert.deepEqual(bundle!.postMeta, {
    "program-cost": ["<ul><li>300 byn - до 10 чел</li></ul>"],
    "average-check-program": ["385"],
    "hb-program-duration": ["180"],
    "max-guests-program": ["15"],
    gallery: ["18929,26663"],
    "program-booking-settings": ['{"enabled":true,"base_price":300}'],
    rank_math_title: ["Camp SEO Title"],
    _wp_old_slug: ["old-camp-slug"],
    "short-description": ["Line one\nLine two"],
  });

  assert.deepEqual(bundle!.terms, hbProgramTerms);
  assert.ok(bundle!.terms.some((t) => t.taxonomy === "org-capacity"));
  assert.ok(bundle!.terms.some((t) => t.taxonomy === "program-age"));

  assert.deepEqual(bundle!.placeRelations, [
    {
      post_id: 601,
      related_post_id: 301,
      related_post_type: "places",
      relation_key: "post-relation-hb-programs",
      relation_order: 0,
      relation_side: "child",
    },
  ]);

  const listCall = calls.find((call) => call.sql.includes("post_type IN (?, ?)"));
  assert.ok(listCall);
  assert.deepEqual(listCall!.params, ["services", "hb-programs", "publish", DEFAULT_LIMIT]);
}

async function testOfferBundleServices() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundles = await repo.getPublishedOffers();
  const bundle = bundles.find((b) => b.post.ID === servicesPost.ID);

  assert.ok(bundle);
  assert.equal(bundle!.post.post_type, "services");
  assert.deepEqual(bundle!.postMeta, {
    "main-image-service": ["7001"],
    "phone-services": ["+375291112233"],
  });
  assert.deepEqual(bundle!.placeRelations, []);
}

async function testOfferBundleNoPlaceRelation() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundles = await repo.getPublishedOffers();
  const bundle = bundles.find((b) => b.post.ID === hbProgramNoRelationPost.ID);

  assert.ok(bundle);
  // No relation at all — repository reports the fact honestly, it does not
  // fabricate a Place or throw. Classification (QUARANTINE) is a later step.
  assert.deepEqual(bundle!.placeRelations, []);
}

async function testOfferBundleMultiplePlaceRelationsNoFalsePrimary() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundles = await repo.getPublishedOffers();
  const bundle = bundles.find((b) => b.post.ID === hbProgramMultiRelationPost.ID);

  assert.ok(bundle);
  assert.equal(bundle!.placeRelations.length, 2, "both relations reported, none dropped");
  const relatedIds = bundle!.placeRelations.map((r) => r.related_post_id).sort();
  assert.deepEqual(relatedIds, [301, 302]);
  // Order/relation_order is passed through raw — the repository does not
  // interpret it as a "primary" marker or pick a winner.
  assert.deepEqual(
    bundle!.placeRelations.map((r) => r.relation_order),
    [0, 1],
  );
}

async function testOfferMalformedBookingJsonPassesThroughAsRawString() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundle = await repo.getPublishedOfferById("hb-programs", hbProgramMultiRelationPost.ID);
  assert.ok(bundle);
  // Truncated/invalid JSON — must not throw, must not be silently dropped or repaired.
  const raw = bundle!.postMeta["program-booking-settings"][0];
  assert.equal(raw, '{"enabled":true, "base_price":');
  // Confirms the fixture is genuinely malformed (so this test proves something) —
  // the repository still returned it untouched rather than rejecting it.
  assert.throws(() => JSON.parse(raw));
}

async function testOfferLiteralEscapeSequencePassesThroughUnchanged() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundle = await repo.getPublishedOfferById("hb-programs", hbProgramMultiRelationPost.ID);
  assert.ok(bundle);
  // Literal two-char `\n` (not a real newline) — the repository is agnostic
  // to escape semantics, it neither unescapes nor mangles it further.
  assert.deepEqual(bundle!.postMeta["short-description"], ["Contains literal: \\n sequence"]);
}

async function testOfferDraftExcludedFromPublishedMethods() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundles = await repo.getPublishedOffers();
  assert.ok(
    !bundles.some((b) => b.post.ID === hbProgramDraftPost.ID),
    "draft hb-programs must never appear in the published list",
  );

  const byId = await repo.getPublishedOfferById("hb-programs", hbProgramDraftPost.ID);
  assert.equal(byId, null, "targeted lookup must not return a draft row either");
}

async function testOfferTargetedLookupBySourceTypeAndId() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const hbBundle = await repo.getPublishedOfferById("hb-programs", hbProgramPost.ID);
  assert.ok(hbBundle);
  assert.equal(hbBundle!.post.post_type, "hb-programs");

  const svcBundle = await repo.getPublishedOfferById("services", servicesPost.ID);
  assert.ok(svcBundle);
  assert.equal(svcBundle!.post.post_type, "services");

  // Wrong source type for a valid ID must not match — not a generic "by ID" lookup.
  const mismatched = await repo.getPublishedOfferById("services", hbProgramPost.ID);
  assert.equal(mismatched, null);

  const svcCall = calls.find((call) => call.params[0] === "services" && call.sql.includes("ID = ?"));
  assert.ok(svcCall);
  assert.deepEqual(svcCall!.params, ["services", "publish", servicesPost.ID]);
}

function testOfferSourceRecordKeyIsStableAndDistinguishesSourceType() {
  assert.equal(buildOfferSourceRecordKey(hbProgramPost), "wordpress-db:hb-programs:601");
  assert.equal(buildOfferSourceRecordKey(servicesPost), "wordpress-db:services:602");
  // Same numeric ID, different source post type -> different keys (this is
  // exactly why Offer needs source-type-aware keys, unlike single-source-type
  // entities like Route/Place/Article/Event).
  assert.notEqual(
    buildOfferSourceRecordKey({ post_type: "hb-programs", ID: 602 }),
    buildOfferSourceRecordKey({ post_type: "services", ID: 602 }),
  );
}

async function testOfferEmptyOptionalMetaDoesNotThrow() {
  const { executor } = createFakeExecutor();
  const repo = new WordPressRepository(wrapSingleRowAsArray(executor));

  const bundle = await repo.getPublishedOfferById("hb-programs", hbProgramNoRelationPost.ID);
  assert.ok(bundle);
  // No postmeta rows fixtured for this post at all — must resolve to an
  // empty object, not throw and not fabricate keys.
  assert.deepEqual(bundle!.postMeta, {});
  assert.deepEqual(bundle!.terms, []);
  assert.deepEqual(bundle!.placeRelations, []);
}

async function testOfferPlaceRelationsQueryQueriesBothDirections() {
  const { executor, calls } = createFakeExecutor();
  const repo = new WordPressRepository(executor);

  await repo.getOfferPlaceRelations([601, 604]);

  const relationsCall = calls.find((call) => call.sql.includes("FROM wp_voxel_relations"));
  assert.ok(relationsCall);
  // Both halves of the UNION ALL get the same id list — see buildOfferPlaceRelationsQuery.
  assert.deepEqual(relationsCall!.params, [601, 604, 601, 604]);
  assert.match(relationsCall!.sql, /relation_side/);
}

async function testOfferPlaceRelationsCoerceMysqlNumericStrings() {
  const repo = new WordPressRepository(async () => [{
    post_id: "601",
    related_post_id: "18886",
    related_post_type: "places",
    relation_key: "post-relation-hb-programs",
    relation_order: "0",
    relation_side: "parent",
  }] as never);
  const rows = await repo.getOfferPlaceRelations([601]);
  assert.deepEqual(rows.get(601), [{
    post_id: 601,
    related_post_id: 18886,
    related_post_type: "places",
    relation_key: "post-relation-hb-programs",
    relation_order: 0,
    relation_side: "parent",
  }]);
}

async function main() {
  await testArticleBundle();
  await testPublishedArticleById();
  await testPlaceBundle();
  await testPublishedPlaceById();
  await testPublishedPlaceByIdReturnsNullWhenNotFound();
  await testEventBundle();
  await testPublishedEventById();
  await testRouteBundle();
  await testPublishedRouteById();
  await testMissingPlaceIndexDoesNotFailBundle();
  await testEmptyIdListsSkipExecutor();
  await testAttachmentsById();
  await testRedirectsAndUsers();
  await testUserMetaByKeyPicksEarliestRowPerUser();
  await testUserMetaByKeyEmptyIdsSkipsExecutor();
  await testUserMetaByKeyCoercesMysqlTabularStringUserId();
  await testUserMetaByKeyNumericUserIdAlsoWorks();
  await testUserMetaByKeyMultipleUsersDoNotConflict();
  await testUserMetaByKeyInvalidUserIdDoesNotCreateFalseMapKey();
  await testLimitClamping();

  await testOfferBundleRegularHbProgram();
  await testOfferBundleServices();
  await testOfferBundleNoPlaceRelation();
  await testOfferBundleMultiplePlaceRelationsNoFalsePrimary();
  await testOfferMalformedBookingJsonPassesThroughAsRawString();
  await testOfferLiteralEscapeSequencePassesThroughUnchanged();
  await testOfferDraftExcludedFromPublishedMethods();
  await testOfferTargetedLookupBySourceTypeAndId();
  testOfferSourceRecordKeyIsStableAndDistinguishesSourceType();
  await testOfferEmptyOptionalMetaDoesNotThrow();
  await testOfferPlaceRelationsQueryQueriesBothDirections();
  await testOfferPlaceRelationsCoerceMysqlNumericStrings();
}

main()
  .then(() => {
    console.log("WordPressRepository tests: OK");
  })
  .catch((error) => {
    console.error("WordPressRepository tests: FAILED", error);
    process.exitCode = 1;
  });
