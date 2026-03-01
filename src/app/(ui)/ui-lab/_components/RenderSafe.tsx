"use client";

import React from "react";
import { DemoCard, UsageBadge } from "./DemoCard";
import { usageMap } from "../_data/usage";

// Helper to determine usage status
function getUsageInfo(file: string) {
  // Normalize file path: remove leading "./" or "/" if needed
  // usageMap keys are like "src/components/ui/button.tsx"
  // file prop usually passed as "src/components/ui/button.tsx"
  // but sometimes might vary. Let's assume passed strictly relative to root.
  const info = usageMap[file];
  
  if (!info) {
    return {
      usageCount: 0,
      usageExamples: [],
      usageBadge: "UNUSED" as UsageBadge
    };
  }

  const { count, examples } = info;
  
  // Check if only used in ui-lab
  const isLabOnly = count > 0 && examples.every(ex => ex.startsWith("src/app/(ui)/ui-lab"));
  
  let usageBadge: UsageBadge = "USED";
  if (count === 0) usageBadge = "UNUSED";
  else if (isLabOnly) usageBadge = "UI-LAB-ONLY";
  
  return {
    usageCount: count,
    usageExamples: examples,
    usageBadge
  };
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; title: string; filePath: string; usageProps: any },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; title: string; filePath: string; usageProps: any }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <DemoCard
          title={this.props.title}
          filePath={this.props.filePath}
          status="Error"
          {...this.props.usageProps}
        >
          <div className="text-sm text-destructive p-2 bg-destructive/5 rounded border border-destructive/20">
            <p className="font-semibold mb-1">Render Failed</p>
            <p className="text-xs opacity-90 font-mono break-all">{this.state.error?.message}</p>
          </div>
        </DemoCard>
      );
    }

    return this.props.children;
  }
}

export function RenderSafe({
  title,
  file,
  children,
  listedOnly = false,
}: {
  title: string;
  file: string;
  children?: React.ReactNode;
  listedOnly?: boolean;
}) {
  const usageProps = getUsageInfo(file);

  if (listedOnly || !children) {
    return (
      <DemoCard title={title} filePath={file} status="Listed only" {...usageProps}>
        <div className="text-sm text-muted-foreground italic text-center">
          Requires props / Complex component
        </div>
      </DemoCard>
    );
  }

  return (
    <ErrorBoundary title={title} filePath={file} usageProps={usageProps}>
      <DemoCard title={title} filePath={file} status="Rendered" {...usageProps}>
        {children}
      </DemoCard>
    </ErrorBoundary>
  );
}
