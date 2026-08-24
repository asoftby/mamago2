import type { Metadata } from "next";
import React from "react";
import { EditorProviders } from "@/components/providers/EditorProviders";
import { PERMANENT_NOINDEX_ROBOTS } from "@/lib/seo/indexingPolicy";

export const metadata: Metadata = {
  robots: PERMANENT_NOINDEX_ROBOTS,
};

/**
 * Isolated editor shell — no business dashboard sidebar, no site marketing chrome.
 * Same layout for business authors and admin/moderation when editing shared entity forms.
 */
export default function ContentEditorGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <EditorProviders>
      <div className="flex min-h-screen flex-col bg-background text-foreground">{children}</div>
    </EditorProviders>
  );
}
