/**
 * UI Lab Component Metadata Types
 * Shared types for ui-lab and ui-lab-admin
 */

export type ComponentStatus = "rendered" | "draft" | "deprecated";

export interface ComponentUsageMeta {
  /** Display title of the component */
  title: string;
  
  /** Path to source file */
  sourcePath: string;
  
  /** Component status */
  status: ComponentStatus;
  
  /** List of files where this component is used */
  usedIn: string[];
  
  /** Optional description */
  description?: string;
}

export interface ComponentMetaCardProps extends ComponentUsageMeta {
  /** Demo content to display */
  children?: React.ReactNode;
  
  /** Optional className for the card */
  className?: string;
}
