import assert from "node:assert/strict";
import {
  analyticsEventKey,
  createContinuousReaderState,
  excludeIdsFromState,
  pickActiveArticleIndex,
  progressBucketsCrossed,
  reduceContinuousReader,
  shouldPrefetchNext,
} from "./continuousReadingState";

const a1 = {
  id: "1",
  slug: "first",
  href: "/minsk/blog/first",
  documentTitle: "First — mamaGo",
};
const a2 = {
  id: "2",
  slug: "second",
  href: "/minsk/blog/second",
  documentTitle: "Second — mamaGo",
};
const a3 = {
  id: "3",
  slug: "third",
  href: "/minsk/blog/third",
  documentTitle: "Third — mamaGo",
};

{
  let s = createContinuousReaderState(a1);
  assert.equal(shouldPrefetchNext(s), true);
  assert.deepEqual(excludeIdsFromState(s), ["1"]);

  s = reduceContinuousReader(s, { type: "PREFETCH_NEAR_END" });
  assert.equal(s.loadStatus, "loading");
  assert.equal(s.requestGeneration, 1);
  assert.equal(shouldPrefetchNext(s), false);

  // Повторный PREFETCH во время loading — no-op
  const s2 = reduceContinuousReader(s, { type: "PREFETCH_NEAR_END" });
  assert.equal(s2.requestGeneration, 1);

  s = reduceContinuousReader(s, {
    type: "LOAD_SUCCESS",
    generation: 1,
    article: a2,
  });
  assert.equal(s.articles.length, 2);
  assert.equal(s.loadStatus, "ready");
  // Уже есть следующая вперёд — prefetch пока activeIndex=0 и length=2 не нужен? 
  // shouldPrefetch: length === activeIndex + 1 → 2 === 1? false. Хорошо: одна вперёд.
  assert.equal(shouldPrefetchNext(s), false);

  s = reduceContinuousReader(s, { type: "SET_ACTIVE_INDEX", index: 1, stableMs: 120 });
  assert.equal(s.activeIndex, 1);
  assert.equal(shouldPrefetchNext(s), true);

  // Устаревший ответ игнорируется
  const gen = s.requestGeneration;
  s = reduceContinuousReader(s, { type: "PREFETCH_NEAR_END" });
  assert.equal(s.requestGeneration, gen + 1);
  const stale = reduceContinuousReader(s, {
    type: "LOAD_SUCCESS",
    generation: gen,
    article: a3,
  });
  assert.equal(stale.articles.length, 2);

  s = reduceContinuousReader(s, {
    type: "LOAD_SUCCESS",
    generation: s.requestGeneration,
    article: a3,
  });
  assert.equal(s.articles.length, 3);

  // Дубликат id не добавляется
  s = reduceContinuousReader(
    { ...s, loadStatus: "loading", requestGeneration: s.requestGeneration + 1 },
    {
      type: "LOAD_SUCCESS",
      generation: s.requestGeneration + 1,
      article: a3,
    },
  );
  assert.equal(s.articles.length, 3);
}

{
  let s = createContinuousReaderState(a1);
  s = reduceContinuousReader(s, { type: "PREFETCH_NEAR_END" });
  s = reduceContinuousReader(s, {
    type: "LOAD_ERROR",
    generation: 1,
    message: "network",
  });
  assert.equal(s.loadStatus, "error");
  assert.equal(shouldPrefetchNext(s), false);
  s = reduceContinuousReader(s, { type: "RETRY" });
  assert.equal(s.loadStatus, "idle");
  assert.equal(shouldPrefetchNext(s), true);
}

{
  let s = createContinuousReaderState(a1);
  s = reduceContinuousReader(s, { type: "PREFETCH_NEAR_END" });
  s = reduceContinuousReader(s, { type: "LOAD_EMPTY", generation: 1 });
  assert.equal(s.loadStatus, "exhausted");
  assert.equal(s.exhaustedAnnounced, true);
  assert.equal(shouldPrefetchNext(s), false);
  const again = reduceContinuousReader(s, { type: "PREFETCH_NEAR_END" });
  assert.equal(again.requestGeneration, s.requestGeneration);
}

{
  assert.deepEqual(progressBucketsCrossed(0, 0.24), []);
  assert.deepEqual(progressBucketsCrossed(0, 0.25), [25]);
  assert.deepEqual(progressBucketsCrossed(0.2, 0.8), [25, 50, 75]);
  assert.deepEqual(progressBucketsCrossed(0.9, 1), [100]);
  assert.deepEqual(progressBucketsCrossed(0.5, 0.49), []);
}

{
  assert.equal(
    analyticsEventKey("article_view", "abc"),
    "article_view:abc",
  );
}

{
  // Активная статья — последний заголовок, ушедший выше линии 28% viewport
  const vh = 1000;
  const line = 280;
  assert.equal(
    pickActiveArticleIndex({
      headerTops: [100, 400, 900],
      viewportHeight: vh,
    }),
    0,
  );
  assert.equal(
    pickActiveArticleIndex({
      headerTops: [100 - 0, line - 10, 900],
      viewportHeight: vh,
    }),
    1,
  );
  assert.equal(
    pickActiveArticleIndex({
      headerTops: [-100, -50, line - 5],
      viewportHeight: vh,
    }),
    2,
  );
}

console.log("✅ continuousReadingState.test.ts");
