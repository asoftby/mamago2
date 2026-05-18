import Link from "next/link";
import { MapPin, Plus, Route } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyVariant = "INITIAL" | "DRAFT" | "PUBLISHED";

type RoutesEmptyStateProps = {
  variant: EmptyVariant;
};

const COPY: Record<EmptyVariant, { title: string; text: string; icon: typeof MapPin }> = {
  INITIAL: {
    title: "Пока нет маршрутов",
    text: "Создайте свой первый маршрут с интересными местами для прогулок с детьми — он появится здесь.",
    icon: Route,
  },
  DRAFT: {
    title: "Нет черновиков",
    text: "Все ваши маршруты уже опубликованы.",
    icon: MapPin,
  },
  PUBLISHED: {
    title: "Нет опубликованных маршрутов",
    text: "Опубликуйте маршрут, чтобы другие родители могли его увидеть.",
    icon: MapPin,
  },
};

export function RoutesEmptyState({ variant }: RoutesEmptyStateProps) {
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
            <Link href="/routes/new">
              <Plus className="w-4 h-4 mr-2" />
              Создать маршрут
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
