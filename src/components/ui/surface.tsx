import * as React from "react";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

const surfaceVariants = cva("ui-surface", {
  variants: {
    variant: {
      default: "bg-background/60",
      soft: "bg-muted",
      elevated: "bg-card shadow-sm",
    },
    size: {
      sm: "rounded-[var(--radius-md)]",
      md: "rounded-[var(--radius-card)]",
      lg: "rounded-[var(--radius-2xl)]",
    },
    interactive: {
      true: "interactive",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
    interactive: false,
  },
});

type SurfaceProps = React.ComponentProps<"div"> & {
  variant?: "default" | "soft" | "elevated";
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
};

export function Surface({
  className,
  variant = "default",
  size = "md",
  interactive = false,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(surfaceVariants({ variant, size, interactive }), className)}
      {...props}
    />
  );
}
