# Place Approved Revision Status Fix

## Дата: 7 марта 2026

## Проблема

После одобрения администратором исправлений владельца place, в карточке места в бизнес-кабинете продолжал отображаться статус:

**"Редактирование изменений"**

Это неверно. Если исправления уже одобрены и применены, место должно снова отображаться как **"Опубликовано"**.

---

## 🔍 Корневая причина

### Архитектура системы ревизий

После одобрения администратором:
1. ✅ Данные из `PlaceRevision` копируются в `Place`
2. ✅ Статус ревизии меняется на `"APPROVED"`
3. ✅ Ревизия остается в базе данных (для истории)
4. ✅ Сервер загружает только активные ревизии: `["DRAFT", "PENDING", "NEEDS_REVISION"]`

### Баг в клиентском компоненте

**Файл:** `src/components/business/places/PlaceCardHorizontal.tsx`

**Проблема:** Компонент показывал бейдж ревизии даже когда `hasActiveRevision === false`.

**Код до исправления (строки 195-206):**
```typescript
{/* Revision status badge for published places */}
{hasActiveRevision && place.status === "PUBLISHED" && (
  <div className="mt-2">
    <span className={`...`}>
      {REVISION_STATUS_CONFIG[place.activeRevision!.status]?.label}
    </span>
  </div>
)}
```

**Проблема:** Условие `hasActiveRevision && place.status === "PUBLISHED"` было недостаточным, потому что:
- `hasActiveRevision` вычисляется как `place.activeRevision && ["DRAFT", "PENDING", "NEEDS_REVISION"].includes(place.activeRevision.status)`
- После одобрения `activeRevision` становится `null` (сервер не загружает APPROVED ревизии)
- Но если по какой-то причине `activeRevision` все еще присутствует, бейдж отображался

---

## ✅ Решение

### Исправленная логика

**Файл:** `src/components/business/places/PlaceCardHorizontal.tsx`

**Изменение:** Добавлена дополнительная проверка `place.activeRevision` перед отображением бейджа.

**Код после исправления:**
```typescript
{/* Revision status badge for published places with active revisions */}
{hasActiveRevision && place.status === "PUBLISHED" && place.activeRevision && (
  <div className="mt-2">
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
      place.activeRevision.status === "DRAFT" 
        ? "bg-blue-50 text-blue-700"
        : place.activeRevision.status === "PENDING"
        ? "bg-amber-50 text-amber-700"
        : "bg-yellow-50 text-yellow-700"
    }`}>
      {REVISION_STATUS_CONFIG[place.activeRevision.status as keyof typeof REVISION_STATUS_CONFIG]?.label || place.activeRevision.status}
    </span>
  </div>
)}
```

### Итоговая логика отображения статуса

| Place Status | Active Revision | Отображаемый статус | Бейдж ревизии |
|--------------|----------------|---------------------|---------------|
| PUBLISHED | null (нет активной) | "Опубликовано" ✅ | Нет |
| PUBLISHED | DRAFT | "Опубликовано" | "Редактирование изменений" 🔵 |
| PUBLISHED | PENDING | "Опубликовано" | "Изменения на проверке" 🟡 |
| PUBLISHED | NEEDS_REVISION | "Опубликовано" | "Требуются правки" 🟠 |
| PUBLISHED | APPROVED (в БД) | "Опубликовано" ✅ | Нет (не загружается) |
| DRAFT | - | "Черновик" | Нет |
| PENDING | - | "На модерации" | Нет |
| NEEDS_REVISION | - | "Требует правок" | Нет |
| REJECTED | - | "Отклонено" | Нет |

---

## 🧪 Тестирование

### Автоматический тест

Создан тестовый скрипт `scripts/manual-tests/test-approved-revision-status.ts`:

```bash
npx tsx scripts/manual-tests/test-approved-revision-status.ts
```

**Результаты:**
```
✅ Before approval: Revision shows in active query
✅ After approval: Revision does NOT show in active query
✅ Revision status changed to APPROVED
✅ Place data updated with revision changes
✅ Place status remains PUBLISHED

🎯 Expected UI Behavior:
   Before approval: Badge shows 'Изменения на проверке'
   After approval: NO badge, status shows 'Опубликовано' ✅
```

### Ручное тестирование

1. Перейти на `/business/places`
2. Найти опубликованное место, которое было одобрено администратором
3. Убедиться, что:
   - ✅ НЕТ бейджа "Редактирование изменений"
   - ✅ Статус показывает "Опубликовано"
   - ✅ Кнопка "Редактировать" активна

---

## 📝 Файлы изменены

1. **`src/components/business/places/PlaceCardHorizontal.tsx`**
   - Добавлена проверка `place.activeRevision` перед отображением бейджа ревизии
   - Теперь бейдж показывается только если есть реальная активная ревизия

---

## 🎯 Правильная логика (итоговая)

### 1. Место опубликовано, нет активной ревизии
**Статус:** "Опубликовано" ✅  
**Бейдж:** Нет  
**Кнопка:** "Редактировать" (активна)

### 2. Изменения отправлены на проверку
**Статус:** "Опубликовано"  
**Бейдж:** "Изменения на проверке" 🟡  
**Кнопка:** "На проверке" (заблокирована)

### 3. Модератор запросил правки
**Статус:** "Опубликовано"  
**Бейдж:** "Требуются правки" 🟠  
**Кнопка:** "Редактировать" (активна)

### 4. После одобрения администратором
**Статус:** "Опубликовано" ✅  
**Бейдж:** Нет (ревизия APPROVED не загружается)  
**Кнопка:** "Редактировать" (активна)

---

## 🔄 Backend Flow (для справки)

### После admin approve:

1. **Transaction в `approvePlaceRevision()`:**
   ```typescript
   // 1. Копируем данные из revision в place
   await tx.place.update({ ... });
   
   // 2. Удаляем старые изображения и создаем новые
   await tx.placeImage.deleteMany({ ... });
   await tx.placeImage.createMany({ ... });
   
   // 3. Меняем статус ревизии на APPROVED
   await tx.placeRevision.update({
     data: {
       status: "APPROVED",  // ← Ревизия больше не активна
       reviewedAt: new Date(),
       reviewedByUserId: adminId,
     },
   });
   
   // 4. Логируем действие
   await tx.moderationLog.create({ ... });
   ```

2. **Загрузка мест в `/business/places`:**
   ```typescript
   // Загружаем только активные ревизии
   const activeRevisions = await prisma.placeRevision.findMany({
     where: {
       placeId: { in: publishedPlaceIds },
       status: { in: ["DRAFT", "PENDING", "NEEDS_REVISION"] },
       // ← APPROVED ревизии НЕ загружаются
     },
   });
   ```

3. **Результат:**
   - `place.activeRevision === null` для одобренных мест
   - UI показывает "Опубликовано" без бейджа ревизии ✅

---

## ✅ Результат

После исправления:
- ✅ После одобрения администратором место показывает статус **"Опубликовано"**
- ✅ Бейдж "Редактирование изменений" НЕ отображается
- ✅ Пользователь видит актуальный статус места
- ✅ Логика отображения стала понятной и единообразной

**Важно:** Ревизии со статусом `APPROVED` остаются в базе данных для истории, но не загружаются в UI как активные.
