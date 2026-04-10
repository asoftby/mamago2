# Wizard Config Pattern - Quick Reference Guide

**Date**: 2026-03-14  
**Status**: ✅ Ready for Reuse

---

## Overview

This guide shows how to create new wizards (Offers, Routes, etc.) using the config-driven pattern established in Event Wizard.

---

## Step-by-Step Guide

### 1. Define Form Data Type

Create your wizard's form data type:

```typescript
// src/components/business/wizard/offer/types.ts
export interface OfferFormData {
  // Step 1: Basics
  title: string;
  type: string;
  categories: string[];
  
  // Step 2: Description
  shortDescription: string;
  fullDescription: string;
  
  // ... more fields
}

export type OfferWizardMode = "create" | "edit";
```

### 2. Create Step Components

Create individual step components:

```typescript
// src/components/business/wizard/offer/steps/Step1Basics.tsx
"use client";

import type { OfferFormData } from "../types";

interface Step1BasicsProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step1Basics({ data, onChange, isEditable }: Step1BasicsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Основное</h2>
      
      {/* Your form fields here */}
      <input
        type="text"
        value={data.title}
        onChange={(e) => onChange({ title: e.target.value })}
        disabled={!isEditable}
      />
    </div>
  );
}
```

### 3. Create Wizard Config

Create the config file with all steps:

```typescript
// src/components/business/wizard/offer/offerWizardSteps.config.tsx
import { WizardStepConfig, SummaryItem, buildReviewSections } from "../shared/types";
import type { OfferFormData } from "./types";

// Import step components
import { Step1Basics } from "./steps/Step1Basics";
import { Step2Description } from "./steps/Step2Description";
// ... more imports

// Re-export helper
export { buildReviewSections };

export const OFFER_WIZARD_STEPS: WizardStepConfig<OfferFormData>[] = [
  // Step 1: Basics
  {
    id: 1,
    key: "basics",
    title: "Основное",
    description: "Название и тип предложения",
    component: Step1Basics,
    
    isComplete: (data) => {
      return Boolean(data.title && data.type && data.categories.length > 0);
    },
    
    getSummary: (data) => {
      const items: SummaryItem[] = [
        {
          label: "Название",
          value: data.title || <span className="text-red-500">Не указано</span>,
          isMissing: !data.title,
        },
        {
          label: "Тип",
          value: data.type || <span className="text-red-500">Не выбран</span>,
          isMissing: !data.type,
        },
        {
          label: "Категории",
          value: data.categories.length > 0 
            ? data.categories.join(", ") 
            : <span className="text-red-500">Не выбраны</span>,
          isMissing: data.categories.length === 0,
        },
      ];
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.title) missing.push("Название");
      if (!data.type) missing.push("Тип");
      if (data.categories.length === 0) missing.push("Категории");
      return missing;
    },
  },
  
  // Step 2: Description
  {
    id: 2,
    key: "description",
    title: "Описание",
    component: Step2Description,
    
    isComplete: (data) => {
      return Boolean(data.shortDescription && data.fullDescription);
    },
    
    getSummary: (data) => [
      {
        label: "Краткое описание",
        value: data.shortDescription || <span className="text-red-500">Не указано</span>,
        isMissing: !data.shortDescription,
      },
      {
        label: "Полное описание",
        value: data.fullDescription 
          ? `${data.fullDescription.length} символов` 
          : <span className="text-red-500">Не указано</span>,
        isMissing: !data.fullDescription,
      },
    ],
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.shortDescription) missing.push("Краткое описание");
      if (!data.fullDescription) missing.push("Полное описание");
      return missing;
    },
  },
  
  // ... more steps
];

// Helper functions
export function getStepConfig(stepId: number): WizardStepConfig<OfferFormData> | undefined {
  return OFFER_WIZARD_STEPS.find(step => step.id === stepId);
}

export function getStepConfigByKey(key: string): WizardStepConfig<OfferFormData> | undefined {
  return OFFER_WIZARD_STEPS.find(step => step.key === key);
}

export const TOTAL_CONTENT_STEPS = OFFER_WIZARD_STEPS.length;

export function getStepLabel(stepId: number): string {
  const step = getStepConfig(stepId);
  return step ? step.title : `Шаг ${stepId}`;
}
```

### 4. Create Main Wizard Component

Create the main wizard container:

