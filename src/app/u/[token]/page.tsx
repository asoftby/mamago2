import { Metadata } from "next";
import { UnsubscribeForm } from "./UnsubscribeForm";

export const metadata: Metadata = {
  title: "Отписка от рассылки | mamaGo",
  description: "Управление подпиской на маркетинговые письма mamaGo",
};

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <UnsubscribeForm token={token} />
    </div>
  );
}
