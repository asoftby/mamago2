"use client";

import { AlertCircle, ExternalLink, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CanonicalCtaObject } from "@/lib/cta-platform";

type CtaStepPreviewProps = {
  canonicalCta: CanonicalCtaObject;
  summary: string;
  issues: string[];
};

function fallbackLabel(channel: string): string {
  switch (channel) {
    case "PHONE":
      return "Позвонить";
    case "URL":
      return "Сайт";
    default:
      return "Связаться";
  }
}

export function CtaStepPreview({
  canonicalCta,
  summary,
  issues,
}: CtaStepPreviewProps) {
  return (
    <div className="space-y-4">
      <Card className="gap-0 rounded-3xl border-border bg-[#faf7f1] py-0 shadow-none">
        <CardHeader className="px-5 py-4">
          <CardTitle className="text-base">Так увидит пользователь</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-5 py-5">
          <div
            aria-hidden="true"
            className="inline-flex min-h-14 min-w-[220px] items-center justify-center rounded-full bg-[#e86a3a] px-6 text-sm font-semibold text-white shadow-[0_14px_32px_-12px_rgba(232,106,58,0.55)]"
          >
            {canonicalCta.primaryLabel}
          </div>

          {canonicalCta.contactFallback?.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Другой способ связи
              </p>
              <div className="space-y-2">
                {canonicalCta.contactFallback.map((item) => (
                  <div
                    key={`${item.channel}-${item.href}`}
                    className="flex min-h-11 items-center gap-3 rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm text-foreground"
                  >
                    {item.channel === "PHONE" ? (
                      <Phone className="h-4 w-4 shrink-0 text-[#e86a3a]" aria-hidden />
                    ) : (
                      <ExternalLink className="h-4 w-4 shrink-0 text-[#e86a3a]" aria-hidden />
                    )}
                    <span className="font-medium">{item.label || fallbackLabel(item.channel)}</span>
                    <span className="text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {issues.length > 0 ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="space-y-1">
                {issues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="gap-0 rounded-3xl border-border py-0 shadow-none">
        <CardHeader className="px-5 py-4">
          <CardTitle className="text-base">Что сможет сделать пользователь</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-5">
          <p className="max-w-2xl text-sm leading-6 text-foreground">{summary}</p>
        </CardContent>
      </Card>
    </div>
  );
}
