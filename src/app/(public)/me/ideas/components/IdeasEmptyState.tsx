import Link from "next/link";
import { BookmarkPlus, CalendarCheck2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyVariant = "INITIAL" | "UNPLANNED" | "PLANNED";

type IdeasEmptyStateProps = {
  variant: EmptyVariant;
  discoveryHref?: string;
};

const COPY: Record<
  EmptyVariant,
  { title: string; text: string; icon: typeof Sparkles }
> = {
  INITIAL: {
    title: "Пока нет сохранённых идей",
    text: "Сохраняйте события, занятия и маршруты — они появятся здесь, чтобы потом быстро добавить их в план.",
    icon: BookmarkPlus,
  },
  UNPLANNED: {
    title: "Все идеи уже в плане",
    text: "Отлично — вы уже превратили сохранённое в конкретные планы.",
    icon: CalendarCheck2,
  },
  PLANNED: {
    title: "Пока ничего не запланировано",
    text: "Добавьте идею в план, чтобы она появилась в семейном расписании.",
    icon: Sparkles,
  },
};

export function IdeasEmptyState({
  variant,
  discoveryHref = "/minsk",
}: IdeasEmptyStateProps) {
  const copy = COPY[variant];
  const Icon = copy.icon;

  return (
    <div className="rounded-[30px] border border-[rgba(20,18,16,0.07)] bg-white px-6 py-12 text-center shadow-[0_16px_36px_rgba(20,18,16,0.05)] sm:px-10 sm:py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center space-y-5">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#FFF1E8] text-[#EF8759]">
          <Icon className="size-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-[#141210]">
            {copy.title}
          </h2>
          <p className="text-sm leading-6 text-[rgba(20,18,16,0.6)] sm:text-[15px]">
            {copy.text}
          </p>
        </div>

        {variant === "INITIAL" ? (
          <Button
            asChild
            className="mt-2 h-11 rounded-full bg-[#EF8759] px-5 text-white hover:bg-[#E07848]"
          >
            <Link href={discoveryHref}>Найти идеи</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
