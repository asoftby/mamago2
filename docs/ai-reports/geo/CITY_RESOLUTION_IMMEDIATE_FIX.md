# City Resolution - Immediate Client-Side Fix

## Проблема

После выбора адреса в Step 2, в Debug панели показывается `cityId: null`:

```json
{
  "lat": 53.913342,
  "lng": 27.542247,
  "cityId": null,
  "districtAutoId": null,
  "metroAutoId": null
}
```

## Причина

В новой архитектуре с локальным автосохранением:
- Данные хранятся в `localDraft` (localStorage)
- Геообогащение (cityId, district, metro) запускается только при **сохранении черновика**
- До сохранения все geo-поля = null

Это **нормальное поведение**, но создаёт путаницу для пользователя.

## Решение

Добавлено **немедленное разрешение cityId на клиенте** при выборе адреса:

### 1. Новый API Endpoint

**Файл:** `src/app/api/geo/resolve-city/route.ts`

```typescript
POST /api/geo/resolve-city
Body: { lat, lng, addressJson }
Response: { cityId, cityName, confidence }
```

Легковесный endpoint, который:
- Вызывает `resolveCityId()` из cityResolver
- Не создаёт Place
- Возвращает только cityId и cityName

### 2. Клиентская функция

**Файл:** `src/app/business/(protected)/places/new/NewPlaceWizard.tsx`

```typescript
const resolveCityIdClient = useCallback(async (lat, lng, addressJson) => {
  const response = await fetch("/api/geo/resolve-city", {
    method: "POST",
    body: JSON.stringify({ lat, lng, addressJson }),
  });
  
  if (response.ok) {
    const { cityId, cityName } = await response.json();
    if (cityId) {
      setLocalDraft((prev) => ({ ...prev, cityId }));
    }
  }
}, []);
```

### 3. Автоматический вызов

```typescript
const handleUpdate = useCallback((updates) => {
  setLocalDraft((prev) => ({ ...prev, ...updates }));
  
  // Если обновились координаты и addressJson - разрешаем cityId
  if (updates.lat && updates.lng && updates.addressJson) {
    resolveCityIdClient(updates.lat, updates.lng, updates.addressJson);
  }
}, []);
```

## Поток данных

```
1. Пользователь выбирает адрес в Step 2
   ↓
2. PlaceLocationPicker вызывает onUpdate({ lat, lng, addressJson })
   ↓
3. NewPlaceWizard.handleUpdate обновляет localDraft
   ↓
4. handleUpdate вызывает resolveCityIdClient()
   ↓
5. POST /api/geo/resolve-city
   ↓
6. resolveCityId() разрешает cityId
   ↓
7. Ответ: { cityId, cityName }
   ↓
8. setLocalDraft({ ...prev, cityId })
   ↓
9. Debug панель показывает cityId ✅
```

## Результат

### До исправления
```json
{
  "lat": 53.913342,
  "lng": 27.542247,
  "cityId": null  ❌
}
```

### После исправления
```json
{
  "lat": 53.913342,
  "lng": 27.542247,
  "cityId": "cmmap1t160011wsa4n1f0ymz1"  ✅
}
```

## Важно

### District и Metro остаются null
District и metro **не разрешаются** на клиенте, потому что:
1. Требуют сложных вычислений (point-in-polygon, nearest neighbor)
2. Требуют загрузки больших данных (polygons, station coordinates)
3. Не критичны для UX до сохранения

Они разрешаются при сохранении черновика через полный pipeline:
```
POST /api/business/places
  → updatePlaceLocation()
  → enrichPlaceGeo()
  → districtAutoId, metroAutoId ✅
```

### Полное геообогащение при сохранении

При нажатии "Сохранить черновик":
1. ✅ Place создаётся в БД
2. ✅ cityId разрешается (если ещё не разрешён)
3. ✅ districtAutoId разрешается
4. ✅ metroAutoId разрешается
5. ✅ Все данные сохраняются

## Тестирование

### Тест в UI

1. Откройте http://localhost:3002/business/places/new
2. Заполните Step 1
3. Перейдите на Step 2
4. Введите "Мястровская 5" и выберите адрес
5. Откройте Debug панель (если есть)
6. **Ожидается:** cityId появится через 1-2 секунды

### Проверка в консоли браузера

```
[NewPlaceWizard] Resolving cityId on client... { lat: 53.913342, lng: 27.542247 }
[resolve-city] Resolving city for: { lat: 53.913342, lng: 27.542247 }
[cityResolver] ✅ Matched city by coordinates: Минск
[resolve-city] ✅ Resolved: Минск cmmap1t160011wsa4n1f0ymz1
[NewPlaceWizard] ✅ Resolved cityId: cmmap1t160011wsa4n1f0ymz1 Минск
```

### Проверка в localStorage

```javascript
// В DevTools → Application → Local Storage
const key = `placeWizard:${userId}:${wizardSessionId}`;
const draft = JSON.parse(localStorage.getItem(key));
console.log(draft.cityId); // должен быть ID города
```

## Файлы изменены

1. **src/app/business/(protected)/places/new/NewPlaceWizard.tsx**
   - Добавлена функция `resolveCityIdClient()`
   - Обновлён `handleUpdate()` для автоматического вызова

2. **src/app/api/geo/resolve-city/route.ts** (НОВЫЙ)
   - Легковесный endpoint для разрешения cityId
   - Не создаёт Place, только возвращает cityId

## Преимущества

1. ✅ **Немедленная обратная связь** - пользователь видит город сразу
2. ✅ **Не блокирует UI** - асинхронный вызов
3. ✅ **Переиспользует логику** - использует тот же cityResolver
4. ✅ **Не создаёт Place** - только разрешает cityId
5. ✅ **Работает с alias** - поддерживает все языковые варианты

## Ограничения

1. ⚠️ District и metro не разрешаются (только при сохранении)
2. ⚠️ Требует дополнительный API вызов
3. ⚠️ Может быть задержка 1-2 секунды

## Альтернативы (не реализованы)

### Вариант 1: Разрешать всё на клиенте
```typescript
// Разрешать cityId, district, metro сразу
POST /api/geo/enrich-preview
```
**Минусы:** Сложные вычисления, большие данные

### Вариант 2: Создавать Place сразу
```typescript
// Создавать Place при выборе адреса
POST /api/business/places (status=DRAFT)
```
**Минусы:** Нарушает архитектуру zero-DB-writes

### Вариант 3: Только показывать название города
```typescript
// Парсить из addressJson на клиенте
const cityName = addressJson.find(c => c.types.includes("locality"))?.long_name;
```
**Минусы:** Не даёт cityId для загрузки districts/metro

## Рекомендации

Текущее решение оптимально для MVP:
- Показывает cityId немедленно
- Не перегружает клиент
- Переиспользует серверную логику
- Сохраняет архитектуру zero-DB-writes

В будущем можно оптимизировать:
- Кэшировать результаты на клиенте
- Предзагружать данные городов
- Использовать WebWorkers для вычислений
