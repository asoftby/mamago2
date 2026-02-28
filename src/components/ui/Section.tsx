import { cn } from "@/lib/utils";
import React from "react";

interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function Section({ 
  title, 
  subtitle, 
  action, 
  children, 
  className, 
  ...props 
}: SectionProps) {
  return (
    <section className={cn("py-6 md:py-8 space-y-4 md:space-y-6", className)} {...props}>
      {(title || subtitle || action) && (
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            {title && (
              <h2 className="text-[20px] font-semibold leading-tight tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-[14px] text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 pb-1">{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}
