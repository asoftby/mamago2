import assert from "node:assert/strict";

import {
  assertRemoteAccessAllowed,
  bindQueryParams,
  buildManualFallbackMessage,
  buildMysqlClientConfig,
  buildRemoteScript,
  buildSshArgs,
  concatBuffersToUtf8,
  isLocalHost,
  maskHost,
  parseTabularRows,
  readWordPressDbConfigFromEnv,
  unescapeMysqlBatchValue,
  withSshBannerTimeoutRetry,
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

function testBuildSshArgsIncludesMultiplexingOptions() {
  const remoteScript = buildRemoteScript("SELECT 1");
  const args = buildSshArgs(TEST_CONFIG, remoteScript);

  assert.ok(args.includes("ControlMaster=auto"));
  assert.ok(args.some((arg) => /^ControlPersist=/.test(arg)));
  const controlPathArg = args.find((arg) => arg.startsWith("ControlPath="));
  assert.ok(controlPathArg, "ControlPath must be present in the ssh args");
}

function testControlPathNeverContainsPassword() {
  const remoteScript = buildRemoteScript("SELECT 1");
  const args = buildSshArgs(TEST_CONFIG, remoteScript);
  const controlPathArg = args.find((arg) => arg.startsWith("ControlPath="))!;

  assert.ok(!controlPathArg.includes(TEST_CONFIG.dbPassword));
  // Also never the ssh user/host verbatim — it's OpenSSH's own %C hash token, not a hand-built path.
  assert.ok(controlPathArg.includes("%C"));
}

function testBuildManualFallbackMessageNeverContainsPassword() {
  const remoteScript = buildRemoteScript("SELECT 1");
  const message = buildManualFallbackMessage(TEST_CONFIG, remoteScript);
  assert.ok(!message.includes(TEST_CONFIG.dbPassword));
  assert.ok(message.includes(remoteScript));
  assert.ok(message.includes(`${TEST_CONFIG.sshUser}@${TEST_CONFIG.sshHost}`));
}

function testBuildRemoteScriptTransportsSqlWithoutShellEvaluation() {
  const sql = 'SELECT r.`order`, "weird", \'single\' AS x';
  const script = buildRemoteScript(sql);
  assert.match(script, /mktemp/);
  assert.match(script, /umask 177/);
  assert.match(script, /trap/);
  assert.match(script, /base64 --decode \| mysql --defaults-extra-file="\$CNF"/);
  assert.ok(!script.includes(sql));
  assert.ok(!script.includes("`order`"));
  const encoded = script.match(/printf '%s' '([^']+)'/)?.[1];
  assert.equal(Buffer.from(encoded ?? "", "base64").toString("utf8"), sql);
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

  // MySQL batch mode escapes real newlines/tabs/backslashes/NUL inside a
  // cell value with a leading backslash so they don't get mistaken for the
  // real tab/newline bytes that separate columns/rows. Line/cell splitting
  // already ignores these (they're two literal characters, not the real
  // byte), but the escaped value itself must come back unescaped.
  interface NoteRow {
    ID: number;
    note: string;
  }
  const escapedRaw = [
    "ID\tnote",
    "301\t" + String.raw`Line one\nLine two\nLine three`,
    "302\t" + String.raw`Backslash: \\ and tab: \t and null: \0`,
  ].join("\n");
  const escapedRows = parseTabularRows<NoteRow>(escapedRaw);
  assert.deepEqual(escapedRows, [
    { ID: 301, note: "Line one\nLine two\nLine three" },
    { ID: 302, note: "Backslash: \\ and tab: \t and null: \0" },
  ]);
}

function testUnescapeMysqlBatchValue() {
  assert.equal(unescapeMysqlBatchValue(String.raw`Line one\nLine two`), "Line one\nLine two");
  assert.equal(unescapeMysqlBatchValue(String.raw`a\tb`), "a\tb");
  assert.equal(unescapeMysqlBatchValue(String.raw`a\\b`), "a\\b");
  assert.equal(unescapeMysqlBatchValue(String.raw`a\0b`), "a\0b");
  assert.equal(unescapeMysqlBatchValue(String.raw`a\rb`), "a\rb");
  // No escape sequences present — passes through unchanged.
  assert.equal(unescapeMysqlBatchValue("plain text"), "plain text");
  // Unknown escape (mysql never actually emits these) — left as-is rather than silently dropped.
  assert.equal(unescapeMysqlBatchValue(String.raw`a\qb`), String.raw`a\qb`);
  // Trailing lone backslash — no character to consume, left as-is.
  assert.equal(unescapeMysqlBatchValue("trailing\\"), "trailing\\");
}

/**
 * Regression for the real bug (2026-07-17): golden Place 895's
 * `_seopress_analysis_data` postmeta came back with a Cyrillic "д"
 * (U+0434, 2 UTF-8 bytes: 0xD0 0xB4) replaced by U+FFFD in one CLI run
 * but not another — confirmed via byte-level diff of two live fetches.
 * Root cause: `runSshMysqlCommand` called `chunk.toString()` on each
 * stream `"data"` event independently; when a multi-byte character's
 * bytes land in two different chunks, decoding each chunk in isolation
 * corrupts the split character. This in turn made `sourceHash`
 * nondeterministic (the corrupted/clean bytes hash differently), so a
 * targeted re-run kept reporting LINKED instead of SKIP_UNCHANGED
 * despite zero real source changes.
 */
