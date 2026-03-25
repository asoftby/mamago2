/**
 * Зарезервировано под необратимые действия (архивирование, удаление и т.д.).
 * Безопасные действия — в BusinessVisibilityControl.
 */
export function BusinessDangerZonePlaceholder() {
  return (
    <section
      className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-5"
      aria-labelledby="business-danger-zone-placeholder-title"
    >
      <h3
        id="business-danger-zone-placeholder-title"
        className="text-xs font-semibold uppercase tracking-wide text-gray-500"
      >
        Danger Zone
      </h3>
      <p className="mt-2 text-sm text-gray-500">
        Здесь появятся необратимые действия: архивирование, удаление данных и
        т.п. Сейчас ничего не настроено.
      </p>
    </section>
  );
}
