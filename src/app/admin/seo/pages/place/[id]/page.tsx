import { renderEntitySeoEditorPage } from "@/lib/admin/seo/entities/adminPages";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminPlaceSeoPage({ params }: Props) {
  const { id } = await params;
  return renderEntitySeoEditorPage("place", id);
}