function testConcatBuffersToUtf8HandlesSplitMultiByteCharacter() {
  const full = Buffer.from("для детского", "utf8");
  // "д" (0xD0 0xB4) sits right after "для " — split its two bytes across
  // two separate chunks, exactly like a stream boundary landing mid-character.
  const splitIndex = full.indexOf(Buffer.from("д", "utf8")) + 1;
  const chunkA = full.subarray(0, splitIndex);
  const chunkB = full.subarray(splitIndex);

  // The old, buggy behavior: decode each chunk independently and concatenate
  // the resulting *strings*. This is what corrupted the real data.
  const buggyResult = chunkA.toString("utf8") + chunkB.toString("utf8");
  assert.ok(buggyResult.includes("�"), "sanity check: per-chunk decoding must reproduce the real corruption");

  // The fix: concatenate the raw *bytes* first, decode exactly once.
  const fixedResult = concatBuffersToUtf8([chunkA, chunkB]);
  assert.equal(fixedResult, "для детского");
  assert.ok(!fixedResult.includes("�"));
}

function testConcatBuffersToUtf8SingleChunkUnaffected() {
  assert.equal(concatBuffersToUtf8([Buffer.from("plain ascii", "utf8")]), "plain ascii");
  assert.equal(concatBuffersToUtf8([]), "");
}

async function testRetryHappensForBannerExchangeTimeout() {
  let calls = 0;
  const result = await withSshBannerTimeoutRetry(
    async () => {
      calls += 1;
      if (calls < 2) {
        throw new Error("ssh exited with code 255: Connection timed out during banner exchange");
      }
      return "ok";
    },
    { delayMs: 0 },
  );

  assert.equal(result, "ok");
  assert.equal(calls, 2, "must retry once after a single banner-exchange timeout, then succeed");
}

async function testRetryBoundedMaxAttempts() {
  let calls = 0;
  await assert.rejects(
    () =>
      withSshBannerTimeoutRetry(
        async () => {
          calls += 1;
          throw new Error("Connection timed out during banner exchange");
        },
        { maxAttempts: 3, delayMs: 0 },
      ),
    /banner exchange/,
  );

  assert.equal(calls, 3, "must stop after exactly maxAttempts, never retry indefinitely");
}

async function testNoRetryOnAuthFailure() {
  let calls = 0;
  await assert.rejects(
    () =>
      withSshBannerTimeoutRetry(
        async () => {
          calls += 1;
          throw new Error("Permission denied (publickey).");
        },
        { delayMs: 0 },
      ),
    /Permission denied/,
  );

  assert.equal(calls, 1, "an auth failure is not transient — must fail on the first attempt, no retry");
}

async function testNoRetryOnMysqlSqlFailure() {
  let calls = 0;
  await assert.rejects(
    () =>
      withSshBannerTimeoutRetry(
        async () => {
          calls += 1;
          throw new Error("ERROR 1146 (42S02) at line 1: Table 'mamago.wp_posts' doesn't exist");
        },
        { delayMs: 0 },
      ),
    /doesn't exist/,
  );

  assert.equal(calls, 1, "a real SQL/mysql error is not transient — must fail on the first attempt, no retry");
}

async function testSuccessAfterTransientRetryReturnsResult() {
  let calls = 0;
  const result = await withSshBannerTimeoutRetry(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("Connection timed out during banner exchange");
      }
      return { rows: ["a", "b"] };
    },
    { delayMs: 0 },
  );

  assert.deepEqual(result, { rows: ["a", "b"] });
}

async function main() {
  testReadWordPressDbConfigFromEnv();
  testMaskHost();
  testRemoteAccessGate();
  testBuildMysqlClientConfig();
  testBindQueryParams();
  testBuildSshArgsNeverContainsPassword();
  testBuildSshArgsIncludesMultiplexingOptions();
  testControlPathNeverContainsPassword();
  testBuildManualFallbackMessageNeverContainsPassword();
  testBuildRemoteScriptTransportsSqlWithoutShellEvaluation();
  testParseTabularRows();
  testUnescapeMysqlBatchValue();
  testConcatBuffersToUtf8HandlesSplitMultiByteCharacter();
  testConcatBuffersToUtf8SingleChunkUnaffected();
  await testRetryHappensForBannerExchangeTimeout();
  await testRetryBoundedMaxAttempts();
  await testNoRetryOnAuthFailure();
  await testNoRetryOnMysqlSqlFailure();
  await testSuccessAfterTransientRetryReturnsResult();
}

main()
  .then(() => {
    console.log("connectExecutor tests: OK");
  })
  .catch((error) => {
    console.error("connectExecutor tests: FAILED", error);
    process.exitCode = 1;
  });
