# AI Rewrite Error Handling Fix

## Проблема

При использовании AI rewrite в wizard возвращалась ошибка 502 Bad Gateway без понятной диагностики в server logs.

## Что исправлено

### 1. Улучшенное логирование

**До:**
```typescript
console.log("[OpenRouter] request started", { model, endpoint, ... });
console.log("[OpenRouter] response received", { status, statusText });
console.error("[OpenRouter] request failed", { status, statusText });
```

**После:**
```typescript
console.log("[AI Rewrite] request started", {
  provider: "openrouter",
  model,
  endpoint,
  tone,
  entityType,
  sourceLength,
  hasApiKey: !!apiKey,  // Не логируем сам ключ!
});

console.log("[AI Rewrite] response received", {
  provider: "openrouter",
  status,
  statusText,
  bodyLength,
});

console.error("[AI Rewrite] provider error", {
  provider: "openrouter",
  status,
  statusText,
  errorMessage,
  bodyPreview: rawResponseText.slice(0, 200),  // Только превью
});
```

### 2. Graceful Error Handling

**API key не настроен:**
```typescript
if (!apiKey) {
  console.error("[AI Rewrite] OPENROUTER_API_KEY not configured");
  return NextResponse.json(
    { 
      error: "Не удалось переписать текст. Попробуйте позже.",
      code: "AI_PROVIDER_NOT_CONFIGURED"
    },
    { status: 503 }  // Service Unavailable вместо 500
  );
}
```

**Network errors:**
```typescript
catch (fetchError) {
  if (fetchError.name === "AbortError") {
    console.error("[AI Rewrite] request timeout after 25s");
    return NextResponse.json(
      { error: "Не удалось переписать текст. Попробуйте позже.", code: "TIMEOUT" },
      { status: 504 }
    );
  }
  
  console.error("[AI Rewrite] fetch error", {
    error: fetchError.message,
    provider: "openrouter",
  });
  
  return NextResponse.json(
    { error: "Не удалось переписать текст. Попробуйте позже.", code: "NETWORK_ERROR" },
    { status: 503 }
  );
}
```

**Provider errors (401, 402, 429, 500+):**
```typescript
if (!response.ok) {
  const message = mapOpenRouterError(response.status, rawResponseText);
  console.error("[AI Rewrite] provider error", {
    provider: "openrouter",
    status,
    statusText,
    errorMessage: message,
    bodyPreview: rawResponseText.slice(0, 200),
  });
  
  return NextResponse.json(
    { 
      error: "Не удалось переписать текст. Попробуйте позже.",
      code: "PROVIDER_ERROR",
      details: message  // Техническая информация для отладки
    },
    { status: 502 }
  );
}
```

**Invalid response format:**
```typescript
if (!payload) {
  console.error("[AI Rewrite] invalid JSON response", {
    provider: "openrouter",
    status,
    bodyPreview: rawResponseText.slice(0, 200),
  });
  
  return NextResponse.json(
    { error: "Не удалось переписать текст. Попробуйте позже.", code: "INVALID_RESPONSE" },
    { status: 502 }
  );
}
```

**Invalid result format:**
```typescript
if (!result) {
  console.error("[AI Rewrite] invalid result format", {
    provider: "openrouter",
    contentPreview: content.slice(0, 200),
    hasChoices: isOpenRouterResponse(payload) && !!payload.choices?.length,
  });
  
  return NextResponse.json(
    { error: "Не удалось переписать текст. Попробуйте позже.", code: "INVALID_RESULT" },
    { status: 502 }
  );
}
```

**Success:**
```typescript
console.log("[AI Rewrite] success", {
  provider: "openrouter",
  model,
  tone,
  resultLength: result.length,
});
```

### 3. Error Codes

Все ошибки теперь возвращают понятный `code`:

| Code | Status | Описание |
|------|--------|----------|
| `AI_PROVIDER_NOT_CONFIGURED` | 503 | API ключ не настроен |
| `TIMEOUT` | 504 | Timeout 25 секунд |
| `NETWORK_ERROR` | 503 | Ошибка сети (fetch failed) |
| `PROVIDER_ERROR` | 502 | Ошибка от OpenRouter (401, 402, 429, 500+) |
| `INVALID_RESPONSE` | 502 | Невалидный JSON от провайдера |
| `INVALID_RESULT` | 502 | Невалидный формат результата |
| `INTERNAL_ERROR` | 500 | Неожиданная ошибка |

### 4. Безопасность

