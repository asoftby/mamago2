import { Suspense } from "react";
import { AuthPage } from "./AuthPage";

export const metadata = {
  title: "Вход — mamaGo",
};

export default function Page() {
  return (
    <Suspense>
      <AuthPage />
    </Suspense>
  );
}
