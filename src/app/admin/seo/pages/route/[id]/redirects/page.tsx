import { renderEntityRedirectsPage } from "@/lib/admin/seo/entities/adminAuxPages";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminRouteRedirectsPage({ params }: Props) {
  const { id } = await params;
  return renderEntityRedirectsPage("route", id);
}

