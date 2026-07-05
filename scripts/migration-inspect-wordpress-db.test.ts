import assert from "node:assert/strict";

import {
  assertReadOnlySql,
  buildHumanReport,
  buildMysqlClientConfig,
  maskHost,
  parseSectionedOutput,
  type WpDbEnv,
} from "./migration-inspect-wordpress-db";

// Fixture: shape of real `mysql -e "..."` multi-statement output, trimmed to
// a representative subset of what was actually captured manually against
// the live WordPress DB during the 2026-07-05 investigation (see
// docs/migration/wordpress-to-mamago.md, "WordPress DB Inspection Notes").
const FIXTURE = [
  "section",
  "database",
  "db",
  "mamago",
  "section",
  "tables",
  "Tables_in_mamago",
  "wp_posts",
  "wp_postmeta",
  "wp_terms",
  "wp_rank_math_redirections",
  "wp_voxel_index_post",
  "wp_voxel_index_places",
  "wp_voxel_relations",
  "section",
  "post_type_status_counts",
  "post_type\tpost_status\tcount",
  "post\tpublish\t115",
  "places\tpublish\t82",
  "places\tdraft\t11",
  "events\tpublish\t28",
  "section",
  "postmeta_count",
  "postmeta_count",
  "483221",
  "section",
  "users_count",
  "users_count",
  "580",
  "section",
  "terms_count",
  "terms_count",
  "1058",
  "section",
  "voxel_index_post_columns",
  "column_name\tdata_type",
  "id\tint",
  "post_id\tbigint",
  "post_status\tvarchar",
  "priority\ttinyint",
  "_keywords\ttext",
  "section",
  "voxel_index_places_columns",
  "column_name\tdata_type",
  "id\tint",
  "post_id\tbigint",
  "post_status\tvarchar",
  "priority\ttinyint",
  "_keywords\ttext",
  "_location\tpoint",
  "_range\tsmallint",
  "activity_timeline\tdatetime",
  "section",
  "top_postmeta_keys_post",
  "meta_key\tc",
  "rank_math_title\t112",
  "_thumbnail_id\t98",
  "section",
  "top_postmeta_keys_places",
  "meta_key\tc",
  "phone\t80",
  "work_hours\t75",
  "section",
  "taxonomy_counts",
  "taxonomy\tc",
  "places_category\t42",
  "age\t19",
  "section",
  "sample_post_places_rows",
  "ID\tpost_type\tpost_status\tpost_title\tpost_name\tpost_date",
  "251\tpost\tpublish\tSome Article\tsome-article\t2025-01-01 00:00:00",
  "437\tplaces\tpublish\tSome Place\tsome-place\t2023-04-09 14:10:00",
  "section",
  "attachment_count",
  "attachment_count",
  "9620",
  "section",
  "redirect_count",
  "redirect_count",
  "156",
].join("\n");

const TEST_ENV: WpDbEnv = {
  sshHost: "134.17.16.78",
  sshUser: "user",
  dbName: "mamago",
  dbUser: "mamago",
  dbPassword: "should-never-appear-in-output",
};

function main() {
  // --- parseSectionedOutput ---
  const sections = parseSectionedOutput(FIXTURE);
  assert.equal(sections.length, 14, "all 14 SQL_STEPS sections parsed");

  const postCounts = sections.find((s) => s.label === "post_type_status_counts");
  assert.ok(postCounts);
  assert.deepEqual(postCounts!.header, ["post_type", "post_status", "count"]);
  assert.deepEqual(postCounts!.rows[0], ["post", "publish", "115"]);

  const voxelPlaces = sections.find((s) => s.label === "voxel_index_places_columns");
  assert.ok(voxelPlaces);
  assert.deepEqual(
    voxelPlaces!.rows.map((r) => r[0]),
    ["id", "post_id", "post_status", "priority", "_keywords", "_location", "_range", "activity_timeline"],
  );

  const users = sections.find((s) => s.label === "users_count");
  assert.equal(users!.rows[0][0], "580");

  // --- assertReadOnlySql ---
  assert.doesNotThrow(() =>
    assertReadOnlySql(["SELECT 1;", "SHOW TABLES;", "DESCRIBE wp_posts;"]),
  );
  assert.throws(() => assertReadOnlySql(["DROP TABLE wp_posts;"]), /Refusing to run/);
  assert.throws(() => assertReadOnlySql(["DELETE FROM wp_posts;"]), /Refusing to run/);
  assert.throws(() => assertReadOnlySql(["UPDATE wp_posts SET post_status='trash';"]), /Refusing to run/);

  // --- buildMysqlClientConfig: never omits required fields, never throws on odd chars ---
  const cnf = buildMysqlClientConfig({
    dbUser: "mamago",
    dbPassword: 'p@ss"word',
    dbName: "mamago",
  });
  assert.match(cnf, /^\[client\]/);
  assert.match(cnf, /user="mamago"/);
  assert.match(cnf, /password="p@ss\\"word"/);
  assert.match(cnf, /database="mamago"/);
  assert.match(cnf, /protocol=TCP/);

  // --- maskHost ---
  assert.equal(maskHost("134.17.16.78"), "134.17.***.**");
  assert.equal(maskHost("localhost"), "lo***st");

  // --- buildHumanReport: uses parsed sections, never prints the password ---
  const report = buildHumanReport(sections, TEST_ENV);
  assert.ok(report.includes("134.17.***.**"), "host is masked in the report header");
  assert.ok(!report.includes(TEST_ENV.dbPassword), "password never appears in the report");
  assert.ok(report.includes("115\tpost (Article)\tpublish"), "MVP post_type label mapping applied");
  assert.ok(report.includes("_location (point)"), "voxel places columns listed");
  assert.ok(report.includes("wp_voxel_index_places._location"), "static recommendations block present");

  console.log("migration-inspect-wordpress-db tests: OK");
}

main();
