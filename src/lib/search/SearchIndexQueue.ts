/**
 * Serializes search writes for one entity while allowing unrelated entities
 * to index concurrently. A later final publication upsert therefore cannot
 * be overtaken by an earlier, slower extension-triggered upsert.
 */
export class SearchIndexQueue {
  private readonly tails = new Map<string, Promise<void>>();

  enqueue(key: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    const settled = current.finally(() => {
      if (this.tails.get(key) === settled) this.tails.delete(key);
    });
    this.tails.set(key, settled);
    return settled;
  }
}
