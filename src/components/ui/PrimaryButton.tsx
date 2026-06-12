import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";
import React from "react";

export function PrimaryButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        "rounded-[16px] bg-primary text-primary-foreground hover:bg-primary-hover px-4 py-[14px] h-auto font-semibold text-[16px] interactive",
        className
      )}
      {...props}
    />
  );
}
