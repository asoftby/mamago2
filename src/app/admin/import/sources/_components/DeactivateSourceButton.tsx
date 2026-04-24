"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { activateImportSourceAction, deactivateImportSourceAction } from "../../actions";

type Props = {
  sourceId: string;
  sourceName: string;
};

function SourceStatusDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  loadingLabel,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  loadingLabel: string;
  onConfirm: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-gray-600">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? loadingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeactivateSourceButton({ sourceId, sourceName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDeactivate() {
    setLoading(true);
    const result = await deactivateImportSourceAction(sourceId);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error ?? "Не удалось отключить источник");
      return;
    }

    toast.success("Источник отключён");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-50"
      >
        Отключить
      </button>

      <SourceStatusDialog
        open={open}
        onOpenChange={setOpen}
        title={`Отключить источник «${sourceName}»?`}
        description={
          <>
            <p>Источник исчезнет из основного рабочего списка и перестанет участвовать в новых импортах.</p>
            <p>История запусков и импортированных объектов сохранится, поэтому источник не удаляется полностью.</p>
          </>
        }
        confirmLabel="Отключить источник"
        loadingLabel="Отключаем…"
        onConfirm={handleDeactivate}
        loading={loading}
      />
    </>
  );
}

export function ActivateSourceButton({ sourceId, sourceName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    setLoading(true);
    const result = await activateImportSourceAction(sourceId);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error ?? "Не удалось включить источник");
      return;
    }

    toast.success("Источник снова активен");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-50"
      >
        Включить
      </button>

      <SourceStatusDialog
        open={open}
        onOpenChange={setOpen}
        title={`Включить источник «${sourceName}»?`}
        description={<p>Источник снова появится в активном списке и сможет участвовать в новых прогонах импорта.</p>}
        confirmLabel="Включить источник"
        loadingLabel="Включаем…"
        onConfirm={handleActivate}
        loading={loading}
      />
    </>
  );
}
