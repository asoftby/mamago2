import assert from "node:assert/strict";
import type { NormalizedArticleCandidate } from "../../adapters/wordpress-db/normalizeArticle";
import {
  createArticlesTargetStateResolver,
  createArticlesWriter,
  type ArticlesTargetStatePrismaClient,
  type ArticlesWriteTransactionClient,
  type ArticlesWriterPrismaClient,
  type RawArticleSourceRepository,
} from "./articlesProductionWiring";
import type { ArticlesMigrationCandidate } from "./articlesAdapter";

const SOURCE_ID = "source-1";
const ARTICLE_KEY = "wordpress-db:post:24695";

function fixtureCandidate(overrides: Partial<ArticlesMigrationCandidate> = {}): ArticlesMigrationCandidate {
  return { sourceRecordKey: ARTICLE_KEY, domainHash: "wordpress-db-domain-v2:fixture", ...overrides };
}

function fixtureRawCandidate(overrides: Partial<NormalizedArticleCandidate> = {}): NormalizedArticleCandidate {
  return {
    title: "Golden Article", slug: "golden-article", content: "<p>Content</p>", excerpt: "Excerpt",
    status: "publish", publishedAt: "2026-01-01 00:00:00", modifiedAt: "2026-01-01 00:00:00",
    seo: { title: null, description: null, focusKeyword: null, canonicalUrl: null, robots: null, ogTitle: null, ogDescription: null },
    featuredImageAttachmentId: null, inlineImageAttachmentIds: [], oldSlugs: [],
    hasElementorContent: false, hasWebStoryContent: false,
    ...overrides,
  } as NormalizedArticleCandidate;
}

interface FakeLineageRow {
  id: string; sourceId: string; sourceRecordKey: string; targetType: string; targetRole: string; targetId: string | null; lastSourceHash: string | null; isActive: boolean;
}

function fakeTargetStatePrisma(input: { lineages?: FakeLineageRow[]; articles?: Record<string, { id: string }> }): ArticlesTargetStatePrismaClient {
  const lineages = input.lineages ?? [];
  const articles = input.articles ?? {};
  return {
    migrationLineage: {
      findMany: (async (args: { where: { sourceId: string; sourceRecordKey: string; targetType: string; targetRole?: string; isActive: boolean } }) =>
        lineages.filter((row) => row.sourceId === args.where.sourceId && row.sourceRecordKey === args.where.sourceRecordKey && row.targetType === args.where.targetType && row.isActive === args.where.isActive)) as unknown as ArticlesTargetStatePrismaClient["migrationLineage"]["findMany"],
    },
    article: {
      findUnique: (async (args: { where: { id: string } }) => articles[args.where.id] ?? null) as unknown as ArticlesTargetStatePrismaClient["article"]["findUnique"],
    },
  };
}

async function testTargetStateResolverCleanTarget(): Promise<void> {
  const prisma = fakeTargetStatePrisma({});
  const resolve = createArticlesTargetStateResolver(prisma, SOURCE_ID);
  assert.deepEqual(await resolve(fixtureCandidate()), { lineageCount: 0, targetExists: false, lineageDomainHash: null });
}

async function testTargetStateResolverRerunMatch(): Promise<void> {
  const prisma = fakeTargetStatePrisma({
    lineages: [{ id: "l1", sourceId: SOURCE_ID, sourceRecordKey: ARTICLE_KEY, targetType: "ARTICLE", targetRole: "primary", targetId: "article-1", lastSourceHash: "wordpress-db-domain-v2:fixture", isActive: true }],
    articles: { "article-1": { id: "article-1" } },
  });
  const resolve = createArticlesTargetStateResolver(prisma, SOURCE_ID);
  const state = await resolve(fixtureCandidate());
  assert.equal(state.lineageCount, 1);
  assert.equal(state.targetExists, true);
  assert.equal(state.lineageDomainHash, "wordpress-db-domain-v2:fixture");
}

async function testTargetStateResolverLineageWithoutTarget(): Promise<void> {
  const prisma = fakeTargetStatePrisma({
    lineages: [{ id: "l1", sourceId: SOURCE_ID, sourceRecordKey: ARTICLE_KEY, targetType: "ARTICLE", targetRole: "primary", targetId: "article-missing", lastSourceHash: "h", isActive: true }],
  });
  const resolve = createArticlesTargetStateResolver(prisma, SOURCE_ID);
  const state = await resolve(fixtureCandidate());
  assert.equal(state.targetExists, false);
}

// ---------------------------------------------------------------------------
// createArticlesWriter — transactional fake, real commit/rollback semantics
// ---------------------------------------------------------------------------

