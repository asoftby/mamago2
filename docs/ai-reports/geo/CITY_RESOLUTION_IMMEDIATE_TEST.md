# Тест: Немедленное разрешение cityId

## ✅ Статус: ИСПРАВЛЕНО

## Проблема
После выбора адреса в Debug панели показывалось `cityId: null`

## Решение
Добавлено немедленное разрешение cityId на клиенте через новый API endpoint

## Быстрый тест (1 минута)

### В UI
1. Откройте http://localhost:3002/business/places/new
2. Заполните Step 1 (название, категория, описание)
3. Перейдите на Step 2
4. Введите "Мястровская 5" в поиск адреса
5. Выберите "вуліца Мястроўская 5, Мінск, Беларусь"
6. Откройте Debug панель (если есть)

### Ожидаемый результат
```json
{
  "lat": 53.913342,
  "lng": 27.542247,
  "cityId": "cmmap1t160011wsa4n1f0ymz1",  ✅ НЕ null!
  "districtAutoId": null,  // ОК - разрешится при сохранении
  "metroAutoId": null      // ОК - разрешится при сохранении
}
```

### Консоль браузера
Должны появиться логи:
```
[NewPlaceWizard] Resolving cityId on client...
[NewPlaceWizard] ✅ Resolved cityId: cmmap1t160011wsa4n1f0ymz1 Минск
```

## Тест API

```bash
npx tsx scripts/manual-tests/test-resolve-city-api.ts
```

**Ожидаемый результат:**
```
✅ PASSED: Correctly resolved Минск
✅ PASSED: Correctly resolved Минск
✅ PASSED: Correctly returned null
✅ ALL TESTS PASSED
```

## Что изменилось

### 1. Новый API endpoint
**Файл:** `src/app/api/geo/resolve-city/route.ts`
```
POST /api/geo/resolve-city
Body: { lat, lng, addressJson }
Response: { cityId, cityName, confidence }
```

### 2. Клиентская функция
**Файл:** `src/app/business/(protected)/places/new/NewPlaceWizard.tsx`
- Добавлена `resolveCityIdClient()`
- Автоматически вызывается при выборе адреса
- Обновляет `localDraft.cityId`

## Важно понимать

### cityId разрешается сразу ✅
После выбора адреса cityId появляется через 1-2 секунды

### District и Metro разрешаются при сохранении ⏳
- `districtAutoId` - требует point-in-polygon вычисления
- `metroAutoId` - требует nearest neighbor поиска
- Оба разрешаются при нажатии "Сохранить черновик"

### Полное геообогащение
```
Выбор адреса → cityId ✅ (немедленно)
       ↓
Сохранить черновик → districtAutoId ✅ + metroAutoId ✅
```

## Поток данных

```
1. Пользователь выбирает адрес
   ↓
2. PlaceLocationPicker → onUpdate({ lat, lng, addressJson })
   ↓
3. NewPlaceWizard.handleUpdate()
   ↓
4. resolveCityIdClient() вызывается автоматически
   ↓
5. POST /api/geo/resolve-city
   ↓
6. cityResolver.resolveCityId()
   ↓
7. Ответ: { cityId: "...", cityName: "Минск" }
   ↓
8. setLocalDraft({ ...prev, cityId })
   ↓
9. Debug панель обновляется ✅
```

## Файлы изменены

1. **src/app/business/(protected)/places/new/NewPlaceWizard.tsx**
   - Добавлена функция `resolveCityIdClient()`
   - Обновлён `handleUpdate()` для автоматического вызова

2. **src/app/api/geo/resolve-city/route.ts** (НОВЫЙ)
   - Легковесный endpoint для разрешения cityId

3. **scripts/manual-tests/test-resolve-city-api.ts** (НОВЫЙ)
   - Тестовый скрипт для проверки API

## Проверка в localStorage

```javascript
// В DevTools → Application → Local Storage
const userId = "..."; // ваш userId
const wizardSessionId = "..."; // из localStorage: placeWizardSessionId:{userId}
const key = `placeWizard:${userId}:${wizardSessionId}`;
const draft = JSON.parse(localStorage.getItem(key));

console.log("cityId:", draft.cityId); // должен быть ID города
console.log("lat:", draft.lat);
console.log("lng:", draft.lng);
```

## Если cityId всё ещё null

### 1. Проверьте консоль браузера
Должны быть логи:
```
[NewPlaceWizard] Resolving cityId on client...
[NewPlaceWizard] ✅ Resolved cityId: ...
```

Если нет - проверьте:
- Передаётся ли `addressJson` в `handleUpdate`
- Вызывается ли `resolveCityIdClient`

### 2. Проверьте Network tab
Должен быть запрос:
```
POST /api/geo/resolve-city
Status: 200 OK
Response: { cityId: "...", cityName: "Минск" }
```

Если 500 - проверьте логи сервера

### 3. Проверьте логи сервера
Должны быть логи:
```
[resolve-city] Resolving city for: { lat: 53.9, lng: 27.5 }
[cityResolver] ✅ Matched city by coordinates: Минск
[resolve-city] ✅ Resolved: Минск cmmap1t160011wsa4n1f0ymz1
```

### 4. Запустите тест API
```bash
npx tsx scripts/manual-tests/test-resolve-city-api.ts
```

Если тест проходит - проблема на клиенте
Если тест не проходит - проблема в cityResolver

## Документация

- **CITY_RESOLUTION_IMMEDIATE_FIX.md** - Полное техническое описание
- **CITY_RESOLUTION_IMMEDIATE_TEST.md** - Этот файл (инструкция по тестированию)
- **CITY_RESOLUTION_LANGUAGE_VARIANT_FIX.md** - Исправление языковых вариантов

## Следующие шаги

После подтверждения, что cityId разрешается:
1. Протестируйте сохранение черновика
2. Проверьте, что district и metro разрешаются при сохранении
3. Проверьте, что данные сохраняются в БД корректно

## Преимущества решения

✅ Немедленная обратная связь для пользователя
✅ Не создаёт Place в БД
✅ Переиспользует существующую логику cityResolver
✅ Поддерживает все языковые варианты (Мінск/Минск/Minsk)
✅ Работает как с Google адресами, так и с ручными координатами
