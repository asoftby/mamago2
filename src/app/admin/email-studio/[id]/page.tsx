import { EmailTemplateEditorClient } from "@/components/admin/email-studio/EmailTemplateEditorClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEmailStudioTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EmailTemplateEditorClient templateId={id} />;
}
