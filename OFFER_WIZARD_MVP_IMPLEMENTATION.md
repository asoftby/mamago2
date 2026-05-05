# OFFER WIZARD MVP - IMPLEMENTATION GUIDE

**Дата:** 5 мая 2026  
**Статус:** В процессе реализации  
**Цель:** Упрощенный wizard для создания офферов за 2-3 минуты

---

## ✅ ЧТО УЖЕ СОЗДАНО

### 1. Типы и валидация

**Файлы:**
- `src/components/business/wizard/offer/types.mvp.ts`
- `src/components/business/wizard/offer/validation.mvp.ts`

**Что включено:**
- ✅ `OfferFormDataMVP` — упрощенная структура данных (только необходимые поля)
- ✅ `SIGNAL_OPTIONS` — опции для всех групп сигналов
- ✅ `AUTO_SUGGESTIONS` — автоподсказки по типу оффера
- ✅ `validateForDraftMVP()` — валидация для черновика
- ✅ `validateForSubmitMVP()` — строгая валидация для публикации
- ✅ `validateStepMVP()` — валидация отдельного шага
- ✅ `isStepCompleteMVP()` — проверка завершенности шага

---

### 2. UI Компоненты

**Файлы:**
- `src/components/business/wizard/offer/components/OfferKindSelector.tsx`
- `src/components/business/wizard/offer/components/SignalChipSelector.tsx`
- `src/components/business/wizard/offer/components/AgeRangePicker.tsx`

**Что включено:**
- ✅ `OfferKindSelector` — выбор типа оффера (3 карточки)
- ✅ `SignalChipSelector` — выбор сигналов (chips с иконками)
- ✅ `AgeRangePicker` — выбор возрастного диапазона

---

## 🚧 ЧТО НУЖНО ДОДЕЛАТЬ

### Этап 1: Создать шаги wizard (3-4 дня)

#### Step 1: Offer Type
**Файл:** `src/components/business/wizard/offer/steps/Step1TypeMVP.tsx`

```typescript
import { OfferKindSelector } from "../components/OfferKindSelector";
import { applyAutoSuggestions } from "../types.mvp";

export function Step1TypeMVP({ data, onChange, isEditable }) {
  const handleKindChange = (kind) => {
    // Apply auto-suggestions when kind changes
    const suggestions = applyAutoSuggestions(kind);
    onChange({
      offerKind: kind,
      ...suggestions,
    });
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <OfferKindSelector
        value={data.offerKind}
        onChange={handleKindChange}
        disabled={!isEditable}
      />
    </div>
  );
}
```

---

#### Step 2: Basic Information
**Файл:** `src/components/business/wizard/offer/steps/Step2InformationMVP.tsx`

**Поля:**
- title (input)
- description (rich text editor, без ограничения)
- placeId (dropdown с местами бизнеса)

**Важно:**
- Показать hint: "Категория предложения наследуется от места"
- Показать выбранную категорию Place после выбора

---

#### Step 3: Audience and Signals
**Файл:** `src/components/business/wizard/offer/steps/Step3SignalsMVP.tsx`

**Поля:**
- AgeRangePicker (ageMinMonths, ageMaxMonths)
- SignalChipSelector для activity (обязательно, min 1, max 3)
- SignalChipSelector для format (обязательно, min 1, max 2)
- SignalChipSelector для participation (обязательно, exactly 1)
- SignalChipSelector для intention (опционально, collapsed, max 2)
- SignalChipSelector для features (опционально, collapsed, max 3)

**Важно:**
- Auto-suggestions уже применены в Step 1
- Показать hint: "Эти сигналы помогут пользователям найти ваше предложение"

---

#### Step 4: Price and CTA
**Файл:** `src/components/business/wizard/offer/steps/Step4PriceAndCTAMVP.tsx`

**Поля:**
- priceFrom (number input)
- priceText (text input, collapsed, optional)
- ctaType (radio buttons или dropdown, auto-suggested)
- ctaPhone (input, pre-filled из Place/Business)
- ctaLink (input, pre-filled из Place/Business)

**Важно:**
- Pre-fill phone/website из Place или Business
- Показать hint: "Телефон из профиля места" (если pre-filled)
- Показать/скрыть ctaPhone/ctaLink в зависимости от ctaType

---

#### Step 5: Media and Publication
**Файл:** `src/components/business/wizard/offer/steps/Step5MediaMVP.tsx`

**Поля:**
- coverImage (image upload, обязательно)
- gallery (multi-image upload, min 1, обязательно)

**Важно:**
- ❗ **ПРАВИЛО УНИКАЛЬНОСТИ ФОТО:**
  - Можно выбрать фото из Place
  - Но одно фото нельзя использовать в нескольких Offer одного Place
  - UI: показать фото Place, если уже используется → disabled
  - Текст: "Это фото уже используется в другом предложении"
  - Backend validation: проверять уникальность

**Preview:**
- Показать карточку оффера как она будет выглядеть
- Изображение + название + описание (первые 120 символов) + цена + возраст + CTA

---

### Этап 2: Обновить конфигурацию шагов (1 день)

**Файл:** `src/components/business/wizard/offer/offerWizardSteps.config.mvp.tsx`

```typescript
export const OFFER_WIZARD_STEPS_MVP: WizardStepConfig<OfferFormDataMVP>[] = [
  {
    id: 1,
    key: "type",
    shortLabel: "Тип",
    title: "Тип предложения",
    description: "Что вы предлагаете?",
    component: Step1TypeMVP,
    isComplete: (data) => Boolean(data.offerKind),
    getSummary: (data) => [
      {
        label: "Тип",
        value: data.offerKind ? getOfferKindLabel(data.offerKind) : "Не выбран",
        isMissing: !data.offerKind,
      },
    ],
    getMissingFields: (data) => data.offerKind ? [] : ["Тип предложения"],
  },
  // ... остальные шаги
];
```

