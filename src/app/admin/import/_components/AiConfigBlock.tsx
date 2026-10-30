import type { AiConfigItem, AiConfigSeverity, AiConfigStatus } from "@/lib/ai/aiConfigStatus";

const ICON: Record<AiConfigSeverity, string> = { ok: "✅", warning: "⚠️", info: "ℹ️" };

const ROW_CLASS: Record<AiConfigSeverity, string> = {
  ok: "border-emerald-200 bg-emerald-50/50",
  warning: "border-amber-300 bg-amber-50",
  info: "border-gray-200 bg-gray-50",
};

function stateLabel(item: AiConfigItem): string {
  if (item.isSet) return "задано";
  return item.severity === "info" ? "не задано (необязательно)" : "не задано";
}

/**
 * Конфигурация AI для администратора импорта. Показывает только «задано / не
 * задано» и имена моделей; значения ключей сюда не попадают (их нет и в `status`).
 */
export function AiConfigBlock({ status }: { status: AiConfigStatus }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5" data-testid="ai-config-block" aria-labelledby="ai-config-title">
      <h3 id="ai-config-title" className="text-base font-semibold text-gray-950">Конфигурация AI</h3>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">
        Показывается только, что задано на сервере. Значения ключей не отображаются.
      </p>

      {status.channelNormalizationBlocked && (
        <div role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>Посты каналов откладываются, Capture не распознаёт скриншоты.</strong> Не задан ключ или быстрая модель
          (<code>OPENROUTER_CAPTURE_MODEL</code>). Сохранённые посты обработаются при следующем запуске импорта после настройки.
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {status.items.map((item) => (
          <li key={item.key} className={`rounded-xl border p-3 ${ROW_CLASS[item.severity]}`} data-severity={item.severity}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span aria-hidden="true">{ICON[item.severity]}</span>
              <code className="text-sm font-medium text-gray-900">
                {item.key === "OPENROUTER_SITE_APP" ? "OPENROUTER_SITE_URL / OPENROUTER_APP_NAME" : item.key}
              </code>
              <span className="text-sm font-medium text-gray-700">{stateLabel(item)}</span>
              {item.modelName && (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 ring-1 ring-gray-200">{item.modelName}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-700">{item.note}</p>
            <p className="mt-1 text-xs text-gray-500">Зависят: {item.dependents.join(", ")}.</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
