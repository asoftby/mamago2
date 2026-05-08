import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "warning" | "error" | "success";

type Action =
  | {
      type: "link";
      label: string;
      href: string;
    }
  | {
      type: "form";
      label: string;
      action: string;
    };

const TONE_STYLES: Record<
  Tone,
  {
    badgeClassName: string;
    iconClassName: string;
    eyebrowClassName: string;
  }
> = {
  neutral: {
    badgeClassName: "bg-[#EF8759]/12",
    iconClassName: "text-[#EF8759]",
    eyebrowClassName: "text-[#A86143]",
  },
  warning: {
    badgeClassName: "bg-[#F59E0B]/12",
    iconClassName: "text-[#D97706]",
    eyebrowClassName: "text-[#B45309]",
  },
  error: {
    badgeClassName: "bg-[#F97316]/10",
    iconClassName: "text-[#EA580C]",
    eyebrowClassName: "text-[#C2410C]",
  },
  success: {
    badgeClassName: "bg-emerald-100",
    iconClassName: "text-emerald-600",
    eyebrowClassName: "text-emerald-700",
  },
};

export function BusinessInviteStatusCard({
  tone,
  icon: Icon,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  helper,
}: {
  tone: Tone;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: ReactNode;
  primaryAction: Action;
  secondaryAction?: Action;
  helper?: ReactNode;
}) {
  const toneStyles = TONE_STYLES[tone];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(239,135,89,0.11),_transparent_34%),linear-gradient(180deg,_#FFF8F4_0%,_#FAF7F3_52%,_#FFFDFB_100%)] px-4 py-10 text-stone-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-[560px] rounded-[28px] border border-[rgba(239,135,89,0.18)] bg-[rgba(255,255,255,0.96)] px-6 py-7 shadow-[0_24px_80px_rgba(20,20,20,0.08),0_12px_40px_rgba(239,135,89,0.08)] sm:px-10 sm:py-11">
          <div className="flex flex-col gap-6">
            <div className="flex size-[56px] items-center justify-center rounded-[18px] border border-white/70 shadow-sm backdrop-blur-sm sm:size-[60px]">
              <div className={cn("flex size-full items-center justify-center rounded-[18px]", toneStyles.badgeClassName)}>
                <Icon className={cn("size-6 sm:size-7", toneStyles.iconClassName)} />
              </div>
            </div>

            <div className="space-y-3">
              <p className={cn("text-sm font-semibold tracking-[0.08em] uppercase", toneStyles.eyebrowClassName)}>
                {eyebrow}
              </p>
              <h1 className="max-w-[18ch] text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[#1F1F1F] sm:text-[32px]">
                {title}
              </h1>
              <div className="max-w-[44ch] text-[15px] leading-7 text-[#5F5A55] sm:text-base">
                {description}
              </div>
            </div>

            <div className="space-y-4">
              {primaryAction.type === "link" ? (
                <Button
                  asChild
                  size="lg"
                  className="h-12 w-full rounded-full bg-[#EF8759] px-6 text-base font-semibold text-white shadow-[0_14px_34px_rgba(239,135,89,0.28)] hover:bg-[#E7794A] sm:h-[52px]"
                >
                  <Link href={primaryAction.href}>
                    {primaryAction.label}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <form action={primaryAction.action} method="POST">
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full rounded-full bg-[#EF8759] px-6 text-base font-semibold text-white shadow-[0_14px_34px_rgba(239,135,89,0.28)] hover:bg-[#E7794A] sm:h-[52px]"
                  >
                    {primaryAction.label}
                    <ArrowRight className="size-4" />
                  </Button>
                </form>
              )}

              {secondaryAction ? (
                secondaryAction.type === "link" ? (
                  <Button asChild variant="outline" size="lg" className="h-12 w-full rounded-full border-stone-200 bg-white px-6 text-base font-medium text-stone-800 hover:bg-stone-50 sm:h-[52px]">
                    <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
                  </Button>
                ) : (
                  <form action={secondaryAction.action} method="POST">
                    <Button type="submit" variant="outline" size="lg" className="h-12 w-full rounded-full border-stone-200 bg-white px-6 text-base font-medium text-stone-800 hover:bg-stone-50 sm:h-[52px]">
                      {secondaryAction.label}
                    </Button>
                  </form>
                )
              ) : null}
            </div>

            {helper ? (
              <div className="border-t border-stone-200/80 pt-4 text-sm leading-6 text-[#7A736D]">
                {helper}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
