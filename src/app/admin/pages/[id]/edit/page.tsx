import { getCurrentUser } from "@/lib/auth/server";
import { redirect, notFound } from "next/navigation";
import { getPageById } from "@/lib/pages/service";
import { PageForm } from "../../PageForm";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPagePage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login");
  }

  const { id } = await params;
  const page = await getPageById(id);

  if (!page) {
    notFound();
  }

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div>
        <h1 className="text-2xl md:text-xl font-bold text-gray-900">Редактировать страницу</h1>
        <p className="text-sm text-gray-600 mt-1">{page.title}</p>
      </div>

      <PageForm
        mode="edit"
        pageId={page.id}
        initialData={{
          title: page.title,
          slug: page.slug,
          type: page.type,
          status: page.status,
          visibility: page.visibility,
          excerpt: page.excerpt,
          content: page.content,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          ogImageUrl: page.ogImageUrl,
        }}
      />
    </div>
  );
}
