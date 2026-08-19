import type { MigrationAdapter, MigrationAdapterMetadata } from "../types";

const adapterKeyPattern = /^[a-z0-9][a-z0-9_-]*$/;
const adapters = new Map<string, MigrationAdapter>();

function normalizeAdapterKey(key: string): string {
  return key.trim();
}

function assertAdapterKey(key: string): void {
  if (!adapterKeyPattern.test(key)) {
    throw new Error(
      `Invalid migration adapter key "${key}". Use lowercase letters, numbers, dashes, or underscores.`,
    );
  }
}

export function registerMigrationAdapter(adapter: MigrationAdapter): void {
  const key = normalizeAdapterKey(adapter.metadata.key);
  assertAdapterKey(key);

  if (adapters.has(key)) {
    throw new Error(`Migration adapter "${key}" is already registered`);
  }

  adapters.set(key, {
    ...adapter,
    metadata: {
      ...adapter.metadata,
      key,
    },
  });
}

export function getMigrationAdapter(key: string): MigrationAdapter | null {
  const normalizedKey = normalizeAdapterKey(key);
  return adapters.get(normalizedKey) ?? null;
}

export function listMigrationAdapters(): readonly MigrationAdapterMetadata[] {
  return [...adapters.values()]
    .map((adapter) => adapter.metadata)
    .sort((left, right) => left.key.localeCompare(right.key));
}
