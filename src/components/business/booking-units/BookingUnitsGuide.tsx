import { ChevronDown, CircleHelp } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";

/**
 * In-context help for the resource manager. Keep this copy aligned with the
 * business-only BookingUnit create/edit and manual-block flows.
 *
 * Deliberately read-only: the guide must not change schedule or booking state.
 */
export function BookingUnitsGuide() {
  return (
    <BusinessSurfaceCard className="px-5 py-4 md:px-6 md:py-5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <CircleHelp className="size-5 shrink-0 text-stone-600" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-stone-950 md:text-base">
                Как пользоваться ресурсами и расписанием
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-stone-600 md:text-sm">
                Что такое ресурс, как его добавить и управлять занятостью
              </span>
            </span>
          </span>
          <ChevronDown
            className="size-5 shrink-0 text-stone-500 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="mt-5 space-y-6 border-t border-stone-200 pt-5 text-sm leading-6 text-stone-700">
          <section className="space-y-2">
            <h2 className="font-semibold text-stone-950">Что такое ресурс?</h2>
            <p>
              Ресурс — это то, что нужно для проведения услуги: зал, игровая
              комната, кабинет или конкретный исполнитель. Например, один зал
              может использоваться для разных праздников, но не может быть
              забронирован на два праздника одновременно.
            </p>
            <p>
              <strong className="font-semibold text-stone-900">Режим работы места</strong> показывает,
              когда открыто заведение. <strong className="font-semibold text-stone-900">Расписание ресурса</strong> —
              когда доступен конкретный зал или исполнитель. Эти часы могут отличаться.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-stone-950">Как добавить ресурс</h2>
            <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-stone-600">
              <li>Нажмите «Добавить ресурс» и укажите понятное название, например «Игровой зал №1».</li>
              <li>
                При необходимости задайте вместимость, минимальную длительность,
                шаг записи и время на подготовку до начала и уборку после окончания.
              </li>
              <li>Настройте рабочие дни и интервалы времени для этого ресурса.</li>
              <li>
                Если предложение уже создано, привяжите его к ресурсу.
                Можно сохранить ресурс и без предложений, а связать их позднее.
              </li>
              <li>Нажмите «Создать ресурс». Он появится в списке «Мои ресурсы».</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-stone-950">Как управлять ресурсом</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="font-semibold text-stone-900">Изменить:</strong> откройте ресурс,
                чтобы обновить его настройки, рабочие часы и связанные предложения.
              </li>
              <li>
                <strong className="font-semibold text-stone-900">Закрытые даты:</strong> после
                создания ресурса через «Изменить» добавьте выходной или исключение
                на конкретную дату.
              </li>
              <li>
                <strong className="font-semibold text-stone-900">Закрыть время:</strong> в блоке
                «Занятость и ручные блокировки» укажите будущий интервал,
                например для ремонта или частного мероприятия.
              </li>
              <li>
                <strong className="font-semibold text-stone-900">Проверить занятость:</strong> там
                же отображаются действующие резервы, подтверждённые бронирования
                и ручные блокировки. Свои ручные блокировки можно удалить.
              </li>
            </ul>
          </section>

          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">
            <p className="font-semibold text-stone-950">Важно знать</p>
            <p className="mt-1">
              Ресурс без связанного предложения можно настраивать, но клиенты
              пока не смогут записаться на него. Сейчас в этом разделе доступны
              для привязки предложения детских праздников. Подтверждённую запись
              нельзя удалить простой блокировкой времени; заявки и их статусы
              обрабатываются в разделе «Записи и заказы». Если у ресурса есть
              будущая бронь или действующий резерв, изменение его настроек
              может быть недоступно для защиты записи.
            </p>
          </div>
        </div>
      </details>
    </BusinessSurfaceCard>
  );
}
