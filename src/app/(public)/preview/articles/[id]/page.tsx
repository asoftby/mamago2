import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/server";
import { canAccessArticlePreview } from "@/lib/auth/articlePreviewAccess";
import { loadArticleMvpById } from "@/lib/article/articleMvpRenderData";
import { ArticleMvpView } from "@/components/article/mvp/ArticleMvpView";
import { ArticlePreviewBar } from "@/components/article/mvp/ArticlePreviewBar";

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
  if (!user || !canAccessArticlePreview(user.role)) {
    notFound();
  }

  const { id } = await params;
  const data = await loadArticleMvpById(id);
  if (!data) {
    notFound();
  }

  const publicSlug = data.status === "PUBLISHED" ? (data.slug?.trim() || null) : null;

  return (
    <>
      <ArticlePreviewBar articleId={id} status={data.status} publicSlug={publicSlug} />
      <ArticleMvpView
        title={data.title}
        subtitle={data.subtitle}
        excerpt={data.excerpt}
        publishedAt={data.publishedAt}
        blocks={data.blocks}
        readingScrollPaddingExtraRem={2.75}
      />
    </>
  );
}
