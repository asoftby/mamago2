import { SupportInbox } from "@/features/support/SupportInbox";
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread } = await searchParams;
  return <SupportInbox staff initialThreadId={thread} />;
}
