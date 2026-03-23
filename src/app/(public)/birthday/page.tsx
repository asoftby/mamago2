import { BirthdayQuizShell } from "@/features/birthday/components/quiz/BirthdayQuizShell";

export const metadata = {
  title: "Собрать ДР за 10 минут — mamaGo",
  description: "Подберём площадку, аниматоров, торт и готовые предложения для детского дня рождения",
};

export default function BirthdayPage() {
  return (
    <main className="min-h-screen bg-background">
      <BirthdayQuizShell />
    </main>
  );
}
