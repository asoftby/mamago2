import { EmailTemplatesPageClient } from "@/components/admin/email-studio/EmailTemplatesPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminEmailStudioPage() {
  return <EmailTemplatesPageClient />;
}
