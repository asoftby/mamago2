# AI Rewrite INVALID_RESULT Fix

## Проблема

API endpoint `/api/ai/rewrite` возвращал ошибку:
```json
{
  "error": "Не удалось переписать текст. Попробуйте позже.",
  "code": "INVALID_RESULT"
}
```

Это означало, что OpenRouter ответил успешно (200 OK), но код не смог извлечь переписанный текст из ответа.

## Причина

1. **Слишком строгий парсинг** — код ожидал только `choices[0].message.content` как строку
2. **Нет поддержки альтернативных форматов** — некоторые модели возвращают массив content parts или используют поле `text`
3. **Недостаточная диагностика** — при ошибке не логировалась структура ответа

## Что исправлено

### 1. Гибкий парсинг content

**До:**
```typescript
const content = isOpenRouterResponse(payload)
  ? payload.choices?.[0]?.message?.content?.trim() ?? ""
  : "";
```

**После:**
```typescript
let content = "";

if (isOpenRouterResponse(payload) && payload.choices && payload.choices.length > 0) {
  const firstChoice = payload.choices[0];
  
  // Try message.content first (standard format)
  if (firstChoice.message?.content) {
    const rawContent = firstChoice.message.content;
    
    // Handle string content
    if (typeof rawContent === "string") {
      content = rawContent.trim();
    }
    // Handle array content (some models return array of content parts)
    else if (Array.isArray(rawContent)) {
      content = (rawContent as Array<unknown>)
        .map((part: unknown) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object" && "text" in part) {
            return String((part as { text: unknown }).text);
          }
          return "";
        })
        .join("")
        .trim();
    }
  }
  // Fallback: try text field (some models use this)
  else if ("text" in firstChoice && typeof (firstChoice as { text?: unknown }).text === "string") {
    content = ((firstChoice as { text: string }).text).trim();
  }
}
```

**Поддерживаемые форматы:**
- ✅ `choices[0].message.content` (string) — стандартный формат
- ✅ `choices[0].message.content` (array) — массив content parts
- ✅ `choices[0].text` (string) — альтернативный формат

### 2. Подробная диагностика при ошибке

**Добавлено логирование:**
```typescript
if (!content) {
  console.error("[AI Rewrite] failed to extract content", {
    provider: "openrouter",
    status: response.status,
    topLevelKeys: payload ? Object.keys(payload) : [],
    hasChoices: !!(payload && "choices" in payload),
    choicesLength: Array.isArray((payload as any)?.choices) ? (payload as any).choices.length : 0,
    firstChoiceKeys: (payload as any)?.choices?.[0] ? Object.keys((payload as any).choices[0]) : [],
    messageKeys: (payload as any)?.choices?.[0]?.message ? Object.keys((payload as any).choices[0].message) : [],
    contentType: typeof (payload as any)?.choices?.[0]?.message?.content,
    contentPreview: typeof (payload as any)?.choices?.[0]?.message?.content === "string"
      ? (payload as any).choices[0].message.content.slice(0, 300)
      : JSON.stringify((payload as any)?.choices?.[0]?.message?.content).slice(0, 300),
    rawBodyPreview: rawResponseText.slice(0, 300),
  });
}
```

**Что логируется:**
- Top-level keys ответа
- Наличие и длина `choices` массива
- Ключи первого choice
- Ключи message объекта
- Тип content (string, array, object)
- Первые 300 символов content
- Первые 300 символов raw response

### 3. Улучшенная функция extractRewriteResult

**До:**
```typescript
function extractRewriteResult(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as { result?: unknown };
    return typeof parsed.result === "string" ? parsed.result.trim() : null;
  } catch {
    return null;
  }
}
```

**После:**
```typescript
function extractRewriteResult(content: string): string | null {
  if (!content || content.trim().length === 0) {
    return null;
  }

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(content) as { result?: unknown };
    if (typeof parsed.result === "string" && parsed.result.trim().length > 0) {
      return parsed.result.trim();
    }
    
    // If result field is missing but we have other fields, log it
    if (parsed && typeof parsed === "object") {
      console.warn("[AI Rewrite] JSON parsed but no 'result' field", {
        keys: Object.keys(parsed),
        preview: JSON.stringify(parsed).slice(0, 200),
      });
    }
    
    return null;
  } catch {
    // If not valid JSON, maybe AI returned plain text
    // This shouldn't happen with response_format: json_object, but handle it gracefully
    console.warn("[AI Rewrite] content is not valid JSON, treating as plain text", {
      contentPreview: content.slice(0, 200),
    });
    
    // Return the content as-is if it looks like rewritten text (not an error message)
    if (content.length > 20 && !content.toLowerCase().includes("error")) {
      return content.trim();
    }
    
    return null;
  }
}
```

