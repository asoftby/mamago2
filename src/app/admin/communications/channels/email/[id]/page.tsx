import { EmailTemplateEditorClient } from "@/components/admin/email-studio/EmailTemplateEditorClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminChannelsEmailEditorPage({ params }: PageProps) {
  const { id } = await params;
  return <EmailTemplateEditorClient templateId={id} />;
}
