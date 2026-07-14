import assert from "node:assert/strict";

import {
  assertReadOnlySql,
  buildHumanReport,
  buildMysqlClientConfig,
  maskHost,
  parseSectionedOutput,
  type WpDbEnv,
} from "./migration-inspect-wordpress-db";
import {
  parseTabularRows,
  unescapeMysqlBatchValue,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";

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
  "top_postmeta_keys_routes",
  "meta_key\tc",
  "title-location-0\t14",
  "description-location-0\t14",
  "images-location-0\t14",
  "route-budget\t14",
  "section",
  "sample_route_location_meta",
  "ID\tmeta_key\tmeta_value",
  "901\ttitle-location-0\tSome Stop",
  "901\tdescription-location-0\tSome description",
  "section",
  "sample_route_full_postmeta",
  "post_id\tmeta_key\tmeta_value",
  "901\t_edit_lock\t1234567890:1",
  "901\ttitle-location-0\tSome Stop",
  "section",
  "taxonomy_counts",
  "taxonomy\tc",
  "places_category\t42",
  "age\t19",
  "section",
  "route_budget_terms",
  "term_id\tname\tslug\tcount",
  "12\tБесплатно\tfree\t2",
  "13\tНедорого\tlow-budget\t2",
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
  assert.equal(sections.length, 18, "all 18 SQL_STEPS sections parsed");

  const routeBudgetTerms = sections.find((s) => s.label === "route_budget_terms");
  assert.ok(routeBudgetTerms);
  assert.deepEqual(routeBudgetTerms!.rows[0], ["12", "Бесплатно", "free", "2"]);

  const routeKeys = sections.find((s) => s.label === "top_postmeta_keys_routes");
  assert.ok(routeKeys);
  assert.deepEqual(routeKeys!.rows[0], ["title-location-0", "14"]);

  const routeLocationSample = sections.find((s) => s.label === "sample_route_location_meta");
  assert.ok(routeLocationSample);
  assert.deepEqual(routeLocationSample!.rows[0], ["901", "title-location-0", "Some Stop"]);

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

  // --- parseSectionedOutput: MySQL batch-mode escape reversal ---
  // Same class of fixture as connectExecutor.test.ts's parseTabularRows
  // regression case: mysql --batch escapes real newline/tab/backslash/NUL
  // inside a cell value with a leading backslash. This report must reverse
  // that (via the same unescapeMysqlBatchValue() connectExecutor uses),
  // not just leave the literal escape text visible in the human report.
  const escapeFixture = [
    "section",
    "escape_probe",
    "ID\tmeta_value",
    "901\t" + String.raw`Line one\nLine two\nLine three`,
    "902\t" + String.raw`Tab:\tCR:\rNUL:\0Backslash:\\`,
    "section",
    "escape_probe_2",
    "ID\tmeta_value",
    "903\tplain value, no escapes",
  ].join("\n");
  const escapeSections = parseSectionedOutput(escapeFixture);
  assert.equal(escapeSections.length, 2, "escape sequences inside cells never create phantom sections");

  const probe1 = escapeSections.find((s) => s.label === "escape_probe");
  assert.ok(probe1);
  assert.equal(probe1!.rows.length, 2, "escape sequences inside cells never create phantom rows");
  assert.deepEqual(probe1!.rows[0], ["901", "Line one\nLine two\nLine three"]);
  assert.deepEqual(probe1!.rows[1], ["902", "Tab:\tCR:\rNUL:\0Backslash:\\"]);

  const probe2 = escapeSections.find((s) => s.label === "escape_probe_2");
  assert.ok(probe2);
  assert.equal(probe2!.rows.length, 1, "escape sequences inside cells never create phantom columns/rows across sections");
  assert.deepEqual(probe2!.rows[0], ["903", "plain value, no escapes"]);

  // Unknown escape sequences and a trailing lone backslash pass through
  // unchanged — same contract as unescapeMysqlBatchValue() itself.
  const edgeCaseFixture = [
    "section",
    "escape_edge_cases",
    "ID\tmeta_value",
    "904\t" + String.raw`unknown escape: \q stays`,
    "905\t" + "trailing backslash: end\\",
  ].join("\n");
  const edgeSections = parseSectionedOutput(edgeCaseFixture);
  const edgeProbe = edgeSections.find((s) => s.label === "escape_edge_cases");
  assert.ok(edgeProbe);
  assert.deepEqual(edgeProbe!.rows[0], ["904", String.raw`unknown escape: \q stays`]);
  assert.deepEqual(edgeProbe!.rows[1], ["905", "trailing backslash: end\\"]);

  // Production connectExecutor.parseTabularRows and this diagnostic parser
  // must agree on the unescaped value for the same raw mysql batch output —
  // they share the single unescapeMysqlBatchValue() implementation, this
  // just proves the wiring, not just the helper in isolation.
  const sharedRaw = ["ID\tnote", "1\t" + String.raw`Shared\nvalue\twith\\escapes`].join("\n");
  const viaProductionExecutor = parseTabularRows<{ ID: number; note: string }>(sharedRaw);
  const viaInspectParser = parseSectionedOutput(["section", "shared_probe", sharedRaw].join("\n"));
  assert.equal(viaProductionExecutor[0].note, viaInspectParser[0].rows[0][1]);
  assert.equal(viaProductionExecutor[0].note, unescapeMysqlBatchValue(String.raw`Shared\nvalue\twith\\escapes`));

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
  assert.ok(report.includes("14\ttitle-location-0"), "routes postmeta key counts listed");
  assert.ok(
    report.includes("901\ttitle-location-0\tSome Stop"),
    "sample route location/place/stop meta values listed",
  );
  assert.ok(
    report.includes("901\t_edit_lock\t1234567890:1"),
    "full unfiltered route postmeta sample listed",
  );
  assert.ok(report.includes("12\tБесплатно\tfree\t2"), "route-budget terms listed");

  console.log("migration-inspect-wordpress-db tests: OK");
}

main();
