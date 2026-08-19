"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { toast } from "@/lib/toast";
import { setScenarioItemTimeAction } from "@/app/(public)/[city]/my-plan/[date]/scenario/actions";

type AssignScenarioTimeControlProps = {
  city: string;
  date: string;
  planItemId: string;
  /** Present when the item already has an assigned (override) time — label
   * switches from "+ Назначить время" to "Изменить время". */
  currentTime: string | null;
};

export function AssignScenarioTimeControl({
  city,
  date,
  planItemId,
  currentTime,
}: AssignScenarioTimeControlProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentTime ?? "12:00");
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <Clock className="h-3.5 w-3.5" />
        {currentTime ? "Изменить время" : "Назначить время"}
      </button>
    );
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await setScenarioItemTimeAction(city, date, planItemId, value);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        toast.error("Не удалось сохранить время");
      }
    });
  };

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <input
        type="time"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-9 rounded-xl border border-neutral-200 bg-white px-2.5 text-sm text-neutral-900"
        aria-label="Время активности"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="h-9 rounded-xl bg-neutral-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        Сохранить
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(currentTime ?? "12:00");
          setEditing(false);
        }}
        disabled={isPending}
        className="h-9 rounded-xl px-2 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        Отмена
      </button>
    </div>
  );
}