function createTransactionalArticlesFake(input: { articleShouldFail?: boolean; lineageShouldFail?: boolean } = {}) {
  const committedArticles: Array<Record<string, unknown> & { id: string }> = [];
  const committedLineages: Array<Record<string, unknown> & { id: string }> = [];
  let articleCreateCalls = 0;
  let lineageCreateCalls = 0;

  const prisma: ArticlesWriterPrismaClient = {
    $transaction: (async (fn: (tx: ArticlesWriteTransactionClient) => Promise<unknown>) => {
      const stagedArticles: Array<Record<string, unknown> & { id: string }> = [];
      const stagedLineages: Array<Record<string, unknown> & { id: string }> = [];
      const tx: ArticlesWriteTransactionClient = {
        article: {
          create: (async ({ data }: { data: Record<string, unknown> }) => {
            articleCreateCalls += 1;
            if (input.articleShouldFail) throw new Error("ARTICLE_CREATE_FAILED_SIMULATED");
            const row = { id: `article-${stagedArticles.length + 1}`, ...data };
            stagedArticles.push(row);
            return row;
          }) as unknown as ArticlesWriteTransactionClient["article"]["create"],
          update: (async () => { throw new Error("not used in these tests") }) as unknown as ArticlesWriteTransactionClient["article"]["update"],
        },
        migrationLineage: {
          create: (async ({ data }: { data: Record<string, unknown> }) => {
            lineageCreateCalls += 1;
            if (input.lineageShouldFail) throw new Error("LINEAGE_CREATE_FAILED_SIMULATED");
            const row = { id: `lineage-${stagedLineages.length + 1}`, ...data };
            stagedLineages.push(row);
            return row;
          }) as unknown as ArticlesWriteTransactionClient["migrationLineage"]["create"],
          updateMany: (async () => ({ count: 0 })) as unknown as ArticlesWriteTransactionClient["migrationLineage"]["updateMany"],
          findUnique: (async () => null) as unknown as ArticlesWriteTransactionClient["migrationLineage"]["findUnique"],
          findUniqueOrThrow: (async () => { throw new Error("not used") }) as unknown as ArticlesWriteTransactionClient["migrationLineage"]["findUniqueOrThrow"],
        },
      };
      const result = await fn(tx);
      committedArticles.push(...stagedArticles);
      committedLineages.push(...stagedLineages);
      return result;
    }) as ArticlesWriterPrismaClient["$transaction"],
  };

  return {
    prisma,
    committedArticles: () => committedArticles,
    committedLineages: () => committedLineages,
    articleCreateCalls: () => articleCreateCalls,
    lineageCreateCalls: () => lineageCreateCalls,
  };
}

async function expectRejectMessage(action: () => Promise<unknown>, message: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof Error && error.message === message);
}

async function testWriterCommitsArticleAndLineageTogether(): Promise<void> {
  const rawSource: RawArticleSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate() };
  const fake = createTransactionalArticlesFake();
  const write = createArticlesWriter(fake.prisma, rawSource, SOURCE_ID);
  const result = await write(fixtureCandidate());
  assert.equal(fake.articleCreateCalls(), 1);
  assert.equal(fake.lineageCreateCalls(), 1);
  assert.equal(fake.committedArticles().length, 1);
  assert.equal(fake.committedLineages().length, 1);
  assert.equal(result.targetId, fake.committedArticles()[0].id);
}

async function testWriterLineageFailureRollsBackArticle(): Promise<void> {
  const rawSource: RawArticleSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate() };
  const fake = createTransactionalArticlesFake({ lineageShouldFail: true });
  const write = createArticlesWriter(fake.prisma, rawSource, SOURCE_ID);
  await expectRejectMessage(() => write(fixtureCandidate()), "LINEAGE_CREATE_FAILED_SIMULATED");
  assert.equal(fake.committedArticles().length, 0, "no Article may survive a failed lineage write");
}

async function testWriterArticleFailureNeverCallsLineageWriter(): Promise<void> {
  const rawSource: RawArticleSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate() };
  const fake = createTransactionalArticlesFake({ articleShouldFail: true });
  const write = createArticlesWriter(fake.prisma, rawSource, SOURCE_ID);
  await expectRejectMessage(() => write(fixtureCandidate()), "ARTICLE_CREATE_FAILED_SIMULATED");
  assert.equal(fake.lineageCreateCalls(), 0);
}

async function testWriterRejectsUnsupportedElementorContent(): Promise<void> {
  const rawSource: RawArticleSourceRepository = { loadNormalizedCandidate: () => fixtureRawCandidate({ hasElementorContent: true }) };
  const fake = createTransactionalArticlesFake();
  const write = createArticlesWriter(fake.prisma, rawSource, SOURCE_ID);
  await expectRejectMessage(() => write(fixtureCandidate()), "ARTICLE_DRAFT_INVALID:ELEMENTOR_CONTENT_UNSUPPORTED");
  assert.equal(fake.articleCreateCalls(), 0, "the transaction must never open for an invalid draft");
}

async function main(): Promise<void> {
  await testTargetStateResolverCleanTarget();
  await testTargetStateResolverRerunMatch();
  await testTargetStateResolverLineageWithoutTarget();
  await testWriterCommitsArticleAndLineageTogether();
  await testWriterLineageFailureRollsBackArticle();
  await testWriterArticleFailureNeverCallsLineageWriter();
  await testWriterRejectsUnsupportedElementorContent();
  console.log("Phoenix Articles production wiring tests: PASS");
}

void main();
