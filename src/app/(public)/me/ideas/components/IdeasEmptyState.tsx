import Link from "next/link";
import { BookmarkPlus, CalendarCheck2, Sparkles } from "lucide-react";
import { C } from "../theme";

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
  const [firstWord, ...restWords] = copy.title.split(" ");

  return (
    <div
      className="rounded-[24px] border border-dashed px-6 py-14 text-center sm:px-10 sm:py-16"
      style={{ borderColor: C.line2, background: C.paper }}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center space-y-5">
        <div
          className="flex size-16 items-center justify-center rounded-full"
          style={{ background: C.accentSoft, color: C.accentDeep }}
        >
          <Icon className="size-7" />
        </div>
        <div className="space-y-2">
          <h2
            className="text-[30px] leading-none tracking-[-0.02em] sm:text-[34px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
          >
            <span style={{ color: C.ink }}>{firstWord}</span>{" "}
            <span style={{ fontStyle: "italic", color: C.accentDeep }}>
              {restWords.join(" ")}
            </span>
          </h2>
          <p className="text-[15px] leading-6" style={{ color: C.ink3 }}>
            {copy.text}
          </p>
        </div>

        {variant === "INITIAL" ? (
          <Link
            href={discoveryHref}
            className="mt-2 inline-flex h-[46px] items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white transition-colors"
            style={{ background: C.accent }}
          >
            Куда пойти →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
