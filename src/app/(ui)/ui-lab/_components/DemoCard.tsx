import React from "react";
import { cn } from "@/lib/utils";

export type DemoStatus = "Rendered" | "Listed only" | "Error";
export type UsageBadge = "USED" | "UNUSED" | "UI-LAB-ONLY";

export function DemoCard({
  title,
  filePath,
  status = "Rendered",
  children,
  className,
  usageCount,
  usageExamples,
  usageBadge,
}: {
  title: string;
  filePath: string;
  status?: DemoStatus;
  children?: React.ReactNode;
  className?: string;
  usageCount?: number;
  usageExamples?: string[];
  usageBadge?: UsageBadge;
}) {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col", className)}>
      <div className="p-4 border-b bg-muted/30 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              status === "Rendered" && "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
              status === "Listed only" && "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
              status === "Error" && "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20"
            )}
          >
            {status}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-[10px] gap-2">
           <code className="text-muted-foreground font-mono truncate flex-1" title={filePath}>
             {filePath}
           </code>
           
           {usageBadge && (
             <span className={cn(
               "shrink-0 font-bold px-1.5 py-0.5 rounded-[4px]",
               usageBadge === "USED" && "bg-green-100 text-green-700",
               usageBadge === "UNUSED" && "bg-red-100 text-red-700",
               usageBadge === "UI-LAB-ONLY" && "bg-amber-100 text-amber-700",
             )}>
               {usageBadge} ({usageCount ?? 0})
             </span>
           )}
        </div>
        
        {/* Usage examples tooltip/list */}
        {usageExamples && usageExamples.length > 0 && (
          <div className="text-[9px] text-muted-foreground bg-background/50 p-1.5 rounded border border-border/50">
             <div className="font-semibold mb-0.5">Used in:</div>
             <ul className="list-disc list-inside opacity-80">
               {usageExamples.map((ex, i) => (
                 <li key={i} className="truncate" title={ex}>{ex}</li>
               ))}
               {(usageCount ?? 0) > usageExamples.length && (
                 <li>...and {(usageCount ?? 0) - usageExamples.length} more</li>
               )}
             </ul>
          </div>
        )}
      </div>
      
      <div className="p-4 flex-1 flex flex-col justify-center min-h-[100px]">
        {children}
      </div>
    </div>
  );
}
