import { loadActivitySnapshot, type ActivitySnapshotPostRow } from "../activity-dependency-inventory/loadActivitySnapshot";

export const AUTHORSHIP_PROOF_LEGACY_USER_ID = 575;
export const AUTHORSHIP_PROOF_LEGACY_USER_SOURCE_RECORD_KEY = `wordpress-db:user:${AUTHORSHIP_PROOF_LEGACY_USER_ID}`;
export const EXPECTED_PUBLISHED_ARTICLE_COUNT = 2;

export interface Slice17ArticleCandidate {
  sourceRecordKey: string;
  legacyPostId: number;
  postStatus: string;
}

/**
 * Reads the durable Slice 16 Activity snapshot (never re-queries WordPress,
 * never SSHes) and returns exactly the `post`-type records authored by
 * `wordpress-db:user:575`. No post ID is hardcoded here — every
 * sourceRecordKey comes straight from the already-captured snapshot file.
 * Throws if the count is not exactly 2 (the fixed Slice 17 scope), per the
 * mandatory count gate — never silently continues with a different count.
 */
export function loadUser575ArticleCandidates(snapshotDir: string): readonly Slice17ArticleCandidate[] {
  const { posts } = loadActivitySnapshot(snapshotDir);
  const matches: ActivitySnapshotPostRow[] = posts.filter(post => post.post_type === "post" && post.post_author === AUTHORSHIP_PROOF_LEGACY_USER_ID);

  if (matches.length !== EXPECTED_PUBLISHED_ARTICLE_COUNT) {
    throw new Error(`BLOCKED_COUNT_MISMATCH: expected exactly ${EXPECTED_PUBLISHED_ARTICLE_COUNT} authored 'post' records for ${AUTHORSHIP_PROOF_LEGACY_USER_SOURCE_RECORD_KEY}, found ${matches.length}.`);
  }

  return matches
    .map(post => ({ sourceRecordKey: `wordpress-db:post:${post.ID}`, legacyPostId: post.ID, postStatus: post.post_status }))
    .sort((a, b) => a.legacyPostId - b.legacyPostId);
}
