export interface ArticleTransactionRunner<Tx> {
  $transaction<Result>(operation: (tx: Tx) => Promise<Result>): Promise<Result>;
}

/** All critical Article persistence must enter through this boundary. */
export function runArticleCriticalWrite<Tx, Result>(
  runner: ArticleTransactionRunner<Tx>,
  operation: (tx: Tx) => Promise<Result>,
): Promise<Result> {
  return runner.$transaction(operation);
}

/** Rebuildable projections/filesystem normalization never turn a committed save into a failed save. */
export async function runBestEffortArticleEffect(
  label: string,
  articleId: string,
  effect: () => Promise<void>,
): Promise<void> {
  try {
    await effect();
  } catch (error) {
    console.error(`[article-save:${label}]`, articleId, error);
  }
}
