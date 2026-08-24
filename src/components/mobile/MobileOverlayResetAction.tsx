import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type MobileOverlayResetActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
};

/** Reset action shared by mobile discovery overlay action bars. */
export function MobileOverlayResetAction({
  children = "Сбросить",
  className,
  type = "button",
  ...props
}: MobileOverlayResetActionProps) {
  return (
    <button
      type={type}
      className={cn(
        "shrink-0 rounded-xl px-3 py-3.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
