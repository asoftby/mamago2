import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ActivitySnapshotPostRow {
  ID: number;
  post_author: number;
  post_date: string;
  post_status: string;
  post_name: string;
  post_modified: string;
  post_parent: number;
  guid: string;
  post_type: string;
}

export interface ActivitySnapshotMetaRow {
  meta_id: number;
  post_id: number;
  meta_key: string;
  meta_value: string | null;
}

export interface ActivitySnapshotManifest {
  entity: "activity";
  capturedAt: string;
  queryVersion: string;
  canonicalSnapshotHash: string;
  rowCounts: { posts: number; postmetaRelevant: number; terms: number };
  fullActivityInventory: { eventStatusBreakdown: ReadonlyArray<{ post_status: string; count: number | string }> };
}

export interface LoadedActivitySnapshot {
  posts: readonly ActivitySnapshotPostRow[];
  postmeta: readonly ActivitySnapshotMetaRow[];
  manifest: ActivitySnapshotManifest;
}

/** Reads the standalone Activity snapshot from its private, non-Git, non-/tmp path. Read-only file access — no network, no SSH. */
export function loadActivitySnapshot(snapshotDir: string): LoadedActivitySnapshot {
  const posts = JSON.parse(readFileSync(join(snapshotDir, "posts.json"), "utf8")) as ActivitySnapshotPostRow[];
  const postmeta = JSON.parse(readFileSync(join(snapshotDir, "postmeta.json"), "utf8")) as ActivitySnapshotMetaRow[];
  const manifest = JSON.parse(readFileSync(join(snapshotDir, "manifest.json"), "utf8")) as ActivitySnapshotManifest;
  return { posts, postmeta, manifest };
}