```typescript
// src/components/business/wizard/offer/OfferWizard.tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { OfferFormData, OfferWizardMode } from "./types";
import { OFFER_WIZARD_STEPS, getStepLabel, TOTAL_CONTENT_STEPS } from "./offerWizardSteps.config";
import { getDefaultFormData } from "./defaults";
import { Step9Review } from "./steps/Step9Review";

interface OfferWizardProps {
  mode: OfferWizardMode;
  offer?: any;
  userId: string;
}

const TOTAL_STEPS = TOTAL_CONTENT_STEPS + 1; // Content steps + review

export function OfferWizard({ mode, offer, userId }: OfferWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OfferFormData>(getDefaultFormData());

  const handleChange = useCallback((updates: Partial<OfferFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleGoToStep = (step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
    }
  };

  // Render current step (config-driven)
  const renderStep = () => {
    // Review step is special case
    if (currentStep === TOTAL_STEPS) {
      return <Step9Review data={formData} onGoToStep={handleGoToStep} />;
    }
    
    // Find step config
    const stepConfig = OFFER_WIZARD_STEPS.find(s => s.id === currentStep);
    if (!stepConfig) return null;
    
    // Render step component from config
    const StepComponent = stepConfig.component;
    return <StepComponent data={formData} onChange={handleChange} isEditable={true} />;
  };

  const canNext = currentStep < TOTAL_STEPS;
  const canPrev = currentStep > 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold mb-4">
            {mode === "create" ? "Новое предложение" : "Редактирование предложения"}
          </h1>
          
          <p className="text-sm text-muted-foreground mb-4">
            Шаг {currentStep} из {TOTAL_STEPS}: {getStepLabel(currentStep)}
          </p>
          
          {/* Progress bar */}
          <div className="flex gap-2 mb-4">
            {OFFER_WIZARD_STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => handleGoToStep(step.id)}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  step.id === currentStep
                    ? "bg-primary"
                    : step.id < currentStep
                    ? "bg-primary/50"
                    : "bg-gray-200"
                }`}
                title={step.title}
              />
            ))}
            {/* Review step */}
            <button
              onClick={() => handleGoToStep(TOTAL_STEPS)}
              className={`flex-1 h-2 rounded-full transition-colors ${
                TOTAL_STEPS === currentStep
                  ? "bg-primary"
                  : TOTAL_STEPS < currentStep
                  ? "bg-primary/50"
                  : "bg-gray-200"
              }`}
              title="Проверка"
            />
          </div>
          
          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div>
              {canPrev && (
                <Button variant="outline" onClick={handlePrev}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Назад
                </Button>
              )}
            </div>
            <div>
              {canNext && (
                <Button onClick={handleNext}>
                  Далее
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg border p-8">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
```

### 5. Create Review Step

Create the review step using config:

```typescript
// src/components/business/wizard/offer/steps/Step9Review.tsx
"use client";

import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { OFFER_WIZARD_STEPS, buildReviewSections } from "../offerWizardSteps.config";
import { validateStep, validateForSubmit } from "../validation";
import type { OfferFormData } from "../types";

interface Step9ReviewProps {
  data: OfferFormData;
  onGoToStep?: (step: number) => void;
}

export function Step9Review({ data, onGoToStep }: Step9ReviewProps) {
  const submitValidation = validateForSubmit(data);
  const reviewSections = buildReviewSections(OFFER_WIZARD_STEPS, data, validateStep);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Проверка и отправка</h2>
        <p className="text-sm text-muted-foreground">
          Проверьте все данные перед отправкой
        </p>
      </div>

      {/* Validation Status */}
      {!submitValidation.isValid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 mb-2">
                Не все обязательные поля заполнены
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {submitValidation.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Step Summary (Config-Driven) */}
      <div className="space-y-3">
        <h3 className="font-medium">Сводка по шагам</h3>
        
        {reviewSections.map((section) => (
          <div
            key={section.stepId}
            className={`border rounded-lg p-4 ${
              section.isComplete ? "bg-white" : "bg-yellow-50 border-yellow-200"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {section.isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                  )}
                  <h4 className="font-medium">Шаг {section.stepId}: {section.title}</h4>
                </div>
                
                {/* Summary from config */}
                <div className="text-sm text-muted-foreground space-y-1">
                  {section.summary.map((item, index) => (
                    <p key={index}>
                      {item.label}: {item.value}
                    </p>
                  ))}
                </div>
              </div>
              
              {onGoToStep && !section.isComplete && (
                <button
                  type="button"
                  onClick={() => onGoToStep(section.stepId)}
                  className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm"
                >
                  Перейти
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Key Principles

### DO

✅ Use config for step metadata (title, description, component)  
✅ Use config for completion logic (`isComplete`)  
✅ Use config for summary generation (`getSummary`)  
✅ Use config for missing fields (`getMissingFields`)  
✅ Keep step components simple and focused  
✅ Use `buildReviewSections()` helper in review step  
✅ Make config type-safe with generics  

### DON'T

❌ Put business logic in shared types  
❌ Create universal form engine  
❌ Over-abstract the pattern  
❌ Duplicate step metadata in multiple places  
❌ Hardcode step summaries in review step  
❌ Break existing wizards when adding new ones  

---

## Testing Your Wizard

Create a test script similar to `scripts/manual-tests/test-event-wizard-config.ts`:

```typescript
import { OFFER_WIZARD_STEPS, getStepConfig, TOTAL_CONTENT_STEPS } from "../src/components/business/wizard/offer/offerWizardSteps.config";
import { buildReviewSections } from "../src/components/business/wizard/shared/types";
import { getDefaultFormData } from "../src/components/business/wizard/offer/defaults";

console.log("Testing Offer Wizard Config");
console.log(`Total steps: ${TOTAL_CONTENT_STEPS}`);

// Test each step has required properties
OFFER_WIZARD_STEPS.forEach(step => {
  console.log(`Step ${step.id} (${step.key}): ${step.component ? "✓" : "✗"}`);
});

// Test completion logic
const data = getDefaultFormData();
const step1Complete = OFFER_WIZARD_STEPS[0].isComplete?.(data);
console.log(`Step 1 complete: ${step1Complete ? "✓" : "✗"}`);

// Test review sections
const sections = buildReviewSections(OFFER_WIZARD_STEPS, data);
console.log(`Review sections: ${sections.length}`);
```

---

## Benefits of This Pattern

1. **Single Source of Truth** - All step metadata in one place
2. **Type Safety** - Generic types ensure correctness
3. **Reusability** - Same pattern for all wizards
4. **Maintainability** - Easy to add/modify steps
5. **Testability** - Config can be tested independently
6. **Consistency** - All wizards work the same way

---

## Next Steps

1. Copy this pattern for Offers Wizard
2. Copy this pattern for Routes Wizard
3. Extract more shared UI components if needed
4. Consider creating wizard generator script

---

## Questions?

See `docs/EVENT_WIZARD_CONFIG_REFACTOR_COMPLETE.md` for detailed implementation example.
