import { renderEntitySchemaPage } from "@/lib/admin/seo/entities/adminAuxPages";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminOfferSchemaPage({ params }: Props) {
  const { id } = await params;
  return renderEntitySchemaPage("offer", id);
}

