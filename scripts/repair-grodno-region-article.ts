import { prismaBase, searchIndexer } from "@/lib/prisma";
import {
  applyGrodnoRegionRecovery,
  buildGrodnoRegionRecoveryPlan,
  GRODNO_REGION_ARTICLE_RECOVERY,
} from "@/lib/seo/grodnoRegionArticleRecovery";

async function main() {
  const apply = process.argv.includes("--apply");
  const plan = await buildGrodnoRegionRecoveryPlan(prismaBase);

  console.log(JSON.stringify({
    mode: apply ? "APPLY" : "PLAN",
    recovery: GRODNO_REGION_ARTICLE_RECOVERY,
    plan,
  }, null, 2));

  if (!apply) return;
  if (plan.action === "conflict" || plan.action === "not_found") {
    throw new Error(`Refusing APPLY: ${plan.action}: ${plan.reason ?? "unknown"}`);
  }

  await applyGrodnoRegionRecovery(prismaBase, plan, searchIndexer);
  const verified = await buildGrodnoRegionRecoveryPlan(prismaBase);
  if (verified.action !== "already_applied") {
    throw new Error(`Post-apply verification failed: ${JSON.stringify(verified)}`);
  }

  console.log(JSON.stringify({
    result: "APPLIED_AND_VERIFIED",
    articleId: GRODNO_REGION_ARTICLE_RECOVERY.articleId,
    canonicalPath: GRODNO_REGION_ARTICLE_RECOVERY.finalCanonicalPath,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
