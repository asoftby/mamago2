/**
 * Captured once at module load — the moment THIS runtime process started.
 * Node caches modules per-process, so every importer gets the same instant;
 * a process restart re-evaluates the module and produces a new value.
 */
const processStartedAt = new Date().toISOString();

export function getProcessStartedAt(): string {
  return processStartedAt;
}
