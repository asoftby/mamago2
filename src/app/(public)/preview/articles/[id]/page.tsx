import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";
import { canAccessArticlePreview } from "@/lib/auth/articlePreviewAccess";
import { loadArticleMvpById } from "@/lib/article/articleMvpRenderData";
import { ArticleMvpView } from "@/components/article/mvp/ArticleMvpView";
import { BreakingNewsView } from "@/components/article/mvp/BreakingNewsView";
import { ArticlePreviewBar } from "@/components/article/mvp/ArticlePreviewBar";
import { Button } from "@/components/ui/button";
import { PencilLine } from "lucide-react";

export const metadata: Metadata = {
  title: "Предпросмотр статьи",
  robots: { index: false, follow: false },
};

export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const data = await loadArticleMvpById(id);
  if (!user || !data) {
    notFound();
  }

  const isAuthor = data.authorUserId === user.id;
  const canAccessPreview = canAccessArticlePreview(user.role) || isAuthor;
  if (!canAccessPreview) {
    notFound();
  }

  const publicSlug = data.status === "PUBLISHED" ? (data.slug?.trim() || null) : null;
  const canReturnToEdit = user.role === "ADMIN" || isAuthor;
  const isBreakingNews = data.publicationType === "BREAKING_NEWS";
  const editHref = isBreakingNews
    ? `/admin/content/publications/new?type=news&id=${id}`
    : `/admin/content/articles/${id}/edit`;

  return (
    <>
      <ArticlePreviewBar status={data.status} publicSlug={publicSlug} />
      {canReturnToEdit ? (
        <Button
          asChild
          size="sm"
          className="fixed bottom-4 right-4 z-50 h-11 rounded-full bg-amber-800 px-5 text-white shadow-lg shadow-amber-900/20 hover:bg-amber-900"
        >
          <Link href={editHref}>
            <PencilLine className="mr-2 h-4 w-4" aria-hidden />
            Вернуться к редактированию
          </Link>
        </Button>
      ) : null}
      {isBreakingNews ? (
        <BreakingNewsView
          articleId={data.id}
          title={data.title}
          excerpt={data.excerpt}
          publishedAt={data.publishedAt}
          blocks={data.blocks}
          author={data.author}
          tags={data.tags}
          editHref={canReturnToEdit ? editHref : undefined}
          draftWatermark={data.status !== "PUBLISHED"}
          articleHref={`/preview/articles/${id}`}
          coverImageUrl={data.heroUrl}
        />
      ) : (
      <ArticleMvpView
        title={data.title}
        subtitle={data.subtitle}
        publicationType={data.publicationType}
        excerpt={data.excerpt}
        publishedAt={data.publishedAt}
        blocks={data.blocks}
        tags={data.tags}
        categoryLabel={data.categoryLabel}
        author={data.author}
        readingScrollPaddingExtraRem={2.75}
      />
      )}
    </>
  );
}
