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

  if (!page || page.type !== PageType.LEGAL) {
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

export default async function LegalPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);

  // Проверяем, что страница существует, опубликована и имеет тип LEGAL
  if (!page || page.type !== PageType.LEGAL) {
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

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 border-t border-b border-gray-200 py-4">
            {page.publishedAt && (
              <div>
                <span className="font-medium">Опубликовано:</span>{" "}
                {new Date(page.publishedAt).toLocaleDateString("ru-RU", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            )}
            {page.updatedAt && (
              <div>
                <span className="font-medium">Обновлено:</span>{" "}
                {new Date(page.updatedAt).toLocaleDateString("ru-RU", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            )}
          </div>
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

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Этот документ является юридическим документом mamaGo.by
          </p>
        </footer>
      </div>
    </div>
  );
}
