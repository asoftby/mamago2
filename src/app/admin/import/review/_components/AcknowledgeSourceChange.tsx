"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { acknowledgeSourceChangeAction } from "../../actions";

/** «Просмотрено»: снимает пометку об изменении поста и закрывает задачу ревью. */
export function AcknowledgeSourceChange({ importedRecordId }: { importedRecordId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function acknowledge() {
    setError(null);
    startTransition(async () => {
      const result = await acknowledgeSourceChangeAction(importedRecordId);
      if (!result.success) {
        setError(result.error ?? "Не удалось отметить");
        toast.error(result.error ?? "Не удалось отметить");
        return;
      }
      toast.success("Изменение отмечено просмотренным");
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" size="sm" onClick={acknowledge} disabled={pending}>
        {pending ? "Сохраняем…" : "Отметить просмотренным"}
      </Button>
      {error && <span role="alert" className="text-xs text-rose-700">{error}</span>}
    </span>
  );
}
