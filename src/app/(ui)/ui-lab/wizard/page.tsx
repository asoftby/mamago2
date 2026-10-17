import Link from "next/link";
import { WizardPlayground } from "../../ui-lab-admin/wizard/_components/WizardPlayground";

export default function UiLabWizardPage() {
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <div className="mb-4"><Link className="text-sm text-primary underline" href="/ui-lab?tab=patterns">← В UI Lab / Паттерны</Link></div>
      <p className="mb-4 text-sm text-muted-foreground">Архивный прототип мастера. Не считается утверждённым стандартом без проверки адаптивности.</p>
      <WizardPlayground />
    </main>
  );
}
