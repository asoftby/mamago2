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

  /**
   * Wait until every currently queued write — including writes enqueued while
   * draining — has settled. CLI processes must call this before disconnecting
   * Prisma when model extensions dispatch indexing in fire-and-forget mode.
   */
  async drain(): Promise<void> {
    while (this.tails.size > 0) {
      await Promise.allSettled([...this.tails.values()]);
    }
  }
}
