/**
 * Tests for migration runtime profile resolution.
 * Run: tsx src/lib/migration/runtime/MigrationProfile.test.ts (assert-based, project convention).
 */

import assert from "node:assert/strict";

import {
  MEDIA_POLICIES,
  REDIRECT_POLICIES,
  SEO_POLICIES,
  defaultProfileNameForEnvironment,
  formatMigrationProfileForCli,
  parseMediaPolicyName,
  parseMigrationProfileName,
  parseRedirectPolicyName,
  parseSeoPolicyName,
  resolveMigrationEnvironment,
  resolveMigrationProfile,
} from "./MigrationProfile";

// resolveMigrationEnvironment

function fakeEnv(overrides: Partial<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...overrides };
}

assert.equal(resolveMigrationEnvironment(fakeEnv({})), "LOCAL");
assert.equal(resolveMigrationEnvironment(fakeEnv({ APP_ENV: "production" })), "PROD");
assert.equal(resolveMigrationEnvironment(fakeEnv({ APP_ENV: "PROD" })), "PROD");
assert.equal(resolveMigrationEnvironment(fakeEnv({ VERCEL_ENV: "production" })), "PROD");
assert.equal(resolveMigrationEnvironment(fakeEnv({ APP_ENV: "development" })), "DEV");
assert.equal(resolveMigrationEnvironment(fakeEnv({ APP_ENV: "staging" })), "DEV");
assert.equal(resolveMigrationEnvironment(fakeEnv({ VERCEL_ENV: "preview" })), "DEV");

// defaultProfileNameForEnvironment

assert.equal(defaultProfileNameForEnvironment("LOCAL"), "FULL_IMPORT");
assert.equal(defaultProfileNameForEnvironment("DEV"), "DEV_VALIDATION");
assert.equal(defaultProfileNameForEnvironment("PROD"), "PRODUCTION");

// name parsers accept case/dash variants, reject unknown tokens

assert.equal(parseMigrationProfileName("full_import"), "FULL_IMPORT");
assert.equal(parseMigrationProfileName("dev-validation"), "DEV_VALIDATION");
assert.equal(parseMigrationProfileName("prod-import"), "PROD_IMPORT");
assert.equal(parseMigrationProfileName("bogus"), null);
assert.equal(parseMigrationProfileName(undefined), null);

assert.equal(parseMediaPolicyName("full"), "FULL");
assert.equal(parseMediaPolicyName("metadata"), "METADATA");
assert.equal(parseMediaPolicyName("none"), "NONE");
assert.equal(parseMediaPolicyName("bogus"), null);

assert.equal(parseSeoPolicyName("dry-run"), "DRY_RUN");
assert.equal(parseSeoPolicyName("validate"), "VALIDATE");
assert.equal(parseSeoPolicyName("production"), "PRODUCTION");
assert.equal(parseSeoPolicyName("bogus"), null);

assert.equal(parseRedirectPolicyName("validate"), "VALIDATE");
assert.equal(parseRedirectPolicyName("apply"), "APPLY");
assert.equal(parseRedirectPolicyName("bogus"), null);

// resolveMigrationProfile: environment-driven defaults

const localDefault = resolveMigrationProfile({ env: fakeEnv({}) });
assert.equal(localDefault.name, "FULL_IMPORT");
assert.equal(localDefault.environment, "LOCAL");
assert.deepEqual(localDefault.mediaPolicy, MEDIA_POLICIES.FULL);
assert.deepEqual(localDefault.seoPolicy, SEO_POLICIES.DRY_RUN);
assert.deepEqual(localDefault.redirectPolicy, REDIRECT_POLICIES.VALIDATE);

const prodDefault = resolveMigrationProfile({ env: fakeEnv({ APP_ENV: "production" }) });
assert.equal(prodDefault.name, "PRODUCTION");
assert.equal(prodDefault.environment, "PROD");
assert.deepEqual(prodDefault.mediaPolicy, MEDIA_POLICIES.FULL);
assert.deepEqual(prodDefault.seoPolicy, SEO_POLICIES.PRODUCTION);
assert.deepEqual(prodDefault.redirectPolicy, REDIRECT_POLICIES.APPLY);

// resolveMigrationProfile: explicit overrides win over environment defaults

const overridden = resolveMigrationProfile({
  env: fakeEnv({ APP_ENV: "production" }),
  profileName: "DEV_VALIDATION",
  mediaPolicyName: "NONE",
  seoPolicyName: "DRY_RUN",
  redirectPolicyName: "VALIDATE",
});
assert.equal(overridden.name, "DEV_VALIDATION");
assert.equal(overridden.environment, "PROD");
assert.deepEqual(overridden.mediaPolicy, MEDIA_POLICIES.NONE);
assert.deepEqual(overridden.seoPolicy, SEO_POLICIES.DRY_RUN);
assert.deepEqual(overridden.redirectPolicy, REDIRECT_POLICIES.VALIDATE);

// formatMigrationProfileForCli

const formatted = formatMigrationProfileForCli(localDefault);
assert.match(formatted, /Profile: FULL_IMPORT/);
assert.match(formatted, /Environment: LOCAL/);
assert.match(formatted, /Media: FULL/);
assert.match(formatted, /SEO: DRY_RUN/);
assert.match(formatted, /Redirects: VALIDATE/);
assert.match(formatted, /Validate only: NO/);

const prodImport = resolveMigrationProfile({
  env: fakeEnv({ APP_ENV: "production" }),
  profileName: "PROD_IMPORT",
});
assert.equal(prodImport.name, "PROD_IMPORT");
assert.equal(prodImport.environment, "PROD");
assert.deepEqual(prodImport.mediaPolicy, MEDIA_POLICIES.FULL);
assert.deepEqual(prodImport.seoPolicy, SEO_POLICIES.VALIDATE);
assert.equal(prodImport.seoPolicy.requireIndexingEnabled, false);
assert.deepEqual(prodImport.redirectPolicy, REDIRECT_POLICIES.VALIDATE);

console.log("migration profile tests: OK");