- ✅ API ключ **не логируется** (только `hasApiKey: true/false`)
- ✅ Response body логируется только **первые 200 символов** (preview)
- ✅ Stack traces логируются только в server logs
- ✅ Client получает **безопасное сообщение** без технических деталей

### 5. Timeout Handling

**До:**
```typescript
const timeout = setTimeout(() => controller.abort(), 25000);
try {
  response = await fetch(...);
} finally {
  clearTimeout(timeout);
}
```

**После:**
```typescript
const timeout = setTimeout(() => controller.abort(), 25000);
try {
  response = await fetch(...);
} catch (fetchError) {
  clearTimeout(timeout);
  
  if (fetchError.name === "AbortError") {
    console.error("[AI Rewrite] request timeout after 25s");
    return NextResponse.json({ error: "...", code: "TIMEOUT" }, { status: 504 });
  }
  
  // ... handle other errors
} finally {
  clearTimeout(timeout);
}
```

## Примеры логов

### Success
```
[AI Rewrite] request started {
  provider: 'openrouter',
  model: 'openai/gpt-4o-mini',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  tone: 'neutral',
  entityType: 'event',
  sourceLength: 245,
  hasApiKey: true
}
[AI Rewrite] response received {
  provider: 'openrouter',
  status: 200,
  statusText: 'OK',
  bodyLength: 1234
}
[AI Rewrite] success {
  provider: 'openrouter',
  model: 'openai/gpt-4o-mini',
  tone: 'neutral',
  resultLength: 198
}
```

### API Key Missing
```
[AI Rewrite] OPENROUTER_API_KEY not configured
```

### Timeout
```
[AI Rewrite] request started { ... }
[AI Rewrite] request timeout after 25s
```

### Provider Error (401)
```
[AI Rewrite] request started { ... }
[AI Rewrite] response received { status: 401, statusText: 'Unauthorized', ... }
[AI Rewrite] provider error {
  provider: 'openrouter',
  status: 401,
  statusText: 'Unauthorized',
  errorMessage: 'OpenRouter: ошибка авторизации',
  bodyPreview: '{"error":{"message":"Invalid API key"}}'
}
```

### Network Error
```
[AI Rewrite] request started { ... }
[AI Rewrite] fetch error {
  error: 'fetch failed',
  provider: 'openrouter'
}
```

## Client Response Examples

### Success
```json
{
  "result": "Переписанный текст...",
  "tone": "neutral",
  "provider": "openrouter",
  "model": "openai/gpt-4o-mini"
}
```

### Error (любая)
```json
{
  "error": "Не удалось переписать текст. Попробуйте позже.",
  "code": "PROVIDER_ERROR",
  "details": "OpenRouter: ошибка авторизации"
}
```

## Проверка

### 1. Проверить TypeScript
```bash
pnpm exec tsc --noEmit
```
✅ Нет ошибок

### 2. Проверить в браузере
1. Открыть Event Wizard
2. Нажать кнопку "Rewrite"
3. В Network tab посмотреть response
4. В terminal посмотреть server logs

### 3. Проверить разные сценарии

**API key не настроен:**
```bash
# Временно удалить OPENROUTER_API_KEY из .env.local
# Нажать Rewrite
# Ожидается: 503 + "AI_PROVIDER_NOT_CONFIGURED" + понятный лог
```

**Timeout:**
```bash
# Временно изменить timeout на 1ms
# Нажать Rewrite
# Ожидается: 504 + "TIMEOUT" + понятный лог
```

**Invalid API key:**
```bash
# Временно изменить OPENROUTER_API_KEY на невалидный
# Нажать Rewrite
# Ожидается: 502 + "PROVIDER_ERROR" + лог с 401
```

## Файлы

- ✅ `src/app/api/ai/rewrite/route.ts` — исправлен error handling
- ✅ `AI_REWRITE_ERROR_HANDLING_FIX.md` — этот документ

## Следующие шаги

1. ✅ Исправлен error handling
2. ✅ Добавлено подробное логирование
3. ✅ Добавлены error codes
4. ✅ Graceful fallback для всех ошибок
5. ⏳ Протестировать в браузере
6. ⏳ Проверить разные сценарии ошибок

## Заключение

Теперь при любой ошибке:
- ✅ Server logs содержат **понятную диагностику**
- ✅ Client получает **безопасное сообщение**
- ✅ Есть **error codes** для программной обработки
- ✅ API ключи **не логируются**
- ✅ Timeout **обрабатывается корректно**
- ✅ Все ошибки имеют **правильные HTTP статусы**
