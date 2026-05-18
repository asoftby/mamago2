import { LlmsTxtEditorClient } from "@/components/admin/seo/LlmsTxtEditorClient";
import { getLlmsTxtSnapshot } from "@/lib/seo/llms";
import { getDefaultLlmsTxtContent } from "@/lib/seo/llms-default";

export default async function AdminSeoLlmsTxtPage() {
  const snapshot = await getLlmsTxtSnapshot();

  return (
    <LlmsTxtEditorClient
      initialSnapshot={snapshot}
      defaultContent={getDefaultLlmsTxtContent()}
    />
  );
}
