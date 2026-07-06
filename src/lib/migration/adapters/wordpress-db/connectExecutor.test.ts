import assert from "node:assert/strict";

import {
  assertRemoteAccessAllowed,
  bindQueryParams,
  buildManualFallbackMessage,
  buildMysqlClientConfig,
  buildRemoteScript,
  buildSshArgs,
  isLocalHost,
  maskHost,
  parseTabularRows,
  readWordPressDbConfigFromEnv,
} from "./connectExecutor";
import type { WordPressDbConfig } from "./types";

const TEST_CONFIG: WordPressDbConfig = {
  sshHost: "134.17.16.78",
  sshUser: "deploy",
  dbName: "mamago",
  dbUser: "mamago",
  dbPassword: "s3cr3t\"pass'word\\",
};

function testReadWordPressDbConfigFromEnv() {
  const config = readWordPressDbConfigFromEnv({
    WP_SSH_HOST: "134.17.16.78",
    WP_SSH_USER: "deploy",
    WP_DB_NAME: "mamago",
    WP_DB_USER: "mamago",
    WP_DB_PASSWORD: "secret",
  } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(config, {
    sshHost: "134.17.16.78",
    sshUser: "deploy",
    dbName: "mamago",
    dbUser: "mamago",
    dbPassword: "secret",
    tablePrefix: undefined,
  });

  const withPrefix = readWordPressDbConfigFromEnv({
    WP_SSH_HOST: "134.17.16.78",
    WP_SSH_USER: "deploy",
    WP_DB_NAME: "mamago",
    WP_DB_USER: "mamago",
    WP_DB_PASSWORD: "secret",
    WP_DB_TABLE_PREFIX: "wp_",
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(withPrefix.tablePrefix, "wp_");

  assert.throws(
    () => readWordPressDbConfigFromEnv({ WP_SSH_HOST: "h" } as unknown as NodeJS.ProcessEnv),
    /Missing required env vars: WP_SSH_USER, WP_DB_NAME, WP_DB_USER, WP_DB_PASSWORD/,
  );
  assert.throws(
    () => readWordPressDbConfigFromEnv({} as unknown as NodeJS.ProcessEnv),
    /Missing required env vars/,
  );
}

function testMaskHost() {
  assert.equal(maskHost("134.17.16.78"), "134.17.***.**");
  assert.equal(maskHost("localhost"), "lo***st");
}

function testRemoteAccessGate() {
  assert.equal(isLocalHost("localhost"), true);
  assert.equal(isLocalHost("127.0.0.1"), true);
  assert.equal(isLocalHost("134.17.16.78"), false);

  assert.doesNotThrow(() =>
    assertRemoteAccessAllowed({ ...TEST_CONFIG, sshHost: "localhost" }, false),
  );
  assert.throws(
    () => assertRemoteAccessAllowed(TEST_CONFIG, false),
    /not localhost.*--allow-remote-readonly/s,
  );
  assert.doesNotThrow(() => assertRemoteAccessAllowed(TEST_CONFIG, true));
}

function testBuildMysqlClientConfig() {
  const cnf = buildMysqlClientConfig({ dbUser: "mamago", dbPassword: 'p@ss"word', dbName: "mamago" });
  assert.match(cnf, /^\[client\]/);
  assert.match(cnf, /user="mamago"/);
  assert.match(cnf, /password="p@ss\\"word"/);
  assert.match(cnf, /database="mamago"/);
  assert.match(cnf, /protocol=TCP/);
}

function testBindQueryParams() {
  assert.equal(
    bindQueryParams("SELECT * FROM wp_posts WHERE post_type = ? AND post_status = ?", [
      "post",
      "publish",
    ]),
    "SELECT * FROM wp_posts WHERE post_type = 'post' AND post_status = 'publish'",
  );
  assert.equal(bindQueryParams("SELECT * FROM wp_posts LIMIT ?", [42]), "SELECT * FROM wp_posts LIMIT 42");
  assert.equal(
    bindQueryParams("SELECT * FROM t WHERE id IN (?, ?, ?)", [1, 2, 3]),
    "SELECT * FROM t WHERE id IN (1, 2, 3)",
  );
  assert.equal(bindQueryParams("SELECT ?", [null]), "SELECT NULL");

  // Quotes/backslashes in string params must be escaped, never break out of the literal.
  const escaped = bindQueryParams("SELECT ?", ["O'Brien \\ \"quoted\""]);
  assert.equal(escaped, "SELECT 'O\\'Brien \\\\ \\\"quoted\\\"'");

  assert.throws(() => bindQueryParams("SELECT ? , ?", ["only-one"]), /Not enough parameters/);
  assert.throws(() => bindQueryParams("SELECT ?", ["one", "two"]), /Too many parameters/);
  assert.throws(() => bindQueryParams("SELECT ?", [Number.POSITIVE_INFINITY]), /non-finite/);
}

function testBuildSshArgsNeverContainsPassword() {
  const remoteScript = buildRemoteScript("SELECT 1");
  const args = buildSshArgs(TEST_CONFIG, remoteScript);
  assert.ok(args.every((arg) => !arg.includes(TEST_CONFIG.dbPassword)));
  assert.ok(args.includes("BatchMode=yes"));
  assert.ok(args.includes(`${TEST_CONFIG.sshUser}@${TEST_CONFIG.sshHost}`));
}

function testBuildManualFallbackMessageNeverContainsPassword() {
  const remoteScript = buildRemoteScript("SELECT 1");
  const message = buildManualFallbackMessage(TEST_CONFIG, remoteScript);
  assert.ok(!message.includes(TEST_CONFIG.dbPassword));
  assert.ok(message.includes(remoteScript));
  assert.ok(message.includes(`${TEST_CONFIG.sshUser}@${TEST_CONFIG.sshHost}`));
}

function testBuildRemoteScriptEscapesEmbeddedQuotes() {
  const script = buildRemoteScript('SELECT "weird" AS x');
  assert.match(script, /mktemp/);
  assert.match(script, /umask 177/);
  assert.match(script, /trap/);
  assert.match(script, /mysql --defaults-extra-file="\$CNF" -e "SELECT \\"weird\\" AS x"/);
}

function testParseTabularRows() {
  interface Row {
    ID: number;
    post_name: string;
    guid: string;
  }
  const raw = ["ID\tpost_name\tguid", "301\t12345\thttps://example.com", "302\tNULL\tNULL"].join("\n");
  const rows = parseTabularRows<Row>(raw);
  assert.deepEqual(rows, [
    { ID: 301, post_name: "12345", guid: "https://example.com" },
    { ID: 302, post_name: null, guid: null },
  ]);
  // post_name is not in the numeric allowlist, so an all-digit value must stay a string.
  assert.equal(typeof rows[0].post_name, "string");
  assert.equal(rows[0].ID, 301);
  assert.equal(typeof rows[0].ID, "number");

  assert.deepEqual(parseTabularRows("ID\tpost_name"), []);
  assert.deepEqual(parseTabularRows(""), []);

  interface PlaceIndexRow {
    post_id: number;
    lat: number | null;
    lng: number | null;
  }
  const placeIndexRaw = ["post_id\tlat\tlng", "301\t53.900000\t27.566700", "302\tNULL\tNULL"].join("\n");
  assert.deepEqual(parseTabularRows<PlaceIndexRow>(placeIndexRaw), [
    { post_id: 301, lat: 53.9, lng: 27.5667 },
    { post_id: 302, lat: null, lng: null },
  ]);
}

function main() {
  testReadWordPressDbConfigFromEnv();
  testMaskHost();
  testRemoteAccessGate();
  testBuildMysqlClientConfig();
  testBindQueryParams();
  testBuildSshArgsNeverContainsPassword();
  testBuildManualFallbackMessageNeverContainsPassword();
  testBuildRemoteScriptEscapesEmbeddedQuotes();
  testParseTabularRows();
}

main();
console.log("connectExecutor tests: OK");
