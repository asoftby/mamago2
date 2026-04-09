"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { notifyAuthStateChanged } from "@/lib/auth/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function DeleteAccountBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("failed");

      notifyAuthStateChanged();
      router.push("/");
      // Toast after navigation
      window.setTimeout(() => {
        toast.success("Ваш профиль удалён");
      }, 300);
    } catch {
      toast.error("Ошибка удаления профиля. Попробуйте снова");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-12 pb-6 pt-2 sm:px-14">
      {/* Icon + title */}
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h2 className="text-[17px] font-semibold text-neutral-900">Удалить профиль?</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Мы удалим ваш профиль и связанные с ним персональные данные
          </p>
        </div>
      </div>

      {/* What will be deleted */}
      <div className="rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3.5 text-left">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">
          Будут удалены
        </h3>
        <ul className="m-0 list-none space-y-1.5 p-0 text-sm text-neutral-700">
          {[
            "Аккаунт и профиль",
            "Данные о детях и семье",
            "«Мой план», идеи, сохранения и сценарии",
            "Персональные настройки и уведомления",
            "Привязка Telegram и активные сессии",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400"
                aria-hidden
              />
              <span className="min-w-0 flex-1 leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* What may remain */}
      <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3.5 text-left">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Может остаться в системе
        </h3>
        <ul className="m-0 list-none space-y-1.5 p-0 text-sm text-neutral-600">
          {[
            "Обезличенная статистика без привязки к личности",
            "Данные, которые мы обязаны хранить по закону",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300"
                aria-hidden
              />
              <span className="min-w-0 flex-1 leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Confirmation checkbox */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={loading}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-red-500"
        />
        <span className="text-sm text-neutral-700">
          Я понимаю, что это действие необратимо
        </span>
      </label>

      {/* Buttons */}
      <div className="flex flex-col gap-2.5">
        <Button
          variant="destructive"
          size="lg"
          className="w-full rounded-2xl font-semibold"
          disabled={!confirmed || loading}
          onClick={handleDelete}
        >
          {loading ? (
            "Удаление…"
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить профиль
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-2xl"
          disabled={loading}
          onClick={onClose}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}

export function DeleteAccountModal({ open, onOpenChange }: Props) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden rounded-3xl border-neutral-200">
          <DialogHeader className="sr-only">
            <DialogTitle>Удалить профиль</DialogTitle>
          </DialogHeader>
          <DeleteAccountBody onClose={handleClose} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-3xl border-t border-neutral-100 bg-white p-0 pb-safe"
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-neutral-200" />
        </div>
        <SheetTitle className="sr-only">Удалить профиль</SheetTitle>
        <DeleteAccountBody onClose={handleClose} />
      </SheetContent>
    </Sheet>
  );
}
