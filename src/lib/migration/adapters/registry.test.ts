import assert from "node:assert/strict";

import {
  getMigrationAdapter,
  listMigrationAdapters,
  registerMigrationAdapter,
} from "./registry";
import type { MigrationAdapter, MigrationAdapterMetadata } from "../types";

function adapterMetadata(key: string): MigrationAdapterMetadata {
  return {
    key,
    version: "0.0.0-test",
    displayName: `Test adapter ${key}`,
    supportedSourceEntityTypes: ["test_record"],
    supportedTargetTypes: ["PLACE"],
    capabilities: ["DISCOVERY"],
    stableIdPolicy: "Test records use sourceStableKey directly.",
    hashPolicy: "No payload hashing in registry tests.",
    timezonePolicy: "UTC",
    deletionPolicy: "Missing source records do not imply deletion.",
  };
}

function adapter(key: string): MigrationAdapter {
  return {
    metadata: adapterMetadata(key),
  };
}

{
  assert.equal(getMigrationAdapter("missing_phase7_adapter"), null);

  const first = adapter("phase7_registry_test_a");
  const second = adapter("phase7_registry_test_b");

  registerMigrationAdapter(first);
  registerMigrationAdapter(second);

  assert.equal(getMigrationAdapter("phase7_registry_test_a")?.metadata.key, first.metadata.key);
  assert.equal(getMigrationAdapter("phase7_registry_test_b")?.metadata.key, second.metadata.key);

  const registeredKeys = listMigrationAdapters().map((metadata) => metadata.key);
  assert.ok(registeredKeys.includes(first.metadata.key));
  assert.ok(registeredKeys.includes(second.metadata.key));
  assert.deepEqual([...registeredKeys].sort(), registeredKeys);

  assert.throws(
    () => registerMigrationAdapter(adapter("phase7_registry_test_a")),
    /already registered/,
  );
}

{
  assert.throws(
    () => registerMigrationAdapter(adapter("Invalid Adapter Key")),
    /Invalid migration adapter key/,
  );
}

console.log("migration adapter registry tests: OK");
