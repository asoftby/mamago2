"use client";

import { useMemo } from "react";
import {
  CalendarDays,
  ExternalLink,
  Globe2,
  Info,
  ListChecks,
  Phone,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StableCardSelector, StableCardSelectorSmall } from "@/components/ui/stable-card-selector";
import { deriveCtaStepState } from "./model";
import { CtaCalendarEditor } from "./CtaCalendarEditor";
import { CtaStepPreview } from "./CtaStepPreview";
import type {
  CtaStepFormValue,
  CtaStepSourceContext,
} from "./types";

type CtaStepProps = {
  value: CtaStepFormValue;
  source: CtaStepSourceContext;
  disabled?: boolean;
  onChange: (value: CtaStepFormValue) => void;
};

function patchValue(
  currentValue: CtaStepFormValue,
  onChange: (value: CtaStepFormValue) => void,
  patch: Partial<CtaStepFormValue>,
) {
  onChange({ ...currentValue, ...patch });
}

export function CtaStep({
  value,
  source,
  disabled,
  onChange,
}: CtaStepProps) {
  const derived = useMemo(
    () => deriveCtaStepState(source, value),
    [source, value],
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="cta-main-action-title">
        <div className="space-y-1">
          <h2
            id="cta-main-action-title"
            className="text-xl font-semibold text-foreground"
          >
            Что сможет сделать пользователь?
          </h2>
          <p className="text-sm text-muted-foreground">
            Сначала выберите главное действие. Следующие настройки откроются автоматически.
          </p>
        </div>

        <StableCardSelector
          value={value.actionChoice}
          onValueChange={(nextAction) =>
            patchValue(value, onChange, {
              actionChoice: nextAction,
              requestMode: nextAction === "REQUEST" ? value.requestMode : null,
            })
          }
          isEditable={!disabled}
          options={[
            {
              value: "DISCOVER",
              label: "Ознакомиться",
              description: "Пользователь увидит описание и сможет принять решение без отдельной записи.",
              icon: Info,
            },
            {
              value: "REQUEST",
              label: "Отправить заявку",
              description: "Пользователь оставит заявку, а вы продолжите общение дальше.",
              icon: ListChecks,
              isRecommended: true,
            },
            {
              value: "EXTERNAL",
              label: "Перейти во внешний сервис",
              description: "Пользователь будет перенаправлен на внешний сайт или билетный сервис.",
              icon: ExternalLink,
            },
          ]}
        >
          {(selectedAction) => {
            if (selectedAction === "REQUEST") {
              return (
                <section className="space-y-4" aria-labelledby="cta-request-mode-title">
                  <div className="space-y-1">
                    <h3
                      id="cta-request-mode-title"
                      className="text-base font-semibold text-foreground"
                    >
                      Как проходит запись?
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Покажите только один сценарий: простую заявку или единый календарь.
                    </p>
                  </div>

                  <StableCardSelectorSmall
                    value={value.requestMode}
                    onValueChange={(requestMode) =>
                      patchValue(value, onChange, { requestMode })
                    }
                    isEditable={!disabled}
                    options={[
                      {
                        value: "SIMPLE",
                        label: "Просто заявка",
                        description: "Пользователь отправляет короткую заявку, а детали вы уточняете позже.",
                        icon: ListChecks,
                      },
                      {
                        value: "CALENDAR",
                        label: "Через календарь",
                        description: "Пользователь выбирает дату или дату со временем внутри одного календаря.",
                        icon: CalendarDays,
                      },
                    ]}
                  />

                  {value.requestMode === "CALENDAR" ? (
                    <CtaCalendarEditor
                      days={value.calendarDays}
                      mode={value.calendarMode ?? "DATE_ONLY"}
                      disabled={disabled}
                      onModeChange={(calendarMode) =>
                        patchValue(value, onChange, { calendarMode })
                      }
                      onChange={(calendarDays) =>
                        patchValue(value, onChange, { calendarDays })
                      }
                    />
                  ) : null}
                </section>
              );
            }

            if (selectedAction === "EXTERNAL") {
              return (
                <section className="space-y-4" aria-labelledby="cta-external-settings-title">
                  <div className="space-y-1">
                    <h3
                      id="cta-external-settings-title"
                      className="text-base font-semibold text-foreground"
                    >
                      Как это работает?
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Укажите, куда попадёт пользователь после нажатия.
                    </p>
                  </div>

                  <StableCardSelectorSmall
                    value={value.externalKind}
                    onValueChange={(externalKind) =>
                      patchValue(value, onChange, { externalKind })
                    }
                    isEditable={!disabled}
                    options={[
                      {
                        value: "SITE",
                        label: "Открыть сайт",
                        description: "Подходит для сайта, лендинга или внешней формы.",
                        icon: Globe2,
                      },
                      {
                        value: "TICKETS",
                        label: "Покупка билетов",
                        description: "Подходит для продажи билетов или внешнего бронирования.",
                        icon: ExternalLink,
                      },
                    ]}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="cta-step-external-url">Ссылка</Label>
                    <Input
                      id="cta-step-external-url"
                      type="url"
                      inputMode="url"
                      value={value.externalUrl}
                      disabled={disabled}
                      placeholder="https://example.com"
                      aria-describedby="cta-step-external-url-hint"
                      onChange={(event) =>
                        patchValue(value, onChange, { externalUrl: event.target.value })
                      }
                    />
                    <p
                      id="cta-step-external-url-hint"
                      className="text-xs text-muted-foreground"
                    >
                      Пользователь будет сразу перенаправлен по этой ссылке.
                    </p>
                  </div>
                </section>
              );
            }

            return null;
          }}
        </StableCardSelector>
      </section>

      <section className="space-y-4" aria-labelledby="cta-fallback-title">
        <div className="space-y-1">
          <h2 id="cta-fallback-title" className="text-xl font-semibold text-foreground">
            Другой способ связи
          </h2>
          <p className="text-sm text-muted-foreground">
            Эти контакты появятся как fallback, если вы хотите показать запасной способ связи.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cta-step-fallback-phone">Телефон</Label>
            <div className="relative">
              <Phone
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="cta-step-fallback-phone"
                type="tel"
                inputMode="tel"
                className="pl-10"
                value={value.fallback.phone}
                disabled={disabled}
                placeholder="+375 29 123 45 67"
                onChange={(event) =>
                  patchValue(value, onChange, {
                    fallback: {
                      ...value.fallback,
                      phone: event.target.value,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cta-step-fallback-website">Сайт</Label>
            <div className="relative">
              <Globe2
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="cta-step-fallback-website"
                type="url"
                inputMode="url"
                className="pl-10"
                value={value.fallback.website}
                disabled={disabled}
                placeholder="https://example.com"
                onChange={(event) =>
                  patchValue(value, onChange, {
                    fallback: {
                      ...value.fallback,
                      website: event.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </section>

      <CtaStepPreview
        canonicalCta={derived.canonicalCta}
        summary={derived.userFacingSummary}
        issues={derived.issues}
      />
    </div>
  );
}
