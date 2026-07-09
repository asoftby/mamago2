import assert from "node:assert/strict";

import { DEFAULT_LIMIT, MAX_LIMIT, clampLimit } from "./sql";
import { WordPressRepository, type WordPressQueryExecutor } from "./WordPressRepository";
import type {
  WordPressAttachmentRow,
  WordPressPlaceIndexRow,
  WordPressPostMetaRow,
  WordPressPostRow,
  WordPressRedirectRow,
  WordPressTermRow,
  WordPressUserRow,
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

const attachmentRows: WordPressAttachmentRow[] = [
  { ID: 555, post_title: "cover.jpg", post_name: "cover", post_mime_type: "image/jpeg", guid: "https://example.com/cover.jpg", post_parent: 201 },
];

const redirectRows: WordPressRedirectRow[] = [
  { id: 1, sources: "/old-path", url_to: "/new-path", header_code: 301, hits: 4, status: "active", created: "2025-01-01", updated: "2025-01-01" },
];

const userRows: WordPressUserRow[] = [
  { ID: 9, user_login: "admin", user_email: "admin@example.com", user_registered: "2020-01-01", display_name: "Admin" },
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

    if (sql.includes("FROM wp_posts") && sql.includes("post_type = ?")) {
      const [postType, , postId] = params;
      const byId = sql.includes("ID = ?");
      if (postType === "post") {
        if (byId) return (Number(postId) === articlePost.ID ? articlePost : []) as never;
        return articlePost as never;
      }
      if (postType === "places") return placePost as never;
      if (postType === "events") {
        if (byId) return (Number(postId) === eventPost.ID ? eventPost : []) as never;
        return eventPost as never;
      }
      return [] as never;
    }
    if (sql.includes("FROM wp_postmeta")) {
      const ids = params as readonly number[];
      return [...articlePostMeta, ...placePostMeta, ...eventPostMeta].filter((row) =>
        ids.includes(row.post_id),
      ) as never;
    }
    if (sql.includes("FROM wp_term_relationships")) {
      const ids = params as readonly number[];
      return [...articleTerms, ...placeTerms, ...eventTerms].filter((row) => ids.includes(row.post_id)) as never;
    }
    if (sql.includes("FROM wp_voxel_index_places")) {
      const ids = params as readonly number[];
      return placeIndexRows.filter((row) => ids.includes(row.post_id)) as never;
    }
    if (sql.includes("post_type = 'attachment'")) {
      const ids = params as readonly number[];
      return attachmentRows.filter((row) => ids.includes(row.ID)) as never;
    }
    if (sql.includes("FROM wp_rank_math_redirections")) {
      return redirectRows as never;
    }
    if (sql.includes("FROM wp_users")) {
      return userRows as never;
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

async function main() {
  await testArticleBundle();
  await testPublishedArticleById();
  await testPlaceBundle();
  await testEventBundle();
  await testPublishedEventById();
  await testMissingPlaceIndexDoesNotFailBundle();
  await testEmptyIdListsSkipExecutor();
  await testAttachmentsById();
  await testRedirectsAndUsers();
  await testLimitClamping();
}

main()
  .then(() => {
    console.log("WordPressRepository tests: OK");
  })
  .catch((error) => {
    console.error("WordPressRepository tests: FAILED", error);
    process.exitCode = 1;
  });
