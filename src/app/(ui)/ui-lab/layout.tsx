import React from "react";

/**
 * Минималистичный layout для UI Lab без хедера и навигации
 */
export default function UiLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
