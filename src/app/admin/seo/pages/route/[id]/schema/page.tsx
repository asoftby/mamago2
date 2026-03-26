import { renderEntitySchemaPage } from "@/lib/admin/seo/entities/adminAuxPages";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminRouteSchemaPage({ params }: Props) {
  const { id } = await params;
  return renderEntitySchemaPage("route", id);
}

