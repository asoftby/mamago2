import { redirect } from "next/navigation";
import { adminPath } from "@/lib/routing/surface";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEmailStudioEditorCompatibilityPage({
  params,
}: PageProps) {
  const { id } = await params;
  redirect(adminPath(`/communications/email-studio/${id}`));
}
