"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";

export default function HomePage() {
  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <Badge>mamaGo 2.0</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">UI kit initialized</h1>
          <p className="text-muted-foreground">
            Shadcn + Tailwind работают.
          </p>
        </div>

        <Card className="rounded-[32px]">
          <CardHeader>
            <CardTitle>Проверка компонентов</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button className="rounded-[32px]">Primary</Button>
            <Button variant="secondary" className="rounded-[32px]">
              Secondary
            </Button>
            <Button variant="outline" className="rounded-[32px]">
              Outline
            </Button>
          </CardContent>
        </Card>
        <div>
          <button
            onClick={() => toast.success("Добавлено в план")}
            className="mt-4 rounded-[32px] border px-4 py-2"
          >
            Test Toast
          </button>
        </div>
      </div>
    </main>
  );
}
