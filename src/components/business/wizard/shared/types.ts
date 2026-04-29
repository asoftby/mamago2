// Shared Wizard Types
// Lightweight, practical contract for config-driven wizards

import { ReactNode } from "react";

/**
 * Summary item for review display
 */
export interface SummaryItem {
  label: string;
  value: ReactNode;
  isMissing?: boolean;
}

/**
 * Step validation result
 */
export interface StepValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  missingFields?: string[];
}

/**
 * Wizard step configuration
 */
export interface WizardStepConfig<TFormData = Record<string, unknown>> {
  id: number;
  key: string; // e.g., "basics", "description"
  title: string;
  /** Short 1-word label for WizardProgress nav tabs (e.g. "Тип", "Фото") */
  shortLabel?: string;
  description?: string;
  
  // Component to render for this step
  component: React.ComponentType<{
    data: TFormData;
    onChange: (updates: Partial<TFormData>) => void;
    isEditable: boolean;
    [key: string]: unknown; // Allow additional props
  }>;
  
  // Completion check
  isComplete?: (data: TFormData) => boolean;
  
  // Get summary for review step
  getSummary?: (data: TFormData) => SummaryItem[];
  
  // Get missing fields for review step
  getMissingFields?: (data: TFormData) => string[];
  
  // Validate step (optional, can use external validation)
  validateStep?: (data: TFormData) => StepValidationResult;
}

/**
 * Review section built from step config
 */
export interface ReviewSection {
  stepId: number;
  stepKey: string;
  title: string;
  isComplete: boolean;
  summary: SummaryItem[];
  missingFields: string[];
  errors?: string[];
  warnings?: string[];
}

/**
 * Helper to build review sections from step configs
 */
export function buildReviewSections<TFormData>(
  steps: WizardStepConfig<TFormData>[],
  data: TFormData,
  validateStep?: (stepId: number, data: TFormData) => StepValidationResult
): ReviewSection[] {
  return steps
    .filter(step => step.id < 9) // Exclude review step itself
    .map(step => {
      const isComplete = step.isComplete ? step.isComplete(data) : true;
      const summary = step.getSummary ? step.getSummary(data) : [];
      const missingFields = step.getMissingFields ? step.getMissingFields(data) : [];
      
      // Get validation if available
      const validation = validateStep ? validateStep(step.id, data) : null;
      
      return {
        stepId: step.id,
        stepKey: step.key,
        title: step.title,
        isComplete: validation?.isComplete ?? isComplete,
        summary,
        missingFields,
        errors: validation?.errors,
        warnings: validation?.warnings,
      };
    });
}
