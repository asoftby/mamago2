"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { AlertTriangle } from "lucide-react";
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
  const [loading, setLoading] = React.useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/delete", {
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
      toast.error("Не получилось выполнить действие. Попробуйте снова");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 px-8 pb-6 pt-4 sm:px-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h2 className="text-[17px] font-semibold text-neutral-900">Удалить аккаунт</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Вы уверены, что хотите удалить аккаунт?
            <br />
            Это действие нельзя отменить
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-2xl"
          disabled={loading}
          onClick={onClose}
        >
          Отмена
        </Button>
        <Button
          variant="destructive"
          size="lg"
          className="w-full rounded-2xl font-semibold"
          disabled={loading}
          onClick={handleDelete}
        >
          {loading ? "Удаление..." : "Удалить аккаунт"}
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
