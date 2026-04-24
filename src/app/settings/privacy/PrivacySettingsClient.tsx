"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { DeleteAccountModal } from "@/components/account/DeleteAccountModal";
import { Switch } from "@/components/ui/switch";

type PrivacyPrefs = {
  personalization: boolean;
  analytics: boolean;
};

const PRIVACY_PREFS_STORAGE_KEY = "mamago.settings.privacy.prefs.v1";

function PrivacyCard(props: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={[
        "rounded-2xl border bg-white p-5 shadow-sm",
        props.danger ? "border-red-200" : "border-neutral-100",
      ].join(" ")}
    >
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold text-neutral-900">{props.title}</h3>
        {props.description ? (
          <p className="text-sm text-neutral-500">{props.description}</p>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

function ToggleRow(props: {
  label: string;
  description?: string;
  helperText?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-neutral-100 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-800">{props.label}</p>
          {props.description ? (
            <p className="mt-0.5 text-xs text-neutral-500">{props.description}</p>
          ) : null}
        </div>
        <Switch checked={props.checked} onCheckedChange={props.onCheckedChange} />
      </div>
      {props.helperText ? (
        <p className="text-xs text-neutral-500">{props.helperText}</p>
      ) : null}
    </div>
  );
}

export function PrivacySettingsClient() {
  const [prefs, setPrefs] = useState<PrivacyPrefs>(() => {
    if (typeof window === "undefined") {
      return {
        personalization: true,
        analytics: true,
      };
    }

    try {
      const rawPrefs = window.localStorage.getItem(PRIVACY_PREFS_STORAGE_KEY);
      if (!rawPrefs) {
        return {
          personalization: true,
          analytics: true,
        };
      }
      return JSON.parse(rawPrefs) as PrivacyPrefs;
    } catch {
      return {
        personalization: true,
        analytics: true,
      };
    }
  });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(PRIVACY_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const handleRequestData = () => {
    window.open("/api/me/export", "_blank", "noopener,noreferrer");
    toast.success("Файл с данными откроется в новой вкладке");
  };

  return (
    <div className="space-y-4">
      <PrivacyCard title="Ваши данные">
        <div className="space-y-3 rounded-xl border border-neutral-100 p-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">Скачать данные</p>
            <p className="mt-1 text-sm text-neutral-500">
              Получите копию вашей активности и профиля
            </p>
          </div>
          <Button type="button" size="sm" onClick={handleRequestData}>
            Запросить
          </Button>
        </div>
      </PrivacyCard>

      <PrivacyCard title="Использование данных">
        <div className="space-y-3">
          <ToggleRow
            label="Персонализация"
            description="Рекомендации с учетом ваших интересов"
            helperText={
              prefs.personalization
                ? undefined
                : "Вы будете видеть общие рекомендации без учёта ваших интересов"
            }
            checked={prefs.personalization}
            onCheckedChange={(checked) =>
              setPrefs((prev) => ({ ...prev, personalization: checked }))
            }
          />
          <ToggleRow
            label="Аналитика"
            description="Помогает улучшать качество рекомендаций и сервиса"
            checked={prefs.analytics}
            onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, analytics: checked }))}
          />
        </div>
      </PrivacyCard>

      <PrivacyCard
        title="Удаление аккаунта"
        description="Это действие нельзя отменить"
        danger
      >
        <Button
          type="button"
          variant="destructive"
          onClick={() => setIsDeleteOpen(true)}
        >
          Удалить аккаунт
        </Button>
      </PrivacyCard>

      <DeleteAccountModal open={isDeleteOpen} onOpenChange={setIsDeleteOpen} />
    </div>
  );
}
