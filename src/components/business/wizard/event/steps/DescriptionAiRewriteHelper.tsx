"use client";

import { AiDescriptionAssistant } from "@/components/ai/AiDescriptionAssistant";

interface DescriptionAiRewriteHelperProps {
  title?: string;
  value: string;
  isEditable: boolean;
  onApply: (html: string) => void;
}

export function DescriptionAiRewriteHelper(props: DescriptionAiRewriteHelperProps) {
  return (
    <AiDescriptionAssistant
      entityType="event"
      title={props.title}
      value={props.value}
      isEditable={props.isEditable}
      onApply={props.onApply}
      emptyAction={null}
      filledActions={["improve", "shorten", "warm"]}
      helperText="Улучшает существующий текст без автозамены. Сначала показывает вариант, потом вы решаете, применять ли его."
    />
  );
}
