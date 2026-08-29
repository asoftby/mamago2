import assert from "node:assert/strict";
import {
  runArticleCriticalWrite,
  runBestEffortArticleEffect,
} from "./articleWriteAtomicity";

type State = {
  title: string;
  status: "DRAFT" | "PUBLISHED";
  tags: string[];
  cityId: string | null;
  slug: string | null;
  history: string[];
  canonical: string | null;
};

function transactionalState(initial: State) {
  let committed = structuredClone(initial);
  return {
    read: () => structuredClone(committed),
    runner: {
      async $transaction<Result>(operation: (draft: State) => Promise<Result>) {
        const draft = structuredClone(committed);
        const result = await operation(draft);
        committed = draft;
        return result;
      },
    },
  };
}

async function assertCriticalFailureRollsBack(stage: string): Promise<void> {
  const initial: State = {
    title: "Before",
    status: "DRAFT",
    tags: ["old"],
    cityId: "minsk",
    slug: "before",
    history: [],
    canonical: "/minsk/blog/before",
  };
  const store = transactionalState(initial);
  await assert.rejects(
    runArticleCriticalWrite(store.runner, async (draft) => {
      draft.title = "After";
      draft.status = "PUBLISHED";
      if (stage === "base") throw new Error("base failed");
      draft.tags = ["new"];
      if (stage === "tags") throw new Error("tags failed");
      draft.cityId = "vitebsk";
      if (stage === "geography") throw new Error("geography failed");
      draft.history.push(draft.slug!);
      if (stage === "history") throw new Error("history failed");
      draft.slug = "after";
      draft.canonical = "/vitebsk/blog/after";
      if (stage === "canonical") throw new Error("canonical failed");
    }),
    new RegExp(`${stage} failed`),
  );
  assert.deepEqual(store.read(), initial, `${stage} failure must not commit partial Article state`);
}

async function main(): Promise<void> {
  for (const stage of ["base", "tags", "geography", "history", "canonical"]) {
    await assertCriticalFailureRollsBack(stage);
  }

  const store = transactionalState({
    title: "Before",
    status: "DRAFT",
    tags: [],
    cityId: "minsk",
    slug: null,
    history: [],
    canonical: null,
  });
  await runArticleCriticalWrite(store.runner, async (draft) => {
    draft.title = "After";
    draft.tags = ["family"];
    draft.slug = "after";
    draft.history.push("article-id");
    draft.canonical = "/minsk/blog/after";
    draft.status = "PUBLISHED";
  });
  assert.deepEqual(store.read(), {
    title: "After",
    status: "PUBLISHED",
    tags: ["family"],
    cityId: "minsk",
    slug: "after",
    history: ["article-id"],
    canonical: "/minsk/blog/after",
  });

  const originalError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    await runBestEffortArticleEffect("media-usage", "article-1", async () => {
      throw new Error("projection unavailable");
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(logged.length, 1, "derived failure must be diagnosable");
  console.log("articleWriteAtomicity failure-injection tests: OK");
}

void main();