**Улучшения:**
- ✅ Проверка на пустой content
- ✅ Логирование если JSON валиден но нет поля `result`
- ✅ Fallback на plain text если AI не вернул JSON
- ✅ Проверка что plain text не является ошибкой

### 4. Дополнительное логирование при парсинге

**Добавлено:**
```typescript
if (!result) {
  console.error("[AI Rewrite] failed to parse result JSON", {
    provider: "openrouter",
    contentLength: content.length,
    contentPreview: content.slice(0, 300),
    contentType: typeof content,
  });
}
```

## Примеры логов

### Success (стандартный формат)
```
[AI Rewrite] request started { provider: 'openrouter', model: 'openai/gpt-4o-mini', ... }
[AI Rewrite] response received { status: 200, bodyLength: 1234 }
[AI Rewrite] success { resultLength: 198 }
```

### Success (array content)
```
[AI Rewrite] request started { ... }
[AI Rewrite] response received { status: 200, bodyLength: 1456 }
[AI Rewrite] success { resultLength: 215 }
```

### Error: content extraction failed
```
[AI Rewrite] request started { ... }
[AI Rewrite] response received { status: 200, bodyLength: 1234 }
[AI Rewrite] failed to extract content {
  provider: 'openrouter',
  status: 200,
  topLevelKeys: ['id', 'object', 'created', 'model', 'choices', 'usage'],
  hasChoices: true,
  choicesLength: 1,
  firstChoiceKeys: ['index', 'message', 'finish_reason'],
  messageKeys: ['role', 'content'],
  contentType: 'string',
  contentPreview: '{"result":"Переписанный текст..."}'
}
```

### Error: JSON parsing failed
```
[AI Rewrite] request started { ... }
[AI Rewrite] response received { status: 200, bodyLength: 1234 }
[AI Rewrite] JSON parsed but no 'result' field {
  keys: ['text', 'metadata'],
  preview: '{"text":"Переписанный текст...","metadata":{...}}'
}
[AI Rewrite] failed to parse result JSON {
  contentLength: 245,
  contentPreview: '{"text":"Переписанный текст..."}'
}
```

### Warning: plain text fallback
```
[AI Rewrite] content is not valid JSON, treating as plain text {
  contentPreview: 'Переписанный текст без JSON обёртки...'
}
[AI Rewrite] success { resultLength: 198 }
```

## Проверка

### 1. TypeScript
```bash
pnpm exec tsc --noEmit
```
✅ Нет ошибок

### 2. Тестирование

**Перезапустите dev server:**
```bash
# Ctrl+C в терминале где запущен pnpm dev
pnpm dev
```

**Попробуйте rewrite:**
1. Откройте Event Wizard
2. Нажмите кнопку "Rewrite"
3. Посмотрите логи в терминале

**Ожидаемый результат:**
- ✅ Успешный rewrite
- ✅ Подробные логи в терминале
- ✅ Если ошибка — понятная диагностика

### 3. Проверка разных сценариев

**Стандартный формат (string content):**
- OpenRouter возвращает `choices[0].message.content` как строку
- ✅ Должно работать

**Array content:**
- Некоторые модели возвращают массив content parts
- ✅ Теперь поддерживается

**Alternative text field:**
- Некоторые модели используют `choices[0].text`
- ✅ Теперь поддерживается

**Plain text (без JSON):**
- AI вернул текст без JSON обёртки
- ✅ Fallback на plain text

## Файлы

- ✅ `src/app/api/ai/rewrite/route.ts` — исправлен парсинг и добавлена диагностика
- ✅ `AI_REWRITE_INVALID_RESULT_FIX.md` — этот документ

## Следующие шаги

1. ✅ Исправлен парсинг content
2. ✅ Добавлена подробная диагностика
3. ✅ Поддержка альтернативных форматов
4. ✅ TypeScript проверен
5. ⏳ Перезапустить dev server
6. ⏳ Протестировать rewrite
7. ⏳ Проверить логи

## Заключение

Теперь при ошибке `INVALID_RESULT`:
- ✅ В server logs будет **подробная диагностика** структуры ответа
- ✅ Поддерживаются **разные форматы** content
- ✅ Есть **fallback** на plain text
- ✅ Логируются **все ключевые поля** для отладки
- ✅ API ключи **не логируются**

Если ошибка повторится, в логах будет видно:
- Какие ключи есть в ответе
- Какой тип у content
- Первые 300 символов content
- Структуру choices и message
