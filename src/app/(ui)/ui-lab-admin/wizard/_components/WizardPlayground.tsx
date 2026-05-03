"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import {
  FormWizardShell,
  FormWizardHeader,
  FormPrimaryContentCard,
  FormStickyActionBar,
  FormStepSegments,
} from "@/components/form-shell";
import type { FormWizardSegment } from "@/components/form-shell";
import { WizardProgress } from "@/components/ui/wizard-progress";

import { WizardStep1Type } from "./WizardStep1Type";
import { WizardStep2TitleSlug } from "./WizardStep2TitleSlug";
import { WizardStep3Cover } from "./WizardStep3Cover";
import { WizardStep4Description } from "./WizardStep4Description";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OfferKind = "course" | "birthday" | "service" | null;

export interface PlaygroundFormData {
  offerKind: OfferKind;
  title: string;
  slug: string;
  coverUrl: string | null;
  description: string;
}

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS: Array<{ id: number; title: string; label: string }> = [
  { id: 1, title: "Тип предложения",    label: "Тип" },
  { id: 2, title: "Название и адрес",   label: "Название" },
  { id: 3, title: "Обложка",            label: "Обложка" },
  { id: 4, title: "Описание",           label: "Описание" },
];

const TOTAL = STEPS.length;

const SEGMENTS: FormWizardSegment[] = STEPS.map((s) => ({
  id: s.id,
  title: s.label,
}));

const ACTION_LABELS = {
  back: "Назад",
  next: "Далее",
  saveDraft: "Сохранить черновик",
  savingDraft: "Сохраняем…",
  submit: "Опубликовать",
  submitting: "Публикуем…",
};

// ─── Step validation ──────────────────────────────────────────────────────────

function isStepValid(step: number, data: PlaygroundFormData): boolean {
  switch (step) {
    case 1: return data.offerKind !== null;
    case 2: return data.title.trim().length >= 3 && data.slug.trim().length >= 2;
    case 3: return true; // cover is optional
    case 4: return data.description.trim().length >= 10;
    default: return true;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WizardPlayground() {
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<"idle" | "loading" | "savingDraft" | "submitting" | "validating" | "error">("idle");
  const [submitted, setSubmitted] = useState(false);

  const [data, setData] = useState<PlaygroundFormData>({
    offerKind: null,
    title: "",
    slug: "",
    coverUrl: null,
    description: "",
  });

  const update = (patch: Partial<PlaygroundFormData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const currentStepMeta = STEPS[step - 1];
  const stepValid = isStepValid(step, data);
  const isLastStep = step === TOTAL;

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleContinue = () => {
    if (!stepValid) return;
    setStep((s) => Math.min(TOTAL, s + 1));
  };

  const handleSaveDraft = () => {
    setPhase("savingDraft");
    setTimeout(() => setPhase("idle"), 1200);
  };

  const handleSubmit = () => {
    setPhase("submitting");
    setTimeout(() => {
      setPhase("idle");
      setSubmitted(true);
    }, 1500);
  };

  const handleStepClick = (id: number) => {
    // Allow navigating to already-completed steps
    if (id < step || isStepValid(step, data)) setStep(id);
  };

  if (submitted) {
    return <SubmittedState onReset={() => { setSubmitted(false); setStep(1); setData({ offerKind: null, title: "", slug: "", coverUrl: null, description: "" }); }} />;
  }

  return (
    <FormWizardShell>
      <FormWizardHeader
        title="Новое предложение"
        subtitle={`Шаг ${step} из ${TOTAL}: ${currentStepMeta.title}`}
        trailing={
          <span className="text-xs text-muted-foreground">
            Wizard Playground · UI Lab
          </span>
        }
      >
        <FormStepSegments
          segments={SEGMENTS}
          currentStep={step}
          onStepClick={handleStepClick}
        />
      </FormWizardHeader>

      <FormPrimaryContentCard>
        {step === 1 && (
          <WizardStep1Type
            value={data.offerKind}
            onChange={(offerKind) => update({ offerKind })}
          />
        )}
        {step === 2 && (
          <WizardStep2TitleSlug
            title={data.title}
            slug={data.slug}
            onTitleChange={(title) => update({ title })}
            onSlugChange={(slug) => update({ slug })}
          />
        )}
        {step === 3 && (
          <WizardStep3Cover
            coverUrl={data.coverUrl}
            onChange={(coverUrl) => update({ coverUrl })}
          />
        )}
        {step === 4 && (
          <WizardStep4Description
            value={data.description}
            onChange={(description) => update({ description })}
          />
        )}
      </FormPrimaryContentCard>

      <FormStickyActionBar
        phase={phase}
        labels={ACTION_LABELS}
        showBack={step > 1}
        onBack={handleBack}
        showSaveDraft
        onSaveDraft={handleSaveDraft}
        isReviewStep={isLastStep}
        onContinue={handleContinue}
        continueDisabled={!stepValid}
        onSubmit={handleSubmit}
        submitDisabled={!stepValid}
      />

      {/* Back to UI Lab link */}
      <div className="max-w-4xl mx-auto px-6 pt-4 pb-2">
        <Link
          href="/admin/ui-lab"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Вернуться в UI Lab
        </Link>
      </div>
    </FormWizardShell>
  );
}

// ─── Submitted state ──────────────────────────────────────────────────────────

function SubmittedState({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 shadow-sm text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold">Предложение опубликовано!</h2>
        <p className="text-sm text-muted-foreground">
          Это mock-состояние Wizard Playground. В реальном wizard здесь будет редирект на страницу предложения.
        </p>
        <Button onClick={onReset} variant="outline" className="w-full">
          Начать заново
        </Button>
        <Link href="/admin/ui-lab" className="block text-xs text-muted-foreground hover:text-foreground">
          ← Вернуться в UI Lab
        </Link>
      </div>
    </div>
  );
}
