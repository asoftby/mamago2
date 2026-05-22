import { BirthdayQuizShell } from "@/features/birthday/components/quiz/BirthdayQuizShell";
import { applyGlobalRobotsOverride } from "@/lib/seo/globalNoindex";

export const metadata = applyGlobalRobotsOverride({
  title: "Собрать ДР за 10 минут — mamaGo",
  description: "Подберём площадку, аниматоров, торт и готовые предложения для детского дня рождения",
});

export default function BirthdayPage() {
  return (
    <main className="min-h-screen bg-background">
      <BirthdayQuizShell />
    </main>
  );
}
