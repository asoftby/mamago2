import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { HistoryBackButton } from "@/components/navigation/HistoryBackButton";
import { cn } from "@/lib/utils";

export function SettingsPageLayout(props: {
  title: string;
  children: ReactNode;
  maxWidthClassName?: string;
  fallbackHref?: string;
}) {
  return (
    <div className="w-full py-2 sm:py-4">
      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6 lg:px-8",
          props.maxWidthClassName ?? "max-w-2xl",
        )}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <HistoryBackButton
              fallbackHref={props.fallbackHref ?? "/me/settings"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition-colors hover:text-neutral-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </HistoryBackButton>
            <h1 className="text-xl font-semibold text-neutral-900">
              {props.title}
            </h1>
          </div>

          {props.children}
        </div>
      </div>
    </div>
  );
}
