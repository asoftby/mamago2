"use client";

import { Suspense } from "react";
import { VerificationStateHandler } from "./VerificationStateHandler";

export function GlobalVerificationStateHandler() {
  return (
    <Suspense fallback={null}>
      <VerificationStateHandler />
    </Suspense>
  );
}
