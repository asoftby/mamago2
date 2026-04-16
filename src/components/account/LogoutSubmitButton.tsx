"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accountDropdownIconClass,
  accountDropdownRowDefault,
} from "@/components/account/accountDropdownTokens";

type LogoutSubmitButtonProps = {
  className?: string;
  /** Без строки меню аккаунта — для /me и др. */
  plain?: boolean;
};

export function LogoutSubmitButton({
  className,
  plain = false,
}: LogoutSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        !plain && accountDropdownRowDefault,
        "w-full disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <LogOut className={accountDropdownIconClass} aria-hidden />
      {pending ? "Выход…" : "Выйти"}
    </button>
  );
}
