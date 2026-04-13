"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationSettingsTable } from "./NotificationSettingsTable";
import { cn } from "@/lib/utils";

type Props = {
  triggerClassName?: string;
  settingsHref?: string;
};

export function NotificationsBellPopover({
  triggerClassName,
  settingsHref = "/me/settings/notifications",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div data-notifications-bell-popover>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("relative", triggerClassName)}
            aria-label="Настройки уведомлений"
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <Bell className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[min(100vw-1.5rem,720px)] max-w-[720px] rounded-[28px] border-stone-200/90 p-0 shadow-[0_20px_60px_rgba(15,23,42,0.14)]"
        >
          <div className="border-b border-stone-100 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-stone-950">
                  Настройки уведомлений
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Быстро настройте каналы для самых важных business-уведомлений.
                </p>
              </div>
              <Link
                href={settingsHref}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950"
              >
                <Settings2 className="h-4 w-4" />
                Полная страница
              </Link>
            </div>
          </div>

          <div className="max-h-[min(70vh,760px)] overflow-y-auto px-4 py-4">
            <NotificationSettingsTable compact />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
