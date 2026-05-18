"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { unsubscribeAction, type UnsubscribeActionState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Отписка...
        </>
      ) : (
        "Да, отписаться"
      )}
    </Button>
  );
}

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    unsubscribeAction.bind(null, token),
    { status: "confirm" } satisfies UnsubscribeActionState
  );

  // Success state
  if (state.status === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">
            {state.alreadyUnsubscribed
              ? "Вы уже отписаны"
              : "Вы отписались от рассылки"}
          </CardTitle>
          <CardDescription className="text-base">
            {state.alreadyUnsubscribed
              ? "Вы уже отписаны от маркетинговых писем mamaGo"
              : "Вы больше не будете получать маркетинговые письма mamaGo"}
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
    );
  }

  // Error state
  if (state.status === "error") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100">
            <CheckCircle2 className="size-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Ссылка недействительна</CardTitle>
          <CardDescription className="text-base">{state.message}</CardDescription>
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
    );
  }

  // Confirmation state (default)
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Отписаться от рассылки?</CardTitle>
        <CardDescription className="text-base">
          Вы больше не будете получать маркетинговые письма mamaGo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="mb-2">Что изменится:</p>
          <ul className="space-y-1 pl-4">
            <li className="list-disc">Вы перестанете получать рекламные письма и дайджесты</li>
            <li className="list-disc">
              Важные системные уведомления (подтверждение email, сброс пароля) продолжат
              приходить
            </li>
          </ul>
        </div>
        <form action={formAction}>
          <SubmitButton />
        </form>
        <div className="text-center">
          <Button asChild variant="link" className="text-sm text-muted-foreground">
            <Link href="/">Нет, остаться</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}