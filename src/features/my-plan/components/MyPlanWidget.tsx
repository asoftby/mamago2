"use client";

import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMyPlan } from '../hooks/useMyPlan';

interface MyPlanWidgetProps {
  onOpen: () => void;
}

export function MyPlanWidget({ onOpen }: MyPlanWidgetProps) {
  const { todayCount } = useMyPlan();
  const showBadge = todayCount > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 hidden lg:flex animate-in fade-in slide-in-from-bottom-4">
      <Button
        onClick={onOpen}
        className={cn(
          "relative flex h-11 min-w-56 flex-1 items-center rounded-full py-0 pl-3 pr-2.5",
          "border transition-all duration-200 ease-out will-change-transform",
          "active:scale-[0.985] active:transition-transform",
          "border-neutral-600/35 bg-gradient-to-b from-neutral-800/[0.96] to-neutral-900/[0.98]",
          "hover:border-neutral-500/50 hover:from-neutral-700/[0.98] hover:to-neutral-800/[0.99]"
        )}
        variant="ghost"
      >
        <div className="flex w-full min-w-0 items-center gap-2">
          <CalendarDays
            className="h-[18px] w-[18px] shrink-0 stroke-[1.75] text-neutral-200"
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0 text-left">
            <span className="text-sm font-semibold leading-none tracking-tight text-neutral-50">
              Мой план
            </span>
            <span className="mt-0.5 text-left text-[10px] leading-tight text-neutral-400">
              Нет событий
            </span>
          </div>
          {showBadge && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs shrink-0">
              {todayCount}
            </Badge>
          )}
        </div>
      </Button>
    </div>
  );
}