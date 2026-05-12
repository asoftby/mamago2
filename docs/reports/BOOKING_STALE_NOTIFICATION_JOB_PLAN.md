# Booking Stale Notification Job Plan

**Дата:** 12 мая 2026  
**Статус:** 📋 Plan (не требуется немедленная реализация)  
**Текущее решение:** Lazy check при открытии `/business/bookings`

## Текущая реализация

### Как работает сейчас

**Trigger:** Lazy check  
**Когда:** При открытии страницы `/business/bookings`  
**Код:** `src/app/api/business/bookings/check-stale/route.ts`

```typescript
// GET /api/business/bookings/check-stale
export async function GET() {
  const user = await getCurrentUser();
  const business = await getCurrentBusiness(user);
  
  const result = await checkAndNotifyStaleBookings(
    business.id,
    user.id
  );
  
  return NextResponse.json(result);
}
```

**Преимущества:**
- ✅ Простая реализация
- ✅ Не требует cron infrastructure
- ✅ Fire-and-forget (не блокирует UI)
- ✅ Deduplication (максимум 1 reminder/24ч)

**Недостатки:**
- ⚠️ Зависит от того, что бизнес откроет страницу
- ⚠️ Если бизнес не заходит, уведомления не отправляются

## Когда нужен Cron Job

### Сценарии для cron

1. **Proactive notifications**
   - Бизнес не заходит в кабинет несколько дней
   - Stale bookings накапливаются
   - Нужны proactive reminders

2. **High-volume businesses**
   - Много заявок в день
   - Критично не пропустить ни одну
   - Нужна гарантия доставки

3. **SLA requirements**
   - Договорённость с бизнесом о времени ответа
   - Нужны автоматические escalations

## Предлагаемая архитектура (если понадобится)

### Option 1: Vercel Cron (рекомендуется)

**Файл:** `src/app/api/cron/booking-stale/route.ts`

```typescript
export const runtime = "nodejs";
export const maxDuration = 60; // 1 minute

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get all active businesses
  const businesses = await prisma.business.findMany({
    where: { 
      status: "ACTIVE",
      ownerUserId: { not: null },
    },
    select: {
      id: true,
      ownerUserId: true,
    },
  });

  let processed = 0;
  let notified = 0;

  for (const business of businesses) {
    try {
      const result = await checkAndNotifyStaleBookings(
        business.id,
        business.ownerUserId!
      );
      processed++;
      notified += result.notified;
    } catch (error) {
      console.error(
        `[cron:booking-stale] Failed for business ${business.id}:`,
        error
      );
    }
  }

  return Response.json({ 
    ok: true, 
    processed, 
    notified,
    timestamp: new Date().toISOString(),
  });
}
```

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/booking-stale",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Расписание:** Каждые 6 часов (0:00, 6:00, 12:00, 18:00)

**Преимущества:**
- ✅ Встроенная Vercel функциональность
- ✅ Не требует внешних сервисов
- ✅ Простая настройка

**Недостатки:**
- ⚠️ Только на Vercel Pro plan
- ⚠️ Ограничение maxDuration (60 сек на Hobby, 300 сек на Pro)

### Option 2: External Cron Service

**Сервисы:**
- [cron-job.org](https://cron-job.org) — бесплатный
- [EasyCron](https://www.easycron.com) — платный
- [Uptime Robot](https://uptimerobot.com) — мониторинг + cron

**Endpoint:** `GET /api/cron/booking-stale`  
**Auth:** Bearer token в header  
**Расписание:** Каждые 6 часов

**Преимущества:**
- ✅ Работает на любом хостинге
- ✅ Гибкое расписание
- ✅ Мониторинг выполнения

**Недостатки:**
- ⚠️ Внешняя зависимость
- ⚠️ Нужна настройка auth

### Option 3: Background Worker (Inngest, Trigger.dev)

**Сервисы:**
- [Inngest](https://www.inngest.com) — event-driven workflows
- [Trigger.dev](https://trigger.dev) — background jobs

**Преимущества:**
- ✅ Мощная функциональность
- ✅ Retry logic
- ✅ Monitoring dashboard
- ✅ Event-driven architecture

**Недостатки:**
- ⚠️ Дополнительная сложность
- ⚠️ Платные планы для production

## Рекомендации

### Текущий этап (MVP)

**Решение:** Оставить lazy check  
**Причина:**
- Достаточно для MVP
- Простая реализация
- Не требует дополнительной инфраструктуры
- Deduplication работает

**Мониторинг:**
- Отслеживать, как часто бизнесы заходят в кабинет
- Собирать метрики stale bookings
- Анализировать conversion rate

### Следующий этап (если нужно)

**Когда переходить на cron:**
1. Бизнесы жалуются на пропущенные заявки
2. Метрики показывают низкий engagement
3. Появляются SLA требования

**Рекомендуемое решение:**
- **Vercel Cron** (если на Pro plan)
- **External Cron Service** (если на Hobby plan)

**Расписание:**
- Каждые 6 часов (достаточно для большинства случаев)
- Можно увеличить до каждых 3 часов для high-volume

### Оптимизация

**Batch processing:**
```typescript
// Обрабатывать по 10 бизнесов параллельно
const BATCH_SIZE = 10;

for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
  const batch = businesses.slice(i, i + BATCH_SIZE);
  await Promise.allSettled(
    batch.map(b => checkAndNotifyStaleBookings(b.id, b.ownerUserId!))
  );
}
```

**Selective processing:**
```typescript
// Обрабатывать только бизнесы с активными заявками
const businesses = await prisma.business.findMany({
  where: {
    status: "ACTIVE",
    ownerUserId: { not: null },
    bookingRequests: {
      some: {
        status: { in: ["NEW", "CONFIRMED"] },
      },
    },
  },
});
```

## Метрики для мониторинга

### Key Metrics

1. **Stale booking rate**
   - % заявок, которые становятся stale
   - Target: < 10%

2. **Response time**
   - Среднее время ответа на NEW заявки
   - Target: < 12 часов

3. **Notification effectiveness**
   - % stale bookings, обработанных после notification
   - Target: > 70%

4. **Business engagement**
   - Как часто бизнесы заходят в кабинет
   - Median: 1-2 раза в день

### Dashboard queries

```sql
-- Stale booking rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'NEW' AND created_at < NOW() - INTERVAL '24 hours') * 100.0 / COUNT(*) as stale_rate
FROM booking_requests
WHERE created_at > NOW() - INTERVAL '7 days';

-- Average response time
SELECT 
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_hours
FROM booking_requests
WHERE status != 'NEW' AND created_at > NOW() - INTERVAL '7 days';
```

## Заключение

**Текущее решение (lazy check) достаточно для MVP.**

Переход на cron job рекомендуется только если:
- Метрики показывают проблемы
- Бизнесы запрашивают proactive notifications
- Появляются SLA требования

**Приоритет:** Низкий  
**Статус:** Отложено до появления реальной необходимости

---

**Дата:** 12 мая 2026  
**Следующий review:** После 1 месяца работы MVP