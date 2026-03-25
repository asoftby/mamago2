"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, MapPin, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const OPTIONS = [
  {
    href: "/editor/place/new",
    label: "Место",
    description: "Площадка для родителей на карте",
    Icon: MapPin,
  },
  {
    href: "/editor/event/new",
    label: "Событие",
    description: "Афиша и расписание",
    Icon: Calendar,
  },
  {
    href: "/editor/offer/new",
    label: "Предложение",
    description: "Акции и спецпредложения",
    Icon: Tag,
  },
] as const;

/**
 * Кнопка «+» и модалка выбора типа публикации (те же маршруты, что и в кабинете бизнеса).
 */
export function CreatePublicationQuickMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(HEADER_CHROME_ICON_BUTTON_CLASS)}
        onClick={() => setOpen(true)}
        aria-label="Создать публикацию"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Что создаём?</DialogTitle>
            <DialogDescription>
              Выберите тип публикации — откроется форма создания.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 pt-2">
            {OPTIONS.map(({ href, label, description, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:bg-gray-50 hover:border-gray-300"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-900">
                    {label}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
