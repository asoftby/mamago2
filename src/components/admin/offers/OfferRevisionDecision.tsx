"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";

/** Решение модератора по ревизии опубликованного оффера: применить или отклонить с комментарием. */
export function OfferRevisionDecision({ revisionId, backHref }: { revisionId: string; backHref: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState<"APPROVE" | "REJECT" | null>(null);

  async function decide(action: "APPROVE" | "REJECT") {
    if (action === "REJECT" && !comment.trim()) {
      toast.error("Укажите причину отклонения");
      return;
    }
    setPending(action);
    try {
      const response = await fetch(`/api/admin/moderation/offer-revisions/${revisionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Не удалось сохранить решение");
      }
      toast.success(action === "APPROVE" ? "Правки применены" : "Правки отклонены");
      router.push(backHref);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить решение");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-base font-semibold">Решение</h2>
      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Комментарий партнёру (обязателен при отклонении)"
        rows={3}
        disabled={pending !== null}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => decide("APPROVE")} disabled={pending !== null}>
          {pending === "APPROVE" ? "Применяем…" : "Применить правки"}
        </Button>
        <Button variant="outline" onClick={() => decide("REJECT")} disabled={pending !== null}>
          {pending === "REJECT" ? "Отклоняем…" : "Отклонить"}
        </Button>
      </div>
    </div>
  );
}
