import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared mobile modal footer primary action. Mobile header search sheet is the design reference. */
export function MobileOverlayPrimaryAction({
  children = "Показать",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) {
  return (
    <button
      type={type}
      className={cn(
        "min-w-[10rem] shrink-0 rounded-xl bg-[#EF8759] px-5 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
