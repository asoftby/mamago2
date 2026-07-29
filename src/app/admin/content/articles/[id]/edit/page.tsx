import { notFound } from "next/navigation";
import { getArticleForEditor } from "@/lib/article/articleAdminService";
import { getCurrentUser } from "@/lib/auth/server";
import { ArticleEditorClient } from "@/components/admin/articles/ArticleEditorClient";

export default async function AdminEditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticleForEditor(id);
  if (!article) notFound();

  const user = await getCurrentUser();
  const canModerate = user?.role === "ADMIN" || user?.role === "MODERATOR";

  return <ArticleEditorClient initial={article} canModerate={canModerate} />;
}