---

### Этап 3: API Mappers (1 день)

**Файл:** `src/components/business/wizard/offer/mappers.mvp.ts`

```typescript
export function buildOfferCreatePayloadMVP(
  formData: OfferFormDataMVP,
  placeId: string,
  options?: { status?: "DRAFT" | "PENDING" | "PUBLISHED" }
) {
  // Combine all signals
  const discoverySignalIds = [
    ...formData.activitySignals,
    ...formData.formatSignals,
    ...formData.participationSignals,
    ...formData.intentionSignals,
    ...formData.featureSignals,
  ];
  
  return {
    source: "PLACE",
    selectedPlace: { id: placeId },
    kind: mapOfferKindToDbKind(formData.offerKind),
    title: formData.title,
    shortDescription: formData.description, // API uses shortDescription
    ageMinMonths: formData.ageMinMonths,
    ageMaxMonths: formData.ageMaxMonths,
    coverImage: formData.coverImage,
    pricingMode: "SINGLE",
    singlePrice: formData.priceFrom,
    singlePriceLabel: formData.priceText || null,
    ctaType: mapCTATypeToApi(formData.ctaType),
    phone: formData.ctaPhone,
    website: formData.ctaLink,
    discoverySignalIds,
    status: options?.status || "DRAFT",
  };
}

function mapOfferKindToDbKind(kind: string): string {
  const mapping = {
    course: "CLASS",
    birthday: "PARTY",
    service: "VISIT",
  };
  return mapping[kind] || "VISIT";
}

function mapCTATypeToApi(ctaType: string): string {
  const mapping = {
    записаться: "BOOK",
    забронировать: "RESERVE",
    купить_билет: "BUY_TICKET",
    отправить_заявку: "SEND_REQUEST",
    перейти_на_сайт: "VISIT_WEBSITE",
  };
  return mapping[ctaType] || "SEND_REQUEST";
}
```

---

### Этап 4: Backend Validation для уникальности фото (1 день)

**Файл:** `src/app/api/business/offers/route.ts`

Добавить проверку:

```typescript
// Check image uniqueness within place
if (data.coverImage) {
  const existingOfferWithImage = await prisma.offer.findFirst({
    where: {
      placeId: place.id,
      coverImage: data.coverImage,
      id: { not: offerId }, // exclude current offer in edit mode
    },
  });
  
  if (existingOfferWithImage) {
    return NextResponse.json(
      { error: "Это изображение уже используется в другом предложении" },
      { status: 400 }
    );
  }
}

// Check gallery images uniqueness
for (const image of data.gallery || []) {
  const existingOfferWithImage = await prisma.offer.findFirst({
    where: {
      placeId: place.id,
      OR: [
        { coverImage: image },
        // TODO: check gallery field when added to model
      ],
      id: { not: offerId },
    },
  });
  
  if (existingOfferWithImage) {
    return NextResponse.json(
      { error: `Изображение ${image} уже используется в другом предложении` },
      { status: 400 }
    );
  }
}
```

---

### Этап 5: Главный компонент Wizard (1 день)

**Файл:** `src/components/business/wizard/offer/OfferWizardMVP.tsx`

Скопировать структуру из `OfferWizard.tsx`, но:
- Использовать `OfferFormDataMVP`
- Использовать `OFFER_WIZARD_STEPS_MVP`
- Использовать `validateForSubmitMVP`
- Использовать `buildOfferCreatePayloadMVP`

---

## 📋 ЧЕКЛИСТ РЕАЛИЗАЦИИ

### Компоненты
- [x] OfferKindSelector
- [x] SignalChipSelector
- [x] AgeRangePicker
- [x] Step1TypeMVP
- [x] Step2InformationMVP
- [x] Step3SignalsMVP
- [x] Step4PriceAndCTAMVP
- [x] Step5MediaMVP

### Конфигурация
- [x] types.mvp.ts
- [x] validation.mvp.ts
- [x] offerWizardSteps.config.mvp.tsx
- [x] mappers.mvp.ts
- [ ] OfferWizardMVP.tsx (main wizard component)

### Backend
- [x] Image uniqueness validation (POST /api/business/offers)
- [x] Check images endpoint (GET /api/business/offers/check-images)
- [ ] Update PATCH endpoint for edit mode
- [ ] Test with real data

### Integration
- [ ] Create OfferWizardMVP.tsx main component
- [ ] Update /business/offers/new page to use MVP wizard
- [ ] Update /business/offers/[id]/edit page to use MVP wizard
- [ ] Add feature flag or routing logic

### Тестирование
- [ ] Manual testing (create flow)
- [ ] Manual testing (edit flow)
- [ ] Test image uniqueness validation
- [ ] Test auto-suggestions
- [ ] Test pre-filled contacts

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

**После реализации:**
- ✅ 5 шагов вместо 8
- ✅ 10-12 обязательных полей вместо 15-20
- ✅ Время создания: 2-3 минуты
- ✅ Каждый оффер готов к показу в ленте
- ✅ Уникальные фото для каждого оффера
- ✅ Auto-suggestions для быстрого заполнения
- ✅ Pre-filled контакты из Place/Business

---

**Следующий шаг:** Создать Step1TypeMVP и остальные шаги wizard

