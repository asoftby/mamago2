"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rematchOrphanedRecordsAction } from "../../actions";

interface Props {
  runId: string;
  orphanedCount: number;
}

export function RematchButton({ runId, orphanedCount }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (orphanedCount === 0) return null;

  async function handleRematch() {
    setLoading(true);
    const res = await rematchOrphanedRecordsAction(runId);
    setLoading(false);
    if (res.success) {
      toast.success(
        res.created > 0 || res.failed > 0
          ? `Задач создано (repair): ${res.created}${res.failed > 0 ? `, ошибок matching: ${res.failed}` : ""}`
          : "Изменений не потребовалось",
      );
      router.refresh();
    } else {
      toast.error(res.error ?? "Ошибка");
    }
  }

  return (
    <button
      onClick={handleRematch}
      disabled={loading}
      className="rounded px-3 py-1.5 text-xs border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition"
      title={`${orphanedCount} записей: repair ImportReviewTask и/или повтор matching для SKIPPED`}
    >
      {loading ? "Matching…" : `⟳ Matching (${orphanedCount})`}
    </button>
  );
}
