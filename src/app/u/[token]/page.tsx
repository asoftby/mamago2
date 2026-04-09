import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyUnsubscribeToken } from "@/lib/auth/unsubscribe-token";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Отписка от рассылки | mamaGo",
  description: "Управление подпиской на маркетинговые письма mamaGo",
};

type UnsubscribeResult =
  | { success: true; alreadyUnsubscribed: boolean }
  | { success: false; reason: "invalid_token" | "user_not_found" | "error" };

async function processUnsubscribe(token: string): Promise<UnsubscribeResult> {
  try {
    // Verify token
    const verified = verifyUnsubscribeToken(token);
    
    if (!verified) {
      return { success: false, reason: "invalid_token" };
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      select: { id: true, marketingEmailsEnabled: true },
    });

    if (!user) {
      return { success: false, reason: "user_not_found" };
    }

    // Check if already unsubscribed
    const alreadyUnsubscribed = !user.marketingEmailsEnabled;

    // Update user (idempotent - safe to call multiple times)
    if (user.marketingEmailsEnabled) {
      await prisma.user.update({
        where: { id: user.id },
        data: { marketingEmailsEnabled: false },
      });
    }

    return { success: true, alreadyUnsubscribed };
  } catch (error) {
    console.error("[Unsubscribe] Error processing unsubscribe:", error);
    return { success: false, reason: "error" };
  }
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await processUnsubscribe(token);

  if (result.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="size-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">
              {result.alreadyUnsubscribed ? "Вы уже отписаны" : "Отписка выполнена"}
            </CardTitle>
            <CardDescription className="text-base">
              {result.alreadyUnsubscribed
                ? "Вы уже отписаны от маркетинговых писем mamaGo"
                : "Вы успешно отписались от маркетинговых писем mamaGo"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="mb-2">Что это значит:</p>
              <ul className="space-y-1 pl-4">
                <li className="list-disc">Вы больше не будете получать рекламные письма и дайджесты</li>
                <li className="list-disc">
                  Важные системные уведомления (подтверждение email, сброс пароля) продолжат
                  приходить
                </li>
              </ul>
            </div>
            <Button asChild className="w-full">
              <Link href="/">Перейти на главную</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="size-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Ссылка недействительна</CardTitle>
          <CardDescription className="text-base">
            {result.reason === "invalid_token" && "Ссылка для отписки устарела или повреждена"}
            {result.reason === "user_not_found" && "Пользователь не найден"}
            {result.reason === "error" && "Произошла ошибка при обработке запроса"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p>
              Если вы хотите отписаться от рассылки, попробуйте использовать ссылку из последнего
              полученного письма или обратитесь в поддержку.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Перейти на главную</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
