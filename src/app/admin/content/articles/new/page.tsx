import { redirect } from "next/navigation";
import { ArticleEditorClient } from "@/components/admin/articles/ArticleEditorClient";
import { buildEmptyArticleEditorSnapshot } from "@/lib/article/articleEditorEmptySnapshots";
import { getCurrentUser } from "@/lib/auth/server";

export default async function AdminNewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login?from=admin");
  }

  const rawType = (await searchParams).type;
  const type = Array.isArray(rawType) ? rawType[0] : rawType;
  const initial = buildEmptyArticleEditorSnapshot({
    defaultAuthorUserId: user.id,
    // Подборка — тот же редактор статьи с типом COLLECTION.
    publicationType: type === "collection" ? "COLLECTION" : "ARTICLE",
  });
  const canModerate = user.role === "ADMIN" || user.role === "MODERATOR";

  return <ArticleEditorClient initial={initial} canModerate={canModerate} />;
}
