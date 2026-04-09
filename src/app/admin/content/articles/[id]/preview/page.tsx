import { redirect } from "next/navigation";

/**
 * Старый URL предпросмотра: редирект на публичный shell `/preview/articles/[id]`.
 */
export default async function AdminArticlePreviewRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/preview/articles/${id}`);
}
