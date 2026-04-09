"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { DeleteAccountModal } from "@/components/account/DeleteAccountModal";

export function SettingsDeleteRow() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 px-5 py-4 hover:bg-red-50/50 transition-colors group"
      >
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
          <Shield className="h-4 w-4 text-red-500" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-red-600">Удалить аккаунт</p>
          <p className="text-xs text-neutral-400 mt-0.5">Безвозвратное удаление данных</p>
        </div>
      </button>

      <DeleteAccountModal open={open} onOpenChange={setOpen} />
    </>
  );
}
