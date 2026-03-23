"use client";

import { ReactNode } from "react";
import { BirthdayQuizProgress } from "./BirthdayQuizProgress";
import { BirthdayCandidateBlock } from "./BirthdayCandidateBlock";
import type { BirthdayCandidateGroup } from "../../types/birthday";
import { ChevronLeft } from "lucide-react";

interface BirthdayQuizStepLayoutProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  candidateGroups: BirthdayCandidateGroup[];
  totalCandidates: number;
  onBack?: () => void;
}

export function BirthdayQuizStepLayout({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  candidateGroups,
  totalCandidates,
  onBack,
}: BirthdayQuizStepLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {onBack && step > 1 && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center h-8 w-8 rounded-full border border-border hover:bg-muted/50 transition-colors shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <BirthdayQuizProgress currentStep={step} totalSteps={totalSteps} />
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Options */}
      {children}

      {/* Live candidates */}
      {candidateGroups.length > 0 && (
        <BirthdayCandidateBlock groups={candidateGroups} totalCount={totalCandidates} />
      )}
    </div>
  );
}
