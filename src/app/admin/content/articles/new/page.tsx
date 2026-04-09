import { redirect } from "next/navigation";
import { ArticleEditorClient } from "@/components/admin/articles/ArticleEditorClient";
import { buildEmptyArticleEditorSnapshot } from "@/lib/article/articleEditorEmptySnapshots";
import { getCurrentUser } from "@/lib/auth/server";

export default async function AdminNewArticlePage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login?from=admin");
  }

  const initial = buildEmptyArticleEditorSnapshot({ defaultAuthorUserId: user.id });
  const isAdminEditor = user.role === "ADMIN";

  return <ArticleEditorClient initial={initial} isAdminEditor={isAdminEditor} />;
}
