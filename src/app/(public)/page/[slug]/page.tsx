import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getPublishedPageBySlug } from "@/lib/pages/service";
import { PageType } from "@prisma/client";
import { sanitizeRichContent } from "@/components/content/RichContentRenderer";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);

  if (!page || page.type === PageType.LEGAL) {
    return {
      title: "Страница не найдена",
    };
  }

  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.excerpt || undefined,
    openGraph: {
      title: page.seoTitle || page.title,
      description: page.seoDescription || page.excerpt || undefined,
      ...(page.ogImageUrl && { images: [page.ogImageUrl] }),
    },
  };
}

export default async function PublicPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);

  // Проверяем, что страница существует, опубликована и НЕ LEGAL (LEGAL идут через /legal/[slug])
  if (!page || page.type === PageType.LEGAL) {
    notFound();
  }

  // Проверяем visibility
  if (page.visibility === "PRIVATE") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {page.title}
          </h1>
          
          {page.excerpt && (
            <p className="text-xl text-gray-600 mb-6">
              {page.excerpt}
            </p>
          )}
        </header>

        {/* Content */}
        <article className="prose prose-lg max-w-none">
          {page.content ? (
            <div
              dangerouslySetInnerHTML={{
                __html: sanitizeRichContent(page.content),
              }}
              className="text-gray-800 leading-relaxed"
            />
          ) : (
            <p className="text-gray-600">Содержимое страницы отсутствует.</p>
          )}
        </article>
      </div>
    </div>
  );
}
