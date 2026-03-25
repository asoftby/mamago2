import React from "react";

/**
 * Isolated editor shell — no business dashboard sidebar, no site marketing chrome.
 * Same layout for business authors and admin/moderation when editing shared entity forms.
 */
export default function ContentEditorGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">{children}</div>
  );
}
