# HEIC Diagnostic Steps

## Шаг 1: Проверьте поддержку сервера

Откройте в браузере:
```
http://localhost:3000/api/test-heic
```

Должно показать:
```json
{
  "sharpVersion": "0.33.5",
  "libheifVersion": "1.18.2",
  "heifSupported": true,
  "supportedFormats": ["jpeg", "png", "webp", "heif", ...]
}
```

Если `heifSupported: false` - проблема на сервере.

## Шаг 2: Перезапустите сервер

```bash
# Остановите (Ctrl+C)
# Очистите кэш
rm -rf .next
# Перезапустите
npm run dev
```

## Шаг 3: Очистите кэш браузера

- Mac: `Cmd + Shift + R`
- Windows: `Ctrl + Shift + F5`

## Шаг 4: Попробуйте загрузить HEIC

1. Откройте `/admin/media`
2. Загрузите HEIC файл
3. Откройте консоль браузера (F12)
4. Скопируйте все логи, начинающиеся с 🔍, 📸, 🔄, 📡, ✅ или ❌

## Шаг 5: Проверьте логи сервера

В терминале где запущен `npm run dev` найдите логи:
- 📥 [UPLOAD] Incoming file
- 🔄 [UPLOAD] Starting image processing
- ✅ или ❌

## Что показать мне:

1. Результат `/api/test-heic`
2. Логи из консоли браузера
3. Логи из консоли сервера
4. Точное сообщение об ошибке
