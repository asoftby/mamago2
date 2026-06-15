"use client";

import Link from "next/link";
import { PartyPopper } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Button } from "@/components/ui/button";

export type PublishedContentType =
  | "event"
  | "breaking-news"
  | "article"
  | "place"
  | "offer"
  | "route";

type Copy = {
  title: string;
  description: string;
  viewLabel: string;
  listLabel: string;
};

const COPY: Record<PublishedContentType, Copy> = {
  event: {
    title: "Событие опубликовано",
    description: "Теперь событие доступно на сайте.",
    viewLabel: "Посмотреть событие",
    listLabel: "К списку событий",
  },
  "breaking-news": {
    title: "Новость опубликована",
    description: "Теперь новость доступна на сайте.",
    viewLabel: "Просмотреть",
    listLabel: "Вернуться к списку",
  },
  article: {
    title: "Статья опубликована",
    description: "Теперь статья доступна на сайте.",
    viewLabel: "Посмотреть статью",
    listLabel: "К списку статей",
  },
  place: {
    title: "Место опубликовано",
    description: "Теперь место доступно на сайте.",
    viewLabel: "Посмотреть место",
    listLabel: "К списку мест",
  },
  offer: {
    title: "Предложение опубликовано",
    description: "Теперь предложение доступно на сайте.",
    viewLabel: "Посмотреть предложение",
    listLabel: "К списку предложений",
  },
  route: {
    title: "Маршрут опубликован",
    description: "Теперь маршрут доступен на сайте.",
    viewLabel: "Посмотреть маршрут",
    listLabel: "К списку маршрутов",
  },
};

export type PublishedSuccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: PublishedContentType;
  viewHref: string;
  listHref: string;
  title?: string;
  description?: string;
  viewLabel?: string;
  listLabel?: string;
};

export function PublishedSuccessDialog({
  open,
  onOpenChange,
  contentType,
  viewHref,
  listHref,
  title,
  description,
  viewLabel,
  listLabel,
}: PublishedSuccessDialogProps) {
  const copy = COPY[contentType];
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const resolvedViewLabel = viewLabel ?? copy.viewLabel;
  const resolvedListLabel = listLabel ?? copy.listLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 sm:max-w-md" showCloseButton>
        <DialogHeader className="items-center gap-4 text-center sm:items-center sm:text-center">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20"
            aria-hidden
          >
            <PartyPopper className="h-8 w-8 text-primary" strokeWidth={2} />
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-balance text-xl font-semibold">
              {resolvedTitle}
            </DialogTitle>
            <DialogDescription className="text-pretty text-[15px] leading-relaxed">
              {resolvedDescription}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <PrimaryButton className="w-full" asChild>
            <a href={viewHref} target="_blank" rel="noopener noreferrer">
              {resolvedViewLabel}
            </a>
          </PrimaryButton>
          <Button
            variant="outline"
            className="w-full rounded-[16px] py-[14px] h-auto font-semibold"
            asChild
          >
            <Link href={listHref}>{resolvedListLabel}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
