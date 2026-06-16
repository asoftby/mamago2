import { redirect } from "next/navigation";
import { adminPath } from "@/lib/routing/surface";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCommunicationsEmailStudioEditorPage({ params }: PageProps) {
  const { id } = await params;
  redirect(adminPath(`/communications/channels/email/${id}`));
}
